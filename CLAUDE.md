# Vigoros Studio

A private, AI-staffed 3D entertainment company. Its only mission right now: make Bunni (@bunniisreal) a successful virtual influencer. Not a product, not a SaaS, not an agency, not a pitch. Multi-character comes after Bunni works.

Proposal (read before structural work): https://claude.ai/code/artifact/040ff5cd-bb48-4bb2-971b-9baa54ac336d
Bunni's production environment: `~/Desktop/bunni` (canon in `character/`, never modified by Vigoros).

## Hard rules

- **Nothing on screen without a row.** Every avatar state, room light and feed line is derived from `studio.tasks`, `studio.runs`, `studio.meetings` or `studio.events`. No fabricated activity, no fake metrics, no pretend decisions.
- **Agents act only through typed tools.** No filesystem, no shell, no free-form side effects. A tool is a database operation or a Bunni worker job.
- **Only the Bunni worker touches `/bunni`.** Reads anywhere under the root; writes only inside one `production/episodes/EPnnn-slug/` directory. Reference files are never written. The anchor's rules are enforced by code, not by prompts.
- **Caps are code.** Per run, per task, per department per day, per company per day. A cap hit blocks the task and raises an approval; it never fails silently and never proceeds.
- **The founder approves** publishing, paid rendering above cap, commercial commitments, canon changes, account changes, hiring and pausing. In phase 1 paid jobs are disabled entirely (`PAID_JOBS_ENABLED=false`) and `MODEL_ADAPTER=fake` costs nothing.
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
apps/hq               Next.js app: auth gate, 2D company view now; the 3D headquarters in phase 1
```

## Commands

```
pnpm install
pnpm test · pnpm typecheck
pnpm db:generate · pnpm db:migrate            # needs DIRECT_DATABASE_URL
pnpm seed                                     # company, Bunni, departments, seven agents (idempotent)
pnpm --filter @vigoros/runtime cli task research.opportunities trend-researcher "Find this week's formats"
pnpm --filter @vigoros/runtime cli turn <task-id>     # one agent turn (fake adapter by default)
pnpm --filter @vigoros/runtime cli status
pnpm --filter @vigoros/bunni-worker cli assets.index   # read-only index of /bunni
pnpm runtime · pnpm worker                    # long-running processes
pnpm --filter @vigoros/hq dev                 # http://localhost:3100
```

## Business identity

Vigoros, trading name of Pedro Perez Serapiao, sole trader. Domain vigoros.studio, spelled **Vigoros**. GitHub org `vigoros-studio`.
