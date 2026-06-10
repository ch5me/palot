# Palot PM Side Agents Panel Plan <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Extend palot's existing PM page so it keeps its current `/api/ch5pm/state` view, adds a new live Side Agents panel backed by daemon `GET /pm/babysitter`, and clearly separates local snapshot data from live daemon health/attention data.
>
> **Deliverables**:
> - typed client/server contract for daemon babysitter feed and queue extras
> - PM page data composition layer merging `/api/ch5pm/state` with new daemon-backed side-agent data
> - dockable Side Agents panel and supporting UI states in the PM route
> - regression tests for contracts, mapping, and degraded/offline behavior
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: contract/proxy -> typed client + composition -> panel UI -> verification

---

## Context

### Original Request
Build a full plan for palot / Firefly-client PM UI work around CH5PM side/accessory agents, their responsibilities, prompt management, and UI hook points, with the new distributed babysitter feed as a primary live source.

### Interview Summary
**Key Discussions**:
- Existing PM page already reads CH5PM live state through the Firefly proxy route at `/api/ch5pm/state` and renders boxes, sessions, lanes, needs-Chris, attention queue, follow-ups, frontier, and background agents.
- New work should treat `GET http://127.0.0.1:43130/pm/babysitter` as the durable live side-agent feed, not as an internal-only operator tool.
- Canonical side-agent inventory source is `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-daemon-subsystem-catalog.md`.
- Desired PM information architecture remains: Boxes -> Lanes -> Side agents -> Attention queue -> Merge queue.

**Research Findings**:
- Palot PM route is `apps/desktop/src/renderer/router.tsx:150` and renders `ProjectManager`, which is a thin shell over `PmDockviewShell` in `apps/desktop/src/renderer/components/project-manager.tsx:1` and `apps/desktop/src/renderer/components/pm-dockview.tsx:1`.
- Dense PM UI today is `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:278` using `fetchCh5PmState()` from `apps/desktop/src/renderer/services/backend.ts:659`.
- Firefly server proxy for CH5PM today only exposes `/api/ch5pm/state` and attention mutations in `apps/server/src/routes/ch5pm.ts:11`.
- Existing dockview `AgentsPanel` is still placeholder text in `apps/desktop/src/renderer/components/pm-dockview.tsx:21`.
- Existing dashboard-side types for `/api/ch5pm/state` and attention queue live in `apps/desktop/src/renderer/ch5pm-dashboard/types.ts:286` and `apps/desktop/src/renderer/ch5pm-dashboard/types.ts:393`.
- Live daemon `GET /pm/babysitter` is wired by `packages/ch5pm-daemon/src/babysitter/http.ts:159` and returns `hubBoxId`, `boxes`, `attention`, `babysitterLoop`, `degradedReasons`, `dataAges`, plus loop status.
- Babysitter wire types are canonical in `~/src/ch5/ch5-company/packages/ch5pm-daemon/src/babysitter/types.ts:16`.
- Server proxy doctrine explicitly says no stale `pm-state.json` fallback when daemon is unreachable: fail loud instead (`apps/server/src/routes/ch5pm.ts:15`).

### Metis Review
**Identified Gaps** (addressed in this plan):
- Need explicit source-of-truth rules between `/api/ch5pm/state`, `/pm/babysitter`, `/queue`, and `/health`.
- Need explicit guardrail to avoid daemon-contract redesign during UI slice.
- Need acceptance criteria for degraded/offline behavior, zero-state behavior, and freshness mismatches.
- Need action-scope decision: this slice should be read-focused first, with recovery actions gated as a separate task and defaulting to hidden unless fully wired.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Add a production-ready Side Agents surface to palot's PM page that exposes CH5PM side-agent state from the daemon without hiding failures, duplicating daemon contracts, or destabilizing the current PM dashboard.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- Extend the Firefly server CH5PM proxy to expose read-only daemon side-agent endpoints needed by the renderer.
- Add renderer-side TypeScript contracts for daemon babysitter and queue-side side-agent data with provenance comments pointing at ch5-company source files.
- Add a PM-side composition layer that merges existing `/api/ch5pm/state` data with side-agent/live-daemon data.
- Replace the placeholder dockview Agents panel with a real Side Agents panel.
- Surface side-agent prompt-management status (versioned charter vs spawn-brief-only) using a deterministic local mapping, not freeform prose in the component.
- Add tests for contract parsing, composition logic, UI zero/degraded states, and proxy fail-loud behavior.

### Renderer Placement <!-- oc:id=sec_placement -->

All side-agent logic lives in one new module directory; both the dockview panel and the dense summary consume the same pure composition output. No inline merging in either component.

**New files** (all under `apps/desktop/src/renderer/pm-side-agents/`):
- `types.ts` — renderer-side TypeScript contracts for daemon side-agent payloads, with provenance comments pointing at ch5-company source files.
- `registry.ts` — renderer-local metadata registry keyed by subsystem id: label, charter doc path, prompt-management mode, owner surface.
- `mapper.ts` — pure utilities that transform daemon payloads + registry into panel rows.
- `compose.ts` — pure function that merges `Ch5PmLiveState` + side-agent payloads into one `PmSideAgentsViewModel`.

**New components** (under `apps/desktop/src/renderer/components/`):
- `pm-side-agents-panel.tsx` — full Side Agents panel, replaces `AgentsPanel` placeholder in `pm-dockview.tsx`.
- `pm-side-agents-summary.tsx` — compact summary strip for `PmLiveDashboard` dense console.

**Modified files**:
- `apps/desktop/src/renderer/components/pm-dockview.tsx:21` — replace `AgentsPanel` placeholder with `<PmSideAgentsPanel />`.
- `apps/desktop/src/renderer/components/pm-live-dashboard.tsx` — add `<PmSideAgentsSummary />` strip alongside existing sections (does not replace any existing section).
- `apps/desktop/src/renderer/services/backend.ts` — add fetch helpers for new proxy routes.
- `apps/desktop/src/renderer/services/elf-server.ts` — add browser-mode fetch helpers.
- `apps/server/src/routes/ch5pm.ts` — add read-only proxy routes for side-agent endpoints.

### Definition of Done <!-- oc:id=sec_af -->
- [ ] PM route shows a non-placeholder Side Agents panel driven by live daemon data and existing PM state.
- [ ] Daemon unreachable / stale / degraded states are visible in the UI and do not silently fall back to stale file data.
- [ ] Panel shows **live** for: distributed babysitter (per-box digests), attention rows, babysitter loop health/stall status.
- [ ] Panel shows **detected-from-PM-state** (session-title match, "active session detected" not "subsystem healthy") for: MergeQueue v3, Frontier Curator v2.
- [ ] Panel shows **known-but-not-live** (no heartbeat claim) for: tick babysitter, PM watchdog, deterministic scanners.
- [ ] Panel does NOT claim subsystem health for any agent not directly fed by a live endpoint.
- [ ] Existing attention queue interactions still work.
- [ ] Existing dense dashboard boxes / sessions / frontier sections still render with no regression.
- [ ] Automated contract + component tests cover happy path and degraded path.

