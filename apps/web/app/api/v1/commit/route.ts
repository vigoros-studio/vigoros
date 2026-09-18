import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { CommitmentInputSchema } from '@vigoros/domain'
import { commitForecast } from '@vigoros/jobs'
import { authenticate } from '@/lib/api-auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.union([
  CommitmentInputSchema,
  z.object({ commitments: z.array(CommitmentInputSchema).min(1).max(500) }),
])

/**
 * POST /api/v1/commit   Authorization: Bearer vg_live_...
 * Body: one commitment or { commitments: [...] }. Each result is independent; a bulk request
 * never fails as a whole because one question closed.
 */
export const POST = async (req: NextRequest) => {
  const identity = await authenticate(req.headers.get('authorization'))
  if (!identity) return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'invalid body', issues: parsed.error.issues }, { status: 400 })
  const items = 'commitments' in parsed.data ? parsed.data.commitments : [parsed.data]
  const ctx = { db: db(), now: () => new Date() }
  const results = []
  for (const item of items) {
    const r = await commitForecast(ctx, identity.participantId, item)
    results.push(
      r.ok
        ? { question_id: r.receipt.questionId, ok: true, commitment_id: r.receipt.commitmentId, hash: r.receipt.hash, p: r.receipt.p, submitted_at: r.receipt.submittedAt }
        : { question_id: item.questionId, ok: false, error: r.error },
    )
  }
  const status = results.every((r) => r.ok) ? 201 : results.some((r) => r.ok) ? 207 : 409
  return NextResponse.json({ participant: identity.handle, results }, { status })
}
