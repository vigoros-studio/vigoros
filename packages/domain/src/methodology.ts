/** The methodology version stamped on every derived score. See docs/methodology.md. */
export const METHODOLOGY_VERSION = '1.0.0' as const

/** Probabilities are clipped to this range so the log score is finite. */
export const P_MIN = 0.01
export const P_MAX = 0.99

/** No score is displayed below these thresholds. */
export const MIN_RESOLVED_COMMITMENTS = 100
export const MIN_DISTINCT_ISSUE_DATES = 20

/** Horizons in trading days. */
export const HORIZONS = [5, 10, 21] as const
export type Horizon = (typeof HORIZONS)[number]

/** Longest horizon; also the bootstrap block length. */
export const MAX_HORIZON: Horizon = 21

/** Realised-volatility lookback for level thresholds, in trading days. */
export const VOL_LOOKBACK_DAYS = 21

/** Lookback for empirical base rates, in trading days. */
export const PRIOR_LOOKBACK_DAYS = 504

export const clipProbability = (p: number): number => Math.min(P_MAX, Math.max(P_MIN, p))
