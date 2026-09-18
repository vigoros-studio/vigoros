import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@vigoros/scoring'
import type { VenueId } from '@vigoros/domain'
import { TradingCalendar } from './calendar.js'
import { computePriorTable } from './priors.js'
import { generateQuestions, type UniverseAsset } from './generate.js'
import { resolveQuestions } from './resolve.js'
import { median, realisedVol } from './returns.js'
import universe from '../data/universe-v1.json'

// Weekday calendar for 2024-01-01 .. 2026-12-31, no holidays. Enough for the maths to be exercised.
const weekdays: string[] = []
for (let d = new Date('2024-01-01T00:00:00Z'); d < new Date('2027-01-01T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  const wd = d.getUTCDay()
  if (wd !== 0 && wd !== 6) weekdays.push(d.toISOString().slice(0, 10))
}
const everyday: string[] = []
for (let d = new Date('2024-01-01T00:00:00Z'); d < new Date('2027-01-01T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  everyday.push(d.toISOString().slice(0, 10))
}
const calendars: Record<VenueId, TradingCalendar> = {
  US: new TradingCalendar('US', weekdays),
  UK: new TradingCalendar('UK', weekdays),
  FX: new TradingCalendar('FX', weekdays),
  CRYPTO: new TradingCalendar('CRYPTO', everyday),
}

/** Geometric random walk with a per-asset drift, so peer comparisons have real dispersion. */
const walk = (seed: number, days: readonly string[], drift = 0): Map<string, number> => {
  const rand = mulberry32(seed)
  const m = new Map<string, number>()
  let p = 100
  for (const d of days) {
    const u1 = Math.max(rand(), 1e-9)
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rand())
    p *= Math.exp(drift + 0.015 * z)
    m.set(d, p)
  }
  return m
}

const assets: UniverseAsset[] = Array.from({ length: 30 }, (_, i) => ({
  id: `A${String(i).padStart(2, '0')}`,
  symbol: `S${i}`,
  venue: 'US',
  assetClass: 'EQUITY',
  peerGroup: i < 15 ? 'Tech' : 'Energy',
}))
const prices = new Map(assets.map((a, i) => [a.id, walk(100 + i, weekdays, (i - 15) * 0.0005)]))

describe('TradingCalendar', () => {
  const cal = calendars.US
  it('skips weekends when advancing and stepping back', () => {
    expect(cal.isTradingDay('2026-09-19')).toBe(false) // Saturday
    expect(cal.previous('2026-09-21')).toBe('2026-09-18')
    expect(cal.advance('2026-09-18', 1)).toBe('2026-09-18')
    expect(cal.advance('2026-09-18', 2)).toBe('2026-09-21')
    expect(cal.advance('2026-09-18', 5)).toBe('2026-09-24')
  })
  it('lastN returns n days ending at d', () => {
    expect(cal.lastN('2026-09-18', 3)).toEqual(['2026-09-16', '2026-09-17', '2026-09-18'])
  })
})

describe('returns', () => {
  it('median handles even and odd', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(median([])).toBeNull()
  })
  it('realised vol needs at least 5 observations', () => {
    expect(realisedVol([0.01, 0.02])).toBeNull()
    expect(realisedVol([0.01, -0.01, 0.01, -0.01, 0.01, -0.01])).toBeCloseTo(0.01095, 4)
  })
})

describe('priors', () => {
  it('level priors are ordered and bounded', () => {
    const table = computePriorTable(
      assets.map((a) => ({ assetClass: a.assetClass, calendar: calendars.US, series: prices.get(a.id)! })),
      '2026-09-17',
      250,
    )
    const cell = table.level.EQUITY![10]
    expect(cell['-1']).toBeGreaterThan(cell['0'])
    expect(cell['0']).toBeGreaterThan(cell['1'])
    expect(cell['0']).toBeGreaterThan(0.3)
    expect(cell['0']).toBeLessThan(0.7)
    expect(table.support.EQUITY![10]).toBeGreaterThan(5000)
  })
})

