import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm'
import { assets, commitments, participantDaily, questions, scores } from '@vigoros/db'
import { METHODOLOGY_VERSION, type IsoDate, type Question } from '@vigoros/domain'
import { resolveQuestions, type UniverseAsset } from '@vigoros/questions'
import { addCalibration, emptyCalibration, scoreCommitment } from '@vigoros/scoring'
import { loadCalendars } from './calendar.js'
import { Deadline, type JobContext } from './context.js'
import { loadPriceSeries } from './ingest.js'
import { revealFor } from './seal.js'

const addDays = (d: IsoDate, n: number): IsoDate => {
  const t = new Date(`${d}T00:00:00.000Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/**
 * Resolve every question due on or before `asOf` whose venue has prices for its resolution day,
 * reveal the commitments, score them, and refresh the affected daily aggregates.
 *
 * Incremental and idempotent: questions move OPEN → RESOLVED/VOID once; scores insert with
 * ON CONFLICT DO NOTHING; daily aggregates are recomputed from that day's score rows (bounded
 * by one participant-day), never incremented, so a re-run cannot double count.
 */
export const resolveDue = async (ctx: JobContext, asOf: IsoDate): Promise<{ resolved: number; voided: number; deferred: number; scored: number }> => {
  const deadline = new Deadline(ctx.timeBudgetMs, ctx.now)
  const due = await ctx.db
    .select()
    .from(questions)
    .where(and(eq(questions.status, 'OPEN'), lte(questions.resolvesOn, asOf)))
    .limit(20_000)
  if (due.length === 0) return { resolved: 0, voided: 0, deferred: 0, scored: 0 }

  const calendars = await loadCalendars(ctx, asOf)
  const universe = await ctx.db
    .select({ id: assets.id, symbol: assets.symbol, venue: assets.venue, assetClass: assets.assetClass, peerGroup: assets.peerGroup })
    .from(assets)
  const assetMap = new Map<string, UniverseAsset>(universe.map((a) => [a.id, a]))

  // Only resolve questions whose venue actually has prices on the resolution day; a projected
  // day that turned out to be a closure is shifted to the next projected trading day.
  const earliestIssue = due.reduce((m, q) => (q.issueDate < m ? q.issueDate : m), due[0]!.issueDate)
  const series = await loadPriceSeries(ctx, universe.map((a) => a.id), addDays(earliestIssue, -5), asOf)
  const venueHasDay = (venue: Question['venue'], day: IsoDate): boolean => {
    let n = 0
    for (const a of universe) if (a.venue === venue && series.get(a.id)?.has(day)) if (++n >= 3) return true
    return false
  }

  const ready: typeof due = []
  let deferred = 0
  for (const q of due) {
    if (venueHasDay(q.venue, q.resolvesOn)) {
      ready.push(q)
    } else if (q.resolvesOn < asOf) {
      // Venue was closed on the projected day: move to the next projected trading day.
      const next = calendars[q.venue].advance(addDays(q.resolvesOn, 1), 1)
      if (next) await ctx.db.update(questions).set({ resolvesOn: next }).where(eq(questions.id, q.id))
      deferred++
    } else {
      deferred++
    }
  }
  if (ready.length === 0) return { resolved: 0, voided: 0, deferred, scored: 0 }

  const asQuestion = (r: (typeof due)[number]): Question => ({
    id: r.id,
    issueDate: r.issueDate,
    venue: r.venue,
    assetId: r.assetId,
    symbol: assetMap.get(r.assetId)?.symbol ?? '',
    type: r.type,
    horizon: r.horizon as Question['horizon'],
    levelK: (r.levelK ?? null) as Question['levelK'],
    threshold: r.threshold,
    referencePrice: r.referencePrice,
    prior: r.prior,
    deadlineAt: r.deadlineAt.toISOString(),
    resolvesOn: r.resolvesOn,
    status: r.status,
    outcome: null,
    resolvedAt: null,
    methodologyVersion: r.methodologyVersion,
  })
  const resolutions = resolveQuestions({ questions: ready.map(asQuestion), assets: assetMap, calendars, prices: series, universeAtIssue: universe })

  let resolved = 0
  let voided = 0
  const resolvedIds: string[] = []
  const outcomeById = new Map<string, 0 | 1>()
  const now = ctx.now()
  for (const r of resolutions) {
    if (r.status === 'RESOLVED') {
      await ctx.db.update(questions).set({ status: 'RESOLVED', outcome: r.outcome, resolvedAt: now }).where(and(eq(questions.id, r.questionId), eq(questions.status, 'OPEN')))
      resolvedIds.push(r.questionId)
      outcomeById.set(r.questionId, r.outcome)
      resolved++
    } else {
      await ctx.db.update(questions).set({ status: 'VOID', voidReason: r.reason, resolvedAt: now }).where(and(eq(questions.id, r.questionId), eq(questions.status, 'OPEN')))
      voided++
    }
    if (deadline.expired) break
  }

  await revealFor(ctx, resolvedIds)
  const scored = await scoreResolved(ctx, resolvedIds, outcomeById, new Map(ready.map((q) => [q.id, q])))
  ctx.log.info('resolved', { asOf, resolved, voided, deferred, scored })
  return { resolved, voided, deferred, scored }
}

const scoreResolved = async (
  ctx: JobContext,
  questionIds: string[],
  outcomeById: Map<string, 0 | 1>,
  qById: Map<string, typeof questions.$inferSelect>,
): Promise<number> => {
  if (questionIds.length === 0) return 0
  let scored = 0
  const touched = new Set<string>() // participantId|issueDate
  for (let i = 0; i < questionIds.length; i += 500) {
    const ids = questionIds.slice(i, i + 500)
    const cs = await ctx.db
      .select({ id: commitments.id, participantId: commitments.participantId, questionId: commitments.questionId, issueDate: commitments.issueDate, p: commitments.p })
      .from(commitments)
      .where(inArray(commitments.questionId, ids))
    const rows = cs.map((c) => {
      const q = qById.get(c.questionId)!
      const y = outcomeById.get(c.questionId)!
      const s = scoreCommitment(c.p, q.prior, y)
      touched.add(`${c.participantId}|${c.issueDate}`)
      return {
        commitmentId: c.id,
        methodologyVersion: METHODOLOGY_VERSION,
        participantId: c.participantId,
        questionId: c.questionId,
        issueDate: c.issueDate,
        horizon: q.horizon,
        questionType: q.type,
        outcome: y,
        brier: s.brier,
        priorBrier: s.priorBrier,
        log: s.log,
        priorLog: s.priorLog,
      }
    })
    for (let j = 0; j < rows.length; j += 500) {
      const r = await ctx.db.insert(scores).values(rows.slice(j, j + 500)).onConflictDoNothing().returning({ id: scores.commitmentId })
      scored += r.length
    }
  }
  for (const key of touched) {
    const [participantId, issueDate] = key.split('|') as [string, string]
    await refreshParticipantDay(ctx, participantId, issueDate)
  }
  return scored
}

/**
 * Recompute one participant-day's additive aggregates from its score rows. Bounded work:
 * at most the questions of one day. Overwrites, so it is idempotent.
 */
export const refreshParticipantDay = async (ctx: JobContext, participantId: string, issueDate: string): Promise<void> => {
  const rows = await ctx.db
    .select({ horizon: scores.horizon, questionType: scores.questionType, outcome: scores.outcome, brier: scores.brier, priorBrier: scores.priorBrier, log: scores.log, priorLog: scores.priorLog, p: commitments.p })
    .from(scores)
    .innerJoin(commitments, eq(commitments.id, scores.commitmentId))
    .where(and(eq(scores.participantId, participantId), eq(scores.issueDate, issueDate), eq(scores.methodologyVersion, METHODOLOGY_VERSION)))
  const groups = new Map<string, { horizon: number; questionType: typeof rows[number]['questionType']; n: number; sb: number; spb: number; sl: number; spl: number; cal: ReturnType<typeof emptyCalibration> }>()
  for (const r of rows) {
    const key = `${r.horizon}|${r.questionType}`
    let g = groups.get(key)
    if (!g) groups.set(key, (g = { horizon: r.horizon, questionType: r.questionType, n: 0, sb: 0, spb: 0, sl: 0, spl: 0, cal: emptyCalibration() }))
    g.n++
    g.sb += r.brier
    g.spb += r.priorBrier
    g.sl += r.log
    g.spl += r.priorLog
    addCalibration(g.cal, r.p, r.outcome as 0 | 1)
  }
  for (const g of groups.values()) {
    await ctx.db
      .insert(participantDaily)
      .values({
        participantId,
        issueDate,
        methodologyVersion: METHODOLOGY_VERSION,
        horizon: g.horizon,
        questionType: g.questionType,
        n: g.n,
        sumBrier: g.sb,
        sumPriorBrier: g.spb,
        sumLog: g.sl,
        sumPriorLog: g.spl,
        calCounts: g.cal.counts,
        calSumForecast: g.cal.sumForecast,
        calSumOutcome: g.cal.sumOutcome,
        updatedAt: ctx.now(),
      })
      .onConflictDoUpdate({
        target: [participantDaily.participantId, participantDaily.issueDate, participantDaily.methodologyVersion, participantDaily.horizon, participantDaily.questionType],
        set: {
          n: sql`excluded.n`,
          sumBrier: sql`excluded.sum_brier`,
          sumPriorBrier: sql`excluded.sum_prior_brier`,
          sumLog: sql`excluded.sum_log`,
          sumPriorLog: sql`excluded.sum_prior_log`,
          calCounts: sql`excluded.cal_counts`,
          calSumForecast: sql`excluded.cal_sum_forecast`,
          calSumOutcome: sql`excluded.cal_sum_outcome`,
          updatedAt: sql`excluded.updated_at`,
        },
      })
  }
}

/** Unused-import guard for isNull in some TS configs. */
void isNull
