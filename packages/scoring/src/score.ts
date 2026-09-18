import { clipProbability } from '@vigoros/domain'

export type Outcome = 0 | 1

/** Brier score, (p − y)². Lower is better. Bounded [0, 1]. */
export const brier = (p: number, y: Outcome): number => (p - y) ** 2

/** Logarithmic score, −ln P(y). Lower is better. Finite because p is clipped. */
export const logScore = (p: number, y: Outcome): number => {
  const c = clipProbability(p)
  return -Math.log(y === 1 ? c : 1 - c)
}

export interface ScoredCommitment {
  /** Brier of the forecast. */
  brier: number
  /** Brier of the prior on the same question. */
  priorBrier: number
  /** Log score of the forecast. */
  log: number
  /** Log score of the prior. */
  priorLog: number
  /** Brier skill on this question: priorBrier − brier. Positive beats the prior. */
  brierSkill: number
  /** Log skill: priorLog − log. The log-likelihood ratio in nats. */
  logSkill: number
}

/** Score one commitment against its question's prior and outcome. */
export const scoreCommitment = (p: number, q: number, y: Outcome): ScoredCommitment => {
  const b = brier(clipProbability(p), y)
  const pb = brier(q, y)
  const l = logScore(p, y)
  const pl = logScore(q, y)
  return { brier: b, priorBrier: pb, log: l, priorLog: pl, brierSkill: pb - b, logSkill: pl - l }
}
