# Palot PM Side Agents Panel Plan <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Finish `/#/project-manager` by keeping current live `/api/ch5pm/state` Dense Console, replacing placeholder Side Agents tab with daemon-backed side-agent + queue panels, and moving all PM normalization into one tested mapper so source truth stays explicit and degraded states fail loud.
>
> **Deliverables**:
> - shared PM composition module for `/api/ch5pm/state`, `/api/ch5pm/babysitter`, `/api/ch5pm/queue`, `/api/ch5pm/health`, and static registry metadata
> - real `Side Agents` dockview panel with live loop health, per-box digests, decision-needed rows, recent actions, degraded reasons, feed freshness, and queue/terminal groupings
> - freshness/source badges and deep links proving what is live-fed vs detected-from-state vs static-known
> - regression tests and live proof steps for browser mode at `http://localhost:20883/#/project-manager`
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves + final verification
> **Critical Path**: audit/source rules -> shared mapper -> Side Agents panel -> proof + tests

---

## Context

### Original Request
Audit live Palette Project Manager page and CH5 daemon / PM state, then finish decision-complete plan for visually displaying all PM-relevant information in Project Manager UI.

### Why this stays in existing lineage
Use existing plan artifact: `.sisyphus/plans/pm-side-agents-panel.md`.
Reason: requested remaining work is direct continuation of same seam — same route, same placeholder Side Agents tab, same daemon babysitter feed, same source-truth problem. New plan would split one UI slice across artifacts and lose prior audit context.

### Repo / branch / recent proof
- Repo: `palot`
- Branch: `rescue/pm-side-agents-seam`
- Recent pushed fix: `083e5765` `fix(pm): render live project manager dashboard`
- Live browser proof already reported: `http://localhost:20883/#/project-manager` renders Dense Console with daemon-backed counters from `/api/ch5pm/state`
- Devmux now: `server` up on `30206`, `web` up on `20883`, desktop down — browser-mode proof path is canonical for this slice

### Audit Findings
- `apps/desktop/src/renderer/components/project-manager.tsx` is now only dockview shell wrapper for PM route.
- `apps/desktop/src/renderer/components/pm-dockview.tsx` still ships placeholder `AgentsPanel` and placeholder lineage text.
- `apps/desktop/src/renderer/components/pm-live-dashboard.tsx` already fetches only `/api/ch5pm/state`, renders Dense Console, and still owns lots of local normalization inline.
- `apps/server/src/routes/ch5pm.ts` already proxies `GET /state`, `GET /babysitter`, `GET /queue`, `GET /health`, and attention mutations. No new backend route family needed unless type/test gaps found.
- `apps/desktop/src/renderer/services/backend.ts` and `apps/desktop/src/renderer/services/elf-server.ts` already expose state/babysitter/queue/health fetch seams with consistent naming. No rename project needed; only keep naming aligned as work expands.
- `apps/desktop/src/renderer/pm-side-agents/types.ts` and `apps/desktop/src/renderer/pm-side-agents/composition.ts` already exist, but `composition.ts` is currently unwired/dead code and current queue model still assumes wrong payload fields. Atlas should rehabilitate or replace this seam deliberately, not assume it is already authoritative.
- Legacy `apps/desktop/src/renderer/ch5pm-dashboard/panel.tsx` remains separate older dashboard surface. Treat as audit/reference only; do not make Project Manager depend on it.
- `apps/desktop/src/renderer/project-manager.test.ts` exists as focused Bun test file, but there is no broad established renderer component-test harness in this slice. Plan should prefer pure mapper tests first and keep component tests narrow.
- Current dirty tree includes unrelated files (`apps/desktop/src/renderer/services/backend.ts`, `bun.lock`, many `.sisyphus/*`, generated shared files). Atlas must pathscope changes and must not attribute unrelated status to PM slice.

### Live endpoint audit
- `/api/ch5pm/state`: keys include `boxes`, `sessions`, `lanes`, `backgroundAgents`, `planeSummary`, `needsChris`, `attentionQueue`, `degradedReasons`, `updatedAt`, plus other useful fields like `cluster`, `dataAges`, `judgment`, `lastTick`, `recentCompletions`, `schemaVersion`; live counts observed: boxes=3, sessions=59, lanes=54, backgroundAgents=4, needsChris=2, attentionOpen=0.
- `/api/ch5pm/babysitter`: keys include `ok`, `health`, `helper`, `hubBoxId`, `generatedAt`, `boxes`, `recentActions`, `attention`, `babysitterLoop`, `degradedReasons`, `dataAges`; observed counts: boxes=2, recentActions=200, attention=34, degradedReasons=0.
- `/api/ch5pm/babysitter` box rows contain `actions`, `sessions`, `notes`, `modelPassRan`, `intervalSeconds`; session rows contain `ageMin`, `classification`, `gist`, `manualOwned`, `parked`, `reason`, `severity`, `title`.
- `/api/ch5pm/queue`: actual live payload is queue envelope with top-level `ok`, `health`, `helper`, `rows`, `generatedAt`, `degradedReasons`, `dataAges`. `rows` is object-shaped with `jobs[]` and `claims[]` inside — not top-level `jobs`/`claims`, and not flat row array. Observed degraded reason: `terminal-jobs-need-reconcile:29`.
- Live queue `jobs[]` use fields like `jobId`, `ticketId`, `repoId`, `state`, `sessionId`, `workerId`, `enqueuedAt`, `startedAt`, `endedAt`, `completedSteps`, `rollbackSteps`, `failedStep`, `failedStepReason`, `metadata`.
- `/api/ch5pm/health`: healthy; includes `ok`, `health`, `helper`, `runtimeStateFile`, `generatedAt`, `version`, `babysitterLoop`, `dataAges`, `degradedReasons`.

### Existing unrelated verification blocker
- Repo docs already record unrelated typecheck blocker outside this slice: `docs/genui-artifact-architecture.md:412` says repo-wide typecheck is blocked by merge conflict in `../ch5-packages/packages/motion/motion/package.json`.
- Atlas must call this out when running repo-wide checks so PM slice is not blamed for foreign failure.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Make `/#/project-manager` visually complete for PM operations by turning Side Agents into first-class live surfaces while preserving current Dense Console and making source authority unmistakable.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- Replace placeholder Side Agents dockview tab with live daemon-fed panel.
- Add queue/terminal panel rows grouped from `/api/ch5pm/queue` into failed, timed-out, retry, merge-ready, and needs-human buckets.
- Extract all reusable PM normalization into one tested composition module consumed by both Dense Console and Side Agents panel.
- Add freshness + source badges for `/pm/state`, `/pm/babysitter`, `/queue`, `/health`, and static registry metadata.
- Add direct links to session / Plane only where source truth supports concrete ids/urls.
- Keep degraded/offline rendering loud. No stale fallback.

