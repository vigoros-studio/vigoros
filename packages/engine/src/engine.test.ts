import { describe, expect, it } from 'vitest'
import {
  breakerOpen,
  checkBudget,
  checkLimits,
  costOf,
  deriveAgentState,
  fingerprint,
  isLooping,
  mustCloseAsBlocker,
  statusAfter,
  transition,
  validateMeeting,
} from './index'

describe('task machine', () => {
  it('allows the designed transitions and refuses the rest', () => {
    expect(transition('queued', 'running')).toBe('running')
    expect(transition('running', 'done')).toBe('done')
    expect(() => transition('done', 'running')).toThrow()
    expect(() => transition('queued', 'done')).toThrow()
  })
  it('maps turn outcomes to statuses', () => {
    expect(statusAfter({ kind: 'completed' })).toBe('done')
    expect(statusAfter({ kind: 'needs_approval' })).toBe('blocked')
    expect(statusAfter({ kind: 'failed', retryable: true })).toBe('queued')
    expect(statusAfter({ kind: 'failed', retryable: false })).toBe('failed')
  })
})

describe('budget', () => {
  it('prices usage per model', () => {
    const usd = costOf(
      { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
      'claude-sonnet-5-5',
    )
    expect(usd).toBe(2)
  })
  it('blocks on the first cap that would be exceeded, innermost first', () => {
    const v = checkBudget(0.5, [
      { level: 'run', capUsd: 1, spentUsd: 0 },
      { level: 'task', capUsd: 2, spentUsd: 1.8 },
      { level: 'company_day', capUsd: 5, spentUsd: 0 },
    ])
    expect(v).toMatchObject({ ok: false, level: 'task' })
    expect(checkBudget(0.1, [{ level: 'run', capUsd: 1, spentUsd: 0 }])).toEqual({ ok: true })
  })
})

describe('guards', () => {
  it('detects a loop of identical outputs', () => {
    const f = fingerprint({ a: 1 })
    expect(isLooping([f, f, f])).toBe(true)
    expect(isLooping([f, fingerprint({ a: 2 }), f])).toBe(false)
    expect(isLooping([f, f])).toBe(false)
  })
  it('opens the breaker after repeated failures in the window', () => {
    const now = 1_000_000
    expect(breakerOpen([now - 1000, now - 2000, now - 3000, now - 4000, now - 5000], now)).toBe(
      true,
    )
    expect(breakerOpen([now - 20 * 60_000, now - 1000], now)).toBe(false)
  })
  it('enforces role limits', () => {
    expect(checkLimits({ maxTurnsPerTask: 3, maxChildTasks: 2 }, 3, 0)).toMatchObject({
      ok: false,
      reason: 'max_turns',
    })
    expect(checkLimits({ maxTurnsPerTask: 3, maxChildTasks: 2 }, 1, 3)).toMatchObject({
      ok: false,
      reason: 'max_children',
    })
  })
})

describe('agent state', () => {
  const base = {
    openRun: false,
    inOpenMeeting: false,
    openTaskStatuses: [],
    reviewing: false,
    justCompleted: false,
  }
  it('derives the seven states in priority order', () => {
    expect(deriveAgentState({ ...base, inOpenMeeting: true, openRun: true })).toBe('meeting')
    expect(deriveAgentState({ ...base, openRun: true, reviewing: true })).toBe('reviewing')
    expect(deriveAgentState({ ...base, openRun: true })).toBe('working')
    expect(deriveAgentState({ ...base, openTaskStatuses: ['blocked'] })).toBe('blocked')
    expect(deriveAgentState({ ...base, openTaskStatuses: ['waiting'] })).toBe('waiting')
    expect(deriveAgentState({ ...base, justCompleted: true })).toBe('completed')
    expect(deriveAgentState(base)).toBe('idle')
  })
})

describe('meeting', () => {
  it('validates shape and closes round three without an outcome as a blocker', () => {
    expect(validateMeeting({ chair: 'a', participants: ['a', 'b'], question: 'q' })).toEqual({
      ok: true,
    })
    expect(validateMeeting({ chair: 'a', participants: ['b'], question: 'q' })).toMatchObject({
      ok: false,
    })
    expect(mustCloseAsBlocker(3, null)).toBe(true)
    expect(mustCloseAsBlocker(2, null)).toBe(false)
  })
})
