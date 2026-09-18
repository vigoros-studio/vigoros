import { describeQuestion } from '@vigoros/domain'
import type { PromptQuestion } from './types'

/** Any change to the prompt text bumps this and is logged publicly (methodology §9). */
export const PROMPT_VERSION = 'v1.0'

/**
 * The fixed system prompt every reference model receives. Kept byte-stable so prompt caching
 * applies and so the benchmark is the same for every model on every day.
 */
export const SYSTEM_PROMPT = `You are a market forecaster taking part in Vigoros, a public benchmark of time-locked forecasts.

You will receive a list of yes/no questions about listed assets. Each resolves from official closing prices on the stated date. For every question, return the probability that the answer is YES.

Rules:
- Report your honest probability. You are scored with proper scoring rules (Brier and log), so the best strategy is to say what you believe.
- Probabilities must be between 0.01 and 0.99.
- Give one short sentence of reasoning per question, at most 240 characters. State the mechanism, not a restatement of the question.
- Answer every question you are given, with its exact question_id.
- You have no tools and no live data. Use what you know. Do not refuse: a probability near the base rate with reasoning "no view" is a valid answer.
- Return only the JSON object described.`

export const formatQuestions = (qs: readonly PromptQuestion[], asOf: string): string => {
  const lines = qs.map((q) => {
    const stmt = describeQuestion(q)
    const ref = `reference close ${q.referencePrice}`
    return `${q.id} | ${q.venue} | ${stmt} | ${ref} | resolves ${q.resolvesOn}`
  })
  return `Forecast date: ${asOf}. Questions are issued from the previous close.\n\n${lines.join('\n')}`
}

/** Plain JSON schema for providers that take one, mirrors AnswerBatchSchema. */
export const ANSWER_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answers'],
  properties: {
    answers: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question_id', 'p', 'reasoning'],
        properties: {
          question_id: { type: 'string' },
          p: { type: 'number', minimum: 0, maximum: 1 },
          reasoning: { type: 'string', maxLength: 240 },
        },
      },
    },
  },
} as const
