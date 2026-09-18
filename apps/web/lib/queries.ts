import 'server-only'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { assets, commitments, participantStats, participants, questionSets, questions, scores, sealRoots } from '@vigoros/db'
import { METHODOLOGY_VERSION, describeQuestion, type IsoDate } from '@vigoros/domain'
import { db } from './db'

export interface BoardRow {
  id: string
  handle: string
  displayName: string
  kind: typeof participants.$inferSelect.kind
  n: number
  distinctIssueDates: number
  bss: number | null
  bssLower: number | null
  bssUpper: number | null
  evidenceNats: number | null
  ece: number | null
  adjustedPValue: number | null
  identityCount: number
  coverage: number | null
  computedAt: Date
}

/** The public board: eligible, published participants ranked by lower interval bound. */
export const board = async (limit = 100): Promise<BoardRow[]> =>
  db()
    .select({
      id: participants.id,
      handle: participants.handle,
      displayName: participants.displayName,
      kind: participants.kind,
      n: participantStats.n,
      distinctIssueDates: participantStats.distinctIssueDates,
      bss: participantStats.bss,
      bssLower: participantStats.bssLower,
      bssUpper: participantStats.bssUpper,
      evidenceNats: participantStats.evidenceNats,
      ece: participantStats.ece,
      adjustedPValue: participantStats.adjustedPValue,
      identityCount: participantStats.identityCount,
      coverage: participantStats.coverage,
      computedAt: participantStats.computedAt,
    })
    .from(participantStats)
    .innerJoin(participants, eq(participants.id, participantStats.participantId))
    .where(and(eq(participantStats.methodologyVersion, METHODOLOGY_VERSION), eq(participantStats.eligible, true), eq(participants.visibility, 'PUBLISHED')))
    .orderBy(desc(participantStats.bssLower))
    .limit(limit)

/** Published participants not yet eligible, with progress toward the minimum record. */
export const buildingRecords = async (limit = 50) =>
  db()
    .select({
      handle: participants.handle,
      displayName: participants.displayName,
      kind: participants.kind,
      n: participantStats.n,
      distinctIssueDates: participantStats.distinctIssueDates,
      firstIssueDate: participantStats.firstIssueDate,
    })
    .from(participantStats)
    .innerJoin(participants, eq(participants.id, participantStats.participantId))
    .where(and(eq(participantStats.methodologyVersion, METHODOLOGY_VERSION), eq(participantStats.eligible, false), eq(participants.visibility, 'PUBLISHED')))
    .orderBy(desc(participantStats.n))
    .limit(limit)

export const participantByHandle = async (handle: string) => {
  const [p] = await db().select().from(participants).where(eq(participants.handle, handle))
  return p ?? null
}

export const statsFor = async (participantId: string) => {
  const [s] = await db()
    .select()
    .from(participantStats)
    .where(and(eq(participantStats.participantId, participantId), eq(participantStats.methodologyVersion, METHODOLOGY_VERSION)))
  return s ?? null
}

/** Revealed, scored commitments for a record page. Paginated by issue date, newest first. */
export const revealedCommitments = async (participantId: string, before: IsoDate | null, limit = 60) => {
  const rows = await db()
    .select({
      id: commitments.id,
      issueDate: commitments.issueDate,
      p: commitments.p,
      reasoning: commitments.reasoning,
      falsifier: commitments.falsifier,
      hash: commitments.hash,
      submittedAt: commitments.submittedAt,
      revealedAt: commitments.revealedAt,
      symbol: assets.symbol,
      type: questions.type,
      horizon: questions.horizon,
      threshold: questions.threshold,
      resolvesOn: questions.resolvesOn,
      prior: questions.prior,
      outcome: questions.outcome,
      brier: scores.brier,
      priorBrier: scores.priorBrier,
    })
    .from(commitments)
    .innerJoin(questions, eq(questions.id, commitments.questionId))
    .innerJoin(assets, eq(assets.id, questions.assetId))
    .leftJoin(scores, and(eq(scores.commitmentId, commitments.id), eq(scores.methodologyVersion, METHODOLOGY_VERSION)))
    .where(
      and(
        eq(commitments.participantId, participantId),
        sql`${commitments.revealedAt} is not null`,
        before ? lte(commitments.issueDate, before) : sql`true`,
      ),
    )
    .orderBy(desc(commitments.issueDate), desc(commitments.id))
    .limit(limit)
  return rows.map((r) => ({ ...r, statement: describeQuestion({ symbol: r.symbol, type: r.type, horizon: r.horizon as 5 | 10 | 21, threshold: r.threshold, resolvesOn: r.resolvesOn }) }))
}

/** Public question list for a date. Never includes any commitment. */
export const questionsForDate = async (issueDate: IsoDate) => {
  const rows = await db()
    .select({
      id: questions.id,
      symbol: assets.symbol,
      name: assets.name,
      venue: questions.venue,
      type: questions.type,
      horizon: questions.horizon,
      levelK: questions.levelK,
      threshold: questions.threshold,
      referencePrice: questions.referencePrice,
      prior: questions.prior,
      deadlineAt: questions.deadlineAt,
      resolvesOn: questions.resolvesOn,
      status: questions.status,
      outcome: questions.outcome,
    })
    .from(questions)
    .innerJoin(assets, eq(assets.id, questions.assetId))
    .where(eq(questions.issueDate, issueDate))
    .orderBy(questions.venue, assets.symbol, questions.type)
  return rows.map((r) => ({ ...r, statement: describeQuestion({ symbol: r.symbol, type: r.type, horizon: r.horizon as 5 | 10 | 21, threshold: r.threshold, resolvesOn: r.resolvesOn }) }))
}

export const latestQuestionSet = async () => {
  const [s] = await db().select().from(questionSets).orderBy(desc(questionSets.issueDate)).limit(1)
  return s ?? null
}

export const questionSetFor = async (issueDate: IsoDate) => {
  const [s] = await db().select().from(questionSets).where(eq(questionSets.issueDate, issueDate))
  return s ?? null
}

export const recentSeals = async (limit = 10) => db().select().from(sealRoots).orderBy(desc(sealRoots.sealDate)).limit(limit)

/** Site-wide counters for the landing page, each a single indexed aggregate. */
export const siteCounters = async () => {
  const [q] = await db().select({ n: sql<number>`count(*)::int` }).from(questions).where(gte(questions.issueDate, '2000-01-01'))
  const [c] = await db().select({ n: sql<number>`count(*)::int` }).from(commitments)
  const [r] = await db().select({ n: sql<number>`count(*)::int` }).from(questions).where(eq(questions.status, 'RESOLVED'))
  const [p] = await db().select({ n: sql<number>`count(*)::int` }).from(participants).where(eq(participants.visibility, 'PUBLISHED'))
  return { questions: q?.n ?? 0, commitments: c?.n ?? 0, resolved: r?.n ?? 0, participants: p?.n ?? 0 }
}
