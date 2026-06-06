# Palot Browser Side Panel + OpenCode + Magic Browser + Cursor Plan <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> Build a Palot-owned integration layer that binds each OpenCode session to a browser lane / Magic Browser session, injects that state into OpenCode through a plugin, exposes agent-callable Palot browser tools, and renders a fake animated cursor + action playback overlay in the Palot browser panel.
>
> Deliverables:
> - OpenCode plugin for Palot state + tools
> - Per-session Palot session↔lane↔Magic Browser session mapping
> - Browser action event bus and overlay cursor system
> - Coordinate-resolution path for clicks/types/scrolls
> - Verification paths for local and remote lanes
>
> Estimated Effort: Large
> Parallel Execution: YES - 4 waves
> Critical Path: mapping model -> plugin bridge -> action bus -> overlay playback -> verification

### Architecture Decision (V1 scope) <!-- oc:id=sec_architecture_decision -->

- V1 scope: **desktop-only** (Electron build). Browser-mode dev is for UI work, not for the plugin+tools contract.
- V1 transport: plugin runs in the same Node process as the OpenCode server (Electron main). Palot plugin reaches Palot's main process through OpenCode's plugin<->host API. No new localhost HTTP server, no new auth surface, no new port lifecycle.
- Browser-mode dev: keep the renderer UI usable, but the plugin/automation tools are no-ops in browser-mode and a clear status badge is shown.
- One resolver module is the hard seam: `resolve(opencodeSessionId) -> { binding, nonSecretSnapshot, opaqueActionTarget }`. T8, T9, T16 all consume the same module.
- The V1 fake cursor is best-effort and explicit about its limits (see T5/T13/T15). It is never marketed as exact-fidelity.

---

## Context

### Original Request
Plan the full implementation for allowing an agent running in Palot, connected to OpenCode, to control the client-side browser through Magic Browser / browser lanes, with OpenCode plugin context/tool injection, and with a visible fake animated cursor that moves, clicks, and types.

### Interview Summary
**Key Discussions**:
- Browser control should not live as ad hoc prompt munging; it should use a real OpenCode plugin plus real tools.
- Magic Browser session authority is preferred over raw CDP ids because it preserves restartability, human takeover, and stable session semantics.
- The fake animated cursor likely belongs in the Palot/browser-stream surface as a visual overlay, while real automation remains in CDP / Magic Browser.
- If coordinate fidelity is poor, add a near-browser coordinate helper or injected page helper before considering a Chrome extension.

**Research Findings**:
- Browser side panel already exists and already owns lane state and streaming surface rendering.
- OpenCode plugin hooks can inject system context and register custom tools.
- Current prompt send path already has a single chokepoint for interactive prompts.
- Automation path already proves `system` prompt injection works.
- No Palot session to browser lane mapping exists today.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Need explicit guardrails separating real automation from visual playback.
- Need edge-case handling for scroll, zoom, iframe offsets, and remote stream latency.
- Need acceptance criteria for cursor fidelity and takeover coexistence.
- Need staged fallback if overlay-only coordinates are insufficient.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Create a durable Palot browser-control architecture where OpenCode can understand and control the active browser context through plugin-injected Palot state and tools, while the user sees believable cursor/action playback in the browser side panel.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- Session-scoped mapping among OpenCode session id, Palot agent/session view, browser lane id, and Magic Browser session id
- Palot OpenCode plugin with context injection and browser-control tools
- Main/preload/renderer bridge for browser state snapshot, browser actions, and action-event subscriptions
- Browser action event bus with durable typed schema
- Cursor overlay renderer in the browser side panel with move/click/type/scroll playback
- Coordinate resolution contract for DOM target rects / viewport / stream geometry
- Verification helpers and evidence capture for local managed and remote managed lanes

### Definition of Done <!-- oc:id=sec_af -->
- [ ] Agent can inspect current browser status from within OpenCode using Palot-provided tool(s)
- [ ] Agent can request browser actions through Palot-provided tool(s)
- [ ] Browser panel visually replays cursor movement/click/type against the streamed surface
- [ ] Session binding is stable per OpenCode session, not global-only
- [ ] Human takeover / checkpoint flow does not break cursor overlay state or session routing
- [ ] Local and remote lane flows both have executable QA coverage
- [ ] Recovery: OpenCode restart does not desync routing
- [ ] Recovery: lane restart does not desync routing
- [ ] Recovery: Magic Browser restart does not desync routing
- [ ] Recovery: session switch mid-playback does not desync routing
- [ ] Per-binding monotonic sequence observed in replay log
- [ ] Best-effort overlay badge visible under low-confidence or drift conditions
- [ ] Cursor freezes and "human in control" badge appears during human takeover
- [ ] Session switch during in-flight tool request shows old playback on old binding only; no bleed into new panel
- [ ] Tool rejection returns typed errors from the error taxonomy when takeover, unbound, or geometry confidence is low
- [ ] Secret cache and viewer auth tokens never appear in plugin/tool outputs, in renderer state, or in persisted binding JSON
- [ ] Action state machine (`queued -> dispatched -> runtime_ack -> completed|failed|cancelled`) verified for happy + takeover + lane-down paths
- [ ] Resolver never called from the renderer
- [ ] Plugin bridge (T0) selected, documented, and exercised by T19a

