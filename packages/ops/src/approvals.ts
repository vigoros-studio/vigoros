import { approvals, type Db } from '@vigoros/db'
import { eq } from 'drizzle-orm'
import { emit } from './events'

/**
 * The founder's decision. It only flips the row; the runtime's tick notices and continues or
 * cancels the workflow. Nothing downstream runs until this row says approved.
 */
export const resolveApproval = async (
  db: Db,
  id: string,
  decision: 'approved' | 'rejected',
  note?: string,
): Promise<void> => {
  const [row] = await db.select().from(approvals).where(eq(approvals.id, id))
  if (!row) throw new Error(`no approval ${id}`)
  if (row.status !== 'pending') throw new Error(`approval ${id} already ${row.status}`)
  await db
    .update(approvals)
    .set({ status: decision, founderNote: note ?? null, decidedAt: new Date() })
    .where(eq(approvals.id, id))
  await emit(db, {
    kind: 'approval.resolved',
    companyId: row.companyId,
    characterId: row.characterId,
    agentId: null,
    departmentId: null,
    taskId: row.taskId,
    workflowId: row.workflowId,
    subject: `approvals:${id}`,
    caption: `Founder ${decision} "${row.headline}"`,
    payload: { decision, note: note ?? null, kind: row.kind },
  })
}
