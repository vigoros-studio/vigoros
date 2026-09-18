/**
 * Applies ./migrations with drizzle-orm's migrator and surfaces the real Postgres error.
 * Usage: DIRECT_DATABASE_URL=... node scripts/migrate.ts
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('DIRECT_DATABASE_URL is not set')
const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} })
try {
  await migrate(drizzle(client), { migrationsFolder: new URL('../migrations', import.meta.url).pathname })
  console.log('migrations applied')
} catch (e) {
  const err = e as { message?: string; code?: string; detail?: string; position?: string; cause?: { message?: string; code?: string; detail?: string } }
  const c = err.cause ?? err
  console.error('MIGRATION FAILED', JSON.stringify({ message: c.message ?? err.message, code: c.code, detail: c.detail }))
  process.exitCode = 1
} finally {
  await client.end()
}
