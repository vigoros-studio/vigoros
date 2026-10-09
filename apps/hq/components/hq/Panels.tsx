'use client'
import type { Snapshot } from '@vigoros/ops'
import { useEffect, useState } from 'react'
import { STATE_LABEL } from '@/lib/layout'
import { useHq } from '@/lib/store'

const money = (n: number) => `$${n.toFixed(n < 0.01 && n > 0 ? 4 : 2)}`
const when = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** The HTML layer over the scene: header, department rail, detail panel, event ticker. */
export function Panels({ adapterMode }: { adapterMode: string }) {
  const snapshot = useHq((s) => s.snapshot)
  const selection = useHq((s) => s.selection)
  const connection = useHq((s) => s.connection)
  const select = useHq((s) => s.select)
  const setFocus = useHq((s) => s.setFocus)
  const refresh = useHq((s) => s.refresh)
  const goHome = useHq((s) => s.goHome)
  if (!snapshot) return <div className="hq-loading">Loading the headquarters…</div>
  const simulated = adapterMode !== 'anthropic'
  const pending = snapshot.pendingApprovals.length

  const togglePause = async () => {
    await fetch('/api/company', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paused: !snapshot.company.paused, reason: 'boardroom switch' }),
    })
    await refresh()
  }

  return (
    <>
      <header className="hq-header">
        <div>
          <strong>{snapshot.company.name}</strong>
          <span className={`pill ${simulated ? 'sim' : 'real'}`}>
            {simulated ? 'SIMULATION · fake adapter, no model calls' : 'LIVE MODELS'}
          </span>
          <span className={`pill conn ${connection}`}>{connection}</span>
          {snapshot.company.paused && (
            <span className="pill paused">
              PAUSED{snapshot.company.pausedReason ? `: ${snapshot.company.pausedReason}` : ''}
            </span>
          )}
        </div>
        <div className="hq-actions">
          <button
            className="ghost"
            onClick={() => {
              select({ kind: 'boardroom' })
            }}
          >
            Boardroom{pending ? ` · ${pending}` : ''}
          </button>
          <button className="ghost" onClick={goHome} title="Home">
            Overview
          </button>
          <a className="ghost" href="/ops">
            2D view
          </a>
          <button className={snapshot.company.paused ? 'resume' : 'danger'} onClick={togglePause}>
            {snapshot.company.paused ? 'Resume company' : 'Pause company'}
          </button>
        </div>
      </header>

      <nav className="hq-rail">
        {snapshot.departments.map((d) => {
          const members = snapshot.agents.filter((a) => a.departmentId === d.id)
          return (
            <button
              key={d.id}
              className={`rail-item${selection?.kind === 'department' && selection.id === d.id ? ' active' : ''}`}
              onClick={() => {
                select({ kind: 'department', id: d.id })
                setFocus({
                  x: d.room.origin[0] + d.room.size[0] / 2,
                  z: d.room.origin[1] + d.room.size[1] / 2,
                  zoom: 1.6,
                })
              }}
            >
              <span className={`lamp${d.activity > 0 ? ' on' : ''}`} />
              <span className="grow">{d.name}</span>
              <span className="quiet">
                {members.length ? `${d.activity}/${members.length}` : '—'}
              </span>
            </button>
          )
        })}
        <div className="rail-flows">
          {snapshot.workflows.slice(0, 4).map((w) => (
            <button
              key={w.id}
              className={`rail-item${selection?.kind === 'workflow' && selection.id === w.id ? ' active' : ''}`}
              onClick={() => select({ kind: 'workflow', id: w.id })}
            >
              <span className={`lamp ${w.status}`} />
              <span className="grow">
                {w.simulated ? <em>sim </em> : null}
                {w.title}
              </span>
              <span className="quiet">{w.step}</span>
            </button>
          ))}
        </div>
      </nav>

      {selection && (
        <aside className="hq-panel">
          <button className="close" onClick={() => select(null)} aria-label="Close">
            ×
          </button>
          {selection.kind === 'agent' && <AgentPanel id={selection.id} snapshot={snapshot} />}
          {selection.kind === 'department' && (
            <DepartmentPanel id={selection.id} snapshot={snapshot} />
          )}
          {selection.kind === 'boardroom' && <BoardroomPanel snapshot={snapshot} />}
          {selection.kind === 'workflow' && <WorkflowPanel id={selection.id} />}
        </aside>
      )}

      <footer className="hq-ticker">
        {snapshot.recentEvents.slice(0, 6).map((e) => (
          <div key={e.seq}>
            <span className="quiet">{when(e.createdAt)}</span> {e.caption}
          </div>
        ))}
      </footer>
    </>
  )
}