### Must Have <!-- oc:id=sec_ag -->
- Clear source-of-truth split: `/api/ch5pm/state` stays the PM snapshot source; daemon side-agent endpoints provide live side-agent details.
- Canonical subsystem vocabulary must derive from `ch5pm-daemon-subsystem-catalog.md` and daemon babysitter wire types.
- Read-only side-agent rendering must land before any recovery action buttons are enabled.
- UI must expose freshness / degraded indicators for live daemon feeds.

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- No daemon-side schema or behavior redesign unless a hard blocker is proven and isolated.
- No silent fallback to stale `pm-state.json` when live daemon feed fails.
- No broad re-architecture of the PM dashboard unrelated to side-agent integration.
- No hand-written duplicated contracts without provenance or tests.
- No merging of Attention Queue and Side Agents into one indistinct list.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — all verification agent-executed.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Bun / existing renderer tests

### QA Policy
Every task below includes direct agent-executed verification. Use existing renderer/unit test flows where available. For HTTP verification, use daemon proxy and direct curl. For UI verification, use local renderer component tests plus browser/manual automation only if already present and bounded.

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Source-of-Truth Rules <!-- oc:id=sec_aj -->
- `/api/ch5pm/state` remains the existing PM summary source for boxes, sessions, lanes, `needsChris`, `attentionQueue`, `plane.readyFrontier`, follow-ups, completions, and current `backgroundAgents`.
- New read-only side-agent data comes from daemon-backed proxy endpoints for `GET /pm/babysitter`, `GET /queue`, and `GET /health`.
- If multiple sources mention the same session, side-agent panel shows daemon live-state copy and links back to session/lane rows from `/api/ch5pm/state` using session id / box id / ticket id joins.
- Fail-loud is mandatory: live side-agent fetch failures render explicit degraded cards/banners; they do not mutate existing state rows into fake health.

### Field-Level Authority Table <!-- oc:id=sec_authority -->

| Data | Primary source | Fallback / supplement | Renderer handling |
|------|----------------|------------------------|-------------------|
| Boxes, sessions, lanes, needsChris, attentionQueue, plane.readyFrontier, follow-ups, completions, backgroundAgents | `/api/ch5pm/state` | — | Existing dashboard surfaces |
| Live distributed babysitter box digests (per-box sessions with classification, ageMin, gist) | `GET /pm/babysitter` → `boxes[]` | — | Distributed-babysitter card per boxId |
| Distributed-babysitter actions log | `GET /pm/babysitter` → `boxes[].actions[]` | — | Action-log sub-section per box |
| Decision-needed attention rows from distributed loop | `GET /pm/babysitter` → `attention[]` | Cross-reference `needsChris` from PM state for title/ticket joins | Attention row in panel + badge in summary |
| Babysitter loop health (running, lastRunAt, passes, lastError) | `GET /health` → `babysitterLoop` and `GET /pm/babysitter` → `babysitterLoop` | — | Loop-status indicator; stalled/failed triggers amber/red banner |
| Degraded reasons string list | `GET /health` → `degradedReasons` and `GET /pm/babysitter` → `degradedReasons` | — | Top-of-panel degraded banner |
| Feed freshness timestamp | `GET /pm/babysitter` → `dataAges.feed` | `GET /status.json` → `dataAges.status`, `dataAges.snapshot` | Stale badge when >5 minutes old |
| Dispatch queue rows (jobs, claims, failedStep, ticket/repo/box) | `GET /queue` | `lanes[]` from `/api/ch5pm/state` for join only | Merge Queue sub-section in panel |
| Prompt-management charter status for standing agents (versioned-charter vs spawn-brief-only) | Renderer-local static metadata keyed by agent id (`registry.ts`) | — | Badge on each subsystem card |
| Known-but-not-live agents (Tick babysitter daemon, PM watchdog, deterministic scanners, MergeQueue/Frontier Curator themselves as agents) | Renderer-local static metadata keyed by agent id (`registry.ts`) | — | Row rendered with "static registry" tag and no live-health dot |
| Daemon connectivity | HTTP status code from proxy route | — | Unreachable banner on proxy failure; never fall back to `pm-state.json` |

**Conflict rule**: If a session appears both in `/api/ch5pm/state` (as a lane/session) and in `/pm/babysitter` (as a classified row), display the daemon classification/gist in the Side Agents panel and link to the lane row using `sessionId`. Do NOT synthesize a different classification locally.

### Agent Observability Matrix <!-- oc:id=sec_observability -->

| Agent / Subsystem | How it shows up in this slice | Evidence requirement |
|-------------------|-------------------------------|----------------------|
| **Distributed babysitter** (macmini, laptop, dell) | Live-fed card with real-time status per box | `boxes[].boxId` match in `/pm/babysitter` |
| **Babysitter loop health** | Live-fed indicator (running/stalled/failed) | `babysitterLoop.running`, `lastRunAt`, `lastError` |
| **MergeQueue v3** | Detected session + work items shown; **no live-health claim** | Session title detected from `/api/ch5pm/state.sessions[]`; jobs matched via `metadata.kind === "worker-launch"` and ticket title hints in `/queue`. Tagged `"known-but-not-live"` in `registry.ts`. |
| **Frontier Curator v2** | Detected session shown; **no live-health claim** | Session title detected from `/api/ch5pm/state.sessions[]`. Tagged `"known-but-not-live"` in `registry.ts`. |
| **Tick babysitter daemon** | Static entry only; **no live feed in this slice** | No endpoint returns tick-babysitter liveness. Rendered as `"known-but-not-live"` with charter link from `docs/ch5pm/ch5pm-babysitter-charter.md`. |
| **PM watchdog** | Static entry only; **no live feed in this slice** | Cron-driven Claude Code session, not in daemon feed. Rendered as `"known-but-not-live"` with charter link from `~/.claude/skills/pm/SKILL.md`. |
| **Deterministic scanners** (oc-session-scan, oc-child-liveness, oc-pending-human, oc-watch-answers) | Static entry listing scanner names; **no live feed in this slice** | Scripts at `~/.local/bin/oc-*`. Rendered as `"deterministic/no-prompt"` with script paths from `registry.ts`. |
| **AskHuman attention queue** | Live-fed from existing surface | Reuse existing `attentionQueue` from `/api/ch5pm/state`. Not new in this slice. |

**Hard rule**: The panel must NEVER render a colored health dot or live timestamp for an agent whose observability column says "static entry only" or "detected session only". Those agents get a neutral icon and a "static registry" chip.

### Parallel Execution Waves <!-- oc:id=sec_ak -->

