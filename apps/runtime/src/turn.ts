import {
  DirectorPlan,
  TaskStatus,
  newId,
  type Acknowledgement,
  type ContentDraft,
  type EditorialReview,
  type Effort,
  type ModelId,
  type WorkerJobRequest,
  type WorkerJobResult,
} from '@vigoros/contracts'
import {
  agents,
  approvals,
  artifacts,
  companies,
  costLedger,
  departments,
  messages,
  runs,
  tasks,
  workflows,
} from '@vigoros/db'
import {
  checkBudget,
  checkLimits,
  costOf,
  estimateTurnUsd,
  fingerprint,
  isLooping,
  statusAfter,
  transition,
  type CapCheck,
} from '@vigoros/engine'
import { emit } from '@vigoros/ops'
import { roleByKey } from '@vigoros/org'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { QUEUES, boss } from './boss'
import { db } from './db'
import { env } from './env'
import { WORKER_KINDS, taskKind } from './kinds'
import { adapter } from './model'
import { advance, startContentWorkflow } from './workflow'

const today = () => new Date().toISOString().slice(0, 10)

const spentToday = async (where: ReturnType<typeof eq>): Promise<number> => {
  const [row] = await db()
    .select({ usd: sql<number>`coalesce(sum(${costLedger.usd}), 0)` })
    .from(costLedger)
    .where(and(where, eq(costLedger.day, today())))
  return Number(row?.usd ?? 0)
}

type TaskRow = typeof tasks.$inferSelect
type AgentRow = typeof agents.$inferSelect
type DepartmentRow = typeof departments.$inferSelect

/**
 * One agent turn against one task. Every guard runs before the model is called; every outcome is
 * a row. A turn for a task that is no longer queued is a no-op, which is what makes restarts safe.
 */
