import { agents, approvals, artifacts, runs, tasks, workflows } from '@vigoros/db'
import { eq, inArray } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { founder } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await founder())) redirect('/login')
  const { id } = await params
  const d = db()
  const [wf] = await d.select().from(workflows).where(eq(workflows.id, id))
  if (!wf) notFound()
  const steps = await d
    .select()
    .from(tasks)
    .where(eq(tasks.workflowId, id))
    .orderBy(tasks.createdAt)
  const staff = await d.select({ id: agents.id, name: agents.name }).from(agents)
  const name = (aid: string) => staff.find((a) => a.id === aid)?.name ?? aid
  const outs = await d
    .select()
    .from(artifacts)
    .where(eq(artifacts.workflowId, id))
    .orderBy(artifacts.createdAt)
  const turns = steps.length
    ? await d
        .select()
        .from(runs)
        .where(
          inArray(
            runs.taskId,
            steps.map((s) => s.id),
          ),
        )
        .orderBy(runs.startedAt)
    : []
  const gates = await d.select().from(approvals).where(eq(approvals.workflowId, id))
  return (
    <main>
      <p className="quiet">
        <a href="/ops">← operations</a> · <a href="/">3D headquarters</a>
      </p>
      <h1>
        {wf.simulated ? '[SIMULATED] ' : ''}
        {wf.title}
      </h1>
      <p className="quiet">
        {wf.status} · step {wf.step} · ${wf.spentUsd.toFixed(4)} of ${wf.capUsd.toFixed(2)} ·
        started by {name(wf.startedBy)}
        {wf.error ? ` · ${wf.error}` : ''}
      </p>
      <h2>Steps</h2>
      {steps.map((t) => (
        <div className="row" key={t.id}>
          <span className="quiet" style={{ width: 110 }}>
            {t.step}
          </span>
          <span className="grow">
            {t.title} <span className="quiet">· {name(t.ownerAgentId)}</span>
          </span>
          <span className="quiet">
            {t.status}
            {t.blockedReason ? ` · ${t.blockedReason}` : ''} · {t.turns} turn
            {t.turns === 1 ? '' : 's'}
          </span>
        </div>
      ))}
      <h2>Approvals</h2>
      {gates.length === 0 ? (
        <p className="quiet">None.</p>
      ) : (
        gates.map((g) => (
          <div className="row" key={g.id}>
            <span className="grow">{g.headline}</span>
            <span className="quiet">
              {g.status}
              {g.founderNote ? ` · "${g.founderNote}"` : ''}
              {g.decidedAt ? ` · ${g.decidedAt.toISOString()}` : ''}
            </span>
          </div>
        ))
      )}
      <h2>Runs</h2>
      {turns.map((r) => (
        <div className="row" key={r.id}>
          <span className="quiet" style={{ width: 90 }}>
            {r.adapter}
          </span>
          <span className="grow">
            {name(r.agentId)} · {r.summary ?? r.error ?? r.status}
          </span>
          <span className="quiet">
            {r.inputTokens + r.outputTokens} tok · ${r.costUsd.toFixed(4)}
          </span>
        </div>
      ))}
      <h2>Artifacts</h2>
      {outs.map((a) => (
        <div className="row" key={a.id}>
          <a className="grow" href={`/ops/artifacts/${a.id}`}>
            {a.title}
          </a>
          <span className="quiet">
            {a.path ?? a.kind}
            {a.simulated ? ' · simulated' : ''}
          </span>
        </div>
      ))}
    </main>
  )
}