Wave 1 (start immediately — contract + seam prep):
- Task 1: inventory current PM route seams and placeholder panel replacement target
- Task 2: specify renderer-side types for daemon side-agent payloads
- Task 3: specify Firefly server proxy additions for side-agent read endpoints
- Task 4: define source-composition and freshness rules

Wave 2 (after Wave 1 — data plumbing):
- Task 5: implement daemon proxy read routes + backend service fetchers
- Task 6: implement renderer-side side-agent client / mapper utilities
- Task 7: add prompt-management metadata mapping for standing agents
- Task 8: add merged PM query / view-model composition

Wave 3 (after Wave 2 — UI surfaces):
- Task 9: replace dockview placeholder Agents panel with real Side Agents panel
- Task 10: integrate side-agent summary strip / status indicators into dense dashboard where needed
- Task 11: add degraded, empty, and mismatch UI states

Wave 4 (after Wave 3 — regression and proof):
- Task 12: contract tests for proxy + client parsing
- Task 13: component tests for panel rendering and degraded states
- Task 14: end-to-end local proof against live daemon endpoints

Wave FINAL:
- Task F1: plan compliance audit
- Task F2: code quality + types/tests review
- Task F3: real QA replay of live daemon + PM route
- Task F4: scope fidelity check

### Dependency Matrix <!-- oc:id=sec_al -->
- **1**: none -> 8, 9
- **2**: none -> 5, 6, 8, 12
- **3**: none -> 5, 12
- **4**: none -> 6, 8, 11, 13
- **5**: 2, 3 -> 8, 12, 14
- **6**: 2, 4 -> 8, 9, 10, 13
- **7**: 2 -> 9, 10, 13
- **8**: 1, 4, 5, 6 -> 9, 10, 11, 13
- **9**: 1, 6, 7, 8 -> 14
- **10**: 6, 7, 8 -> 14
- **11**: 4, 8 -> 13, 14
- **12**: 2, 3, 5 -> FINAL
- **13**: 4, 6, 7, 8, 11 -> FINAL
- **14**: 5, 9, 10, 11 -> FINAL

### Agent Dispatch Summary <!-- oc:id=sec_am -->
- **Wave 1**: 4 tasks — `quick` / `deep`
- **Wave 2**: 4 tasks — `quick` / `frontend-ui-ux`
- **Wave 3**: 3 tasks — `visual-engineering`
- **Wave 4**: 3 tasks — `quick` / `unspecified-high`
- **Final**: 4 tasks — `oracle`, `unspecified-high`, `deep`

---

## TODOs

- [ ] 1. Lock current PM page seams and replacement targets

  **What to do**:
  - Confirm route, shell, dockview, dense dashboard, attention queue, and server proxy seams currently used by the PM page.
  - Produce an implementation target map for the Side Agents panel: route shell, dock panel slot, shared state seams, and any existing placeholder content to replace.

  **Must NOT do**:
  - Do not redesign routing or replace the overall PM dockview shell.
  - Do not move unrelated dashboard sections.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: focused seam inventory and file targeting.
  - **Skills**: [`caveman`]
    - `caveman`: keep notes/output tight and implementation-facing.
  - **Skills Evaluated but Omitted**:
    - `react-best-practices`: helpful later, but not needed for seam inventory.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 8, 9
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/router.tsx:150` - PM route entry.
  - `apps/desktop/src/renderer/components/project-manager.tsx:1` - route shell delegates to dockview.
  - `apps/desktop/src/renderer/components/pm-dockview.tsx:5` - panel ids and placeholder Agents panel.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:387` - current dense console layout.

  **Acceptance Criteria**:
  - [ ] Exact target files for panel replacement and state injection are documented in code comments / handoff artifacts if needed.
  - [ ] No route or shell ambiguity remains.

  **QA Scenarios**:
  ```text
  Scenario: Route seam confirmed
    Tool: Read + grep
    Preconditions: repo checkout present
    Steps:
      1. Read `apps/desktop/src/renderer/router.tsx` around project-manager route.
      2. Read `project-manager.tsx` and `pm-dockview.tsx`.
      3. Assert there is a dedicated placeholder `AgentsPanel` to replace.
    Expected Result: exact route + shell + panel ids identified.
    Failure Indicators: PM route uses a different shell or no dedicated panel exists.
    Evidence: .sisyphus/evidence/task-1-route-seam.txt

  Scenario: Dense dashboard seam confirmed
    Tool: Read
    Preconditions: repo checkout present
    Steps:
      1. Read `pm-live-dashboard.tsx` around grid layout and current agents section.
      2. Assert current `backgroundAgents` section exists and is distinct from `PmAttentionQueue`.
    Expected Result: panel can extend without collapsing attention and agents together.
    Evidence: .sisyphus/evidence/task-1-dashboard-seam.txt
  ```

  **Commit**: NO

- [ ] 2. Define renderer-side type contract for side-agent live data

  **What to do**:
  - Introduce renderer TypeScript types for daemon side-agent payloads: babysitter session reports, box digests, action log rows, attention rows, loop status, and queue-derived side-agent entries if needed.
  - Keep provenance comments pointing back to ch5-company daemon files.
  - Decide whether to extend `apps/desktop/src/renderer/ch5pm-dashboard/types.ts` or add a focused sibling module for side-agent contracts.

  **Must NOT do**:
  - Do not copy daemon types with renamed semantics.
  - Do not mix read-only live daemon types into existing `Ch5PmLiveState` without explicit namespacing.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: type-definition work with clear source contract.
  - **Skills**: [`caveman`]
    - `caveman`: keep provenance comments terse.
  - **Skills Evaluated but Omitted**:
    - `software-design-principles`: overkill for a narrow typed mirror.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 5, 6, 8, 12
  - **Blocked By**: None

  **References**:
  - `~/src/ch5/ch5-company/packages/ch5pm-daemon/src/babysitter/types.ts:16` - canonical distributed babysitter wire schema.
  - `apps/desktop/src/renderer/ch5pm-dashboard/types.ts:286` - existing PM live-state types.
  - `apps/desktop/src/renderer/ch5pm-dashboard/types.ts:393` - existing attention queue contract style.

  **Acceptance Criteria**:
  - [ ] New side-agent types cover all fields currently used from `/pm/babysitter`.
  - [ ] Type names clearly distinguish daemon live feed vs existing PM snapshot state.
  - [ ] Every type has a provenance comment naming source file/path.

  **QA Scenarios**:
  ```text
  Scenario: Type contract matches daemon feed
    Tool: Read + typecheck
    Preconditions: type module added
    Steps:
      1. Compare local side-agent types against `packages/ch5pm-daemon/src/babysitter/types.ts`.
      2. Run repo typecheck.
    Expected Result: no missing required fields and no typecheck errors.
    Failure Indicators: renderer types omit `attention`, `actions`, or loop status fields; typecheck fails.
    Evidence: .sisyphus/evidence/task-2-type-contract.txt

  Scenario: Existing PM state types remain stable
    Tool: typecheck
    Preconditions: existing `Ch5PmLiveState` consumers compile
    Steps:
      1. Run typecheck after adding side-agent contracts.
      2. Verify no unrelated `pm-live-dashboard` type regressions occur.
    Expected Result: existing PM dashboard code still compiles.
    Evidence: .sisyphus/evidence/task-2-typecheck.txt
  ```

  **Commit**: NO

