import { eq, isNull } from 'drizzle-orm'
import { assets, questionSets, questions } from '@vigoros/db'
import { METHODOLOGY_VERSION, VOL_LOOKBACK_DAYS, sha256Hex, type IsoDate } from '@vigoros/domain'
import { generateQuestions, type UniverseAsset } from '@vigoros/questions'
import { loadCalendars } from './calendar'
import type { JobContext } from './context'
import { loadPriceSeries } from './ingest'
import { priorTableFor } from './priors'

const addDays = (d: IsoDate, n: number): IsoDate => {
  const t = new Date(`${d}T00:00:00.000Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/**
 * Generate and persist the question set for one issue date. Idempotent: a second call for a
 * date that already has a set is a no-op. The seed is derived from a secret plus the date and
 * published with the set, so nobody can precompute the draw.
 */
export const generateDay = async (ctx: JobContext, issueDate: IsoDate, seedSecret: string): Promise<{ created: number; skipped: number; existed: boolean }> => {
  const [existing] = await ctx.db.select({ d: questionSets.issueDate }).from(questionSets).where(eq(questionSets.issueDate, issueDate))
  if (existing) return { created: 0, skipped: 0, existed: true }

  const seed = (await sha256Hex(`${seedSecret}|${issueDate}`)).slice(0, 16)
  const calendars = await loadCalendars(ctx, issueDate)
  const priors = await priorTableFor(ctx, issueDate)
  const active = await ctx.db
    .select({ id: assets.id, symbol: assets.symbol, venue: assets.venue, assetClass: assets.assetClass, peerGroup: assets.peerGroup, activeFrom: assets.activeFrom })
    .from(assets)
    .where(isNull(assets.activeTo))
  const universe: UniverseAsset[] = active.map((a) => ({ id: a.id, symbol: a.symbol, venue: a.venue, assetClass: a.assetClass, peerGroup: a.peerGroup }))
  const series = await loadPriceSeries(ctx, universe.map((a) => a.id), addDays(issueDate, -(VOL_LOOKBACK_DAYS * 2 + 10)), addDays(issueDate, -1))

  const out = generateQuestions({ issueDate, seed, assets: universe, calendars, prices: series, priors })
  const universeVersion = active[0]?.activeFrom
  if (universeVersion === undefined) throw new Error('empty universe')
  if (out.questions.length === 0) {
    // Nothing to issue (all venues closed, or reference prices not yet ingested). Do not persist an
    // empty set, so a later run on the same date can still generate it.
    ctx.log.warn('no questions generated', { issueDate, skipped: out.skipped.length, reasons: [...new Set(out.skipped.map((s) => s.reason))] })
    return { created: 0, skipped: out.skipped.length, existed: false }
  }

  await ctx.db.transaction(async (tx) => {
    await tx.insert(questionSets).values({
      issueDate,
      seed,
      methodologyVersion: METHODOLOGY_VERSION,
      universeVersion,
      questionCount: out.questions.length,
      priorTable: { ...priors, skipped: out.skipped },
    })
    const rows = out.questions.map((q) => ({
      id: q.id,
      issueDate: q.issueDate,
      venue: q.venue,
      assetId: q.assetId,
      type: q.type,
      horizon: q.horizon,
      levelK: q.levelK,
      threshold: q.threshold,
      referencePrice: q.referencePrice,
      prior: q.prior,
      deadlineAt: new Date(q.deadlineAt),
      resolvesOn: q.resolvesOn,
      status: 'OPEN' as const,
      methodologyVersion: q.methodologyVersion,
    }))
    for (let i = 0; i < rows.length; i += 500) await tx.insert(questions).values(rows.slice(i, i + 500))
  })
  ctx.log.info('question set generated', { issueDate, created: out.questions.length, skipped: out.skipped.length })
  return { created: out.questions.length, skipped: out.skipped.length, existed: false }
}
