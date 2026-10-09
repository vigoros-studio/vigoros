import {
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgSchema,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * Vigoros Studio lives in its own Postgres schema. Every table is character-scoped where it can be,
 * so a second character is a new row set, not a new schema. Ids are typed ULIDs from @vigoros/contracts.
 */
export const studio = pgSchema('studio')

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })
const createdAt = () => ts('created_at').notNull().defaultNow()
const json = <T>() => jsonb().$type<T>()

export const companies = studio.table('companies', {
  id: text().primaryKey(),
  name: text().notNull(),
  paused: boolean().notNull().default(false),
  pausedReason: text(),
  dailyCapUsd: doublePrecision().notNull().default(5),
  createdAt: createdAt(),
})

export const characters = studio.table(
  'characters',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    key: text().notNull(),
    name: text().notNull(),
    handle: text().notNull(),
    /** Root of the character's production environment on the worker machine. Never read by the runtime. */
    productionRoot: text().notNull(),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('characters_company_key').on(t.companyId, t.key)],
)

export const characterState = studio.table('character_state', {
  characterId: text()
    .primaryKey()
    .references(() => characters.id),
  /** Running storyline, gag register, episode summaries. Updated by the Showrunner after approval. */
  storyline: text().notNull().default(''),
  gags: json<string[]>().notNull().default([]),
  episodes: json<
    { episode: string; title: string; summary: string; publishedAt: string | null }[]
  >()
    .notNull()
    .default([]),
  canonVersion: text().notNull().default('bunni-bible-2026-10'),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const departments = studio.table(
  'departments',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    key: text().notNull(),
    name: text().notNull(),
    purpose: text().notNull(),
    room: json<{ origin: [number, number]; size: [number, number]; desks: number }>().notNull(),
    dailyCapUsd: doublePrecision().notNull().default(2),
    paused: boolean().notNull().default(false),
  },
  (t) => [uniqueIndex('departments_company_key').on(t.companyId, t.key)],
)

export const agents = studio.table(
  'agents',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    characterId: text().references(() => characters.id),
    departmentId: text()
      .notNull()
      .references(() => departments.id),
    roleKey: text().notNull(),
    roleVersion: integer().notNull(),
    title: text().notNull(),
    /** Display name of the avatar. */
    name: text().notNull(),
    model: text().notNull(),
    tier: integer().notNull(),
    desk: integer().notNull(),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index('agents_department').on(t.departmentId),
    index('agents_character').on(t.characterId),
    uniqueIndex('agents_role_character').on(t.roleKey, t.characterId),
  ],
)

export const workflows = studio.table(
  'workflows',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    characterId: text().references(() => characters.id),
    kind: text().notNull(),
    title: text().notNull(),
    status: text().notNull().default('running'),
    step: text().notNull(),
    /** Agent id or 'founder'. */
    startedBy: text().notNull(),
    input: json<Record<string, unknown>>().notNull().default({}),
    /** Artifact ids by step, approval id, the chosen script, the episode directory. */
    state: json<Record<string, unknown>>().notNull().default({}),
    /** Whether any run inside it used the fake adapter. Shown everywhere the workflow is. */
    simulated: boolean().notNull().default(false),
    capUsd: doublePrecision().notNull(),
    spentUsd: doublePrecision().notNull().default(0),
    error: text(),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    finishedAt: ts('finished_at'),
  },
  (t) => [
    index('workflows_status').on(t.status, t.updatedAt),
    index('workflows_character').on(t.characterId, t.createdAt),
  ],
)

export const tasks = studio.table(
  'tasks',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    characterId: text().references(() => characters.id),
    parentId: text(),
    workflowId: text().references(() => workflows.id),
    /** Step name inside the workflow; with workflowId and ownerAgentId this is unique, which is what prevents duplicates. */
    step: text(),
    ownerAgentId: text()
      .notNull()
      .references(() => agents.id),
    /** Agent id, or 'founder'. */
    requestedBy: text().notNull(),
    kind: text().notNull(),
    title: text().notNull(),
    status: text().notNull().default('queued'),
    input: json<Record<string, unknown>>().notNull().default({}),
    output: json<Record<string, unknown>>(),
    /** Ids of artifacts this task should read. */
    inputArtifactIds: json<string[]>().notNull().default([]),
    capUsd: doublePrecision().notNull(),
    spentUsd: doublePrecision().notNull().default(0),
    turns: integer().notNull().default(0),
    blockedReason: text(),
    deadlineAt: ts('deadline_at'),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    finishedAt: ts('finished_at'),
  },
  (t) => [
    index('tasks_owner_status').on(t.ownerAgentId, t.status),
    index('tasks_parent').on(t.parentId),
    index('tasks_character_status').on(t.characterId, t.status),
    index('tasks_status_updated').on(t.status, t.updatedAt),
    index('tasks_workflow').on(t.workflowId),
    uniqueIndex('tasks_workflow_step_owner').on(t.workflowId, t.step, t.ownerAgentId),
  ],
)

