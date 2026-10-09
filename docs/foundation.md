# Foundation milestone (phase 0)

Done on the `studio` branch, 9 October 2026.

- Legacy project safeguarded: branch `forecast-archive`, tag `forecast-archive-2026-10-09`, both pushed.
- Clean workspace: contracts, org, engine, db, runtime, bunni-worker, hq.
- `studio` Postgres schema with 16 tables, additive migration, Realtime publication on `studio.events`.
- Seven phase-1 roles as data with prompts; six departments; rooms as tile layouts.
- Runtime: budget guard, loop detector, role limits, pause flag, structured outputs, fake adapter by default.
- Bunni worker: path guard (tested against symlink escapes), read-only asset index, episode create and package with the anchor rules enforced, paid jobs refused by configuration.
- HQ: private magic-link gate with an email allowlist, 2D company view reading rows.

Not done, by design: the 3D scene, tool-use loops, meetings, memory retrieval, any paid call, any production deployment change.

# Phase 1: the living headquarters

Done on the `studio` branch, 9 October 2026.

- Durable episode workflow (`apps/runtime/src/workflow.ts`): research, pick, two blind writers, review, measurement plan, approval item, founder approval, production dispatch, estimate. One task per (workflow, step, owner) by unique index; `advance()` is re-entrant; the tick re-enqueues queued turns with singleton keys.
- Approvals control execution: the Production Manager re-checks the approval row before dispatch; rejection ends the workflow.
- Bunni integration speaks her contract: jobs in her schema into `production/jobs/inbox/`, her simulated runner, her outbox, her event log mirrored into `studio.events`, her integrity check at worker start.
- 3D headquarters: isometric diorama, rooms lit by real activity, capsule avatars with billboard labels driven by the snapshot, boardroom with the approval queue, agent panels with instruction input, workflow panels, event ticker, pause switch.
- Realtime: Supabase `postgres_changes` on `studio.events` when the anon key is present; polling fallback otherwise, shown in the header.
- Verification: `cli verify` runs twelve checks against the live database.

Known limits: Realtime unverified without the anon key; drei `Html` labels black out headless captures (replaced with in-scene text); meetings, memory retrieval and the tool-use loop remain phase 4 work.