describe('generateQuestions', () => {
  const priors = computePriorTable(
    assets.map((a) => ({ assetClass: a.assetClass, calendar: calendars.US, series: prices.get(a.id)! })),
    '2026-09-17',
    250,
  )
  const input = { issueDate: '2026-09-18', seed: 'v1-test', assets, calendars, prices, priors }

  it('issues three questions per asset, deterministic given the seed', () => {
    const a = generateQuestions(input)
    const b = generateQuestions(input)
    expect(a.questions).toHaveLength(90)
    expect(a.skipped).toHaveLength(0)
    const strip = (qs: typeof a.questions) => qs.map(({ id, ...rest }) => rest)
    expect(strip(a.questions)).toEqual(strip(b.questions))
    expect(new Set(a.questions.map((q) => q.type)).size).toBe(3)
  })
  it('a different seed draws different horizons', () => {
    const a = generateQuestions(input)
    const b = generateQuestions({ ...input, seed: 'v1-other' })
    const sig = (qs: typeof a.questions) => qs.map((q) => `${q.type}${q.horizon}${q.levelK}`).join()
    expect(sig(a.questions)).not.toBe(sig(b.questions))
  })
  it('level thresholds sit on the right side of the reference price', () => {
    for (const q of generateQuestions(input).questions.filter((q) => q.type === 'LEVEL')) {
      if (q.levelK === 1) expect(q.threshold!).toBeGreaterThan(q.referencePrice)
      if (q.levelK === -1) expect(q.threshold!).toBeLessThan(q.referencePrice)
      if (q.levelK === 0) expect(q.threshold!).toBeCloseTo(q.referencePrice, 6)
      expect(q.deadlineAt).toBe('2026-09-18T13:00:00.000Z')
      expect(q.prior).toBeGreaterThan(0)
      expect(q.prior).toBeLessThan(1)
    }
  })
  it('skips assets whose venue is closed', () => {
    const out = generateQuestions({ ...input, issueDate: '2026-09-19' })
    expect(out.questions).toHaveLength(0)
    expect(out.skipped.every((s) => s.reason === 'venue closed')).toBe(true)
  })
})

describe('resolveQuestions', () => {
  const priors = computePriorTable(
    assets.map((a) => ({ assetClass: a.assetClass, calendar: calendars.US, series: prices.get(a.id)! })),
    '2026-09-17',
    250,
  )
  const { questions } = generateQuestions({ issueDate: '2026-09-18', seed: 'v1-test', assets, calendars, prices, priors })
  const assetMap = new Map(assets.map((a) => [a.id, a]))

  it('resolves every question with a consistent outcome', () => {
    const res = resolveQuestions({ questions, assets: assetMap, calendars, prices, universeAtIssue: assets })
    expect(res).toHaveLength(90)
    expect(res.every((r) => r.status === 'RESOLVED')).toBe(true)
    // Roughly 20% of quintile questions resolve to 1 across a universe by construction.
    const quint = res.filter((r, i) => questions[i]!.type === 'QUINTILE' && r.status === 'RESOLVED')
    const ones = quint.filter((r) => r.status === 'RESOLVED' && r.outcome === 1).length
    expect(ones / quint.length).toBeGreaterThan(0.05)
    expect(ones / quint.length).toBeLessThan(0.5)
  })
  it('level outcome agrees with the adjusted return against the threshold return', () => {
    const res = resolveQuestions({ questions, assets: assetMap, calendars, prices, universeAtIssue: assets })
    questions.forEach((q, i) => {
      const r = res[i]!
      if (q.type !== 'LEVEL' || r.status !== 'RESOLVED') return
      const s = prices.get(q.assetId)!
      const ref = s.get('2026-09-17')!
      const end = s.get(q.resolvesOn)!
      expect(r.outcome).toBe(end / ref > q.threshold! / q.referencePrice ? 1 : 0)
    })
  })
  it('voids when the resolution price is missing', () => {
    const holed = new Map(prices)
    const first = questions[0]!
    const s = new Map(prices.get(first.assetId)!)
    s.delete(first.resolvesOn)
    holed.set(first.assetId, s)
    const res = resolveQuestions({ questions: [first], assets: assetMap, calendars, prices: holed, universeAtIssue: assets })
    expect(res[0]!.status).toBe('VOID')
  })
})

describe('universe-v1 data', () => {
  it('is well formed and covers the four venues', () => {
    const byVenue = new Map<string, number>()
    const symbols = new Set<string>()
    for (const a of universe as { symbol: string; venue: string; peerGroup: string; vendorSymbol: string }[]) {
      byVenue.set(a.venue, (byVenue.get(a.venue) ?? 0) + 1)
      const key = `${a.venue}:${a.symbol}`
      expect(symbols.has(key)).toBe(false)
      symbols.add(key)
      expect(a.peerGroup.length).toBeGreaterThan(0)
      expect(a.vendorSymbol.length).toBeGreaterThan(0)
    }
    expect(byVenue.get('US')).toBeGreaterThan(500)
    expect(byVenue.get('UK')).toBeGreaterThan(95)
    expect(byVenue.get('FX')).toBe(9)
    expect(byVenue.get('CRYPTO')).toBe(3)
  })
})
