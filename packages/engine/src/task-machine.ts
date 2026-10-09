import type { TaskStatus } from '@vigoros/contracts'

/**
 * The only legal task transitions. The runtime, not the agent, moves tasks;
 * an agent's turn ends by reporting an outcome and the machine decides the status.
 */
const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  queued: ['running', 'cancelled', 'blocked'],
  running: ['waiting', 'blocked', 'done', 'failed', 'cancelled'],
  waiting: ['queued', 'running', 'blocked', 'done', 'cancelled'],
  blocked: ['queued', 'cancelled', 'failed'],
  done: [],
  failed: ['queued'],
  cancelled: [],
}

export const canTransition = (from: TaskStatus, to: TaskStatus): boolean =>
  TRANSITIONS[from].includes(to)

export class IllegalTransition extends Error {
  constructor(
    readonly from: TaskStatus,
    readonly to: TaskStatus,
  ) {
    super(`illegal task transition ${from} -> ${to}`)
  }
}

export const transition = (from: TaskStatus, to: TaskStatus): TaskStatus => {
  if (!canTransition(from, to)) throw new IllegalTransition(from, to)
  return to
}

export const isTerminal = (s: TaskStatus): boolean => TRANSITIONS[s].length === 0 || s === 'failed'

/** Outcome an agent turn reports; the machine maps it to a status. */
export type TurnOutcome =
  | { kind: 'completed' }
  | { kind: 'delegated' }
  | { kind: 'needs_approval' }
  | { kind: 'needs_input' }
  | { kind: 'failed'; retryable: boolean }
  | { kind: 'over_budget' }

export const statusAfter = (outcome: TurnOutcome): TaskStatus => {
  switch (outcome.kind) {
    case 'completed':
      return 'done'
    case 'delegated':
    case 'needs_input':
      return 'waiting'
    case 'needs_approval':
    case 'over_budget':
      return 'blocked'
    case 'failed':
      return outcome.retryable ? 'queued' : 'failed'
  }
}