- [ ] 3. Add Firefly server proxy routes for side-agent read endpoints

  **What to do**:
  - Extend `apps/server/src/routes/ch5pm.ts` to proxy read-only daemon endpoints needed by the renderer: at minimum `/pm/babysitter`, `/queue`, and `/health`; add `/status.json` only if renderer needs extra derived fields not already available elsewhere.
  - Preserve the current fail-loud proxy behavior and timeout policy.
  - Keep response passthrough verbatim JSON with `cache-control: no-store`.

  **Must NOT do**:
  - Do not add file-based fallback to `pm-state.json`.
  - Do not proxy write endpoints for recovery actions in this same slice unless the later task explicitly enables them.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: narrow server seam extension.
  - **Skills**: [`caveman`]
    - `caveman`: keep proxy route docs concise.
  - **Skills Evaluated but Omitted**:
    - `api-design`: route design already constrained by existing daemon surface.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 5, 12
  - **Blocked By**: None

  **References**:
  - `apps/server/src/routes/ch5pm.ts:3` - current proxy doctrine and fail-loud policy.
  - `~/src/ch5/ch5-company/packages/ch5pm-daemon/src/babysitter/http.ts:159` - `/pm/babysitter` response wrapper.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-start-here.md:112` - daemon API contract.

  **Acceptance Criteria**:
  - [ ] New proxy endpoints exist and map 1:1 to daemon read routes.
  - [ ] Proxy still returns 502 with daemon URL in message on upstream failure.
  - [ ] Existing `/api/ch5pm/state` and attention routes remain unchanged.

  **QA Scenarios**:
  ```text
  Scenario: Side-agent proxy routes succeed
    Tool: curl
    Preconditions: local daemon reachable on `127.0.0.1:43130`
    Steps:
      1. Start/ensure app server route layer available.
      2. Call `/api/ch5pm/<new-route>` for each added read endpoint.
      3. Compare payload top-level keys to direct daemon curl.
    Expected Result: proxy returns 200 and top-level keys match daemon response.
    Failure Indicators: 404 route missing, 500 proxy error, or shape mismatch.
    Evidence: .sisyphus/evidence/task-3-proxy-success.txt

  Scenario: Proxy fails loud when daemon absent
    Tool: test or bounded local override
    Preconditions: daemon URL overridden to dead host in test harness / mocked fetch
    Steps:
      1. Hit new proxy route with unreachable daemon.
      2. Assert 502 and explicit `CH5PM daemon unreachable` message.
    Expected Result: no silent fallback.
    Evidence: .sisyphus/evidence/task-3-proxy-fail-loud.txt
  ```

  **Commit**: NO

- [ ] 4. Define composed data model and freshness/degraded rules

  **What to do**:
  - Define a renderer-side view-model that merges current `Ch5PmLiveState` with side-agent feed and queue/health extras.
  - Encode precedence rules for freshness badges, degraded banners, and missing-source cases.
  - Decide where merge logic lives (`services`, `components`, or a dedicated `pm-side-agents` module) and keep it pure/testable.

  **Must NOT do**:
  - Do not perform ad hoc merging in JSX.
  - Do not overwrite source-specific timestamps or health statuses.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: this is the seam that prevents UI ambiguity and source confusion.
  - **Skills**: [`caveman`]
    - `caveman`: concise merge rules.
  - **Skills Evaluated but Omitted**:
    - `react-best-practices`: useful later in UI, not for pure merge policy.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 6, 8, 11, 13
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/services/backend.ts:659` - existing PM state fetch seam.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:278` - current single-query consumer.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-daemon-subsystem-catalog.md:13` - subsystem categories to render.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-human-attention.md:23` - attention loop semantics.

  **Acceptance Criteria**:
  - [ ] A pure merge function / view-model contract exists with clear input/output types.
  - [ ] Rules for stale feed, missing feed, and partially missing queue data are explicit.
  - [ ] Panel can render with only PM state, only side-agent state unavailable, without crashing.

  **QA Scenarios**:
  ```text
  Scenario: Merge handles healthy live data
    Tool: unit test
    Preconditions: fixtures for PM state + babysitter feed + queue
    Steps:
      1. Build merged model from healthy payloads.
      2. Assert side-agent rows include source, health, freshness, and related ticket/session links.
    Expected Result: merged model exposes all panel sections with no ambiguity.
    Evidence: .sisyphus/evidence/task-4-merge-healthy.txt

  Scenario: Merge handles stale or missing daemon feed
    Tool: unit test
    Preconditions: PM state fixture with daemon fetch failure or stale timestamp fixture
    Steps:
      1. Build merged model with absent/failed side-agent payload.
      2. Assert degraded banner and empty side-agent rows render model safely.
    Expected Result: UI can fail loud without breaking main dashboard.
    Evidence: .sisyphus/evidence/task-4-merge-degraded.txt
  ```

  **Commit**: NO

- [ ] 5. Implement renderer/backend fetchers for side-agent endpoints

  **What to do**:
  - Add `backend.ts` and `elf-server.ts` fetch functions for each new side-agent proxy route.
  - Mirror existing Electron/browser-mode split so Electron uses `window.elf.fetch` and browser mode uses typed server client calls.
  - Use no-store semantics and consistent error handling.

  **Must NOT do**:
  - Do not inline fetches directly inside components.
  - Do not special-case Electron with different payload semantics.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: mechanical fetch seam work.
  - **Skills**: [`caveman`]
    - `caveman`: keep helper names and comments crisp.
  - **Skills Evaluated but Omitted**:
    - `bun-runtime`: unnecessary for this narrow client/server seam.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 8, 12, 14
  - **Blocked By**: 2, 3

  **References**:
  - `apps/desktop/src/renderer/services/backend.ts:659` - existing fetch helper pattern.
  - `apps/desktop/src/renderer/services/elf-server.ts:397` - browser-mode fetch seam.
  - `apps/server/src/routes/ch5pm.ts:71` - proxy routes to mirror.

  **Acceptance Criteria**:
  - [ ] Each new route has one backend helper in renderer services.
  - [ ] Browser mode and Electron mode both use the same payload shape.
  - [ ] Errors are surfaced as thrown exceptions, not swallowed values.

  **QA Scenarios**:
  ```text
  Scenario: Electron fetch helper parses live payload
    Tool: unit test or bounded runtime call
    Preconditions: daemon/proxy reachable
    Steps:
      1. Call new backend helper through Electron-compatible fetch path.
      2. Assert parsed object has expected top-level keys.
    Expected Result: parsed side-agent payload available to renderer.
    Evidence: .sisyphus/evidence/task-5-electron-fetch.txt

  Scenario: Browser helper fails consistently on bad response
    Tool: unit test with mocked non-2xx response
    Preconditions: mocked client route returns failure
    Steps:
      1. Call new helper against mocked failure.
      2. Assert it throws a meaningful error.
    Expected Result: renderer error path stays explicit.
    Evidence: .sisyphus/evidence/task-5-browser-error.txt
  ```

  **Commit**: NO

- [ ] 6. Build side-agent mapper utilities from daemon payloads

  **What to do**:
  - Create pure utilities that transform babysitter feed + queue + health data into panel rows grouped by subsystem/agent.
  - Normalize live side-agent cards for: distributed babysitter, tick babysitter summary, MergeQueue, Frontier Curator, PM watchdog, deterministic scanners / attention support rows where directly observable.
  - Encode prompt-management metadata flags (`versioned-charter`, `spawn-brief-only`, `deterministic/no-prompt`).

  **Must NOT do**:
  - Do not infer unsupported data from prose-only assumptions.
  - Do not claim a subsystem heartbeat when the source payload lacks evidence.

  **Recommended Agent Profile**:
  - **Category**: `frontend-ui-ux`
    - Reason: mapping data into stable, renderer-friendly UI rows.
  - **Skills**: [`caveman`]
    - `caveman`: keep mapping names and row semantics direct.
  - **Skills Evaluated but Omitted**:
    - `brainstorming`: idea work no longer needed; contract is fixed.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 8, 9, 10, 13
  - **Blocked By**: 2, 4

  **References**:
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-daemon-subsystem-catalog.md:13` - canonical subsystem list.
  - `~/src/ch5/ch5-company/packages/ch5pm-daemon/src/babysitter/types.ts:28` - feed row types.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-babysitter-charter.md:46` - tick babysitter digest semantics.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-human-attention.md:48` - AskHuman / agent-help semantics.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:330` - current truncation and row style patterns.

  **Acceptance Criteria**:
  - [ ] Mapping utilities output stable side-agent rows with ids, labels, status, source, freshness, related session/ticket references, prompt-management status.
  - [ ] Unsupported subsystems are surfaced as `known-but-not-live` or equivalent, not silently omitted.
  - [ ] No UI component needs raw daemon JSON shape knowledge beyond typed mapper input.

  **QA Scenarios**:
  ```text
  Scenario: Mapper builds rows from live babysitter feed
    Tool: unit test with captured live payload fixture
    Preconditions: saved `/pm/babysitter` sample
    Steps:
      1. Feed captured payload into mapper.
      2. Assert output includes macmini distributed babysitter card and decision-needed attention row.
    Expected Result: mapper produces deterministic rows with expected labels and status.
    Evidence: .sisyphus/evidence/task-6-mapper-live.txt

  Scenario: Mapper marks prompt-management gaps correctly
    Tool: unit test
    Preconditions: hardcoded metadata mapping for MergeQueue / Frontier Curator / babysitters
    Steps:
      1. Map known standing agents.
      2. Assert MergeQueue and Frontier Curator show spawn-brief-only status; babysitter shows versioned prompt.
    Expected Result: prompt-management audit visible in panel data.
    Evidence: .sisyphus/evidence/task-6-prompt-audit.txt
  ```

  **Commit**: NO

- [ ] 7. Encode standing-agent metadata registry for UI rendering

  **What to do**:
  - Add a small renderer-local registry keyed by subsystem/agent id with label, charter doc path, prompt-management mode, and owner surface.
  - This registry should be a presentational contract, not a control-plane duplicate.
  - Use it to enrich daemon/live rows with stable human-facing names and doc links.

  **Must NOT do**:
  - Do not hardcode operational state into the registry.
  - Do not embed long prose charters into code.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: compact metadata definition.
  - **Skills**: [`caveman`]
    - `caveman`: keep registry small and exact.
  - **Skills Evaluated but Omitted**:
    - `content-strategy`: not needed; this is not copywriting.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 9, 10, 13
  - **Blocked By**: 2

  **References**:
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-daemon-subsystem-catalog.md:13` - subsystem names.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-babysitter-charter.md:28` - tick babysitter purpose.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-distributed-babysitter.md:11` - distributed babysitter purpose.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-human-attention.md:48` - attention/ask-human role.

  **Acceptance Criteria**:
  - [ ] Registry includes all agents the panel intends to render.
  - [ ] Each entry includes doc provenance and prompt-management mode.
  - [ ] Registry is used by mapper/UI rather than ad hoc string logic.

  **QA Scenarios**:
  ```text
  Scenario: Registry coverage matches intended panel set
    Tool: unit test / read check
    Preconditions: registry added
    Steps:
      1. Compare registry ids to panel sections and mapper outputs.
      2. Assert all intended rendered agents resolve metadata.
    Expected Result: no unknown-agent fallback in happy path.
    Evidence: .sisyphus/evidence/task-7-registry-coverage.txt

  Scenario: Registry doc links valid
    Tool: read/path existence check
    Preconditions: registry doc paths recorded
    Steps:
      1. Check each referenced repo doc path exists.
      2. Assert no broken local-doc references.
    Expected Result: docs links are valid.
    Evidence: .sisyphus/evidence/task-7-registry-docs.txt
  ```

  **Commit**: NO

- [ ] 8. Create merged PM-side query/view-model layer

  **What to do**:
  - Replace the single-query assumption in `PmLiveDashboard` with a composed query layer that fetches PM state plus side-agent endpoints and returns one view model.
  - Keep React Query boundaries explicit so refresh cadence can differ by source if needed.
  - Reconcile manual refresh behavior to refetch all participating sources.

  **Must NOT do**:
  - Do not push merge logic down into row components.
  - Do not give all sources identical stale times if their contracts differ materially.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: this is the main state-orchestration seam.
  - **Skills**: [`react-best-practices`, `caveman`]
    - `react-best-practices`: helps avoid refetch/render churn and tangled component state.
    - `caveman`: keep orchestration comments short.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: more useful in presentation layer than query orchestration.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 9, 10, 11, 13
  - **Blocked By**: 1, 4, 5, 6

  **References**:
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:278` - current single-query state fetch.
  - `apps/desktop/src/renderer/components/pm-attention-queue.tsx:260` - queue mutation callback expects query refresh.
  - `apps/desktop/src/renderer/ch5pm-dashboard/client.ts:86` - existing multi-source composition pattern.

  **Acceptance Criteria**:
  - [ ] PM page can render with combined PM state + side-agent view model.
  - [ ] Manual refresh refetches all relevant sources.
  - [ ] One failing live side-agent fetch does not erase existing PM state, but does surface a degraded side-agent state.

  **QA Scenarios**:
  ```text
  Scenario: Combined query loads all sources
    Tool: unit/integration test
    Preconditions: mocked PM state + side-agent endpoints
    Steps:
      1. Render dashboard with successful mocks.
      2. Assert both existing PM sections and side-agent sections populate.
    Expected Result: one screen shows both old and new data.
    Evidence: .sisyphus/evidence/task-8-combined-query.txt

  Scenario: One live source fails while PM state succeeds
    Tool: unit/integration test
    Preconditions: mocked PM state success, side-agent route failure
    Steps:
      1. Render dashboard under partial failure.
      2. Assert PM data still visible and side-agent section shows degraded banner.
    Expected Result: no crash, no silent disappearance.
    Evidence: .sisyphus/evidence/task-8-partial-failure.txt
  ```

  **Commit**: NO

