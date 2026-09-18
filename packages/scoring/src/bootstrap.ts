import { MAX_HORIZON } from '@vigoros/domain'
import { emptyAccumulator, mergeAccumulators, summarise, type ScoreAccumulator } from './accumulate'

/** Deterministic PRNG so every interval is reproducible from a published seed. */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface DailyAccumulator {
  /** Issue date, ISO. Blocks are formed over the sorted sequence of these. */
  issueDate: string
  acc: ScoreAccumulator
}

export interface BootstrapInterval {
  level: number
  lower: number
  upper: number
  pointEstimate: number
  resamples: number
  blockLength: number
}

export interface BootstrapOptions {
  resamples?: number
  blockLength?: number
  level?: number
  seed?: number
}

/**
 * Moving-block bootstrap of the Brier Skill Score over issue dates.
 * Each resample draws contiguous blocks of daily accumulators so that within-block dependence
 * (shared shocks across a day, overlapping horizons) is preserved. Operates on the additive
 * daily sums, so a record of any length costs O(days × resamples), never O(commitments).
 */
export const bootstrapBss = (days: DailyAccumulator[], opts: BootstrapOptions = {}): BootstrapInterval | null => {
  const resamples = opts.resamples ?? 2000
  const blockLength = opts.blockLength ?? MAX_HORIZON
  const level = opts.level ?? 0.9
  const rand = mulberry32(opts.seed ?? 0x5eed)

  const sorted = [...days].sort((a, b) => (a.issueDate < b.issueDate ? -1 : 1))
  const full = summarise(sorted.reduce((acc, d) => mergeAccumulators(acc, d.acc), emptyAccumulator()))
  if (!full) return null
  const nDays = sorted.length
  const L = Math.min(blockLength, nDays)
  const blocksNeeded = Math.ceil(nDays / L)
  const stats = new Float64Array(resamples)

  for (let r = 0; r < resamples; r++) {
    let acc = emptyAccumulator()
    for (let b = 0; b < blocksNeeded; b++) {
      const start = Math.floor(rand() * (nDays - L + 1))
      for (let i = 0; i < L; i++) {
        const day = sorted[start + i]
        if (day) acc = mergeAccumulators(acc, day.acc)
      }
    }
    stats[r] = summarise(acc)?.bss ?? 0
  }
  stats.sort()
  const alpha = (1 - level) / 2
  const at = (q: number) => stats[Math.min(resamples - 1, Math.max(0, Math.floor(q * resamples)))] ?? 0
  return { level, lower: at(alpha), upper: at(1 - alpha), pointEstimate: full.bss, resamples, blockLength: L }
}
