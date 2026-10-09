import {
  agents,
  artifacts,
  costLedger,
  decisions,
  departments,
  messages,
  runs,
  tasks,
} from '@vigoros/db'
import { instruct } from '@vigoros/ops'
import { roleByKey } from '@vigoros/org'
import { and, desc, eq, sql } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireFounder } from '@/lib/guard'

export const dynamic = 'force-dynamic'

/** Everything the agent panel shows: identity, assignment, outputs, decisions, usage. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { deny } = await requireFounder()
  if (deny) return deny
  const { id } = await ctx.params
  const d = db()
  const [agent] = await d.select().from(agents).where(eq(agents.id, id))
  if (!agent) return NextResponse.json({ error: 'no agent' }, { status: 404 })
  const [department] = await d
    .select()
    .from(departments)
    .where(eq(departments.id, agent.departmentId))
  const role = roleByKey(agent.roleKey)
  const recentTasks = await d
    .select()
    .from(tasks)
    .where(eq(tasks.ownerAgentId, id))
    .orderBy(desc(tasks.updatedAt))
    .limit(8)
  const recentRuns = await d
    .select({
      id: runs.id,
      taskId: runs.taskId,
      status: runs.status,
      model: runs.model,
      adapter: runs.adapter,
      inputTokens: runs.inputTokens,
      outputTokens: runs.outputTokens,
      cacheReadTokens: runs.cacheReadTokens,
      costUsd: runs.costUsd,
      summary: runs.summary,
      error: runs.error,
      startedAt: runs.startedAt,
      finishedAt: runs.finishedAt,
    })
    .from(runs)
    .where(eq(runs.agentId, id))
    .orderBy(desc(runs.startedAt))
    .limit(8)
  const recentArtifacts = await d
    .select({
      id: artifacts.id,
      kind: artifacts.kind,
      title: artifacts.title,
      simulated: artifacts.simulated,
      createdAt: artifacts.createdAt,
      taskId: artifacts.taskId,
      content: artifacts.content,
      path: artifacts.path,
    })
    .from(artifacts)
    .where(eq(artifacts.producedBy, id))
    .orderBy(desc(artifacts.createdAt))
    .limit(5)
  const recentDecisions = await d
    .select()
    .from(decisions)
    .where(eq(decisions.chooserId, id))
    .orderBy(desc(decisions.createdAt))
    .limit(5)
  const recentMessages = await d
    .select()
    .from(messages)
    .where(eq(messages.fromId, id))
    .orderBy(desc(messages.createdAt))
    .limit(5)
  const today = new Date().toISOString().slice(0, 10)
  const [spend] = await d
    .select({
      today: sql<number>`coalesce(sum(case when ${costLedger.day} = ${today} then ${costLedger.usd} else 0 end), 0)::float`,
      total: sql<number>`coalesce(sum(${costLedger.usd}), 0)::float`,
      runs: sql<number>`count(*)::int`,
    })
    .from(costLedger)
    .where(and(eq(costLedger.agentId, id), eq(costLedger.source, 'model')))
  return NextResponse.json({
    agent: {
      id: agent.id,
      name: agent.name,
      title: agent.title,
      roleKey: agent.roleKey,
      model: agent.model,
      tier: agent.tier,
      desk: agent.desk,
      department: department?.name ?? null,
      characterId: agent.characterId,
    },
    role: role
      ? {
          purpose: role.purpose,
          tools: role.tools,
          effort: role.effort,
          maxTurnsPerTask: role.maxTurnsPerTask,
          perRunCapUsd: role.perRunCapUsd,
          version: role.version,
        }
      : null,
    tasks: recentTasks,
    runs: recentRuns,
    artifacts: recentArtifacts,
    decisions: recentDecisions,
    messages: recentMessages,
    usage: {
      todayUsd: Number(spend?.today ?? 0),
      totalUsd: Number(spend?.total ?? 0),
      runs: Number(spend?.runs ?? 0),
    },
  })
}

/** A founder instruction. Becomes a task owned by this agent; nothing runs until the runtime picks it up. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { deny } = await requireFounder()
  if (deny) return deny
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as { text?: string }
  const text = String(body.text ?? '').trim()
  if (!text || text.length > 2000)
    return NextResponse.json({ error: 'instruction must be 1 to 2000 characters' }, { status: 400 })
  const taskId = await instruct(db(), id, text)
  return NextResponse.json({ taskId })
}
