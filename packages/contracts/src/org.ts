import { z } from 'zod'
import { Effort, ModelId, PermissionTier } from './enums'

export const DepartmentKey = z.enum([
  'executive',
  'creative',
  'production',
  'growth',
  'commercial',
  'operations',
])
export type DepartmentKey = z.infer<typeof DepartmentKey>

/** Tools an agent may call. Each maps to a typed database operation or a Bunni worker job. */
export const ToolName = z.enum([
  'web_search',
  'read_canon',
  'read_task',
  'read_artifact',
  'write_artifact',
  'record_decision',
  'create_task',
  'send_message',
  'request_bunni_job',
  'request_approval',
  'write_note',
  'request_meeting',
])
export type ToolName = z.infer<typeof ToolName>

/** Studio roles serve every character; character roles are instantiated per character. */
export const RoleDefinition = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().min(1),
  title: z.string(),
  department: DepartmentKey,
  scope: z.enum(['studio', 'character']),
  phase: z.number().int().min(1).max(5),
  model: ModelId,
  effort: Effort,
  tier: PermissionTier,
  tools: z.array(ToolName),
  purpose: z.string(),
  prompt: z.string(),
  /** Which structured output this role returns for its main task kind. */
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
