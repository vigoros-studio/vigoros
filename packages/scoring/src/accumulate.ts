import type { ScoredCommitment } from './score.js'

/**
 * Additive sufficient statistics for a record. Every aggregate Vigoros displays is derived from
 * these sums, so daily partial aggregates can be stored once and summed on read. Nothing ever
 * scans a participant's full history to render a page.
 */
export interface ScoreAccumulator {
  n: number
  sumBrier: number
  sumPriorBrier: number
  sumLog: number
  sumPriorLog: number
}

export const emptyAccumulator = (): ScoreAccumulator => ({
  n: 0,
  sumBrier: 0,
  sumPriorBrier: 0,
  sumLog: 0,
  sumPriorLog: 0,
})

export const addScore = (acc: ScoreAccumulator, s: ScoredCommitment): ScoreAccumulator => ({
  n: acc.n + 1,
  sumBrier: acc.sumBrier + s.brier,
  sumPriorBrier: acc.sumPriorBrier + s.priorBrier,
  sumLog: acc.sumLog + s.log,
  sumPriorLog: acc.sumPriorLog + s.priorLog,
})

export const mergeAccumulators = (a: ScoreAccumulator, b: ScoreAccumulator): ScoreAccumulator => ({
  n: a.n + b.n,
  sumBrier: a.sumBrier + b.sumBrier,
  sumPriorBrier: a.sumPriorBrier + b.sumPriorBrier,
  sumLog: a.sumLog + b.sumLog,
  sumPriorLog: a.sumPriorLog + b.sumPriorLog,
})

export const sumAccumulators = (accs: Iterable<ScoreAccumulator>): ScoreAccumulator => {
  let out = emptyAccumulator()
  for (const a of accs) out = mergeAccumulators(out, a)
  return out
}

export interface RecordSummary {
  n: number
  /** Brier Skill Score: 1 − ΣBS(p)/ΣBS(q). 0 = matches prior. */
  bss: number
  /** Mean Brier of the forecasts. */
  meanBrier: number
  /** Mean Brier of the prior on the same questions. */
  meanPriorBrier: number
  /** Total evidence in nats: Σ(LS(q) − LS(p)). */
  evidenceNats: number
  /** Mean log skill per question. */
  meanLogSkill: number
}

export const summarise = (acc: ScoreAccumulator): RecordSummary | null => {
  if (acc.n === 0) return null
  const bss = acc.sumPriorBrier === 0 ? 0 : 1 - acc.sumBrier / acc.sumPriorBrier
  return {
    n: acc.n,
    bss,
    meanBrier: acc.sumBrier / acc.n,
    meanPriorBrier: acc.sumPriorBrier / acc.n,
    evidenceNats: acc.sumPriorLog - acc.sumLog,
    meanLogSkill: (acc.sumPriorLog - acc.sumLog) / acc.n,
  }
}
