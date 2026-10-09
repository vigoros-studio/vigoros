import { z } from 'zod'

/**
 * The whole bridge between Vigoros and /bunni. Fixed, typed, versioned.
 * Adding a job is a code change here and in the worker, never a prompt.
 */
export const BUNNI_JOB_SURFACE_VERSION = 1

const Reference = z.object({
  path: z.string(),
  role: z.enum(['master_front', 'master_34', 'variation']),
})

export const ShotPrompt = z.object({
  shot: z.number().int().min(1),
  /** Begins with the anchor block verbatim. The worker enforces this. */
  prompt: z.string(),
  references: z.array(Reference).max(3),
  durationSec: z.number().min(2).max(15).optional(),
})
export type ShotPrompt = z.infer<typeof ShotPrompt>

export const EpisodeScript = z.object({
  title: z.string().min(3).max(80),
  hook: z.string().min(3).max(200),
  logline: z.string().max(300),
  outfit: z.enum(['default', 'sleep-mode', 'tiny-ceo', 'street-bunni', 'cozy', 'chef']),
  accessory: z
    .enum([
      'none',
      'sunglasses',
      'sunglasses-on-head',
      'phone',
      'pink-baseball-cap',
      'oversized-headphones',
      'handbag',
      'facemask',
    ])
    .default('none'),
  setting: z.string().max(200),
  beats: z
    .array(
      z.object({
        beat: z.number().int().min(1),
        action: z.string().max(300),
        line: z.string().max(200).nullable(),
        expression: z.enum([
          'neutral',
          'happy-ish',
          'unhinged',
          'sassy',
          'tired',
          'judging',
          'angry',
          'excited',
          'sad',
          'confused',
        ]),
      }),
    )
    .min(2)
    .max(8),
  caption: z.string().max(300),
  hashtags: z.array(z.string()).max(8),
})
export type EpisodeScript = z.infer<typeof EpisodeScript>

const AssetEntry = z.object({
  id: z.string(),
  path: z.string(),
  category: z.string(),
  bytes: z.number().int(),
  sha256: z.string(),
  mime: z.string(),
})
export type AssetEntry = z.infer<typeof AssetEntry>

export const BunniJobs = {
  'assets.index': {
    paid: false,
    tier: 0,
    input: z.object({}),
    output: z.object({ root: z.string(), indexedAt: z.string(), assets: z.array(AssetEntry) }),
  },
  'assets.get': {
    paid: false,
    tier: 0,
    input: z.object({ id: z.string() }),
    output: z.object({
      asset: AssetEntry,
      /** UTF-8 text for markdown, base64 for images. */
      encoding: z.enum(['utf8', 'base64']),
      content: z.string(),
    }),
  },
  'episode.create': {
    paid: false,
    tier: 2,
    input: z.object({
      slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
      brief: z.string(),
      script: EpisodeScript,
    }),
    output: z.object({ episode: z.string(), dir: z.string(), files: z.array(z.string()) }),
  },
  'episode.package': {
    paid: false,
    tier: 2,
    input: z.object({ episode: z.string() }),
    output: z.object({
      episode: z.string(),
      shots: z.array(ShotPrompt),
      files: z.array(z.string()),
      estimate: z.object({
        keyframes: z.number().int(),
        videoSeconds: z.number(),
        credits: z.number(),
        usd: z.number(),
        basis: z.string(),
      }),
    }),
  },
  'render.keyframe': {
    paid: true,
    tier: 3,
    input: z.object({ episode: z.string(), shot: z.number().int() }),
    output: z.object({ file: z.string(), credits: z.number() }),
  },
  'render.video': {
    paid: true,
    tier: 4,
    input: z.object({ episode: z.string(), shot: z.number().int() }),
    output: z.object({ file: z.string(), credits: z.number() }),
  },
  'qc.continuity': {
    paid: true,
    tier: 2,
    input: z.object({ episode: z.string(), file: z.string() }),
    output: z.object({
      pass: z.boolean(),
      checks: z.array(z.object({ rule: z.string(), ok: z.boolean(), note: z.string() })),
    }),
  },
  'qc.virality': {
    paid: true,
    tier: 3,
    input: z.object({ episode: z.string(), file: z.string() }),
    output: z.object({ report: z.string(), scores: z.record(z.string(), z.number()) }),
  },
  'publish.package': {
    paid: false,
    tier: 2,
    input: z.object({
      episode: z.string(),
      render: z.string(),
      caption: z.string(),
      hashtags: z.array(z.string()),
    }),
    output: z.object({ dir: z.string(), files: z.array(z.string()) }),
  },
} as const

export type BunniJobName = keyof typeof BunniJobs
export const BunniJobName = z.enum(Object.keys(BunniJobs) as [BunniJobName, ...BunniJobName[]])
export type BunniJobInput<N extends BunniJobName> = z.infer<(typeof BunniJobs)[N]['input']>
export type BunniJobOutput<N extends BunniJobName> = z.infer<(typeof BunniJobs)[N]['output']>

export const BunniJobRequest = z.object({
  job: BunniJobName,
  taskId: z.string(),
  runId: z.string().nullable(),
  requestedBy: z.string(),
  input: z.unknown(),
})
export type BunniJobRequest = z.infer<typeof BunniJobRequest>

export const BunniJobResult = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    job: BunniJobName,
    output: z.unknown(),
    artifacts: z.array(z.string()),
    credits: z.number().default(0),
  }),
  z.object({
    status: z.literal('refused'),
    job: BunniJobName,
    reason: z.enum([
      'paid_jobs_disabled',
      'daily_cap',
      'tier',
      'path_guard',
      'invalid_input',
      'unknown_job',
    ]),
    detail: z.string(),
  }),
  z.object({ status: z.literal('error'), job: BunniJobName, detail: z.string() }),
])
export type BunniJobResult = z.infer<typeof BunniJobResult>
