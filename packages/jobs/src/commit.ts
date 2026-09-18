import { and, eq } from 'drizzle-orm'
import { commitments, questions } from '@vigoros/db'
import { clipProbability, newId, sealHash, type CommitmentInput, type SealedPayload } from '@vigoros/domain'
import type { JobContext } from './context.js'

export type CommitError =
  | { code: 'QUESTION_NOT_FOUND' }
  | { code: 'QUESTION_CLOSED'; deadlineAt: string }
  | { code: 'ALREADY_COMMITTED' }

export interface CommitReceipt {
  commitmentId: string
  questionId: string
  hash: string
  submittedAt: string
  p: number
}

/**
 * The single write path for a forecast. Validates the deadline against the server clock,
 * builds the sealed payload, hashes it, and inserts. Sealing into the daily Merkle root
 * happens later in sealPending(). Enforced unique (participant, question).
 */
export const commitForecast = async (
  ctx: Pick<JobContext, 'db' | 'now'>,
  participantId: string,
  input: CommitmentInput,
): Promise<{ ok: true; receipt: CommitReceipt } | { ok: false; error: CommitError }> => {
  const [q] = await ctx.db
    .select({ id: questions.id, issueDate: questions.issueDate, deadlineAt: questions.deadlineAt, status: questions.status })
    .from(questions)
    .where(eq(questions.id, input.questionId))
  if (!q) return { ok: false, error: { code: 'QUESTION_NOT_FOUND' } }
  const now = ctx.now()
  if (q.status !== 'OPEN' || now >= q.deadlineAt) {
    return { ok: false, error: { code: 'QUESTION_CLOSED', deadlineAt: q.deadlineAt.toISOString() } }
  }
  const submittedAt = now.toISOString()
  const payload: SealedPayload = {
    v: 1,
    question_id: q.id,
    participant_id: participantId,
    p: clipProbability(input.p),
    reasoning: input.reasoning ?? null,
    falsifier: input.falsifier ?? null,
    submitted_at: submittedAt,
  }
  const hash = await sealHash(payload)
  const id = newId(now)
  const inserted = await ctx.db
    .insert(commitments)
    .values({
      id,
      participantId,
      questionId: q.id,
      issueDate: q.issueDate,
      p: payload.p,
      reasoning: payload.reasoning,
      falsifier: payload.falsifier,
      hash,
      submittedAt: now,
    })
    .onConflictDoNothing({ target: [commitments.participantId, commitments.questionId] })
    .returning({ id: commitments.id })
  if (inserted.length === 0) return { ok: false, error: { code: 'ALREADY_COMMITTED' } }
  return { ok: true, receipt: { commitmentId: id, questionId: q.id, hash, submittedAt, p: payload.p } }
}

/** Bulk variant for reference participants: same payload rules, one insert per batch. */
export const commitMany = async (
  ctx: Pick<JobContext, 'db' | 'now'>,
  participantId: string,
  items: { questionId: string; issueDate: string; p: number; reasoning: string | null }[],
): Promise<number> => {
  if (items.length === 0) return 0
  const now = ctx.now()
  const submittedAt = now.toISOString()
  const rows = await Promise.all(
    items.map(async (it) => {
      const p = clipProbability(it.p)
      const payload: SealedPayload = { v: 1, question_id: it.questionId, participant_id: participantId, p, reasoning: it.reasoning, falsifier: null, submitted_at: submittedAt }
      return { id: newId(now), participantId, questionId: it.questionId, issueDate: it.issueDate, p, reasoning: it.reasoning, falsifier: null, hash: await sealHash(payload), submittedAt: now }
    }),
  )
  let inserted = 0
  for (let i = 0; i < rows.length; i += 500) {
    const r = await ctx.db
      .insert(commitments)
      .values(rows.slice(i, i + 500))
      .onConflictDoNothing({ target: [commitments.participantId, commitments.questionId] })
      .returning({ id: commitments.id })
    inserted += r.length
  }
  return inserted
}

/** Questions still open for a participant on an issue date (not yet committed, deadline ahead). */
export const openQuestionsFor = async (ctx: Pick<JobContext, 'db' | 'now'>, participantId: string, issueDate: string) => {
  const rows = await ctx.db
    .select({ q: questions, committed: commitments.id })
    .from(questions)
    .leftJoin(commitments, and(eq(commitments.questionId, questions.id), eq(commitments.participantId, participantId)))
    .where(and(eq(questions.issueDate, issueDate), eq(questions.status, 'OPEN')))
  const now = ctx.now()
  return rows.filter((r) => r.committed === null && r.q.deadlineAt > now).map((r) => r.q)
}
