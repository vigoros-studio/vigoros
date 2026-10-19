import {
  ContentStep,
  FactCheck,
  ContentPlan,
  ContentDraft,
  newId,
  type Audience,
  type EditorialReview,
  type Surface,
} from '@vigoros/contracts'
import { agents, approvals, artifacts, tasks, workflows } from '@vigoros/db'
import { activeCompany, emit, insertTask } from '@vigoros/ops'
import { and, eq, inArray } from 'drizzle-orm'
import { QUEUES, boss } from './boss'
import { db } from './db'

/**
 * The content workflow: one piece from the Managing Director's plan to the outbox. A durable row
 * whose step the runtime advances when the step's tasks are done. Re-entrant: advance() may be
 * called any number of times, from any runtime, and converges on one task per (workflow, step,
 * owner). Nothing here calls a model; agents only ever see tasks. Two steps are worker jobs.
 */

export interface ContentInput {
  focus: string
  guidance: string
  surface: Surface
  audience: Audience
  places: string[]
}

export const startContentWorkflow = async (opts: {
  subjectId: string
  startedBy: string
  title: string
  input: ContentInput
  capUsd: number
}): Promise<string> => {
  const d = db()
  const company = await activeCompany(d)
  if (!company) throw new Error('no company')
  if (company.paused) throw new Error('company is paused')
  const id = newId('workflow')
  await d.insert(workflows).values({
    id,
    companyId: company.id,
    subjectId: opts.subjectId,
    kind: 'content',
    title: opts.title,
    step: 'plan',
    startedBy: opts.startedBy,
    input: { ...opts.input },
    capUsd: opts.capUsd,
  })
  await emit(d, {
    kind: 'workflow.started',
    companyId: company.id,
    subjectId: opts.subjectId,
    agentId: null,
    departmentId: null,
    taskId: null,
    workflowId: id,
    subject: `workflows:${id}`,
    caption: `Workflow started: ${opts.title}`,
    payload: { startedBy: opts.startedBy, focus: opts.input.focus, surface: opts.input.surface },
  })
  await advance(id)
  return id
}

type Wf = typeof workflows.$inferSelect
type State = Record<string, unknown>
type TaskRow = typeof tasks.$inferSelect

const agentFor = async (companyId: string, subjectId: string | null, roleKey: string) => {
  const rows = await db()
    .select()
    .from(agents)
    .where(and(eq(agents.companyId, companyId), eq(agents.roleKey, roleKey)))
  const a = rows.find((r) => r.subjectId === subjectId) ?? rows.find((r) => r.subjectId === null)
  if (!a) throw new Error(`no agent for role ${roleKey}`)
  return a
}

const stepTasks = async (wf: Wf, step: string) =>
  db()
    .select()
    .from(tasks)
    .where(and(eq(tasks.workflowId, wf.id), eq(tasks.step, step)))

const artifactIdOf = (t: TaskRow | undefined): string | null =>
  t?.output && typeof t.output['artifactId'] === 'string'
    ? (t.output['artifactId'] as string)
    : null

const setStep = async (wf: Wf, step: string, state: State, extra: Partial<Wf> = {}) => {
  await db()
    .update(workflows)
    .set({ step, state, updatedAt: new Date(), ...extra })
    .where(eq(workflows.id, wf.id))
  await emit(db(), {
    kind: 'workflow.step',
    companyId: wf.companyId,
    subjectId: wf.subjectId,
    agentId: null,
    departmentId: null,
    taskId: null,
    workflowId: wf.id,
    subject: `workflows:${wf.id}`,
    caption: `${wf.title}: ${step}`,
    payload: { step, status: extra.status ?? wf.status },
  })
}

