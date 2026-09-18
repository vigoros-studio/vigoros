import { and, eq, isNull, sql } from 'drizzle-orm'
import { assets, participants, prices, questions, referenceRuns } from '@vigoros/db'
import { newId, type IsoDate, type Question } from '@vigoros/domain'
import { baselineForecast, runProvider, type BaselineId, type PromptQuestion } from '@vigoros/reference'
import { commitMany, openQuestionsFor } from './commit'
import { Deadline, type JobContext, type ReferenceModelConfig } from './context'

const addDays = (d: IsoDate, n: number): IsoDate => {
  const t = new Date(`${d}T00:00:00.000Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

const toQuestion = (r: typeof questions.$inferSelect): Question => ({
  id: r.id,
  issueDate: r.issueDate,
  venue: r.venue,
  assetId: r.assetId,
  symbol: '',
  type: r.type,
  horizon: r.horizon as Question['horizon'],
  levelK: (r.levelK ?? null) as Question['levelK'],
  threshold: r.threshold,
  referencePrice: r.referencePrice,
  prior: r.prior,
  deadlineAt: r.deadlineAt.toISOString(),
  resolvesOn: r.resolvesOn,
  status: r.status,
  outcome: (r.outcome ?? null) as Question['outcome'],
  resolvedAt: r.resolvedAt?.toISOString() ?? null,
  methodologyVersion: r.methodologyVersion,
})

/** Baselines are cheap and deterministic: commit all of them for the day in one pass. */
export const runBaselines = async (ctx: JobContext, issueDate: IsoDate, seed: string): Promise<Record<string, number>> => {
  const rows = await ctx.db.select().from(participants).where(eq(participants.kind, 'BASELINE'))
  const out: Record<string, number> = {}
  // Trailing 63-trading-day return per asset, computed from two indexed point lookups.
  const trailing = new Map<string, number>()
  const ref = addDays(issueDate, -1)
  const from = addDays(issueDate, -95)
  const series = await ctx.db
    .select({ assetId: prices.assetId, day: prices.day, adjClose: prices.adjClose })
    .from(prices)
    .where(and(sql`${prices.day} >= ${from}`, sql`${prices.day} <= ${ref}`))
  const byAsset = new Map<string, { day: string; adjClose: number }[]>()
  for (const r of series) (byAsset.get(r.assetId) ?? byAsset.set(r.assetId, []).get(r.assetId)!).push(r)
  for (const [id, bars] of byAsset) {
    bars.sort((a, b) => (a.day < b.day ? -1 : 1))
    const last = bars[bars.length - 1]
    const first = bars[Math.max(0, bars.length - 64)]
    if (last && first && first.adjClose > 0) trailing.set(id, last.adjClose / first.adjClose - 1)
  }

  for (const p of rows) {
    const strategy = (p.config as { strategy?: BaselineId } | null)?.strategy
    if (!strategy) continue
    const open = await openQuestionsFor(ctx, p.id, issueDate)
    const items = open.map((q) => {
      const f = baselineForecast(strategy, toQuestion(q), { trailingReturn: trailing, seed })
      return { questionId: q.id, issueDate: q.issueDate, p: f.p, reasoning: f.reasoning }
    })
    out[p.handle] = await commitMany(ctx, p.id, items)
  }
  return out
}

/**
 * One chunked step for one reference model. Commits whatever it manages within the time budget
 * and the question deadlines, records the run, and can be called again to finish the day.
 * Never falls back to another model.
 */
export const runReferenceModelStep = async (
  ctx: JobContext,
  issueDate: IsoDate,
  participantId: string,
): Promise<{ answered: number; failedBatches: number; remaining: number; skipped?: string }> => {
  const deadline = new Deadline(ctx.timeBudgetMs, ctx.now)
  const [p] = await ctx.db.select().from(participants).where(eq(participants.id, participantId))
  if (!p || p.kind !== 'REFERENCE_MODEL') throw new Error('not a reference model participant')
  const config = p.config as ReferenceModelConfig
  const provider = ctx.providerFor(config)
  if (!provider) return { answered: 0, failedBatches: 0, remaining: 0, skipped: `no credentials for ${config.provider}` }

  const open = await openQuestionsFor(ctx, participantId, issueDate)
  if (open.length === 0) return { answered: 0, failedBatches: 0, remaining: 0 }
  const symbols = new Map(
    (await ctx.db.select({ id: assets.id, symbol: assets.symbol }).from(assets).where(isNull(assets.activeTo))).map((a) => [a.id, a.symbol]),
  )
  // Earliest deadline among open questions bounds the run; questions past it are dropped by the API anyway.
  const earliest = open.reduce((m, q) => (q.deadlineAt < m ? q.deadlineAt : m), open[0]!.deadlineAt)
  const budgetEnd = new Date(Math.min(earliest.getTime(), ctx.now().getTime() + deadline.remainingMs))

  // Take a slice sized for the time budget: ~40 questions per batch, ~10s per batch, 3 in flight.
  const capacity = Math.max(40, Math.floor((deadline.remainingMs / 10_000) * 40 * 3))
  const slice = open.slice(0, capacity)
  const prompt: PromptQuestion[] = slice.map((q) => ({
    id: q.id,
    symbol: symbols.get(q.assetId) ?? q.assetId,
    venue: q.venue,
    type: q.type,
    horizon: q.horizon as PromptQuestion['horizon'],
    threshold: q.threshold,
    referencePrice: q.referencePrice,
    resolvesOn: q.resolvesOn,
    issueDate: q.issueDate,
  }))

  const startedAt = ctx.now()
  const result = await runProvider(provider, prompt, issueDate, { deadline: budgetEnd, now: ctx.now })
  const byId = new Map(slice.map((q) => [q.id, q]))
  const items = [...result.answers.values()].map((a) => ({
    questionId: a.question_id,
    issueDate: byId.get(a.question_id)!.issueDate,
    p: a.p,
    reasoning: a.reasoning,
  }))
  const answered = await commitMany(ctx, participantId, items)

  await ctx.db
    .insert(referenceRuns)
    .values({
      id: newId(startedAt),
      participantId,
      issueDate,
      provider: provider.id,
      model: provider.model,
      promptVersion: config.promptVersion,
      requestHash: result.requestHashes[0] ?? '0'.repeat(64),
      responseHash: result.responseHashes[0] ?? null,
      questionsAnswered: answered,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      latencyMs: ctx.now().getTime() - startedAt.getTime(),
      error: result.failedBatches.length ? result.failedBatches.map((f) => f.error).join(' | ').slice(0, 1000) : null,
      startedAt,
      finishedAt: ctx.now(),
    })
    .onConflictDoUpdate({
      target: [referenceRuns.participantId, referenceRuns.issueDate],
      set: {
        questionsAnswered: sql`${referenceRuns.questionsAnswered} + ${answered}`,
        inputTokens: sql`coalesce(${referenceRuns.inputTokens}, 0) + ${result.usage.inputTokens}`,
        outputTokens: sql`coalesce(${referenceRuns.outputTokens}, 0) + ${result.usage.outputTokens}`,
        finishedAt: ctx.now(),
        error: result.failedBatches.length ? result.failedBatches.map((f) => f.error).join(' | ').slice(0, 1000) : null,
      },
    })

  return { answered, failedBatches: result.failedBatches.length, remaining: open.length - answered }
}
