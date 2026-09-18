import { z } from 'zod'
import type { Question } from '@vigoros/domain'

/** The subset of a question a model sees. Nothing here leaks the prior or other participants. */
export type PromptQuestion = Pick<
  Question,
  'id' | 'symbol' | 'venue' | 'type' | 'horizon' | 'threshold' | 'referencePrice' | 'resolvesOn' | 'issueDate'
>

export const AnswerSchema = z.object({
  question_id: z.string(),
  p: z.number().min(0).max(1),
  reasoning: z.string().max(240),
})
export type Answer = z.infer<typeof AnswerSchema>

export const AnswerBatchSchema = z.object({ answers: z.array(AnswerSchema) })
export type AnswerBatch = z.infer<typeof AnswerBatchSchema>

export interface ProviderUsage {
  inputTokens: number
  outputTokens: number
}

export interface ForecastResult {
  answers: Answer[]
  usage: ProviderUsage
  /** SHA-256 of the exact request body sent, for the public audit trail. */
  requestHash: string
  responseHash: string
}

/**
 * A provider turns one batch of questions into probabilities. Providers never see other
 * participants, priors, or outcomes. A failure throws; the runner records it. There is no
 * fallback to another model: a reference identity's record must be that model's alone.
 */
export interface ForecastProvider {
  readonly id: string
  readonly model: string
  forecast(questions: readonly PromptQuestion[], asOf: string): Promise<ForecastResult>
}

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly kind: 'refusal' | 'rate_limit' | 'invalid_output' | 'http' | 'unknown',
    message: string,
  ) {
    super(`[${provider}] ${kind}: ${message}`)
    this.name = 'ProviderError'
  }
}
