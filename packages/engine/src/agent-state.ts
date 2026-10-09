import type { AgentState, TaskStatus } from '@vigoros/contracts'

export interface AgentSnapshot {
  openRun: boolean
  inOpenMeeting: boolean
  /** Statuses of tasks the agent owns that are not terminal. */
  openTaskStatuses: readonly TaskStatus[]
  /** Whether the current open task is a review of someone else's artifact. */
  reviewing: boolean
  /** Last terminal task finished within the "completed" afterglow window. */
  justCompleted: boolean
}

/** The seven avatar states, derived from rows. Never stored, never animated without a cause. */
export const deriveAgentState = (s: AgentSnapshot): AgentState => {
  if (s.inOpenMeeting) return 'meeting'
  if (s.openRun) return s.reviewing ? 'reviewing' : 'working'
  if (s.openTaskStatuses.includes('blocked')) return 'blocked'
  if (s.openTaskStatuses.includes('waiting')) return 'waiting'
  if (s.openTaskStatuses.includes('queued') || s.openTaskStatuses.includes('running'))
    return 'working'
  if (s.justCompleted) return 'completed'
  return 'idle'
}