export const runTurn = async (taskId: string): Promise<void> => {
  const d = db()
  const [task] = await d.select().from(tasks).where(eq(tasks.id, taskId))
  if (!task) throw new Error(`no task ${taskId}`)
  if (task.status !== 'queued') return
  const taskStatus = TaskStatus.parse(task.status)
  const [agent] = await d.select().from(agents).where(eq(agents.id, task.ownerAgentId))
  if (!agent) throw new Error(`no agent ${task.ownerAgentId}`)
  const [company] = await d.select().from(companies).where(eq(companies.id, task.companyId))
  const [department] = await d
    .select()
    .from(departments)
    .where(eq(departments.id, agent.departmentId))
  if (!company || !department) throw new Error('company or department missing')
  const role = roleByKey(agent.roleKey)
  if (!role) throw new Error(`no role ${agent.roleKey}`)
  if (company.paused || department.paused) {
    const reason = company.paused ? 'company_paused' : 'department_paused'
    await d
      .update(tasks)
      .set({
        status: transition(taskStatus, 'blocked'),
        blockedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id))
    await emit(d, {
      companyId: task.companyId,
      subjectId: task.subjectId,
      agentId: agent.id,
      departmentId: department.id,
      taskId: task.id,
      workflowId: task.workflowId,
      kind: 'task.status',
      subject: `tasks:${task.id}`,
      caption: `${agent.name} is waiting: ${reason.replace('_', ' ')}`,
      payload: { status: 'blocked', reason },
    })
    return
  }
  if (WORKER_KINDS.has(task.kind)) return dispatchToWorker(task, agent, department)
  const kind = taskKind(task.kind)
  if (kind.roleKey !== '*' && kind.roleKey !== agent.roleKey)
    throw new Error(`task kind ${task.kind} is not for role ${agent.roleKey}`)
  const base = {
    companyId: task.companyId,
    subjectId: task.subjectId,
    agentId: agent.id,
    departmentId: department.id,
    taskId: task.id,
    workflowId: task.workflowId,
  }

  const block = async (reason: string, caption: string) => {
    await d
      .update(tasks)
      .set({
        status: transition(taskStatus, 'blocked'),
        blockedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id))
    await emit(d, {
      ...base,
      kind: 'task.status',
      subject: `tasks:${task.id}`,
      caption,
      payload: { status: 'blocked', reason },
    })
  }

  const limits = checkLimits(
    { maxTurnsPerTask: role.maxTurnsPerTask, maxChildTasks: role.maxChildTasks },
    task.turns,
    0,
  )
  if (!limits.ok) return block(limits.reason, `${agent.name} hit ${limits.reason} on ${task.title}`)

  const recent = await d
    .select({ f: runs.outputFingerprint })
    .from(runs)
    .where(eq(runs.taskId, task.id))
    .orderBy(desc(runs.startedAt))
    .limit(3)
  if (isLooping(recent.map((r) => r.f ?? '')))
    return block('loop_detected', `${agent.name} was looping on ${task.title}`)

  const inputArtifacts = task.inputArtifactIds.length
    ? await d
        .select({
          id: artifacts.id,
          kind: artifacts.kind,
          title: artifacts.title,
          content: artifacts.content,
        })
        .from(artifacts)
        .where(inArray(artifacts.id, task.inputArtifactIds))
    : []
  const ordered = task.inputArtifactIds
    .map((id) => inputArtifacts.find((a) => a.id === id))
    .filter((a): a is (typeof inputArtifacts)[number] => Boolean(a))
  const user = kind.user(
    task.input,
    ordered.map((a) => ({ kind: a.kind, title: a.title, content: a.content })),
  )
  const stable = role.prompt
  const volatile = `Today is ${today()}. You are ${agent.name}, ${agent.title}. Task ${task.id}: ${task.title}.`
  const model = agent.model as ModelId
  const effort: Effort = role.effort
  const promptTokens = Math.ceil((stable.length + volatile.length + user.length) / 4)
  const estimate = estimateTurnUsd(model, promptTokens, kind.maxOutputTokens)

  const caps: CapCheck[] = [
    { level: 'run', capUsd: role.perRunCapUsd, spentUsd: 0 },
    { level: 'task', capUsd: task.capUsd, spentUsd: task.spentUsd },
    {
      level: 'department_day',
      capUsd: department.dailyCapUsd,
      spentUsd: await spentToday(eq(costLedger.departmentId, department.id)),
    },
    {
      level: 'company_day',
      capUsd: Math.min(company.dailyCapUsd, env().COMPANY_DAILY_CAP_USD),
      spentUsd: await spentToday(eq(costLedger.companyId, company.id)),
    },
  ]
  const verdict = checkBudget(estimate, caps)
  if (!verdict.ok) {
    await emit(d, {
      ...base,
      kind: 'budget.blocked',
      subject: `tasks:${task.id}`,
      caption: `${agent.name} blocked by ${verdict.level} cap`,
      payload: { ...verdict },
    })
    return block(
      `over_budget:${verdict.level}`,
      `${agent.name} needs a higher ${verdict.level} cap for ${task.title}`,
    )
  }

  const which = adapter()
  const runId = newId('run')
  await d
    .insert(runs)
    .values({ id: runId, taskId: task.id, agentId: agent.id, model, effort, adapter: which.name })
  await d
    .update(tasks)
    .set({
      status: transition(taskStatus, 'running'),
      turns: task.turns + 1,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, task.id))
  await emit(d, {
    ...base,
    kind: 'run.started',
    subject: `runs:${runId}`,
    caption: `${agent.name} started ${task.title}`,
    payload: {
      model,
      effort,
      adapter: which.name,
      reviewing: kind.reviewing,
      estimateUsd: estimate,
    },
  })

  try {
    const result = await which.complete({
      model,
      effort,
      system: { stable, volatile },
      user,
      schema: kind.schema,
      schemaName: kind.schemaName,
      webSearch: kind.webSearch && role.tools.includes('web_search'),
      maxOutputTokens: kind.maxOutputTokens,
    })
    const usd = costOf(result.usage, model)
    const fp = fingerprint(result.output)
    const simulated = which.name === 'fake'
    const artifactId = newId('artifact')
    await d.insert(artifacts).values({
      id: artifactId,
      companyId: task.companyId,
      subjectId: task.subjectId,
      taskId: task.id,
      workflowId: task.workflowId,
      runId,
      producedBy: agent.id,
      kind: kind.artifactKind,
      title: `${simulated ? '[SIMULATED] ' : ''}${kind.schemaName}: ${task.title}`,
      simulated,
      content: result.output,
    })
    await d.insert(costLedger).values({
      id: newId('cost'),
      companyId: task.companyId,
      subjectId: task.subjectId,
      departmentId: department.id,
      agentId: agent.id,
      taskId: task.id,
      runId,
      source: 'model',
      description: `${model} turn (${which.name})`,
      usd,
      day: today(),
    })
    await d
      .update(runs)
      .set({
        status: 'succeeded',
        request: result.request,
        response: result.response,
        outputFingerprint: fp,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cacheReadTokens: result.usage.cacheReadTokens,
        cacheWriteTokens: result.usage.cacheWriteTokens,
        costUsd: usd,
        summary: `${kind.schemaName} produced${simulated ? ' by the fake adapter' : ''}`,
        finishedAt: new Date(),
      })
      .where(eq(runs.id, runId))
    const next = statusAfter({ kind: 'completed' })
    await d
      .update(tasks)
      .set({
        status: transition('running', next),
        output: { artifactId },
        spentUsd: task.spentUsd + usd,
        updatedAt: new Date(),
        finishedAt: new Date(),
      })
      .where(eq(tasks.id, task.id))
    if (task.workflowId) {
      await d
        .update(workflows)
        .set({
          spentUsd: sql`${workflows.spentUsd} + ${usd}`,
          ...(simulated ? { simulated: true } : {}),
          updatedAt: new Date(),
        })
        .where(eq(workflows.id, task.workflowId))
    }
    await emit(d, {
      ...base,
      kind: 'artifact.created',
      subject: `artifacts:${artifactId}`,
      caption: `${agent.name} produced ${simulated ? 'a simulated ' : ''}${kind.artifactKind.replace('_', ' ')}`,
      payload: { artifactId, kind: kind.artifactKind, simulated },
    })
    await emit(d, {
      ...base,
      kind: 'run.finished',
      subject: `runs:${runId}`,
      caption: `${agent.name} finished ${task.title}`,
      payload: { usd, adapter: which.name, status: next },
    })
    await applyInstruction(task, agent, kind.schemaName, result.output)
    if (task.workflowId) await advance(task.workflowId)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await d
      .update(runs)
      .set({ status: 'failed', error: message, finishedAt: new Date() })
      .where(eq(runs.id, runId))
    const next = statusAfter({ kind: 'failed', retryable: task.turns + 1 < role.maxTurnsPerTask })
    await d
      .update(tasks)
      .set({ status: transition('running', next), blockedReason: message, updatedAt: new Date() })
      .where(eq(tasks.id, task.id))
    await emit(d, {
      ...base,
      kind: 'run.finished',
      subject: `runs:${runId}`,
      caption: `${agent.name} failed ${task.title}`,
      payload: { error: message, status: next },
    })
    if (task.workflowId && next === 'failed') await advance(task.workflowId)
    throw e
  }
}

