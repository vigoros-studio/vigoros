import { newId } from '@vigoros/contracts'
import { agents, tasks } from '@vigoros/db'
import { eq } from 'drizzle-orm'
import { QUEUES, boss } from './boss'
import { db } from './db'
import { emit } from './events'
import { taskKind } from './kinds'

export interface NewTask {
  kind: string
  title: string
  ownerAgentId: string
  requestedBy: string
  input?: Record<string, unknown>
  inputArtifactIds?: string[]
  parentId?: string
  capUsd: number
}

/** Creates a task, logs the event and enqueues the owner's first turn. Idempotent on the task id. */
export const createTask = async (t: NewTask): Promise<string> => {
  taskKind(t.kind)
  const [owner] = await db().select().from(agents).where(eq(agents.id, t.ownerAgentId))
  if (!owner) throw new Error(`no agent ${t.ownerAgentId}`)
  const id = newId('task')
  await db()
    .insert(tasks)
    .values({
      id,
      companyId: owner.companyId,
      characterId: owner.characterId,
      parentId: t.parentId ?? null,
      ownerAgentId: owner.id,
      requestedBy: t.requestedBy,
      kind: t.kind,
      title: t.title,
      input: t.input ?? {},
      inputArtifactIds: t.inputArtifactIds ?? [],
      capUsd: t.capUsd,
    })
  await emit({
    kind: 'task.created',
    companyId: owner.companyId,
    characterId: owner.characterId,
    agentId: owner.id,
    departmentId: owner.departmentId,
    taskId: id,
    subject: `tasks:${id}`,
    caption: `${owner.name} received: ${t.title}`,
    payload: { kind: t.kind, requestedBy: t.requestedBy },
  })
  const b = await boss()
  await b.send(QUEUES.agentTurn, { taskId: id }, { singletonKey: `${id}:${0}` })
  return id
}
