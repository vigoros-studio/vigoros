import {
  Acknowledgement,
  ApprovalItem,
  ArtifactKind,
  Briefing,
  DirectorPick,
  DirectorPlan,
  MeasurementPlan,
  OpportunityReport,
  ProductionEstimate,
  Ranking,
  ScriptDraft,
} from '@vigoros/contracts'
import type { z } from 'zod'

/**
 * A task kind binds a role to the structured output it must return and the artifact it produces.
 * The workflow in the proposal is a chain of these; the runtime, not the model, does the chaining.
 */
export interface TaskKind {
  kind: string
  roleKey: string
  schemaName: string
  schema: z.ZodType<unknown>
  artifactKind: z.infer<typeof ArtifactKind>
  reviewing: boolean
  webSearch: boolean
  maxOutputTokens: number
  /** Builds the user message from the task's input and the artifacts it points at. */
  user: (
    input: Record<string, unknown>,
    artifacts: { kind: string; title: string; content: unknown }[],
  ) => string
}

const artifactsBlock = (artifacts: { kind: string; title: string; content: unknown }[]) =>
  artifacts.length === 0
    ? ''
    : `\n\nAttached artifacts:\n${artifacts.map((a) => `--- ${a.kind}: ${a.title}\n${JSON.stringify(a.content, null, 2)}`).join('\n')}`

export const TASK_KINDS: readonly TaskKind[] = [
  {
    kind: 'research.opportunities',
    roleKey: 'trend-researcher',
    schemaName: 'OpportunityReport',
    schema: OpportunityReport,
    artifactKind: 'opportunity',
    reviewing: false,
    webSearch: true,
    maxOutputTokens: 6000,
    user: (input) =>
      `Find three to five opportunities for this character this week. Focus: ${String(input['focus'] ?? 'relatable daily-life comedy')}.`,
  },
  {
    kind: 'direct.pick',
    roleKey: 'studio-director',
    schemaName: 'DirectorPick',
    schema: DirectorPick,
    artifactKind: 'brief',
    reviewing: true,
    webSearch: false,
    maxOutputTokens: 4000,
    user: (input, a) =>
      `Pick one opportunity to develop and write the brief for the writers. Founder guidance: ${String(input['guidance'] ?? 'none')}.${artifactsBlock(a)}`,
  },
  {
    kind: 'write.script',
    roleKey: 'comedy-writer-a',
    schemaName: 'ScriptDraft',
    schema: ScriptDraft,
    artifactKind: 'script',
    reviewing: false,
    webSearch: false,
    maxOutputTokens: 4000,
    user: (input, a) =>
      `Write one episode script from this brief.${artifactsBlock(a)}\n\nExtra direction: ${String(input['direction'] ?? 'none')}.`,
  },
  {
    kind: 'review.rank',
    roleKey: 'creative-reviewer',
    schemaName: 'Ranking',
    schema: Ranking,
    artifactKind: 'ranking',
    reviewing: true,
    webSearch: false,
    maxOutputTokens: 5000,
    user: (input, a) =>
      `Rank these scripts and pick a winner. Return the top ${String(input['returnCount'] ?? 1)}.${artifactsBlock(a)}`,
  },
  {
    kind: 'produce.estimate',
    roleKey: 'production-manager',
    schemaName: 'ProductionEstimate',
    schema: ProductionEstimate,
    artifactKind: 'cost_estimate',
    reviewing: false,
    webSearch: false,
    maxOutputTokens: 3000,
    user: (input, a) =>
      `Estimate production for the winning script. Episode slug: ${String(input['slug'] ?? 'tbd')}.${artifactsBlock(a)}`,
  },
  {
    kind: 'plan.measurement',
    roleKey: 'performance-analyst',
    schemaName: 'MeasurementPlan',
    schema: MeasurementPlan,
    artifactKind: 'measurement_plan',
    reviewing: false,
    webSearch: false,
    maxOutputTokens: 2000,
    user: (_input, a) =>
      `Write the measurement plan for this episode before it is made.${artifactsBlock(a)}`,
  },
  {
    kind: 'direct.approval-item',
    roleKey: 'studio-director',
    schemaName: 'ApprovalItem',
    schema: ApprovalItem,
    artifactKind: 'briefing',
    reviewing: true,
    webSearch: false,
    maxOutputTokens: 2000,
    user: (_input, a) =>
      `Write the approval item for the founder from these artifacts.${artifactsBlock(a)}`,
  },
  {
    kind: 'direct.instruction',
    roleKey: 'studio-director',
    schemaName: 'DirectorPlan',
    schema: DirectorPlan,
    artifactKind: 'briefing',
    reviewing: false,
    webSearch: false,
    maxOutputTokens: 2000,
    user: (input) =>
      `The founder says: "${String(input['instruction'] ?? '')}". Read it as the Studio Director. If it asks for content, set startWorkflow to true with the focus and guidance the writers need; otherwise summarise what you will do.`,
  },
  {
    kind: 'agent.instruction',
    roleKey: '*',
    schemaName: 'Acknowledgement',
    schema: Acknowledgement,
    artifactKind: 'briefing',
    reviewing: false,
    webSearch: false,
    maxOutputTokens: 1500,
    user: (input) =>
      `The founder says: "${String(input['instruction'] ?? '')}". Acknowledge it in your role: what you will do, and anything only the founder can decide.`,
  },
  {
    kind: 'direct.briefing',
    roleKey: 'studio-director',
    schemaName: 'Briefing',
    schema: Briefing,
    artifactKind: 'briefing',
    reviewing: false,
    webSearch: false,
    maxOutputTokens: 2000,
    user: (input) =>
      `Write the morning briefing from these facts only:\n${JSON.stringify(input, null, 2)}`,
  },
]

export const taskKind = (kind: string): TaskKind => {
  const k = TASK_KINDS.find((t) => t.kind === kind)
  if (!k) throw new Error(`unknown task kind ${kind}`)
  return k
}
