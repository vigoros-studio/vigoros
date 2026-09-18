import type { Outcome } from './score.js'

export const CALIBRATION_BINS = 10

export interface CalibrationBin {
  /** Bin index 0..9, covering [i/10, (i+1)/10). The last bin is closed at 1. */
  index: number
  count: number
  meanForecast: number
  observedFrequency: number
}

/** Additive per-bin statistics, so calibration can also be aggregated incrementally. */
export interface CalibrationAccumulator {
  counts: number[]
  sumForecast: number[]
  sumOutcome: number[]
}

export const emptyCalibration = (): CalibrationAccumulator => ({
  counts: new Array<number>(CALIBRATION_BINS).fill(0),
  sumForecast: new Array<number>(CALIBRATION_BINS).fill(0),
  sumOutcome: new Array<number>(CALIBRATION_BINS).fill(0),
})

export const binIndex = (p: number): number => Math.min(CALIBRATION_BINS - 1, Math.floor(p * CALIBRATION_BINS))

export const addCalibration = (acc: CalibrationAccumulator, p: number, y: Outcome): void => {
  const i = binIndex(p)
  acc.counts[i] = (acc.counts[i] ?? 0) + 1
  acc.sumForecast[i] = (acc.sumForecast[i] ?? 0) + p
  acc.sumOutcome[i] = (acc.sumOutcome[i] ?? 0) + y
}

export const mergeCalibration = (a: CalibrationAccumulator, b: CalibrationAccumulator): CalibrationAccumulator => ({
  counts: a.counts.map((v, i) => v + (b.counts[i] ?? 0)),
  sumForecast: a.sumForecast.map((v, i) => v + (b.sumForecast[i] ?? 0)),
  sumOutcome: a.sumOutcome.map((v, i) => v + (b.sumOutcome[i] ?? 0)),
})

export const calibrationBins = (acc: CalibrationAccumulator): CalibrationBin[] =>
  acc.counts.map((count, index) => ({
    index,
    count,
    meanForecast: count === 0 ? 0 : (acc.sumForecast[index] ?? 0) / count,
    observedFrequency: count === 0 ? 0 : (acc.sumOutcome[index] ?? 0) / count,
  }))

export interface CalibrationSummary {
  /** Expected Calibration Error: count-weighted mean |forecast − observed| across bins. */
  ece: number
  /** Murphy decomposition of mean Brier: reliability − resolution + uncertainty. */
  reliability: number
  resolution: number
  uncertainty: number
  bins: CalibrationBin[]
}

export const summariseCalibration = (acc: CalibrationAccumulator): CalibrationSummary | null => {
  const n = acc.counts.reduce((a, b) => a + b, 0)
  if (n === 0) return null
  const bins = calibrationBins(acc)
  const baseRate = acc.sumOutcome.reduce((a, b) => a + b, 0) / n
  let ece = 0
  let reliability = 0
  let resolution = 0
  for (const b of bins) {
    if (b.count === 0) continue
    const w = b.count / n
    ece += w * Math.abs(b.meanForecast - b.observedFrequency)
    reliability += w * (b.meanForecast - b.observedFrequency) ** 2
    resolution += w * (b.observedFrequency - baseRate) ** 2
  }
  return { ece, reliability, resolution, uncertainty: baseRate * (1 - baseRate), bins }
}