export const runs = studio.table(
  'runs',
  {
    id: text().primaryKey(),
    taskId: text()
      .notNull()
      .references(() => tasks.id),
    agentId: text()
      .notNull()
      .references(() => agents.id),
    status: text().notNull().default('started'),
    model: text().notNull(),
    effort: text().notNull(),
    /** 'fake' | 'anthropic'. A fake run is simulated and is shown as such everywhere. */
    adapter: text().notNull().default('fake'),
    /** Full request and response bodies, kept 90 days then reduced to usage and summary. */
    request: json<unknown>(),
    response: json<unknown>(),
    toolCalls: json<{ name: string; input: unknown; output: unknown; ms: number }[]>()
      .notNull()
      .default([]),
    outputFingerprint: text(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    cacheReadTokens: integer().notNull().default(0),
    cacheWriteTokens: integer().notNull().default(0),
    costUsd: doublePrecision().notNull().default(0),
    summary: text(),
    error: text(),
    startedAt: createdAt(),
    finishedAt: ts('finished_at'),
  },
  (t) => [index('runs_task').on(t.taskId), index('runs_agent_started').on(t.agentId, t.startedAt)],
)

export const messages = studio.table(
  'messages',
  {
    id: text().primaryKey(),
    taskId: text().references(() => tasks.id),
    meetingId: text(),
    /** Agent id or 'founder'. */
    fromId: text().notNull(),
    toId: text().notNull(),
    body: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('messages_task').on(t.taskId), index('messages_to').on(t.toId, t.createdAt)],
)

export const meetings = studio.table(
  'meetings',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    taskId: text().references(() => tasks.id),
    chairAgentId: text()
      .notNull()
      .references(() => agents.id),
    participantIds: json<string[]>().notNull(),
    question: text().notNull(),
    round: integer().notNull().default(0),
    status: text().notNull().default('open'),
    outcome: json<
      | { kind: 'decision'; decisionId: string }
      | { kind: 'action'; taskId: string }
      | { kind: 'blocker'; summary: string }
    >(),
    openedAt: createdAt(),
    closedAt: ts('closed_at'),
  },
  (t) => [index('meetings_status').on(t.status)],
)

export const decisions = studio.table(
  'decisions',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    characterId: text().references(() => characters.id),
    taskId: text().references(() => tasks.id),
    workflowId: text(),
    runId: text(),
    chooserId: text().notNull(),
    question: text().notNull(),
    chosen: text().notNull(),
    alternatives: json<{ option: string; whyNot: string }[]>().notNull().default([]),
    evidenceArtifactIds: json<string[]>().notNull().default([]),
    reasoning: text().notNull(),
    confidence: real(),
    objections: json<{ byId: string; reason: string; at: string }[]>().notNull().default([]),
    reopenedCount: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('decisions_task').on(t.taskId),
    index('decisions_character_created').on(t.characterId, t.createdAt),
  ],
)

export const approvals = studio.table(
  'approvals',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    characterId: text().references(() => characters.id),
    taskId: text().references(() => tasks.id),
    workflowId: text(),
    requestedBy: text().notNull(),
    kind: text().notNull(),
    headline: text().notNull(),
    summary: text().notNull(),
    recommendation: text(),
    costUsd: doublePrecision(),
    payload: json<Record<string, unknown>>().notNull().default({}),
    status: text().notNull().default('pending'),
    founderNote: text(),
    createdAt: createdAt(),
    decidedAt: ts('decided_at'),
  },
  (t) => [index('approvals_status_created').on(t.status, t.createdAt)],
)

export const artifacts = studio.table(
  'artifacts',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    characterId: text().references(() => characters.id),
    taskId: text().references(() => tasks.id),
    runId: text(),
    workflowId: text(),
    producedBy: text().notNull(),
    kind: text().notNull(),
    title: text().notNull(),
    simulated: boolean().notNull().default(false),
    /** Structured content for agent outputs; null when the artifact is a file on the worker machine. */
    content: json<unknown>(),
    /** Path relative to the character's production root, for files the worker wrote. */
    path: text(),
    sha256: text(),
    bytes: integer(),
    mime: text(),
    thumbnail: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index('artifacts_task').on(t.taskId),
    index('artifacts_character_kind').on(t.characterId, t.kind, t.createdAt),
  ],
)

export const budgets = studio.table(
  'budgets',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    /** 'company' | 'department:<id>' | 'agent:<id>' | 'workflow:<kind>' */
    scope: text().notNull(),
    period: text().notNull().default('day'),
    capUsd: doublePrecision().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('budgets_scope_period').on(t.companyId, t.scope, t.period)],
)

export const costLedger = studio.table(
  'cost_ledger',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    characterId: text().references(() => characters.id),
    departmentId: text().references(() => departments.id),
    agentId: text().references(() => agents.id),
    taskId: text().references(() => tasks.id),
    runId: text(),
    /** 'model' | 'higgsfield' | 'other' */
    source: text().notNull(),
    description: text().notNull(),
    usd: doublePrecision().notNull(),
    credits: doublePrecision(),
    /** Calendar day in UTC, for daily caps. */
    day: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('cost_day_company').on(t.companyId, t.day),
    index('cost_day_department').on(t.departmentId, t.day),
    index('cost_task').on(t.taskId),
  ],
)

export const events = studio.table(
  'events',
  {
    seq: bigserial({ mode: 'number' }).primaryKey(),
    id: text().notNull(),
    companyId: text().notNull(),
    characterId: text(),
    agentId: text(),
    departmentId: text(),
    taskId: text(),
    workflowId: text(),
    kind: text().notNull(),
    subject: text().notNull(),
    caption: text().notNull(),
    payload: json<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index('events_company_seq').on(t.companyId, t.seq),
    index('events_agent_seq').on(t.agentId, t.seq),
    index('events_created').on(t.createdAt),
  ],
)

export const memoryNotes = studio.table(
  'memory_notes',
  {
    id: text().primaryKey(),
    companyId: text()
      .notNull()
      .references(() => companies.id),
    scope: text().notNull(),
    scopeId: text(),
    authorId: text().notNull(),
    sourceDecisionId: text(),
    sourceArtifactId: text(),
    body: text().notNull(),
    confidence: real().notNull().default(0.5),
    promotedToCanon: boolean().notNull().default(false),
    expiresAt: ts('expires_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notes_scope').on(t.scope, t.scopeId, t.createdAt)],
)
