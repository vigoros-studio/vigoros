import { companies, type Db } from '@vigoros/db'
import { eq } from 'drizzle-orm'
import { emit } from './events'

/** The kill switch. Every executor checks this flag before starting work. */
export const setPaused = async (
  db: Db,
  companyId: string,
  paused: boolean,
  reason?: string,
): Promise<void> => {
  await db
    .update(companies)
    .set({ paused, pausedReason: paused ? (reason ?? 'founder') : null })
    .where(eq(companies.id, companyId))
  await emit(db, {
    kind: paused ? 'company.paused' : 'company.resumed',
    companyId,
    characterId: null,
    agentId: null,
    departmentId: null,
    taskId: null,
    subject: `companies:${companyId}`,
    caption: paused ? 'Founder paused the company' : 'Founder resumed the company',
    payload: { reason: reason ?? null },
  })
}
