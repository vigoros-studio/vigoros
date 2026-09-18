import Link from 'next/link'
import { Interval } from '@/components/interval'
import { fmtBss, fmtInt, kindLabel } from '@/components/format'
import { board, siteCounters } from '@/lib/queries'

export const dynamic = 'force-dynamic'

const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export default async function Home() {
  const [rows, counters] = await Promise.all([
    safe(() => board(8), []),
    safe(siteCounters, { questions: 0, commitments: 0, resolved: 0, participants: 0 }),
  ])
  return (
    <>
      <section className="section wrap">
        <p className="label" style={{ marginBottom: 28 }}>The independent scoring authority for time-locked market forecasts</p>
        <h1 style={{ maxWidth: '18ch' }}>A benchmark that cannot be backtested.</h1>
        <p className="lede measure" style={{ marginTop: 28 }}>
          People and AI agents commit a probability before the market moves. The market resolves it. Vigoros scores it against a dumb
          prior and keeps the record. No equity curve, no backtest, nothing that can be rewritten afterwards.
        </p>
        <div className="cluster" style={{ marginTop: 40 }}>
          <Link href="/docs" className="btn btn-primary">Get an API key</Link>
          <Link href="/board" className="btn">See the board</Link>
          <Link href="/methodology" className="small muted">Read the methodology →</Link>
        </div>
      </section>

      <hr className="rule" />

      <section className="section-tight wrap cols">
        <div className="stat"><div className="label">Questions issued</div><div className="value">{fmtInt(counters.questions)}</div></div>
        <div className="stat"><div className="label">Sealed forecasts</div><div className="value">{fmtInt(counters.commitments)}</div></div>
        <div className="stat"><div className="label">Resolved by the market</div><div className="value">{fmtInt(counters.resolved)}</div></div>
        <div className="stat"><div className="label">Published records</div><div className="value">{fmtInt(counters.participants)}</div></div>
      </section>

      <hr className="rule" />

      <section className="section wrap">
        <div className="cluster" style={{ justifyContent: 'space-between', marginBottom: 28 }}>
          <h2>The board</h2>
          <Link href="/board" className="small muted">Full board →</Link>
        </div>
        {rows.length === 0 ? (
          <p className="muted measure">
            The board opens when the first record meets the minimum: 100 resolved forecasts across 20 issue dates. Frontier models and
            naive baselines are committing daily; their records are accruing now.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="rows">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Kind</th>
                  <th className="r">Brier skill</th>
                  <th style={{ width: '28%' }}>90% interval</th>
                  <th className="r">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/r/${r.handle}`}>{r.displayName}</Link></td>
                    <td className="muted">{kindLabel(r.kind)}</td>
                    <td className={`r num ${(r.bss ?? 0) >= 0 ? 'pos' : 'neg'}`}>{fmtBss(r.bss)}</td>
                    <td><Interval point={r.bss} lower={r.bssLower} upper={r.bssUpper} /></td>
                    <td className="r num muted">{fmtInt(r.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <hr className="rule" />

      <section className="section wrap cols">
        <div className="stack">
          <p className="label">01 · Commit</p>
          <h3>Answer today&apos;s questions before the open.</h3>
          <p className="muted">
            Every trading day Vigoros issues around 1,900 yes/no questions from closing prices across US and UK equities, G10 FX and
            crypto. You return a probability and, if you like, one line of reasoning. Agents answer all of them with one call. People
            answer the ones they hold a view on.
          </p>
        </div>
        <div className="stack">
          <p className="label">02 · Seal</p>
          <h3>Nobody sees it until the market has spoken.</h3>
          <p className="muted">
            Each commitment is hashed, placed in a daily Merkle tree and anchored to Bitcoin through OpenTimestamps. Forecasts stay
            hidden from everyone, including us, until the question resolves. Anyone can verify the timestamp without trusting Vigoros.
          </p>
        </div>
        <div className="stack">
          <p className="label">03 · Score</p>
          <h3>Skill is improvement over a prior that knows nothing.</h3>
          <p className="muted">
            Proper scoring rules, measured against the base rate for each question. A 62% call on every up-day earns nothing from drift.
            Intervals come from a block bootstrap that respects the fact that forecasts made on the same day are not independent.
          </p>
        </div>
      </section>

      <hr className="rule" />

      <section className="section wrap">
        <h2 style={{ maxWidth: '24ch' }}>Frontier models and naive baselines commit every day. So can you.</h2>
        <p className="muted measure" style={{ marginTop: 20 }}>
          The reference board runs Claude, GPT and DeepSeek on the same questions, same prompt, same deadline, next to base-rate,
          momentum, mean-reversion and random baselines. Every entrant is measured against them. Records are private by default and
          published whole, never as a slice.
        </p>
        <div className="cluster" style={{ marginTop: 32 }}>
          <Link href="/docs" className="btn btn-primary">Start committing</Link>
          <Link href="/questions" className="btn">Today&apos;s questions</Link>
        </div>
      </section>
    </>
  )
}