### Source-of-Truth Rules <!-- oc:id=sec_af -->
- **Live-fed**: `/api/ch5pm/babysitter`, `/api/ch5pm/queue`, `/api/ch5pm/health`.
- **Detected-from-PM-state**: `/api/ch5pm/state` fields like boxes, sessions, lanes, `backgroundAgents`, `needsChris`, `attentionQueue`, `planeSummary`.
- **Static-known**: renderer-local side-agent registry metadata only — display names, expected responsibilities, expected prompt-charter status, docs links, known box role descriptions.
- Dense Console stays operational when only `/api/ch5pm/state` succeeds. Side-agent fetch failure must degrade only side-agent surfaces, not blank core PM state.
- Never show green/live health badge for anything sourced only from PM state or static registry.
- Never infer daemon health from static/detected-only data.
- Plane/session links only when payload has concrete `ticketId`, `planeUrl`, `sessionId`, or resolvable route slug.

### Must Have <!-- oc:id=sec_ag -->
- Side Agents tab shows live loop state, feed freshness, box digests, decision-needed rows, recent actions, degraded reasons.
- Queue panel shows grouped queue/terminal rows from actual queue payload shape.
- Shared mapper handles payload mismatch between current queue types and actual live queue `rows` shape.
- Dense Console keeps current design language and benefits from extracted state mapper, not duplicate inline parsing.
- All failure states render visible red/amber source badges and banner text naming broken upstream.

### Must NOT Have <!-- oc:id=sec_ah -->
- No daemon schema redesign unless hard blocker proven with exact field gap.
- No silent fallback to stale files or mock data in production route.
- No claims that static-known or PM-state-detected agents are live-fed.
- No design-system departure unless needed for readability inside existing PM visual language.
- No dependency on legacy `ch5pm-dashboard/panel.tsx` runtime.

---

## Verification Strategy

> Zero human-only acceptance. Atlas must prove with commands, tests, and browser route.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: `bun test`
- **Component test note**: repo has focused Bun/unit tests, not broad renderer-component infra in this slice. Prefer pure mapper tests first; add component rendering tests only where current setup already supports them.
- **Render proof bias**: browser proof is higher-value than building new component-test scaffolding for this slice.

### Required proof lanes
- `bun run svc:status` — `server` and `web` must be running; `desktop` may stay down.
- `curl http://127.0.0.1:30206/api/ch5pm/state`
- `curl http://127.0.0.1:30206/api/ch5pm/babysitter`
- `curl http://127.0.0.1:30206/api/ch5pm/queue`
- `curl http://127.0.0.1:30206/api/ch5pm/health`
- targeted `bun test` for mapper / route / component tests
- browser proof at `http://localhost:20883/#/project-manager`
- if browser automation lane is unavailable, fallback proof is screenshot/manual DOM capture via existing local browser plus saved notes — but only for proof collection, not for product behavior decisions

### Evidence policy
- UI screenshots or textual DOM capture under `.sisyphus/evidence/pm-side-agents/`
- Curl payload summaries under same folder
- If repo-wide `bun run check-types` fails on known external blocker, capture failure and annotate blocker source explicitly

---

## Execution Strategy <!-- oc:id=sec_ai -->

### UI layout plan <!-- oc:id=sec_aj -->
- Keep existing dockview shell with tabs: `Dense Console`, `Side Agents`, `Lineage`.
- Dense Console remains default first tab.
- Side Agents tab becomes split vertical stack:
  - top header strip: overall live severity, per-source freshness badges, last update stamps, quick open links
  - upper body: babysitter loop card, degraded reasons banner, per-box digests, decision-needed sessions table
  - lower body: recent actions feed and queue/terminal grouped buckets
- Start stacked, not forced two-column. Dockview width is variable; stacked sections are safer default and can still become columns if browser proof shows enough room.
- Optional compact cross-link chips inside Dense Console header/footer for side-agent freshness and queue severity. Do not duplicate whole side-agent panel inside Dense Console.

### Component boundaries <!-- oc:id=sec_ak -->
- `apps/desktop/src/renderer/pm-side-agents/types.ts`
  - canonical renderer types for live PM side-agent sources
  - fix queue typing to actual `rows` payload shape; keep old names only behind adapter types if needed
- `apps/desktop/src/renderer/pm-side-agents/composition.ts`
  - single source for PM UI normalization
  - own source snapshots, freshness, severity, queue grouping, per-box digests, agent provenance labels, deep-link derivation
  - absorb reusable normalization now living in `pm-live-dashboard.tsx`
  - may expose smaller pure helpers for queue grouping / badge derivation if that keeps tests narrow
- `apps/desktop/src/renderer/pm-side-agents/registry.ts` (new or keep existing if present after audit)
  - static-known agent metadata only
- `apps/desktop/src/renderer/pm-side-agents/links.ts` (new if cleaner)
  - resolvers for session route / Plane URL / daemon source docs links
- `apps/desktop/src/renderer/components/pm-live-dashboard.tsx`
  - fetch state via shared hook/query path
  - stop owning bespoke inline normalization where mapper now covers same fields
  - keep layout mostly same
  - explicitly stays state-first; do not make it depend on successful babysitter/queue fetch before rendering core PM state
- `apps/desktop/src/renderer/components/pm-dockview.tsx`
  - replace placeholder `AgentsPanel` with real panel component wired to shared model
  - keep panel registration structure unchanged unless dockview behavior forces adjustment
  - preserve current simple `onReady -> addPanel` pattern instead of inventing a new dockview state layer for this slice
- `apps/desktop/src/renderer/components/pm-side-agents-panel.tsx` (new)
  - presentational component for Side Agents tab
- `apps/desktop/src/renderer/components/pm-source-badge.tsx` (new or inline shared subcomponent)
  - reusable badge for live-fed / detected / static + freshness + degraded text
- `apps/server/src/routes/ch5pm.ts`
  - likely no new routes; only tighten comments/tests if needed
- `apps/desktop/src/renderer/services/backend.ts` and `apps/desktop/src/renderer/services/elf-server.ts`
  - align naming so state/feed/queue/health fetch seams match one vocabulary

### Queue grouping plan <!-- oc:id=sec_al -->
Actual live queue payload exposes top-level `rows`, where `rows.jobs[]` and `rows.claims[]` carry the actionable data. Mapper must preserve this envelope and derive buckets from job `state`, `failedStep`, `failedStepReason`, metadata, and claim status.
- **failed**: `rows.jobs[].state === "failed"`
- **timed-out**: `rows.jobs[].state === "timed-out"`
- **retry**: failed/timed-out jobs with explicit recoverable reason and not yet released/closed
- **merge-ready**: jobs with concrete durable-success evidence only — explicit `READY-TO-INTEGRATE`, equivalent verified-success marker, or other source-truth field Atlas can point to. Absence of failure is not enough.
- **needs-human**: jobs or claims with blocked plane state, reconcile warnings, cap-exceeded/escalation, verify ambiguity, or any terminal state Atlas cannot classify with high confidence
- If a row fits multiple buckets, precedence is: `needs-human` > `merge-ready` > `retry` > `timed-out` > `failed`.
- Current wrong assumptions to remove: top-level `jobs`/`claims`, `id` instead of `jobId`, `status` instead of `state`, `ticket` instead of `ticketId`, `repo` instead of `repoId`.
- Keep raw `rows` envelope accessible for future debug drawer; do not destroy source fidelity

