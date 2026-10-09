import {
  agents,
  approvals,
  companies,
  departments,
  events,
  runs,
  tasks,
  workflows,
} from '@vigoros/db'
import { deriveAgentState } from '@vigoros/engine'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { founder } from '@/lib/session'

export const dynamic = 'force-dynamic'

/** The 2D operational view: the company as rows. The 3D headquarters at / is the front door. */
export default async function Page() {
  const me = await founder()
  if (!me) redirect('/login')
  const d = db()
  const [company] = await d.select().from(companies)
  if (!company) {
    return (
      <main>
        <h1>Vigoros Studio</h1>
        <p className="quiet">
          No company yet. Run <code>pnpm seed</code>.
        </p>
      </main>
    )
  }
  const deps = await d.select().from(departments).where(eq(departments.companyId, company.id))
  const staff = await d.select().from(agents).where(eq(agents.companyId, company.id))
  const openTasks = await d
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.companyId, company.id),
        inArray(tasks.status, ['queued', 'running', 'waiting', 'blocked']),
      ),
    )
  const openRuns = await d
    .select({ agentId: runs.agentId })
    .from(runs)
    .where(isNull(runs.finishedAt))
  const pending = await d
    .select()
    .from(approvals)
    .where(and(eq(approvals.companyId, company.id), eq(approvals.status, 'pending')))
    .orderBy(desc(approvals.createdAt))
  const feed = await d
    .select()
    .from(events)
    .where(eq(events.companyId, company.id))
    .orderBy(desc(events.seq))
    .limit(40)

  const stateOf = (agentId: string) =>
    deriveAgentState({
      openRun: openRuns.some((r) => r.agentId === agentId),
      inOpenMeeting: false,
      openTaskStatuses: openTasks
        .filter((t) => t.ownerAgentId === agentId)
        .map((t) => t.status as 'queued' | 'running' | 'waiting' | 'blocked'),
      reviewing: false,
      justCompleted: false,
    })

  return (
    <main>
      <h1>Vigoros Studio</h1>
      <p className="quiet">
        {company.paused ? 'Paused' : 'Running'} · {staff.length} agents · {openTasks.length} open
        tasks · {pending.length} awaiting you · <a href="/auth/signout">sign out</a>
      </p>

      <h2>Decisions awaiting you</h2>
      {pending.length === 0 ? (
        <p className="quiet">Nothing pending.</p>
      ) : (
        pending.map((a) => (
          <div className="row" key={a.id}>
            <span className="grow">{a.headline}</span>
            <span className="quiet">{a.kind}</span>
          </div>
        ))
      )}

      {deps.map((dep) => {
        const members = staff.filter((a) => a.departmentId === dep.id)
        return (
          <section key={dep.id}>
            <h2>{dep.name}</h2>
            {members.length === 0 ? (
              <p className="quiet">No one hired yet.</p>
            ) : (
              members.map((a) => {
                const state = stateOf(a.id)
                const current = openTasks.find((t) => t.ownerAgentId === a.id)
                return (
                  <div className="row" key={a.id}>
                    <span>
                      <span className={`dot ${state}`} />
                      {a.name}
                    </span>
                    <span className="quiet">{a.title}</span>
                    <span className="grow quiet">
                      {current ? `${state}: ${current.title}` : state}
                    </span>
                    <span className="quiet">{a.model}</span>
                  </div>
                )
              })
            )}
          </section>
        )
      })}

      <h2>Recent events</h2>
      {feed.map((e) => (
        <div className="row" key={e.seq}>
          <span className="quiet" style={{ width: 150 }}>
            {e.createdAt.toISOString().slice(11, 19)}
          </span>
          <span className="grow">{e.caption}</span>
          <span className="quiet">{e.kind}</span>
        </div>
      ))}
    </main>
  )
}
