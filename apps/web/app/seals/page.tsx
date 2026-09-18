import type { Metadata } from 'next'
import { fmtDate, fmtInt } from '@/components/format'
import { recentSeals } from '@/lib/queries'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Seals' }

export default async function SealsPage() {
  const seals = await recentSeals(60)
  return (
    <section className="section wrap">
      <p className="label" style={{ marginBottom: 20 }}>Seals</p>
      <h1 style={{ maxWidth: '20ch' }}>Daily roots, anchored to Bitcoin.</h1>
      <p className="lede measure" style={{ marginTop: 24 }}>
        Every commitment is a leaf. Each day&apos;s leaves form a Merkle tree whose root is submitted to OpenTimestamps. A participant holds
        their leaf hash and inclusion proof; with the root and the Bitcoin attestation, existence before the deadline is provable to anyone.
      </p>
      <div className="table-scroll" style={{ marginTop: 48 }}>
        {seals.length === 0 ? (
          <p className="muted">No seal yet.</p>
        ) : (
          <table className="rows">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merkle root</th>
                <th className="r">Leaves</th>
                <th className="r">Bitcoin</th>
              </tr>
            </thead>
            <tbody>
              {seals.map((s) => (
                <tr key={s.id}>
                  <td className="num">{fmtDate(s.sealDate)}</td>
                  <td className="mono small muted" style={{ wordBreak: 'break-all' }}>{s.merkleRoot}</td>
                  <td className="r num">{fmtInt(s.leafCount)}</td>
                  <td className="r small">{s.anchoredAt ? <span className="pos">attested</span> : <span className="faint">pending</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
