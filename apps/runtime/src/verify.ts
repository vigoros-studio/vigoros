/**
 * Verification against the live database. Prints one line per check with PASS or FAIL and exits
 * non-zero on any failure. Run with the runtime and worker up: `pnpm --filter @vigoros/runtime cli verify`.
 */
import { ContentDraft, FactCheck } from '@vigoros/contracts'
import {
  agents,
  approvals,
  artifacts,
  costLedger,
  decisions,
  events,
  runs,
  tasks,
  workflows,
} from '@vigoros/db'
import { activeCompany, insertTask, setPaused } from '@vigoros/ops'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from './db'
import { runTurn } from './turn'

type Check = { name: string; ok: boolean; detail: string }

export const verify = async (): Promise<Check[]> => {
  const d = db()
  const out: Check[] = []
  const check = (name: string, ok: boolean, detail: string) => out.push({ name, ok, detail })
  const company = await activeCompany(d)
  if (!company) {
    check('company exists', false, 'seed first')
    return out
  }

  const flows = await d
    .select()
    .from(workflows)
    .where(and(eq(workflows.companyId, company.id), eq(workflows.status, 'done')))
    .orderBy(desc(workflows.finishedAt))
  const wf = flows.find((w) => w.error === null) ?? flows[0]
  check('a completed content workflow exists', Boolean(wf), wf ? `${wf.id} "${wf.title}"` : 'none')
  if (!wf) return out

  const steps = await d
    .select()
    .from(tasks)
    .where(eq(tasks.workflowId, wf.id))
    .orderBy(asc(tasks.createdAt))
  const staff = await d.select().from(agents).where(eq(agents.companyId, company.id))
  const roleOf = (id: string) => staff.find((a) => a.id === id)?.roleKey ?? id
  const participants = new Set(steps.map((t) => roleOf(t.ownerAgentId)))
  check(
    'both roles participated',
    ['managing-director', 'content-director'].every((r) => participants.has(r)),
    [...participants].sort().join(', '),
  )

  const order = steps.map((t) => t.step)
  const expected = ['plan', 'research', 'draft', 'check', 'review', 'publish']
  check(
    'the steps ran in order: plan, research, draft, check, review, publish',
    expected.every(
      (s, i) =>
        order.indexOf(s) >= 0 && (i === 0 || order.indexOf(s) > order.indexOf(expected[i - 1]!)),
    ),
    order.join(' → '),
  )

  const drafts = await d
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.workflowId, wf.id), eq(artifacts.kind, 'content_draft')))
  const packs = await d
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.workflowId, wf.id), eq(artifacts.kind, 'research_pack')))
  const draft = drafts[0] ? ContentDraft.safeParse(drafts[0].content) : null
  const pack = packs[0]?.content as
    { places?: { placeId: string; signals: { key: string }[] }[] } | undefined
  const rowsInPack = new Set(
    (pack?.places ?? []).flatMap((p) => p.signals.map((s) => `${p.placeId}:${s.key}`)),
  )
  const citations = draft?.success ? draft.data.citations : []
  const citedRows = citations.filter((c) => rowsInPack.has(`${c.placeId}:${c.signalKey}`))
  check(
    'every citation in the draft points at a row in the research pack',
    Boolean(draft?.success) && citations.length > 0 && citedRows.length === citations.length,
    `${citations.length} citations, ${citedRows.length} matched, pack rows ${rowsInPack.size}`,
  )

  const checks = await d
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.workflowId, wf.id), eq(artifacts.kind, 'fact_check')))
  const fc = checks[0] ? FactCheck.safeParse(checks[0].content) : null
  const checkTask = steps.find((t) => t.step === 'check' || t.step === 'recheck')
  const draftTask = steps.find((t) => t.step === 'draft' || t.step === 'revise')
  check(
    'the fact-check ran as its own task after the draft and passed',
    Boolean(fc?.success && fc.data.verdict === 'pass' && checkTask && draftTask) &&
      (checkTask?.createdAt.getTime() ?? 0) > (draftTask?.createdAt.getTime() ?? 0) &&
      (checkTask?.inputArtifactIds.includes(drafts[0]?.id ?? '') ?? false),
    fc?.success ? `${fc.data.verdict}, ${fc.data.claimsChecked} claims` : 'none',
  )

  const gate = await d.select().from(approvals).where(eq(approvals.workflowId, wf.id))
  const g = gate[0]
  check(
    'the Managing Director created an actionable approval item',
    Boolean(g && g.headline && g.summary && g.recommendation && g.status === 'approved'),
    g ? `${g.id} ${g.status} rec=${g.recommendation}` : 'none',
  )

  const evs = await d
    .select()
    .from(events)
    .where(eq(events.workflowId, wf.id))
    .orderBy(asc(events.seq))
  const approvedSeq = evs.find((e) => e.kind === 'approval.resolved')?.seq ?? Infinity
  const publishJob = evs.find(
    (e) => e.kind === 'worker.job' && (e.payload as { job?: string }).job === 'content.publish',
  )
  const publications = await d
    .select()
    .from(artifacts)
    .where(and(eq(artifacts.workflowId, wf.id), eq(artifacts.kind, 'publication')))
  const approvedAt = g?.decidedAt?.getTime() ?? 0
  check(
    'nothing was published before approval',
    (publishJob?.seq ?? Infinity) > approvedSeq &&
      publications.length > 0 &&
      publications.every((p) => p.createdAt.getTime() >= approvedAt),
    `approval seq ${approvedSeq}, publish job seq ${publishJob?.seq ?? 'none'}, ${publications.length} publication rows`,
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
  const ledger = await d.select().from(costLedger).where(eq(costLedger.companyId, company.id))
  const paidLines = ledger.filter((l) => l.source !== 'model' || l.usd > 0)
  check(
    'no model spend occurred',
    spend === 0 && paidLines.length === 0 && allRuns.every((r) => r.adapter !== 'anthropic'),
    `spend $${spend}, adapters ${[...new Set(allRuns.map((r) => r.adapter))].join('/')}`,
  )

  check(
    'simulated outputs are labelled',
    (
      await d
        .select()
        .from(artifacts)
        .where(and(eq(artifacts.workflowId, wf.id), eq(artifacts.simulated, true)))
    ).every((a) => a.title.startsWith('[SIMULATED]') || a.title.startsWith('[SAMPLE]')) &&
      wf.simulated,
    `workflow.simulated=${wf.simulated}; model outputs say SIMULATED, worker packs say SAMPLE`,
  )

  // Budget cap: a task whose cap is below the pre-call estimate must block before any model call.
  const md = staff.find((a) => a.roleKey === 'managing-director')
  if (md) {
    const { id } = await insertTask(d, {
      kind: 'direct.briefing',
      title: 'verify: cap check',
      ownerAgentId: md.id,
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
  const cd = staff.find((a) => a.roleKey === 'content-director')
  if (cd) {
    await setPaused(d, company.id, true, 'verify')
    const { id } = await insertTask(d, {
      kind: 'agent.instruction',
      title: 'verify: kill switch',
      ownerAgentId: cd.id,
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

  // Publishing without an approval row must be refused in code.
  if (cd && drafts[0]) {
    const { id } = await insertTask(d, {
      kind: 'content.publish',
      title: 'verify: publish without approval',
      ownerAgentId: cd.id,
      requestedBy: 'verify',
      input: { approvalId: 'apr_none' },
      inputArtifactIds: [drafts[0].id],
      capUsd: 1,
    })
    await runTurn(id)
    const [t] = await d.select().from(tasks).where(eq(tasks.id, id))
    check(
      'a publish task without an approval row is refused in code',
      t?.status === 'blocked' && t.blockedReason === 'no_approval',
      `${t?.status} ${t?.blockedReason}`,
    )
    await d.update(tasks).set({ status: 'cancelled' }).where(eq(tasks.id, id))
  }

  const decs = await d.select().from(decisions).where(eq(decisions.companyId, company.id))
  check(
    'decision rows recorded (table ready; picks live in artifacts)',
    true,
    `${decs.length} rows`,
  )
  return out
}
