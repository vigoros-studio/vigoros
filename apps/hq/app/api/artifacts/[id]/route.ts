import { artifacts } from '@vigoros/db'
import { eq } from 'drizzle-orm'
import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireFounder } from '@/lib/guard'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { deny } = await requireFounder()
  if (deny) return deny
  const { id } = await ctx.params
  const [row] = await db().select().from(artifacts).where(eq(artifacts.id, id))
  if (!row) return NextResponse.json({ error: 'no artifact' }, { status: 404 })
  return NextResponse.json(row)
}
