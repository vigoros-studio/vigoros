import { PHASE_ONE_ROLES } from '@vigoros/org'
import { describe, expect, it } from 'vitest'
import { TASK_KINDS } from './kinds'
import { fakeAdapter } from './model/fake'
import { FIXTURES } from './model/fixtures'

describe('task kinds', () => {
  it('bind only to hired roles and have a schema-valid fake fixture each', async () => {
    const fake = fakeAdapter(FIXTURES)
    for (const k of TASK_KINDS) {
      expect(PHASE_ONE_ROLES.some((r) => r.key === k.roleKey)).toBe(true)
      const r = await fake.complete({
        model: 'claude-haiku-5-5',
        effort: 'low',
        system: { stable: '', volatile: '' },
        user: k.user({}, []),
        schema: k.schema,
        schemaName: k.schemaName,
        webSearch: false,
        maxOutputTokens: 100,
      })
      expect(r.usage.inputTokens).toBe(0)
      expect(r.output).toBeDefined()
    }
  })
})