/** Founder instructions: the Managing Director's plan may start a workflow; everyone else just answers. */
const applyInstruction = async (
  task: TaskRow,
  agent: AgentRow,
  schemaName: string,
  output: unknown,
) => {
  const d = db()
  if (schemaName === 'DirectorPlan') {
    const plan = DirectorPlan.parse(output)
    await d.insert(messages).values({
      id: newId('message'),
      taskId: task.id,
      fromId: agent.id,
      toId: 'founder',
      body: plan.summary,
    })
    await emit(d, {
      kind: 'message.sent',
      companyId: task.companyId,
      subjectId: task.subjectId,
      agentId: agent.id,
      departmentId: agent.departmentId,
      taskId: task.id,
      workflowId: null,
      subject: `tasks:${task.id}`,
      caption: `Managing Director to founder: ${plan.summary.slice(0, 120)}`,
      payload: { startWorkflow: plan.startWorkflow },
    })
    if (plan.startWorkflow) {
      const [cd] = await d
        .select()
        .from(agents)
        .where(and(eq(agents.companyId, task.companyId), eq(agents.roleKey, 'content-director')))
      const subjectId = cd?.subjectId ?? null
      if (subjectId)
        await startContentWorkflow({
          subjectId,
          startedBy: agent.id,
          title: plan.focus.slice(0, 80) || 'Piece',
          input: {
            focus: plan.focus,
            guidance: plan.guidance,
            surface: plan.surface,
            audience: plan.audience,
            places: plan.places,
          },
          capUsd: 3,
        })
    }
  } else if (schemaName === 'Acknowledgement') {
    const ack = output as Acknowledgement
    await d.insert(messages).values({
      id: newId('message'),
      taskId: task.id,
      fromId: agent.id,
      toId: 'founder',
      body: ack.summary,
    })
    await emit(d, {
      kind: 'message.sent',
      companyId: task.companyId,
      subjectId: task.subjectId,
      agentId: agent.id,
      departmentId: agent.departmentId,
      taskId: task.id,
      workflowId: null,
      subject: `tasks:${task.id}`,
      caption: `${agent.name} to founder: ${ack.summary.slice(0, 120)}`,
      payload: { needsFounder: ack.needsFounder },
    })
  }
}

