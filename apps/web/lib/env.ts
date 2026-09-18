import 'server-only'
import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  TIINGO_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16),
  /** Secret half of the daily question seed; the derived seed is published, this never is. */
  SEED_SECRET: z.string().min(16).optional(),
  JOB_TIME_BUDGET_MS: z.coerce.number().default(240_000),
})

let cached: z.infer<typeof Env> | null = null
export const env = (): z.infer<typeof Env> => {
  if (cached) return cached
  const parsed = Env.safeParse(process.env)
  if (!parsed.success) throw new Error(`invalid environment: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`)
  cached = parsed.data
  return cached
}
