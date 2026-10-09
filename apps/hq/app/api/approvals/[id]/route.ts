import { approvals, artifacts } from '@vigoros/db'
import { resolveApproval } from '@vigoros/ops'
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
  const [row] = await d.select().from(approvals).where(eq(approvals.id, id))
  if (!row) return NextResponse.json({ error: 'no approval' }, { status: 404 })
  const p = row.payload as Record<string, unknown>
  const ids = ['winningScript', 'ranking', 'plan']
    .map((k) => p[k])
    .filter((v): v is string => typeof v === 'string')
  const evidence = ids.length
    ? await d
        .select({
          id: artifacts.id,
          kind: artifacts.kind,
          title: artifacts.title,
          simulated: artifacts.simulated,
          content: artifacts.content,
        })
        .from(artifacts)
        .where(inArray(artifacts.id, ids))
    : []
  return NextResponse.json({ approval: row, evidence })
}

/** Approve or reject. The row is the control: the runtime's next tick acts on it. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { deny } = await requireFounder()
  if (deny) return deny
  const { id } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as { decision?: string; note?: string }
  if (body.decision !== 'approved' && body.decision !== 'rejected')
    return NextResponse.json({ error: 'decision must be approved or rejected' }, { status: 400 })
  try {
    await resolveApproval(db(), id, body.decision, body.note?.slice(0, 1000))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 409 })
  }
  return NextResponse.json({ ok: true })
}
