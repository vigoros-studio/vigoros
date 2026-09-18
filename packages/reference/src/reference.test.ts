import { describe, expect, it } from 'vitest'
import type { Question } from '@vigoros/domain'
import { baselineForecast } from './baselines'
import { formatQuestions, SYSTEM_PROMPT } from './prompt'
import { runProvider } from './run'
import { ProviderError, type ForecastProvider, type PromptQuestion } from './types'

const q = (i: number, over: Partial<Question> = {}): Question => ({
  id: `01J8Q${String(i).padStart(21, '0')}`,
  issueDate: '2026-09-18',
  venue: 'US',
  assetId: `A${i}`,
  symbol: `S${i}`,
  type: 'LEVEL',
  horizon: 10,
  levelK: 0,
  threshold: 100,
  referencePrice: 100,
  prior: 0.5,
  deadlineAt: '2026-09-18T13:00:00.000Z',
  resolvesOn: '2026-10-01',
  status: 'OPEN',
  outcome: null,
  resolvedAt: null,
  methodologyVersion: '1.0.0',
  ...over,
})

describe('prompt', () => {
  it('is byte-stable and lists one question per line', () => {
    expect(SYSTEM_PROMPT).toContain('Brier')
    const text = formatQuestions([q(1), q(2)], '2026-09-18')
    expect(text.split('\n').filter((l) => l.includes(' | ')).length).toBe(2)
    expect(formatQuestions([q(1)], '2026-09-18')).toBe(formatQuestions([q(1)], '2026-09-18'))
  })
})

describe('baselines', () => {
  const ctx = { trailingReturn: new Map([['A1', 0.12], ['A2', -0.05]]), seed: 's' }
  it('prior returns the prior', () => expect(baselineForecast('prior', q(1), ctx).p).toBe(0.5))
  it('momentum and mean reversion shade opposite ways', () => {
    expect(baselineForecast('momentum', q(1), ctx).p).toBeCloseTo(0.55)
    expect(baselineForecast('mean_reversion', q(1), ctx).p).toBeCloseTo(0.45)
    expect(baselineForecast('momentum', q(2), ctx).p).toBeCloseTo(0.45)
    expect(baselineForecast('momentum', q(3), ctx).p).toBe(0.5)
  })
  it('random is seeded and bounded', () => {
    const a = baselineForecast('random', q(1), ctx).p
    expect(a).toBe(baselineForecast('random', q(1), ctx).p)
    expect(a).toBeGreaterThanOrEqual(0.3)
    expect(a).toBeLessThanOrEqual(0.7)
    expect(a).not.toBe(baselineForecast('random', q(1), { ...ctx, seed: 't' }).p)
  })
})

const fake = (behaviour: (batch: readonly PromptQuestion[]) => Promise<{ question_id: string; p: number; reasoning: string }[]>): ForecastProvider => ({
  id: 'fake',
  model: 'fake-1',
  forecast: async (batch) => ({
    answers: await behaviour(batch),
    usage: { inputTokens: batch.length * 10, outputTokens: batch.length * 5 },
    requestHash: 'r'.repeat(64),
    responseHash: 's'.repeat(64),
  }),
})

describe('runProvider', () => {
  const questions = Array.from({ length: 95 }, (_, i) => q(i))
  const deadline = new Date('2099-01-01T00:00:00Z')

  it('batches, validates ids, clips, and dedupes', async () => {
    const p = fake(async (batch) => [
      ...batch.map((b) => ({ question_id: b.id, p: 1.0, reasoning: 'x' })),
      { question_id: 'not-issued', p: 0.5, reasoning: 'y' },
      { question_id: batch[0]!.id, p: 0.2, reasoning: 'dup' },
    ])
    const out = await runProvider(p, questions, '2026-09-18', { deadline, batchSize: 40 })
    expect(out.batches).toBe(3)
    expect(out.answers.size).toBe(95)
    expect(out.answers.get(questions[0]!.id)!.p).toBe(0.99)
    expect(out.usage.inputTokens).toBe(950)
    expect(out.failedBatches).toHaveLength(0)
  })
  it('records a failed batch and continues with the rest', async () => {
    let calls = 0
    const p = fake(async (batch) => {
      if (calls++ === 1) throw new ProviderError('fake', 'refusal', 'nope')
      return batch.map((b) => ({ question_id: b.id, p: 0.6, reasoning: 'x' }))
    })
    const out = await runProvider(p, questions, '2026-09-18', { deadline, batchSize: 40, concurrency: 1 })
    expect(out.failedBatches).toHaveLength(1)
    expect(out.answers.size).toBe(55)
  })
  it('stops submitting at the deadline', async () => {
    const p = fake(async (batch) => batch.map((b) => ({ question_id: b.id, p: 0.6, reasoning: 'x' })))
    const out = await runProvider(p, questions, '2026-09-18', { deadline: new Date('2000-01-01T00:00:00Z'), batchSize: 40 })
    expect(out.answers.size).toBe(0)
    expect(out.failedBatches).toHaveLength(3)
  })
})
