import { newId } from '@vigoros/contracts'
import { agents, tasks, type Db } from '@vigoros/db'
import { and, eq } from 'drizzle-orm'
import { emit } from './events'

export interface NewTask {
  kind: string
  title: string
  ownerAgentId: string
  requestedBy: string
  input?: Record<string, unknown>
  inputArtifactIds?: string[]
  parentId?: string
  workflowId?: string
  step?: string
  capUsd: number
}

/**
 * Inserts a queued task and logs it. Inside a workflow the (workflow, step, owner) key is unique,
 * so a second insert for the same step returns the existing id instead of duplicating work.
 */
export const insertTask = async (db: Db, t: NewTask): Promise<{ id: string; created: boolean }> => {
  const [owner] = await db.select().from(agents).where(eq(agents.id, t.ownerAgentId))
  if (!owner) throw new Error(`no agent ${t.ownerAgentId}`)
  if (t.workflowId && t.step) {
    const [existing] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.workflowId, t.workflowId),
          eq(tasks.step, t.step),
          eq(tasks.ownerAgentId, owner.id),
        ),
      )
    if (existing) return { id: existing.id, created: false }
  }
  const id = newId('task')
  await db
    .insert(tasks)
    .values({
      id,
      companyId: owner.companyId,
      characterId: owner.characterId,
      parentId: t.parentId ?? null,
      workflowId: t.workflowId ?? null,
      step: t.step ?? null,
      ownerAgentId: owner.id,
      requestedBy: t.requestedBy,
      kind: t.kind,
      title: t.title,
      input: t.input ?? {},
      inputArtifactIds: t.inputArtifactIds ?? [],
      capUsd: t.capUsd,
    })
    .onConflictDoNothing()
  await emit(db, {
    kind: 'task.created',
    companyId: owner.companyId,
    characterId: owner.characterId,
    agentId: owner.id,
    departmentId: owner.departmentId,
    taskId: id,
    workflowId: t.workflowId ?? null,
    subject: `tasks:${id}`,
    caption: `${owner.name} received: ${t.title}`,
    payload: { kind: t.kind, requestedBy: t.requestedBy, step: t.step ?? null },
  })
  return { id, created: true }
}

/** A founder instruction to one agent becomes a task owned by that agent. */
export const instruct = async (db: Db, agentId: string, text: string): Promise<string> => {
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId))
  if (!agent) throw new Error(`no agent ${agentId}`)
  const kind = agent.roleKey === 'studio-director' ? 'direct.instruction' : 'agent.instruction'
  const { id } = await insertTask(db, {
    kind,
    title: text.length > 80 ? `${text.slice(0, 77)}...` : text,
    ownerAgentId: agent.id,
    requestedBy: 'founder',
    input: { instruction: text },
    capUsd: 1,
  })
  return id
}
