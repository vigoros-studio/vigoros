import type { IsoDate } from '@vigoros/domain'

/** Adjusted close series for one asset, keyed by day. Sparse maps keep memory O(observations). */
export type PriceSeries = ReadonlyMap<IsoDate, number>

/** Log returns over consecutive supplied days. Missing days are skipped, not interpolated. */
export const dailyLogReturns = (series: PriceSeries, days: readonly IsoDate[]): number[] => {
  const out: number[] = []
  let prev: number | undefined
  for (const d of days) {
    const p = series.get(d)
    if (p === undefined || p <= 0) continue
    if (prev !== undefined) out.push(Math.log(p / prev))
    prev = p
  }
  return out
}

/** Sample standard deviation of daily log returns. Returns null with fewer than 5 observations. */
export const realisedVol = (returns: readonly number[]): number | null => {
  const n = returns.length
  if (n < 5) return null
  const mean = returns.reduce((a, b) => a + b, 0) / n
  const v = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (n - 1)
  return Math.sqrt(v)
}

/** Simple total return between two days. Null if either price is missing. */
export const totalReturn = (series: PriceSeries, from: IsoDate, to: IsoDate): number | null => {
  const a = series.get(from)
  const b = series.get(to)
  if (a === undefined || b === undefined || a <= 0) return null
  return b / a - 1
}

export const median = (xs: readonly number[]): number | null => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >>> 1
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2
}
