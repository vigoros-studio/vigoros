import type { AssetClass, IsoDate, VenueId } from '@vigoros/domain'

/** One end-of-day observation. adjClose is dividend and split adjusted; equals close where n/a. */
export interface PriceBar {
  day: IsoDate
  close: number
  adjClose: number
  volume: number | null
}

export interface PriceSourceAsset {
  assetId: string
  vendorSymbol: string
  venue: VenueId
  assetClass: AssetClass
}

/**
 * A price source fetches bars for one asset over a date range. Sources are adapters; the
 * ingestion job chooses one per venue from configuration and falls back on failure.
 */
export interface PriceSource {
  readonly id: string
  supports(asset: PriceSourceAsset): boolean
  fetchBars(asset: PriceSourceAsset, from: IsoDate, to: IsoDate): Promise<PriceBar[]>
}

export class PriceSourceError extends Error {
  constructor(
    readonly source: string,
    readonly vendorSymbol: string,
    readonly status: number | null,
    message: string,
  ) {
    super(`[${source}] ${vendorSymbol}: ${message}`)
    this.name = 'PriceSourceError'
  }
}
