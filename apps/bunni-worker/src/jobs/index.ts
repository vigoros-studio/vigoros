import {
  BunniJobRequest,
  BunniJobs,
  type BunniJobName,
  type BunniJobResult,
} from '@vigoros/contracts'
import { GuardError, type PathGuard } from '../guard'
import { assetsGet, assetsIndex } from './assets'
import { episodeCreate, episodePackage } from './episode'

/**
 * Dispatch for the whole job surface. Paid jobs are refused by configuration until the founder
 * turns them on, and even then each is capped per day. Anything unknown is refused, not guessed.
 */
export interface JobPolicy {
  paidJobsEnabled: boolean
}

export const runJob = (guard: PathGuard, policy: JobPolicy, raw: unknown): BunniJobResult => {
  const parsed = BunniJobRequest.safeParse(raw)
  if (!parsed.success)
    return {
      status: 'refused',
      job: 'assets.index',
      reason: 'invalid_input',
      detail: parsed.error.message,
    }
  const req = parsed.data
  const spec = BunniJobs[req.job as BunniJobName]
  const input = spec.input.safeParse(req.input)
  if (!input.success)
    return { status: 'refused', job: req.job, reason: 'invalid_input', detail: input.error.message }
  if (spec.paid && !policy.paidJobsEnabled)
    return {
      status: 'refused',
      job: req.job,
      reason: 'paid_jobs_disabled',
      detail: `${req.job} is a paid job and PAID_JOBS_ENABLED is false`,
    }
  try {
    switch (req.job) {
      case 'assets.index':
        return { status: 'ok', job: req.job, output: assetsIndex(guard), artifacts: [], credits: 0 }
      case 'assets.get':
        return {
          status: 'ok',
          job: req.job,
          output: assetsGet(guard, (input.data as { id: string }).id),
          artifacts: [],
          credits: 0,
        }
      case 'episode.create': {
        const out = episodeCreate(guard, input.data as never)
        return { status: 'ok', job: req.job, output: out, artifacts: out.files, credits: 0 }
      }
      case 'episode.package': {
        const out = episodePackage(guard, input.data as never)
        return {
          status: 'ok',
          job: req.job,
          output: out,
          artifacts: out.files,
          credits: out.jobs.reduce((a, j) => a + j.creditsSpent, 0),
        }
      }
      case 'publish.package':
        return {
          status: 'refused',
          job: req.job,
          reason: 'unknown_job',
          detail: 'publish.package arrives in phase 3',
        }
      case 'render.keyframe':
      case 'render.video':
      case 'qc.continuity':
      case 'qc.virality':
        return {
          status: 'refused',
          job: req.job,
          reason: 'paid_jobs_disabled',
          detail: `${req.job} is implemented in phase 2`,
        }
    }
  } catch (e) {
    if (e instanceof GuardError)
      return { status: 'refused', job: req.job, reason: 'path_guard', detail: e.message }
    return { status: 'error', job: req.job, detail: e instanceof Error ? e.message : String(e) }
  }
}
