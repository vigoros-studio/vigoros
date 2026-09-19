'use server'
import { and, eq, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { apiKeys, participants } from '@vigoros/db'
import { HandleSchema, newId } from '@vigoros/domain'
import { mintApiKey } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { currentSession } from '@/lib/supabase'

const MAX_IDENTITIES = 10

export async function createIdentity(formData: FormData) {
  const session = await currentSession()
  if (!session) redirect('/join')
  const handle = String(formData.get('handle') ?? '').trim().toLowerCase()
  const displayName = String(formData.get('displayName') ?? '').trim().slice(0, 80)
  const kind = formData.get('kind') === 'AGENT' ? 'AGENT' : 'HUMAN'
  if (!HandleSchema.safeParse(handle).success) redirect('/account?error=handle')
  if (session.identities.length >= MAX_IDENTITIES) redirect('/account?error=limit')
  const inserted = await db()
    .insert(participants)
    .values({ id: newId(), publisherId: session.publisher.id, kind, handle, displayName: displayName || handle })
    .onConflictDoNothing({ target: participants.handle })
    .returning({ id: participants.id })
  if (inserted.length === 0) redirect('/account?error=taken')
  redirect(`/account?created=${handle}`)
}

export async function createKey(formData: FormData) {
  const session = await currentSession()
  if (!session) redirect('/join')
  const participantId = String(formData.get('participantId') ?? '')
  const own = session.identities.find((p) => p.id === participantId)
  if (!own) redirect('/account?error=identity')
  const { key } = await mintApiKey(participantId, String(formData.get('label') ?? '').slice(0, 60) || undefined)
  // Shown exactly once, through the URL of the page that renders it. Never stored in plaintext.
  redirect(`/account?key=${encodeURIComponent(key)}&for=${own.handle}`)
}

export async function revokeKey(formData: FormData) {
  const session = await currentSession()
  if (!session) redirect('/join')
  const keyId = String(formData.get('keyId') ?? '')
  const ids = session.identities.map((p) => p.id)
  const [row] = await db().select({ participantId: apiKeys.participantId }).from(apiKeys).where(eq(apiKeys.id, keyId))
  if (!row || !ids.includes(row.participantId)) redirect('/account?error=key')
  await db().update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)))
  redirect('/account')
}

/** One-way within a record: publishing exposes the entire history, present and future. */
export async function publishIdentity(formData: FormData) {
  const session = await currentSession()
  if (!session) redirect('/join')
  const participantId = String(formData.get('participantId') ?? '')
  const own = session.identities.find((p) => p.id === participantId)
  if (!own) redirect('/account?error=identity')
  if (String(formData.get('confirm') ?? '') !== own.handle) redirect('/account?error=confirm')
  await db().update(participants).set({ visibility: 'PUBLISHED', publishedAt: new Date() }).where(eq(participants.id, participantId))
  redirect(`/r/${own.handle}`)
}
