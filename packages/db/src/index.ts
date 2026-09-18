import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export * from './schema.js'
export { schema }

export type Db = ReturnType<typeof createDb>

/**
 * One client per process. Supabase's pooler (port 6543, transaction mode) requires
 * prepared statements off. Callers must not cache statements across transactions.
 */
export const createDb = (url: string) => {
  const client = postgres(url, { prepare: false, max: 10, idle_timeout: 20, connect_timeout: 10 })
  return drizzle(client, { schema, casing: 'snake_case' })
}
