import { snapshot } from '@vigoros/ops'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireFounder } from '@/lib/guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { deny } = await requireFounder()
  if (deny) return deny
  const s = await snapshot(db())
  return NextResponse.json(s ?? { error: 'no company' }, {
    headers: { 'cache-control': 'no-store' },
  })
}
