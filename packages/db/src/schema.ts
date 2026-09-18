import { sql } from 'drizzle-orm'
import {
  boolean,
  char,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  customType,
} from 'drizzle-orm/pg-core'

/*
 * Conventions
 * - ULIDs are char(26). Time-sortable, so every primary key index is append-only.
 * - Every fact table that grows with time carries issue_date, and every hot query filters on it.
 * - Aggregates are additive (sums, counts) and stored per participant per day so that
 *   reads are O(days), never O(commitments). See @vigoros/scoring accumulators.
 * - Sealed commitment fields (p, reasoning, falsifier) are never exposed through PostgREST.
 *   Public reads go through views that require revealed_at IS NOT NULL (see custom migration).
 */

const ulid = (name?: string) => (name ? char(name, { length: 26 }) : char({ length: 26 }))
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => 'bytea' })

export const venueEnum = pgEnum('venue', ['US', 'UK', 'FX', 'CRYPTO'])
export const assetClassEnum = pgEnum('asset_class', ['EQUITY', 'ETF', 'FX', 'CRYPTO'])
export const questionTypeEnum = pgEnum('question_type', ['LEVEL', 'RELATIVE', 'QUINTILE'])
export const questionStatusEnum = pgEnum('question_status', ['OPEN', 'PENDING', 'RESOLVED', 'VOID'])
export const participantKindEnum = pgEnum('participant_kind', ['HUMAN', 'AGENT', 'REFERENCE_MODEL', 'BASELINE'])
export const visibilityEnum = pgEnum('visibility', ['PRIVATE', 'PUBLISHED'])

// ---------------------------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------------------------

export const methodologyVersions = pgTable('methodology_versions', {
  version: text().primaryKey(),
  effectiveFrom: date().notNull(),
  announcedAt: timestamp({ withTimezone: true }).notNull(),
  docUrl: text().notNull(),
})

export const universeVersions = pgTable('universe_versions', {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  effectiveFrom: date().notNull(),
  note: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const assets = pgTable(
  'assets',
  {
    id: ulid().primaryKey(),
    symbol: text().notNull(),
    venue: venueEnum().notNull(),
    assetClass: assetClassEnum().notNull(),
    name: text().notNull(),
    /** Peer group for RELATIVE questions. GICS sector for equities, venue for FX/crypto. */
    peerGroup: text().notNull(),
    /** Vendor symbol, e.g. Tiingo ticker. */
    vendorSymbol: text().notNull(),
    activeFrom: integer()
      .notNull()
      .references(() => universeVersions.id),
    activeTo: integer().references(() => universeVersions.id),
    /** Incremental ingestion state. The ingest job picks the stalest assets first. */
    lastPriceDay: date(),
    lastIngestAt: timestamp({ withTimezone: true }),
    lastIngestError: text(),
  },
  (t) => [
    uniqueIndex('assets_symbol_venue_idx').on(t.symbol, t.venue),
    index('assets_venue_active_idx').on(t.venue, t.activeTo),
    index('assets_ingest_idx').on(t.lastIngestAt),
  ],
)

export const tradingDays = pgTable(
  'trading_days',
  {
    venue: venueEnum().notNull(),
    day: date().notNull(),
  },
  (t) => [primaryKey({ columns: [t.venue, t.day] })],
)

/** End-of-day reference prices. Composite PK gives the only access path we need: (asset, date range). */
export const prices = pgTable(
  'prices',
  {
    assetId: ulid()
      .notNull()
      .references(() => assets.id),
    day: date().notNull(),
    close: doublePrecision().notNull(),
    adjClose: doublePrecision().notNull(),
    volume: doublePrecision(),
    source: text().notNull(),
    ingestedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.day] }), index('prices_day_idx').using('brin', t.day)],
)

// ---------------------------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------------------------

