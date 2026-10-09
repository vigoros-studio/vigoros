import { z } from 'zod'
import { EventKind } from './enums'

/**
 * One append-only row per state change. The HQ scene subscribes to this table and nothing else,
 * so anything the scene shows is traceable to an event and the row that caused it.
 */
export const Event = z.object({
  kind: EventKind,
  companyId: z.string(),
  characterId: z.string().nullable(),
  agentId: z.string().nullable(),
  departmentId: z.string().nullable(),
  taskId: z.string().nullable(),
  /** Row that caused the event, as `table:id`. */
  subject: z.string(),
  /** One line a person can read in the feed. Written by code, not a model. */
  caption: z.string().max(200),
  payload: z.record(z.string(), z.unknown()).default({}),
})
export type Event = z.infer<typeof Event>