- [ ] 9. Replace placeholder Agents dock panel with real Side Agents panel

  **What to do**:
  - Replace `AgentsPanel` placeholder in `pm-dockview.tsx` with a real component rendering side-agent sections.
  - Render at minimum: live subsystem cards, distributed babysitter box rows, attention/escalation rows, prompt-management badges, and doc/source links.
  - Keep visual language aligned with current PM dashboard and dockview shell.

  **Must NOT do**:
  - Do not collapse the panel into a wall of raw JSON.
  - Do not mix action buttons into the first version unless later task explicitly enables them with proof.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: dock panel UX and hierarchy work.
  - **Skills**: [`react-best-practices`, `caveman`]
    - `react-best-practices`: component boundaries and render hygiene.
    - `caveman`: keep labels terse and operator-friendly.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: useful, but this panel is constrained by existing PM visual system rather than greenfield design.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 14
  - **Blocked By**: 1, 6, 7, 8

  **References**:
  - `apps/desktop/src/renderer/components/pm-dockview.tsx:21` - placeholder to replace.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:100` - compact header/cell primitives that can inspire panel styling.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-daemon-subsystem-catalog.md:13` - panel section spine.

  **Acceptance Criteria**:
  - [ ] Agents panel is no longer placeholder copy.
  - [ ] Panel displays live side-agent data and explicit no-data/degraded states.
  - [ ] Prompt-management status is visible for each standing agent row/group.
  - [ ] Panel links related ticket/session identifiers where available.

  **QA Scenarios**:
  ```text
  Scenario: Side Agents panel renders live feed rows
    Tool: component test
    Preconditions: merged view model fixture with live babysitter rows
    Steps:
      1. Render dock panel.
      2. Assert subsystem headers and macmini row appear.
      3. Assert decision-needed row and prompt badge text appear.
    Expected Result: panel shows structured, readable side-agent surface.
    Evidence: .sisyphus/evidence/task-9-render-live.txt

  Scenario: Side Agents panel renders empty/degraded states
    Tool: component test
    Preconditions: empty feed fixture and degraded feed fixture
    Steps:
      1. Render with zero rows.
      2. Render with degraded error state.
      3. Assert explicit empty and degraded messages.
    Expected Result: operators can distinguish clear vs broken.
    Evidence: .sisyphus/evidence/task-9-render-degraded.txt
  ```

  **Commit**: NO