export const questionSets = pgTable('question_sets', {
  issueDate: date().primaryKey(),
  seed: text().notNull(),
  methodologyVersion: text()
    .notNull()
    .references(() => methodologyVersions.version),
  universeVersion: integer()
    .notNull()
    .references(() => universeVersions.id),
  questionCount: integer().notNull(),
  /** Published prior table for this issue date: { assetClass: { horizon: { k: q } } }. */
  priorTable: jsonb().notNull(),
  generatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const questions = pgTable(
  'questions',
  {
    id: ulid().primaryKey(),
    issueDate: date()
      .notNull()
      .references(() => questionSets.issueDate),
    venue: venueEnum().notNull(),
    assetId: ulid()
      .notNull()
      .references(() => assets.id),
    type: questionTypeEnum().notNull(),
    horizon: smallint().notNull(),
    levelK: smallint(),
    threshold: doublePrecision(),
    referencePrice: doublePrecision().notNull(),
    prior: real().notNull(),
    deadlineAt: timestamp({ withTimezone: true }).notNull(),
    resolvesOn: date().notNull(),
    status: questionStatusEnum().notNull().default('OPEN'),
    outcome: smallint(),
    resolvedAt: timestamp({ withTimezone: true }),
    voidReason: text(),
    methodologyVersion: text().notNull(),
  },
  (t) => [
    index('questions_issue_date_idx').on(t.issueDate),
    index('questions_resolves_status_idx').on(t.resolvesOn, t.status),
    index('questions_asset_issue_idx').on(t.assetId, t.issueDate),
    check('questions_horizon_chk', sql`${t.horizon} in (5, 10, 21)`),
    check('questions_prior_chk', sql`${t.prior} > 0 and ${t.prior} < 1`),
    check('questions_outcome_chk', sql`${t.outcome} is null or ${t.outcome} in (0, 1)`),
  ],
)

// ---------------------------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------------------------

export const publishers = pgTable('publishers', {
  id: ulid().primaryKey(),
  /** Supabase auth user id. */
  authUserId: text().notNull().unique(),
  email: text().notNull().unique(),
  displayName: text().notNull(),
  verifiedAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const participants = pgTable(
  'participants',
  {
    id: ulid().primaryKey(),
    publisherId: ulid()
      .notNull()
      .references(() => publishers.id),
    kind: participantKindEnum().notNull(),
    handle: text().notNull().unique(),
    displayName: text().notNull(),
    visibility: visibilityEnum().notNull().default('PRIVATE'),
    publishedAt: timestamp({ withTimezone: true }),
    /** For REFERENCE_MODEL: provider/model/prompt version. For BASELINE: strategy id. */
    config: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('participants_publisher_idx').on(t.publisherId), index('participants_visibility_idx').on(t.visibility)],
)

export const apiKeys = pgTable(
  'api_keys',
  {
    id: ulid().primaryKey(),
    participantId: ulid()
      .notNull()
      .references(() => participants.id),
    /** SHA-256 of the full key. The key itself is shown once and never stored. */
    keyHash: char({ length: 64 }).notNull().unique(),
    /** First 8 chars, for display. */
    prefix: char({ length: 8 }).notNull(),
    label: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('api_keys_participant_idx').on(t.participantId)],
)

// ---------------------------------------------------------------------------------------------
// Commitments and sealing
// ---------------------------------------------------------------------------------------------

export const sealRoots = pgTable('seal_roots', {
  id: ulid().primaryKey(),
  sealDate: date().notNull().unique(),
  merkleRoot: char({ length: 64 }).notNull(),
  leafCount: integer().notNull(),
  /** OpenTimestamps proof, upgraded once the Bitcoin attestation lands. */
  otsProof: bytea(),
  anchoredAt: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const commitments = pgTable(
  'commitments',
  {
    id: ulid().primaryKey(),
    participantId: ulid()
      .notNull()
      .references(() => participants.id),
    questionId: ulid()
      .notNull()
      .references(() => questions.id),
    issueDate: date().notNull(),
    p: real().notNull(),
    reasoning: text(),
    falsifier: text(),
    /** SHA-256 of the canonical sealed payload. */
    hash: char({ length: 64 }).notNull(),
    submittedAt: timestamp({ withTimezone: true }).notNull(),
    sealRootId: ulid().references(() => sealRoots.id),
    /** Merkle inclusion proof, once sealed: array of {position, hash}. */
    inclusionProof: jsonb(),
    revealedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex('commitments_participant_question_idx').on(t.participantId, t.questionId),
    index('commitments_question_idx').on(t.questionId),
    index('commitments_participant_issue_idx').on(t.participantId, t.issueDate),
    index('commitments_unsealed_idx').on(t.submittedAt).where(sql`${t.sealRootId} is null`),
    check('commitments_p_chk', sql`${t.p} >= 0.01 and ${t.p} <= 0.99`),
  ],
)

// ---------------------------------------------------------------------------------------------
// Scores and aggregates
// ---------------------------------------------------------------------------------------------

/** One row per resolved commitment per methodology version. Immutable once written. */
export const scores = pgTable(
  'scores',
  {
    commitmentId: ulid()
      .notNull()
      .references(() => commitments.id),
    methodologyVersion: text().notNull(),
    participantId: ulid().notNull(),
    questionId: ulid().notNull(),
    issueDate: date().notNull(),
    horizon: smallint().notNull(),
    questionType: questionTypeEnum().notNull(),
    outcome: smallint().notNull(),
    brier: real().notNull(),
    priorBrier: real().notNull(),
    log: real().notNull(),
    priorLog: real().notNull(),
    scoredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.commitmentId, t.methodologyVersion] }),
    index('scores_participant_issue_idx').on(t.participantId, t.issueDate),
  ],
)

/**
 * Additive daily aggregates. Key includes horizon and question type so decay-by-horizon and
 * per-type skill are sums over at most 9 rows per participant-day. Calibration bins are
 * stored as arrays of 10.
 */
export const participantDaily = pgTable(
  'participant_daily',
  {
    participantId: ulid()
      .notNull()
      .references(() => participants.id),
    issueDate: date().notNull(),
    methodologyVersion: text().notNull(),
    horizon: smallint().notNull(),
    questionType: questionTypeEnum().notNull(),
    n: integer().notNull(),
    sumBrier: doublePrecision().notNull(),
    sumPriorBrier: doublePrecision().notNull(),
    sumLog: doublePrecision().notNull(),
    sumPriorLog: doublePrecision().notNull(),
    calCounts: integer().array().notNull(),
    calSumForecast: doublePrecision().array().notNull(),
    calSumOutcome: doublePrecision().array().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.participantId, t.issueDate, t.methodologyVersion, t.horizon, t.questionType] }),
  ],
)

