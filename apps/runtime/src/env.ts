import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** `fake` never calls a paid API. Switching to `anthropic` is a founder decision. */
  MODEL_ADAPTER: z.enum(['fake', 'anthropic']).default('fake'),
  COMPANY_DAILY_CAP_USD: z.coerce.number().positive().default(5),
  /** Fake adapter only: how long a simulated run stays open, for watching the headquarters. */
  FAKE_TURN_MS: z.coerce.number().min(0).max(120_000).default(0),
  RUNTIME_ID: z.string().default(() => `rt-${process.pid}`),
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
