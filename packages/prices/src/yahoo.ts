import { z } from 'zod'
import type { IsoDate } from '@vigoros/domain'
import { TokenBucket } from './rate-limit'
import { PriceSourceError, type PriceBar, type PriceSource, type PriceSourceAsset } from './types'

const Chart = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({ currency: z.string().nullable().optional(), exchangeName: z.string().nullable().optional() }),
          timestamp: z.array(z.number()).optional(),
          indicators: z.object({
            quote: z.array(z.object({ close: z.array(z.number().nullable()), volume: z.array(z.number().nullable()).optional() })),
            adjclose: z.array(z.object({ adjclose: z.array(z.number().nullable()) })).optional(),
          }),
        }),
      )
      .nullable(),
    error: z.object({ code: z.string(), description: z.string() }).nullable(),
  }),
})

/**
 * Yahoo Finance chart endpoint. Unofficial but stable for a decade, wide LSE/FX/crypto coverage,
 * dividend-and-split-adjusted closes. Used for UK equities (no free vendor covers the LSE) and as
 * the deep-backfill and fallback source elsewhere. Symbols: "SHEL.L", "BT-A.L", "EURUSD=X", "BTC-USD".
 */
export class YahooSource implements PriceSource {
  readonly id = 'yahoo'
  private readonly bucket: TokenBucket
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    requestsPerHour = 900,
  ) {
    this.bucket = TokenBucket.perHour(requestsPerHour)
  }

  supports(): boolean {
    return true
  }

  static symbolFor(asset: PriceSourceAsset & { symbol?: string }): string {
    const base = (asset.symbol ?? asset.vendorSymbol).toUpperCase().replace('.', '-')
    switch (asset.venue) {
      case 'UK':
        return `${base}.L`
      case 'FX':
        return `${base}=X`
      case 'CRYPTO':
        return `${base.replace(/USD$/, '')}-USD`
      default:
        return base
    }
  }

  async fetchBars(asset: PriceSourceAsset & { symbol?: string }, from: IsoDate, to: IsoDate): Promise<PriceBar[]> {
    await this.bucket.take()
    const symbol = YahooSource.symbolFor(asset)
    const p1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000)
    const p2 = Math.floor(Date.parse(`${to}T00:00:00Z`) / 1000) + 86_400
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${p1}&period2=${p2}&interval=1d&events=div%2Csplit`
    const res = await this.fetchImpl(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Vigoros/1.0)', Accept: 'application/json' } })
    if (!res.ok) throw new PriceSourceError(this.id, symbol, res.status, (await res.text()).slice(0, 120))
    const parsed = Chart.safeParse(await res.json())
    if (!parsed.success) throw new PriceSourceError(this.id, symbol, null, 'unexpected payload shape')
    const { result, error } = parsed.data.chart
    if (error) throw new PriceSourceError(this.id, symbol, null, `${error.code}: ${error.description}`)
    const r = result?.[0]
    if (!r?.timestamp) return []
    const closes = r.indicators.quote[0]?.close ?? []
    const adj = r.indicators.adjclose?.[0]?.adjclose ?? closes
    const volumes = r.indicators.quote[0]?.volume ?? []
    const bars: PriceBar[] = []
    const seen = new Set<string>()
    r.timestamp.forEach((t, i) => {
      const close = closes[i]
      const adjClose = adj[i] ?? close
      if (close === null || close === undefined || adjClose === null || adjClose === undefined) return
      const day = new Date(t * 1000).toISOString().slice(0, 10)
      if (day < from || day > to || seen.has(day)) return
      seen.add(day)
      bars.push({ day, close, adjClose, volume: volumes[i] ?? null })
    })
    return bars
  }
}
