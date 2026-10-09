import {
  DirectorPlan,
  TaskStatus,
  newId,
  type Acknowledgement,
  type EpisodeScript,
  type Effort,
  type ModelId,
} from '@vigoros/contracts'
import {
  agents,
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
import { taskKind } from './kinds'
import { adapter } from './model'
import { advance, startEpisodeWorkflow } from './workflow'

const today = () => new Date().toISOString().slice(0, 10)

const spentToday = async (where: ReturnType<typeof eq>): Promise<number> => {
  const [row] = await db()
    .select({ usd: sql<number>`coalesce(sum(${costLedger.usd}), 0)` })
    .from(costLedger)
    .where(and(where, eq(costLedger.day, today())))
  return Number(row?.usd ?? 0)
}

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
      characterId: task.characterId,
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
  if (task.kind === 'produce.dispatch') return dispatchToProduction(task, agent, department)
  const kind = taskKind(task.kind)
  if (
    kind.roleKey !== '*' &&
    kind.roleKey !== agent.roleKey &&
    !(task.kind === 'write.script' && agent.roleKey === 'comedy-writer-b')
  ) {
    throw new Error(`task kind ${task.kind} is not for role ${agent.roleKey}`)
  }
  const base = {
    companyId: task.companyId,
    characterId: task.characterId,
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
    const candidate =
      typeof task.input['candidate'] === 'string' ? ` (${task.input['candidate']})` : ''
    await d.insert(artifacts).values({
      id: artifactId,
      companyId: task.companyId,
      characterId: task.characterId,
      taskId: task.id,
      workflowId: task.workflowId,
      runId,
      producedBy: agent.id,
      kind: kind.artifactKind,
      title: `${simulated ? '[SIMULATED] ' : ''}${kind.schemaName}${candidate}: ${task.title}`,
      simulated,
      content: result.output,
    })
    await d.insert(costLedger).values({
      id: newId('cost'),
      companyId: task.companyId,
      characterId: task.characterId,
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
      caption: `${agent.name} produced ${simulated ? 'a simulated ' : ''}${kind.artifactKind}`,
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

/** Founder instructions: the Director's plan may start a workflow; everyone else just answers. */
const applyInstruction = async (
  task: typeof tasks.$inferSelect,
  agent: typeof agents.$inferSelect,
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
      characterId: task.characterId,
      agentId: agent.id,
      departmentId: agent.departmentId,
      taskId: task.id,
      workflowId: null,
      subject: `tasks:${task.id}`,
      caption: `Director to founder: ${plan.summary.slice(0, 120)}`,
      payload: { startWorkflow: plan.startWorkflow },
    })
    if (plan.startWorkflow) {
      const [bunni] = await d
        .select()
        .from(agents)
        .where(and(eq(agents.roleKey, 'trend-researcher')))
      const characterId = bunni?.characterId ?? null
      if (characterId)
        await startEpisodeWorkflow({
          characterId,
          startedBy: agent.id,
          title: plan.focus.slice(0, 80) || 'Episode',
          input: { focus: plan.focus, guidance: plan.guidance, returnCount: plan.returnCount },
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
      characterId: task.characterId,
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
 * The production step. Not a model turn: the Production Manager's task sends the approved script
 * to the Bunni worker and waits. The approval is re-checked here, so an unapproved concept can
 * never reach the production folder even if a task row were created by hand.
 */
const dispatchToProduction = async (
  task: typeof tasks.$inferSelect,
  agent: typeof agents.$inferSelect,
  department: typeof departments.$inferSelect,
) => {
  const d = db()
  const base = {
    companyId: task.companyId,
    characterId: task.characterId,
    agentId: agent.id,
    departmentId: department.id,
    taskId: task.id,
    workflowId: task.workflowId,
  }
  const approvalId = String(task.input['approvalId'] ?? '')
  const { approvals } = await import('@vigoros/db')
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
      caption: `${agent.name} refused to dispatch without founder approval`,
      payload: { status: 'blocked', reason: 'no_approval' },
    })
    return
  }
  const scriptId = task.inputArtifactIds[1] ?? task.inputArtifactIds[0]
  const briefId = task.inputArtifactIds[0]
  const [script] = scriptId
    ? await d.select().from(artifacts).where(eq(artifacts.id, scriptId))
    : []
  const [brief] = briefId ? await d.select().from(artifacts).where(eq(artifacts.id, briefId)) : []
  if (!script) {
    await d
      .update(tasks)
      .set({ status: 'failed', blockedReason: 'no_script', updatedAt: new Date() })
      .where(eq(tasks.id, task.id))
    return
  }
  const content = script.content as EpisodeScript
  const slug = content.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .padEnd(3, 'x')
  const briefText =
    typeof (brief?.content as { brief?: string } | undefined)?.brief === 'string'
      ? (brief?.content as { brief: string }).brief
      : ''
  const runId = newId('run')
  await d.insert(runs).values({
    id: runId,
    taskId: task.id,
    agentId: agent.id,
    model: 'none',
    effort: 'low',
    adapter: 'worker',
    summary: 'episode.create requested',
  })
  await d
    .update(tasks)
    .set({
      status: 'waiting',
      turns: task.turns + 1,
      updatedAt: new Date(),
      output: { stage: 'episode.create', runId },
    })
    .where(eq(tasks.id, task.id))
  const b = await boss()
  await b.send(
    QUEUES.bunni,
    {
      job: 'episode.create',
      taskId: task.id,
      runId,
      requestedBy: agent.id,
      input: {
        slug,
        brief: `${briefText}${script.simulated ? '\n\n(Script produced by the fake adapter: simulated creative work.)' : ''}`,
        script: content,
        approvalId: approval.id,
      },
    },
    { singletonKey: `${task.id}:episode.create` },
  )
  await emit(d, {
    ...base,
    kind: 'worker.job',
    subject: `bunni:episode.create`,
    caption: `${agent.name} sent the approved script to production`,
    payload: { job: 'episode.create', slug, approvalId: approval.id },
  })
}

/** Results from the Bunni worker fold back into the Production Manager's task. */
export const onBunniResult = async (msg: {
  taskId: string
  runId: string | null
  result: { status: string; job: string; output?: unknown; detail?: string; reason?: string }
  artifactIds: string[]
}) => {
  const d = db()
  const [task] = await d.select().from(tasks).where(eq(tasks.id, msg.taskId))
  if (!task || task.kind !== 'produce.dispatch' || task.status !== 'waiting') return
  const [agent] = await d.select().from(agents).where(eq(agents.id, task.ownerAgentId))
  const base = {
    companyId: task.companyId,
    characterId: task.characterId,
    agentId: task.ownerAgentId,
    departmentId: agent?.departmentId ?? null,
    taskId: task.id,
    workflowId: task.workflowId,
  }
  const { result } = msg
  if (result.status !== 'ok') {
    await d
      .update(tasks)
      .set({
        status: 'failed',
        blockedReason:
          `${result.job}: ${result.reason ?? result.status} ${result.detail ?? ''}`.trim(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id))
    if (msg.runId)
      await d
        .update(runs)
        .set({ status: 'failed', error: result.detail ?? result.status, finishedAt: new Date() })
        .where(eq(runs.id, msg.runId))
    await emit(d, {
      ...base,
      kind: 'task.status',
      subject: `tasks:${task.id}`,
      caption: `Production worker ${result.status} ${result.job}`,
      payload: { status: 'failed', detail: result.detail ?? null },
    })
    if (task.workflowId) await advance(task.workflowId)
    return
  }
  if (result.job === 'episode.create') {
    const out = result.output as { episode: string }
    await d
      .update(tasks)
      .set({
        output: {
          ...(task.output ?? {}),
          stage: 'episode.package',
          episode: out.episode,
          createArtifactIds: msg.artifactIds,
        },
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id))
    const b = await boss()
    await b.send(
      QUEUES.bunni,
      {
        job: 'episode.package',
        taskId: task.id,
        runId: msg.runId,
        requestedBy: task.ownerAgentId,
        input: { episode: out.episode, approvalId: String(task.input['approvalId'] ?? '') },
      },
      { singletonKey: `${task.id}:episode.package` },
    )
    return
  }
  if (result.job === 'episode.package') {
    const out = result.output as {
      episode: string
      canonVersion: string
      estimate: { keyframes: number; credits: number; basis: string }
      jobs: {
        jobId: string
        shot: string
        status: string
        simulated: boolean
        nextGate: string | null
      }[]
    }
    const prev = (task.output ?? {}) as Record<string, unknown>
    const artifactIds = [
      ...((prev['createArtifactIds'] as string[] | undefined) ?? []),
      ...msg.artifactIds,
    ]
    const statuses = [...new Set(out.jobs.map((j) => j.status))].join('/')
    const summary = `episode ${out.episode} created; ${out.jobs.length} keyframe jobs in Bunni's inbox (${statuses}${out.jobs.some((j) => j.simulated) ? ', simulated runner' : ''}); canon ${out.canonVersion}`
    if (msg.runId)
      await d
        .update(runs)
        .set({ status: 'succeeded', summary, finishedAt: new Date() })
        .where(eq(runs.id, msg.runId))
    await d
      .update(tasks)
      .set({
        status: 'done',
        output: {
          episode: out.episode,
          artifactIds,
          estimate: out.estimate,
          shots: out.jobs.length,
          jobs: out.jobs,
          canonVersion: out.canonVersion,
        },
        updatedAt: new Date(),
        finishedAt: new Date(),
      })
      .where(eq(tasks.id, task.id))
    await emit(d, {
      ...base,
      kind: 'task.status',
      subject: `tasks:${task.id}`,
      caption: `Episode ${out.episode}: ${out.jobs.length} plan-only jobs placed with Bunni (${statuses})`,
      payload: {
        status: 'done',
        episode: out.episode,
        artifactIds,
        jobs: out.jobs.map((j) => j.jobId),
      },
    })
    if (task.workflowId) await advance(task.workflowId)
  }
}