/**
 * Worker steps. Not model turns: the task sends a typed job to the OneGoodArea worker and waits.
 * `research.pack` fetches the signals a writer may cite. `content.publish` re-checks the approval
 * row here, so an unapproved piece can never reach the outbox even if a task row were made by hand.
 */
const dispatchToWorker = async (task: TaskRow, agent: AgentRow, department: DepartmentRow) => {
  const d = db()
  const base = {
    companyId: task.companyId,
    subjectId: task.subjectId,
    agentId: agent.id,
    departmentId: department.id,
    taskId: task.id,
    workflowId: task.workflowId,
  }
  let job: WorkerJobRequest['job']
  let input: Record<string, unknown>
  let caption: string
  if (task.kind === 'research.pack') {
    job = 'oga.research'
    input = {
      places: task.input['places'] ?? [],
      grain: task.input['grain'] ?? 'neighbourhood',
      changesSinceDays: task.input['changesSinceDays'] ?? 60,
    }
    caption = `${agent.name} asked the worker for the research pack`
  } else if (task.kind === 'content.publish') {
    const approvalId = String(task.input['approvalId'] ?? '')
    const [approval] = approvalId
      ? await d.select().from(approvals).where(eq(approvals.id, approvalId))
      : []
    if (!approval || approval.status !== 'approved' || approval.workflowId !== task.workflowId) {
      await d
        .update(tasks)
        .set({ status: 'blocked', blockedReason: 'no_approval', updatedAt: new Date() })
        .where(eq(tasks.id, task.id))
      await emit(d, {
        ...base,
        kind: 'task.status',
        subject: `tasks:${task.id}`,
        caption: `${agent.name} refused to publish without founder approval`,
        payload: { status: 'blocked', reason: 'no_approval' },
      })
      return
    }
    const draftId = task.inputArtifactIds[0]
    const reviewId = task.inputArtifactIds[1]
    const [draft] = draftId ? await d.select().from(artifacts).where(eq(artifacts.id, draftId)) : []
    const [review] = reviewId
      ? await d.select().from(artifacts).where(eq(artifacts.id, reviewId))
      : []
    if (!draft) {
      await d
        .update(tasks)
        .set({ status: 'failed', blockedReason: 'no_draft', updatedAt: new Date() })
        .where(eq(tasks.id, task.id))
      return
    }
    const content = draft.content as ContentDraft
    const edited = (review?.content as EditorialReview | undefined)?.revisedBody ?? null
    const payload = (approval.payload ?? {}) as { slug?: string }
    job = 'content.publish'
    input = {
      artifactId: draft.id,
      surface: content.surface,
      slug: payload.slug ?? draft.id.toLowerCase(),
      approvalId: approval.id,
      ...(edited ? { revisedBody: edited } : {}),
      reviewArtifactId: review?.id ?? null,
    }
    caption = `${agent.name} sent the approved piece to the outbox`
  } else {
    throw new Error(`not a worker kind: ${task.kind}`)
  }
  const runId = newId('run')
  await d.insert(runs).values({
    id: runId,
    taskId: task.id,
    agentId: agent.id,
    model: 'none',
    effort: 'low',
    adapter: 'worker',
    summary: `${job} requested`,
  })
  await d
    .update(tasks)
    .set({
      status: 'waiting',
      turns: task.turns + 1,
      updatedAt: new Date(),
      output: { stage: job, runId },
    })
    .where(eq(tasks.id, task.id))
  const b = await boss()
  const request: WorkerJobRequest = {
    job,
    taskId: task.id,
    runId,
    requestedBy: agent.id,
    input,
  }
  await b.send(QUEUES.worker, request, { singletonKey: `${task.id}:${job}` })
  await emit(d, {
    ...base,
    kind: 'worker.job',
    subject: `oga:${job}`,
    caption,
    payload: { job, input: job === 'oga.research' ? input : { ...input, revisedBody: undefined } },
  })
}