### Freshness + severity rules <!-- oc:id=sec_am -->
- `pm/state`: fresh if `updatedAt` <= 2m old; stale amber after 2m; missing red.
- `babysitter`: fresh if `generatedAt` or `dataAges.feed` resolves to <= 5m effective age; stale amber after 5m; missing red.
- `queue`: fresh if `generatedAt` <= 2m; stale amber after 2m; degraded when `degradedReasons` non-empty even if fresh.
- `health`: fresh if `generatedAt` or equivalent timestamp <= 2m; degraded if `health !== "healthy"` or `degradedReasons` non-empty.
- static registry: always neutral `static` badge. Never green.
- detected-from-state: neutral/amber based on state freshness, labeled `detected`, never `live`.
- If timestamp semantics from daemon are ambiguous during implementation, Atlas must codify one parser in mapper tests and document fallback order instead of letting components guess.


### Link policy <!-- oc:id=sec_an -->
- Session route link only when session id maps to current app route slug or direct session route candidate.
- Plane link only when payload already includes `planeUrl` or ticket id can safely map to Plane URL format already used elsewhere in repo.
- Daemon docs/source links may point to local docs or subsystem catalog for static-known agents.

### Dirty-tree handling for Atlas <!-- oc:id=sec_ao -->
- Start by classifying current unrelated dirt before editing.
- Pathscope only PM files listed in tasks.
- Do not touch unrelated `bun.lock`, generated shared d.ts/js, or `.sisyphus` evidence unless task explicitly writes new PM evidence.

---

## TODOs

