import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { eq } from 'drizzle-orm'
import { participants, publishers } from '@vigoros/db'
import { newId } from '@vigoros/domain'
import { db } from './db'
import { env } from './env'

export const supabaseServer = async () => {
  const e = env()
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new Error('Supabase auth is not configured')
  const store = await cookies()
  return createServerClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          // Server components cannot set cookies; the proxy refreshes sessions instead.
        }
      },
    },
  })
}

export interface Session {
  authUserId: string
  email: string
  publisher: typeof publishers.$inferSelect
  identities: (typeof participants.$inferSelect)[]
}

/** Current signed-in publisher, created on first sign-in. Null when signed out. */
export const currentSession = async (): Promise<Session | null> => {
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user?.email) return null
  let [pub] = await db().select().from(publishers).where(eq(publishers.authUserId, user.id))
  if (!pub) {
    ;[pub] = await db()
      .insert(publishers)
      .values({ id: newId(), authUserId: user.id, email: user.email, displayName: user.email.split('@')[0] ?? 'publisher', verifiedAt: new Date() })
      .onConflictDoNothing({ target: publishers.authUserId })
      .returning()
    if (!pub) [pub] = await db().select().from(publishers).where(eq(publishers.authUserId, user.id))
  }
  if (!pub) return null
  const identities = await db().select().from(participants).where(eq(participants.publisherId, pub.id))
  return { authUserId: user.id, email: user.email, publisher: pub, identities }
}