### Must Have <!-- oc:id=sec_ag -->
- Stable session-level binding
- Real OpenCode plugin, not only renderer-side prompt hacks
- Real typed tool schemas
- Visual cursor separated from actual browser automation transport
- Browser overlay keyed by Magic Browser session / lane context

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- No Chrome-extension-first dependency for V1
- No raw-CDP-only contract as the primary session identity
- No fake cursor logic inside LLM prompt-building code
- No coupling cursor playback to brittle one-off DOM selectors in renderer-only code
- No assumption that a single global lane id is sufficient across all sessions
- No human-only acceptance criteria
- No bearer tokens or Magic Browser viewer auth in the SessionBinding record; secrets live in a main-only secret cache keyed by binding id
- No plugin caching lane/Magic Browser ids across tool calls; resolve binding by OpenCode session id on every call
- No "exact caret fidelity" claim for type visualization unless a page helper confirms the caret rect; otherwise show a "best-effort" badge
- No new localhost HTTP sidecar; reuse the existing OpenCode plugin/runtime bridge plus a direct main IPC seam where possible
- No silent work queue during human takeover; reject new tool requests with `human_in_control`
- No resolver calls from the renderer; renderer only reads derived snapshots and subscribes to the action bus

### Security Boundary <!-- oc:id=sec_security -->

- Plugin/tool outputs MUST NOT expose: Magic Browser viewer auth token, raw CDP endpoint with creds, SecretCache handles, or the persisted binding JSON path.
- Plugin sees only: viewer URL hint or opaque handle, resolver contract results, and tool return JSON.
- Renderer sees only: derived snapshot (no secrets), action event bus (no secrets), and IPC channel results filtered at main.
- Main process is the only authority for binding mutation, SecretCache access, and lane/session lifecycle events.
- Renderer NEVER calls the resolver. Renderer reads derived snapshot and subscribes to the action bus only.

### Action Ownership / State Machine <!-- oc:id=sec_state_machine -->

Per `requestId`, every browser action follows an explicit state machine:
- `queued` -> `dispatched` -> `runtime_ack` -> `completed` | `failed` | `cancelled`
- Tool return: emit `queued` synchronously, then transition via the action bus.
- Cancellation reasons: `human_in_control`, `lane_unavailable`, `magic_browser_unavailable`, `geometry_low_confidence`, `permission_denied`, `binding_in_flight`.
- Late `tool_result` events for a `requestId` whose state is `cancelled` are dropped.
- Late `tool_result` events for a different `requestId` are not allowed to retroactively change a settled state.

### Scope Trim Order <!-- oc:id=sec_scope_trim -->

If scope must shrink, cut in this order:
1. `palot_browser_tabs` tool
1. Action log sidebar
1. Best-effort overlay badge
1. Remote managed verification lane (T20) -- keep T19 local first

Never cut: binding model, plugin bridge, action bus, overlay primitives, T19a verification harness.

---

## Verification Strategy

> ZERO HUMAN INTERVENTION for acceptance. Agent-executed verification only.

### Test Decision
- **Infrastructure exists**: Partial / weak for these surfaces
- **Automated tests**: Tests-after
- **Framework**: Bun tests where existing local patterns fit; targeted component/unit tests where feasible
- **Agent-Executed QA**: Mandatory for all tasks

### QA Policy
Every task includes executable QA scenarios with evidence under `.sisyphus/evidence/`.

- **Frontend/UI**: browser-mode or Electron-mode surface validation, screenshots, DOM assertions
- **Backend/IPC/API**: read typed responses, assert fields and state transitions
- **Plugin/tooling**: invoke tool surfaces, inspect JSON output, verify session scoping
- **Browser-control**: verify emitted action events, overlay rendering, and resumed lane/session continuity

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Parallel Execution Waves <!-- oc:id=sec_aj -->

Wave 1 (foundation / contracts):
- T1 session-binding domain model + authority contract
- T2 browser action event schema (with source tags and sequence)
- T3 OpenCode plugin package scaffold
- T4 IPC / preload bridge contract design
- T5 coordinate-space contract and geometry model
- T0 OpenCode plugin runtime API spike (NEW) - inspect actual plugin<->host comms precedents; decide internal RPC vs Electron direct bridge; required to remove hidden seam risk before T8/T9/T16

Wave 1.5 (overlay verification gate, moved earlier):
- T19a browser overlay verification spike

Wave 2 (backend + plugin core):
- T6 persistent mapping store + lifecycle hooks
- T7 Palot browser state snapshot provider
- T8 OpenCode plugin context injection
- T9 OpenCode plugin tool registration
- T10 action bus publisher in main/Magic Browser integration layer

Wave 3 (renderer + overlay):
- T11 browser panel session-aware lane binding
- T12 event subscription pipeline renderer-side
- T13 fake cursor overlay renderer
- T14 action visualization primitives (move/click/type/scroll)
- T15 geometry reconciliation / drift handling

Wave 4 (integration + resilience):
- T16 tool-to-action execution wiring (no new localhost sidecar)
- T17 Magic Browser session bootstrap / attach contract
- T18 checkpoint / takeover coexistence
- T19a browser overlay verification spike (gate)
- T19 local managed verification lane
- T20 remote managed verification lane

Wave FINAL:
- F1 plan compliance audit
- F2 code quality review
- F3 real QA execution
- F4 scope fidelity review

Critical Path: T1 -> T6 -> T8/T9 -> T10 -> T12/T13 -> T16 -> T18 -> T19/T20 -> Final

### Dependency Matrix <!-- oc:id=sec_ak -->
- T0: none -> T8, T9, T16
- T1: none -> T6, T8, T11
- T2: none -> T9, T10, T12, T13, T14
- T3: none -> T8, T9
- T4: none -> T7, T10, T12
- T5: none -> T13, T14, T15, T19a, T20
- T19a: T13, T14 -> T19, T20, Final
- T6: T1 -> T16, T17, T18
- T7: T4 -> T8, T9, T16
- T8: T1, T3, T7 -> T16
- T9: T2, T3, T7 -> T16
- T10: T2, T4 -> T12, T14, T15, T18
- T11: T1 -> T12, T13
- T12: T2, T4, T10, T11 -> T13, T14, T18
- T13: T2, T5, T11, T12 -> T19, T19a, T20
- T14: T2, T5, T10, T12 -> T19, T19a, T20
- T15: T5, T10 -> T20
- T16: T6, T7, T8, T9 -> T17, T18, T19, T19a, T20
- T17: T6, T16 -> T18, T20
- T18: T6, T10, T12, T16, T17 -> T19, T19a, T20
- T19a: T13, T14 -> T19, T20, Final
- T19: T13, T14, T16, T18, T19a -> Final
- T20: T13, T14, T15, T16, T17, T18, T19a -> Final

