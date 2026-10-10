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

# Phase 1.5: the visual overhaul, Writers' Room slice

Done on the `studio` branch, 9 October 2026. Art direction and results: https://claude.ai/code/artifact/1102d6b3-9ee3-41a2-9c77-2eebb9e7b884

- New scene under `apps/hq/components/hq/v2`: material library, parametric furniture, building shell with glazing, partitions and doors, perspective camera with three framings on `camera-controls`, N8AO, SMAA, restrained bloom, procedural environment light, performance tiers.
- Writers' Room vertical slice: two parametric writers (state-driven typing, leaning, glances), two complete workstations with live monitor textures, mood board from Bunni's references (`public/moodboard`, resized copies), whiteboard with the current brief, bookshelf, plants, pendants.
- Other rooms keep the new shell with grey block-out desks and capsule avatars until the slice is approved.
- Capture tooling in the session scratchpad: headless CDP script (`?capture=1` keeps the drawing buffer) and a visible-Chrome recorder measuring frame rate on the real GPU.
- `FAKE_TURN_MS` on the runtime keeps a simulated run open for a chosen time so working states can be observed; it spends nothing.

# Phase 1.5B: game-art pipeline and the performance gate

Done on the `studio` branch, 10 October 2026. Asset provenance: `docs/assets/REGISTER.md`.

- Static batching (`apps/hq/components/hq/v2/batch.ts`, `Batched.tsx`): every static thing in the building is merged into one geometry per material. The shell, the block-out desks and the Writers' Room furniture are three batches. Clickable rooms and workstations keep invisible hit volumes; merged meshes never answer raycasts. Production build, post off, counts are hardware independent: overview 1,020 → 179 draw calls, room 778 → 154, employee 739 → 146. Triangles ~115k → ~128k (non-indexed merges).
- Hybrid pipeline: procedural stays for what the database drives (rooms, partitions, screens, indicators, the creative wall); authored GLB for furniture and people. `?furniture=glb` swaps the Writers' Room furniture for KayKit Furniture Bits (CC0) re-materialised through a generated palette atlas, one draw call for the whole set. Monitors and keyboards stay procedural because the pack has no office electronics.
- Rigged writers (`RiggedWriter.tsx`): Quaternius Modular Men/Women (CC0) restyled by material name, Idle clip from the pack, seated pose, typing, leaning, chin-hand and glances as bone overrides on named joints after the clip each frame. Same state mapping as before: nobody types without an open run. `?writers=parametric` restores the old rig for comparison.
- Measurement on the founder's machine: `?stats=1` prints draw calls, triangles, resolution and a 10 s benchmark (median, 1 % low, longest frame) into the page. The local production build runs with `HQ_LOCAL_BENCH=1 pnpm -s next start -p 3101` from `apps/hq`; that flag enables the dev founder bypass for a local production build only and is ignored on Vercel.
- Flags for bisecting: `nofx`, `noao`, `nobloom`, `nosmaa`, `msaa`, `noshadow`, `notext`, `noblockout`, `tierlock`, `dpr1`, `capture`.
- Not done: Blender is not installed, so FBX-only packs and custom clothing could not be authored; Universal Base Characters (the better rigged base) wait on that. No purchases, no paid calls, no Bunni canon changes, no deploy.
