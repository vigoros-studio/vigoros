import { emptyAccumulator, mergeAccumulators, summarise } from './accumulate.js'
import { mulberry32, type DailyAccumulator } from './bootstrap.js'
import { MAX_HORIZON } from '@vigoros/domain'

/**
 * One-sided bootstrap p-value for H0: BSS ≤ 0, using the same moving-block scheme.
 * The fraction of resamples with BSS ≤ 0 is the p-value.
 */
export const pValueSkill = (days: DailyAccumulator[], resamples = 2000, seed = 0x5eed): number | null => {
  const sorted = [...days].sort((a, b) => (a.issueDate < b.issueDate ? -1 : 1))
  if (sorted.length === 0) return null
  const rand = mulberry32(seed)
  const nDays = sorted.length
  const L = Math.min(MAX_HORIZON, nDays)
  const blocksNeeded = Math.ceil(nDays / L)
  let atOrBelowZero = 0
  for (let r = 0; r < resamples; r++) {
    let acc = emptyAccumulator()
    for (let b = 0; b < blocksNeeded; b++) {
      const start = Math.floor(rand() * (nDays - L + 1))
      for (let i = 0; i < L; i++) {
        const day = sorted[start + i]
        if (day) acc = mergeAccumulators(acc, day.acc)
      }
    }
    if ((summarise(acc)?.bss ?? 0) <= 0) atOrBelowZero++
  }
  // Add-one smoothing so a p-value is never exactly zero.
  return (atOrBelowZero + 1) / (resamples + 1)
}

/**
 * Bonferroni adjustment for a publisher running several identities in the same period.
 * The displayed p-value is min(1, p × identities). Methodology §8.
 */
export const adjustForIdentities = (p: number, identityCount: number): number =>
  Math.min(1, p * Math.max(1, identityCount))
