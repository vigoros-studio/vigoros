import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { commitments } from '@vigoros/db'
import { CommitRow } from '@/components/commit-row'
import { fmtDate } from '@/components/format'
import { db } from '@/lib/db'
import { latestQuestionSet, questionsForDate } from '@/lib/queries'
import { currentSession } from '@/lib/supabase'
import { commitAction } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Commit' }

export default async function CommitPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const session = await currentSession()
  if (!session) redirect('/join')
  const humans = session.identities.filter((p) => p.kind === 'HUMAN')
  const identity = humans.find((p) => p.handle === sp.as) ?? humans[0]
  if (!identity) redirect('/account?error=identity')

  const set = await latestQuestionSet()
  const all = set ? await questionsForDate(set.issueDate) : []
  const venues = ['US', 'UK', 'FX', 'CRYPTO'] as const
  const venue = venues.includes(sp.venue as (typeof venues)[number]) ? (sp.venue as (typeof venues)[number]) : 'US'
  const q = (sp.q ?? '').trim().toUpperCase()
  const now = new Date()
  const rows = all.filter((r) => r.venue === venue && r.status === 'OPEN' && r.deadlineAt > now && (!q || r.symbol.startsWith(q)))
  const mine = rows.length
    ? await db()
        .select({ questionId: commitments.questionId, p: commitments.p, reasoning: commitments.reasoning })
        .from(commitments)
        .where(and(eq(commitments.participantId, identity.id), inArray(commitments.questionId, rows.map((r) => r.id))))
    : []
  const byQ = new Map(mine.map((m) => [m.questionId, m]))
  const deadline = rows[0]?.deadlineAt

  return (
    <section className="section wrap">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <div>
          <p className="label" style={{ marginBottom: 20 }}>Commit as @{identity.handle}{set ? ` · set of ${fmtDate(set.issueDate)}` : ''}</p>
          <h1 style={{ maxWidth: '18ch' }}>Say what you believe. Then wait.</h1>
        </div>
        {humans.length > 1 ? (
          <nav className="cluster small" aria-label="Identity">
            {humans.map((h) => <Link key={h.id} href={`/commit?as=${h.handle}&venue=${venue}`} className={h.id === identity.id ? '' : 'muted'}>@{h.handle}</Link>)}
          </nav>
        ) : null}
      </div>
      <p className="lede measure" style={{ marginTop: 24 }}>
        Answer only what you hold a view on. Skipping a question costs nothing; skill is measured against the prior on the questions you
        answer. A commitment is final and sealed the moment you submit it.
      </p>

      {sp.done ? <p className="pos small" style={{ marginTop: 24 }}>Sealed. Leaf hash begins {sp.done}…</p> : null}
      {sp.error ? <p className="neg small" style={{ marginTop: 24 }}>{{ question_closed: 'That question has closed.', already_committed: 'Already committed. Commitments are final.', input: 'Check the inputs.' }[sp.error] ?? 'Could not commit.'}</p> : null}

      {!set || rows.length === 0 ? (
        <p className="muted" style={{ marginTop: 48 }}>
          {!set ? 'No question set has been issued yet.' : deadline && deadline <= now ? `The ${venue} deadline has passed for this set.` : 'Nothing open in this venue.'}
        </p>
      ) : (
        <>
          <div className="cluster" style={{ marginTop: 48, justifyContent: 'space-between' }}>
            <nav className="cluster small" aria-label="Venue">
              {venues.map((v) => (
                <Link key={v} href={`/commit?as=${identity.handle}&venue=${v}`} className={v === venue ? '' : 'muted'}>{v === 'CRYPTO' ? 'Crypto' : v === 'FX' ? 'FX' : `${v} equities`}</Link>
              ))}
            </nav>
            <form className="cluster small" method="get">
              <input type="hidden" name="as" value={identity.handle} />
              <input type="hidden" name="venue" value={venue} />
              <input name="q" defaultValue={sp.q ?? ''} placeholder="Symbol" className="input" style={{ height: 30, width: 120 }} autoComplete="off" />
              <span className="faint mono">deadline {deadline?.toISOString().slice(11, 16)} UTC · {rows.length} open</span>
            </form>
          </div>
          <div style={{ marginTop: 24 }}>
            {rows.slice(0, 150).map((r) => (
              <CommitRow
                key={r.id}
                action={commitAction}
                as={identity.handle}
                venue={venue}
                question={{ id: r.id, symbol: r.symbol, statement: r.statement, prior: r.prior, deadlineAt: r.deadlineAt.toISOString(), resolvesOn: r.resolvesOn }}
                committed={byQ.get(r.id) ?? null}
              />
            ))}
            {rows.length > 150 ? <p className="faint small" style={{ marginTop: 16 }}>Showing 150. Filter by symbol to find the rest.</p> : null}
          </div>
        </>
      )}
    </section>
  )
}