- [x] 1. Audit and lock PM source contracts

  **What to do**:
  - Re-read actual live payloads for `/api/ch5pm/state`, `/api/ch5pm/babysitter`, `/api/ch5pm/queue`, `/api/ch5pm/health` and compare them against current renderer types and mapper assumptions.
  - Document exact field ownership: which PM UI widgets read from state, babysitter, queue, health, or static registry.
  - Fix plan-time contract assumptions now: queue uses `rows[]`, not `jobs[]`/`claims[]`, unless Atlas proves backend changed during execution.
  - Record current dirty-tree exclusions so implementation stays pathscoped.

  **Must NOT do**:
  - Do not start coding around guessed queue shapes.
  - Do not broaden scope into daemon schema redesign.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: audit + contract locking is bounded and decisive.
  - **Skills**: [`caveman`]
    - `caveman`: keeps audit notes and mapper rules crisp.
  - **Skills Evaluated but Omitted**:
    - `research-pm`: unnecessary; source surfaces already local and live.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential foundation
  - **Blocks**: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
  - **Blocked By**: None

  **References**:
  - `apps/server/src/routes/ch5pm.ts:11` - exact proxy route contract already exposed to renderer.
  - `apps/desktop/src/renderer/services/backend.ts:664` - current fetch seams for state, babysitter, queue, health.
  - `apps/desktop/src/renderer/services/elf-server.ts:397` - browser-mode RPC contract names.
  - `apps/desktop/src/renderer/pm-side-agents/types.ts:105` - current babysitter/queue type assumptions needing audit.
  - `apps/desktop/src/renderer/pm-side-agents/composition.ts:116` - current shared mapper seam.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:67` - inline normalization currently bypassing shared mapper.
  - `apps/desktop/src/renderer/components/pm-dockview.tsx:21` - placeholder Side Agents panel to replace.

  **Acceptance Criteria**:
  - [ ] Contract audit lists every PM data source and consumer.
  - [ ] Queue payload mismatch is explicitly resolved in plan implementation notes.
  - [ ] Dirty-tree exclusions are written into implementation notes/evidence.

  **QA Scenarios**:
  ```text
  Scenario: Live contract audit matches current daemon outputs
    Tool: Bash (curl)
    Preconditions: `bun run svc:status` shows `server` and `web` running
    Steps:
      1. `curl -sS http://127.0.0.1:30206/api/ch5pm/state`
      2. `curl -sS http://127.0.0.1:30206/api/ch5pm/babysitter`
      3. `curl -sS http://127.0.0.1:30206/api/ch5pm/queue`
      4. `curl -sS http://127.0.0.1:30206/api/ch5pm/health`
      5. Assert queue payload exposes `rows` and babysitter payload exposes `boxes`, `recentActions`, `attention`, `babysitterLoop`
    Expected Result: audit notes reflect real payload keys, not stale assumptions
    Failure Indicators: mapper still assumes `jobs`/`claims` without adapter proof
    Evidence: .sisyphus/evidence/pm-side-agents/task-1-live-contract-audit.txt

  Scenario: Dirty tree classified before edits
    Tool: Bash (git status)
    Preconditions: repo has unrelated changes
    Steps:
      1. Run `git status --short --branch`
      2. Record unrelated paths outside PM slice
      3. Assert implementation pathscope excludes unrelated files like `bun.lock`
    Expected Result: PM work plan names safe edit set and excluded dirt
    Evidence: .sisyphus/evidence/pm-side-agents/task-1-dirty-tree-scope.txt
  ```

  **Commit**: NO

- [x] 2. Tighten shared PM types around real source payloads

  **What to do**:
  - Update `apps/desktop/src/renderer/pm-side-agents/types.ts` to reflect real babysitter and queue payloads.
  - Introduce explicit queue row types for terminal/claim status instead of fake `jobs`/`claims` top-level payload unless adapter layer intentionally derives them.
  - Add provenance comments for every source family: state, babysitter, queue, health, static registry.
  - Align fetch function names/types between `backend.ts` and `elf-server.ts` so implementation reads as one vocabulary.

  **Must NOT do**:
  - Do not make every field optional to hide drift.
  - Do not duplicate `Ch5PmLiveState` semantics inside side-agent types.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded type-authority work.
  - **Skills**: [`caveman`]
    - `caveman`: concise provenance comments.
  - **Skills Evaluated but Omitted**:
    - `omo-agents`: not needed for raw data contract work.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 4, 5, 6, 8, 10, 12
  - **Blocked By**: 1

  **References**:
  - `apps/desktop/src/renderer/pm-side-agents/types.ts:1` - current contract file to tighten.
  - `apps/desktop/src/renderer/ch5pm-dashboard/types.ts:444` - existing PM state types to reuse, not clone.
  - `apps/desktop/src/renderer/services/backend.ts:683` - typed fetch return types currently wired.
  - `apps/desktop/src/renderer/services/elf-server.ts:405` - browser-mode fetch naming for side-agent sources.

  **Acceptance Criteria**:
  - [ ] Queue payload typing matches real response shape.
  - [ ] Shared fetch seam names are consistent enough that atlas can consume them without alias confusion.
  - [ ] Type provenance comments point to actual local source seams.

  **QA Scenarios**:
  ```text
  Scenario: Type fixtures compile against real payload samples
    Tool: bun test
    Preconditions: sample payload fixtures captured from live curl output
    Steps:
      1. Run targeted type/fixture tests for PM side-agent payload parsing
      2. Assert queue fixture uses `rows` shape and babysitter fixture uses `boxes` digests
    Expected Result: tests fail if payload shape drifts
    Evidence: .sisyphus/evidence/pm-side-agents/task-2-type-fixtures.txt

  Scenario: Naming seam consistent across browser and electron service layers
    Tool: Read + bun test
    Preconditions: updated service wrappers
    Steps:
      1. Inspect `backend.ts` and `elf-server.ts` exported fetch names
      2. Run targeted import test if added
    Expected Result: one consistent fetch vocabulary for state/feed/queue/health
    Evidence: .sisyphus/evidence/pm-side-agents/task-2-service-vocabulary.txt
  ```

  **Commit**: NO

- [x] 3. Define static-known side-agent registry and provenance metadata

  **What to do**:
  - Create or tighten a registry module listing known PM-relevant agent families, labels, responsibilities, expected source (`live-fed`, `detected`, `static`), and docs links.
  - Mark which agents can have live babysitter rows vs which are inferred only from PM state or registry.
  - Add prompt-charter metadata fields: durable charter doc present, spawn-brief-only, or unknown.

  **Must NOT do**:
  - Do not infer runtime health from registry presence.
  - Do not bury provenance in JSX literals.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: mostly metadata and crisp labeling rules.
  - **Skills**: [`caveman`]
    - `caveman`: keeps registry labels short and explicit.
  - **Skills Evaluated but Omitted**:
    - `research-pm`: use only if local docs prove insufficient.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 5, 6, 7, 8
  - **Blocked By**: 1

  **References**:
  - `.sisyphus/drafts/pm-side-agents-panel.md:6` - original side-agent scope and source doctrine.
  - `apps/desktop/src/renderer/pm-side-agents/types.ts:14` - current classification vocabulary.
  - `apps/desktop/src/renderer/components/pm-dockview.tsx:37` - target panel slot for registry-backed labels.

  **Acceptance Criteria**:
  - [ ] Every static-known agent card declares provenance class.
  - [ ] Prompt-charter status is represented as data, not prose in render logic.
  - [ ] Registry includes docs/deep-link metadata where source truth exists.

  **QA Scenarios**:
  ```text
  Scenario: Static registry never renders as live
    Tool: bun test
    Preconditions: registry metadata + mapper tests
    Steps:
      1. Feed mapper registry-only entry with no live payload rows
      2. Assert badge says `static` or `detected`, never `live`
    Expected Result: false-live regression blocked
    Evidence: .sisyphus/evidence/pm-side-agents/task-3-registry-provenance.txt

  Scenario: Charter status visible for each known family
    Tool: bun test
    Preconditions: registry includes charter metadata
    Steps:
      1. Render/inspect mapped registry output
      2. Assert each row includes one of `durable-charter`, `spawn-brief-only`, `unknown`
    Expected Result: prompt-management state deterministic
    Evidence: .sisyphus/evidence/pm-side-agents/task-3-charter-status.txt
  ```

  **Commit**: NO

- [x] 4. Promote one PM composition module to source authority

  **What to do**:
  - Refactor `apps/desktop/src/renderer/pm-side-agents/composition.ts` into sole normalization authority for PM route.
  - Move reusable normalization out of `pm-live-dashboard.tsx`: age formatting inputs, lane/session/source severity derivation, box/session digestion, queue grouping, freshness/source badges, link derivation.
  - Keep module pure: inputs are raw payloads + optional registry + now timestamp; outputs are view models only.
  - Make output structure cover both Dense Console and Side Agents tab so no panel re-parses raw JSON.

  **Must NOT do**:
  - Do not leave duplicate queue/box/session parsing in `pm-live-dashboard.tsx`.
  - Do not mix fetch side effects into mapper.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: this is central seam controlling many UI consumers.
  - **Skills**: [`react-best-practices`, `caveman`]
    - `react-best-practices`: clean view-model boundary for renderer.
    - `caveman`: concise naming and badge semantics.
  - **Skills Evaluated but Omitted**:
    - `software-design-principles`: optional, but current seam is small enough without extra doctrine loading.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Critical path
  - **Blocks**: 6, 7, 8, 9, 10, 11, 12
  - **Blocked By**: 2, 3

  **References**:
  - `apps/desktop/src/renderer/pm-side-agents/composition.ts:116` - current composition entry point.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:131` - current inline box normalization.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:67` - current lane status normalization.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:76` - current age formatting logic.
  - `apps/desktop/src/renderer/project-manager-cards.ts:27` - existing pure PM mapping style worth mirroring.

  **Acceptance Criteria**:
  - [ ] Dense Console and Side Agents panel can consume one mapper output.
  - [ ] Mapper output separates `live-fed`, `detected`, and `static` provenance.
  - [ ] Queue groupings, freshness, severity, and links derive in one place.

  **QA Scenarios**:
  ```text
  Scenario: Shared mapper drives both PM surfaces
    Tool: bun test
    Preconditions: mapper exposes combined view-model fixture
    Steps:
      1. Build one fixture using state + babysitter + queue + health + registry
      2. Assert output contains dense-console-ready rows and side-agent-ready groups without raw JSON parsing in components
    Expected Result: one view model powers both surfaces
    Evidence: .sisyphus/evidence/pm-side-agents/task-4-shared-mapper.txt

  Scenario: Loud degraded output when babysitter missing
    Tool: bun test
    Preconditions: state present, babysitter null, queue/health optional
    Steps:
      1. Compose model with missing babysitter payload
      2. Assert severity becomes degraded/offline, banner reasons mention broken upstream, source badge shows missing live feed
    Expected Result: no silent disappearance or fake healthy state
    Evidence: .sisyphus/evidence/pm-side-agents/task-4-degraded-severity.txt
  ```

  **Commit**: NO

