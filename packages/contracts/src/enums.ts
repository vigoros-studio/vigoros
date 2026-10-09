import { z } from 'zod'

export const TaskStatus = z.enum([
  'queued',
  'running',
  'waiting',
  'blocked',
  'done',
  'failed',
  'cancelled',
])
export type TaskStatus = z.infer<typeof TaskStatus>

/** Derived, never stored: what an avatar is doing right now. */
export const AgentState = z.enum([
  'working',
  'reviewing',
  'meeting',
  'waiting',
  'blocked',
  'completed',
  'idle',
])
export type AgentState = z.infer<typeof AgentState>

/** 0 observe · 1 propose · 2 delegate · 3 spend · 4 founder */
export const PermissionTier = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
])
export type PermissionTier = z.infer<typeof PermissionTier>

export const ModelId = z.enum(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'])
export type ModelId = z.infer<typeof ModelId>

export const Effort = z.enum(['low', 'medium', 'high', 'xhigh'])
export type Effort = z.infer<typeof Effort>

export const RunStatus = z.enum(['started', 'succeeded', 'failed', 'refused', 'over_budget'])
export type RunStatus = z.infer<typeof RunStatus>

export const ApprovalKind = z.enum([
  'publish',
  'paid_render',
  'episode_to_production',
  'commercial',
  'canon_change',
  'account_change',
  'hire_or_pause',
  'raise_cap',
  'content_mix',
])
export type ApprovalKind = z.infer<typeof ApprovalKind>

export const ApprovalStatus = z.enum(['pending', 'approved', 'rejected', 'withdrawn'])
export type ApprovalStatus = z.infer<typeof ApprovalStatus>

export const ArtifactKind = z.enum([
  'opportunity',
  'brief',
  'script',
  'ranking',
  'production_package',
  'cost_estimate',
  'measurement_plan',
  'prompt',
  'keyframe',
  'render',
  'qc_report',
  'publish_package',
  'analysis',
  'briefing',
  'source',
])
export type ArtifactKind = z.infer<typeof ArtifactKind>

export const MeetingStatus = z.enum(['open', 'decided', 'actioned', 'blocked', 'closed_by_runtime'])
export type MeetingStatus = z.infer<typeof MeetingStatus>

export const NoteScope = z.enum(['studio', 'character', 'department', 'agent'])
export type NoteScope = z.infer<typeof NoteScope>

export const EventKind = z.enum([
  'task.created',
  'task.status',
  'run.started',
  'run.finished',
  'message.sent',
  'meeting.opened',
  'meeting.closed',
  'decision.recorded',
  'approval.requested',
  'approval.resolved',
  'artifact.created',
  'budget.blocked',
  'agent.state',
  'company.paused',
  'company.resumed',
  'worker.job',
  'worker.started',
  'workflow.started',
  'workflow.step',
  'workflow.finished',
])
export type EventKind = z.infer<typeof EventKind>

export const WorkflowStatus = z.enum([
  'running',
  'awaiting_approval',
  'producing',
  'done',
  'rejected',
  'failed',
  'cancelled',
])
export type WorkflowStatus = z.infer<typeof WorkflowStatus>

/** Steps of the episode workflow, in order. The runtime advances; agents never choose the next step. */
export const EpisodeStep = z.enum([
  'research',
  'pick',
  'write',
  'review',
  'plan',
  'approval_item',
  'approval',
  'produce',
  'estimate',
])
export type EpisodeStep = z.infer<typeof EpisodeStep>
