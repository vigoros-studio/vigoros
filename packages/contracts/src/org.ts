import { z } from 'zod'
import { Effort, ModelId, PermissionTier } from './enums'

/** The company's departments. Two today; a new one is a new key here, a room, and a seed row. */
export const DepartmentKey = z.enum(['executive', 'content'])
export type DepartmentKey = z.infer<typeof DepartmentKey>

/** Tools an agent may call. Each maps to a typed database operation or a worker job. */
export const ToolName = z.enum([
  'web_search',
  'read_company_docs',
  'read_task',
  'read_artifact',
  'write_artifact',
  'record_decision',
  'create_task',
  'send_message',
  'request_worker_job',
  'request_approval',
  'write_note',
  'request_meeting',
])
export type ToolName = z.infer<typeof ToolName>

/** Company roles serve the whole company; subject roles are instantiated per subject. */
export const RoleDefinition = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().min(1),
  title: z.string(),
  department: DepartmentKey,
  scope: z.enum(['company', 'subject']),
  phase: z.number().int().min(1).max(5),
  model: ModelId,
  effort: Effort,
  tier: PermissionTier,
  tools: z.array(ToolName),
  purpose: z.string(),
  prompt: z.string(),
  /** Which structured outputs this role returns. */
  outputs: z.array(z.string()),
  maxTurnsPerTask: z.number().int().min(1).max(20),
  maxChildTasks: z.number().int().min(0).max(20),
  perRunCapUsd: z.number().positive(),
})
export type RoleDefinition = z.infer<typeof RoleDefinition>

export const RoomLayout = z.object({
  key: DepartmentKey,
  name: z.string(),
  /** Grid cell of the room's origin and its size, in isometric tiles. */
  origin: z.tuple([z.number(), z.number()]),
  size: z.tuple([z.number(), z.number()]),
  desks: z.number().int().min(1),
})
export type RoomLayout = z.infer<typeof RoomLayout>
