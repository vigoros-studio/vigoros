import { TaskStatus, newId, type Effort, type ModelId } from '@vigoros/contracts'
import { agents, artifacts, companies, costLedger, departments, runs, tasks } from '@vigoros/db'
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
import { roleByKey } from '@vigoros/org'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from './db'
import { env } from './env'
import { emit } from './events'
import { taskKind } from './kinds'
import { adapter } from './model'

const today = () => new Date().toISOString().slice(0, 10)

const spentToday = async (where: ReturnType<typeof eq>): Promise<number> => {
  const [row] = await db()
    .select({ usd: sql<number>`coalesce(sum(${costLedger.usd}), 0)` })
    .from(costLedger)
    .where(and(where, eq(costLedger.day, today())))
  return Number(row?.usd ?? 0)
}

/**
 * One agent turn against one task. Every guard runs before the model is called;
 * every outcome is a row. Re-running a turn for a task that already moved on is a no-op.
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
  const kind = taskKind(task.kind)

  const block = async (reason: string, caption: string) => {
    await d
      .update(tasks)
      .set({
        status: transition(taskStatus, 'blocked'),
        blockedReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id))
    await emit({
      kind: 'task.status',
      companyId: task.companyId,
      characterId: task.characterId,
      agentId: agent.id,
      departmentId: department.id,
      taskId: task.id,
      subject: `tasks:${task.id}`,
      caption,
      payload: { status: 'blocked', reason },
    })
  }

  if (company.paused) return block('company_paused', `${agent.name} is waiting: company paused`)
  if (department.paused)
    return block('department_paused', `${agent.name} is waiting: ${department.name} paused`)

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
        .select({ kind: artifacts.kind, title: artifacts.title, content: artifacts.content })
        .from(artifacts)
        .where(inArray(artifacts.id, task.inputArtifactIds))
    : []
  const user = kind.user(task.input, inputArtifacts)
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
    await emit({
      kind: 'budget.blocked',
      companyId: task.companyId,
      characterId: task.characterId,
      agentId: agent.id,
      departmentId: department.id,
      taskId: task.id,
      subject: `tasks:${task.id}`,
      caption: `${agent.name} blocked by ${verdict.level} cap`,
      payload: { ...verdict },
    })
    return block(
      `over_budget:${verdict.level}`,
      `${agent.name} needs a higher ${verdict.level} cap for ${task.title}`,
    )
  }

  const runId = newId('run')
  await d.insert(runs).values({ id: runId, taskId: task.id, agentId: agent.id, model, effort })
  await d
    .update(tasks)
    .set({
      status: transition(taskStatus, 'running'),
      turns: task.turns + 1,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, task.id))
  await emit({
    kind: 'run.started',
    companyId: task.companyId,
    characterId: task.characterId,
    agentId: agent.id,
    departmentId: department.id,
    taskId: task.id,
    subject: `runs:${runId}`,
    caption: `${agent.name} started ${task.title}`,
    payload: { model, effort, reviewing: kind.reviewing, estimateUsd: estimate },
  })

  try {
    const result = await adapter().complete({
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
    const artifactId = newId('artifact')
    await d.insert(artifacts).values({
      id: artifactId,
      companyId: task.companyId,
      characterId: task.characterId,
      taskId: task.id,
      runId,
      producedBy: agent.id,
      kind: kind.artifactKind,
      title: `${kind.schemaName} for ${task.title}`,
      content: result.output,
    })
    await d
      .insert(costLedger)
      .values({
        id: newId('cost'),
        companyId: task.companyId,
        characterId: task.characterId,
        departmentId: department.id,
        agentId: agent.id,
        taskId: task.id,
        runId,
        source: 'model',
        description: `${model} turn (${adapter().name})`,
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
        summary: `${kind.schemaName} produced`,
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
    await emit({
      kind: 'artifact.created',
      companyId: task.companyId,
      characterId: task.characterId,
      agentId: agent.id,
      departmentId: department.id,
      taskId: task.id,
      subject: `artifacts:${artifactId}`,
      caption: `${agent.name} produced ${kind.artifactKind}`,
      payload: { artifactId, kind: kind.artifactKind },
    })
    await emit({
      kind: 'run.finished',
      companyId: task.companyId,
      characterId: task.characterId,
      agentId: agent.id,
      departmentId: department.id,
      taskId: task.id,
      subject: `runs:${runId}`,
      caption: `${agent.name} finished ${task.title}`,
      payload: { usd, adapter: adapter().name, status: next },
    })
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
    await emit({
      kind: 'run.finished',
      companyId: task.companyId,
      characterId: task.characterId,
      agentId: agent.id,
      departmentId: department.id,
      taskId: task.id,
      subject: `runs:${runId}`,
      caption: `${agent.name} failed ${task.title}`,
      payload: { error: message, status: next },
    })
    throw e
  }
}
