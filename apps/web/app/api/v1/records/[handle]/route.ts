import { NextResponse, type NextRequest } from 'next/server'
import { authenticate } from '@/lib/api-auth'
import { participantByHandle, revealedCommitments, statsFor } from '@/lib/queries'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/v1/records/:handle  Published records are public; private ones only to their owner. */
export const GET = async (req: NextRequest, { params }: { params: Promise<{ handle: string }> }) => {
  const { handle } = await params
  const p = await participantByHandle(handle)
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (p.visibility !== 'PUBLISHED') {
    const identity = await authenticate(req.headers.get('authorization'))
    if (!identity || identity.participantId !== p.id) return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  const before = req.nextUrl.searchParams.get('before')
  const [stats, commitments] = await Promise.all([statsFor(p.id), revealedCommitments(p.id, before && /^\d{4}-\d{2}-\d{2}$/.test(before) ? before : null)])
  return NextResponse.json({
    participant: { handle: p.handle, display_name: p.displayName, kind: p.kind, published_at: p.publishedAt },
    stats,
    commitments,
    next_before: commitments.length ? commitments[commitments.length - 1]!.issueDate : null,
  })
}
