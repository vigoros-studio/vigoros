import { QUEUES, boss, stopBoss } from './boss'
import { env } from './env'
import { onBunniResult, runTurn } from './turn'
import { tick } from './workflow'

/**
 * The runtime process. Any number of these can run; pg-boss hands each job to exactly one, turns
 * are singleton-keyed per task, and the tick is idempotent, so restarts never duplicate work.
 */
const main = async () => {
  const e = env()
  const b = await boss()
  console.log(
    `[runtime ${e.RUNTIME_ID}] adapter=${e.MODEL_ADAPTER} cap=$${e.COMPANY_DAILY_CAP_USD}/day`,
  )

  await b.work<{ taskId: string }>(
    QUEUES.agentTurn,
    { batchSize: 1, pollingIntervalSeconds: 1 },
    async ([job]) => {
      if (!job) return
      await runTurn(job.data.taskId)
    },
  )

  await b.work<Parameters<typeof onBunniResult>[0]>(
    QUEUES.bunniResult,
    { batchSize: 1, pollingIntervalSeconds: 1 },
    async ([job]) => {
      if (!job) return
      await onBunniResult(job.data)
    },
  )

  let ticking = false
  const heartbeat = setInterval(async () => {
    if (ticking) return
    ticking = true
    try {
      const r = await tick()
      if (r.enqueued)
        console.log(`[runtime] tick: ${r.advanced} workflows, ${r.enqueued} turns enqueued`)
    } catch (err) {
      console.error('[runtime] tick failed', err)
    } finally {
      ticking = false
    }
  }, 3000)

  const shutdown = async () => {
    console.log('[runtime] stopping')
    clearInterval(heartbeat)
    await stopBoss()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