### Agent Dispatch Summary <!-- oc:id=sec_al -->
- T1-T5: quick / unspecified-high mix
- T6-T10: unspecified-high / deep
- T11-T15: visual-engineering + unspecified-high
- T16-T20: deep / unspecified-high / visual-engineering
- Final: oracle + unspecified-high + deep

---

- [x] 0. OpenCode plugin<->host communication spike (runtime matrix)

  **What to do**:
  - Inspect the actual OpenCode plugin runtime matrix: where the plugin runs (same process as OpenCode server? separate worker?), and how plugins reach app state in real plugins (oh-my-opencode, cloudflare-memory-plugin, opencode-notifier, masker).
  - Document the runtime matrix in evidence: plugin process model, what session id source is available per hook/tool call, what host API is exposed, and how Palot reaches it in desktop mode (and that it is unreachable in browser-mode dev).
  - Conclude with a single typed contract: `resolve(opencodeSessionId) -> { binding, nonSecretSnapshot, opaqueActionTarget }`. This contract is the single seam consumed by T8, T9, T16, T17.
  - If a clean transport exists, use it. If not, propose the smallest new seam and re-scope T8/T9/T16.
  - This task produces .sisyphus/evidence/task-0-bridge-decision.md and prevents the rest of Wave 2 from hiding the hardest seam.

  **Must NOT do**:
  - Do not add a new localhost HTTP server.
  - Do not change the OpenCode runtime.
  - Do not ship a partial answer; if no clean transport exists, escalate.

  **Recommended Agent Profile**:
  - **Category**: deep
  - **Reason**: hides the hardest seam in the architecture.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T8, T9, T16
  - **Blocked By**: none

  **References**:
  - oh-my-opencode/src/plugin-handlers/
  - firefly-cloud/packages/masker/src/opencode-adapter/
  - cloudflare-memory-plugin/src/index.ts
  - opencode-notifier/src/index.ts
  - apps/desktop/src/main/opencode-manager.ts

  **Acceptance Criteria**:
  - [ ] Runtime matrix doc committed.
  - [ ] Resolver contract committed as a single source of truth.
  - [ ] All T8/T9/T16 references updated to consume the resolver module.

- [ ] T19a (moved to Wave 1.5, see Wave 4 task)

## TODOs

- [x] 1. Session binding domain model + authority contract

  **What to do**:
  - Define typed entities: OpenCode session id, Palot agent/session view, browser lane id, Magic Browser session id.
  - Document the authority contract near the model: Magic Browser session id = browser authority; OpenCode session id = agent authority; lane id = transport attachment (may change over time); overlay event stream = visualization only. This must be visible to every downstream task or drift will creep in.
  - One binding per OpenCode session id. Stable ids + lifecycle are persisted. Live lane/health/viewerURL are derived on read, not persisted in the binding record.
  - Define lifecycle states: unbound, attaching, attached, suspended, restored, released.
  - Persistence: a single small JSON file in the app data dir, owned by main, read at startup. Only move to sqlite if query/recovery needs grow.
  - Document the canonical `getBindingByOpenCodeSession(sessionId)` access pattern.
  - Provide a separate main-only SecretCache keyed by binding id that stores the Magic Browser viewerServer.authToken. Plugin/renderer never see the secret; they only get viewer URL hints or opaque handles.

  **Must NOT do**:
  - Do not store Magic Browser session secrets or bearer tokens in the binding record.
  - Do not persist live lane/viewerURL/health in the binding JSON.
  - Do not hardcode a single global lane; binding must be per OpenCode session.
  - Do not store binding in renderer localStorage.

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Reason**: domain model + small set of types and helpers; not many files.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T6, T8, T11
  - **Blocked By**: none

  **References**:
  - apps/desktop/src/renderer/atoms/browser.ts
  - apps/desktop/src/renderer/components/side-panel/browser-panel.tsx
  - apps/desktop/src/main/browser-lane-manager.ts
  - apps/desktop/src/renderer/hooks/use-server.ts
  - magic-browser/src/session/types.ts
  - magic-browser/src/session/authority.ts

  **Acceptance Criteria**:
  - [ ] SessionBinding type and helpers committed.
  - [ ] Authority contract doc added near the model.
  - [ ] SecretCache type and contract committed (separate file).
  - [ ] Lifecycle states documented.
  - [ ] Evidence file: .sisyphus/evidence/task-1-binding-model.md.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Type compiles end to end
    Tool: bun run check-types
    Preconditions: repo at clean baseline.
    Steps:
      1. Run bun run check-types.
      1. Assert exit code 0.
    Expected Result: zero type errors.