/** Materialised nightly. Everything a record page or the board shows comes from this one row. */
export const participantStats = pgTable(
  'participant_stats',
  {
    participantId: ulid()
      .notNull()
      .references(() => participants.id),
    methodologyVersion: text().notNull(),
    n: integer().notNull(),
    distinctIssueDates: integer().notNull(),
    firstIssueDate: date(),
    lastIssueDate: date(),
    /** Whether the minimum record (§7) is met. Board and record pages hide scores otherwise. */
    eligible: boolean().notNull(),
    bss: doublePrecision(),
    bssLower: doublePrecision(),
    bssUpper: doublePrecision(),
    evidenceNats: doublePrecision(),
    ece: doublePrecision(),
    reliability: doublePrecision(),
    resolution: doublePrecision(),
    uncertainty: doublePrecision(),
    pValue: doublePrecision(),
    identityCount: integer().notNull().default(1),
    adjustedPValue: doublePrecision(),
    /** Fraction of issued questions answered over the record's span. */
    coverage: doublePrecision(),
    distinctAssets: integer(),
    /** { "5": bss, "10": bss, "21": bss } and { LEVEL: bss, ... } for the decay and type panels. */
    bssByHorizon: jsonb(),
    bssByType: jsonb(),
    /** Rolling 63-day BSS series: [{ date, bss, n }]. Bounded length, built from participant_daily. */
    rollingSeries: jsonb(),
    calibrationBins: jsonb(),
    bootstrapSeed: integer().notNull(),
    computedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.participantId, t.methodologyVersion] }),
    index('participant_stats_board_idx').on(t.methodologyVersion, t.eligible, t.bssLower),
  ],
)

// ---------------------------------------------------------------------------------------------
// Reference board audit trail
// ---------------------------------------------------------------------------------------------

export const referenceRuns = pgTable(
  'reference_runs',
  {
    id: ulid().primaryKey(),
    participantId: ulid()
      .notNull()
      .references(() => participants.id),
    issueDate: date().notNull(),
    provider: text().notNull(),
    model: text().notNull(),
    promptVersion: text().notNull(),
    requestHash: char({ length: 64 }).notNull(),
    responseHash: char({ length: 64 }),
    questionsAnswered: integer().notNull().default(0),
    inputTokens: integer(),
    outputTokens: integer(),
    latencyMs: integer(),
    error: text(),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex('reference_runs_participant_issue_idx').on(t.participantId, t.issueDate)],
)

// ---------------------------------------------------------------------------------------------
// Prior tables, recomputed monthly (methodology §5)
// ---------------------------------------------------------------------------------------------

export const priorTables = pgTable('prior_tables', {
  /** First day of the month the table is in force for. */
  month: date().primaryKey(),
  methodologyVersion: text().notNull(),
  /** Serialised PriorTable from @vigoros/questions. */
  table: jsonb().notNull(),
  /** Trading day the window ended on. */
  asOf: date().notNull(),
  computedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
