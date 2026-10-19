# OneGoodArea's distribution team

A private, AI-run team whose one job is to make OneGoodArea (onegoodarea.com, "the intelligence layer for place") found, understood and tried by the companies that build property and location products. Two agents to start, a Managing Director and a Content Director, made excellent before anyone else is hired. Not a product, not an agency, not a pitch.

OneGoodArea itself lives in its own repository and is run by Pedro and Marcos; this company only reads its API and writes an outbox. Reference documents: `docs/oga/` (overview, products, traction, roadmap, MCP). Brand: `apps/hq/public/brand/` and the guidelines the assets came with.

## Hard rules

- **Nothing on screen without a row.** Every avatar state, room light and feed line is derived from `studio.tasks`, `studio.runs`, `studio.meetings` or `studio.events`. No fabricated activity, no fake metrics, no pretend decisions.
- **Every figure traces to a signal row.** A published piece cites each number with its signal key, place id, value, period, source, confidence and methodology version, and each citation points at a row in the research pack the worker fetched. The fact-check is its own task. A withheld piece is a valid output.
- **OneGoodArea's own rules bind every word.** No AI sets a number; version and disclose, never freeze; say "Great Britain"; name the four products exactly (Signals, Scores, Monitor, Intelligence); never lead with AI; no "AI-powered", "revolutionary", "seamless"; no internal terms in headlines; no em dashes; no Northern Ireland; never compare deprivation across nations.
- **Agents act only through typed tools.** No filesystem, no shell, no free-form side effects. A tool is a database operation or a worker job.
- **Only the OneGoodArea worker touches the outside.** It reads the API with an `engineering`-type key (never a customer quota), reads PostHog, and writes only to the outbox (`OGA_OUTBOX`). `OGA_MODE=sample` serves the committed 12 October 2026 pack and never touches the network.
- **Caps are code.** Per run, per task, per department per day, per company per day. A cap hit blocks the task and raises an approval; it never fails silently and never proceeds.
- **The founder approves everything that leaves the building.** The approval row is the control: the publish step re-checks it in the runtime and again in the worker. `MODEL_ADAPTER=fake` costs nothing and labels every output SIMULATED.
- **Decisions are rows.** Chooser, options, chosen, evidence, reasoning, confidence. Structured output on every decision-bearing call.
- **Meetings are bounded.** Chair, at most four participants, one question, three rounds, one of: decision, action, blocker.

## Engineering rules

- TypeScript strict everywhere; `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` stay on.
- `packages/engine` is pure and unit-tested. Runtime code adapts to it.
- Role definitions, departments and rooms are data in `packages/org`, versioned. Hiring an agent is inserting a row.
- Everything is subject-scoped where it can be (`studio.subjects`: OneGoodArea today). A second subject is new rows, not new code.
- Any number of runtime processes may run; pg-boss hands each job to one. Turns are singleton-keyed per task.
- Migrations live in the `studio` Postgres schema. The legacy `public` schema belongs to an unrelated project; do not touch it. `COMPANY_NAME` picks the company row a process serves.
- `main` auto-deploys the legacy app to Vercel. Work on `studio` until the founder approves the production switch.

## Layout

```
packages/contracts    ids, enums, events, the OneGoodArea job surface, structured output schemas
packages/org          departments, rooms, position catalogue, the two phase-1 role definitions
packages/engine       task state machine, budget guard, loop detector, breaker, agent state, meeting protocol
packages/db           drizzle schema + migrations for the `studio` schema
apps/runtime          agent runtime: pg-boss consumer, model adapters (fake | anthropic), turns, the content workflow, seed, cli
apps/oga-worker       the only process that reads the OneGoodArea API and PostHog or writes the outbox; sample mode
apps/hq               Next.js app: the 3D headquarters (React Three Fiber; `components/hq/v2`), panels, approvals, /ops 2D views
packages/ops          shared database operations: tasks, approvals, kill switch, snapshot, events, active company
docs/oga              OneGoodArea reference documents (read-only copies)
docs/assets           provenance register for every imported 3D asset
```

## Commands

```
pnpm install
pnpm test · pnpm typecheck
pnpm db:generate · pnpm db:migrate            # needs DIRECT_DATABASE_URL
pnpm seed                                     # company, subject, two departments, two agents (idempotent)
pnpm --filter @vigoros/runtime cli workflow "<focus>" "<guidance>" [surface] [audience] ["SE15 5DP,LA22 0EN"]
pnpm --filter @vigoros/runtime cli approve <approval-id> "<note>"     # or reject; the runtime acts on the row
pnpm --filter @vigoros/runtime cli instruct managing-director "<text>" # founder instruction as a task
pnpm --filter @vigoros/runtime cli status · audit · verify            # verify = invariants against the live DB
pnpm --filter @vigoros/oga-worker cli research "SE15 5DP"             # read-only probe of the research path
pnpm runtime · pnpm worker                    # long-running processes
pnpm --filter @vigoros/hq dev                 # http://localhost:3100 (3D headquarters; /ops is the 2D view)
# Local dev without a mailbox: HQ_DEV_FOUNDER_EMAIL=you@example.com in apps/hq/.env.local (ignored in production)
# FAKE_TURN_MS=12000 on the runtime keeps simulated runs open long enough to watch; ?capture=1 on the HQ keeps the WebGL buffer; ?stats=1 prints renderer counters
```

## Business identity

OneGoodArea is run by Pedro Perez Serapiao (CEO) with Marcos. This repository is owned by Vigoros, Pedro's trading name, under the GitHub org `vigoros-studio`. The Bunni character work that lived here before 19 October 2026 is kept at tag `bunni-archive-2026-10-19`.
