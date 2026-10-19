import {
  Acknowledgement,
  ApprovalItem,
  ArtifactKind,
  Briefing,
  ContentDraft,
  ContentPlan,
  DirectorPlan,
  EditorialReview,
  FactCheck,
} from '@vigoros/contracts'
import type { z } from 'zod'

/**
 * A task kind binds a role to the structured output it must return and the artifact it produces.
 * The content workflow is a chain of these; the runtime, not the model, does the chaining.
 * Two kinds are not model turns at all: `research.pack` and `content.publish` are worker jobs.
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

export const WORKER_KINDS = new Set(['research.pack', 'content.publish'])

const artifactsBlock = (artifacts: { kind: string; title: string; content: unknown }[]) =>
  artifacts.length === 0
    ? ''
    : `\n\nAttached artifacts:\n${artifacts.map((a) => `--- ${a.kind}: ${a.title}\n${JSON.stringify(a.content, null, 2)}`).join('\n')}`

const str = (v: unknown, fallback = 'none') => (typeof v === 'string' && v ? v : fallback)

export const TASK_KINDS: readonly TaskKind[] = [
  {
    kind: 'direct.plan',
    roleKey: 'managing-director',
    schemaName: 'ContentPlan',
    schema: ContentPlan,
    artifactKind: 'content_plan',
    reviewing: false,
    webSearch: false,
    maxOutputTokens: 4000,
    user: (input, a) =>
      `Decide this week's piece. Focus: ${str(input['focus'], 'the founder gave no focus')}. Requested surface: ${str(input['surface'], 'your call')}. Audience: ${str(input['audience'], 'your call')}. Places named: ${Array.isArray(input['places']) && input['places'].length ? (input['places'] as string[]).join(', ') : 'none'}. Founder guidance: ${str(input['guidance'])}. Return at most three pieces in priority order; the first one is what gets written this cycle. Return no pieces if nothing earns publication, and say why in notes.${artifactsBlock(a)}`,
  },
  {
    kind: 'write.draft',
    roleKey: 'content-director',
    schemaName: 'ContentDraft',
    schema: ContentDraft,
    artifactKind: 'content_draft',
    reviewing: false,
    webSearch: false,
    maxOutputTokens: 8000,
    user: (input, a) =>
      `Write the piece as the writer. Surface: ${str(input['surface'])}. Audience: ${str(input['audience'])}. Title to work from: ${str(input['title'])}. Angle: ${str(input['angle'])}.${input['issues'] ? `\n\nThis is a revision. The fact-check failed with these issues, fix every one:\n${JSON.stringify(input['issues'], null, 2)}` : ''}${artifactsBlock(a)}`,
  },
  {
    kind: 'check.facts',
    roleKey: 'content-director',
    schemaName: 'FactCheck',
    schema: FactCheck,
    artifactKind: 'fact_check',
    reviewing: true,
    webSearch: false,
    maxOutputTokens: 4000,
    user: (_input, a) =>
      `Fact-check the attached draft against the attached research pack, as the fact-checker. Every claim, every citation, every row.${artifactsBlock(a)}`,
  },
  {
    kind: 'direct.review',
    roleKey: 'managing-director',
    schemaName: 'EditorialReview',
    schema: EditorialReview,
    artifactKind: 'editorial_review',
    reviewing: true,
    webSearch: false,
    maxOutputTokens: 8000,
    user: (_input, a) =>
      `Read the checked piece as its most demanding reader, apply the editorial bar, and write the approval item for the founder. Return revisedBody only if you changed the text.${artifactsBlock(a)}`,
  },
  {
    kind: 'direct.instruction',
    roleKey: 'managing-director',
    schemaName: 'DirectorPlan',
    schema: DirectorPlan,
    artifactKind: 'briefing',
    reviewing: false,
    webSearch: false,
    maxOutputTokens: 2000,
    user: (input) =>
      `The founder says: "${str(input['instruction'], '')}". Read it as the Managing Director. If it asks for something to be written or published, set startWorkflow to true with the focus, surface, audience, places and guidance the Content Director needs; otherwise summarise what you will do.`,
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
      `The founder says: "${str(input['instruction'], '')}". Acknowledge it in your role: what you will do, and anything only the founder can decide.`,
  },
  {
    kind: 'direct.briefing',
    roleKey: 'managing-director',
    schemaName: 'Briefing',
    schema: Briefing,
    artifactKind: 'briefing',
    reviewing: false,
    webSearch: false,
    maxOutputTokens: 2000,
    user: (input, a) =>
      `Write the morning briefing from these facts only:\n${JSON.stringify(input, null, 2)}${artifactsBlock(a)}`,
  },
  {
    kind: 'direct.approval-item',
    roleKey: 'managing-director',
    schemaName: 'ApprovalItem',
    schema: ApprovalItem,
    artifactKind: 'briefing',
    reviewing: true,
    webSearch: false,
    maxOutputTokens: 2000,
    user: (_input, a) =>
      `Write the approval item for the founder from these artifacts.${artifactsBlock(a)}`,
  },
]

export const taskKind = (kind: string): TaskKind => {
  const k = TASK_KINDS.find((t) => t.kind === kind)
  if (!k) throw new Error(`unknown task kind ${kind}`)
  return k
}
