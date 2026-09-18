import { describe, expect, it } from 'vitest'
import {
  addCalibration,
  addScore,
  adjustForIdentities,
  bootstrapBss,
  brier,
  emptyAccumulator,
  emptyCalibration,
  logScore,
  mergeAccumulators,
  mulberry32,
  pValueSkill,
  scoreCommitment,
  summarise,
  summariseCalibration,
  type DailyAccumulator,
} from './index.js'

describe('single-commitment scores', () => {
  it('brier is (p−y)²', () => {
    expect(brier(0.7, 1)).toBeCloseTo(0.09)
    expect(brier(0.7, 0)).toBeCloseTo(0.49)
  })
  it('log score is finite at the clip boundary', () => {
    expect(Number.isFinite(logScore(1, 0))).toBe(true)
    expect(logScore(0.5, 1)).toBeCloseTo(Math.log(2))
  })
  it('a forecast equal to the prior has zero skill', () => {
    const s = scoreCommitment(0.5, 0.5, 1)
    expect(s.brierSkill).toBe(0)
    expect(s.logSkill).toBe(0)
  })
  it('is proper: the truthful probability maximises expected skill', () => {
    const truth = 0.7
    const expectedBrier = (p: number) => truth * brier(p, 1) + (1 - truth) * brier(p, 0)
    const candidates = [0.5, 0.6, 0.7, 0.8, 0.9]
    const best = candidates.reduce((a, b) => (expectedBrier(a) <= expectedBrier(b) ? a : b))
    expect(best).toBe(truth)
  })
})

describe('record summary', () => {
  it('BSS is 0 when forecasts equal priors and 1 when perfect', () => {
    let acc = emptyAccumulator()
    for (let i = 0; i < 10; i++) acc = addScore(acc, scoreCommitment(0.5, 0.5, i % 2 === 0 ? 1 : 0))
    expect(summarise(acc)?.bss).toBeCloseTo(0)
    let perfect = emptyAccumulator()
    for (let i = 0; i < 10; i++) perfect = addScore(perfect, scoreCommitment(0.99, 0.5, 1))
    expect(summarise(perfect)?.bss).toBeCloseTo(1 - (0.01 ** 2 * 10) / (0.25 * 10))
  })
  it('accumulators merge associatively', () => {
    const a = addScore(emptyAccumulator(), scoreCommitment(0.8, 0.5, 1))
    const b = addScore(emptyAccumulator(), scoreCommitment(0.3, 0.5, 0))
    const c = addScore(emptyAccumulator(), scoreCommitment(0.6, 0.2, 0))
    const left = mergeAccumulators(mergeAccumulators(a, b), c)
    const right = mergeAccumulators(a, mergeAccumulators(b, c))
    expect(summarise(left)?.bss).toBeCloseTo(summarise(right)?.bss ?? NaN)
  })
  it('returns null for an empty record', () => {
    expect(summarise(emptyAccumulator())).toBeNull()
  })
})

describe('calibration', () => {
  it('a perfectly calibrated forecaster has near-zero ECE and reliability', () => {
    const rand = mulberry32(7)
    const acc = emptyCalibration()
    for (let i = 0; i < 20000; i++) {
      const p = 0.05 + Math.floor(rand() * 10) / 10
      addCalibration(acc, p, rand() < p ? 1 : 0)
    }
    const s = summariseCalibration(acc)!
    expect(s.ece).toBeLessThan(0.02)
    expect(s.reliability).toBeLessThan(0.001)
    expect(s.bins.every((b) => b.count > 0)).toBe(true)
  })
  it('an overconfident forecaster has high reliability term', () => {
    const rand = mulberry32(9)
    const acc = emptyCalibration()
    for (let i = 0; i < 5000; i++) addCalibration(acc, 0.95, rand() < 0.55 ? 1 : 0)
    expect(summariseCalibration(acc)!.ece).toBeGreaterThan(0.3)
  })
})

/**
 * skill: how much of the forecaster's deviation from 0.5 is real information (1 = all, 0 = none).
 * The forecaster always reports 0.5 + 0.8·(u − 0.5); the outcome is drawn from 0.5 + skill·0.8·(u − 0.5).
 */
const syntheticDays = (nDays: number, skill: number, seed: number): DailyAccumulator[] => {
  const rand = mulberry32(seed)
  const days: DailyAccumulator[] = []
  for (let d = 0; d < nDays; d++) {
    let acc = emptyAccumulator()
    for (let i = 0; i < 30; i++) {
      const deviation = 0.8 * (rand() - 0.5)
      const reported = 0.5 + deviation
      const truth = 0.5 + skill * deviation
      const y = rand() < truth ? 1 : 0
      acc = addScore(acc, scoreCommitment(reported, 0.5, y))
    }
    days.push({ issueDate: `2026-${String(1 + Math.floor(d / 28)).padStart(2, '0')}-${String(1 + (d % 28)).padStart(2, '0')}`, acc })
  }
  return days
}

describe('bootstrap interval and significance', () => {
  it('a skilled record has a positive lower bound and small p-value', () => {
    const days = syntheticDays(120, 1, 11)
    const ci = bootstrapBss(days, { resamples: 500 })!
    expect(ci.pointEstimate).toBeGreaterThan(0)
    expect(ci.lower).toBeGreaterThan(0)
    expect(ci.lower).toBeLessThan(ci.upper)
    expect(pValueSkill(days, 500)!).toBeLessThan(0.05)
  })
  it('a no-skill record is not credited with skill', () => {
    const days = syntheticDays(120, 0, 13)
    const ci = bootstrapBss(days, { resamples: 500 })!
    expect(ci.pointEstimate).toBeLessThan(0)
    expect(ci.lower).toBeLessThan(ci.pointEstimate)
    expect(ci.upper).toBeGreaterThan(ci.pointEstimate)
    expect(pValueSkill(days, 500)!).toBeGreaterThan(0.5)
  })
  it('half-information forecaster: positive but smaller skill than full information', () => {
    const full = bootstrapBss(syntheticDays(120, 1, 21), { resamples: 300 })!
    const half = bootstrapBss(syntheticDays(120, 0.5, 21), { resamples: 300 })!
    expect(half.pointEstimate).toBeLessThan(full.pointEstimate)
  })
  it('is deterministic for a given seed', () => {
    const days = syntheticDays(60, 0.5, 17)
    expect(bootstrapBss(days, { resamples: 200, seed: 1 })).toEqual(bootstrapBss(days, { resamples: 200, seed: 1 }))
  })
  it('identity adjustment multiplies and caps', () => {
    expect(adjustForIdentities(0.01, 50)).toBeCloseTo(0.5)
    expect(adjustForIdentities(0.1, 50)).toBe(1)
    expect(adjustForIdentities(0.2, 0)).toBe(0.2)
  })
})
