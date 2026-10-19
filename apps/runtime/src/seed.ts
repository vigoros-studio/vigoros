import { newId } from '@vigoros/contracts'
import { agents, budgets, companies, departments, subjects } from '@vigoros/db'
import { DEPARTMENTS, PHASE_ONE_ROLES, ROOMS } from '@vigoros/org'
import { and, eq } from 'drizzle-orm'
import { emit } from '@vigoros/ops'
import { db } from './db'

export const COMPANY_NAME = process.env['COMPANY_NAME'] ?? 'OneGoodArea'

const AVATAR_NAMES: Record<string, string> = {
  'managing-director': 'Managing Director',
  'content-director': 'Content Director',
}

/** Idempotent. Creates the company, its subject (OneGoodArea), the two departments and the two phase-1 agents. */
export const seed = async (opts: { docsRoot: string; dailyCapUsd: number }) => {
  const d = db()
  let [company] = await d.select().from(companies).where(eq(companies.name, COMPANY_NAME))
  if (!company) {
    ;[company] = await d
      .insert(companies)
      .values({ id: newId('company'), name: COMPANY_NAME, dailyCapUsd: opts.dailyCapUsd })
      .returning()
  }
  if (!company) throw new Error('company insert failed')

  let [subject] = await d
    .select()
    .from(subjects)
    .where(and(eq(subjects.companyId, company.id), eq(subjects.key, 'onegoodarea')))
  if (!subject) {
    ;[subject] = await d
      .insert(subjects)
      .values({
        id: newId('subject'),
        companyId: company.id,
        key: 'onegoodarea',
        name: 'OneGoodArea',
        kind: 'company',
        handle: '@onegoodarea',
        website: 'https://onegoodarea.com',
        docsRoot: opts.docsRoot || null,
      })
      .returning()
  }
  if (!subject) throw new Error('subject insert failed')

  const deptIds = new Map<string, string>()
  for (const dep of DEPARTMENTS) {
    const room = ROOMS.find((r) => r.key === dep.key)
    if (!room) throw new Error(`no room for ${dep.key}`)
    let [row] = await d
      .select()
      .from(departments)
      .where(and(eq(departments.companyId, company.id), eq(departments.key, dep.key)))
    if (!row) {
      ;[row] = await d
        .insert(departments)
        .values({
          id: newId('department'),
          companyId: company.id,
          key: dep.key,
          name: dep.name,
          purpose: dep.purpose,
          room: { origin: room.origin, size: room.size, desks: room.desks },
        })
        .returning()
    }
    if (row) deptIds.set(dep.key, row.id)
  }

  const deskCounter = new Map<string, number>()
  const created: string[] = []
  for (const role of PHASE_ONE_ROLES) {
    const departmentId = deptIds.get(role.department)
    if (!departmentId) throw new Error(`no department ${role.department}`)
    const subjectId = role.scope === 'subject' ? subject.id : null
    const existing = await d
      .select()
      .from(agents)
      .where(and(eq(agents.companyId, company.id), eq(agents.roleKey, role.key)))
    if (existing.some((a) => a.subjectId === subjectId)) continue
    const desk = (deskCounter.get(departmentId) ?? 0) + 1
    deskCounter.set(departmentId, desk)
    const id = newId('agent')
    await d.insert(agents).values({
      id,
      companyId: company.id,
      subjectId,
      departmentId,
      roleKey: role.key,
      roleVersion: role.version,
      title: role.title,
      name: AVATAR_NAMES[role.key] ?? role.title,
      model: role.model,
      tier: role.tier,
      desk,
    })
    created.push(role.key)
    await emit(d, {
      kind: 'agent.state',
      companyId: company.id,
      subjectId,
      agentId: id,
      departmentId,
      taskId: null,
      subject: `agents:${id}`,
      caption: `${AVATAR_NAMES[role.key] ?? role.title} joined as ${role.title}`,
      payload: { state: 'idle', hired: true },
    })
  }

  await d
    .insert(budgets)
    .values({
      id: newId('budget'),
      companyId: company.id,
      scope: 'company',
      capUsd: opts.dailyCapUsd,
    })
    .onConflictDoNothing()
  return {
    companyId: company.id,
    subjectId: subject.id,
    departments: [...deptIds.entries()],
    agentsCreated: created,
  }
}
