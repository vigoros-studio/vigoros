import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Calibration, RollingLine } from '@/components/charts'
import { Interval } from '@/components/interval'
import { Stat } from '@/components/stat'
import { fmtBss, fmtDate, fmtInt, fmtP, fmtPValue, fmtPct, kindLabel } from '@/components/format'
import { MIN_DISTINCT_ISSUE_DATES, MIN_RESOLVED_COMMITMENTS } from '@vigoros/domain'
import { participantByHandle, revealedCommitments, statsFor } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const p = await participantByHandle((await params).handle)
  return { title: p ? `${p.displayName} · Record` : 'Record' }
}

type Bins = { index: number; count: number; meanForecast: number; observedFrequency: number }[]
type Series = { date: string; bss: number; n: number }[]

export default async function RecordPage({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<{ before?: string }> }) {
  const { handle } = await params
  const { before } = await searchParams
  const p = await participantByHandle(handle)
  if (!p || p.visibility !== 'PUBLISHED') notFound()
  const [stats, commitments] = await Promise.all([statsFor(p.id), revealedCommitments(p.id, before && /^\d{4}-\d{2}-\d{2}$/.test(before) ? before : null)])
  const bins = (stats?.calibrationBins as Bins | null) ?? []
  const series = (stats?.rollingSeries as Series | null) ?? []
  const byHorizon = (stats?.bssByHorizon as Record<string, number | null> | null) ?? {}
  const byType = (stats?.bssByType as Record<string, number | null> | null) ?? {}

  return (
    <>
      <section className="section wrap">
        <p className="label" style={{ marginBottom: 20 }}>{kindLabel(p.kind)} · published {fmtDate(p.publishedAt)}</p>
        <h1>{p.displayName}</h1>
        <p className="muted mono small" style={{ marginTop: 12 }}>@{p.handle}</p>

        {!stats ? (
          <p className="muted measure" style={{ marginTop: 40 }}>No resolved forecasts yet.</p>
        ) : !stats.eligible ? (
          <div style={{ marginTop: 48 }} className="cols">
            <Stat label="Resolved forecasts" value={<>{fmtInt(stats.n)}<span className="faint" style={{ fontSize: '0.5em' }}> / {MIN_RESOLVED_COMMITMENTS}</span></>} />
            <Stat label="Issue dates" value={<>{fmtInt(stats.distinctIssueDates)}<span className="faint" style={{ fontSize: '0.5em' }}> / {MIN_DISTINCT_ISSUE_DATES}</span></>} />
            <Stat label="First commitment" value={<span style={{ fontSize: '0.6em' }}>{fmtDate(stats.firstIssueDate)}</span>} />
            <p className="muted measure" style={{ flexBasis: '100%' }}>
              Scores are withheld until the record meets the minimum. This is deliberate: a short record says almost nothing, and a
              number displayed too early is a number that will be quoted.
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 56 }} className="cols">
              <Stat label="Brier skill score" value={fmtBss(stats.bss)} tone={(stats.bss ?? 0) >= 0 ? 'pos' : 'neg'} sub={<>90% interval {fmtBss(stats.bssLower)} to {fmtBss(stats.bssUpper)}</>} />
              <Stat label="Evidence" value={stats.evidenceNats === null ? '—' : stats.evidenceNats.toFixed(1)} sub="nats of log-likelihood over the prior" />
              <Stat label="Calibration error" value={stats.ece === null ? '—' : stats.ece.toFixed(3)} sub={<>resolution {stats.resolution?.toFixed(4) ?? '—'} · reliability {stats.reliability?.toFixed(4) ?? '—'}</>} />
              <Stat label="Adjusted p-value" value={fmtPValue(stats.adjustedPValue)} sub={stats.identityCount > 1 ? `Bonferroni over ${stats.identityCount} identities` : 'one identity'} />
            </div>
            <div style={{ marginTop: 32, maxWidth: 520 }}>
              <Interval point={stats.bss} lower={stats.bssLower} upper={stats.bssUpper} />
              <div className="cluster small faint" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span>−0.15</span><span>prior</span><span>+0.15</span>
              </div>
            </div>
          </>
        )}
      </section>

      {stats?.eligible ? (
        <>
          <hr className="rule" />
          <section className="section wrap cols">
            <div style={{ flex: '2 1 460px' }} className="stack">
              <p className="label">Rolling 63-day skill</p>
              <RollingLine series={series} />
            </div>
            <div className="stack">
              <p className="label">Calibration</p>
              <Calibration bins={bins} />
            </div>
          </section>
          <hr className="rule" />
          <section className="section-tight wrap cols">
            <div>
              <p className="label" style={{ marginBottom: 16 }}>By horizon</p>
              <table className="rows" style={{ maxWidth: 360 }}>
                <tbody>
                  {['5', '10', '21'].map((h) => (
                    <tr key={h}><td className="muted">{h} trading days</td><td className={`r num ${(byHorizon[h] ?? 0) >= 0 ? 'pos' : 'neg'}`}>{fmtBss(byHorizon[h] ?? null)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="label" style={{ marginBottom: 16 }}>By question type</p>
              <table className="rows" style={{ maxWidth: 360 }}>
                <tbody>
                  {[['LEVEL', 'Level'], ['RELATIVE', 'Relative'], ['QUINTILE', 'Quintile']].map(([k, label]) => (
                    <tr key={k}><td className="muted">{label}</td><td className={`r num ${(byType[k!] ?? 0) >= 0 ? 'pos' : 'neg'}`}>{fmtBss(byType[k!] ?? null)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="label" style={{ marginBottom: 16 }}>Record</p>
              <table className="rows" style={{ maxWidth: 360 }}>
                <tbody>
                  <tr><td className="muted">Resolved forecasts</td><td className="r num">{fmtInt(stats.n)}</td></tr>
                  <tr><td className="muted">Issue dates</td><td className="r num">{fmtInt(stats.distinctIssueDates)}</td></tr>
                  <tr><td className="muted">Coverage</td><td className="r num">{fmtPct(stats.coverage)}</td></tr>
                  <tr><td className="muted">Span</td><td className="r num small">{fmtDate(stats.firstIssueDate)} – {fmtDate(stats.lastIssueDate)}</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <hr className="rule" />
      <section className="section wrap">
        <div className="cluster" style={{ justifyContent: 'space-between', marginBottom: 24 }}>
          <h2>Revealed forecasts</h2>
          <span className="small faint">Shown only after the market resolved them. Hashes are the sealed leaves.</span>
        </div>
        {commitments.length === 0 ? (
          <p className="muted">Nothing has resolved yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="rows">
              <thead>
                <tr>
                  <th>Issued</th>
                  <th>Question</th>
                  <th className="r">Forecast</th>
                  <th className="r">Prior</th>
                  <th className="r">Outcome</th>
                  <th className="r">Skill</th>
                  <th>Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {commitments.map((c) => {
                  const skill = c.brier !== null && c.priorBrier !== null ? c.priorBrier - c.brier : null
                  return (
                    <tr key={c.id}>
                      <td className="num muted small">{c.issueDate}</td>
                      <td>{c.statement}</td>
                      <td className="r num">{fmtP(c.p)}</td>
                      <td className="r num muted">{fmtP(c.prior)}</td>
                      <td className="r num">{c.outcome === null ? '—' : c.outcome === 1 ? 'Yes' : 'No'}</td>
                      <td className={`r num ${(skill ?? 0) >= 0 ? 'pos' : 'neg'}`}>{skill === null ? '—' : fmtBss(skill)}</td>
                      <td className="muted small" style={{ maxWidth: 380 }}>{c.reasoning ?? <span className="faint">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {commitments.length >= 60 ? (
              <p style={{ marginTop: 24 }}>
                <a className="btn btn-sm" href={`/r/${p.handle}?before=${commitments[commitments.length - 1]!.issueDate}`}>Earlier</a>
              </p>
            ) : null}
          </div>
        )}
      </section>
    </>
  )
}
