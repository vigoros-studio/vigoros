import { NextResponse, type NextRequest } from 'next/server'
import { authenticate } from '@/lib/api-auth'
import { statsFor } from '@/lib/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = async (req: NextRequest) => {
  const identity = await authenticate(req.headers.get('authorization'))
  if (!identity) return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  const stats = await statsFor(identity.participantId)
  return NextResponse.json({ participant: { id: identity.participantId, handle: identity.handle, kind: identity.kind }, stats })
}
