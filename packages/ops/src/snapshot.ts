import type { AgentState } from '@vigoros/contracts'
import {
  agents,
  approvals,
  companies,
  costLedger,
  departments,
  events,
  meetings,
  runs,
  tasks,
  workflows,
  type Db,
} from '@vigoros/db'
import { deriveAgentState } from '@vigoros/engine'
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'

export interface Snapshot {
  company: {
    id: string
    name: string
    paused: boolean
    pausedReason: string | null
    dailyCapUsd: number
  }
  departments: {
    id: string
    key: string
    name: string
    room: { origin: [number, number]; size: [number, number]; desks: number }
    paused: boolean
    activity: number
  }[]
  agents: {
    id: string
    name: string
    title: string
    roleKey: string
    departmentId: string
    characterId: string | null
    desk: number
    model: string
    tier: number
    state: AgentState
    currentTask: {
      id: string
      title: string
      status: string
      kind: string
      workflowId: string | null
    } | null
    spentTodayUsd: number
  }[]
  workflows: {
    id: string
    title: string
    status: string
    step: string
    simulated: boolean
    spentUsd: number
    updatedAt: string
  }[]
  pendingApprovals: {
    id: string
    headline: string
    kind: string
    recommendation: string | null
    costUsd: number | null
    createdAt: string
    workflowId: string | null
  }[]
  recentEvents: {
    seq: number
    kind: string
    caption: string
    agentId: string | null
    departmentId: string | null
    createdAt: string
  }[]
  lastSeq: number
  generatedAt: string
}

/**
 * Everything the headquarters needs to draw itself, from rows. Two queries per table at most,
 * no per-agent round trips, so it stays cheap at hundreds of agents.
 */
export const snapshot = async (db: Db): Promise<Snapshot | null> => {
  const [company] = await db.select().from(companies).limit(1)
  if (!company) return null
  const deps = await db.select().from(departments).where(eq(departments.companyId, company.id))
  const staff = await db
    .select()
    .from(agents)
    .where(and(eq(agents.companyId, company.id), eq(agents.active, true)))
  const open = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.companyId, company.id),
        inArray(tasks.status, ['queued', 'running', 'waiting', 'blocked']),
      ),
    )
    .orderBy(desc(tasks.updatedAt))
  const openRuns = await db
    .select({ agentId: runs.agentId, taskId: runs.taskId })
    .from(runs)
    .where(isNull(runs.finishedAt))
  const openMeetings = await db
    .select({ participantIds: meetings.participantIds })
    .from(meetings)
    .where(eq(meetings.status, 'open'))
  const justDone = await db
    .select({ ownerAgentId: tasks.ownerAgentId })
    .from(tasks)
    .where(
      and(
        eq(tasks.companyId, company.id),
        eq(tasks.status, 'done'),
        gt(tasks.finishedAt, new Date(Date.now() - 60_000)),
      ),
    )
  const flows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.companyId, company.id))
    .orderBy(desc(workflows.updatedAt))
    .limit(10)
  const pending = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.companyId, company.id), eq(approvals.status, 'pending')))
    .orderBy(desc(approvals.createdAt))
  const recent = await db
    .select()
    .from(events)
    .where(eq(events.companyId, company.id))
    .orderBy(desc(events.seq))
    .limit(30)
  const today = new Date().toISOString().slice(0, 10)
  const spent = await db
    .select({ agentId: costLedger.agentId, usd: sql<number>`sum(${costLedger.usd})::float` })
    .from(costLedger)
    .where(and(eq(costLedger.companyId, company.id), eq(costLedger.day, today)))
    .groupBy(costLedger.agentId)
  const spentBy = new Map(
    spent.filter((r) => r.agentId).map((r) => [r.agentId as string, Number(r.usd)]),
  )
  const inMeeting = new Set(openMeetings.flatMap((m) => m.participantIds))
  const reviewingKinds = new Set(['direct.pick', 'review.rank', 'direct.approval-item'])

  const agentRows = staff.map((a) => {
    const mine = open.filter((t) => t.ownerAgentId === a.id)
    const running = openRuns.find((r) => r.agentId === a.id)
    const current =
      (running ? mine.find((t) => t.id === running.taskId) : undefined) ?? mine[0] ?? null
    const state = deriveAgentState({
      openRun: Boolean(running),
      inOpenMeeting: inMeeting.has(a.id),
      openTaskStatuses: mine.map((t) => t.status as 'queued' | 'running' | 'waiting' | 'blocked'),
      reviewing: Boolean(current && reviewingKinds.has(current.kind)),
      justCompleted: justDone.some((t) => t.ownerAgentId === a.id),
    })
    return {
      id: a.id,
      name: a.name,
      title: a.title,
      roleKey: a.roleKey,
      departmentId: a.departmentId,
      characterId: a.characterId,
      desk: a.desk,
      model: a.model,
      tier: a.tier,
      state,
      currentTask: current
        ? {
            id: current.id,
            title: current.title,
            status: current.status,
            kind: current.kind,
            workflowId: current.workflowId,
          }
        : null,
      spentTodayUsd: spentBy.get(a.id) ?? 0,
    }
  })

  return {
    company: {
      id: company.id,
      name: company.name,
      paused: company.paused,
      pausedReason: company.pausedReason,
      dailyCapUsd: company.dailyCapUsd,
    },
    departments: deps.map((d) => ({
      id: d.id,
      key: d.key,
      name: d.name,
      room: d.room,
      paused: d.paused,
      activity: agentRows.filter(
        (a) =>
          a.departmentId === d.id &&
          (a.state === 'working' || a.state === 'reviewing' || a.state === 'meeting'),
      ).length,
    })),
    agents: agentRows,
    workflows: flows.map((w) => ({
      id: w.id,
      title: w.title,
      status: w.status,
      step: w.step,
      simulated: w.simulated,
      spentUsd: w.spentUsd,
      updatedAt: w.updatedAt.toISOString(),
    })),
    pendingApprovals: pending.map((p) => ({
      id: p.id,
      headline: p.headline,
      kind: p.kind,
      recommendation: p.recommendation,
      costUsd: p.costUsd,
      createdAt: p.createdAt.toISOString(),
      workflowId: p.workflowId,
    })),
    recentEvents: recent.map((e) => ({
      seq: e.seq,
      kind: e.kind,
      caption: e.caption,
      agentId: e.agentId,
      departmentId: e.departmentId,
      createdAt: e.createdAt.toISOString(),
    })),
    lastSeq: recent[0]?.seq ?? 0,
    generatedAt: new Date().toISOString(),
  }
}
