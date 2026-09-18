import type { IsoDate, VenueId } from '@vigoros/domain'

/**
 * A venue calendar is a sorted array of trading days. Lookups are binary searches.
 * Calendars are derived from observed price dates and stored in trading_days.
 */
export class TradingCalendar {
  private readonly days: readonly IsoDate[]
  constructor(
    readonly venue: VenueId,
    days: Iterable<IsoDate>,
  ) {
    this.days = [...new Set(days)].sort()
  }

  get length(): number {
    return this.days.length
  }

  /** Index of the first trading day >= d, or days.length if none. */
  private lowerBound(d: IsoDate): number {
    let lo = 0
    let hi = this.days.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if ((this.days[mid] as IsoDate) < d) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  isTradingDay(d: IsoDate): boolean {
    const i = this.lowerBound(d)
    return this.days[i] === d
  }

  /** Last trading day strictly before d. */
  previous(d: IsoDate): IsoDate | null {
    const i = this.lowerBound(d)
    return i === 0 ? null : (this.days[i - 1] as IsoDate)
  }

  /**
   * The n-th trading day counting from d, where d itself is day 1 if it trades.
   * This is the resolution date for horizon n issued on d.
   */
  advance(d: IsoDate, n: number): IsoDate | null {
    const i = this.lowerBound(d)
    const j = i + n - 1
    return j < this.days.length ? (this.days[j] as IsoDate) : null
  }

  /** Trading days in [from, to], inclusive. */
  between(from: IsoDate, to: IsoDate): IsoDate[] {
    return this.days.slice(this.lowerBound(from), this.lowerBound(to) + (this.isTradingDay(to) ? 1 : 0))
  }

  /** The last n trading days ending at and including d (d must be a trading day). */
  lastN(d: IsoDate, n: number): IsoDate[] {
    const i = this.lowerBound(d)
    if (this.days[i] !== d) throw new Error(`${d} is not a trading day for ${this.venue}`)
    return this.days.slice(Math.max(0, i - n + 1), i + 1)
  }
}
