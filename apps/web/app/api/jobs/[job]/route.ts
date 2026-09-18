import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { participants, questionSets } from '@vigoros/db'
import {
  computeAllStats,
  generateDay,
  ingestStep,
  resolveDue,
  runBaselines,
  runReferenceModelStep,
  sealPending,
  seedReferenceData,
  upgradeSeals,
} from '@vigoros/jobs'
import { env } from '@/lib/env'
import { jobContext, todayUtc } from '@/lib/jobs'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

const authorised = (req: NextRequest): boolean => {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  return token.length > 0 && token === env().CRON_SECRET
}

type Handler = (date: string) => Promise<unknown>

/**
 * Every pipeline step behind one authenticated endpoint. Steps are idempotent and chunked, so
 * schedulers (Vercel cron, Supabase pg_cron, GitHub Actions) can call them freely.
 */
const handlers = (): Record<string, Handler> => {
  const ctx = jobContext()
  return {
    seed: () => seedReferenceData(ctx),
    ingest: (date) => ingestStep(ctx, { asOf: date }),
    generate: async (date) => {
      const secret = env().SEED_SECRET ?? env().CRON_SECRET
      return generateDay(ctx, date, secret)
    },
    baselines: async (date) => {
      const [set] = await ctx.db.select({ seed: questionSets.seed }).from(questionSets).where(eq(questionSets.issueDate, date))
      if (!set) return { error: 'no question set for date' }
      return runBaselines(ctx, date, set.seed)
    },
    reference: async (date) => {
      const models = await ctx.db.select({ id: participants.id, handle: participants.handle }).from(participants).where(eq(participants.kind, 'REFERENCE_MODEL'))
      const results: Record<string, unknown> = {}
      const started = Date.now()
      for (const m of models) {
        if (Date.now() - started > ctx.timeBudgetMs * 0.9) break
        results[m.handle] = await runReferenceModelStep({ ...ctx, timeBudgetMs: Math.max(20_000, ctx.timeBudgetMs / models.length) }, date, m.id)
      }
      return results
    },
    seal: (date) => sealPending(ctx, date),
    'upgrade-seals': () => upgradeSeals(ctx),
    resolve: (date) => resolveDue(ctx, date),
    stats: () => computeAllStats(ctx),
  }
}

const run = async (req: NextRequest, job: string): Promise<NextResponse> => {
  if (!authorised(req)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 })
  const handler = handlers()[job]
  if (!handler) return NextResponse.json({ error: 'unknown job' }, { status: 404 })
  const date = req.nextUrl.searchParams.get('date') ?? todayUtc()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'bad date' }, { status: 400 })
  const started = Date.now()
  try {
    const result = await handler(date)
    return NextResponse.json({ job, date, ms: Date.now() - started, result })
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', job, date, error: e instanceof Error ? e.message : String(e) }))
    return NextResponse.json({ job, date, error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}

export const GET = async (req: NextRequest, { params }: { params: Promise<{ job: string }> }) => run(req, (await params).job)
export const POST = GET
