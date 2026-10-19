import { companies, type Db } from '@vigoros/db'
import { eq } from 'drizzle-orm'
import { emit } from './events'

/** The company this process serves. One database may hold several; `COMPANY_NAME` picks one. */
export const COMPANY_NAME = process.env['COMPANY_NAME'] ?? 'OneGoodArea'

export const activeCompany = async (db: Db) => {
  const [named] = await db.select().from(companies).where(eq(companies.name, COMPANY_NAME))
  if (named) return named
  const [first] = await db.select().from(companies).limit(1)
  return first ?? null
}

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
    subjectId: null,
    agentId: null,
    departmentId: null,
    taskId: null,
    subject: `companies:${companyId}`,
    caption: paused ? 'Founder paused the company' : 'Founder resumed the company',
    payload: { reason: reason ?? null },
  })
}
