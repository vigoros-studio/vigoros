import { env } from './env'
import { PathGuard } from './guard'
import { runJob } from './jobs'

/** Runs one job locally without the queue: `cli <job> '<json input>'`. Paid jobs are still refused. */
const [job, json] = process.argv.slice(2)
if (!job) {
  console.log('usage: cli <job> [json-input]')
  process.exit(1)
}
const guard = new PathGuard(env().BUNNI_ROOT)
const result = runJob(
  guard,
  { paidJobsEnabled: env().PAID_JOBS_ENABLED },
  {
    job,
    taskId: 'tsk_cli',
    runId: null,
    requestedBy: 'founder',
    input: json ? JSON.parse(json) : {},
  },
)
if (result.status === 'ok' && job === 'assets.index') {
  const out = result.output as { assets: { path: string }[] }
  console.log(`${out.assets.length} assets`)
  for (const a of out.assets) console.log(' ', a.path)
} else {
  console.log(JSON.stringify(result, null, 2))
}
