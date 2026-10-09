import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { newId, type BunniJobRequest } from '@vigoros/contracts'
import { artifacts, createDb, events, tasks } from '@vigoros/db'
import { eq } from 'drizzle-orm'
import { PgBoss } from 'pg-boss'
import { env } from './env'
import { PathGuard } from './guard'
import { runJob } from './jobs'

/**
 * The Bunni worker. The only process that can read the character's folder, write episode output,
 * or (in phase 2) call the Higgsfield CLI. It claims one queue and answers on another.
 */
const main = async () => {
  const e = env()
  const guard = new PathGuard(e.BUNNI_ROOT)
  const db = createDb(e.DATABASE_URL)
  const boss = new PgBoss({ connectionString: e.DIRECT_DATABASE_URL, schema: 'pgboss', max: 2 })
  boss.on('error', (err: unknown) => console.error('[worker]', err))
  await boss.start()
  await boss.createQueue('bunni', { retryLimit: 1, expireInSeconds: 600 })
  await boss.createQueue('bunni.result', { retryLimit: 2, expireInSeconds: 600 })
  console.log(`[worker ${e.WORKER_ID}] root=${guard.root} paid=${e.PAID_JOBS_ENABLED}`)

  await boss.work<BunniJobRequest>(
    'bunni',
    { batchSize: 1, pollingIntervalSeconds: 2 },
    async ([job]) => {
      if (!job) return
      const req = job.data
      const result = runJob(guard, { paidJobsEnabled: e.PAID_JOBS_ENABLED }, req)
      const [task] = await db.select().from(tasks).where(eq(tasks.id, req.taskId))
      const artifactIds: string[] = []
      if (task && result.status === 'ok') {
        for (const rel of result.artifacts) {
          const buf = readFileSync(guard.readPath(rel))
          const id = newId('artifact')
          artifactIds.push(id)
          await db.insert(artifacts).values({
            id,
            companyId: task.companyId,
            characterId: task.characterId,
            taskId: task.id,
            runId: req.runId,
            producedBy: 'bunni-worker',
            kind: rel.includes('/prompts/') ? 'prompt' : 'production_package',
            title: path.basename(rel),
            path: rel,
            sha256: createHash('sha256').update(buf).digest('hex'),
            bytes: buf.byteLength,
            mime: rel.endsWith('.json') ? 'application/json' : 'text/markdown',
          })
        }
      }
      if (task) {
        await db.insert(events).values({
          id: newId('event'),
          companyId: task.companyId,
          characterId: task.characterId,
          agentId: null,
          departmentId: null,
          taskId: task.id,
          kind: 'worker.job',
          subject: `bunni:${req.job}`,
          caption:
            result.status === 'ok'
              ? `Bunni worker completed ${req.job}`
              : `Bunni worker ${result.status} ${req.job}`,
          payload: {
            status: result.status,
            job: req.job,
            artifactIds,
            ...(result.status !== 'ok' ? { detail: result.detail } : {}),
          },
        })
      }
      await boss.send('bunni.result', { taskId: req.taskId, runId: req.runId, result, artifactIds })
    },
  )

  const shutdown = async () => {
    await boss.stop({ graceful: true, timeout: 10_000 })
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
