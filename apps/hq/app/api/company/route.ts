import { companies } from '@vigoros/db'
import { setPaused } from '@vigoros/ops'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireFounder } from '@/lib/guard'

export const dynamic = 'force-dynamic'

/** The kill switch. Pausing stops every new turn and every workflow advance within one tick. */
export async function POST(req: NextRequest) {
  const { deny } = await requireFounder()
  if (deny) return deny
  const body = (await req.json().catch(() => ({}))) as { paused?: boolean; reason?: string }
  if (typeof body.paused !== 'boolean')
    return NextResponse.json({ error: 'paused must be boolean' }, { status: 400 })
  const [c] = await db().select().from(companies).limit(1)
  if (!c) return NextResponse.json({ error: 'no company' }, { status: 404 })
  await setPaused(db(), c.id, body.paused, body.reason?.slice(0, 200))
  return NextResponse.json({ ok: true, paused: body.paused })
}