- [x] 5. Rewire Dense Console to consume shared mapper outputs

  **What to do**:
  - Keep current Dense Console visual language and section order.
  - Replace only overlapping local parsing in `pm-live-dashboard.tsx` with mapped values from shared composition module.
  - Leave PM-state-specific presentation local where extraction would create artificial abstraction with no second consumer.
  - Add compact source/freshness badges at section header/footer where they clarify data origin without clutter.
  - Preserve existing `needsChris`, sessions, lanes, followups, boxes, and attention queue behavior unless source-truth change demands precise label update.

  **Must NOT do**:
  - Do not redesign Dense Console layout unless mapper integration forces tiny cosmetic adjustments.
  - Do not regress current state-only proof path.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI integration without changing product language.
  - **Skills**: [`react-best-practices`, `caveman`]
    - `react-best-practices`: avoid unnecessary rerenders / prop churn.
    - `caveman`: concise badge copy.
  - **Skills Evaluated but Omitted**:
    - `visual-tdd`: no pixel-diff requirement here.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 10, 11, 12
  - **Blocked By**: 4

  **References**:
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:554` - current top-level grid layout.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:630` - current footer provenance text.
  - `apps/desktop/src/renderer/components/pm-attention-queue.tsx:260` - current AskHuman queue component already embedded in PM flow.

  **Acceptance Criteria**:
  - [ ] Dense Console still renders current live `/api/ch5pm/state` sections.
  - [ ] Shared mapper removes duplicate local normalization.
  - [ ] Added badges do not falsely mark state-derived rows as live-fed daemon data.

  **QA Scenarios**:
  ```text
  Scenario: Dense Console still shows current counters and rows
    Tool: Browser
    Preconditions: devmux `server` and `web` running
    Steps:
      1. Open `http://localhost:20883/#/project-manager`
      2. Verify `Dense Console` tab selected by default
      3. Assert visible counters still reflect live state (`boxes=3`, `sessions=59`, `ready=10`, `needs=2`, schema badge if present)
    Expected Result: existing dashboard proof preserved
    Evidence: .sisyphus/evidence/pm-side-agents/task-5-dense-console-browser.png

  Scenario: State-derived sections labeled as detected/state, not live side-agent feed
    Tool: Browser or component test
    Preconditions: mapper-backed badges wired into section chrome
    Steps:
      1. Inspect sessions/needs/boxes sections
      2. Assert badges identify source as `pm/state` or `detected`
      3. Assert no green `live` label appears on purely state-derived data
    Expected Result: provenance line explicit and correct
    Evidence: .sisyphus/evidence/pm-side-agents/task-5-provenance-badges.txt
  ```

  **Commit**: NO

- [x] 6. Build real Side Agents dockview panel shell

  **What to do**:
  - Add presentational Side Agents panel component and wire it into `pm-dockview.tsx` in place of placeholder copy.
  - Use existing dockview/tab language; no new layout framework.
  - Panel shell should include header strip, scroll regions, empty state, degraded state, and content sections for loop, boxes, decisions, actions, and queue groups.
  - Fetch side-agent-specific sources in panel/query layer without making `PmLiveDashboard` wait on them. State route must stay independently renderable.

  **Must NOT do**:
  - Do not leave placeholder text anywhere in Side Agents tab.
  - Do not make panel depend on legacy `ch5pm-dashboard/panel.tsx`.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: component composition + layout work.
  - **Skills**: [`react-best-practices`, `caveman`]
    - `react-best-practices`: split presentational subcomponents cleanly.
    - `caveman`: terse labels for dense ops UI.
  - **Skills Evaluated but Omitted**:
    - `agent-browser`: useful later for proof, not for component authoring.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 10, 11, 12
  - **Blocked By**: 4

  **References**:
  - `apps/desktop/src/renderer/components/pm-dockview.tsx:21` - placeholder to replace.
  - `apps/desktop/src/renderer/components/project-manager.tsx:3` - PM route wrapper.
  - `apps/desktop/src/renderer/ch5pm-dashboard/panel.tsx:35` - reference for stat/section card vocabulary only, not dependency.

  **Acceptance Criteria**:
  - [ ] Side Agents tab is a real component with scrollable sections.
  - [ ] Header shows overall live severity and source badges.
  - [ ] Empty/degraded states are explicit and loud.
  - [ ] Panel can render in narrow dockview widths without horizontal-breakage becoming default behavior.

  **QA Scenarios**:
  ```text
  Scenario: Side Agents tab opens and renders non-placeholder shell
    Tool: Browser
    Preconditions: PM page loaded
    Steps:
      1. Click `Side Agents` tab
      2. Assert placeholder sentence is gone
      3. Assert panel shows sections for loop, boxes, recent actions, queue, or degraded/empty states
    Expected Result: real dockview panel visible
    Evidence: .sisyphus/evidence/pm-side-agents/task-6-side-agents-shell.png

  Scenario: Offline shell renders loud banner
    Tool: component test
    Preconditions: mapper severity set to offline
    Steps:
      1. Render panel with missing feed/health payloads
      2. Assert red banner names broken upstream and panel body remains mounted
    Expected Result: fail-loud offline state
    Evidence: .sisyphus/evidence/pm-side-agents/task-6-offline-shell.txt
  ```

  **Commit**: NO

- [x] 7. Render live babysitter loop, per-box digests, and decision-needed rows

  **What to do**:
  - Use shared mapper output to render babysitter loop card: running/stalled/failed, interval, passes, last run, last digest, last error.
  - Render per-box digests with source box id, generated age, model-pass-ran, notes, degraded tags, and compact session counts by classification.
  - Render decision-needed table from babysitter `attention[]` plus per-session rows from box digests when classification or severity warrants visibility.
  - Expose direct session links only when session route resolution is real.

  **Must NOT do**:
  - Do not claim decision-needed rows come from AskHuman queue when they come from babysitter attention.
  - Do not flatten away box boundaries.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: rich state display in existing ops UI language.
  - **Skills**: [`react-best-practices`, `caveman`]
    - `react-best-practices`: dense tables/cards without messy state.
    - `caveman`: keeps cell copy short.
  - **Skills Evaluated but Omitted**:
    - `grafana-dashboards`: not relevant; this is in-product UI, not metrics dashboarding.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 10, 11, 12
  - **Blocked By**: 4, 6

  **References**:
  - `apps/desktop/src/renderer/pm-side-agents/types.ts:75` - loop status type.
  - `apps/desktop/src/renderer/pm-side-agents/types.ts:64` - per-box digest type.
  - `apps/desktop/src/renderer/pm-side-agents/types.ts:86` - babysitter attention row type.
  - `apps/desktop/src/renderer/project-manager-cards.ts:44` - route-resolution pattern for deep links.

  **Acceptance Criteria**:
  - [ ] Loop card shows real live loop status with freshness/severity.
  - [ ] Box digests show per-box summary and session counts.
  - [ ] Decision-needed rows display babysitter attention with box/session context.

  **QA Scenarios**:
  ```text
  Scenario: Healthy babysitter feed renders live loop and box digests
    Tool: Browser
    Preconditions: live `/api/ch5pm/babysitter` healthy
    Steps:
      1. Open `/#/project-manager` -> `Side Agents`
      2. Assert loop card shows running state, interval `180s`, and recent digest time
      3. Assert two box digests render from live feed and at least one decision-needed row appears if feed attention non-empty
    Expected Result: live babysitter data visible and source-labeled
    Evidence: .sisyphus/evidence/pm-side-agents/task-7-live-babysitter.png

  Scenario: Loop failure renders degraded reasons
    Tool: component test
    Preconditions: mapper fixture with `babysitterLoop.lastError` set
    Steps:
      1. Render side-agent panel with failed loop fixture
      2. Assert loop card status `failed`, last error text, and degraded badge visible
    Expected Result: stalled/failed loop cannot appear healthy
    Evidence: .sisyphus/evidence/pm-side-agents/task-7-loop-failure.txt
  ```

  **Commit**: NO

- [x] 8. Add queue / terminal groups from live `/api/ch5pm/queue`

  **What to do**:
  - Map actual queue `rows[]` into grouped buckets: failed, timed-out, retry, merge-ready, needs-human.
  - Surface failed step, failed-step reason, plane state, verify-pending/reconcile hints, and repo/box/session metadata.
  - Add quick links or labels to sessions / Plane comments only when row metadata supports it.
  - Keep raw-source badge on queue panel to show this is terminal queue truth, not daemon babysitter truth.

  **Must NOT do**:
  - Do not fabricate merge-ready from weak heuristics; require concrete metadata or plane state markers.
  - Do not hide degraded queue reasons like `terminal-jobs-need-reconcile:29`.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: tricky status grouping and terminal-state semantics.
  - **Skills**: [`caveman`]
    - `caveman`: concise grouping labels for dense queue rows.
  - **Skills Evaluated but Omitted**:
    - `research-pm`: only needed if queue semantics remain unclear after local source read.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 10, 11, 12
  - **Blocked By**: 2, 4, 6

  **References**:
  - `apps/server/src/routes/ch5pm.ts:77` - queue route proxy seam.
  - `apps/desktop/src/renderer/services/backend.ts:701` - queue fetch seam.
  - live queue audit: actual payload uses `rows[]`, `degradedReasons`, `generatedAt`, `dataAges`.

  **Acceptance Criteria**:
  - [ ] Queue panel shows all five requested groupings.
  - [ ] Rows include failure/reconcile context needed for PM action.
  - [ ] Queue degraded reasons are visible in panel chrome.

  **QA Scenarios**:
  ```text
  Scenario: Queue rows group into terminal buckets
    Tool: bun test
    Preconditions: captured queue fixture with mixed row states
    Steps:
      1. Run queue grouping tests
      2. Assert failed/timed-out/retry/merge-ready/needs-human buckets get expected rows
    Expected Result: grouping logic deterministic and tested
    Evidence: .sisyphus/evidence/pm-side-agents/task-8-queue-groups.txt

  Scenario: Live queue degraded banner visible
    Tool: Browser
    Preconditions: live queue endpoint returns `degradedReasons` with `terminal-jobs-need-reconcile:29`
    Steps:
      1. Open `Side Agents` tab
      2. Inspect queue panel header
      3. Assert degraded banner/chip includes reconcile warning and queue freshness badge
    Expected Result: queue trouble visible, not buried
    Evidence: .sisyphus/evidence/pm-side-agents/task-8-live-queue.png
  ```

  **Commit**: NO

- [x] 9. Add freshness/source badges and deep-link affordances

  **What to do**:
  - Add reusable badge component or helper for source authority: `live`, `detected`, `static`, `missing`, freshness age, degraded reason count.
  - Show badges for `/pm/state`, `/pm/babysitter`, `/queue`, `/health`, and static registry references.
  - Add session/Plane/source-doc links where supported.
  - Ensure badge copy distinguishes data-source authority from health state.

  **Must NOT do**:
  - Do not overload one badge to imply both source and health without readable text.
  - Do not create broken links for rows lacking route authority.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: shared UI affordance across sections.
  - **Skills**: [`react-best-practices`, `caveman`]
    - `react-best-practices`: reusable, low-churn badge component.
    - `caveman`: terse badge labels.
  - **Skills Evaluated but Omitted**:
    - `agent-browser`: proof only.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 10, 11, 12
  - **Blocked By**: 4, 5, 6, 7, 8

  **References**:
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:631` - current coarse provenance footer.
  - `apps/desktop/src/renderer/project-manager-cards.ts:44` - project/session slug resolution seam for links.
  - `apps/desktop/src/renderer/project-manager-types.ts:26` - existing Plane/session link fields on ticket cards.

  **Acceptance Criteria**:
  - [ ] Every major PM section shows explicit source authority.
  - [ ] Static/detected-only rows never show live-health styling.
  - [ ] Links only render when concrete authority exists.

  **QA Scenarios**:
  ```text
  Scenario: Source badges distinguish live vs detected vs static
    Tool: component test
    Preconditions: mixed-source fixture
    Steps:
      1. Render badges for state-only, babysitter-live, registry-only, and missing-source cases
      2. Assert labels and tones differ appropriately
    Expected Result: authority semantics unambiguous
    Evidence: .sisyphus/evidence/pm-side-agents/task-9-source-badges.txt

  Scenario: Links render only with resolvable authority
    Tool: bun test or browser
    Preconditions: fixtures with and without session/plane ids
    Steps:
      1. Render row with real session/ticket ids
      2. Render row without ids
      3. Assert first gets clickable link, second gets plain text
    Expected Result: no dead-link UI
    Evidence: .sisyphus/evidence/pm-side-agents/task-9-links.txt
  ```

  **Commit**: NO

