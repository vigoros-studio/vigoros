import Link from 'next/link'
import type { Metadata } from 'next'
import { Interval } from '@/components/interval'
import { fmtBss, fmtDate, fmtInt, fmtPValue, fmtPct, kindLabel } from '@/components/format'
import { board, buildingRecords } from '@/lib/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Board' }

export default async function BoardPage() {
  const [rows, building] = await Promise.all([board(200), buildingRecords(100)])
  return (
    <section className="section wrap">
      <p className="label" style={{ marginBottom: 20 }}>Public board</p>
      <h1 style={{ maxWidth: '20ch' }}>Ranked by the lower bound, not the point estimate.</h1>
      <p className="lede measure" style={{ marginTop: 24 }}>
        A long, consistent record beats a short lucky one. Every participant shown has at least 100 resolved forecasts across 20 issue
        dates and has published their whole record.
      </p>

      <div className="table-scroll" style={{ marginTop: 56 }}>
        {rows.length === 0 ? (
          <p className="muted">No record has met the minimum yet. Records in progress are listed below.</p>
        ) : (
          <table className="rows">
            <thead>
              <tr>
                <th className="r" style={{ width: 40 }}>#</th>
                <th>Participant</th>
                <th>Kind</th>
                <th className="r">Brier skill</th>
                <th style={{ width: '22%' }}>90% interval</th>
                <th className="r">Evidence (nats)</th>
                <th className="r">Calibration error</th>
                <th className="r">Adj. p</th>
                <th className="r">Resolved</th>
                <th className="r">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="r num faint">{i + 1}</td>
                  <td><Link href={`/r/${r.handle}`}>{r.displayName}</Link></td>
                  <td className="muted">{kindLabel(r.kind)}</td>
                  <td className={`r num ${(r.bss ?? 0) >= 0 ? 'pos' : 'neg'}`}>{fmtBss(r.bss)}</td>
                  <td><Interval point={r.bss} lower={r.bssLower} upper={r.bssUpper} /></td>
                  <td className="r num muted">{r.evidenceNats === null ? '—' : r.evidenceNats.toFixed(1)}</td>
                  <td className="r num muted">{r.ece === null ? '—' : r.ece.toFixed(3)}</td>
                  <td className="r num muted" title={r.identityCount > 1 ? `Adjusted for ${r.identityCount} identities` : undefined}>
                    {fmtPValue(r.adjustedPValue)}{r.identityCount > 1 ? <span className="faint"> ×{r.identityCount}</span> : null}
                  </td>
                  <td className="r num muted">{fmtInt(r.n)}</td>
                  <td className="r num muted">{fmtPct(r.coverage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {building.length > 0 ? (
        <>
          <h2 style={{ marginTop: 96, marginBottom: 12 }}>Records in progress</h2>
          <p className="muted measure" style={{ marginBottom: 32 }}>Published, but below the minimum record. Scores are withheld until then.</p>
          <div className="table-scroll">
            <table className="rows">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Kind</th>
                  <th className="r">Resolved</th>
                  <th className="r">Issue dates</th>
                  <th className="r">Since</th>
                </tr>
              </thead>
              <tbody>
                {building.map((b) => (
                  <tr key={b.handle}>
                    <td><Link href={`/r/${b.handle}`}>{b.displayName}</Link></td>
                    <td className="muted">{kindLabel(b.kind)}</td>
                    <td className="r num muted">{fmtInt(b.n)} <span className="faint">/ 100</span></td>
                    <td className="r num muted">{fmtInt(b.distinctIssueDates)} <span className="faint">/ 20</span></td>
                    <td className="r num muted">{fmtDate(b.firstIssueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  )
}
