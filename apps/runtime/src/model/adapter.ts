import type { Effort, ModelId } from '@vigoros/contracts'
import type { Usage } from '@vigoros/engine'
import type { z } from 'zod'

export interface TurnRequest<T> {
  model: ModelId
  effort: Effort
  /** Stable blocks first (role prompt), volatile last. The adapter caches the stable ones. */
  system: { stable: string; volatile: string }
  user: string
  schema: z.ZodType<T>
  schemaName: string
  webSearch: boolean
  maxOutputTokens: number
}

export interface TurnResult<T> {
  output: T
  usage: Usage
  /** Full request and response for the run record. */
  request: unknown
  response: unknown
  stopReason: string
}

export interface ModelAdapter {
  readonly name: 'fake' | 'anthropic'
  complete<T>(req: TurnRequest<T>): Promise<TurnResult<T>>
}
