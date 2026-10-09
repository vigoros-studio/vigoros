import { describe, expect, it } from 'vitest'
import { DEPARTMENTS, PHASE_ONE_ROLES, POSITIONS, ROOMS } from './index'

describe('org', () => {
  it('has a full role definition for every phase 1 position and a room for every department', () => {
    const phaseOne = POSITIONS.filter((p) => p.phase === 1)
      .map((p) => p.key)
      .sort()
    expect(PHASE_ONE_ROLES.map((r) => r.key).sort()).toEqual(phaseOne)
    expect(PHASE_ONE_ROLES).toHaveLength(7)
    for (const d of DEPARTMENTS) expect(ROOMS.some((r) => r.key === d.key)).toBe(true)
  })
  it('keeps publishing and paid video outside every agent tier', () => {
    for (const r of PHASE_ONE_ROLES) expect(r.tier).toBeLessThan(4)
  })
})
