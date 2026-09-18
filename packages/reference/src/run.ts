import { clipProbability } from '@vigoros/domain'
import type { Answer, ForecastProvider, PromptQuestion, ProviderUsage } from './types.js'

export interface RunOptions {
  batchSize?: number
  concurrency?: number
  /** Hard stop: never submit after this instant. */
  deadline: Date
  now?: () => Date
}

export interface RunOutcome {
  answers: Map<string, Answer>
  usage: ProviderUsage
  batches: number
  failedBatches: { index: number; error: string }[]
  requestHashes: string[]
  responseHashes: string[]
}

/**
 * Splits the day's questions into batches, calls the provider with bounded concurrency,
 * validates every answer against the issued ids, and stops cleanly at the deadline.
 * Unknown ids are dropped; duplicates keep the first; probabilities are clipped.
 */
export const runProvider = async (
  provider: ForecastProvider,
  questions: readonly PromptQuestion[],
  asOf: string,
  opts: RunOptions,
): Promise<RunOutcome> => {
  const batchSize = opts.batchSize ?? 40
  const concurrency = opts.concurrency ?? 3
  const now = opts.now ?? (() => new Date())
  const issued = new Set(questions.map((q) => q.id))
  const batches: PromptQuestion[][] = []
  for (let i = 0; i < questions.length; i += batchSize) batches.push(questions.slice(i, i + batchSize))

  const answers = new Map<string, Answer>()
  const usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 }
  const failedBatches: RunOutcome['failedBatches'] = []
  const requestHashes: string[] = []
  const responseHashes: string[] = []
  let next = 0

  const worker = async () => {
    while (next < batches.length) {
      const index = next++
      if (now() >= opts.deadline) {
        failedBatches.push({ index, error: 'deadline reached before submission' })
        continue
      }
      try {
        const result = await provider.forecast(batches[index] as PromptQuestion[], asOf)
        usage.inputTokens += result.usage.inputTokens
        usage.outputTokens += result.usage.outputTokens
        requestHashes.push(result.requestHash)
        responseHashes.push(result.responseHash)
        for (const a of result.answers) {
          if (!issued.has(a.question_id) || answers.has(a.question_id)) continue
          answers.set(a.question_id, { ...a, p: clipProbability(a.p) })
        }
      } catch (e) {
        failedBatches.push({ index, error: e instanceof Error ? e.message : String(e) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, worker))
  return { answers, usage, batches: batches.length, failedBatches, requestHashes, responseHashes }
}
