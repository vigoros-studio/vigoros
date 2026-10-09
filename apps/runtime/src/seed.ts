import { newId } from '@vigoros/contracts'
import { agents, budgets, characterState, characters, companies, departments } from '@vigoros/db'
import { DEPARTMENTS, PHASE_ONE_ROLES, ROOMS } from '@vigoros/org'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { emit } from './events'

const AVATAR_NAMES: Record<string, string> = {
  'studio-director': 'Director',
  'trend-researcher': 'Scout',
  'comedy-writer-a': 'Writer A',
  'comedy-writer-b': 'Writer B',
  'creative-reviewer': 'Reviewer',
  'production-manager': 'Producer',
  'performance-analyst': 'Analyst',
}

/** Idempotent. Creates the company, Bunni, the six departments and the seven phase-1 agents. */
export const seed = async (opts: { bunniRoot: string; dailyCapUsd: number }) => {
  const d = db()
  let [company] = await d.select().from(companies).where(eq(companies.name, 'Vigoros Studio'))
  if (!company) {
    ;[company] = await d
      .insert(companies)
      .values({ id: newId('company'), name: 'Vigoros Studio', dailyCapUsd: opts.dailyCapUsd })
      .returning()
  }
  if (!company) throw new Error('company insert failed')

  let [bunni] = await d.select().from(characters).where(eq(characters.key, 'bunni'))
  if (!bunni) {
    ;[bunni] = await d
      .insert(characters)
      .values({
        id: newId('character'),
        companyId: company.id,
        key: 'bunni',
        name: 'Bunni',
        handle: '@bunniisreal',
        productionRoot: opts.bunniRoot,
      })
      .returning()
    if (bunni)
      await d
        .insert(characterState)
        .values({ characterId: bunni.id, storyline: 'Bunni is trying to become famous.' })
  }
  if (!bunni) throw new Error('character insert failed')

  const deptIds = new Map<string, string>()
  for (const dep of DEPARTMENTS) {
    const room = ROOMS.find((r) => r.key === dep.key)
    if (!room) throw new Error(`no room for ${dep.key}`)
    let [row] = await d.select().from(departments).where(eq(departments.key, dep.key))
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
    const characterId = role.scope === 'character' ? bunni.id : null
    const existing = await d.select().from(agents).where(eq(agents.roleKey, role.key))
    if (existing.some((a) => a.characterId === characterId)) continue
    const desk = (deskCounter.get(departmentId) ?? 0) + 1
    deskCounter.set(departmentId, desk)
    const id = newId('agent')
    await d
      .insert(agents)
      .values({
        id,
        companyId: company.id,
        characterId,
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
    await emit({
      kind: 'agent.state',
      companyId: company.id,
      characterId,
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
    characterId: bunni.id,
    departments: deptIds.size,
    agentsCreated: created,
  }
}