- [ ] 10. Integrate compact side-agent status into dense PM dashboard

  **What to do**:
  - Add a compact side-agent summary strip or section inside `PmLiveDashboard` so the dense console reflects side-agent health without requiring the dock panel to be open.
  - Reuse existing status-pill / section-row idioms.
  - Include clear counts: live side-agent issues, decision-needed rows, degraded feeds.

  **Must NOT do**:
  - Do not crowd out `needsChris`, frontier, or existing attention queue sections.
  - Do not duplicate the full Side Agents panel inside the dense console.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: tight information-density work within an existing console surface.
  - **Skills**: [`react-best-practices`, `caveman`]
    - `react-best-practices`: avoid layout churn and prop spaghetti.
    - `caveman`: terse labels suitable for dense console.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: existing console already constrains style strongly.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 14
  - **Blocked By**: 6, 7, 8

  **References**:
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:304` - current top-level counts.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:398` - current agents section location.
  - `apps/desktop/src/renderer/components/pm-live-dashboard.tsx:422` - `needsChris` section to preserve.

  **Acceptance Criteria**:
  - [ ] Dense dashboard shows side-agent summary counts/status without replacing existing sections.
  - [ ] Users can tell whether the live side-agent feed is healthy, degraded, or has pending attention.

  **QA Scenarios**:
  ```text
  Scenario: Dense dashboard shows side-agent summary
    Tool: component test
    Preconditions: merged view model with side-agent counts
    Steps:
      1. Render `PmLiveDashboard`.
      2. Assert summary strip/section includes live feed counts and degraded status indicator.
    Expected Result: dense console exposes side-agent health at a glance.
    Evidence: .sisyphus/evidence/task-10-dense-summary.txt

  Scenario: Existing key sections remain visible
    Tool: component test
    Preconditions: same render
    Steps:
      1. Assert `needs chris`, `ready frontier`, and `PmAttentionQueue` are still present.
    Expected Result: side-agent summary does not regress existing priority sections.
    Evidence: .sisyphus/evidence/task-10-no-regression.txt
  ```

  **Commit**: NO