interface AgentDetail {
  agent: {
    id: string
    name: string
    title: string
    roleKey: string
    model: string
    tier: number
    department: string | null
  }
  role: {
    purpose: string
    tools: string[]
    effort: string
    maxTurnsPerTask: number
    perRunCapUsd: number
    version: number
  } | null
  tasks: {
    id: string
    title: string
    status: string
    kind: string
    step: string | null
    workflowId: string | null
    updatedAt: string
    blockedReason: string | null
  }[]
  runs: {
    id: string
    status: string
    model: string
    adapter: string
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    costUsd: number
    summary: string | null
    error: string | null
    startedAt: string
  }[]
  artifacts: {
    id: string
    kind: string
    title: string
    simulated: boolean
    content: unknown
    createdAt: string
  }[]
  decisions: { id: string; question: string; chosen: string; reasoning: string }[]
  messages: { id: string; body: string; createdAt: string }[]
  usage: { todayUsd: number; totalUsd: number; runs: number }
}

function AgentPanel({ id, snapshot }: { id: string; snapshot: Snapshot }) {
  const [detail, setDetail] = useState<AgentDetail | null>(null)
  const [text, setText] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const live = snapshot.agents.find((a) => a.id === id)
  const refresh = useHq((s) => s.refresh)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((d: AgentDetail) => {
        if (!cancelled) setDetail(d)
      })
    return () => {
      cancelled = true
    }
  }, [id, snapshot.lastSeq])
  if (!live) return <p className="quiet">This agent is no longer active.</p>
  const send = async () => {
    const t = text.trim()
    if (!t) return
    const res = await fetch(`/api/agents/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: t }),
    })
    const j = (await res.json()) as { taskId?: string; error?: string }
    setSent(j.taskId ? `Queued as task ${j.taskId}` : (j.error ?? 'failed'))
    setText('')
    await refresh()
  }
  return (
    <div>
      <h3>
        {live.name} <span className="quiet">{live.title}</span>
      </h3>
      <p className={`state ${live.state}`}>{STATE_LABEL[live.state]}</p>
      {detail?.role && <p className="quiet">{detail.role.purpose}</p>}
      <dl>
        <dt>Assignment</dt>
        <dd>
          {live.currentTask ? `${live.currentTask.title} · ${live.currentTask.status}` : 'none'}
        </dd>
        <dt>Model</dt>
        <dd>
          {live.model} · effort {detail?.role?.effort ?? '—'} · tier {live.tier}
        </dd>
        <dt>Usage</dt>
        <dd>
          {detail
            ? `${detail.usage.runs} runs · today ${money(detail.usage.todayUsd)} · total ${money(detail.usage.totalUsd)}`
            : '…'}
        </dd>
        <dt>Tools</dt>
        <dd className="quiet">{detail?.role?.tools.join(', ') ?? '…'}</dd>
      </dl>
      <h4>Instruct</h4>
      <div className="instruct">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Tell ${live.name} something. It becomes a task the runtime executes.`}
          rows={3}
        />
        <button onClick={send} disabled={!text.trim()}>
          Send as task
        </button>
        {sent && <p className="quiet">{sent}</p>}
      </div>
      <h4>Latest output</h4>
      {detail?.artifacts[0] ? (
        <Artifact a={detail.artifacts[0]} />
      ) : (
        <p className="quiet">Nothing produced yet.</p>
      )}
      <h4>Recent tasks</h4>
      {detail?.tasks.map((t) => (
        <div className="line" key={t.id}>
          <span className={`dot ${t.status}`} />
          <span className="grow">{t.title}</span>
          <span className="quiet">{t.status}</span>
        </div>
      ))}
      <h4>Recent runs</h4>
      {detail?.runs.map((r) => (
        <div className="line" key={r.id}>
          <span className={`pill ${r.adapter === 'fake' ? 'sim' : 'real'} small`}>{r.adapter}</span>
          <span className="grow">{r.summary ?? r.error ?? r.status}</span>
          <span className="quiet">
            {r.inputTokens + r.outputTokens} tok · {money(r.costUsd)}
          </span>
        </div>
      ))}
      {detail && detail.messages.length > 0 && (
        <>
          <h4>Said to you</h4>
          {detail.messages.map((m) => (
            <p key={m.id} className="msg">
              {m.body}
            </p>
          ))}
        </>
      )}
    </div>
  )
}

