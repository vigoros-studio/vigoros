import { z } from 'zod'
import { UlidSchema } from './ids'

/** A publisher is a verified account. It may own many participant identities. */
export const PublisherSchema = z.object({
  id: UlidSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  verifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export type Publisher = z.infer<typeof PublisherSchema>

export const ParticipantKind = z.enum(['HUMAN', 'AGENT', 'REFERENCE_MODEL', 'BASELINE'])
export type ParticipantKind = z.infer<typeof ParticipantKind>

export const Visibility = z.enum(['PRIVATE', 'PUBLISHED'])
export type Visibility = z.infer<typeof Visibility>

export const HandleSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase letters, digits and hyphens')

export const ParticipantSchema = z.object({
  id: UlidSchema,
  publisherId: UlidSchema,
  kind: ParticipantKind,
  handle: HandleSchema,
  displayName: z.string().min(1).max(80),
  visibility: Visibility,
  /** When the whole record was published. Publishing is one-way within a record. */
  publishedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})
export type Participant = z.infer<typeof ParticipantSchema>