- [ ] 11. Add degraded, stale, empty, and mismatch UX states

  **What to do**:
  - Implement explicit UI messaging for: daemon unreachable, daemon degraded, babysitter loop stalled, zero side-agent rows, and source freshness mismatch (`pm-state` fresh but `/pm/babysitter` stale, etc.).
  - Expose `dataAges`, `degradedReasons`, and `babysitterLoop` semantics to the operator.

  **Must NOT do**:
  - Do not hide stale or degraded states behind generic “no data”.
  - Do not infer health from row count alone.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: state-design and operator messaging.
  - **Skills**: [`caveman`]
    - `caveman`: terse operator copy.
  - **Skills Evaluated but Omitted**:
    - `content-strategy`: not necessary for operational microcopy.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 13, 14
  - **Blocked By**: 4, 8

  **References**:
  - `~/src/ch5/ch5-company/packages/ch5pm-daemon/src/babysitter/http.ts:162` - `/pm/babysitter` top-level response wrapper.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-distributed-babysitter.md:66` - loop health and degraded semantics.
  - `apps/server/src/routes/ch5pm.ts:15` - fail-loud doctrine.

  **Acceptance Criteria**:
  - [ ] Every degraded/missing state has distinct copy.
  - [ ] Operators can tell difference between “clear”, “unreachable”, “stale”, and “loop stalled”.

  **QA Scenarios — Exact Assertions Per Failure Mode**:
  ```text
  Scenario: Daemon unreachable
    Server response: proxy returns 502 with `{ok:false, error:"CH5PM daemon unreachable at <url>: <message>"}`
    UI assertions:
      - Side Agents panel shows red banner with text "CH5PM daemon unreachable" containing daemon URL.
      - Dense summary shows red dot indicator.
      - No silent empty state; no fallback to stale file data.
      - PM dashboard sections (boxes, sessions, frontier) still render if `/api/ch5pm/state` succeeded.
    Evidence: .sisyphus/evidence/task-11-unreachable.txt

  Scenario: Babysitter loop not running
    Server response: `/pm/babysitter` returns 200 with `babysitterLoop.running=false`
    UI assertions:
      - Panel shows amber indicator "Babysitter loop not running".
      - Box rows still render if `boxes[]` is non-empty.
      - No red error banner (feed is reachable, just not running).
    Evidence: .sisyphus/evidence/task-11-loop-not-running.txt

  Scenario: Babysitter loop stalled
    Server response: `/pm/babysitter` returns 200 with `degradedReasons` includes `"babysitter-loop-stalled"`
    UI assertions:
      - Panel shows amber indicator "Babysitter loop stalled" with `babysitterLoop.lastRunAt` timestamp.
      - Box rows still render if present.
    Evidence: .sisyphus/evidence/task-11-loop-stalled.txt

  Scenario: Empty box digests
    Server response: `/pm/babysitter` returns 200 with `boxes:[]`
    UI assertions:
      - Panel shows "No box digests reported" empty state text.
      - No error banner; no red indicator.
    Evidence: .sisyphus/evidence/task-11-empty-boxes.txt

  Scenario: Empty dispatch queue
    Server response: `/queue` returns 200 with `jobs:[]`
    UI assertions:
      - Merge queue section shows "No dispatch jobs" empty state.
    Evidence: .sisyphus/evidence/task-11-empty-queue.txt

  Scenario: Partial failure — PM state succeeds, side-agent feed fails
    Server response: `/api/ch5pm/state` 200, `/pm/babysitter` 502
    UI assertions:
      - PM dashboard sections render normally with live data.
      - Side Agents panel shows red degraded banner "CH5PM daemon unreachable".
      - Dense summary shows amber/red dot for side-agent health.
      - No crash; no silent disappearance of side-agent section.
    Evidence: .sisyphus/evidence/task-11-partial-failure.txt

  Scenario: PM state fails entirely
    Server response: `/api/ch5pm/state` returns 502
    UI assertions:
      - Entire PM page shows fail-loud error with daemon URL.
      - No partial render of dashboard sections.
    Evidence: .sisyphus/evidence/task-11-pm-state-fails.txt

  Scenario: Stale feed
    Server response: `/pm/babysitter` returns 200 but `dataAges.feed` is >10 minutes old
    UI assertions:
      - Panel shows "Stale feed" indicator with age (e.g. "15m old").
      - Box rows still render but with stale indicator.
    Evidence: .sisyphus/evidence/task-11-stale-feed.txt
  ```

  **Commit**: NO

- [ ] 12. Add contract tests for proxy and client parsing

  **What to do**:
  - Add tests for new CH5PM server proxy routes and renderer client fetch/parsing helpers.
  - Add captured fixtures for `/pm/babysitter`, `/queue`, and `/health` (safe, redacted where needed).
  - Ensure tests fail loudly if canonical required fields disappear.

  **Must NOT do**:
  - Do not rely only on hand-tested live curls.
  - Do not accept optional-everything typing that makes contract loss invisible.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: contract/proxy tests are focused and mechanical.
  - **Skills**: [`caveman`]
    - `caveman`: concise fixture provenance comments.
  - **Skills Evaluated but Omitted**:
    - `test-scenarios`: nice-to-have, but test structure is already conventional here.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: FINAL
  - **Blocked By**: 2, 3, 5

  **References**:
  - `apps/desktop/src/renderer/ch5pm-dashboard/contract.test.ts:43` - current contract-test style.
  - `apps/server/src/routes/ch5pm.ts:71` - route surface to test.
  - `apps/desktop/src/renderer/ch5pm-dashboard/client.ts:60` - existing client fetch helper style.

  **Acceptance Criteria**:
  - [ ] Tests assert required top-level keys for side-agent payloads.
  - [ ] Proxy failure behavior is tested.
  - [ ] Client parsing tests cover happy path and failure path.

  **QA Scenarios**:
  ```text
  Scenario: Contract fixtures validate required fields
    Tool: bun test
    Preconditions: fixtures/test file added
    Steps:
      1. Run side-agent contract tests.
      2. Assert tests verify keys like `hubBoxId`, `boxes`, `attention`, `babysitterLoop`.
    Expected Result: contract drift breaks tests.
    Evidence: .sisyphus/evidence/task-12-contract-tests.txt

  Scenario: Proxy route tests catch fallback regressions
    Tool: bun test
    Preconditions: mocked daemon unavailable
    Steps:
      1. Run proxy route tests.
      2. Assert 502 and no fallback body from stale local files.
    Expected Result: fail-loud doctrine protected.
    Evidence: .sisyphus/evidence/task-12-proxy-tests.txt
  ```

  **Commit**: NO

- [ ] 13. Add component tests for panel rendering and degraded states

  **What to do**:
  - Add renderer tests for the new Side Agents panel and any new dense summary components.
  - Cover healthy live state, no-data state, degraded state, and prompt-management badges.
  - Keep tests component-level and pure where possible.

  **Must NOT do**:
  - Do not rely on brittle snapshot-only tests.
  - Do not skip partial-failure cases.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: slightly more involved renderer proof work.
  - **Skills**: [`react-best-practices`, `caveman`]
    - `react-best-practices`: keeps test seams clean and component-friendly.
    - `caveman`: concise test names / fixtures.
  - **Skills Evaluated but Omitted**:
    - `visual-tdd`: not necessary; this is structure/state rendering, not pixel diffing.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: FINAL
  - **Blocked By**: 4, 6, 7, 8, 11

  **References**:
  - `apps/desktop/src/renderer/components/pm-attention-queue.tsx:260` - existing component test target style and responsibilities.
  - `apps/desktop/src/renderer/ch5pm-dashboard/attention.ts:23` - pattern for pure helper testing.

  **Acceptance Criteria**:
  - [ ] Side Agents panel tests cover happy path + degraded path + empty path.
  - [ ] Dense summary tests prove no regression to attention/needsChris rendering.

  **QA Scenarios — Exact Assertions Per Failure Mode**:
  ```text
  Scenario: Daemon unreachable
    Server response: proxy returns 502 with `{ok:false, error:"CH5PM daemon unreachable at <url>: <message>"}`
    UI assertions:
      - Side Agents panel shows red banner with text "CH5PM daemon unreachable" containing daemon URL.
      - Dense summary shows red dot indicator.
      - No silent empty state; no fallback to stale file data.
      - PM dashboard sections (boxes, sessions, frontier) still render if `/api/ch5pm/state` succeeded.
    Evidence: .sisyphus/evidence/task-11-unreachable.txt

  Scenario: Babysitter loop not running
    Server response: `/pm/babysitter` returns 200 with `babysitterLoop.running: false`
    UI assertions:
      - Panel shows amber indicator "Babysitter loop not running".
      - Box rows still render if `boxes[]` is non-empty.
      - No red error banner (feed is reachable, just not running).
    Evidence: .sisyphus/evidence/task-11-loop-not-running.txt

  Scenario: Babysitter loop stalled
    Server response: `/pm/babysitter` returns 200 with `degradedReasons` includes `"babysitter-loop-stalled"`
    UI assertions:
      - Panel shows amber indicator "Babysitter loop stalled" with `babysitterLoop.lastRunAt` timestamp.
      - Box rows still render if present.
    Evidence: .sisyphus/evidence/task-11-loop-stalled.txt

  Scenario: Empty box digests
    Server response: `/pm/babysitter` returns 200 with `boxes:[]`
    UI assertions:
      - Panel shows "No box digests reported" empty state text.
      - No error banner; no red indicator.
    Evidence: .sisyphus/evidence/task-11-empty-boxes.txt

  Scenario: Empty dispatch queue
    Server response: `/queue` returns 200 with `jobs:[]`
    UI assertions:
      - Merge queue section shows "No dispatch jobs" empty state.
    Evidence: .sisyphus/evidence/task-11-empty-queue.txt

  Scenario: Partial failure — PM state succeeds, side-agent feed fails
    Server response: `/api/ch5pm/state` 200, `/pm/babysitter` 502
    UI assertions:
      - PM dashboard sections render normally with live data.
      - Side Agents panel shows red degraded banner "CH5PM daemon unreachable".
      - Dense summary shows amber/red dot for side-agent health.
      - No crash; no silent disappearance of side-agent section.
    Evidence: .sisyphus/evidence/task-11-partial-failure.txt

  Scenario: PM state fails entirely
    Server response: `/api/ch5pm/state` returns 502
    UI assertions:
      - Entire PM page shows fail-loud error with daemon URL.
      - No partial render of dashboard sections.
    Evidence: .sisyphus/evidence/task-11-pm-state-fails.txt

  Scenario: Stale feed
    Server response: `/pm/babysitter` returns 200 but `dataAges.feed` is >10 minutes old
    UI assertions:
      - Panel shows "Stale feed" indicator with age (e.g. "15m old").
      - Box rows still render but with stale indicator.
    Evidence: .sisyphus/evidence/task-11-stale-feed.txt
  ```

  **Commit**: NO

- [ ] 14. Prove live integration against daemon and PM route

  **What to do**:
  - Run local proof against live `127.0.0.1:43130` daemon and Firefly client proxy route.
  - Verify panel/summary consumes the mini digest row, at least one attention/escalation row if present, and current degraded metadata correctly.
  - Capture evidence files for live endpoint payloads and UI/render proof.

  **Must NOT do**:
  - Do not treat mocked tests as the only proof.
  - Do not claim success if live daemon feed is unavailable.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: final integration proof across layers.
  - **Skills**: [`react-best-practices`, `caveman`]
    - `react-best-practices`: useful for debugging any integration mismatch.
    - `caveman`: concise proof notes.
  - **Skills Evaluated but Omitted**:
    - `smoke-agent-gen-ui-browser`: only needed if browser-run proof becomes necessary; start with local bounded proof.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: FINAL
  - **Blocked By**: 5, 9, 10, 11

  **References**:
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-distributed-babysitter.md:121` - live curl/operator proof guidance.
  - `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-human-attention.md:144` - attention runtime API equivalents.
  - Live source: `http://127.0.0.1:43130/pm/babysitter`, `http://127.0.0.1:43130/queue`, `http://127.0.0.1:43130/health`.

  **Acceptance Criteria**:
  - [ ] Live daemon data appears in UI through Firefly client path, not just direct curl.
  - [ ] Degraded/loop metadata from live daemon is surfaced correctly.
  - [ ] Evidence captured for both raw endpoint payload and UI proof.

  **QA Scenarios**:
  ```text
  Scenario: Live side-agent feed visible through app seam
    Tool: bounded app/local proof + curl
    Preconditions: daemon running; app server path available
    Steps:
      1. Curl direct daemon endpoints and proxied app endpoints.
      2. Open PM route and inspect rendered side-agent panel/summary.
      3. Assert macmini row and current live attention/degraded status match source payloads.
    Expected Result: end-to-end UI reflects live daemon feed.
    Failure Indicators: UI shows stale placeholder content, omits macmini, or hides degraded state.
    Evidence: .sisyphus/evidence/task-14-live-proof.txt

  Scenario: Attention queue still works after side-agent changes
    Tool: UI/component/integration proof
    Preconditions: at least one attention item available or mutation mocked
    Steps:
      1. Verify `PmAttentionQueue` still renders and mutation path still refetches correctly.
      2. Assert no side-agent integration broke answer/dismiss flow.
    Expected Result: old attention workflow preserved.
    Evidence: .sisyphus/evidence/task-14-attention-regression.txt
  ```

  **Commit**: NO