/** Results from the OneGoodArea worker fold back into the waiting task. */
export const onWorkerResult = async (msg: WorkerJobResult) => {
  const d = db()
  const [task] = await d.select().from(tasks).where(eq(tasks.id, msg.taskId))
  if (!task || !WORKER_KINDS.has(task.kind) || task.status !== 'waiting') return
  const [agent] = await d.select().from(agents).where(eq(agents.id, task.ownerAgentId))
  const base = {
    companyId: task.companyId,
    subjectId: task.subjectId,
    agentId: task.ownerAgentId,
    departmentId: agent?.departmentId ?? null,
    taskId: task.id,
    workflowId: task.workflowId,
  }
  const { result } = msg
  if (result.status !== 'ok') {
    const detail = result.status === 'failed' ? result.detail : result.reason
    await d
      .update(tasks)
      .set({
        status: 'failed',
        blockedReason: `${result.job}: ${result.status} ${detail}`.trim(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id))
    if (msg.runId)
      await d
        .update(runs)
        .set({ status: 'failed', error: detail, finishedAt: new Date() })
        .where(eq(runs.id, msg.runId))
    await emit(d, {
      ...base,
      kind: 'task.status',
      subject: `tasks:${task.id}`,
      caption: `Worker ${result.status} ${result.job}: ${detail.slice(0, 120)}`,
      payload: { status: 'failed', detail },
    })
    if (task.workflowId) await advance(task.workflowId)
    return
  }
  const artifactId = msg.artifactIds[0] ?? null
  if (msg.runId)
    await d
      .update(runs)
      .set({ status: 'succeeded', summary: `${result.job} done`, finishedAt: new Date() })
      .where(eq(runs.id, msg.runId))
  await d
    .update(tasks)
    .set({
      status: 'done',
      output: { ...(task.output ?? {}), artifactId, artifactIds: msg.artifactIds },
      updatedAt: new Date(),
      finishedAt: new Date(),
    })
    .where(eq(tasks.id, task.id))
  await emit(d, {
    ...base,
    kind: 'task.status',
    subject: `tasks:${task.id}`,
    caption: `${agent?.name ?? 'Worker'} received ${result.job.replace('.', ' ')} from the worker`,
    payload: { status: 'done', job: result.job, artifactIds: msg.artifactIds },
  })
  if (task.workflowId) await advance(task.workflowId)
}
