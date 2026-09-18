import { z } from 'zod'
import type { IsoDate } from '@vigoros/domain'
import { TokenBucket } from './rate-limit.js'
import { PriceSourceError, type PriceBar, type PriceSource, type PriceSourceAsset } from './types.js'

const EodRow = z.object({
  date: z.string(),
  close: z.number(),
  adjClose: z.number(),
  volume: z.number().nullable().optional(),
})
const FxRow = z.object({ date: z.string(), close: z.number() })
const CryptoRow = z.object({
  ticker: z.string(),
  priceData: z.array(z.object({ date: z.string(), close: z.number(), volume: z.number().nullable().optional() })),
})

export interface TiingoOptions {
  apiKey: string
  /** Free tier: 50/hour. */
  requestsPerHour?: number
  baseUrl?: string
  fetchImpl?: typeof fetch
}

/**
 * Tiingo adapter. Equities/ETFs via /tiingo/daily, FX via /tiingo/fx, crypto via /tiingo/crypto.
 * All three normalise to PriceBar. FX and crypto have no corporate actions so adjClose = close.
 */
export class TiingoSource implements PriceSource {
  readonly id = 'tiingo'
  private readonly bucket: TokenBucket
  private readonly base: string
  private readonly fetchImpl: typeof fetch

  constructor(private readonly opts: TiingoOptions) {
    this.bucket = TokenBucket.perHour(opts.requestsPerHour ?? 50)
    this.base = opts.baseUrl ?? 'https://api.tiingo.com'
    this.fetchImpl = opts.fetchImpl ?? fetch
  }

  supports(): boolean {
    return true
  }

  async fetchBars(asset: PriceSourceAsset, from: IsoDate, to: IsoDate): Promise<PriceBar[]> {
    switch (asset.assetClass) {
      case 'EQUITY':
      case 'ETF':
        return this.eod(asset, from, to)
      case 'FX':
        return this.fx(asset, from, to)
      case 'CRYPTO':
        return this.crypto(asset, from, to)
    }
  }

  private async get(path: string, params: Record<string, string>, vendorSymbol: string): Promise<unknown> {
    await this.bucket.take()
    const url = new URL(path, this.base)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    url.searchParams.set('token', this.opts.apiKey)
    const res = await this.fetchImpl(url, { headers: { 'Content-Type': 'application/json' } })
    if (!res.ok) {
      throw new PriceSourceError(this.id, vendorSymbol, res.status, (await res.text()).slice(0, 200))
    }
    return res.json()
  }

  private async eod(asset: PriceSourceAsset, from: IsoDate, to: IsoDate): Promise<PriceBar[]> {
    const raw = await this.get(
      `/tiingo/daily/${encodeURIComponent(asset.vendorSymbol)}/prices`,
      { startDate: from, endDate: to, format: 'json' },
      asset.vendorSymbol,
    )
    return z
      .array(EodRow)
      .parse(raw)
      .map((r) => ({ day: r.date.slice(0, 10), close: r.close, adjClose: r.adjClose, volume: r.volume ?? null }))
  }

  private async fx(asset: PriceSourceAsset, from: IsoDate, to: IsoDate): Promise<PriceBar[]> {
    const raw = await this.get(
      `/tiingo/fx/${encodeURIComponent(asset.vendorSymbol)}/prices`,
      { startDate: from, endDate: to, resampleFreq: '1day', format: 'json' },
      asset.vendorSymbol,
    )
    return z
      .array(FxRow)
      .parse(raw)
      .map((r) => ({ day: r.date.slice(0, 10), close: r.close, adjClose: r.close, volume: null }))
  }

  private async crypto(asset: PriceSourceAsset, from: IsoDate, to: IsoDate): Promise<PriceBar[]> {
    const raw = await this.get(
      '/tiingo/crypto/prices',
      { tickers: asset.vendorSymbol, startDate: from, endDate: to, resampleFreq: '1day', format: 'json' },
      asset.vendorSymbol,
    )
    const series = z.array(CryptoRow).parse(raw)[0]
    if (!series) return []
    return series.priceData.map((r) => ({
      day: r.date.slice(0, 10),
      close: r.close,
      adjClose: r.close,
      volume: r.volume ?? null,
    }))
  }
}