const finish = async (wf: Wf, status: 'done' | 'rejected' | 'failed', error?: string) => {
  // Two runtimes (or the tick and a result handler) may reach the end together; only the first finishes it.
  const updated = await db()
    .update(workflows)
    .set({ status, error: error ?? null, updatedAt: new Date(), finishedAt: new Date() })
    .where(
      and(
        eq(workflows.id, wf.id),
        inArray(workflows.status, ['running', 'awaiting_approval', 'publishing']),
      ),
    )
    .returning({ id: workflows.id })
  if (updated.length === 0) return
  await emit(db(), {
    kind: 'workflow.finished',
    companyId: wf.companyId,
    subjectId: wf.subjectId,
    agentId: null,
    departmentId: null,
    taskId: null,
    workflowId: wf.id,
    subject: `workflows:${wf.id}`,
    caption: `${wf.title}: ${status}${error ? ` (${error})` : ''}`,
    payload: { status, error: error ?? null },
  })
}

const perStepCap = (wf: Wf) => Math.max(0.1, wf.capUsd / 8)

const KIND_BY_STEP: Record<string, string> = {
  plan: 'direct.plan',
  research: 'research.pack',
  draft: 'write.draft',
  check: 'check.facts',
  revise: 'write.draft',
  recheck: 'check.facts',
  review: 'direct.review',
  publish: 'content.publish',
}

const ensure = async (
  wf: Wf,
  step: string,
  roleKey: string,
  title: string,
  input: Record<string, unknown>,
  inputArtifactIds: string[],
) => {
  const owner = await agentFor(wf.companyId, wf.subjectId, roleKey)
  return insertTask(db(), {
    kind: KIND_BY_STEP[step] ?? step,
    title,
    ownerAgentId: owner.id,
    requestedBy: 'workflow',
    input,
    inputArtifactIds,
    workflowId: wf.id,
    step,
    capUsd: perStepCap(wf),
  })
}

const failed = (list: TaskRow[]) => list.find((t) => t.status === 'failed')

const contentOf = async <T>(id: unknown, parse: (c: unknown) => T): Promise<T | null> => {
  if (typeof id !== 'string') return null
  const [row] = await db().select().from(artifacts).where(eq(artifacts.id, id))
  if (!row) return null
  try {
    return parse(row.content)
  } catch {
    return null
  }
}

