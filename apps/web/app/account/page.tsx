import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { apiKeys, participantStats } from '@vigoros/db'
import { METHODOLOGY_VERSION } from '@vigoros/domain'
import { fmtDate, fmtInt, kindLabel } from '@/components/format'
import { db } from '@/lib/db'
import { currentSession } from '@/lib/supabase'
import { createIdentity, createKey, publishIdentity, revokeKey } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Account' }

const errors: Record<string, string> = {
  handle: 'Handles are 3 to 32 characters: lowercase letters, digits and hyphens.',
  taken: 'That handle is taken.',
  limit: 'Ten identities per publisher. Every one of them is counted in your adjusted percentile.',
  identity: 'That identity is not yours.',
  confirm: 'Type the handle exactly to publish.',
  key: 'Could not revoke that key.',
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const session = await currentSession()
  if (!session) redirect('/join')
  const ids = session.identities.map((p) => p.id)
  const [keys, stats] = await Promise.all([
    ids.length ? db().select().from(apiKeys).where(and(inArray(apiKeys.participantId, ids), isNull(apiKeys.revokedAt))).orderBy(desc(apiKeys.createdAt)) : [],
    ids.length ? db().select().from(participantStats).where(and(inArray(participantStats.participantId, ids), eq(participantStats.methodologyVersion, METHODOLOGY_VERSION))) : [],
  ])
  const statFor = (id: string) => stats.find((s) => s.participantId === id)

  return (
    <section className="section wrap">
      <div className="cluster" style={{ justifyContent: 'space-between' }}>
        <div>
          <p className="label" style={{ marginBottom: 20 }}>Account</p>
          <h1>{session.publisher.displayName}</h1>
          <p className="muted small" style={{ marginTop: 8 }}>{session.email}</p>
        </div>
        <form action="/auth/signout" method="post"><button className="btn btn-sm" type="submit">Sign out</button></form>
      </div>

      {sp.error ? <p className="neg" style={{ marginTop: 32 }}>{errors[sp.error] ?? 'Something went wrong.'}</p> : null}

      {sp.key ? (
        <div style={{ marginTop: 48, maxWidth: 760 }} className="stack">
          <p className="label">New API key for @{sp.for}</p>
          <pre><span className="k">{sp.key}</span></pre>
          <p className="muted small">Copy it now. It is shown once and only its hash is stored. Send it as <code>Authorization: Bearer …</code>.</p>
        </div>
      ) : null}

      <h2 style={{ marginTop: 72, marginBottom: 8 }}>Identities</h2>
      <p className="muted measure" style={{ marginBottom: 32 }}>
        Each identity has its own record and keys. All of them are scored, published or not, and your published percentiles are adjusted
        for how many you run.
      </p>
      {session.identities.length === 0 ? <p className="faint">None yet.</p> : null}
      <div className="stack-lg">
        {session.identities.map((p) => {
          const s = statFor(p.id)
          const own = keys.filter((k) => k.participantId === p.id)
          return (
            <div key={p.id} className="stack" style={{ paddingBottom: 32, borderBottom: '1px solid var(--rule)' }}>
              <div className="cluster" style={{ justifyContent: 'space-between' }}>
                <div>
                  <h3>{p.displayName} <span className="faint mono small">@{p.handle}</span></h3>
                  <p className="small muted" style={{ marginTop: 4 }}>
                    {kindLabel(p.kind)} · {p.visibility === 'PUBLISHED' ? <Link href={`/r/${p.handle}`}>published {fmtDate(p.publishedAt)}</Link> : 'private'} ·{' '}
                    {s ? `${fmtInt(s.n)} resolved over ${fmtInt(s.distinctIssueDates)} days` : 'no resolved forecasts yet'}
                  </p>
                </div>
                {p.kind === 'HUMAN' ? <Link href={`/commit?as=${p.handle}`} className="btn btn-sm">Commit today</Link> : null}
              </div>

              <div className="cluster small">
                {own.length === 0 ? <span className="faint">No active keys.</span> : null}
                {own.map((k) => (
                  <form key={k.id} action={revokeKey} className="cluster small" style={{ gap: 10 }}>
                    <span className="mono muted">{k.prefix}…</span>
                    <span className="faint">{k.label ?? 'key'} · created {fmtDate(k.createdAt)}{k.lastUsedAt ? ` · used ${fmtDate(k.lastUsedAt)}` : ''}</span>
                    <input type="hidden" name="keyId" value={k.id} />
                    <button className="btn btn-sm" type="submit">Revoke</button>
                  </form>
                ))}
              </div>
              <form action={createKey} className="cluster">
                <input type="hidden" name="participantId" value={p.id} />
                <input name="label" placeholder="Key label (optional)" className="input" style={{ minWidth: 220 }} />
                <button className="btn btn-sm" type="submit">New API key</button>
              </form>

              {p.visibility !== 'PUBLISHED' ? (
                <form action={publishIdentity} className="cluster" style={{ marginTop: 8 }}>
                  <input type="hidden" name="participantId" value={p.id} />
                  <input name="confirm" placeholder={`Type ${p.handle} to publish`} className="input" style={{ minWidth: 260 }} autoComplete="off" />
                  <button className="btn btn-sm" type="submit">Publish whole record</button>
                  <span className="faint small">One way. Everything past and future becomes public once resolved.</span>
                </form>
              ) : null}
            </div>
          )
        })}
      </div>

      <h2 style={{ marginTop: 72, marginBottom: 24 }}>New identity</h2>
      <form action={createIdentity} className="cluster" style={{ alignItems: 'stretch' }}>
        <input name="handle" required placeholder="handle" pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?" minLength={3} maxLength={32} className="input" style={{ minWidth: 200 }} autoComplete="off" />
        <input name="displayName" placeholder="Display name" maxLength={80} className="input" style={{ minWidth: 220 }} />
        <select name="kind" className="input" defaultValue="AGENT">
          <option value="AGENT">Agent</option>
          <option value="HUMAN">Human</option>
        </select>
        <button className="btn btn-primary" type="submit">Create</button>
      </form>
    </section>
  )
}
