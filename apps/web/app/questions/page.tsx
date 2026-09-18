import type { Metadata } from 'next'
import { fmtDate, fmtP } from '@/components/format'
import { latestQuestionSet, questionSetFor, questionsForDate } from '@/lib/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Questions' }

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ date?: string; venue?: string }> }) {
  const sp = await searchParams
  const set = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? await questionSetFor(sp.date) : await latestQuestionSet()
  const rows = set ? await questionsForDate(set.issueDate) : []
  const venues = ['US', 'UK', 'FX', 'CRYPTO'] as const
  const venue = venues.includes(sp.venue as (typeof venues)[number]) ? (sp.venue as (typeof venues)[number]) : 'US'
  const shown = rows.filter((r) => r.venue === venue)
  const deadline = shown[0]?.deadlineAt
  return (
    <section className="section wrap">
      <p className="label" style={{ marginBottom: 20 }}>Question set{set ? ` · issued ${fmtDate(set.issueDate)}` : ''}</p>
      <h1 style={{ maxWidth: '20ch' }}>What the market will be asked to settle.</h1>
      <p className="lede measure" style={{ marginTop: 24 }}>
        Three questions per asset, one of each type. Horizon and level are drawn from a seeded generator published with the set, so anyone
        can regenerate it. Forecasts are never shown here: only the questions and, once resolved, the answers.
      </p>
      {!set ? (
        <p className="muted" style={{ marginTop: 48 }}>No question set has been issued yet.</p>
      ) : (
        <>
          <div className="cluster" style={{ marginTop: 48, justifyContent: 'space-between' }}>
            <nav className="cluster small" aria-label="Venue">
              {venues.map((v) => (
                <a key={v} href={`/questions?date=${set.issueDate}&venue=${v}`} className={v === venue ? '' : 'muted'} aria-current={v === venue ? 'page' : undefined}>
                  {v === 'CRYPTO' ? 'Crypto' : v === 'FX' ? 'FX' : `${v} equities`}
                </a>
              ))}
            </nav>
            <span className="small faint mono">
              seed {set.seed} · {rows.length} questions{deadline ? ` · deadline ${deadline.toISOString().slice(11, 16)} UTC` : ''}
            </span>
          </div>
          <div className="table-scroll" style={{ marginTop: 24 }}>
            <table className="rows">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Question</th>
                  <th className="r">Prior</th>
                  <th className="r">Resolves</th>
                  <th className="r">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((q) => (
                  <tr key={q.id}>
                    <td className="mono">{q.symbol}<span className="faint small"> {q.name}</span></td>
                    <td>{q.statement}</td>
                    <td className="r num muted">{fmtP(q.prior)}</td>
                    <td className="r num muted small">{q.resolvesOn}</td>
                    <td className="r small">
                      {q.status === 'RESOLVED' ? <span className="num">{q.outcome === 1 ? 'Yes' : 'No'}</span> : <span className="faint">{q.status.toLowerCase()}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}
