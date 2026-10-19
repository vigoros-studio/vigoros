import { ContentDraft, OgaJobs, type WorkerJobRequest } from '@vigoros/contracts'
import { approvals, artifacts, type Db } from '@vigoros/db'
import { eq } from 'drizzle-orm'
import { researchPack, scoreboard } from '../api'
import type { Env } from '../env'
import { writeToOutbox } from '../outbox'

export type JobOutcome =
  | {
      status: 'ok'
      job: string
      output: unknown
      artifact: { kind: string; title: string; content: unknown; path: string | null }
    }
  | { status: 'refused'; job: string; reason: string }
  | { status: 'failed'; job: string; detail: string }

/**
 * Runs one typed job. Every input is validated against the job surface before anything runs;
 * publishing re-reads the approval row, so the worker refuses what the runtime should never send.
 */
export const runJob = async (e: Env, db: Db, raw: WorkerJobRequest): Promise<JobOutcome> => {
  const spec = OgaJobs[raw.job]
  const parsed = spec.input.safeParse(raw.input)
  if (!parsed.success)
    return {
      status: 'refused',
      job: raw.job,
      reason: `invalid input: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    }
  try {
    if (raw.job === 'oga.research') {
      const i = parsed.data as {
        places: string[]
        grain: 'neighbourhood' | 'group' | 'district'
        changesSinceDays: number
      }
      const pack = await researchPack(e, i.places, i.grain, i.changesSinceDays)
      const out = spec.output.parse(pack)
      return {
        status: 'ok',
        job: raw.job,
        output: out,
        artifact: {
          kind: 'research_pack',
          title: `${pack.mode === 'sample' ? '[SAMPLE] ' : ''}Research pack: ${i.places.join(', ')}`,
          content: out,
          path: null,
        },
      }
    }
    if (raw.job === 'oga.scoreboard') {
      const i = parsed.data as { days: number }
      const board = await scoreboard(e, i.days)
      const out = spec.output.parse(board)
      return {
        status: 'ok',
        job: raw.job,
        output: out,
        artifact: {
          kind: 'scoreboard',
          title: `${board.mode === 'sample' ? '[SAMPLE] ' : ''}Scoreboard, last ${i.days} days`,
          content: out,
          path: null,
        },
      }
    }
    if (raw.job === 'content.publish') {
      const i = parsed.data as {
        artifactId: string
        surface: ContentDraft['surface']
        slug: string
        approvalId: string
      }
      const [approval] = await db.select().from(approvals).where(eq(approvals.id, i.approvalId))
      if (!approval || approval.status !== 'approved')
        return { status: 'refused', job: raw.job, reason: 'no approved approval row' }
      const payload = (approval.payload ?? {}) as { draft?: string }
      if (payload.draft !== i.artifactId)
        return { status: 'refused', job: raw.job, reason: 'approval is for a different draft' }
      const [row] = await db.select().from(artifacts).where(eq(artifacts.id, i.artifactId))
      if (!row) return { status: 'refused', job: raw.job, reason: 'no such draft' }
      const draft = ContentDraft.parse(row.content)
      const revised =
        typeof raw.input['revisedBody'] === 'string' ? (raw.input['revisedBody'] as string) : null
      const body = revised ?? draft.body
      const pub = writeToOutbox(e.OGA_OUTBOX, i.surface, i.slug, draft, body, {
        artifactId: row.id,
        approvalId: approval.id,
        reviewArtifactId: raw.input['reviewArtifactId'] ?? null,
        simulated: row.simulated,
        workflowId: row.workflowId,
      })
      const out = spec.output.parse(pub)
      return {
        status: 'ok',
        job: raw.job,
        output: out,
        artifact: {
          kind: 'publication',
          title: `${row.simulated ? '[SIMULATED] ' : ''}Published to outbox: ${draft.title}`,
          content: out,
          path: pub.path,
        },
      }
    }
    return { status: 'refused', job: raw.job, reason: 'unknown job' }
  } catch (err) {
    return {
      status: 'failed',
      job: raw.job,
      detail: err instanceof Error ? err.message : String(err),
    }
  }
}
