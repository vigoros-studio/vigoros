import { z } from 'zod'
import { EpisodeScript } from './bunni-jobs'

/** Structured outputs. Every decision-bearing agent turn returns one of these, never prose to parse. */

export const Opportunity = z.object({
  title: z.string().max(120),
  format: z.string().max(200),
  whyBunni: z.string().max(400),
  hookIdea: z.string().max(200),
  sources: z.array(z.object({ url: z.string(), note: z.string().max(200) })).max(5),
  confidence: z.number().min(0).max(1),
})
export const OpportunityReport = z.object({ opportunities: z.array(Opportunity).min(1).max(5) })

export const DirectorPick = z.object({
  chosenIndex: z.number().int().min(0),
  brief: z.string().max(1200),
  reasoning: z.string().max(400),
  alternatives: z.array(z.object({ index: z.number().int(), whyNot: z.string().max(200) })),
})

export const ScriptDraft = EpisodeScript

export const Ranking = z.object({
  ranked: z
    .array(
      z.object({
        candidate: z.string(),
        score: z.number().min(0).max(10),
        strengths: z.string().max(300),
        weaknesses: z.string().max(300),
        canonRisks: z.array(z.string().max(160)),
      }),
    )
    .min(1),
  winner: z.string(),
  reasoning: z.string().max(400),
  continuityNotes: z.array(z.string().max(200)),
})

export const ProductionEstimate = z.object({
  episodeSlug: z.string(),
  shots: z.number().int().min(1).max(12),
  keyframes: z.number().int(),
  videoSeconds: z.number(),
  assetsNeeded: z.array(z.string()),
  risks: z.array(z.string().max(200)),
})

export const MeasurementPlan = z.object({
  hypothesis: z.string().max(300),
  primaryMetric: z.string().max(120),
  secondaryMetrics: z.array(z.string().max(120)).max(4),
  successThreshold: z.string().max(200),
  readAfterHours: z.number().int().min(1).max(168),
})

export const ApprovalItem = z.object({
  headline: z.string().max(120),
  summary: z.string().max(800),
  recommendation: z.enum(['approve', 'revise', 'reject']),
  reasoning: z.string().max(400),
})

export const Briefing = z.object({
  greeting: z.string().max(300),
  highlights: z.array(z.string().max(200)).max(6),
  decisionsAwaiting: z.array(z.string().max(160)).max(8),
})

export type Opportunity = z.infer<typeof Opportunity>
export type OpportunityReport = z.infer<typeof OpportunityReport>
export type DirectorPick = z.infer<typeof DirectorPick>
export type Ranking = z.infer<typeof Ranking>
export type ProductionEstimate = z.infer<typeof ProductionEstimate>
export type MeasurementPlan = z.infer<typeof MeasurementPlan>
export type ApprovalItem = z.infer<typeof ApprovalItem>
export type Briefing = z.infer<typeof Briefing>
