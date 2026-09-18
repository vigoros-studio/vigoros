import { sql } from 'drizzle-orm'
import { tradingDays } from '@vigoros/db'
import { VENUES, type IsoDate, type VenueId } from '@vigoros/domain'
import { TradingCalendar } from '@vigoros/questions'
import holidaysJson from '../data/holidays.json'
import type { JobContext } from './context'

const holidays = holidaysJson as Record<VenueId, string[]>

const addDays = (d: IsoDate, n: number): IsoDate => {
  const t = new Date(`${d}T00:00:00.000Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/** Projected trading days: weekdays (or every day) minus the published holiday list. */
export const projectedDays = (venue: VenueId, from: IsoDate, to: IsoDate): IsoDate[] => {
  const out: IsoDate[] = []
  const hol = new Set(holidays[venue] ?? [])
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = new Date(`${d}T00:00:00.000Z`).getUTCDay()
    if (!VENUES[venue].tradesWeekends && (wd === 0 || wd === 6)) continue
    if (hol.has(d)) continue
    out.push(d)
  }
  return out
}

/**
 * Calendar = observed trading days (from ingested prices) up to today, plus projected days for
 * the next 60 calendar days so resolution dates can be assigned. Observed days win over projection.
 */
export const loadCalendars = async (ctx: JobContext, asOf: IsoDate, lookbackDays = 800): Promise<Record<VenueId, TradingCalendar>> => {
  const from = addDays(asOf, -lookbackDays)
  const rows = await ctx.db
    .select({ venue: tradingDays.venue, day: tradingDays.day })
    .from(tradingDays)
    .where(sql`${tradingDays.day} >= ${from} and ${tradingDays.day} <= ${asOf}`)
  const observed: Record<VenueId, IsoDate[]> = { US: [], UK: [], FX: [], CRYPTO: [] }
  for (const r of rows) observed[r.venue].push(r.day)
  const result = {} as Record<VenueId, TradingCalendar>
  for (const venue of Object.keys(VENUES) as VenueId[]) {
    const obs = observed[venue]
    const lastObserved = obs.length ? (obs[obs.length - 1] as IsoDate) : addDays(asOf, -1)
    // Project from the day after the last observed day (or from asOf when nothing observed yet).
    const projStart = lastObserved < asOf ? addDays(lastObserved, 1) : addDays(asOf, 1)
    const projected = projectedDays(venue, projStart, addDays(asOf, 60))
    result[venue] = new TradingCalendar(venue, obs.length ? [...obs, ...projected] : projectedDays(venue, from, addDays(asOf, 60)))
  }
  return result
}

/** Record the trading days actually observed in a batch of price bars. Idempotent. */
export const recordTradingDays = async (ctx: JobContext, venue: VenueId, days: Iterable<IsoDate>): Promise<void> => {
  const values = [...new Set(days)].map((day) => ({ venue, day }))
  if (values.length === 0) return
  await ctx.db.insert(tradingDays).values(values).onConflictDoNothing()
}