- [x] 2. Browser action event schema (with source tags, sequence, correlation, error taxonomy)

  **What to do**:
  - Define a typed BrowserActionEvent union: move, click, type, scroll, focus, hover, waitFor, navigate, attachSession, detachSession, toolRequest, toolResult, systemReconcile, humanTakeoverPaused, humanTakeoverResumed.
  - Per-event fields: id, sessionId, laneId, source (`tool_request` | `automation_runtime` | `human_takeover` | `system_reconcile`), monotonic sequence per binding, requestId, causationId, optional toolCallId, targetDescription, viewportCoords, streamGeometrySnapshot, timestamp, durationMs, status.
  - Add caretConfidence: `none` | `low` | `high` (used by type events; only `high` when a page helper confirms caret rect).
  - Define an explicit error taxonomy used by tool results and system events: `unbound_session`, `lane_unavailable`, `human_in_control`, `magic_browser_unavailable`, `geometry_low_confidence`, `binding_in_flight`, `permission_denied`.
  - Define event versioning and a contract-checksum.
  - Provide a tiny normalization helper so renderer and main agree on shape.
  - Avoid generic `kind+params` shape. Use discriminated unions per kind.

  **Must NOT do**:
  - Do not encode tool output payload schema inside event; only references.
  - Do not couple to a single IPC transport.
  - Do not use generic untyped object params; use discriminated unions.

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Reason**: types and small helpers.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T9, T10, T12, T13, T14
  - **Blocked By**: none

  **References**:
  - apps/desktop/src/main/browser-lane-cdp.ts
  - apps/desktop/src/renderer/services/backend.ts
  - magic-browser/src/runtime/viewer-server/

  **Acceptance Criteria**:
  - [ ] Event union and normalization committed.
  - [ ] Monotonic per-binding sequence enforced at publish time.
  - [ ] Correlation fields + error taxonomy committed.
  - [ ] Evidence file: .sisyphus/evidence/task-2-action-schema.md.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Type compile + fixture roundtrip
    Tool: bun test
    Preconditions: test fixture file present.
    Steps:
      1. Run bun test for the schema fixture.
      1. Assert all events pass normalize, sequence increments, correlation ids populate.
    Expected Result: 0 failures.

- [x] 3. OpenCode plugin package scaffold

  **What to do**:
  - Create packages/palot-opencode-plugin (or apps/desktop/.opencode/plugins/palot-bridge) directory with package.json, tsconfig, build step.
  - Export `{ id, server }` module shape.
  - Provide a tiny `createPalotPlugin({ endpoint, fetchImpl })` factory.
  - Set up build to dist/ for the existing plugin loader path.

  **Must NOT do**:
  - Do not ship an untyped function plugin; must use the documented module shape.
  - Do not couple the plugin to renderer state.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high
  - **Reason**: package + build + module shape is well-defined but multi-file.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T8, T9
  - **Blocked By**: none

  **References**:
  - elf-code-indexing/src/index.ts
  - oh-my-opencode/src/index.ts
  - opencode-scheduler/src/index.ts
  - portable-opencode/TOPOLOGY.md
  - ~/.config/opencode/opencode.jsonc

  **Acceptance Criteria**:
  - [ ] Plugin builds clean.
  - [ ] Plugin loads in dev runtime.
  - [ ] Evidence file: .sisyphus/evidence/task-3-plugin-scaffold.md.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Build emits dist
    Tool: bun run build
    Preconditions: package.json in place.
    Steps:
      1. Run build.
      1. Assert dist/index.js exists.
    Expected Result: 0 failures.

- [x] 4. IPC / preload bridge contract

  **What to do**:
  - Define typed IPC channels for:
    - palot:browser-state-snapshot(sessionId)
    - palot:browser-action (publish)
    - palot:browser-actions-subscribe (event)
    - palot:binding-get/set/release
  - Add preload bridge in apps/desktop/src/preload/index.ts.
  - Add typed surface in apps/desktop/src/preload/api.d.ts.
  - Add main handlers in apps/desktop/src/main/ipc-handlers.ts.

  **Must NOT do**:
  - Do not use untyped `any` on IPC payloads.
  - Do not put JSON-stringified state into a single channel.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T7, T10, T12
  - **Blocked By**: none

  **References**:
  - apps/desktop/src/preload/index.ts
  - apps/desktop/src/preload/api.d.ts
  - apps/desktop/src/main/ipc-handlers.ts
  - apps/desktop/src/renderer/services/backend.ts

  **Acceptance Criteria**:
  - [ ] Channels registered.
  - [ ] Renderer-side typed wrappers compile.
  - [ ] Evidence file: .sisyphus/evidence/task-4-ipc-contract.md.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Channel contract smoke
    Tool: bun test
    Steps:
      1. Run handler test fixtures.
      1. Assert all channels respond with correct shape.

- [x] 5. Coordinate-space contract + geometry model (with fallback ladder)

  **What to do**:
  - Define coordinate spaces: DOM rect (selector-relative), page viewport, stream viewport, panel viewport.
  - Define transformation helpers (pure functions) for converting between spaces.
  - Define streamGeometrySnapshot and panelGeometrySnapshot types.
  - Define an explicit fallback ladder for cursor coordinate resolution, in order:
    1. Page-reported rect (from a page helper that resolves element rects in stream coords). caretConfidence = high.
    1. Pure stream-geometry transform from event coordinates. caretConfidence = low. Show best-effort badge.
    1. Last-good-cursor + warning. caretConfidence = none. Show best-effort badge.
  - Define perf/acceptance targets:
    - Event burst cap: 200 events/second per binding before coalescing.
    - Overlay FPS target: 30 fps minimum.
    - Replay latency: last action visible within 200ms of `tool_result` (p95).
    - Drift tolerance: <= 4px before snap+badge.
  - Provide fixtures for iframe-zoomed and scroll-anchored layouts.

  **Must NOT do**:
  - Do not use any framework for transforms; keep math pure.
  - Do not couple to a single browser engine.
  - Do not claim caret fidelity unless page helper confirms.

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Reason**: bounded math + types.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: T13, T14, T15, T19a, T20
  - **Blocked By**: none

  **References**:
  - apps/desktop/src/renderer/atoms/browser.ts
  - apps/desktop/src/renderer/components/side-panel/browser-panel.tsx
  - apps/desktop/src/main/browser-lane-cdp.ts

  **Acceptance Criteria**:
  - [ ] Coordinate helpers + tests.
  - [ ] Fallback ladder documented in code.
  - [ ] Iframe-zoomed and scroll-anchored fixtures.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Transform roundtrip
    Tool: bun test
    Steps:
      1. Run unit tests for roundtrips.
    Expected Result: 0 failures.
  - Scenario: Iframe-zoomed fixture -> fallback level 2 + badge
    Tool: bun test