---

## Final Verification Wave <!-- oc:id=sec_an -->

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify implementation covers all required slices: proxy routes, types, composition, side-agent panel, dense summary, degraded states, tests, live proof. Reject if any section of this plan was silently dropped.

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run repo typecheck and relevant tests. Review for duplicated daemon contracts, hidden fallbacks, tangled JSX-level merge logic, and untested degraded states.

- [ ] F3. **Real QA** — `unspecified-high`
  Replay live daemon proof with actual `/pm/babysitter`, `/queue`, `/health`, and PM route rendering. Verify live and degraded cases.

- [ ] F4. **Scope Fidelity Check** — `deep`
  Ensure work stayed on Side Agents panel + supporting PM plumbing. Reject opportunistic dashboard redesign or daemon behavior changes outside explicit scope.

---

## Commit Strategy

- Group A: proxy + types + fetch/composition plumbing
- Group B: Side Agents UI + dense summary + degraded states
- Group C: tests + live proof artifacts

---

## Success Criteria <!-- oc:id=sec_ao -->

### Verification Commands <!-- oc:id=sec_ap -->
```bash
bun run check-types
bun test apps/desktop/src/renderer/ch5pm-dashboard/contract.test.ts
bun test <new side-agent test files>
curl -fsS http://127.0.0.1:43130/pm/babysitter
curl -fsS http://127.0.0.1:43130/queue
curl -fsS http://127.0.0.1:43130/health
```

### Final Checklist <!-- oc:id=sec_aq -->
- [ ] Existing PM dashboard still works
- [ ] Side Agents panel is real, not placeholder
- [ ] Live daemon feed is visible through palot seams
- [ ] Prompt-management gaps are surfaced, not hidden
- [ ] Degraded/offline states fail loud
- [ ] Tests cover contracts and UI states