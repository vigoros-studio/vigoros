import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url(),
  /** Absolute path to the character's production environment. Hard boundary for every read and write. */
  BUNNI_ROOT: z.string().min(1),
  PAID_JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  HIGGSFIELD_DAILY_CAP_CREDITS: z.coerce.number().min(0).default(0),
  WORKER_ID: z.string().default(() => `bw-${process.pid}`),
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
