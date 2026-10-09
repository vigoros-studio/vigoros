import { QUEUES, boss, stopBoss } from './boss'
import { env } from './env'
import { runTurn } from './turn'

/**
 * The runtime process. Any number of these can run; pg-boss hands each job to exactly one.
 * Turns are serialised per task by singleton key, so two runtimes never run the same task at once.
 */
const main = async () => {
  const e = env()
  const b = await boss()
  console.log(
    `[runtime ${e.RUNTIME_ID}] adapter=${e.MODEL_ADAPTER} cap=$${e.COMPANY_DAILY_CAP_USD}/day`,
  )

  await b.work<{ taskId: string }>(
    QUEUES.agentTurn,
    { batchSize: 1, pollingIntervalSeconds: 2 },
    async ([job]) => {
      if (!job) return
      await runTurn(job.data.taskId)
    },
  )

  await b.work<{ taskId: string; result: unknown }>(
    QUEUES.bunniResult,
    { batchSize: 1, pollingIntervalSeconds: 2 },
    async ([job]) => {
      if (!job) return
      // Phase 1: fold worker results back into the requesting task and continue the workflow.
      console.log('[runtime] bunni result for', job.data.taskId)
    },
  )

  const shutdown = async () => {
    console.log('[runtime] stopping')
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