- [x] 6. Persistent mapping store + lifecycle hooks

  **What to do**:
  - Implement a PalotSessionBindingStore (main process) that maps OpenCode session id -> binding.
  - Hook into session.create / session.deleted / session.idle events from the OpenCode bus to attach / release bindings.
  - Expose getBinding / setBinding / releaseBinding via the IPC bridge.
  - Ensure bindings survive OpenCode server restarts if their session id still exists in the OpenCode SQLite store.

  **Must NOT do**:
  - Do not store bearer tokens / secrets inside the binding record.

  **Recommended Agent Profile**:
  - **Category**: deep
  - **Reason**: store + lifecycle + recovery is critical path.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: T16, T17, T18
  - **Blocked By**: T1

  **References**:
  - apps/desktop/src/main/opencode-manager.ts
  - apps/desktop/src/renderer/services/connection-manager.ts
  - apps/desktop/src/main/browser-lane-manager.ts

  **Acceptance Criteria**:
  - [ ] Store + hooks + IPC wired.
  - [ ] Evidence file: .sisyphus/evidence/task-6-binding-store.md.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Bind and release on synthetic session events
    Tool: bun test
    Steps:
      1. Trigger synthetic create/delete events.
      1. Assert store reflects expected state.

- [x] 7. Palot browser state snapshot provider

  **What to do**:
  - Implement a snapshot builder in main that produces a JSON-safe object describing: active sessionId, active lane, Magic Browser session id (if any), viewer URL (if any), health, last 8 actions, current URL, viewport snapshot.
  - Returned via palot:browser-state-snapshot IPC.
  - Keep snapshot deterministic in shape, cheap to compute, and capped to a small size.

  **Must NOT do**:
  - Do not include full DOM content or screenshots inside the snapshot.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T8, T9, T16
  - **Blocked By**: T4

  **References**:
  - apps/desktop/src/main/browser-lane-manager.ts
  - apps/desktop/src/renderer/components/side-panel/browser-panel.tsx

  **Acceptance Criteria**:
  - [ ] Snapshot helper + tests.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Snapshot invariants
    Tool: bun test
    Steps:
      1. Build snapshot with fixture state.
      1. Assert shape and size caps.

- [x] 8. OpenCode plugin context injection (per-call resolver)

  **What to do**:
  - Implement experimental.chat.system.transform hook in the plugin.
  - On every hook call, call the shared resolver module (T0/T16a): `resolve(opencodeSessionId) -> { binding, nonSecretSnapshot, opaqueActionTarget }`. Do NOT cache lane/Magic Browser ids inside the plugin across calls; re-resolve every time so restart/takeover never produces stale routing.
  - Append a compact Palot context block (OpenCode session id, stable binding fields, viewer URL hint) to output.system if a binding exists. NEVER include Magic Browser auth tokens or any secret-cache handle.
  - Add a session.idle hook to refresh the resolver cache.
  - Handle missing binding (no-op injection; do not log spam).

  **Must NOT do**:
  - Do not include secrets in injected text.
  - Do not cache lane/Magic Browser ids across calls.
  - Do not consume the resolver from the plugin without going through the shared module.

  **Recommended Agent Profile**:
  - **Category**: deep
  - **Reason**: needs precise hook contracts + system prompt shaping.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T16
  - **Blocked By**: T0, T1, T3, T7

  **References**:
  - oh-my-opencode/src/features/context-injector/injector.ts
  - cloudflare-memory-plugin/src/index.ts
  - elf-code-indexing/src/index.ts
  - apps/desktop/src/main/automation/executor.ts

  **Acceptance Criteria**:
  - [ ] Hook injects expected text; tests cover bound/unbound cases.
  - [ ] No long-lived lane/Magic Browser id cache inside plugin.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Injected context shape (bound)
    Tool: bun test
    Steps:
      1. Call hook with a fake sessionID and a fake binding.
      1. Assert output.system appended.
  - Scenario: Injected context shape (unbound)
    Tool: bun test
    Steps:
      1. Call hook with no binding.
      1. Assert no append.

- [x] 9. OpenCode plugin tool registration (per-call resolver, strict schemas)

  **What to do**:
  - Register explicit, strict-schema tools. Avoid generic `palot_browser_action(kind, params)`:
    - palot_browser_status(args: {}) -> JSON snapshot
    - palot_browser_open(args: { url? })
    - palot_browser_navigate(args: { url })
    - palot_browser_tabs(args: { action: "list" | "open" | "close" | "activate", tabId? })
    - palot_browser_click(args: { selector?, coordinates? })
    - palot_browser_type(args: { selector?, text })
    - palot_browser_scroll(args: { direction: "up" | "down" | "left" | "right", amount: number })
  - Each tool, on every invocation, calls the shared resolver module (T0/T16a) to resolve the binding by OpenCode session id. No plugin-side cache.
  - Tool execution does not block on real automation completion: the tool returns immediately with a `queued` status, and the dispatcher (T16b) publishes a `tool_result` event onto the bus. Tools return one of the typed errors from T2 when appropriate (`unbound_session`, `human_in_control`, `geometry_low_confidence`).

  **Must NOT do**:
  - Do not let tools depend on localStorage or renderer state.
  - Do not block on real automation completion.
  - Do not use generic `kind+params` shapes; use strict discriminated schemas per tool.

  **Recommended Agent Profile**:
  - **Category**: deep
  - **Reason**: multiple tools + per-call resolver contract.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T16
  - **Blocked By**: T0, T2, T3, T7

  **References**:
  - opencode-notifier/src/index.ts
  - oh-my-opencode/src/plugin/tool-registry.ts
  - firefly-cloud/packages/masker/src/opencode-adapter/plugin-factory.ts

  **Acceptance Criteria**:
  - [ ] Tool schemas defined.
  - [ ] Each tool calls the shared resolver module and returns a typed JSON.
  - [ ] Toolside tests with mocked resolver.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Each tool returns expected JSON for success and error.
    Tool: bun test

