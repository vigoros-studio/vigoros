import { z } from 'zod'

export const VenueId = z.enum(['US', 'UK', 'FX', 'CRYPTO'])
export type VenueId = z.infer<typeof VenueId>

export const AssetClass = z.enum(['EQUITY', 'ETF', 'FX', 'CRYPTO'])
export type AssetClass = z.infer<typeof AssetClass>

/**
 * Venue configuration is data, not code. Deadlines are expressed as UTC times on the issue day.
 * Calendars live in the database; this is the static shape.
 */
export interface VenueConfig {
  id: VenueId
  name: string
  /** HH:MM UTC on issue day D, before the venue opens. */
  deadlineUtc: string
  /** Whether weekends are trading days. */
  tradesWeekends: boolean
}

export const VENUES: Readonly<Record<VenueId, VenueConfig>> = {
  US: { id: 'US', name: 'US equities', deadlineUtc: '13:00', tradesWeekends: false },
  UK: { id: 'UK', name: 'UK equities', deadlineUtc: '07:30', tradesWeekends: false },
  FX: { id: 'FX', name: 'FX majors', deadlineUtc: '07:00', tradesWeekends: false },
  CRYPTO: { id: 'CRYPTO', name: 'Crypto', deadlineUtc: '06:00', tradesWeekends: true },
}

export const deadlineFor = (venue: VenueId, issueDate: string): Date => {
  const [hh, mm] = VENUES[venue].deadlineUtc.split(':').map(Number) as [number, number]
  return new Date(`${issueDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000Z`)
}
