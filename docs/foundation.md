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
