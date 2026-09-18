import type { IsoDate, Question } from '@vigoros/domain'
import type { TradingCalendar } from './calendar'
import { median, totalReturn, type PriceSeries } from './returns'
import type { UniverseAsset } from './generate'

export interface ResolveInput {
  /** All questions resolving on this day, across venues. */
  questions: readonly Question[]
  assets: ReadonlyMap<string, UniverseAsset>
  calendars: Record<Question['venue'], TradingCalendar>
  /** Adjusted close by asset id, covering reference dates and the resolution date. */
  prices: ReadonlyMap<string, PriceSeries>
  /**
   * For RELATIVE and QUINTILE, the comparison set is every universe asset in the same venue
   * (and peer group) at issue, whether or not a question was generated for it.
   */
  universeAtIssue: readonly UniverseAsset[]
}

export type Resolution =
  | { questionId: string; status: 'RESOLVED'; outcome: 0 | 1; realisedReturn: number }
  | { questionId: string; status: 'VOID'; reason: string }

/**
 * Resolves using adjusted closes on both ends, so corporate actions between issue and
 * resolution cancel. LEVEL compares the adjusted return with the threshold return
 * (threshold / referencePrice − 1), never the raw threshold with a raw price.
 */
export const resolveQuestions = (input: ResolveInput): Resolution[] => {
  const out: Resolution[] = []
  // Cache horizon returns per (venue, issueDate, horizon) so peer sets are computed once.
  const peerReturns = new Map<string, Map<string, number>>()

  const returnsFor = (venue: Question['venue'], issueDate: IsoDate, horizon: number): Map<string, number> => {
    const key = `${venue}|${issueDate}|${horizon}`
    let m = peerReturns.get(key)
    if (m) return m
    m = new Map()
    const cal = input.calendars[venue]
    const ref = cal.previous(issueDate)
    const end = cal.advance(issueDate, horizon)
    if (ref && end) {
      for (const a of input.universeAtIssue) {
        if (a.venue !== venue) continue
        const s = input.prices.get(a.id)
        const r = s ? totalReturn(s, ref, end) : null
        if (r !== null) m.set(a.id, r)
      }
    }
    peerReturns.set(key, m)
    return m
  }

  for (const q of input.questions) {
    const rets = returnsFor(q.venue, q.issueDate, q.horizon)
    const r = rets.get(q.assetId)
    if (r === undefined) {
      out.push({ questionId: q.id, status: 'VOID', reason: 'missing price at reference or resolution' })
      continue
    }
    let outcome: 0 | 1
    switch (q.type) {
      case 'LEVEL': {
        if (q.threshold === null) {
          out.push({ questionId: q.id, status: 'VOID', reason: 'level question without threshold' })
          continue
        }
        outcome = r > q.threshold / q.referencePrice - 1 ? 1 : 0
        break
      }
      case 'RELATIVE': {
        const asset = input.assets.get(q.assetId)
        const peers = input.universeAtIssue
          .filter((a) => a.venue === q.venue && a.peerGroup === asset?.peerGroup && a.id !== q.assetId)
          .map((a) => rets.get(a.id))
          .filter((x): x is number => x !== undefined)
        const med = median(peers)
        if (med === null) {
          out.push({ questionId: q.id, status: 'VOID', reason: 'no peer returns' })
          continue
        }
        outcome = r > med ? 1 : 0
        break
      }
      case 'QUINTILE': {
        const all = [...rets.values()]
        if (all.length < 5) {
          out.push({ questionId: q.id, status: 'VOID', reason: 'universe too small for quintiles' })
          continue
        }
        // Rank by strictly-greater count; top quintile = the ceil(20%) best. Ties favour the lower rank.
        const topCount = Math.ceil(all.length * 0.2)
        let better = 0
        for (const x of all) if (x > r) better++
        outcome = better < topCount ? 1 : 0
        break
      }
    }
    out.push({ questionId: q.id, status: 'RESOLVED', outcome, realisedReturn: r })
  }
  return out
}
