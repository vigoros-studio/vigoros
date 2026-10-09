import { EpisodeStep, newId, Ranking, type ApprovalItem } from '@vigoros/contracts'
import { agents, approvals, artifacts, companies, tasks, workflows } from '@vigoros/db'
import { emit, insertTask } from '@vigoros/ops'
import { and, eq, inArray } from 'drizzle-orm'
import { QUEUES, boss } from './boss'
import { db } from './db'

/**
 * The episode workflow. A durable row whose step the runtime advances when the step's tasks are done.
 * Re-entrant: advance() may be called any number of times, from any runtime, and converges on one
 * task per (workflow, step, owner). Nothing here calls a model; agents only ever see tasks.
 */

export interface EpisodeInput {
  focus: string
  guidance: string
  returnCount: number
}

export const startEpisodeWorkflow = async (opts: {
  characterId: string
  startedBy: string
  title: string
  input: EpisodeInput
  capUsd: number
}): Promise<string> => {
  const d = db()
  const [company] = await d.select().from(companies).limit(1)
  if (!company) throw new Error('no company')
  if (company.paused) throw new Error('company is paused')
  const id = newId('workflow')
  await d.insert(workflows).values({
    id,
    companyId: company.id,
    characterId: opts.characterId,
    kind: 'episode',
    title: opts.title,
    step: 'research',
    startedBy: opts.startedBy,
    input: { ...opts.input },
    capUsd: opts.capUsd,
  })
  await emit(d, {
    kind: 'workflow.started',
    companyId: company.id,
    characterId: opts.characterId,
    agentId: null,
    departmentId: null,
    taskId: null,
    workflowId: id,
    subject: `workflows:${id}`,
    caption: `Workflow started: ${opts.title}`,
    payload: { startedBy: opts.startedBy, focus: opts.input.focus },
  })
  await advance(id)
  return id
}

type Wf = typeof workflows.$inferSelect
type State = Record<string, unknown>

const agentFor = async (characterId: string | null, roleKey: string) => {
  const rows = await db().select().from(agents).where(eq(agents.roleKey, roleKey))
  const a = rows.find((r) => r.characterId === characterId || r.characterId === null)
  if (!a) throw new Error(`no agent for role ${roleKey}`)
  return a
}

const stepTasks = async (wf: Wf, step: string) =>
  db()
    .select()
    .from(tasks)
    .where(and(eq(tasks.workflowId, wf.id), eq(tasks.step, step)))