- [x] 10. Action bus publisher (sources, sequence, correlation, takeover rule)

  **What to do**:
  - In main, build a typed BrowserActionBus (EventEmitter-like) that publishers (browser-lane-manager, magic-browser integration, automation dispatcher) push events to.
  - Enforce `source` field at the publisher boundary.
  - Enforce a monotonic per-binding sequence counter (single writer per binding, drop duplicates on collision).
  - Wire the bus to the palot:browser-actions-subscribe IPC push channel.
  - Provide a single `publish(event: BrowserActionEvent)` for all publishers.
  - Buffer only the last N events; cap at small N to keep IPC lean.
  - On `human_takeover_paused` source: REJECT new `tool_request` events from the dispatcher with `human_in_control` error. Do NOT queue hidden work. Resume on `human_takeover_resumed`.

  **Must NOT do**:
  - Do not subscribe to OpenCode SSE in this layer; only publish.
  - Do not silently queue work during human takeover.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: T12, T14, T15, T18
  - **Blocked By**: T2, T4

  **References**:
  - apps/desktop/src/main/notification-watcher.ts
  - apps/desktop/src/main/opencode-manager.ts
  - apps/desktop/src/main/ipc-handlers.ts

  **Acceptance Criteria**:
  - [ ] Bus + IPC + capped buffer + sequence + tests.
  - [ ] Human takeover rejection rule tested.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Publish, subscribe, receive in order
    Tool: bun test
  - Scenario: Duplicate sequence dropped
    Tool: bun test
  - Scenario: human_takeover_paused -> tool_request rejected with human_in_control
    Tool: bun test

- [x] 11. Browser panel session-aware lane binding (no playback bleed on session switch)

  **What to do**:
  - In apps/desktop/src/renderer/components/side-panel/browser-panel.tsx, switch the lane picker to read from a per-session binding (from T6) with global fallback (activeBrowserLaneIdAtom).
  - Read sessionId from agent: Agent prop and use binding store.
  - On session switch, automatically pick the lane that the binding specifies and discard any in-flight overlay state for the old sessionId. Old playback remains visible only on the old panel; new panel sees only new binding's events.

  **Must NOT do**:
  - Do not block the panel render while awaiting binding resolution.
  - Do not let old binding events bleed into the new panel.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Reason**: small UI change with React state machinery.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T12, T13
  - **Blocked By**: T1

  **References**:
  - apps/desktop/src/renderer/components/side-panel/browser-panel.tsx
  - apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx
  - apps/desktop/src/renderer/components/agent-detail.tsx

  **Acceptance Criteria**:
  - [ ] Per-session lane binding active.
  - [ ] Session switch during in-flight tool request shows old playback on old binding only; no bleed into new panel.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Lane change on session switch
    Tool: bun test + manual browser-mode render
    Steps:
      1. Switch sessions.
      1. Assert active lane follows binding.
  - Scenario: Session switch mid-action -> no bleed
    Tool: bun test
    Steps:
      1. Inject tool_request for session A.
      1. Switch to session B.
      1. Inject tool_result for session A.
      1. Assert only session A panel saw its events.

- [x] 12. Renderer event subscription pipeline

  **What to do**:
  - Add a Jotai atom for the action event stream and a useBrowserActions hook.
  - Subscribe via window.elf.onBrowserActions((event) => ...).
  - Coalesce events on (id, laneId).
  - Cap render queue and drop old events under pressure.

  **Must NOT do**:
  - Do not subscribe to OpenCode SSE in renderer for this; only the Palot IPC.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Reason**: small reactive pipeline.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T13, T14, T18
  - **Blocked By**: T2, T4, T10, T11

  **References**:
  - apps/desktop/src/renderer/atoms/
  - apps/desktop/src/renderer/hooks/

  **Acceptance Criteria**:
  - [ ] Subscription + coalescing + cap.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Burst dedup
    Tool: bun test

- [x] 13. Fake cursor overlay renderer (best-effort, with fidelity badge, no bleed)

  **What to do**:
  - Create a React overlay component that renders a cursor (SVG or CSS) on top of the browser iframe.
  - Reads latest move/click events from the action stream. Each event carries a streamGeometrySnapshot; that snapshot is the single geometry source-of-truth for the frame, not recomputed separately in renderer.
  - Animates with CSS transform: translate3d and requestAnimationFrame to interpolate.
  - Renders a click ripple and a type indicator at click/type coordinates.
  - Show a "best-effort overlay" badge when caretConfidence is `low` or `none` for the latest type event, when the panel viewport != stream viewport at acceptable tolerance, or when geometry drift is detected. The badge must be visible to the user.
  - Subscribe to `human_takeover_paused` source events; freeze the cursor at its last position and surface a "human in control" badge. Resume on `human_takeover_resumed`.
  - Scope overlay state to the current binding's sessionId; do not let other sessionIds' events drive this panel.

  **Must NOT do**:
  - Do not read CDP directly from the renderer.
  - Do not claim caret fidelity unless the event has caretConfidence = `high`.
  - Do not recompute geometry separately; use the per-frame snapshot from the event.
  - Do not let events from other sessions bleed into this panel.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Reason**: visual component with animation.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T19, T19a, T20
  - **Blocked By**: T2, T5, T11, T12

  **References**:
  - apps/desktop/src/renderer/components/side-panel/browser-panel.tsx
  - apps/desktop/src/renderer/atoms/browser.ts
  - packages/ui/src/components/

  **Acceptance Criteria**:
  - [ ] Cursor animates across target positions.
  - [ ] Best-effort badge appears for low-caretConfidence or drift conditions.
  - [ ] Cursor freezes and badge appears on human_takeover_paused.
  - [ ] No event bleed across sessionIds.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Synthetic event playback
    Tool: bun test + screenshot
    Steps:
      1. Feed fixture events.
      1. Screenshot overlay.
      1. Assert cursor at expected coords.
  - Scenario: caretConfidence low -> badge visible
    Tool: bun test + screenshot
  - Scenario: human_takeover_paused -> cursor frozen + badge
    Tool: bun test + screenshot
  - Scenario: Other sessionId event while this panel mounted -> ignored
    Tool: bun test

