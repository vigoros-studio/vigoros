import { and, asc, count, eq, sql } from 'drizzle-orm'
import { participantDaily, participantStats, participants, questions } from '@vigoros/db'
import { METHODOLOGY_VERSION, MIN_DISTINCT_ISSUE_DATES, MIN_RESOLVED_COMMITMENTS } from '@vigoros/domain'
import {
  adjustForIdentities,
  bootstrapBss,
  emptyAccumulator,
  emptyCalibration,
  mergeAccumulators,
  mergeCalibration,
  pValueSkill,
  summarise,
  summariseCalibration,
  type DailyAccumulator,
  type ScoreAccumulator,
} from '@vigoros/scoring'
import { Deadline, type JobContext } from './context'

/**
 * Materialise participant_stats for one participant from its daily aggregates.
 * Cost is O(days × 9) rows read plus the bootstrap over days. Never touches commitments.
 */
export const computeParticipantStats = async (ctx: JobContext, participantId: string): Promise<void> => {
  const rows = await ctx.db
    .select()
    .from(participantDaily)
    .where(and(eq(participantDaily.participantId, participantId), eq(participantDaily.methodologyVersion, METHODOLOGY_VERSION)))
    .orderBy(asc(participantDaily.issueDate))

  const byDay = new Map<string, ScoreAccumulator>()
  const byHorizon = new Map<number, ScoreAccumulator>()
  const byType = new Map<string, ScoreAccumulator>()
  let cal = emptyCalibration()
  const toAcc = (r: (typeof rows)[number]): ScoreAccumulator => ({ n: r.n, sumBrier: r.sumBrier, sumPriorBrier: r.sumPriorBrier, sumLog: r.sumLog, sumPriorLog: r.sumPriorLog })
  for (const r of rows) {
    const a = toAcc(r)
    byDay.set(r.issueDate, mergeAccumulators(byDay.get(r.issueDate) ?? emptyAccumulator(), a))
    byHorizon.set(r.horizon, mergeAccumulators(byHorizon.get(r.horizon) ?? emptyAccumulator(), a))
    byType.set(r.questionType, mergeAccumulators(byType.get(r.questionType) ?? emptyAccumulator(), a))
    cal = mergeCalibration(cal, { counts: r.calCounts, sumForecast: r.calSumForecast, sumOutcome: r.calSumOutcome })
  }
  const days: DailyAccumulator[] = [...byDay].map(([issueDate, acc]) => ({ issueDate, acc }))
  const total = summarise(days.reduce((acc, d) => mergeAccumulators(acc, d.acc), emptyAccumulator()))
  const eligible = (total?.n ?? 0) >= MIN_RESOLVED_COMMITMENTS && days.length >= MIN_DISTINCT_ISSUE_DATES

  // Identity count: other identities of the same publisher with any scored record.
  const [p] = await ctx.db.select({ publisherId: participants.publisherId }).from(participants).where(eq(participants.id, participantId))
  const [idc] = p
    ? await ctx.db
        .select({ n: count() })
        .from(participants)
        .innerJoin(participantStats, eq(participantStats.participantId, participants.id))
        .where(eq(participants.publisherId, p.publisherId))
    : [{ n: 1 }]
  const identityCount = Math.max(1, idc?.n ?? 1)

  // Coverage: answered / issued over the record's span.
  const first = days[0]?.issueDate
  const last = days[days.length - 1]?.issueDate
  let coverage: number | null = null
  if (first && last && total) {
    const [issued] = await ctx.db.select({ n: count() }).from(questions).where(and(sql`${questions.issueDate} >= ${first}`, sql`${questions.issueDate} <= ${last}`, sql`${questions.status} <> 'VOID'`))
    coverage = issued?.n ? total.n / issued.n : null
  }

  const seed = 0x5eed
  const ci = eligible ? bootstrapBss(days, { seed }) : null
  const pv = eligible ? pValueSkill(days, 2000, seed) : null
  const calSummary = summariseCalibration(cal)

  // Rolling 63-day BSS, one point per issue date, from prefix sums over days: O(days).
  const rolling: { date: string; bss: number; n: number }[] = []
  for (let i = 0; i < days.length; i++) {
    let acc = emptyAccumulator()
    for (let j = Math.max(0, i - 62); j <= i; j++) acc = mergeAccumulators(acc, days[j]!.acc)
    const s = summarise(acc)
    if (s) rolling.push({ date: days[i]!.issueDate, bss: s.bss, n: s.n })
  }

  const bssOf = (m: Map<unknown, ScoreAccumulator>) => Object.fromEntries([...m].map(([k, a]) => [String(k), summarise(a)?.bss ?? null]))

  await ctx.db
    .insert(participantStats)
    .values({
      participantId,
      methodologyVersion: METHODOLOGY_VERSION,
      n: total?.n ?? 0,
      distinctIssueDates: days.length,
      firstIssueDate: first ?? null,
      lastIssueDate: last ?? null,
      eligible,
      bss: total?.bss ?? null,
      bssLower: ci?.lower ?? null,
      bssUpper: ci?.upper ?? null,
      evidenceNats: total?.evidenceNats ?? null,
      ece: calSummary?.ece ?? null,
      reliability: calSummary?.reliability ?? null,
      resolution: calSummary?.resolution ?? null,
      uncertainty: calSummary?.uncertainty ?? null,
      pValue: pv,
      identityCount,
      adjustedPValue: pv === null ? null : adjustForIdentities(pv, identityCount),
      coverage,
      distinctAssets: null,
      bssByHorizon: bssOf(byHorizon),
      bssByType: bssOf(byType),
      rollingSeries: rolling.slice(-400),
      calibrationBins: calSummary?.bins ?? null,
      bootstrapSeed: seed,
      computedAt: ctx.now(),
    })
    .onConflictDoUpdate({
      target: [participantStats.participantId, participantStats.methodologyVersion],
      set: {
        n: sql`excluded.n`,
        distinctIssueDates: sql`excluded.distinct_issue_dates`,
        firstIssueDate: sql`excluded.first_issue_date`,
        lastIssueDate: sql`excluded.last_issue_date`,
        eligible: sql`excluded.eligible`,
        bss: sql`excluded.bss`,
        bssLower: sql`excluded.bss_lower`,
        bssUpper: sql`excluded.bss_upper`,
        evidenceNats: sql`excluded.evidence_nats`,
        ece: sql`excluded.ece`,
        reliability: sql`excluded.reliability`,
        resolution: sql`excluded.resolution`,
        uncertainty: sql`excluded.uncertainty`,
        pValue: sql`excluded.p_value`,
        identityCount: sql`excluded.identity_count`,
        adjustedPValue: sql`excluded.adjusted_p_value`,
        coverage: sql`excluded.coverage`,
        bssByHorizon: sql`excluded.bss_by_horizon`,
        bssByType: sql`excluded.bss_by_type`,
        rollingSeries: sql`excluded.rolling_series`,
        calibrationBins: sql`excluded.calibration_bins`,
        computedAt: sql`excluded.computed_at`,
      },
    })
}

/** Refresh stats for every participant with any daily aggregate, within the time budget. */
export const computeAllStats = async (ctx: JobContext): Promise<{ updated: number; remaining: number }> => {
  const deadline = new Deadline(ctx.timeBudgetMs, ctx.now)
  const ids = await ctx.db
    .selectDistinct({ id: participantDaily.participantId })
    .from(participantDaily)
    .where(eq(participantDaily.methodologyVersion, METHODOLOGY_VERSION))
  let updated = 0
  for (const { id } of ids) {
    if (deadline.expired) break
    await computeParticipantStats(ctx, id)
    updated++
  }
  return { updated, remaining: ids.length - updated }
}
