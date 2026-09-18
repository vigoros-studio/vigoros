# Vigoros

The independent scoring authority for time-locked market forecasts. Humans and AI agents commit a probability and its reasoning before a deadline. The market resolves it. Vigoros scores it against a dumb prior and keeps the record forever.

Positioning line: **a benchmark that cannot be backtested.**

Proposal: https://claude.ai/code/artifact/04d27b56-1794-46d0-aa51-5bb4867f18d7
Methodology: `docs/methodology.md` (this is the product; read it before touching scoring)

## Hard rules

- **Referee, never a player.** No fund, no allocation, no broker link, no signals, no advice.
- **Never build alpha.** Participants generate alpha. We own the measurement.
- **Sealed until resolution.** No open forecast is ever displayed to anyone. Public reads go only through views that require `revealed_at`.
- **Score against the prior.** Raw hit rate is meaningless. Skill is improvement over the base rate, with intervals.
- **Whole record or nothing.** Private by default. Publishing is the whole history.
- **Methodology before code.** Every score carries `METHODOLOGY_VERSION`. Definitions never change silently.
- **All identities counted.** One verified publisher, every identity scored, percentiles adjusted.

## Engineering rules

- TypeScript strict everywhere. `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on. Do not loosen them.
- No scans. Every read of a participant's history goes through `participant_daily` sums or the materialised `participant_stats` row. If a query grows with the number of commitments, it is wrong.
- Scoring is pure. `@vigoros/scoring` has no I/O and is property-tested. Database code adapts to it, never the reverse.
- Configuration is data. Venues, horizons, universe, model prompts are versioned records, not literals in code paths.
- Every job is idempotent and keyed on issue date. Re-running a day must be safe.
- Money-adjacent numbers use `double precision`. Probabilities and scores stored as `real` are fine.
- No component library, no Tailwind defaults, no template. The design system is ours.

## Layout

```
docs/                 methodology and public specs
packages/domain       schemas, ids, canonical JSON + SHA-256 sealing, venue config
packages/scoring      pure scoring engine: Brier, log, BSS, calibration, block bootstrap
packages/db           Drizzle schema, migrations, RLS and public views
packages/questions    deterministic daily question generator      (next)
packages/prices       Tiingo client and ingestion                 (next)
packages/reference    frontier-model and baseline participants    (next)
apps/web              Next.js app: API routes, cron jobs, board, record pages, commit UI (next)
sdk/python, sdk/ts    client SDKs                                  (later)
```

## Commands

```
pnpm install
pnpm test            # all packages
pnpm typecheck
pnpm db:generate     # drizzle migration from schema
pnpm db:migrate      # needs DIRECT_DATABASE_URL
```

## Business identity

Vigoros, trading name of Pedro Perez Serapiao, sole trader. Domain vigoros.studio, spelled **Vigoros**. GitHub org `vigoros-studio`. Contact hello@vigoros.studio.
