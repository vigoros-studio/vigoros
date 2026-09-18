import { NextResponse, type NextRequest } from 'next/server'
import { questionsForDate, questionSetFor } from '@/lib/queries'
import { todayUtc } from '@/lib/jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/v1/questions?date=YYYY-MM-DD&status=OPEN  Public. Never returns forecasts. */
export const GET = async (req: NextRequest) => {
  const date = req.nextUrl.searchParams.get('date') ?? todayUtc()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'bad date' }, { status: 400 })
  const status = req.nextUrl.searchParams.get('status')
  const [set, rows] = await Promise.all([questionSetFor(date), questionsForDate(date)])
  if (!set) return NextResponse.json({ error: 'no question set for date', date }, { status: 404 })
  const filtered = status ? rows.filter((r) => r.status === status) : rows
  return NextResponse.json(
    {
      issue_date: date,
      seed: set.seed,
      methodology_version: set.methodologyVersion,
      count: filtered.length,
      questions: filtered.map((r) => ({
        id: r.id,
        symbol: r.symbol,
        name: r.name,
        venue: r.venue,
        type: r.type,
        horizon: r.horizon,
        level_k: r.levelK,
        threshold: r.threshold,
        reference_price: r.referencePrice,
        prior: r.prior,
        statement: r.statement,
        deadline_at: r.deadlineAt.toISOString(),
        resolves_on: r.resolvesOn,
        status: r.status,
        outcome: r.outcome,
      })),
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  )
}
