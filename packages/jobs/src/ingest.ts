import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { assets, prices } from '@vigoros/db'
import { VENUES, type IsoDate, type VenueId } from '@vigoros/domain'
import { fetchUniverse, type PriceSourceAsset } from '@vigoros/prices'
import { recordTradingDays } from './calendar'
import { Deadline, type JobContext } from './context'

const addDays = (d: IsoDate, n: number): IsoDate => {
  const t = new Date(`${d}T00:00:00.000Z`)
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

/**
 * A bar is final only once its session has closed. Vendors return the in-progress bar for the
 * current day, which must never become a reference or resolution price. Weekend bars for
 * weekday venues (Yahoo emits Sunday FX bars) are dropped too.
 */
export const isFinalBar = (day: IsoDate, venue: VenueId, now: Date): boolean => {
  const wd = new Date(`${day}T00:00:00.000Z`).getUTCDay()
  if (!VENUES[venue].tradesWeekends && (wd === 0 || wd === 6)) return false
  const today = now.toISOString().slice(0, 10)
  if (day > today) return false
  if (day < today) return true
  // Same UTC day: crypto's daily bar closes at 00:00 UTC next day; equities and FX by 22:00 UTC.
  return venue === 'CRYPTO' ? false : now.getUTCHours() >= 22
}

export interface IngestStepResult {
  attempted: number
  succeeded: number
  failed: number
  bars: number
}

/**
 * One incremental ingestion step. Picks the stalest active assets, fetches a trailing window
 * from the venue's preferred source, upserts bars, records trading days, and updates each
 * asset's ingest state. Re-fetching a trailing window every day keeps each asset's recent
 * series single-source, so adjusted closes are internally consistent (methodology §3).
 *
 * Runs until `maxAssets` are done or the time budget is spent. Idempotent.
 */
export const ingestStep = async (
  ctx: JobContext,
  opts: { asOf: IsoDate; maxAssets?: number; windowDays?: number; backfillDays?: number },
): Promise<IngestStepResult> => {
  const deadline = new Deadline(ctx.timeBudgetMs, ctx.now)
  const maxAssets = opts.maxAssets ?? 40
  const staleBefore = new Date(ctx.now().getTime() - 6 * 3600_000)

  const candidates = await ctx.db
    .select({
      id: assets.id,
      symbol: assets.symbol,
      vendorSymbol: assets.vendorSymbol,
      venue: assets.venue,
      assetClass: assets.assetClass,
      lastPriceDay: assets.lastPriceDay,
      lastIngestAt: assets.lastIngestAt,
    })
    .from(assets)
    .where(and(isNull(assets.activeTo), or(isNull(assets.lastIngestAt), sql`${assets.lastIngestAt} < ${staleBefore.toISOString()}`)))
    .orderBy(sql`${assets.lastIngestAt} asc nulls first`)
    .limit(maxAssets)

  if (candidates.length === 0) return { attempted: 0, succeeded: 0, failed: 0, bars: 0 }

  // Assets with no history get a deep backfill from the fast sources; others a trailing window.
  const groups = new Map<'daily' | 'backfill', PriceSourceAsset[]>()
  for (const c of candidates) {
    const mode = c.lastPriceDay ? 'daily' : 'backfill'
    const list = groups.get(mode) ?? []
    list.push({ assetId: c.id, symbol: c.symbol, vendorSymbol: c.vendorSymbol, venue: c.venue, assetClass: c.assetClass })
    groups.set(mode, list)
  }

  let succeeded = 0
  let failed = 0
  let bars = 0
  for (const [mode, list] of groups) {
    if (deadline.expired) break
    const from = mode === 'daily' ? addDays(opts.asOf, -(opts.windowDays ?? 45)) : addDays(opts.asOf, -(opts.backfillDays ?? 900))
    const { ok, failed: bad } = await fetchUniverse(list, from, opts.asOf, ctx.prices, mode)
    for (const r of ok) {
      const venue = list.find((a) => a.assetId === r.assetId)?.venue ?? 'US'
      const finalBars = r.bars.filter((b) => isFinalBar(b.day, venue, ctx.now()))
      const rows = finalBars.map((b) => ({ assetId: r.assetId, day: b.day, close: b.close, adjClose: b.adjClose, volume: b.volume, source: r.source }))
      for (let i = 0; i < rows.length; i += 500) {
        await ctx.db
          .insert(prices)
          .values(rows.slice(i, i + 500))
          .onConflictDoUpdate({
            target: [prices.assetId, prices.day],
            set: { close: sql`excluded.close`, adjClose: sql`excluded.adj_close`, volume: sql`excluded.volume`, source: sql`excluded.source`, ingestedAt: sql`now()` },
          })
      }
      await recordTradingDays(ctx, venue, finalBars.map((b) => b.day))
      const last = finalBars.reduce((m, b) => (b.day > m ? b.day : m), '')
      await ctx.db
        .update(assets)
        .set({ lastPriceDay: last || null, lastIngestAt: ctx.now(), lastIngestError: null })
        .where(eq(assets.id, r.assetId))
      succeeded++
      bars += rows.length
    }
    for (const f of bad) {
      await ctx.db.update(assets).set({ lastIngestAt: ctx.now(), lastIngestError: f.errors.join(' | ').slice(0, 500) }).where(eq(assets.id, f.assetId))
      failed++
      ctx.log.warn('ingest failed', { assetId: f.assetId, vendorSymbol: f.vendorSymbol, errors: f.errors })
    }
  }
  return { attempted: candidates.length, succeeded, failed, bars }
}

/** Adjusted close series for a set of assets over [from, to]. One indexed range query. */
export const loadPriceSeries = async (
  ctx: JobContext,
  assetIds: readonly string[],
  from: IsoDate,
  to: IsoDate,
): Promise<Map<string, Map<IsoDate, number>>> => {
  const out = new Map<string, Map<IsoDate, number>>()
  if (assetIds.length === 0) return out
  const rows = await ctx.db
    .select({ assetId: prices.assetId, day: prices.day, adjClose: prices.adjClose })
    .from(prices)
    .where(and(sql`${prices.assetId} in ${assetIds}`, sql`${prices.day} >= ${from}`, sql`${prices.day} <= ${to}`))
  for (const r of rows) {
    let m = out.get(r.assetId)
    if (!m) out.set(r.assetId, (m = new Map()))
    m.set(r.day, r.adjClose)
  }
  return out
}
