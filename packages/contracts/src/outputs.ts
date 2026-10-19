import { z } from 'zod'
import { Audience, Surface } from './enums'

/** Structured outputs. Every decision-bearing agent turn returns one of these, never prose to parse. */

/**
 * One cited value. Every number in a published piece traces to one of these, and each one traces
 * to a signal row in the research pack: key, place, value, period, source, confidence, version.
 */
export const Citation = z.object({
  signalKey: z.string().max(80),
  placeId: z.string().max(40),
  placeName: z.string().max(120),
  value: z.string().max(80),
  unit: z.string().max(40).nullable(),
  periodStart: z.string().max(20),
  periodEnd: z.string().max(20),
  source: z.string().max(120),
  confidence: z.number().min(0).max(100),
  methodologyVersion: z.string().max(20),
})
export type Citation = z.infer<typeof Citation>

export const PlannedPiece = z.object({
  surface: Surface,
  title: z.string().max(120),
  audience: Audience,
  /** Postcodes, place ids or district names the piece is about. Empty for pieces with no place. */
  places: z.array(z.string().max(40)).max(12),
  angle: z.string().max(300),
  why: z.string().max(300),
  priority: z.number().int().min(1).max(5),
})

/** The Managing Director's weekly plan: what to publish, what not to, and why. */
export const ContentPlan = z.object({
  week: z.string().max(40),
  pieces: z.array(PlannedPiece).min(0).max(8),
  skipped: z.array(z.object({ idea: z.string().max(200), why: z.string().max(200) })).max(6),
  notes: z.string().max(600),
})

/** A piece ready for checking. The body is markdown; every figure in it appears in `citations`. */
export const ContentDraft = z.object({
  surface: Surface,
  title: z.string().max(160),
  audience: Audience,
  summary: z.string().max(300),
  body: z.string().max(8000),
  citations: z.array(Citation).max(40),
  methodologyVersion: z.string().max(20),
  callToAction: z.string().max(200).nullable(),
  hashtags: z.array(z.string().max(40)).max(6),
  /** Set when the data does not support the piece. A withheld piece is a valid, honest output. */
  withheld: z.object({ reason: z.string().max(300) }).nullable(),
})

/** The fact-check pass. A failed check blocks the piece; a passed one lists what was verified. */
export const FactCheck = z.object({
  verdict: z.enum(['pass', 'fail']),
  claimsChecked: z.number().int().min(0),
  issues: z
    .array(
      z.object({
        claim: z.string().max(300),
        problem: z.string().max(300),
        fix: z.string().max(300),
      }),
    )
    .max(20),
  notes: z.string().max(600),
})

export const ApprovalItem = z.object({
  headline: z.string().max(120),
  summary: z.string().max(800),
  recommendation: z.enum(['approve', 'revise', 'reject']),
  reasoning: z.string().max(400),
})

/** The Managing Director's editorial read of a checked piece, plus the approval item for the founder. */
export const EditorialReview = ApprovalItem.extend({
  edits: z.array(z.string().max(300)).max(8),
  /** The body as the Managing Director would publish it, or null to keep the draft as is. */
  revisedBody: z.string().max(8000).nullable(),
})

/** The Managing Director's reading of a founder instruction. The runtime applies it; the MD only proposes. */
export const DirectorPlan = z.object({
  summary: z.string().max(400),
  startWorkflow: z.boolean(),
  surface: Surface.default('change_digest'),
  audience: Audience.default('location_data'),
  focus: z.string().max(200),
  guidance: z.string().max(600),
  places: z.array(z.string().max(40)).max(12).default([]),
})

/** Any other agent's reading of a founder instruction. */
export const Acknowledgement = z.object({
  summary: z.string().max(400),
  actions: z.array(z.string().max(200)).max(5),
  needsFounder: z.string().max(300).nullable(),
})

export const Briefing = z.object({
  greeting: z.string().max(300),
  highlights: z.array(z.string().max(200)).max(6),
  decisionsAwaiting: z.array(z.string().max(160)).max(8),
})

export type PlannedPiece = z.infer<typeof PlannedPiece>
export type ContentPlan = z.infer<typeof ContentPlan>
export type ContentDraft = z.infer<typeof ContentDraft>
export type FactCheck = z.infer<typeof FactCheck>
export type ApprovalItem = z.infer<typeof ApprovalItem>
export type EditorialReview = z.infer<typeof EditorialReview>
export type Briefing = z.infer<typeof Briefing>
export type DirectorPlan = z.infer<typeof DirectorPlan>
export type Acknowledgement = z.infer<typeof Acknowledgement>
