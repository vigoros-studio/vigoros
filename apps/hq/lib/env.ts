import 'server-only'
import { z } from 'zod'

const Env = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  /** Comma-separated. The HQ is private: anyone not listed is signed out. */
  HQ_ALLOWED_EMAILS: z.string().default(''),
})

let cached: z.infer<typeof Env> | null = null
export const env = () => {
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

export const allowedEmails = (): Set<string> =>
  new Set(
    env()
      .HQ_ALLOWED_EMAILS.split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
