import 'server-only'
import { createDb, type Db } from '@vigoros/db'
import { env } from './env'

declare global {
  // eslint-disable-next-line no-var
  var __vigorosDb: Db | undefined
}

/** One pooled client per warm instance. */
export const db = (): Db => {
  if (!globalThis.__vigorosDb) globalThis.__vigorosDb = createDb(env().DATABASE_URL)
  return globalThis.__vigorosDb
}
