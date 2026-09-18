import { z } from 'zod'
import type { Json } from './canonical.js'
import { hashCanonical } from './canonical.js'
import { UlidSchema } from './ids.js'
import { P_MAX, P_MIN } from './methodology.js'

export const REASONING_MAX_CHARS = 2000

/** What a participant submits. */
export const CommitmentInputSchema = z.object({
  questionId: UlidSchema,
  p: z.number().min(0).max(1),
  reasoning: z.string().max(REASONING_MAX_CHARS).optional(),
  falsifier: z.string().max(REASONING_MAX_CHARS).optional(),
})
export type CommitmentInput = z.infer<typeof CommitmentInputSchema>

/**
 * The sealed payload. This exact structure, canonicalized, is what gets hashed and anchored.
 * Field names are part of the public methodology and must never change within a major version.
 */
export const SealedPayloadSchema = z.object({
  v: z.literal(1),
  question_id: UlidSchema,
  participant_id: UlidSchema,
  p: z.number().min(P_MIN).max(P_MAX),
  reasoning: z.string().max(REASONING_MAX_CHARS).nullable(),
  falsifier: z.string().max(REASONING_MAX_CHARS).nullable(),
  submitted_at: z.string().datetime(),
})
export type SealedPayload = z.infer<typeof SealedPayloadSchema>

export const sealHash = (payload: SealedPayload): Promise<string> =>
  hashCanonical(payload as unknown as Json)

export const CommitmentSchema = z.object({
  id: UlidSchema,
  participantId: UlidSchema,
  questionId: UlidSchema,
  /** Denormalised for partition pruning. */
  issueDate: z.string(),
  p: z.number().min(P_MIN).max(P_MAX),
  reasoning: z.string().nullable(),
  falsifier: z.string().nullable(),
  hash: z.string().length(64),
  submittedAt: z.string().datetime(),
  sealRootId: UlidSchema.nullable(),
  revealedAt: z.string().datetime().nullable(),
})
export type Commitment = z.infer<typeof CommitmentSchema>
