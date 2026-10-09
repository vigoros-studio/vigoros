import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { newId, type BunniJobRequest } from '@vigoros/contracts'
import { artifacts, companies, createDb, events, tasks } from '@vigoros/db'
import { eq } from 'drizzle-orm'
import { PgBoss } from 'pg-boss'
import { env } from './env'
import { PathGuard } from './guard'
import { runJob } from './jobs'

/**
 * The Bunni worker. The only process that can read the character's folder, write episode output,
 * or (in phase 2) call the Higgsfield CLI. It claims one queue and answers on another.
 */
let lastBunniSeq = 0

/** Mirrors new lines of Bunni's hash-chained event log into the studio event table, flagged as hers. */
const ingestBunniEvents = async (
  guard: PathGuard,
  db: ReturnType<typeof createDb>,
  task: typeof tasks.$inferSelect,
) => {
  const log = path.join(guard.root, 'production', 'jobs', 'events.jsonl')
  if (!existsSync(log)) return
  const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean)
  for (const line of lines) {
    let ev: {
      seq: number
      event: string
      actor: string
      job_id: string | null
      episode: string | null
      shot: string | null
      data: Record<string, unknown>
    }
    try {
      ev = JSON.parse(line)
    } catch {
      continue
    }
    if (ev.seq <= lastBunniSeq) continue
    lastBunniSeq = ev.seq
    const simulated = ev.actor === 'simulation' || ev.data?.['simulated'] === true
    await db.insert(events).values({
      id: newId('event'),
      companyId: task.companyId,
      characterId: task.characterId,
      agentId: null,
      departmentId: null,
      taskId: task.id,
      workflowId: task.workflowId,
      kind: 'worker.job',
      subject: `bunni-events:${ev.seq}`,
      caption: `Bunni${simulated ? ' (simulated)' : ''}: ${ev.event}${ev.episode ? ` ${ev.episode}` : ''}${ev.shot ? ` shot ${ev.shot}` : ''}${ev.job_id ? ` · ${ev.job_id}` : ''}`,
      payload: {
        bunni: true,
        seq: ev.seq,
        event: ev.event,
        actor: ev.actor,
        jobId: ev.job_id,
        simulated,
        data: ev.data,
      },
    })
  }
}

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
  const [company] = await db.select().from(companies).limit(1)
  // Bunni's own integrity check at start: originals unchanged, or we refuse to work.
  const tools = path.join(guard.interfaceDir, 'bunni_tools.py')
  let integrity = 'not available'
  if (existsSync(tools)) {
    const r = spawnSync('python3', ['-I', tools, 'verify'], {
      cwd: guard.root,
      encoding: 'utf8',
      timeout: 120_000,
    })
    integrity = (r.stdout || r.stderr || '').trim().split('\n').pop() ?? ''
    if (r.status !== 0) {
      console.error('[worker] Bunni integrity check failed; refusing to start:', integrity)
      process.exit(2)
    }
  }
  console.log(`[worker] integrity: ${integrity}`)
  if (company) {
    await db.insert(events).values({
      id: newId('event'),
      companyId: company.id,
      characterId: null,
      agentId: null,
      departmentId: null,
      taskId: null,
      workflowId: null,
      kind: 'worker.started',
      subject: `worker:${e.WORKER_ID}`,
      caption: `Bunni worker online at ${guard.root} (paid jobs ${e.PAID_JOBS_ENABLED ? 'enabled' : 'disabled'}; ${integrity})`,
      payload: {
        root: guard.root,
        paidJobsEnabled: e.PAID_JOBS_ENABLED,
        dailyCapCredits: e.HIGGSFIELD_DAILY_CAP_CREDITS,
        integrity,
        sandbox: existsSync(path.join(guard.root, 'SANDBOX.md')),
      },
    })
  }

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
            workflowId: task.workflowId,
            runId: req.runId,
            producedBy: 'bunni-worker',
            kind: rel.includes('/jobs/')
              ? 'production_package'
              : rel.includes('/prompts/')
                ? 'prompt'
                : 'brief',
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
      if (task) await ingestBunniEvents(guard, db, task)
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
