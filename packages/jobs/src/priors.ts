import { desc, eq, isNull } from 'drizzle-orm'
import { assets, priorTables } from '@vigoros/db'
import { METHODOLOGY_VERSION, PRIOR_LOOKBACK_DAYS, type IsoDate } from '@vigoros/domain'
import { computePriorTable, type PriorTable } from '@vigoros/questions'
import { loadCalendars } from './calendar.js'
import type { JobContext } from './context.js'
import { loadPriceSeries } from './ingest.js'

const monthStart = (d: IsoDate): IsoDate => `${d.slice(0, 7)}-01`
const addDays = (d: IsoDate, n: number): IsoDate => {
  const t = new Date(`${d}T00:00:00.000Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/**
 * The prior table in force for an issue date. Computed once per month from the trailing
 * window ending at the last trading day before the month, then cached (methodology §5).
 * Falls back to the most recent earlier table if history is too short for a fresh one.
 */
export const priorTableFor = async (ctx: JobContext, issueDate: IsoDate): Promise<PriorTable> => {
  const month = monthStart(issueDate)
  const [cached] = await ctx.db.select().from(priorTables).where(eq(priorTables.month, month))
  if (cached) return cached.table as PriorTable

  const calendars = await loadCalendars(ctx, issueDate)
  const asOfCandidate = addDays(month, -1)
  const active = await ctx.db
    .select({ id: assets.id, assetClass: assets.assetClass, venue: assets.venue })
    .from(assets)
    .where(isNull(assets.activeTo))
  const from = addDays(asOfCandidate, -Math.ceil(PRIOR_LOOKBACK_DAYS * 1.6))
  const series = await loadPriceSeries(ctx, active.map((a) => a.id), from, asOfCandidate)

  const histories = active.flatMap((a) => {
    const cal = calendars[a.venue]
    const s = series.get(a.id)
    if (!s || s.size < 60) return []
    // Use the last trading day of that venue on or before asOfCandidate.
    const asOf = cal.isTradingDay(asOfCandidate) ? asOfCandidate : cal.previous(asOfCandidate)
    return asOf ? [{ assetClass: a.assetClass, calendar: cal, series: s, asOf }] : []
  })

  if (histories.length === 0) {
    const [previous] = await ctx.db.select().from(priorTables).orderBy(desc(priorTables.month)).limit(1)
    if (previous) return previous.table as PriorTable
    ctx.log.warn('no price history for priors; using defaults')
    return { level: {}, relative: 0.5, quintile: 0.2, support: {} }
  }

  // computePriorTable takes one asOf; venues differ by a day at most, so use the modal asOf.
  const asOf = histories.map((h) => h.asOf).sort()[Math.floor(histories.length / 2)] as IsoDate
  const table = computePriorTable(histories.filter((h) => h.calendar.isTradingDay(asOf)), asOf, PRIOR_LOOKBACK_DAYS)
  await ctx.db
    .insert(priorTables)
    .values({ month, methodologyVersion: METHODOLOGY_VERSION, table, asOf })
    .onConflictDoNothing()
  ctx.log.info('prior table computed', { month, asOf, classes: Object.keys(table.level) })
  return table
}
