import { describe, expect, it } from 'vitest'
import { canonicalize, hashCanonical } from './canonical.js'

describe('canonicalize', () => {
  it('sorts keys and strips whitespace', () => {
    expect(canonicalize({ b: 1, a: { d: null, c: [1, 'x'] } })).toBe('{"a":{"c":[1,"x"],"d":null},"b":1}')
  })
  it('is order independent', async () => {
    const h1 = await hashCanonical({ p: 0.71, question_id: 'Q', v: 1 })
    const h2 = await hashCanonical({ v: 1, question_id: 'Q', p: 0.71 })
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })
  it('rejects non-finite numbers', () => {
    expect(() => canonicalize({ p: Number.NaN })).toThrow()
  })
})
