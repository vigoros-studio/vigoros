import { HORIZONS, VOL_LOOKBACK_DAYS, type AssetClass, type Horizon, type IsoDate, type LevelK } from '@vigoros/domain'
import type { TradingCalendar } from './calendar.js'
import { dailyLogReturns, realisedVol, type PriceSeries } from './returns.js'

/** { assetClass: { horizon: { "-1": q, "0": q, "1": q } } } plus fixed RELATIVE/QUINTILE priors. */
export interface PriorTable {
  level: Partial<Record<AssetClass, Record<Horizon, Record<'-1' | '0' | '1', number>>>>
  relative: number
  quintile: number
  /** Observations behind each level cell, for the published table. */
  support: Partial<Record<AssetClass, Record<Horizon, number>>>
}

export const RELATIVE_PRIOR = 0.5
export const QUINTILE_PRIOR = 0.2

/** Clamp so a prior is never 0 or 1, which would make log skill undefined. */
const clampPrior = (q: number) => Math.min(0.98, Math.max(0.02, q))

interface AssetHistory {
  assetClass: AssetClass
  calendar: TradingCalendar
  series: PriceSeries
}

/**
 * Empirical base rates, pooled per asset class over a trailing window ending at asOf:
 * P( r_h / (σ_21 · √h) > k ) for k ∈ {-1, 0, 1}. σ_21 is measured at the start of each window,
 * exactly as the live threshold is, so the prior answers the same question the participant does.
 *
 * Cost is O(assets × window). This runs once per month, not per day (methodology §5).
 */
export const computePriorTable = (assets: readonly AssetHistory[], asOf: IsoDate, windowDays: number): PriorTable => {
  const hits: Partial<Record<AssetClass, Record<Horizon, [number, number, number]>>> = {}
  const support: PriorTable['support'] = {}

  for (const a of assets) {
    if (!a.calendar.isTradingDay(asOf)) continue
    const window = a.calendar.lastN(asOf, windowDays + VOL_LOOKBACK_DAYS + 21)
    for (const h of HORIZONS) {
      for (let i = VOL_LOOKBACK_DAYS; i + h < window.length; i++) {
        const start = window[i] as IsoDate
        const end = window[i + h] as IsoDate
        const p0 = a.series.get(start)
        const p1 = a.series.get(end)
        if (p0 === undefined || p1 === undefined) continue
        const sigma = realisedVol(dailyLogReturns(a.series, window.slice(i - VOL_LOOKBACK_DAYS, i + 1)))
        if (!sigma) continue
        const z = Math.log(p1 / p0) / (sigma * Math.sqrt(h))
        const cell = ((hits[a.assetClass] ??= {} as Record<Horizon, [number, number, number]>)[h] ??= [0, 0, 0])
        if (z > -1) cell[0]++
        if (z > 0) cell[1]++
        if (z > 1) cell[2]++
        const s = (support[a.assetClass] ??= {} as Record<Horizon, number>)
        s[h] = (s[h] ?? 0) + 1
      }
    }
  }

  const level: PriorTable['level'] = {}
  for (const [cls, byH] of Object.entries(hits) as [AssetClass, Record<Horizon, [number, number, number]>][]) {
    level[cls] = {} as Record<Horizon, Record<'-1' | '0' | '1', number>>
    for (const h of HORIZONS) {
      const n = support[cls]?.[h] ?? 0
      const c = byH[h] ?? [0, 0, 0]
      level[cls]![h] = {
        '-1': clampPrior(n ? c[0] / n : 0.84),
        '0': clampPrior(n ? c[1] / n : 0.5),
        '1': clampPrior(n ? c[2] / n : 0.16),
      }
    }
  }
  return { level, relative: RELATIVE_PRIOR, quintile: QUINTILE_PRIOR, support }
}

export const levelPrior = (table: PriorTable, cls: AssetClass, h: Horizon, k: LevelK): number =>
  table.level[cls]?.[h]?.[String(k) as '-1' | '0' | '1'] ?? (k === 0 ? 0.5 : k > 0 ? 0.16 : 0.84)
