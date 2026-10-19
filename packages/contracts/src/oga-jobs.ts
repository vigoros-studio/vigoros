import { z } from 'zod'
import { Surface } from './enums'

/**
 * The whole bridge between the company and OneGoodArea's systems. Fixed, typed, versioned.
 * The worker is the only process that calls the OneGoodArea API, PostHog or writes the outbox.
 * Adding a job is a code change here and in the worker, never a prompt.
 */
export const OGA_JOB_SURFACE_VERSION = 1

/** One value as the API serves it, trimmed to what a writer needs. */
export const PackSignal = z.object({
  key: z.string(),
  category: z.string(),
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  unit: z.string().nullable(),
  direction: z.string().nullable(),
  percentile: z.number().nullable(),
  confidence: z.number().min(0).max(100),
  confidenceReason: z.string(),
  source: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  released: z.string().nullable(),
  loaded: z.string().nullable(),
})
export type PackSignal = z.infer<typeof PackSignal>

export const PackChange = z.object({
  signalKey: z.string(),
  before: z.union([z.number(), z.string(), z.null()]),
  after: z.union([z.number(), z.string(), z.null()]),
  recordedAt: z.string(),
  cause: z.enum(['source', 'method', 'both', 'unknown']),
  decileCrossed: z.boolean(),
})

export const PackPlace = z.object({
  input: z.string(),
  placeId: z.string(),
  name: z.string(),
  grain: z.string(),
  district: z.string().nullable(),
  region: z.string().nullable(),
  nation: z.string().nullable(),
  areaType: z.string().nullable(),
  signals: z.array(PackSignal),
  changes: z.array(PackChange),
  gaps: z.array(z.object({ signalKey: z.string(), reason: z.string() })),
})
export type PackPlace = z.infer<typeof PackPlace>
export type PackChange = z.infer<typeof PackChange>

/** Everything a writer may cite, fetched once and stored as an artifact. */
export const ResearchPack = z.object({
  mode: z.enum(['live', 'sample']),
  fetchedAt: z.string(),
  apiBase: z.string(),
  methodologyVersion: z.string(),
  places: z.array(PackPlace),
  sources: z.array(z.string()),
  notes: z.array(z.string()),
})
export type ResearchPack = z.infer<typeof ResearchPack>

/** The three go-to-market measures and the site, account and MCP figures behind them. */
export const Scoreboard = z.object({
  mode: z.enum(['live', 'sample']),
  readAt: z.string(),
  site: z.record(z.string(), z.union([z.number(), z.string()])),
  accounts: z.record(z.string(), z.union([z.number(), z.string()])),
  mcp: z.record(z.string(), z.union([z.number(), z.string()])),
  pipeline: z.record(z.string(), z.union([z.number(), z.string()])),
  sources: z.array(z.string()),
  notes: z.array(z.string()),
})
export type Scoreboard = z.infer<typeof Scoreboard>

export const Publication = z.object({
  surface: Surface,
  slug: z.string(),
  path: z.string(),
  bytes: z.number().int(),
  sha256: z.string(),
  publishedAt: z.string(),
})
export type Publication = z.infer<typeof Publication>

export const OgaJobs = {
  'oga.research': {
    paid: false,
    input: z.object({
      places: z.array(z.string().min(2).max(40)).min(1).max(12),
      grain: z.enum(['neighbourhood', 'group', 'district']).default('neighbourhood'),
      changesSinceDays: z.number().int().min(1).max(365).default(60),
    }),
    output: ResearchPack,
  },
  'oga.scoreboard': {
    paid: false,
    input: z.object({ days: z.number().int().min(1).max(90).default(30) }),
    output: Scoreboard,
  },
  'content.publish': {
    paid: false,
    input: z.object({
      artifactId: z.string(),
      surface: Surface,
      slug: z.string().min(3).max(80),
      approvalId: z.string(),
    }),
    output: Publication,
  },
} as const
export type OgaJobName = keyof typeof OgaJobs

export const WorkerJobRequest = z.object({
  job: z.enum(['oga.research', 'oga.scoreboard', 'content.publish']),
  taskId: z.string(),
  runId: z.string().nullable(),
  requestedBy: z.string(),
  input: z.record(z.string(), z.unknown()),
})
export type WorkerJobRequest = z.infer<typeof WorkerJobRequest>

export const WorkerJobResult = z.object({
  taskId: z.string(),
  runId: z.string().nullable(),
  result: z.discriminatedUnion('status', [
    z.object({ status: z.literal('ok'), job: z.string(), output: z.unknown() }),
    z.object({ status: z.literal('refused'), job: z.string(), reason: z.string() }),
    z.object({ status: z.literal('failed'), job: z.string(), detail: z.string() }),
  ]),
  artifactIds: z.array(z.string()),
})
export type WorkerJobResult = z.infer<typeof WorkerJobResult>
