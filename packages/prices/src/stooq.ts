import type { IsoDate } from '@vigoros/domain'
import { TokenBucket } from './rate-limit.js'
import { PriceSourceError, type PriceBar, type PriceSource, type PriceSourceAsset } from './types.js'

/**
 * Stooq CSV adapter. No key, wide LSE coverage, unadjusted closes only. Used as the fallback for
 * UK equities where Tiingo coverage is thin. Symbol convention: "shel.uk", "aapl.us", "eurusd".
 */
export class StooqSource implements PriceSource {
  readonly id = 'stooq'
  private readonly bucket = TokenBucket.perHour(200)
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  supports(asset: PriceSourceAsset): boolean {
    return asset.assetClass !== 'CRYPTO'
  }

  static symbolFor(asset: PriceSourceAsset): string {
    const s = asset.vendorSymbol.toLowerCase()
    if (asset.venue === 'UK') return `${s}.uk`
    if (asset.venue === 'US') return `${s}.us`
    return s
  }

  async fetchBars(asset: PriceSourceAsset, from: IsoDate, to: IsoDate): Promise<PriceBar[]> {
    await this.bucket.take()
    const d1 = from.replaceAll('-', '')
    const d2 = to.replaceAll('-', '')
    const url = `https://stooq.com/q/d/l/?s=${StooqSource.symbolFor(asset)}&d1=${d1}&d2=${d2}&i=d`
    const res = await this.fetchImpl(url)
    if (!res.ok) throw new PriceSourceError(this.id, asset.vendorSymbol, res.status, 'http error')
    const text = await res.text()
    const lines = text.trim().split('\n')
    const header = lines.shift()
    if (!header?.startsWith('Date,Open,High,Low,Close')) {
      throw new PriceSourceError(this.id, asset.vendorSymbol, null, `unexpected payload: ${text.slice(0, 80)}`)
    }
    const bars: PriceBar[] = []
    for (const line of lines) {
      const [day, , , , close, volume] = line.split(',')
      const c = Number(close)
      if (!day || !Number.isFinite(c)) continue
      bars.push({ day, close: c, adjClose: c, volume: volume ? Number(volume) : null })
    }
    return bars
  }
}
