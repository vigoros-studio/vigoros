import { describe, expect, it } from 'vitest'
import { isFinalBar } from './ingest'

describe('isFinalBar', () => {
  const afternoon = new Date('2026-09-18T16:40:00Z')
  const night = new Date('2026-09-18T22:30:00Z')
  it('drops the in-progress bar until the session has closed', () => {
    expect(isFinalBar('2026-09-18', 'US', afternoon)).toBe(false)
    expect(isFinalBar('2026-09-18', 'US', night)).toBe(true)
    expect(isFinalBar('2026-09-17', 'US', afternoon)).toBe(true)
  })
  it('never accepts today for crypto, whose bar closes at midnight UTC', () => {
    expect(isFinalBar('2026-09-18', 'CRYPTO', night)).toBe(false)
    expect(isFinalBar('2026-09-17', 'CRYPTO', afternoon)).toBe(true)
  })
  it('drops weekend bars for weekday venues only', () => {
    expect(isFinalBar('2026-09-13', 'FX', afternoon)).toBe(false) // Sunday
    expect(isFinalBar('2026-09-13', 'CRYPTO', afternoon)).toBe(true)
  })
  it('rejects future days', () => {
    expect(isFinalBar('2026-09-19', 'US', afternoon)).toBe(false)
  })
})
