import {
  HORIZONS,
  METHODOLOGY_VERSION,
  VOL_LOOKBACK_DAYS,
  deadlineFor,
  newId,
  type AssetClass,
  type Horizon,
  type IsoDate,
  type LevelK,
  type Question,
  type VenueId,
} from '@vigoros/domain'
import { mulberry32 } from '@vigoros/scoring'
import type { TradingCalendar } from './calendar'
import { levelPrior, type PriorTable } from './priors'
import { dailyLogReturns, realisedVol, type PriceSeries } from './returns'

export interface UniverseAsset {
  id: string
  symbol: string
  venue: VenueId
  assetClass: AssetClass
  peerGroup: string
}

export interface GenerateInput {
  issueDate: IsoDate
  /** Published per-day seed. Anyone with the seed, the universe and the prices regenerates the set. */
  seed: string
  assets: readonly UniverseAsset[]
  calendars: Record<VenueId, TradingCalendar>
  /** Adjusted close by asset id. Must cover at least VOL_LOOKBACK_DAYS + 1 trading days before issue. */
  prices: ReadonlyMap<string, PriceSeries>
  priors: PriorTable
}

export interface GenerateOutput {
  questions: Question[]
  /** Assets skipped and why, published with the set. */
  skipped: { assetId: string; reason: string }[]
}

/** FNV-1a 32-bit, to turn a string seed into a PRNG seed. */
const hash32 = (s: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const pick = <T>(rand: () => number, xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T

/**
 * Three questions per asset per day, one of each type. Horizon and level k are drawn per asset
 * from a PRNG seeded by (seed, issueDate, symbol), so the draw is stable and reproducible but
 * cannot be anticipated before the seed is published. Deterministic, pure, O(assets).
 */
export const generateQuestions = (input: GenerateInput): GenerateOutput => {
  const questions: Question[] = []
  const skipped: GenerateOutput['skipped'] = []
  const issueTime = new Date(`${input.issueDate}T00:00:00.000Z`)

  for (const asset of input.assets) {
    const cal = input.calendars[asset.venue]
    if (!cal.isTradingDay(input.issueDate)) {
      skipped.push({ assetId: asset.id, reason: 'venue closed' })
      continue
    }
    const series = input.prices.get(asset.id)
    const ref = cal.previous(input.issueDate)
    const refPrice = ref ? series?.get(ref) : undefined
    if (!series || !ref || refPrice === undefined) {
      skipped.push({ assetId: asset.id, reason: 'no reference price' })
      continue
    }
    const volWindow = cal.lastN(ref, VOL_LOOKBACK_DAYS + 1)
    const sigma = realisedVol(dailyLogReturns(series, volWindow))
    if (!sigma) {
      skipped.push({ assetId: asset.id, reason: 'insufficient history for volatility' })
      continue
    }

    const rand = mulberry32(hash32(`${input.seed}|${input.issueDate}|${asset.venue}|${asset.symbol}`))
    const deadlineAt = deadlineFor(asset.venue, input.issueDate).toISOString()
    const base = {
      issueDate: input.issueDate,
      venue: asset.venue,
      assetId: asset.id,
      symbol: asset.symbol,
      referencePrice: refPrice,
      deadlineAt,
      status: 'OPEN' as const,
      outcome: null,
      resolvedAt: null,
      methodologyVersion: METHODOLOGY_VERSION,
    }

    const make = (type: Question['type'], h: Horizon, k: LevelK | null): Question | null => {
      const resolvesOn = cal.advance(input.issueDate, h)
      if (!resolvesOn) return null
      const threshold = k === null ? null : k === 0 ? refPrice : Number((refPrice * Math.exp(k * sigma * Math.sqrt(h))).toPrecision(8))
      const prior =
        type === 'LEVEL' ? levelPrior(input.priors, asset.assetClass, h, k as LevelK)
        : type === 'RELATIVE' ? input.priors.relative
        : input.priors.quintile
      return { ...base, id: newId(issueTime), type, horizon: h, levelK: k, threshold, prior, resolvesOn }
    }

    const level = make('LEVEL', pick(rand, HORIZONS), pick(rand, [-1, 0, 1] as const))
    const relative = make('RELATIVE', pick(rand, HORIZONS), null)
    const quintile = make('QUINTILE', pick(rand, HORIZONS), null)
    for (const q of [level, relative, quintile]) if (q) questions.push(q)
  }
  return { questions, skipped }
}
