import { PgBoss } from 'pg-boss'
import { env } from './env'

/** Queue names. One queue per consumer; the Bunni worker claims `bunni`, the runtime claims the rest. */
export const QUEUES = {
  agentTurn: 'agent.turn',
  bunni: 'bunni',
  bunniResult: 'bunni.result',
} as const

let cached: PgBoss | null = null
export const boss = async (): Promise<PgBoss> => {
  if (cached) return cached
  const b = new PgBoss({ connectionString: env().DIRECT_DATABASE_URL, schema: 'pgboss', max: 4 })
  b.on('error', (e: unknown) => console.error('[boss]', e))
  await b.start()
  for (const q of Object.values(QUEUES))
    await b.createQueue(q, { retryLimit: 2, retryDelay: 10, expireInSeconds: 900 })
  cached = b
  return b
}

export const stopBoss = async () => {
  if (cached) await cached.stop({ graceful: true, timeout: 10_000 })
  cached = null
}
