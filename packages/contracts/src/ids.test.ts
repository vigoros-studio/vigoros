import { describe, expect, it } from 'vitest'
import { idSchema, newId } from './ids'

describe('ids', () => {
  it('mints prefixed ulids that round-trip through the schema', () => {
    const id = newId('task')
    expect(id.startsWith('tsk_')).toBe(true)
    expect(idSchema('task').parse(id)).toBe(id)
    expect(() => idSchema('agent').parse(id)).toThrow()
  })
})