- [x] 10. Add mapper and contract regression tests

  **What to do**:
  - Add focused Bun tests for side-agent type fixtures, mapper composition, queue grouping, provenance rules, freshness rules, degraded-state derivation, and bucket precedence.
  - Add route/proxy tests if current backend route suite exists or add narrow tests proving fail-loud 502 behavior for ch5pm proxy endpoints.
  - Capture representative redacted live fixtures for state, babysitter, queue, health.
  - Prefer pure test files near mapper/types over inventing a broad renderer harness for this slice.

  **Must NOT do**:
  - Do not rely on screenshots alone.
  - Do not hide contract drift behind permissive parsing.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: mostly deterministic regression coverage.
  - **Skills**: [`caveman`]
    - `caveman`: concise test fixture names.
  - **Skills Evaluated but Omitted**:
    - `test-scenarios`: overkill for current local test style.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: FINAL
  - **Blocked By**: 2, 4, 8, 9

  **References**:
  - `apps/desktop/src/renderer/project-manager.test.ts:32` - existing Bun test file style in same area.
  - `apps/desktop/src/renderer/pm-side-agents/composition.ts:116` - mapper entrypoint needing direct coverage.
  - `apps/server/src/routes/ch5pm.ts:46` - fail-loud proxy helper to protect.

  **Acceptance Criteria**:
  - [ ] Mapper tests cover healthy, stale, partial, offline, and queue-degraded cases.
  - [ ] Contract tests fail when queue shape or babysitter shape drifts.
  - [ ] Fail-loud no-fallback behavior is protected by tests or explicit narrow route proof.

  **QA Scenarios**:
  ```text
  Scenario: Mapper regression suite passes on mixed fixtures
    Tool: bun test
    Preconditions: fixture files added
    Steps:
      1. Run PM side-agent test files
      2. Assert coverage includes source badges, queue grouping, freshness, degraded reasons
    Expected Result: all mapper semantics locked by tests
    Evidence: .sisyphus/evidence/pm-side-agents/task-10-mapper-tests.txt

  Scenario: Proxy fails loud when daemon unreachable
    Tool: bun test or curl against mocked/offline route
    Preconditions: route test harness or mock fetch stub
    Steps:
      1. Simulate daemon fetch throw
      2. Assert route returns 502 with daemon URL in error body
    Expected Result: no stale fallback path
    Evidence: .sisyphus/evidence/pm-side-agents/task-10-fail-loud.txt
  ```

  **Commit**: NO

