import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { apiKeys, participants } from '@vigoros/db'
import { newId, sha256Hex } from '@vigoros/domain'
import { db } from './db'

export const API_KEY_PREFIX = 'vg_live_'

/** Generate a key; only the hash is stored. Returns the plaintext once. */
export const mintApiKey = async (participantId: string, label?: string): Promise<{ key: string; id: string }> => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const body = Buffer.from(bytes).toString('base64url')
  const key = `${API_KEY_PREFIX}${body}`
  const id = newId()
  await db()
    .insert(apiKeys)
    .values({ id, participantId, keyHash: await sha256Hex(key), prefix: key.slice(0, 8), label: label ?? null })
  return { key, id }
}

export interface ApiIdentity {
  participantId: string
  handle: string
  kind: typeof participants.$inferSelect.kind
  apiKeyId: string
}

/** Resolve a bearer token to a participant. Constant work: one indexed lookup on the hash. */
export const authenticate = async (authorization: string | null): Promise<ApiIdentity | null> => {
  if (!authorization?.startsWith('Bearer ')) return null
  const key = authorization.slice(7).trim()
  if (!key.startsWith(API_KEY_PREFIX) || key.length < 40) return null
  const hash = await sha256Hex(key)
  const [row] = await db()
    .select({ apiKeyId: apiKeys.id, participantId: participants.id, handle: participants.handle, kind: participants.kind })
    .from(apiKeys)
    .innerJoin(participants, eq(participants.id, apiKeys.participantId))
    .where(and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)))
  if (!row) return null
  // Fire-and-forget usage stamp; failure is irrelevant to the request.
  void db().update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.apiKeyId))
  return row
}