const artifactIdOf = (t: typeof tasks.$inferSelect | undefined): string | null =>
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
    characterId: wf.characterId,
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
        inArray(workflows.status, ['running', 'awaiting_approval', 'producing']),
      ),
    )
    .returning({ id: workflows.id })
  if (updated.length === 0) return
  await emit(db(), {
    kind: 'workflow.finished',
    companyId: wf.companyId,
    characterId: wf.characterId,
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

const ensure = async (
  wf: Wf,
  step: string,
  roleKey: string,
  title: string,
  input: Record<string, unknown>,
  inputArtifactIds: string[],
) => {
  const owner = await agentFor(wf.characterId, roleKey)
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

const KIND_BY_STEP: Record<string, string> = {
  research: 'research.opportunities',
  pick: 'direct.pick',
  write: 'write.script',
  review: 'review.rank',
  plan: 'plan.measurement',
  approval_item: 'direct.approval-item',
  produce: 'produce.dispatch',
  estimate: 'produce.estimate',
}

const failedOrBlocked = (list: (typeof tasks.$inferSelect)[]) =>
  list.find((t) => t.status === 'failed')

/** Advances one workflow as far as its completed tasks allow. Safe to call repeatedly. */
export const advance = async (workflowId: string): Promise<void> => {
  const d = db()
  const [wf] = await d.select().from(workflows).where(eq(workflows.id, workflowId))
  if (!wf) return
  if (['done', 'rejected', 'failed', 'cancelled'].includes(wf.status)) return
  const [company] = await d.select().from(companies).where(eq(companies.id, wf.companyId))
  if (!company || company.paused) return
  const input = wf.input as unknown as EpisodeInput
  const state: State = { ...wf.state }
  const step = EpisodeStep.parse(wf.step)

  const done = async (list: (typeof tasks.$inferSelect)[], n: number) =>
    list.filter((t) => t.status === 'done').length >= n

  switch (step) {
    case 'research': {
      const list = await stepTasks(wf, 'research')
      if (list.length === 0)
        return void (await ensure(
          wf,
          'research',
          'trend-researcher',
          `Research: ${input.focus}`,
          { focus: input.focus },
          [],
        ))
      const f = failedOrBlocked(list)
      if (f) return finish(wf, 'failed', `research failed: ${f.blockedReason ?? ''}`)
      if (!(await done(list, 1))) return
      state['research'] = artifactIdOf(list[0])
      await setStep(wf, 'pick', state)
      return advance(wf.id)
    }
    case 'pick': {
      const list = await stepTasks(wf, 'pick')
      if (list.length === 0)
        return void (await ensure(
          wf,
          'pick',
          'studio-director',
          `Pick an opportunity: ${wf.title}`,
          { guidance: input.guidance },
          [String(state['research'])],
        ))
      const f = failedOrBlocked(list)
      if (f) return finish(wf, 'failed', `pick failed: ${f.blockedReason ?? ''}`)
      if (!(await done(list, 1))) return
      state['brief'] = artifactIdOf(list[0])
      await setStep(wf, 'write', state)
      return advance(wf.id)
    }
    case 'write': {
      const list = await stepTasks(wf, 'write')
      if (list.length < 2) {
        await ensure(
          wf,
          'write',
          'comedy-writer-a',
          `Script draft (Writer A): ${wf.title}`,
          { direction: input.guidance, candidate: 'Writer A' },
          [String(state['brief'])],
        )
        await ensure(
          wf,
          'write',
          'comedy-writer-b',
          `Script draft (Writer B): ${wf.title}`,
          { direction: input.guidance, candidate: 'Writer B' },
          [String(state['brief'])],
        )
        return
      }
      const f = failedOrBlocked(list)
      if (f) return finish(wf, 'failed', `writing failed: ${f.blockedReason ?? ''}`)
      if (!(await done(list, 2))) return
      const byRole: Record<string, string> = {}
      for (const t of list) {
        const [owner] = await d
          .select({ roleKey: agents.roleKey })
          .from(agents)
          .where(eq(agents.id, t.ownerAgentId))
        const aid = artifactIdOf(t)
        if (owner && aid)
          byRole[owner.roleKey === 'comedy-writer-a' ? 'Writer A' : 'Writer B'] = aid
      }
      state['scripts'] = byRole
      await setStep(wf, 'review', state)
      return advance(wf.id)
    }
    case 'review': {
      const scripts = (state['scripts'] ?? {}) as Record<string, string>
      const list = await stepTasks(wf, 'review')
      if (list.length === 0)
        return void (await ensure(
          wf,
          'review',
          'creative-reviewer',
          `Rank the scripts: ${wf.title}`,
          { returnCount: input.returnCount },
          Object.values(scripts),
        ))
      const f = failedOrBlocked(list)
      if (f) return finish(wf, 'failed', `review failed: ${f.blockedReason ?? ''}`)
      if (!(await done(list, 1))) return
      const rankingId = artifactIdOf(list[0])
      state['ranking'] = rankingId
      const [art] = rankingId
        ? await d.select().from(artifacts).where(eq(artifacts.id, rankingId))
        : []
      const ranking = art ? Ranking.safeParse(art.content) : null
      const winnerName = ranking?.success ? ranking.data.winner : undefined
      const winner =
        (winnerName && scripts[winnerName]) ||
        (ranking?.success
          ? scripts[
              ranking.data.ranked.slice().sort((a, b) => b.score - a.score)[0]?.candidate ?? ''
            ]
          : undefined) ||
        Object.values(scripts)[0]
      state['winningScript'] = winner
      state['winnerName'] = winnerName ?? Object.keys(scripts)[0]
      await setStep(wf, 'plan', state)
      return advance(wf.id)
    }
    case 'plan': {
      const list = await stepTasks(wf, 'plan')
      if (list.length === 0)
        return void (await ensure(
          wf,
          'plan',
          'performance-analyst',
          `Measurement plan: ${wf.title}`,
          {},
          [String(state['brief']), String(state['ranking']), String(state['winningScript'])],
        ))
      const f = failedOrBlocked(list)
      if (f) return finish(wf, 'failed', `plan failed: ${f.blockedReason ?? ''}`)
      if (!(await done(list, 1))) return
      state['plan'] = artifactIdOf(list[0])
      await setStep(wf, 'approval_item', state)
      return advance(wf.id)
    }
    case 'approval_item': {
      const list = await stepTasks(wf, 'approval_item')
      if (list.length === 0)
        return void (await ensure(
          wf,
          'approval_item',
          'studio-director',
          `Approval item: ${wf.title}`,
          { winner: state['winnerName'] },
          [
            String(state['brief']),
            String(state['ranking']),
            String(state['winningScript']),
            String(state['plan']),
          ],
        ))
      const f = failedOrBlocked(list)
      if (f) return finish(wf, 'failed', `approval item failed: ${f.blockedReason ?? ''}`)
      if (!(await done(list, 1))) return
      const itemId = artifactIdOf(list[0])
      state['approvalItem'] = itemId
      const [art] = itemId ? await d.select().from(artifacts).where(eq(artifacts.id, itemId)) : []
      const item = (art?.content ?? {}) as ApprovalItem
      const [fresh] = await d.select().from(workflows).where(eq(workflows.id, wf.id))
      const approvalId = newId('approval')
      const existing = await d
        .select({ id: approvals.id })
        .from(approvals)
        .where(and(eq(approvals.workflowId, wf.id), eq(approvals.kind, 'episode_to_production')))
      if (existing.length === 0) {
        await d.insert(approvals).values({
          id: approvalId,
          companyId: wf.companyId,
          characterId: wf.characterId,
          taskId: list[0]?.id ?? null,
          workflowId: wf.id,
          requestedBy: list[0]?.ownerAgentId ?? 'workflow',
          kind: 'episode_to_production',
          headline: `${fresh?.simulated && !(item.headline ?? '').startsWith('[SIMULATED]') ? '[SIMULATED] ' : ''}${item.headline ?? wf.title} — ${wf.title}`,
          summary: item.summary ?? '',
          recommendation: item.recommendation ?? null,
          costUsd: fresh?.spentUsd ?? null,
          payload: {
            workflowId: wf.id,
            winningScript: state['winningScript'],
            winnerName: state['winnerName'],
            plan: state['plan'],
            ranking: state['ranking'],
            simulated: fresh?.simulated ?? false,
          },
        })
        await emit(d, {
          kind: 'approval.requested',
          companyId: wf.companyId,
          characterId: wf.characterId,
          agentId: list[0]?.ownerAgentId ?? null,
          departmentId: null,
          taskId: list[0]?.id ?? null,
          workflowId: wf.id,
          subject: `approvals:${approvalId}`,
          caption: `Director asks the founder: ${item.headline ?? wf.title}`,
          payload: { recommendation: item.recommendation ?? null },
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
      await setStep(wf, 'produce', state, { status: 'producing' })
      return advance(wf.id)
    }
    case 'produce': {
      const list = await stepTasks(wf, 'produce')
      if (list.length === 0)
        return void (await ensure(
          wf,
          'produce',
          'production-manager',
          `Create the episode in production: ${wf.title}`,
          { approvalId: state['approvalId'] },
          [String(state['brief']), String(state['winningScript'])],
        ))
      const f = failedOrBlocked(list)
      if (f) return finish(wf, 'failed', `production dispatch failed: ${f.blockedReason ?? ''}`)
      if (!(await done(list, 1))) return
      const out = (list[0]?.output ?? {}) as Record<string, unknown>
      state['episode'] = out['episode']
      state['packageArtifactIds'] = out['artifactIds']
      state['workerEstimate'] = out['estimate']
      state['bunniJobs'] = out['jobs']
      state['canonVersion'] = out['canonVersion']
      await setStep(wf, 'estimate', state)
      return advance(wf.id)
    }
    case 'estimate': {
      const list = await stepTasks(wf, 'estimate')
      const pkg = (state['packageArtifactIds'] as string[] | undefined) ?? []
      if (list.length === 0)
        return void (await ensure(
          wf,
          'estimate',
          'production-manager',
          `Production estimate: ${wf.title}`,
          {
            episode: state['episode'],
            estimate: state['workerEstimate'],
            shots: (state['workerEstimate'] as { keyframes?: number } | undefined)?.keyframes,
            jobs: state['bunniJobs'],
            canonVersion: state['canonVersion'],
          },
          [String(state['winningScript']), ...pkg.slice(0, 3)],
        ))
      const f = failedOrBlocked(list)
      if (f) return finish(wf, 'failed', `estimate failed: ${f.blockedReason ?? ''}`)
      if (!(await done(list, 1))) return
      state['estimate'] = artifactIdOf(list[0])
      await d.update(workflows).set({ state, updatedAt: new Date() }).where(eq(workflows.id, wf.id))
      return finish(wf, 'done')
    }
  }
}

/**
 * The runtime's heartbeat. Advances every live workflow (which is how a founder's approval takes
 * effect) and enqueues a turn for every queued task that does not already have one. Idempotent.
 */
export const tick = async (): Promise<{ advanced: number; enqueued: number }> => {
  const d = db()
  const [company] = await d.select().from(companies).limit(1)
  if (!company || company.paused) return { advanced: 0, enqueued: 0 }
  const live = await d
    .select({ id: workflows.id })
    .from(workflows)
    .where(inArray(workflows.status, ['running', 'awaiting_approval', 'producing']))
  for (const w of live) await advance(w.id)
  const queued = await d
    .select({ id: tasks.id, turns: tasks.turns })
    .from(tasks)
    .where(eq(tasks.status, 'queued'))
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
