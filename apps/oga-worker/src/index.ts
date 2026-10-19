import { newId, type WorkerJobRequest, type WorkerJobResult } from '@vigoros/contracts'
import { artifacts, createDb, events, tasks } from '@vigoros/db'
import { activeCompany } from '@vigoros/ops'
import { eq } from 'drizzle-orm'
import { PgBoss } from 'pg-boss'
import { env } from './env'
import { runJob } from './jobs'

/**
 * The OneGoodArea worker. The only process that calls the OneGoodArea API or PostHog, and the only
 * one that writes the outbox. It claims one queue and answers on another. In sample mode it never
 * touches the network at all.
 */
const main = async () => {
  const e = env()
  const db = createDb(e.DATABASE_URL)
  const boss = new PgBoss({ connectionString: e.DIRECT_DATABASE_URL, schema: 'pgboss', max: 2 })
  boss.on('error', (err: unknown) => console.error('[worker]', err))
  await boss.start()
  await boss.createQueue('oga', { retryLimit: 1, expireInSeconds: 600 })
  await boss.createQueue('oga.result', { retryLimit: 2, expireInSeconds: 600 })
  console.log(
    `[worker ${e.WORKER_ID}] mode=${e.OGA_MODE} api=${e.OGA_API_BASE} outbox=${e.OGA_OUTBOX}`,
  )
  const company = await activeCompany(db)
  if (company) {
    await db.insert(events).values({
      id: newId('event'),
      companyId: company.id,
      subjectId: null,
      agentId: null,
      departmentId: null,
      taskId: null,
      workflowId: null,
      kind: 'worker.started',
      subject: `worker:${e.WORKER_ID}`,
      caption: `OneGoodArea worker online (${e.OGA_MODE} mode, outbox ${e.OGA_OUTBOX})`,
      payload: {
        mode: e.OGA_MODE,
        apiBase: e.OGA_API_BASE,
        outbox: e.OGA_OUTBOX,
        liveKey: Boolean(e.OGA_API_KEY),
      },
    })
  }

  await boss.work<WorkerJobRequest>(
    'oga',
    { batchSize: 1, pollingIntervalSeconds: 1 },
    async ([job]) => {
      if (!job) return
      const req = job.data
      const [task] = await db.select().from(tasks).where(eq(tasks.id, req.taskId))
      if (!task) return
      let outcome: Awaited<ReturnType<typeof runJob>>
      try {
        outcome = await runJob(e, db, req)
      } catch (err) {
        outcome = {
          status: 'failed',
          job: req.job,
          detail: err instanceof Error ? err.message : String(err),
        }
      }
      const artifactIds: string[] = []
      if (outcome.status === 'ok') {
        const id = newId('artifact')
        await db.insert(artifacts).values({
          id,
          companyId: task.companyId,
          subjectId: task.subjectId,
          taskId: task.id,
          workflowId: task.workflowId,
          runId: req.runId,
          producedBy: 'oga-worker',
          kind: outcome.artifact.kind,
          title: outcome.artifact.title,
          simulated:
            outcome.artifact.title.startsWith('[SIMULATED]') ||
            outcome.artifact.title.startsWith('[SAMPLE]'),
          content: outcome.artifact.content,
          path: outcome.artifact.path,
        })
        artifactIds.push(id)
      }
      await db.insert(events).values({
        id: newId('event'),
        companyId: task.companyId,
        subjectId: task.subjectId,
        agentId: null,
        departmentId: null,
        taskId: task.id,
        workflowId: task.workflowId,
        kind: 'worker.job',
        subject: `oga:${req.job}`,
        caption: `Worker ${outcome.status} ${req.job}${outcome.status === 'ok' ? '' : `: ${(outcome.status === 'failed' ? outcome.detail : outcome.reason).slice(0, 100)}`}`,
        payload: { job: req.job, status: outcome.status, mode: e.OGA_MODE, artifactIds },
      })
      const result: WorkerJobResult = {
        taskId: req.taskId,
        runId: req.runId,
        result:
          outcome.status === 'ok'
            ? { status: 'ok', job: outcome.job, output: outcome.output }
            : outcome.status === 'refused'
              ? { status: 'refused', job: outcome.job, reason: outcome.reason }
              : { status: 'failed', job: outcome.job, detail: outcome.detail },
        artifactIds,
      }
      await boss.send('oga.result', result, { singletonKey: `${req.taskId}:${req.job}:result` })
    },
  )

  const shutdown = async () => {
    console.log('[worker] stopping')
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
