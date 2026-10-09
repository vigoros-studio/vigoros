# Vigoros Studio

A private, AI-staffed 3D entertainment company. Its only mission right now: make Bunni (@bunniisreal) a successful virtual influencer. Not a product, not a SaaS, not an agency, not a pitch. Multi-character comes after Bunni works.

Proposal (read before structural work): https://claude.ai/code/artifact/040ff5cd-bb48-4bb2-971b-9baa54ac336d
Bunni's production environment: `~/Desktop/bunni` (canon in `character/`, never modified by Vigoros).

## Hard rules

- **Nothing on screen without a row.** Every avatar state, room light and feed line is derived from `studio.tasks`, `studio.runs`, `studio.meetings` or `studio.events`. No fabricated activity, no fake metrics, no pretend decisions.
- **Agents act only through typed tools.** No filesystem, no shell, no free-form side effects. A tool is a database operation or a Bunni worker job.
- **Only the Bunni worker touches `/bunni`, and it speaks Bunni's contract.** Her `production/interface/` (manifest, `job-schema.json`, inbox/outbox, hash-chained `events.jsonl`) is the integration surface. The worker reads anywhere under the root, writes only inside one `production/episodes/EPnnn-slug/` directory or `production/jobs/inbox/`, sends `scene_text` only (the anchor is hers), uses her `canon_version`, and runs her integrity check at start. Reference files are never written. During development `BUNNI_ROOT` points at a sandbox copy (`apps/bunni-worker/scripts/make-sandbox.sh`); pointing it at the real folder is the founder's call.
- **Caps are code.** Per run, per task, per department per day, per company per day. A cap hit blocks the task and raises an approval; it never fails silently and never proceeds.
- **The founder approves** publishing, paid rendering, commercial commitments, canon changes, account changes, hiring and pausing. The approval row is the control: the Production Manager re-checks it before dispatch, and Bunni's jobs carry `paid_generation_allowed:false` until the founder changes policy P1 (zero spend). `MODEL_ADAPTER=fake` costs nothing and labels every output SIMULATED.
- **Decisions are rows.** Chooser, options, chosen, evidence, reasoning, confidence. Structured output on every decision-bearing call.
- **Meetings are bounded.** Chair, at most four participants, one question, three rounds, one of: decision, action, blocker.
- **Canon beats creativity.** When they conflict, choose consistency.

## Engineering rules

- TypeScript strict everywhere; `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` stay on.
- `packages/engine` is pure and unit-tested. Runtime code adapts to it.
- Role definitions, departments and rooms are data in `packages/org`, versioned. Hiring an agent is inserting a row.
- Everything is character-scoped where it can be. A second character is new rows, not new code.
- Any number of runtime processes may run; pg-boss hands each job to one. Turns are singleton-keyed per task.
- Migrations live in the `studio` Postgres schema and are additive. The legacy `public` schema belongs to an unrelated project; do not touch it.
- `main` auto-deploys to Vercel. Work on `studio` until the founder approves the production switch.

## Layout

```
packages/contracts    ids, enums, events, the Bunni job surface, structured output schemas
packages/org          departments, rooms, position catalogue, the seven phase-1 role definitions
packages/engine       task state machine, budget guard, loop detector, breaker, agent state, meeting protocol
packages/db           drizzle schema + migrations for the `studio` schema
apps/runtime          agent runtime: pg-boss consumer, model adapters (fake | anthropic), turns, seed, cli
apps/bunni-worker     the only process with access to /bunni: path guard, assets.*, episode.*, refusals
apps/hq               Next.js app: the 3D headquarters (React Three Fiber; `components/hq/v2` is the current art pass, the Writers' Room is the approved-quality slice), panels, approvals, /ops 2D views
packages/ops          shared database operations: tasks, approvals, kill switch, snapshot, events
```

## Commands

```
pnpm install
pnpm test · pnpm typecheck
pnpm db:generate · pnpm db:migrate            # needs DIRECT_DATABASE_URL
pnpm seed                                     # company, Bunni, departments, seven agents (idempotent)
pnpm --filter @vigoros/runtime cli workflow "<focus>" "<guidance>"   # start an episode workflow
pnpm --filter @vigoros/runtime cli approve <approval-id> "<note>"     # or reject; the runtime acts on the row
pnpm --filter @vigoros/runtime cli instruct studio-director "<text>"   # founder instruction as a task
pnpm --filter @vigoros/runtime cli status · audit · verify            # verify = phase 1 checklist against the live DB
pnpm --filter @vigoros/bunni-worker scripts/make-sandbox.sh           # sandbox copy of /bunni for development
pnpm --filter @vigoros/bunni-worker cli assets.index   # read-only index of /bunni
pnpm runtime · pnpm worker                    # long-running processes
pnpm --filter @vigoros/hq dev                 # http://localhost:3100 (3D headquarters; /ops is the 2D view)
# Local dev without a mailbox: HQ_DEV_FOUNDER_EMAIL=you@example.com in apps/hq/.env.local (ignored in production)
# FAKE_TURN_MS=15000 on the runtime keeps simulated runs open long enough to watch; ?capture=1 on the HQ keeps the WebGL buffer for screenshots
```

## Business identity

Vigoros, trading name of Pedro Perez Serapiao, sole trader. Domain vigoros.studio, spelled **Vigoros**. GitHub org `vigoros-studio`.