const slugOf = (title: string) =>
  title
    .toLowerCase()
    .replace(/\[simulated\]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .padEnd(3, 'x')

/** Advances one workflow as far as its completed tasks allow. Safe to call repeatedly. */
export const advance = async (workflowId: string): Promise<void> => {
  const d = db()
  const [wf] = await d.select().from(workflows).where(eq(workflows.id, workflowId))
  if (!wf) return
  if (['done', 'rejected', 'failed', 'cancelled'].includes(wf.status)) return
  const company = await activeCompany(d)
  if (!company || company.id !== wf.companyId || company.paused) return
  const input = wf.input as unknown as ContentInput
  const state: State = { ...wf.state }
  const step = ContentStep.parse(wf.step)
  const done = (list: TaskRow[], n: number) => list.filter((t) => t.status === 'done').length >= n

  switch (step) {
    case 'plan': {
      const list = await stepTasks(wf, 'plan')
      if (list.length === 0)
        return void (await ensure(
          wf,
          'plan',
          'managing-director',
          `Plan: ${wf.title}`,
          {
            focus: input.focus,
            guidance: input.guidance,
            surface: input.surface,
            audience: input.audience,
            places: input.places,
          },
          [],
        ))
      const f = failed(list)
      if (f) return finish(wf, 'failed', `plan failed: ${f.blockedReason ?? ''}`)
      if (!done(list, 1)) return
      const planId = artifactIdOf(list[0])
      const plan = await contentOf(planId, (c) => ContentPlan.parse(c))
      const piece = plan?.pieces.slice().sort((a, b) => a.priority - b.priority)[0]
      state['plan'] = planId
      if (!piece) {
        await setStep(wf, 'plan', state)
        return finish(wf, 'done', 'the Managing Director decided not to publish this week')
      }
      state['piece'] = piece
      const places = piece.places.length ? piece.places : input.places
      state['places'] = places
      await setStep(wf, places.length ? 'research' : 'draft', state)
      return advance(wf.id)
    }
    case 'research': {
      const list = await stepTasks(wf, 'research')
      if (list.length === 0)
        return void (await ensure(
          wf,
          'research',
          'content-director',
          `Research pack: ${wf.title}`,
          { places: state['places'], grain: 'neighbourhood', changesSinceDays: 60 },
          [],
        ))
      const f = failed(list)
      if (f) return finish(wf, 'failed', `research failed: ${f.blockedReason ?? ''}`)
      if (!done(list, 1)) return
      state['research'] = artifactIdOf(list[0])
      await setStep(wf, 'draft', state)
      return advance(wf.id)
    }
    case 'draft':
    case 'revise': {
      const piece = (state['piece'] ?? {}) as Record<string, unknown>
      const list = await stepTasks(wf, step)
      if (list.length === 0)
        return void (await ensure(
          wf,
          step,
          'content-director',
          `${step === 'revise' ? 'Revise' : 'Draft'}: ${wf.title}`,
          {
            surface: piece['surface'],
            audience: piece['audience'],
            title: piece['title'],
            angle: piece['angle'],
            ...(step === 'revise' ? { issues: state['issues'] ?? [] } : {}),
          },
          [String(state['plan']), ...(state['research'] ? [String(state['research'])] : [])],
        ))
      const f = failed(list)
      if (f) return finish(wf, 'failed', `${step} failed: ${f.blockedReason ?? ''}`)
      if (!done(list, 1)) return
      state['draft'] = artifactIdOf(list[0])
      await setStep(wf, step === 'revise' ? 'recheck' : 'check', state)
      return advance(wf.id)
    }
    case 'check':
    case 'recheck': {
      const list = await stepTasks(wf, step)
      if (list.length === 0)
        return void (await ensure(wf, step, 'content-director', `Fact-check: ${wf.title}`, {}, [
          String(state['draft']),
          ...(state['research'] ? [String(state['research'])] : []),
        ]))
      const f = failed(list)
      if (f) return finish(wf, 'failed', `${step} failed: ${f.blockedReason ?? ''}`)
      if (!done(list, 1)) return
      const checkId = artifactIdOf(list[0])
      const check = await contentOf(checkId, (c) => FactCheck.parse(c))
      state['check'] = checkId
      if (!check) return finish(wf, 'failed', 'fact-check produced no readable verdict')
      if (check.verdict === 'fail') {
        if (step === 'recheck')
          return finish(wf, 'failed', `fact-check failed twice: ${check.issues.length} issues`)
        state['issues'] = check.issues
        await setStep(wf, 'revise', state)
        return advance(wf.id)
      }
      await setStep(wf, 'review', state)
      return advance(wf.id)
    }
    case 'review': {
      const list = await stepTasks(wf, 'review')
      if (list.length === 0)
        return void (await ensure(
          wf,
          'review',
          'managing-director',
          `Editorial review: ${wf.title}`,
          {},
          [String(state['draft']), String(state['check']), String(state['plan'])],
        ))
      const f = failed(list)
      if (f) return finish(wf, 'failed', `review failed: ${f.blockedReason ?? ''}`)
      if (!done(list, 1)) return
      const reviewId = artifactIdOf(list[0])
      state['review'] = reviewId
      const review = (await contentOf(reviewId, (c) => c as EditorialReview)) ?? null
      const draft = await contentOf(state['draft'], (c) => ContentDraft.parse(c))
      const [fresh] = await d.select().from(workflows).where(eq(workflows.id, wf.id))
      const existing = await d
        .select({ id: approvals.id })
        .from(approvals)
        .where(and(eq(approvals.workflowId, wf.id), eq(approvals.kind, 'content_publish')))
      if (existing.length === 0) {
        const approvalId = newId('approval')
        const headline = review?.headline ?? draft?.title ?? wf.title
        await d.insert(approvals).values({
          id: approvalId,
          companyId: wf.companyId,
          subjectId: wf.subjectId,
          taskId: list[0]?.id ?? null,
          workflowId: wf.id,
          requestedBy: list[0]?.ownerAgentId ?? 'workflow',
          kind: 'content_publish',
          headline: `${fresh?.simulated && !headline.startsWith('[SIMULATED]') ? '[SIMULATED] ' : ''}${headline}`,
          summary: review?.summary ?? draft?.summary ?? '',
          recommendation: review?.recommendation ?? null,
          costUsd: fresh?.spentUsd ?? null,
          payload: {
            workflowId: wf.id,
            draft: state['draft'],
            review: reviewId,
            check: state['check'],
            surface: draft?.surface ?? null,
            slug: slugOf(draft?.title ?? wf.title),
            simulated: fresh?.simulated ?? false,
          },
        })
        await emit(d, {
          kind: 'approval.requested',
          companyId: wf.companyId,
          subjectId: wf.subjectId,
          agentId: list[0]?.ownerAgentId ?? null,
          departmentId: null,
          taskId: list[0]?.id ?? null,
          workflowId: wf.id,
          subject: `approvals:${approvalId}`,
          caption: `Managing Director asks the founder: ${headline.slice(0, 120)}`,
          payload: { recommendation: review?.recommendation ?? null },
        })
        state['approvalId'] = approvalId
      } else {
        state['approvalId'] = existing[0]?.id
      }
      await setStep(wf, 'approval', state, { status: 'awaiting_approval' })
      return advance(wf.id)
    }
    case 'approval': {
      const [row] = await d
        .select()
        .from(approvals)
        .where(eq(approvals.id, String(state['approvalId'])))
      if (!row || row.status === 'pending') return
      if (row.status === 'rejected' || row.status === 'withdrawn')
        return finish(wf, 'rejected', row.founderNote ?? undefined)
      await setStep(wf, 'publish', state, { status: 'publishing' })
      return advance(wf.id)
    }
    case 'publish': {
      const list = await stepTasks(wf, 'publish')
      if (list.length === 0)
        return void (await ensure(
          wf,
          'publish',
          'content-director',
          `Publish: ${wf.title}`,
          { approvalId: state['approvalId'] },
          [String(state['draft']), String(state['review'])],
        ))
      const f = failed(list)
      if (f) return finish(wf, 'failed', `publish failed: ${f.blockedReason ?? ''}`)
      if (!done(list, 1)) return
      state['publication'] = artifactIdOf(list[0])
      await setStep(wf, 'publish', state)
      return finish(wf, 'done')
    }
  }
}

/**
 * The heartbeat. Advances every open workflow and enqueues a turn for every queued task that
 * is not already in the queue (singleton key per task), so a crashed runtime resumes cleanly.
 */
export const tick = async (): Promise<{ advanced: number; enqueued: number }> => {
  const d = db()
  const company = await activeCompany(d)
  if (!company || company.paused) return { advanced: 0, enqueued: 0 }
  const live = await d
    .select({ id: workflows.id })
    .from(workflows)
    .where(
      and(
        eq(workflows.companyId, company.id),
        inArray(workflows.status, ['running', 'awaiting_approval', 'publishing']),
      ),
    )
  for (const w of live) await advance(w.id)
  const queued = await d
    .select({ id: tasks.id, turns: tasks.turns })
    .from(tasks)
    .where(and(eq(tasks.companyId, company.id), eq(tasks.status, 'queued')))
  const b = await boss()
  let enqueued = 0
  for (const t of queued) {
    const sent = await b.send(
      QUEUES.agentTurn,
      { taskId: t.id },
      { singletonKey: `${t.id}:${t.turns}` },
    )
    if (sent) enqueued++
  }
  return { advanced: live.length, enqueued }
}
