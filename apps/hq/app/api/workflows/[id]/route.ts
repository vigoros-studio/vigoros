import { artifacts, runs, tasks, workflows } from '@vigoros/db'
import { eq, inArray } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireFounder } from '@/lib/guard'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { deny } = await requireFounder()
  if (deny) return deny
  const { id } = await ctx.params
  const d = db()
  const [wf] = await d.select().from(workflows).where(eq(workflows.id, id))
  if (!wf) return NextResponse.json({ error: 'no workflow' }, { status: 404 })
  const steps = await d
    .select()
    .from(tasks)
    .where(eq(tasks.workflowId, id))
    .orderBy(tasks.createdAt)
  const outputs = await d
    .select({
      id: artifacts.id,
      kind: artifacts.kind,
      title: artifacts.title,
      simulated: artifacts.simulated,
      taskId: artifacts.taskId,
      path: artifacts.path,
      createdAt: artifacts.createdAt,
    })
    .from(artifacts)
    .where(eq(artifacts.workflowId, id))
    .orderBy(artifacts.createdAt)
  const turns = steps.length
    ? await d
        .select({
          id: runs.id,
          taskId: runs.taskId,
          agentId: runs.agentId,
          status: runs.status,
          adapter: runs.adapter,
          model: runs.model,
          costUsd: runs.costUsd,
          summary: runs.summary,
          startedAt: runs.startedAt,
          finishedAt: runs.finishedAt,
        })
        .from(runs)
        .where(
          inArray(
            runs.taskId,
            steps.map((s) => s.id),
          ),
        )
        .orderBy(runs.startedAt)
    : []
  return NextResponse.json({ workflow: wf, tasks: steps, artifacts: outputs, runs: turns })
}
