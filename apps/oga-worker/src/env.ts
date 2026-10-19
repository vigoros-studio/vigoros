import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url(),
  /** `sample` answers every job from the committed 12 October 2026 pack and never touches the network. */
  OGA_MODE: z.enum(['sample', 'live']).default('sample'),
  OGA_API_BASE: z.string().url().default('https://api.onegoodarea.com/v1'),
  /** An `engineering`-type key: unmetered, read-only in practice. Never a customer's quota. */
  OGA_API_KEY: z.string().min(1).optional(),
  /** Where approved pieces are written. The worker writes nowhere else. */
  OGA_OUTBOX: z
    .string()
    .min(1)
    .default(`${process.env['HOME'] ?? '.'}/dev/oga-outbox`),
  POSTHOG_HOST: z.string().url().default('https://eu.posthog.com'),
  POSTHOG_PROJECT_ID: z.string().default('257448'),
  POSTHOG_API_KEY: z.string().min(1).optional(),
  WORKER_ID: z.string().default(() => `ow-${process.pid}`),
})
export type Env = z.infer<typeof Env>

let cached: Env | null = null
export const env = (): Env => {
  if (cached) return cached
  const raw = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== undefined && v !== ''),
  )
  const parsed = Env.safeParse(raw)
  if (!parsed.success)
    throw new Error(
      `invalid environment: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    )
  cached = parsed.data
  return cached
}
