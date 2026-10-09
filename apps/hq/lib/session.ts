import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { allowedEmails, env } from './env'

export const supabaseServer = async () => {
  const e = env()
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    throw new Error(
      'Supabase auth is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
  const store = await cookies()
  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          // Server components cannot set cookies; proxy.ts refreshes sessions.
        }
      },
    },
  })
}

/** The founder, or null. An email outside the allowlist is treated as signed out. */
export const founder = async (): Promise<{ email: string } | null> => {
  // Local development only: lets screenshots and tests load the HQ without a mailbox round trip.
  const bypass = process.env['HQ_DEV_FOUNDER_EMAIL']
  if (bypass && process.env['NODE_ENV'] !== 'production' && process.env['VERCEL'] !== '1')
    return { email: bypass }
  const e = env()
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  const email = data.user?.email?.toLowerCase()
  if (!email) return null
  if (!allowedEmails().has(email)) return null
  return { email }
}
