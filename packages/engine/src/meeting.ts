/**
 * A meeting is a bounded exchange: a chair, at most four participants, one question,
 * at most three rounds, and exactly one of three outcomes. Round three without an outcome
 * is closed by the runtime as a blocker.
 */
export const MEETING_MAX_PARTICIPANTS = 4
export const MEETING_MAX_ROUNDS = 3

export type MeetingOutcome =
  | { kind: 'decision'; decisionId: string }
  | { kind: 'action'; taskId: string }
  | { kind: 'blocker'; summary: string }

export type MeetingVerdict =
  | { ok: true }
  | { ok: false; reason: 'too_many_participants' | 'no_question' | 'chair_not_participant' }

export const validateMeeting = (m: {
  chair: string
  participants: readonly string[]
  question: string
}): MeetingVerdict => {
  if (m.participants.length > MEETING_MAX_PARTICIPANTS)
    return { ok: false, reason: 'too_many_participants' }
  if (!m.question.trim()) return { ok: false, reason: 'no_question' }
  if (!m.participants.includes(m.chair)) return { ok: false, reason: 'chair_not_participant' }
  return { ok: true }
}

export const mustCloseAsBlocker = (round: number, outcome: MeetingOutcome | null): boolean =>
  round >= MEETING_MAX_ROUNDS && outcome === null
