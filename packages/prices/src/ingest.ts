import type { IsoDate, VenueId } from '@vigoros/domain'
import { mapConcurrent } from './rate-limit'
import type { PriceBar, PriceSource, PriceSourceAsset } from './types'

export interface IngestResult {
  assetId: string
  source: string
  bars: PriceBar[]
}

export interface IngestFailure {
  assetId: string
  vendorSymbol: string
  errors: string[]
}

export interface IngestPlan {
  /** Ordered preference per venue. First source that supports the asset and succeeds wins. */
  sourcesByVenue: Record<VenueId, PriceSource[]>
  concurrency?: number
}

/**
 * Fetch bars for many assets with per-venue source preference and fallback.
 * Pure orchestration: the caller persists. Idempotent by construction because the
 * caller upserts on (asset_id, day).
 */
export const fetchUniverse = async (
  assets: readonly PriceSourceAsset[],
  from: IsoDate,
  to: IsoDate,
  plan: IngestPlan,
): Promise<{ ok: IngestResult[]; failed: IngestFailure[] }> => {
  const settled = await mapConcurrent(assets, plan.concurrency ?? 4, async (asset) => {
    const errors: string[] = []
    for (const source of plan.sourcesByVenue[asset.venue]) {
      if (!source.supports(asset)) continue
      try {
        const bars = await source.fetchBars(asset, from, to)
        if (bars.length > 0) return { assetId: asset.assetId, source: source.id, bars } satisfies IngestResult
        errors.push(`${source.id}: no bars`)
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e))
      }
    }
    throw { assetId: asset.assetId, vendorSymbol: asset.vendorSymbol, errors } satisfies IngestFailure
  })
  const ok: IngestResult[] = []
  const failed: IngestFailure[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') ok.push(r.value)
    else failed.push(r.reason as IngestFailure)
  }
  return { ok, failed }
}