function Artifact({
  a,
}: {
  a: { id: string; kind: string; title: string; simulated: boolean; content: unknown }
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="artifact">
      <div className="line">
        {a.simulated && <span className="pill sim small">simulated</span>}
        <span className="grow">{a.title}</span>
        <button className="ghost small" onClick={() => setOpen(!open)}>
          {open ? 'hide' : 'show'}
        </button>
      </div>
      {open && <pre>{JSON.stringify(a.content, null, 2)}</pre>}
    </div>
  )
}

function DepartmentPanel({ id, snapshot }: { id: string; snapshot: Snapshot }) {
  const d = snapshot.departments.find((x) => x.id === id)
  const select = useHq((s) => s.select)
  if (!d) return null
  const members = snapshot.agents.filter((a) => a.departmentId === id)
  return (
    <div>
      <h3>{d.name}</h3>
      <p className="quiet">
        {d.activity} of {members.length} working{d.paused ? ' · paused' : ''}
      </p>
      {members.length === 0 && <p className="quiet">No one hired here yet. The room is dark.</p>}
      {members.map((a) => (
        <button
          key={a.id}
          className="line as-button"
          onClick={() => select({ kind: 'agent', id: a.id })}
        >
          <span className={`dot ${a.state}`} />
          <span className="grow">
            {a.name} <span className="quiet">{a.title}</span>
          </span>
          <span className="quiet">
            {a.currentTask ? a.currentTask.status : STATE_LABEL[a.state]}
          </span>
        </button>
      ))}
    </div>
  )
}

interface ApprovalDetail {
  approval: {
    id: string
    headline: string
    summary: string
    recommendation: string | null
    costUsd: number | null
    kind: string
    createdAt: string
    status: string
    payload: Record<string, unknown>
  }
  evidence: { id: string; kind: string; title: string; simulated: boolean; content: unknown }[]
}

