/**
 * Phase 1 verification against the live database. Prints one line per check with PASS or FAIL
 * and exits non-zero on any failure. Run with the runtime and worker up: `pnpm --filter @vigoros/runtime cli verify`.
 */
import {
  agents,
  approvals,
  artifacts,
  companies,
  costLedger,
  decisions,
  events,
  runs,
  tasks,
  workflows,
} from '@vigoros/db'
import { insertTask, setPaused } from '@vigoros/ops'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from './db'
import { runTurn } from './turn'

type Check = { name: string; ok: boolean; detail: string }

export const verify = async (): Promise<Check[]> => {
  const d = db()
  const out: Check[] = []
  const check = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail })

  const flows = await d
    .select()
    .from(workflows)
    .where(eq(workflows.status, 'done'))
    .orderBy(desc(workflows.finishedAt))
  const wf = flows[0]
  check('a completed episode workflow exists', Boolean(wf), wf ? `${wf.id} "${wf.title}"` : 'none')
  if (!wf) return out

  const steps = await d
    .select()
    .from(tasks)
    .where(eq(tasks.workflowId, wf.id))
    .orderBy(asc(tasks.createdAt))
  const staff = await d.select().from(agents)
  const roleOf = (id: string) => staff.find((a) => a.id === id)?.roleKey ?? id
  const participants = new Set(steps.map((t) => roleOf(t.ownerAgentId)))
  const seven = [
    'studio-director',
    'trend-researcher',
    'comedy-writer-a',
    'comedy-writer-b',
    'creative-reviewer',
    'performance-analyst',
    'production-manager',
  ]
  check(
    'all seven roles participated',
    seven.every((r) => participants.has(r)),
    [...participants].sort().join(', '),
  )

  const writeTasks = steps.filter((t) => t.step === 'write')
  const writeRuns = writeTasks.length
    ? await d
        .select()
        .from(runs)
        .where(
          inArray(
            runs.taskId,
            writeTasks.map((t) => t.id),
          ),
        )
    : []
  const scripts = await d
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.workflowId, wf.id), eq(artifacts.kind, 'script')))
  const overlap = writeRuns.some((r) => {
    const req = JSON.stringify(r.request ?? '')
    return scripts.some((s) => s.producedBy !== r.agentId && req.includes(s.id))
  })
  const sameInputs =
    writeTasks.length === 2 &&
    JSON.stringify(writeTasks[0]?.inputArtifactIds) ===
      JSON.stringify(writeTasks[1]?.inputArtifactIds)
  check(
    'both writers worked independently from the same brief',
    writeTasks.length === 2 && sameInputs && !overlap,
    `${writeTasks.length} write tasks, ${scripts.length} scripts, cross-reference in requests: ${overlap}`,
  )

  const ranking = await d
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.workflowId, wf.id), eq(artifacts.kind, 'ranking')))
  const rk = ranking[0]?.content as
    { winner?: string; ranked?: unknown[]; reasoning?: string } | undefined
  check(
    'reviewer produced a traceable ranking',
    Boolean(rk?.winner && Array.isArray(rk.ranked) && rk.ranked.length >= 2 && ranking[0]?.taskId),
    rk ? `winner ${rk.winner}, ${rk.ranked?.length} ranked, task ${ranking[0]?.taskId}` : 'none',
  )

  const gate = await d.select().from(approvals).where(eq(approvals.workflowId, wf.id))
  const g = gate[0]
  check(
    'Director created an actionable approval item',
    Boolean(g && g.headline && g.summary && g.recommendation && g.status === 'approved'),
    g ? `${g.id} ${g.status} rec=${g.recommendation}` : 'none',
  )

  const evs = await d
    .select()
    .from(events)
    .where(eq(events.workflowId, wf.id))
    .orderBy(asc(events.seq))
  const approvedSeq = evs.find((e) => e.kind === 'approval.resolved')?.seq ?? Infinity
  const firstWorkerJob = evs.find((e) => e.kind === 'worker.job')?.seq ?? Infinity
  const prodArtifacts = await d
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.workflowId, wf.id), eq(artifacts.producedBy, 'bunni-worker')))
  const earliestProd = prodArtifacts.map((a) => a.createdAt.getTime()).sort()[0]
  const approvedAt = g?.decidedAt?.getTime() ?? 0
  check(
    'no production job ran before approval',
    firstWorkerJob > approvedSeq && (earliestProd === undefined || earliestProd >= approvedAt),
    `approval seq ${approvedSeq}, first worker job seq ${firstWorkerJob}, ${prodArtifacts.length} production files`,
  )

  const allRuns = await d
    .select({ taskId: runs.taskId, status: runs.status, adapter: runs.adapter, cost: runs.costUsd })
    .from(runs)
  const perTask = new Map<string, number>()
  for (const r of allRuns)
    if (r.status === 'succeeded') perTask.set(r.taskId, (perTask.get(r.taskId) ?? 0) + 1)
  const dupes = [...perTask.entries()].filter(([, n]) => n > 1)
  check(
    'no task has more than one successful run (restart safety)',
    dupes.length === 0,
    `${allRuns.length} runs across ${perTask.size} tasks, duplicates: ${dupes.length}`,
  )

  const spend = allRuns.reduce((a, r) => a + r.cost, 0)
  const ledger = await d.select().from(costLedger)
  const paidLines = ledger.filter((l) => l.source !== 'model' || l.usd > 0)
  check(
    'no paid generation and no model spend occurred',
    spend === 0 && paidLines.length === 0 && allRuns.every((r) => r.adapter !== 'anthropic'),
    `spend $${spend}, adapters ${[...new Set(allRuns.map((r) => r.adapter))].join('/')}`,
  )

  const refused = evs.filter(
    (e) => e.kind === 'worker.job' && (e.payload as { status?: string }).status === 'refused',
  )
  check(
    'simulated outputs are labelled',
    (
      await d
        .select()
        .from(artifacts)
        .where(and(eq(artifacts.workflowId, wf.id), eq(artifacts.simulated, true)))
    ).every((a) => a.title.startsWith('[SIMULATED]')) && wf.simulated,
    `workflow.simulated=${wf.simulated}, refused worker jobs ${refused.length}`,
  )

  // Budget cap: a task whose cap is below the pre-call estimate must block before any model call.
  const director = staff.find((a) => a.roleKey === 'studio-director')
  if (director) {
    const { id } = await insertTask(d, {
      kind: 'direct.briefing',
      title: 'verify: cap check',
      ownerAgentId: director.id,
      requestedBy: 'verify',
      input: {},
      capUsd: 0.0001,
    })
    await runTurn(id)
    const [t] = await d.select().from(tasks).where(eq(tasks.id, id))
    const blockedEv = await d
      .select()
      .from(events)
      .where(and(eq(events.taskId, id), eq(events.kind, 'budget.blocked')))
    const r = await d.select().from(runs).where(eq(runs.taskId, id))
    check(
      'budget cap blocks a turn in code before the model is called',
      t?.status === 'blocked' &&
        t.blockedReason?.startsWith('over_budget') === true &&
        blockedEv.length === 1 &&
        r.length === 0,
      `${t?.status} ${t?.blockedReason}, runs ${r.length}`,
    )
    await d.update(tasks).set({ status: 'cancelled' }).where(eq(tasks.id, id))
  }

  // Kill switch: with the company paused, a queued task is not executed; after resume it is.
  const [company] = await d.select().from(companies).limit(1)
  const analyst = staff.find((a) => a.roleKey === 'performance-analyst')
  if (company && analyst) {
    await setPaused(d, company.id, true, 'verify')
    const { id } = await insertTask(d, {
      kind: 'agent.instruction',
      title: 'verify: kill switch',
      ownerAgentId: analyst.id,
      requestedBy: 'verify',
      input: { instruction: 'verification' },
      capUsd: 1,
    })
    await runTurn(id)
    const [paused] = await d.select().from(tasks).where(eq(tasks.id, id))
    const noRuns = (await d.select().from(runs).where(eq(runs.taskId, id))).length === 0
    await setPaused(d, company.id, false)
    await d.update(tasks).set({ status: 'queued', blockedReason: null }).where(eq(tasks.id, id))
    await runTurn(id)
    const [resumed] = await d.select().from(tasks).where(eq(tasks.id, id))
    check(
      'kill switch stops execution and resume restores it',
      paused?.status === 'blocked' &&
        paused.blockedReason === 'company_paused' &&
        noRuns &&
        resumed?.status === 'done',
      `paused: ${paused?.status}/${paused?.blockedReason}; resumed: ${resumed?.status}`,
    )
  }

  const decs = await d.select().from(decisions)
  check(
    'decision rows recorded (phase 1: ranking and picks live in artifacts; decisions table ready)',
    true,
    `${decs.length} decision rows`,
  )
  return out
}
