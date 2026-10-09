import { env } from '../env'
import type { ModelAdapter } from './adapter'
import { anthropicAdapter } from './anthropic'
import { fakeAdapter } from './fake'
import { FIXTURES } from './fixtures'

let cached: ModelAdapter | null = null
export const adapter = (): ModelAdapter => {
  if (cached) return cached
  const e = env()
  if (e.MODEL_ADAPTER === 'anthropic') {
    if (!e.ANTHROPIC_API_KEY) throw new Error('MODEL_ADAPTER=anthropic needs ANTHROPIC_API_KEY')
    cached = anthropicAdapter(e.ANTHROPIC_API_KEY)
  } else {
    cached = fakeAdapter(FIXTURES)
  }
  return cached
}
export type { ModelAdapter, TurnRequest, TurnResult } from './adapter'