function BoardroomPanel({ snapshot }: { snapshot: Snapshot }) {
  const [openId, setOpenId] = useState<string | null>(snapshot.pendingApprovals[0]?.id ?? null)
  const [detail, setDetail] = useState<ApprovalDetail | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const refresh = useHq((s) => s.refresh)
  useEffect(() => {
    if (!openId) return setDetail(null)
    let cancelled = false
    fetch(`/api/approvals/${openId}`)
      .then((r) => r.json())
      .then((d: ApprovalDetail) => {
        if (!cancelled) setDetail(d)
      })
    return () => {
      cancelled = true
    }
  }, [openId])
  const decide = async (decision: 'approved' | 'rejected') => {
    if (!openId) return
    setBusy(true)
    await fetch(`/api/approvals/${openId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decision, note }),
    })
    setBusy(false)
    setNote('')
    setOpenId(null)
    await refresh()
  }
  const director = snapshot.agents.find((a) => a.roleKey === 'studio-director')
  return (
    <div>
      <h3>Boardroom</h3>
      <p className="quiet">
        {snapshot.pendingApprovals.length} decision
        {snapshot.pendingApprovals.length === 1 ? '' : 's'} awaiting you
        {director ? ` · Director is ${STATE_LABEL[director.state]}` : ''}
      </p>
      {snapshot.pendingApprovals.map((p) => (
        <button
          key={p.id}
          className={`line as-button${openId === p.id ? ' active' : ''}`}
          onClick={() => setOpenId(p.id)}
        >
          <span className="grow">{p.headline}</span>
          <span className="quiet">{p.recommendation ?? p.kind}</span>
        </button>
      ))}
      {detail && (
        <div className="approval">
          <h4>{detail.approval.headline}</h4>
          <p>{detail.approval.summary}</p>
          <p className="quiet">
            Recommendation: <strong>{detail.approval.recommendation ?? '—'}</strong> · spent so far{' '}
            {money(detail.approval.costUsd ?? 0)} · {detail.approval.kind}
          </p>
          <h4>Evidence</h4>
          {detail.evidence.map((a) => (
            <Artifact key={a.id} a={a} />
          ))}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note for the record (optional)"
            rows={2}
          />
          <div className="decide">
            <button className="approve" disabled={busy} onClick={() => decide('approved')}>
              Approve
            </button>
            <button className="danger" disabled={busy} onClick={() => decide('rejected')}>
              Reject
            </button>
          </div>
          <p className="quiet small">
            Approving lets the Production Manager send this script to the Bunni worker. Rejecting
            ends the workflow. Both are recorded.
          </p>
        </div>
      )}
      <h4>Workflows</h4>
      {snapshot.workflows.map((w) => (
        <div className="line" key={w.id}>
          <span className={`lamp ${w.status}`} />
          <span className="grow">
            {w.simulated && <span className="pill sim small">sim</span>} {w.title}
          </span>
          <span className="quiet">
            {w.status} · {w.step} · {money(w.spentUsd)}
          </span>
        </div>
      ))}
    </div>
  )
}

interface WorkflowDetail {
  workflow: {
    id: string
    title: string
    status: string
    step: string
    simulated: boolean
    spentUsd: number
    capUsd: number
    state: Record<string, unknown>
    error: string | null
  }
  tasks: {
    id: string
    step: string | null
    title: string
    status: string
    ownerAgentId: string
    turns: number
    blockedReason: string | null
  }[]
  artifacts: { id: string; kind: string; title: string; simulated: boolean; path: string | null }[]
  runs: { id: string; taskId: string; adapter: string; status: string; costUsd: number }[]
}

function WorkflowPanel({ id }: { id: string }) {
  const [d, setD] = useState<WorkflowDetail | null>(null)
  const snapshot = useHq((s) => s.snapshot)
  useEffect(() => {
    let cancelled = false
    fetch(`/api/workflows/${id}`)
      .then((r) => r.json())
      .then((x: WorkflowDetail) => {
        if (!cancelled) setD(x)
      })
    return () => {
      cancelled = true
    }
  }, [id, snapshot?.lastSeq])
  if (!d) return <p className="quiet">…</p>
  const name = (agentId: string) => snapshot?.agents.find((a) => a.id === agentId)?.name ?? agentId
  return (
    <div>
      <h3>
        {d.workflow.simulated && <span className="pill sim small">simulated</span>}{' '}
        {d.workflow.title}
      </h3>
      <p className="quiet">
        {d.workflow.status} · step {d.workflow.step} · {money(d.workflow.spentUsd)} of{' '}
        {money(d.workflow.capUsd)}
        {d.workflow.error ? ` · ${d.workflow.error}` : ''}
      </p>
      <h4>Steps</h4>
      {d.tasks.map((t) => (
        <div className="line" key={t.id}>
          <span className={`dot ${t.status}`} />
          <span className="grow">
            <span className="quiet">{t.step}</span> {t.title}{' '}
            <span className="quiet">· {name(t.ownerAgentId)}</span>
          </span>
          <span className="quiet">
            {t.status}
            {t.blockedReason ? ` · ${t.blockedReason}` : ''}
          </span>
        </div>
      ))}
      <h4>Artifacts</h4>
      {d.artifacts.map((a) => (
        <div className="line" key={a.id}>
          {a.simulated && <span className="pill sim small">sim</span>}
          <span className="grow">{a.title}</span>
          <span className="quiet">{a.path ?? a.kind}</span>
        </div>
      ))}
      <p className="quiet small">
        <a href={`/ops/workflows/${d.workflow.id}`}>Open in the 2D view</a>
      </p>
    </div>
  )
}