- [x] 14. Action visualization primitives

  **What to do**:
  - Add renderers for: move (animated), click (ripple), type (text label near caret, with fidelity badge if caretConfidence != high), scroll (vertical offset), hover (subtle ring), human_takeover_paused/resumed, system_reconcile.
  - Add an "action log" sidebar showing recent events with timestamps, source tag, and sequence.
  - Reuse primitives across tools.

  **Must NOT do**:
  - Do not couple to a single animation library.

  **Recommended Agent Profile**:
  - **Category**: visual-engineering

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T19, T19a, T20
  - **Blocked By**: T2, T5, T10, T12

  **References**:
  - apps/desktop/src/renderer/components/side-panel/
  - packages/ui/src/components/

  **Acceptance Criteria**:
  - [ ] All primitive renderers work, including takeover and reconcile.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Each primitive renders
    Tool: bun test + screenshot

- [x] 15. Geometry reconciliation / drift handling

  **What to do**:
  - In renderer, snapshot panelGeometry on resize and on stream mount.
  - Apply transforms from T5 to convert event coords into panel viewport.
  - On mismatch above tolerance, snap the cursor to the latest event and emit a drift warning (dev only).
  - On mismatch, surface a "best-effort overlay" badge (per T13 contract).

  **Must NOT do**:
  - Do not block animation while resolving drift; always render the last good position.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T20
  - **Blocked By**: T5, T10

  **References**:
  - apps/desktop/src/renderer/components/side-panel/browser-panel.tsx

  **Acceptance Criteria**:
  - [ ] Drift handling unit tests.
  - [ ] Badge logic covered by tests.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Resize during playback
    Tool: bun test
  - Scenario: Resize with iframe-zoomed stream -> badge appears
    Tool: bun test

- [ ] 16a. Resolver bridge (plugin<->host binding resolution)

  **What to do**:
  - Implement only the resolver seam: per-call lookup of OpenCode session id -> Palot binding + SecretCache. Uses the bridge transport decided in T0.
  - No tool execution yet. This is the hardest part to get wrong; isolate it.
  - Provide a typed in-process test that simulates plugin restart mid-call and proves the next call still resolves correctly.

  **Must NOT do**:
  - Do not implement real automation here.
  - Do not introduce a new localhost HTTP server.

  **Recommended Agent Profile**:
  - **Category**: deep

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: T16b, T17, T18, T19, T19a, T20
  - **Blocked By**: T0, T6, T7, T8, T9

  **References**:
  - apps/desktop/src/main/ipc-handlers.ts
  - apps/desktop/src/main/browser-lane-manager.ts
  - oh-my-opencode/src/plugin-handlers/ (internal RPC precedents)

  **Acceptance Criteria**:
  - [ ] Per-call resolution works.
  - [ ] Plugin restart does not desync routing.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Per-call resolution succeeds
    Tool: bun test
  - Scenario: Plugin restart -> next call resolves correctly
    Tool: bun test

- [ ] 16b. Tool dispatcher wiring (real automation)

  **What to do**:
  - On top of T16a, implement the dispatcher: publish a `tool_request` event on the bus (T10), run the real automation through browser-lane-manager or Magic Browser session verbs, and publish the matching `toolResult` event.
  - The dispatcher's only stateful surface is the main-owned binding store, the SecretCache, and the action bus. No new auth, port, or restart surface.
  - Enforce `human_takeover_paused` -> `tool_request` events are not published.

  **Must NOT do**:
  - Do not introduce a new localhost HTTP server.
  - Do not require the plugin to know any port, token, or restart lifecycle.
  - Do not share state with renderer localStorage.
  - Do not publish `tool_request` events while human is in control.

  **Recommended Agent Profile**:
  - **Category**: deep

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: T17, T18, T19, T20
  - **Blocked By**: T16a

  **References**:
  - apps/desktop/src/main/browser-lane-manager.ts
  - apps/desktop/src/main/ipc-handlers.ts

  **Acceptance Criteria**:
  - [ ] End to end tool call -> action event -> toolResult event without a new HTTP server.
  - [ ] Per-call binding resolution verified.
  - [ ] Human takeover pause honored.

  **QA Scenarios (MANDATORY)**:
  - Scenario: End to end tool call -> action event
    Tool: bun test
  - Scenario: Human takeover pause blocks tool_request events
    Tool: bun test

- [ ] 17. Magic Browser session bootstrap / attach contract

  **What to do**:
  - In main, when a binding attaches, ensure a Magic Browser session exists (create-or-attach).
  - Use --attach --cdp-url <resolved-port> if a local lane is up; otherwise start a new session.
  - Persist ONLY the stable `magicBrowserSessionId` in the binding record. Derive the viewer URL and health on every read. Store the viewerServer.authToken ONLY in the SecretCache (T1), keyed by binding id. The binding record MUST NOT contain the auth token or the viewer URL.
  - On detached browser, attempt restart-and-reattach without changing sessionId; verify the viewer URL still derives correctly.

  **Must NOT do**:
  - Do not persist viewer URL in the binding JSON.
  - Do not expose Magic Browser secret sinks to the plugin or renderer.
  - Do not put authToken in the persisted binding JSON.

  **Recommended Agent Profile**:
  - **Category**: deep

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T18, T20
  - **Blocked By**: T6, T16

  **References**:
  - magic-browser/AGENTS.md
  - magic-browser/src/session/authority.ts
  - apps/desktop/src/main/browser-lane-manager.ts

  **Acceptance Criteria**:
  - [ ] Session bootstrap and re-attach work.
  - [ ] Binding JSON contains only stable magicBrowserSessionId (no viewer URL, no authToken).
  - [ ] Derived viewer URL is correct on read.
  - [ ] SecretCache holds authToken per binding id.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Create new Magic Browser session and capture derived viewer URL.
    Tool: bun test + magic-browser CLI.
  - Scenario: Inspect binding JSON -> no authToken, no viewer URL field.
    Tool: bun test.

