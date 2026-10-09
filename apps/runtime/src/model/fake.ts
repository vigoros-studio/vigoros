import type { ModelAdapter, TurnRequest, TurnResult } from './adapter'

/**
 * Deterministic adapter for tests and dry runs. Returns the fixture registered for the schema name.
 * Spends nothing and records that it spent nothing. It never pretends to be a real result:
 * every output it produces is tagged `fake: true` in the run record.
 */
export const fakeAdapter = (fixtures: Record<string, unknown>): ModelAdapter => ({
  name: 'fake',
  async complete<T>(req: TurnRequest<T>): Promise<TurnResult<T>> {
    const fixture = fixtures[req.schemaName]
    if (fixture === undefined) throw new Error(`no fake fixture for ${req.schemaName}`)
    const output = req.schema.parse(fixture)
    return {
      output,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      request: { fake: true, model: req.model, user: req.user.slice(0, 500) },
      response: { fake: true, schema: req.schemaName },
      stopReason: 'end_turn',
    }
  },
})
