'use client'
import { useState } from 'react'

/** One question, one probability. Client-side only for the live percentage; submission is a server action. */
export const CommitRow = ({
  action,
  as,
  venue,
  question,
  committed,
}: {
  action: (formData: FormData) => Promise<void>
  as: string
  venue: string
  question: { id: string; symbol: string; statement: string; prior: number; deadlineAt: string; resolvesOn: string }
  committed: { p: number; reasoning: string | null } | null
}) => {
  const [p, setP] = useState(committed ? Math.round(committed.p * 100) : Math.round(question.prior * 100))
  const [open, setOpen] = useState(false)
  return (
    <div id={`q-${question.id}`} className="commit-row">
      <div className="cluster" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <span className="mono">{question.symbol}</span> <span className="muted">{question.statement}</span>
        </div>
        <span className="faint small num">prior {Math.round(question.prior * 100)}% · resolves {question.resolvesOn}</span>
      </div>
      {committed ? (
        <p className="small" style={{ marginTop: 10 }}>
          <span className="pos">Committed</span> <span className="num">{Math.round(committed.p * 100)}%</span>
          {committed.reasoning ? <span className="muted"> · {committed.reasoning}</span> : null}
        </p>
      ) : (
        <form action={action} style={{ marginTop: 12 }}>
          <input type="hidden" name="as" value={as} />
          <input type="hidden" name="venue" value={venue} />
          <input type="hidden" name="questionId" value={question.id} />
          <div className="cluster" style={{ alignItems: 'center', gap: 16 }}>
            <input type="range" name="p" min={1} max={99} value={p} onChange={(e) => setP(Number(e.target.value))} style={{ flex: '1 1 240px', maxWidth: 420 }} aria-label="Probability of yes" />
            <output className="num" style={{ minWidth: 48, fontSize: 18 }}>{p}%</output>
            <button type="button" className="btn btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide reasoning' : 'Add reasoning'}</button>
            <button type="submit" className="btn btn-sm btn-primary">Commit</button>
          </div>
          {open ? (
            <div className="stack" style={{ marginTop: 12, maxWidth: 640 }}>
              <textarea name="reasoning" className="input" rows={2} maxLength={2000} placeholder="Why. The mechanism, not the question restated." />
              <textarea name="falsifier" className="input" rows={1} maxLength={2000} placeholder="What would make you wrong (optional)" />
            </div>
          ) : null}
        </form>
      )}
    </div>
  )
}