- [x] 11. Add component/browser proof for PM route

  **What to do**:
  - Add component-level tests only where current Bun/renderer setup supports them for Side Agents panel degraded/healthy render states.
  - Capture live browser proof at `http://localhost:20883/#/project-manager` for Dense Console and Side Agents tab.
  - Verify dockview tab switching, source badges, queue groups, and degraded banners.
  - If component harness friction is high, prefer stronger mapper tests plus browser proof over building new test infrastructure inside this slice.

  **Must NOT do**:
  - Do not require desktop app launch; browser-mode route is accepted proof lane.
  - Do not skip negative-path browser validation.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: end-to-end UI verification focus.
  - **Skills**: [`agent-browser`, `react-best-practices`, `caveman`]
    - `agent-browser`: browser proof and DOM assertions.
    - `react-best-practices`: stable test seams.
    - `caveman`: concise evidence notes.
  - **Skills Evaluated but Omitted**:
    - `ghost-browser`: use only if local browser binding requires it.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: FINAL
  - **Blocked By**: 5, 6, 7, 8, 9

  **References**:
  - `apps/desktop/src/renderer/components/project-manager.tsx:3` - route root to prove.
  - `apps/desktop/src/renderer/router.tsx:150` - URL path registration.
  - current live proof URL: `http://localhost:20883/#/project-manager`

  **Acceptance Criteria**:
  - [ ] Browser proof captures default Dense Console and Side Agents tab.
  - [ ] Live counts still match current state feed.
  - [ ] Side Agents panel shows babysitter/queue source badges and live content or loud degraded state.

  **QA Scenarios**:
  ```text
  Scenario: Browser proof for default PM route
    Tool: Browser
    Preconditions: `bun run svc:status` shows `server` and `web` up
    Steps:
      1. Navigate to `http://localhost:20883/#/project-manager`
      2. Assert `Dense Console` visible by default
      3. Assert current live counters still show expected state-fed values
      4. Click `Side Agents`
      5. Assert loop card, queue panel, source badges, and at least one live/degraded content region visible
    Expected Result: PM route complete enough for live operator use
    Evidence: .sisyphus/evidence/pm-side-agents/task-11-browser-proof.png

  Scenario: Partial upstream failure still renders loud Side Agents state
    Tool: component test or browser against mocked endpoint
    Preconditions: babysitter or queue endpoint forced 502 while state endpoint stays healthy
    Steps:
      1. Open PM route
      2. Assert Dense Console still renders state-fed sections
      3. Assert Side Agents tab shows degraded banner naming failed upstream
    Expected Result: partial failure visible, no crash
    Evidence: .sisyphus/evidence/pm-side-agents/task-11-partial-upstream-failure.txt
  ```

  **Commit**: NO

- [x] 12. Final cleanup, blockers note, and handoff packet

  **What to do**:
  - Run targeted verification commands.
  - Run repo-wide verification if reasonable, but explicitly annotate unrelated blocker if `bun run check-types` still fails because of cross-repo motion package conflict.
  - Ensure new evidence paths and any durable PM notes are committed if repo policy wants them.
  - Produce concise handoff note for PM slice with exact proof and explicit non-slice blockers.

  **Must NOT do**:
  - Do not claim repo-wide green if known unrelated blocker remains.
  - Do not leave PM slice mixed with unrelated dirty-tree edits.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: verification and repo-state hygiene.
  - **Skills**: [`git-master`, `caveman`]
    - `git-master`: scoped staging/commit hygiene in dirty repo.
    - `caveman`: compact blocker and proof packet.
  - **Skills Evaluated but Omitted**:
    - `ship`: not needed unless release/push flow expands.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final implementation task
  - **Blocks**: FINAL
  - **Blocked By**: 10, 11

  **References**:
  - `AGENTS.md:72` - repo verification commands.
  - `docs/genui-artifact-architecture.md:412` - known unrelated typecheck blocker to cite if still present.
  - current dirty-tree audit from Task 1.

  **Acceptance Criteria**:
  - [ ] Targeted PM tests pass.
  - [ ] Browser proof captured.
  - [ ] Any repo-wide failure is explicitly labeled unrelated if blocker persists.
  - [ ] Final handoff lists changed PM files and proof artifacts only.

  **QA Scenarios**:
  ```text
  Scenario: Targeted PM verification passes
    Tool: Bash
    Preconditions: implementation complete
    Steps:
      1. Run targeted `bun test` for PM side-agent files
      2. Run `bun run lint` or narrow lint on changed files if repo flow supports it
      3. Run `bun run check-types` and annotate whether failure is unrelated blocker
    Expected Result: PM slice proof packet complete and blocker attribution correct
    Evidence: .sisyphus/evidence/pm-side-agents/task-12-verification.txt

  Scenario: Final git scope excludes unrelated dirt
    Tool: Bash (git status)
    Preconditions: PM slice staged/ready
    Steps:
      1. Run `git status --short`
      2. Confirm only intended PM files staged/committed or explicitly listed as unrelated leftovers
    Expected Result: Atlas does not ship unrelated changes accidentally
    Evidence: .sisyphus/evidence/pm-side-agents/task-12-git-scope.txt
  ```

  **Commit**: YES
  - Message: `fix(pm): complete side agents project manager panel`
  - Files: `apps/desktop/src/renderer/components/pm-dockview.tsx`, `apps/desktop/src/renderer/components/pm-live-dashboard.tsx`, `apps/desktop/src/renderer/components/pm-side-agents-panel.tsx`, `apps/desktop/src/renderer/pm-side-agents/*`, `apps/desktop/src/renderer/services/backend.ts`, `apps/desktop/src/renderer/services/elf-server.ts`, `apps/server/src/routes/ch5pm.ts`, targeted tests/evidence
  - Pre-commit: targeted `bun test`, `bun run lint`, `bun run check-types` with blocker annotation if external failure persists

---

## Final Verification Wave

- [ ] F1. **Plan compliance audit** — `deep`
  Read plan + final diff. Confirm all eight required request bullets landed: live babysitter tab, queue panel, extracted mapper, source/freshness badges, audited surfaces/routes/dirty-tree, live/detected/static separation, verification path, unrelated blocker annotation.
  Output: `Request bullets [8/8] | Missing [list or none] | VERDICT`

- [ ] F2. **Code quality review** — `unspecified-high`
  Run targeted PM tests, lint, and typecheck proof. Search changed files for duplicate parsing, fake healthy labels, placeholder Side Agents copy, and silent fallback behavior.
  Output: `Tests [PASS/FAIL] | Lint [PASS/FAIL] | Typecheck [PASS/FAIL or unrelated blocker] | VERDICT`

- [ ] F3. **Real browser QA** — `visual-engineering` + `agent-browser`
  Open `http://localhost:20883/#/project-manager`. Verify default Dense Console, Side Agents tab, queue groups, provenance badges, degraded banners, and links. Save evidence under `.sisyphus/evidence/pm-side-agents/final-browser/`.
  Output: `Dense Console [PASS/FAIL] | Side Agents [PASS/FAIL] | Queue [PASS/FAIL] | Provenance [PASS/FAIL] | VERDICT`

- [ ] F4. **Scope fidelity + blocker attribution** — `deep`
  Compare changed files and verification notes against plan. Confirm no daemon redesign slipped in. Confirm any `bun run check-types` failure cites exact unrelated blocker source if still external.
  Output: `Scope [CLEAN/ISSUES] | Blocker attribution [CORRECT/INCORRECT] | VERDICT`

## Dependency Matrix
- **1**: — — 2, 3, 4, 1
- **2**: 1 — 4, 8, 10, 2
- **3**: 1 — 4, 7, 9, 2
- **4**: 2, 3 — 5, 6, 7, 8, 9, 10, 3
- **5**: 4 — 11, 12, 2
- **6**: 4 — 7, 8, 11, 2
- **7**: 4, 6 — 9, 11, 3
- **8**: 2, 4, 6 — 9, 10, 11, 3
- **9**: 4, 5, 7, 8 — 10, 11, 12, 3
- **10**: 2, 4, 8, 9 — 12, 4
- **11**: 5, 6, 7, 8, 9 — 12, 4
- **12**: 10, 11 — F1-F4, FINAL

## Agent Dispatch Summary
- **Wave 1**: **2** — T2 → `quick`, T3 → `writing`
- **Wave 2**: **4** — T4 → `deep`, T5/T6/T7 → `visual-engineering`, T8 → `unspecified-high`
- **Wave 3**: **2** — T9 → `visual-engineering`, T10 → `quick`
- **Wave 4**: **1** — T11 → `visual-engineering`
- **Final**: **1** — T12 → `unspecified-high`
- **Verification**: **4 parallel** — F1 `deep`, F2 `unspecified-high`, F3 `visual-engineering`, F4 `deep`

## Commit Strategy
- One coherent PM UI slice commit after mapper + panel + tests + proof
- Message target: `fix(pm): complete side agents project manager panel`
- If unrelated blocker remains, include note in handoff/evidence, not commit subject

## Success Criteria

### Verification Commands
```bash
bun run svc:status
curl -sS http://127.0.0.1:30206/api/ch5pm/state
curl -sS http://127.0.0.1:30206/api/ch5pm/babysitter
curl -sS http://127.0.0.1:30206/api/ch5pm/queue
curl -sS http://127.0.0.1:30206/api/ch5pm/health
bun test <targeted-pm-files>
bun run lint
bun run check-types
```

### Final Checklist
- [ ] Placeholder Side Agents tab replaced
- [ ] Live babysitter loop + box digests + decisions visible
- [ ] Queue/terminal buckets visible from `/api/ch5pm/queue`
- [ ] Shared mapper owns PM normalization
- [ ] Source/freshness badges explicit and correct
- [ ] Static/detected-only agents never marked live
- [ ] Browser proof captured at `/#/project-manager`
- [ ] Unrelated typecheck blocker called out if still present

## Atlas Continuation Prompt
```text
Continue `pm-side-agents-panel` in /Users/hassoncs/src/ch5/palot on branch `rescue/pm-side-agents-seam`.

Read first:
- .sisyphus/plans/pm-side-agents-panel.md
- apps/desktop/src/renderer/components/pm-dockview.tsx
- apps/desktop/src/renderer/components/pm-live-dashboard.tsx
- apps/desktop/src/renderer/pm-side-agents/composition.ts
- apps/desktop/src/renderer/pm-side-agents/types.ts
- apps/server/src/routes/ch5pm.ts
- apps/desktop/src/renderer/services/backend.ts
- apps/desktop/src/renderer/services/elf-server.ts

Mission:
- Keep existing Dense Console design language.
- Replace placeholder Side Agents tab with live `/api/ch5pm/babysitter` + `/api/ch5pm/queue` data.
- Extract shared PM normalization into mapper authority.
- Add explicit source/freshness badges and safe deep links.
- Never claim live health for static/detected-only agents.
- Fail loud on upstream breakage. No stale fallback.

Before edits:
- Audit current dirty tree and pathscope only PM files.
- Reconfirm live payload shapes; queue is `rows[]` unless backend changed.
- Note repo-wide typecheck blocker from `docs/genui-artifact-architecture.md:412` if still present.

Proof required:
- targeted bun tests
- curl proofs for `/api/ch5pm/state`, `/api/ch5pm/babysitter`, `/api/ch5pm/queue`, `/api/ch5pm/health`
- browser proof at `http://localhost:20883/#/project-manager`
- evidence under `.sisyphus/evidence/pm-side-agents/`
``` <!-- oc:id=sec_ap -->
To be appended after task batches.

## Commit Strategy <!-- oc:id=sec_aq -->
- One coherent PM UI slice commit after mapper + panel + tests + proof
- Message target: `fix(pm): complete side agents project manager panel`

## Success Criteria <!-- oc:id=sec_ar -->
- `/#/project-manager` shows real Side Agents tab with live babysitter + queue data.
- Dense Console still works and uses shared mapper where overlap exists.
- Source badges make live-fed vs detected vs static explicit.
- Queue panel groups actionable terminal states.
- Tests and live proof recorded.