- [ ] 18. Checkpoint / human takeover coexistence

  **What to do**:
  - When Magic Browser session enters waiting-human, pause browser-action publish, keep cursor at last position, surface a "human in control" badge.
  - On resume, continue publishing events.
  - Ensure takeover does not desync session id bindings.

  **Must NOT do**:
  - Do not drop or rewrite in-flight events on resume.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T19, T20
  - **Blocked By**: T6, T10, T12, T16, T17

  **References**:
  - magic-browser/docs/remote-attended-parity-contract.md
  - magic-browser/src/runtime/viewer-server/

  **Acceptance Criteria**:
  - [ ] Pause/resume preserves bindings and event ordering.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Force checkpoint, capture state, resume, capture state.
    Tool: bun test

- [ ] 19. Local managed verification lane

  **What to do**:
  - End-to-end: launch OpenCode in dev runtime with Palot plugin loaded, open a session, attach local browser lane, have the agent call palot_browser_navigate + palot_browser_click + palot_browser_type, verify cursor animation and that the real action occurred.
  - Capture evidence files.

  **Must NOT do**:
  - Do not use remote lane for this lane; keep it local.
  - Do not rely on a generic `palot_browser_action(kind, params)`; use the strict tool schemas.

  **Recommended Agent Profile**:
  - **Category**: unspecified-high

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Final
  - **Blocked By**: T13, T14, T16, T18, T19a

  **References**:
  - apps/desktop/.opencode/plugins/cmux-title-sync.js
  - apps/desktop/src/main/opencode-manager.ts

  **Acceptance Criteria**:
  - [ ] Local lane verification passes.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Full agent run with tool + cursor playback.
    Tool: bun test + Playwright + screenshot.

- [ ] 19a. Browser overlay verification spike (gate for T19/T20)

  **What to do**:
  - Repo has no real desktop/browser test harness today for the browser panel overlay. Before T19/T20 can pass, prove the capture/assertion path.
  - Stand up a minimal headless render of the browser panel with the overlay active in either browser-mode or Electron.
  - Feed a fixture BrowserActionEvent stream and capture a screenshot of the overlay in motion. Assert (a) the cursor element exists at expected coords and (b) the action log shows expected events.
  - Capture the harness in scripts/ and commit it as a reusable helper.

  **Must NOT do**:
  - Do not use a production-only verification path that cannot be re-run in CI.

  **Recommended Agent Profile**:
  - **Category**: deep
  - **Reason**: harness work is unfamiliar to this repo and blocks downstream verification.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T19, T20, Final
  - **Blocked By**: T13, T14

  **References**:
  - apps/desktop/src/renderer/components/side-panel/browser-panel.tsx
  - apps/desktop/src/renderer/components/agent-detail.tsx
  - bun test docs

  **Acceptance Criteria**:
  - [ ] Reusable overlay capture script committed.
  - [ ] At least one successful screenshot of synthetic events captured and committed.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Fixture events -> screenshot -> cursor at expected coords
    Tool: bun run scripts/<new overlay capture script>
    Steps:
      1. Feed fixture events.
      1. Capture screenshot.
      1. Assert cursor at expected coords and action log shows expected events.

- [ ] 20. Remote managed verification lane

  **What to do**:
  - Same as T19 but with a remote-cdp attached surface.
  - Verify drift and zoom handling.

  **Must NOT do**:
  - Do not require DNS / tunnel setup beyond what the magic-browser docs already specify.

  **Recommended Agent Profile**:
  - **Category**: deep

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: Final
  - **Blocked By**: T13, T14, T15, T16, T17, T18

  **References**:
  - magic-browser/docs/remote-cdp-bootstrap.md
  - magic-browser/docs/parity-proof-matrix.md

  **Acceptance Criteria**:
  - [ ] Remote lane verification passes.

  **QA Scenarios (MANDATORY)**:
  - Scenario: Full agent run with tool + cursor playback on remote-cdp.
    Tool: bun test + magic-browser CLI + screenshot.

---

## Final Verification Wave <!-- oc:id=sec_am -->

- [ ] F1. **Plan Compliance Audit** — oracle
  Verify all must-haves exist, all guardrails hold, tool schemas exist, and browser overlay architecture matches plan.

- [ ] F2. **Code Quality Review** — unspecified-high
  Review all changed files for type safety, drift between plugin and Palot state models, duplicated geometry logic, and accidental prompt-only hacks.

- [ ] F3. **Real QA** — unspecified-high
  Execute local managed and remote managed flows end to end, including takeover / resumed action playback.

- [ ] F4. **Scope Fidelity Check** — deep
  Confirm the work delivered browser control + visible cursor playback without overreaching into extension-first or unrelated browser-engine changes.

---

## Commit Strategy

- Group by wave / concern with conventional commits
- Keep plugin, IPC, renderer overlay, and verification slices reviewable

## Success Criteria

### Verification Commands
```bash
# To be filled by executor as concrete commands are implemented
```

### Final Checklist
- [ ] OpenCode plugin loads in configured runtime
- [ ] Session→lane→Magic Browser binding works
- [ ] Tools return usable JSON and perform actions
- [ ] Cursor overlay animates move/click/type/scroll
- [ ] Drift/zoom/scroll handling is acceptable for V1
- [ ] Checkpoint / human takeover does not desync the control model