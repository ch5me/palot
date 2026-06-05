# Palot Browser Lane Virtual Stream <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Replace Palot's local Electron `webview` browser panel with a Hub-style browser-lane subsystem that runs a real browser runtime outside the UI, publishes a same-origin streamed browser surface, and exposes CDP separately for automation.
>
> **Deliverables**:
> - Working local browser lane runtime with persistent profile and same-origin streamed browser in Palot
> - Portable install/start/healthcheck scripts for local and remote Linux hosts
> - Browser lane contract and runtime manager inside Palot desktop app
> - Separate CDP control plane verified against the same visible lane
> - End-to-end proof for local mode and remote attach mode
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: contract/state -> local runtime -> same-origin proxy -> UI swap -> CDP proof -> remote attach -> final verification

---

## Context

### Original Request
Build real virtual browser streaming in Palot now. It must work as a real streamed browser, not an iframe of provider sites and not the current local Electron `webview`. It must support running locally on this machine or remotely on Dell/another Linux host, with scripts that make server-side install/start/healthcheck easy anywhere.

### Interview Summary
**Key Discussions**:
- Current Palot browser panel is implemented but uses local Electron `webview`, so it is not the desired architecture.
- Hub already proves the right pattern: same-origin browser stream surface embedded in UI, with CDP kept separate for automation.
- Local and remote runtime should share one lane contract.
- Browser panel flag was default-false because browser maturity lagged behind surface-shell docs; it has now been turned on in code so the tab is visible during implementation.

**Research Findings**:
- Palot browser panel today uses a local `webview` and browser-mode fallback copy, so it must be replaced rather than extended.
- Hub lane metadata source-of-truth exists in `agent-orchestra/deploy/dell/browser-lanes.json`.
- Hub runtime pattern exists in `agent-orchestra/deploy/dell/chromium/docker-compose.yml`.
- Hub publishing strategy and rationale exist in `agent-orchestra/docs/HUB_BROWSER_STREAMING_TODAY.md` and `agent-orchestra/docs/HUB_BROWSER_LANES.md`.
- Palot workplan already names browser surface replacement as unfinished work.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Explicitly separate stream health from CDP health.
- Lock MVP scope to one local lane plus remote attach support, not full lane fleet orchestration.
- Add concrete failure UX and health states.
- Add same-origin websocket proof, not just HTML-load proof.
- Add profile persistence and restart proof.
- Add host/runtime assumptions as explicit validation tasks.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Ship a working browser-lane subsystem in Palot that can run a real browser runtime outside the UI, stream that browser through a same-origin route into Palot's browser panel, and expose a separate CDP endpoint for automation against the same lane.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- Browser lane shared types and lifecycle contract inside Palot.
- Main-process browser lane manager and runtime adapter layer.
- Docker-backed local LinuxServer Chromium runtime with persistent profiles.
- Remote lane attach mode using same metadata and health model.
- Same-origin stream publishing path inside Palot desktop/browser-mode surfaces.
- New browser panel UI embedding stream surface instead of Electron `webview`.
- Install/start/stop/healthcheck scripts for local and remote Linux runtime setup.
- End-to-end verification proving visible stream and CDP both work on the same lane.

### Definition of Done <!-- oc:id=sec_af -->
- [ ] Local lane can be installed, started, stopped, and restarted through repo-owned scripts.
- [ ] Local lane profile persists across full runtime restart.
- [ ] Palot browser panel renders same-origin stream path, not raw provider URL and not Electron `webview`.
- [ ] CDP connects to same visible lane and can drive navigation while stream updates.
- [ ] Remote lane attach path works with same UI contract and health model.
- [ ] Lint and typecheck pass.
- [ ] Final verification wave approves plan compliance, code quality, QA scenarios, and scope fidelity.

### Must Have <!-- oc:id=sec_ag -->
- Same-origin stream path owned by Palot.
- Separate stream plane and CDP control plane.
- Persistent per-lane profile storage.
- Repo-owned install/start/healthcheck scripts.
- Local proof first, remote proof second.

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- No direct iframe embedding of provider websites.
- No dependence on DOM/script access inside embedded stream surface.
- No coupling of CDP endpoint and stream URL into one primitive.
- No hidden temp browser profiles as runtime truth.
- No ad hoc manual reverse-proxy config as required product setup.
- No full native macOS/Windows browser runtime in MVP; keep adapter seam only.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — all acceptance criteria must be runnable by agent. No “user manually verify” steps.

### Test Decision
- **Infrastructure exists**: YES, project has lint/typecheck and limited test infra.
- **Automated tests**: Tests-after for targeted new logic; do not block MVP on broad desktop test harness expansion.
- **Framework**: Bun tests where feasible for pure modules; lint + typecheck mandatory.
- **Agent-Executed QA**: mandatory for every task.

### QA Policy
Evidence saved under `.sisyphus/evidence/browser-lanes/`.

- **Frontend/UI**: Playwright or agent-browser against browser-mode or Electron-compatible surface where possible.
- **CLI/TUI**: `interactive_bash` for install/start/watch flows that may block.
- **API/Backend**: Bash `curl` against local same-origin lane endpoints and CDP `/json/version`.
- **Library/Module**: Bun tests for lane metadata/state helpers and pure URL/proxy helpers.

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Parallel Execution Waves <!-- oc:id=sec_aj -->

Wave 1 (foundation + contracts):
- Task 1: Browser lane contract/types/state model
- Task 2: Runtime capability audit + local/remote assumptions helper
- Task 3: Script scaffolding for install/start/stop/healthcheck
- Task 4: Verification fixtures/evidence path scaffolding

Wave 2 (local runtime + same-origin plumbing):
- Task 5: Docker Chromium runtime adapter
- Task 6: Main-process lane manager lifecycle + persistence
- Task 7: Same-origin lane publishing/proxy path for desktop and browser-mode
- Task 8: IPC/preload/service seam for browser lanes

Wave 3 (UI + CDP split):
- Task 9: Browser panel replacement from `webview` to lane stream iframe/pane
- Task 10: Stream/CDP split health model + UX states
- Task 11: CDP smoke/automation helpers against same visible lane
- Task 12: Remote lane attach support using same contract

Wave 4 (hardening + proof):
- Task 13: Persistent profile/restart behavior hardening
- Task 14: Broken-runtime and reconnect UX
- Task 15: Local end-to-end proof
- Task 16: Remote attach end-to-end proof

Wave FINAL:
- F1: Plan compliance audit
- F2: Code quality review
- F3: Real QA execution
- F4: Scope fidelity check

Critical Path: 1 -> 5 -> 6 -> 7 -> 9 -> 11 -> 15 -> 16 -> FINAL
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4

### Dependency Matrix <!-- oc:id=sec_ak -->
- **1**: none -> 5, 6, 8, 10
- **2**: none -> 3, 5, 12
- **3**: 2 -> 15, 16
- **4**: none -> 15, 16
- **5**: 1, 2 -> 6, 7, 11, 13
- **6**: 1, 5 -> 8, 10, 12, 13
- **7**: 5 -> 9, 15, 16
- **8**: 1, 6 -> 9, 12
- **9**: 7, 8 -> 10, 15
- **10**: 1, 6, 9 -> 14, 15, 16
- **11**: 5, 7 -> 15, 16
- **12**: 2, 6, 8 -> 16
- **13**: 5, 6 -> 15, 16
- **14**: 10 -> 15, 16
- **15**: 3, 4, 7, 9, 10, 11, 13, 14 -> FINAL
- **16**: 3, 4, 7, 10, 11, 12, 13, 14 -> FINAL

### Agent Dispatch Summary <!-- oc:id=sec_al -->
- **Wave 1**: T1 `quick`, T2 `unspecified-high`, T3 `quick`, T4 `writing`
- **Wave 2**: T5 `unspecified-high`, T6 `deep`, T7 `deep`, T8 `quick`
- **Wave 3**: T9 `visual-engineering`, T10 `deep`, T11 `unspecified-high`, T12 `deep`
- **Wave 4**: T13 `unspecified-high`, T14 `visual-engineering`, T15 `unspecified-high`, T16 `unspecified-high`
- **FINAL**: F1 `deep`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [x] 1. Define browser lane contract and durable state

  **What to do**:
  - Add shared `BrowserLane`, `BrowserLaneRuntime`, `BrowserLaneHealth`, `BrowserLaneMode`, and lane lifecycle types.
  - Define persisted lane record format and XDG storage locations.
  - Add pure helpers for lane IDs, stream paths, health summarization, and profile path metadata.
  - Add focused unit tests for pure helpers if practical.

  **Must NOT do**:
  - Do not bind contract to Docker-only names.
  - Do not make stream URL and CDP endpoint the same field.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded type/domain work with small file set.
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**:
    - `agent-browser`: not needed for pure contract work.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 5, 6, 8, 10
  - **Blocked By**: None

  **References**:
  - `agent-orchestra/deploy/dell/browser-lanes.json` - lane metadata shape to generalize into product contract.
  - `agent-orchestra/docs/HUB_BROWSER_STREAMING_TODAY.md:205` - lane abstraction requirements and suggested interface.
  - `apps/desktop/src/main/automation/paths.ts` - existing XDG storage style inside Palot.
  - `apps/desktop/src/renderer/atoms/browser.ts` - current browser-specific local state that will be partially superseded.

  **Acceptance Criteria**:
  - [ ] Shared lane contract file exists and typechecks.
  - [ ] Stream path and CDP fields are distinct in type model.
  - [ ] Pure helper tests pass if added.

  **QA Scenarios**:
  ```
  Scenario: lane helpers produce stable same-origin paths
    Tool: Bash (bun test or node script)
    Preconditions: contract/helpers implemented
    Steps:
      1. Run helper with lane id "default"
      2. Assert stream path equals "/browser/default/"
      3. Assert CDP endpoint field remains separate/null until runtime fills it
    Expected Result: deterministic path output, no field overloading
    Failure Indicators: stream path malformed, CDP field mirrors stream path, script exits non-zero
    Evidence: .sisyphus/evidence/browser-lanes/task-1-lane-helpers.txt

  Scenario: invalid lane id rejected
    Tool: Bash (bun test or node script)
    Preconditions: validation helper implemented
    Steps:
      1. Pass invalid lane id with spaces/slashes
      2. Assert validation throws or returns structured error
    Expected Result: invalid id not accepted
    Evidence: .sisyphus/evidence/browser-lanes/task-1-invalid-id.txt
  ```

  **Commit**: NO

- [x] 2. Audit runtime assumptions and host capability detection

  **What to do**:
  - Add helper logic to detect Docker presence, compose support, platform, and browser-mode/runtime caveats.
  - Define MVP support matrix explicitly: local Docker-backed runtime first; remote Linux attach/start next; native desktop adapter deferred.
  - Surface capability results for UI and scripts.

  **Must NOT do**:
  - Do not silently assume Docker is available.
  - Do not pretend native macOS/Windows runtime exists in MVP.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: system/runtime probing and support-matrix logic.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 3, 5, 12
  - **Blocked By**: None

  **References**:
  - `agent-orchestra/docs/HUB_BROWSER_STREAMING_TODAY.md:318` - runtime/deploy assumptions.
  - `apps/desktop/src/main/compatibility.ts` - current environment compatibility patterns.
  - `apps/desktop/src/main/find-free-port.ts` - existing local host utility pattern.

  **Acceptance Criteria**:
  - [ ] Capability helper returns structured support state.
  - [ ] Missing Docker path yields explicit actionable status.
  - [ ] MVP support matrix documented in code comments or docs touched by implementation.

  **QA Scenarios**:
  ```
  Scenario: Docker present host reports local runtime supported
    Tool: Bash
    Preconditions: Docker installed on host
    Steps:
      1. Run capability helper command/script
      2. Assert output marks local runtime support true
      3. Assert compose support state is included
    Expected Result: structured support report with no ambiguity
    Evidence: .sisyphus/evidence/browser-lanes/task-2-capability-ok.txt

  Scenario: missing dependency path gives actionable error
    Tool: Bash
    Preconditions: helper supports override/mock for missing docker
    Steps:
      1. Run helper with PATH excluding docker or test shim
      2. Assert report marks unsupported with remediation hint
    Expected Result: no crash, explicit unsupported reason
    Evidence: .sisyphus/evidence/browser-lanes/task-2-capability-missing.txt
  ```

  **Commit**: NO

- [x] 3. Add portable install/start/stop/healthcheck scripts

  **What to do**:
  - Add repo-owned scripts for local install, lane start, lane stop, and healthcheck.
  - Support local execution and remote Linux execution via SSH parameters or host-targeted wrapper.
  - Ensure scripts are idempotent and print stream backend URL, stream path, and CDP endpoint.

  **Must NOT do**:
  - Do not require hand-editing compose files as normal flow.
  - Do not make scripts interactive by default.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded helper-script work.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 15, 16
  - **Blocked By**: 2

  **References**:
  - `agent-orchestra/deploy/dell/deploy-chromium.sh` - repo-owned deploy helper shape.
  - `agent-orchestra/deploy/dell/chromium/docker-compose.yml` - runtime env and ports.
  - `scripts/` patterns already present in repo root if any exist.

  **Acceptance Criteria**:
  - [ ] `install-runtime` creates runtime config/profile storage without manual edits.
  - [ ] `start-lane` brings lane up and prints runtime connection details.
  - [ ] `healthcheck` separately reports stream health and CDP health.

  **QA Scenarios**:
  ```
  Scenario: local install and start succeed end-to-end
    Tool: interactive_bash
    Preconditions: Docker available
    Steps:
      1. Run `scripts/browser-lane/install-runtime --mode local --lane default`
      2. Run `scripts/browser-lane/start-lane --lane default`
      3. Assert output includes stream backend URL and CDP URL
    Expected Result: runtime starts without manual intervention
    Failure Indicators: script prompts unexpectedly, compose errors, missing URLs
    Evidence: .sisyphus/evidence/browser-lanes/task-3-local-install.txt

  Scenario: healthcheck distinguishes stream and CDP failures
    Tool: Bash
    Preconditions: runtime supports stop/degraded states
    Steps:
      1. Run healthcheck with lane stopped or mocked degraded state
      2. Assert stream and CDP are reported as separate checks
    Expected Result: split health output, no single opaque "failed"
    Evidence: .sisyphus/evidence/browser-lanes/task-3-health-split.txt
  ```

  **Commit**: NO

- [x] 4. Scaffold evidence and smoke harness helpers

  **What to do**:
  - Create small helpers or documented commands for capturing stream HTML headers, websocket readiness, and CDP version proof into `.sisyphus/evidence/browser-lanes/`.
  - Keep them reusable for final verification.

  **Must NOT do**:
  - Do not hide proof inside ad hoc shell history only.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: evidence harness and proof scaffolding.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 15, 16
  - **Blocked By**: None

  **References**:
  - `.sisyphus/evidence/` existing patterns in repo.
  - `agent-orchestra/docs/HUB_BROWSER_LANES.md:52` - verification ideas.

  **Acceptance Criteria**:
  - [ ] Evidence directory and capture conventions exist.
  - [ ] Reusable commands/helpers can save proof artifacts for stream and CDP.

  **QA Scenarios**:
  ```
  Scenario: proof helper writes deterministic evidence file
    Tool: Bash
    Preconditions: helper added
    Steps:
      1. Run helper against mock or real local URL
      2. Assert evidence file created under `.sisyphus/evidence/browser-lanes/`
    Expected Result: reproducible artifact path exists
    Evidence: .sisyphus/evidence/browser-lanes/task-4-proof-helper.txt

  Scenario: helper handles unreachable endpoint cleanly
    Tool: Bash
    Preconditions: invalid URL available
    Steps:
      1. Run helper against unreachable endpoint
      2. Assert error evidence captured with exit status noted
    Expected Result: explicit failure artifact, not silent pass
    Evidence: .sisyphus/evidence/browser-lanes/task-4-proof-helper-error.txt
  ```

  **Commit**: NO

- [x] 5. Implement Docker-backed Chromium runtime adapter

  **What to do**:
  - Add Docker runtime adapter that materializes lane-specific compose/env config.
  - Use LinuxServer Chromium runtime pattern with persistent profile volume/path and explicit CDP port.
  - Support lane-specific stream backend URL and CDP URL generation.

  **Must NOT do**:
  - Do not hardcode Dell-only paths.
  - Do not bind runtime contract to one fixed host port globally.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: runtime integration and container orchestration.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 6, 7, 11, 13
  - **Blocked By**: 1, 2

  **References**:
  - `agent-orchestra/deploy/dell/chromium/docker-compose.yml` - canonical current runtime pattern.
  - `agent-orchestra/docs/HUB_BROWSER_STREAMING_TODAY.md:48` - runtime expectations.
  - `apps/desktop/src/main/server-lockfile.ts` - local runtime/state management style.

  **Acceptance Criteria**:
  - [ ] Runtime adapter can generate lane runtime config and start container.
  - [ ] Adapter returns stream backend URL and CDP endpoint separately.
  - [ ] Profile path persists outside container lifecycle.

  **QA Scenarios**:
  ```
  Scenario: runtime adapter starts Chromium lane
    Tool: interactive_bash
    Preconditions: Docker available, adapter wired through script or harness
    Steps:
      1. Start lane through adapter-backed command
      2. Query generated runtime metadata
      3. Assert stream backend URL and CDP URL are both present and distinct
    Expected Result: running lane with separate surfaces
    Evidence: .sisyphus/evidence/browser-lanes/task-5-runtime-start.txt

  Scenario: restart preserves same profile path
    Tool: Bash
    Preconditions: lane started once
    Steps:
      1. Capture profile path/volume
      2. Stop lane and start lane again
      3. Assert same profile location reused
    Expected Result: stable profile binding across restarts
    Evidence: .sisyphus/evidence/browser-lanes/task-5-profile-reuse.txt
  ```

  **Commit**: NO

- [x] 6. Build main-process browser lane manager and persistence

  **What to do**:
  - Add manager responsible for create/start/stop/restart/list/health operations.
  - Persist lane metadata and runtime state in XDG-backed storage.
  - Add split health states: stream ready, CDP ready, degraded, stopped, error.

  **Must NOT do**:
  - Do not let renderer own lane truth.
  - Do not collapse stream/CDP health into one boolean.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: coordination/orchestration logic with failure states.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 8, 10, 12, 13
  - **Blocked By**: 1, 5

  **References**:
  - `apps/desktop/src/main/automation/registry.ts` - manager/state pattern inspiration.
  - `apps/desktop/src/main/automation/scheduler.ts` - lifecycle and persistence style.
  - `agent-orchestra/docs/HUB_BROWSER_STREAMING_TODAY.md:205` - lane abstraction responsibilities.

  **Acceptance Criteria**:
  - [ ] Manager persists lanes and restores them after app restart.
  - [ ] Health model distinguishes stream and CDP states.
  - [ ] Lane listing returns enough metadata for UI and scripts.

  **QA Scenarios**:
  ```
  Scenario: manager restores persisted lane state
    Tool: Bash
    Preconditions: lane created and metadata persisted
    Steps:
      1. Restart app-level manager process or run restore routine
      2. List lanes
      3. Assert created lane is present with previous metadata
    Expected Result: no lost lane records
    Evidence: .sisyphus/evidence/browser-lanes/task-6-restore.txt

  Scenario: degraded health reported when CDP down but stream up
    Tool: Bash
    Preconditions: runtime can simulate CDP failure
    Steps:
      1. Induce CDP failure while stream remains reachable
      2. Query manager health
      3. Assert state marks stream ready and CDP failed/degraded separately
    Expected Result: split degraded state
    Evidence: .sisyphus/evidence/browser-lanes/task-6-degraded-health.txt
  ```

  **Commit**: NO

- [x] 7. Publish same-origin browser lane routes

  **What to do**:
  - Add proxy/publishing layer so Palot serves lane stream under same-origin paths like `/browser/<lane-id>/`.
  - Ensure path-prefix stripping and websocket upgrades work.
  - Provide desktop and browser-mode parity as far as current app architecture permits.

  **Must NOT do**:
  - Do not expose raw backend port URLs as primary UI surface.
  - Do not ship same-origin HTML proof without websocket proof.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: reverse proxy behavior and app architecture seam work.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 9, 15, 16
  - **Blocked By**: 5

  **References**:
  - `agent-orchestra/deploy/dell/deploy-caddy-hub-routes.sh` - prefix-strip route generation concept.
  - `agent-orchestra/docs/HUB_BROWSER_LANES.md:20` - same-origin publishing source of truth.
  - `apps/server/src/index.ts` and route mounting patterns - browser-mode server seam.

  **Acceptance Criteria**:
  - [ ] Same-origin path serves lane stream shell.
  - [ ] Websocket streaming works through proxy path.
  - [ ] Raw backend URL is not used by panel as primary source.

  **QA Scenarios**:
  ```
  Scenario: same-origin stream path loads through Palot route
    Tool: Bash (curl)
    Preconditions: lane running and proxy route mounted
    Steps:
      1. Request `/browser/default/` from Palot-served origin
      2. Assert 200 response and expected stream page markers
    Expected Result: same-origin route resolves successfully
    Evidence: .sisyphus/evidence/browser-lanes/task-7-stream-route.txt

  Scenario: websocket upgrade survives proxy path
    Tool: Bash or targeted smoke helper
    Preconditions: lane running and stream vendor websocket active
    Steps:
      1. Run websocket readiness/proxy smoke against `/browser/default/`
      2. Assert upgrade succeeds or vendor stream remains live after connect
    Expected Result: live stream path, not static shell only
    Evidence: .sisyphus/evidence/browser-lanes/task-7-websocket.txt
  ```

  **Commit**: NO

- [x] 8. Expose browser lane lifecycle through IPC, preload, and renderer service

  **What to do**:
  - Add IPC handlers and preload methods for lane listing, ensure/start/stop/health actions.
  - Add renderer service wrapper following existing backend abstraction patterns.

  **Must NOT do**:
  - Do not call main-process internals directly from renderer.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: seam plumbing across known patterns.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 9, 12
  - **Blocked By**: 1, 6

  **References**:
  - `apps/desktop/src/preload/index.ts` - current IPC exposure style.
  - `apps/desktop/src/preload/api.d.ts` - `window.elf` API typing.
  - `apps/desktop/src/renderer/services/backend.ts` - service wrapper pattern.

  **Acceptance Criteria**:
  - [ ] Renderer can list lanes and query health through supported seam.
  - [ ] Preload typings include new browser lane API.
  - [ ] Typecheck passes across main/preload/renderer.

  **QA Scenarios**:
  ```
  Scenario: renderer service fetches lane list
    Tool: Bash or app smoke harness
    Preconditions: lane manager and IPC wired
    Steps:
      1. Invoke browser lane list through exposed API
      2. Assert lane metadata reaches renderer-safe shape
    Expected Result: no direct main-process dependency leaks
    Evidence: .sisyphus/evidence/browser-lanes/task-8-ipc-list.txt

  Scenario: start/health actions round-trip through preload seam
    Tool: Bash or app smoke harness
    Preconditions: start and health handlers added
    Steps:
      1. Trigger ensure/start action through exposed API
      2. Query health through exposed API
      3. Assert returned health includes split stream/CDP status
    Expected Result: action and read paths both work through seam
    Evidence: .sisyphus/evidence/browser-lanes/task-8-ipc-health.txt
  ```

  **Commit**: NO

- [x] 9. Replace browser panel `webview` with same-origin lane stream surface

  **What to do**:
  - Remove dependence on Electron `webview` as core browser surface.
  - Render same-origin stream path in panel with lane controls/status.
  - Support open/focus, reconnect/restart, current lane state, and profile-aware reset action.

  **Must NOT do**:
  - Do not keep provider browsing in `webview` as fallback primary mode.
  - Do not embed raw backend URL directly.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: significant panel UI and embedded-surface behavior work.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 10, 15
  - **Blocked By**: 7, 8

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx` - current panel to replace.
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx` - surface registration.
  - `agent-orchestra/apps/hub/src/hub-ui.html:1304` - iframe lane embedding precedent.

  **Acceptance Criteria**:
  - [ ] Panel renders same-origin lane stream surface.
  - [ ] Panel no longer relies on `webview` APIs for core browsing.
  - [ ] Panel shows useful lane status and recovery actions.

  **QA Scenarios**:
  ```
  Scenario: browser panel shows live stream in Palot
    Tool: Playwright or agent-browser
    Preconditions: lane running, panel enabled
    Steps:
      1. Open Palot browser panel
      2. Assert embedded frame/pane src points to same-origin `/browser/default/`
      3. Assert visible streamed browser content appears
    Expected Result: live stream rendered inside panel
    Evidence: .sisyphus/evidence/browser-lanes/task-9-panel-live.png

  Scenario: restart/reconnect control recovers blank stream
    Tool: Playwright or agent-browser
    Preconditions: lane briefly stopped or stream disconnected
    Steps:
      1. Simulate stopped lane or disconnect
      2. Use panel reconnect/restart action
      3. Assert stream returns without page hard failure
    Expected Result: operator recovery path works
    Evidence: .sisyphus/evidence/browser-lanes/task-9-reconnect.png
  ```

  **Commit**: NO

- [x] 10. Add split health model and failure UX for stream vs CDP

  **What to do**:
  - Show explicit states for installing, starting, stream-ready/CDP-waiting, stream-failed/CDP-ready, degraded, stopped, and profile-locked.
  - Ensure UI text and state machine do not lie about lane health.

  **Must NOT do**:
  - Do not reduce health to generic spinner + retry.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: state-model and UX truthfulness.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 14, 15, 16
  - **Blocked By**: 1, 6, 9

  **References**:
  - `agent-orchestra/docs/HUB_BROWSER_STREAMING_TODAY.md:65` - stream vs control split.
  - `apps/desktop/src/renderer/components/side-panel/*` other panels for empty/error/loading state patterns.

  **Acceptance Criteria**:
  - [ ] UI distinguishes stream state and CDP state.
  - [ ] Error copy includes actionable next step.
  - [ ] Degraded states are representable without crashing panel.

  **QA Scenarios**:
  ```
  Scenario: stream ready, CDP not ready state is visible
    Tool: Playwright or app smoke harness
    Preconditions: simulated or real staggered startup
    Steps:
      1. Start lane where stream comes up before CDP
      2. Open browser panel
      3. Assert status copy reports stream ready / CDP pending
    Expected Result: honest partial-ready state
    Evidence: .sisyphus/evidence/browser-lanes/task-10-partial-ready.png

  Scenario: profile lock or startup failure shows actionable recovery
    Tool: Playwright or app smoke harness
    Preconditions: forced failure state
    Steps:
      1. Trigger known startup/profile failure
      2. Assert panel shows failure message plus recovery control
    Expected Result: no opaque blank panel
    Evidence: .sisyphus/evidence/browser-lanes/task-10-failure.png
  ```

  **Commit**: NO

- [ ] 11. Add CDP smoke and automation helpers against same visible lane

  **What to do**:
  - Add helper to query CDP `/json/version` and optionally attach Playwright/agent-browser smoke.
  - Prove navigation via CDP is reflected in visible stream.

  **Must NOT do**:
  - Do not use disposable separate browser for CDP proof.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: automation/proof integration.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 15, 16
  - **Blocked By**: 5, 7

  **References**:
  - `agent-orchestra/deploy/dell/cdp-usage-scrape.py` - current CDP connection proof style.
  - `apps/desktop/src/main/index.ts:137` - existing CDP/testing awareness.
  - `agent-browser` CLI usage patterns if available in environment.

  **Acceptance Criteria**:
  - [ ] CDP helper proves endpoint live.
  - [ ] Automation can navigate same lane and stream visibly updates.
  - [ ] Evidence captures both CDP proof and visible result.

  **QA Scenarios**:
  ```
  Scenario: CDP endpoint responds and Playwright attaches
    Tool: Bash / Playwright
    Preconditions: lane running with CDP enabled
    Steps:
      1. Request CDP `/json/version`
      2. Attach Playwright via returned endpoint
      3. Navigate to `https://example.com`
    Expected Result: attach succeeds, navigation completes
    Evidence: .sisyphus/evidence/browser-lanes/task-11-cdp.txt

  Scenario: visible stream reflects CDP-driven navigation
    Tool: Playwright or agent-browser + screenshot
    Preconditions: browser panel open on same lane
    Steps:
      1. Drive lane to `https://example.com` over CDP
      2. Capture panel screenshot
      3. Assert visible page text includes `Example Domain`
    Expected Result: same lane is both controlled and visible
    Evidence: .sisyphus/evidence/browser-lanes/task-11-visible-proof.png
  ```

  **Commit**: NO

- [x] 12. Add remote lane attach mode using same contract

  **What to do**:
  - Support registering/attaching a remote lane runtime with explicit stream backend URL and CDP endpoint.
  - Reuse same lane manager, health model, and panel UI.
  - Support helper-script path for installing remote Linux runtime over SSH or host-local execution.

  **Must NOT do**:
  - Do not special-case Dell into core lane contract.
  - Do not bypass same-origin panel route for remote lanes.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: remote/local abstraction parity.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 16
  - **Blocked By**: 2, 6, 8

  **References**:
  - `agent-orchestra/deploy/dell/browser-lanes.json` - remote lane metadata example.
  - `agent-orchestra/docs/HUB_BROWSER_STREAMING_TODAY.md:324` - remote/runtime abstraction notes.
  - `agent-orchestra/docs/HUB_BROWSER_LANES.md` - remote publication assumptions.

  **Acceptance Criteria**:
  - [ ] Remote lane record can be created without Docker local runtime.
  - [ ] Same panel UI works against remote lane through Palot same-origin route.
  - [ ] Health checks include remote connectivity failures explicitly.

  **QA Scenarios**:
  ```
  Scenario: attach remote lane metadata and query health
    Tool: Bash
    Preconditions: remote lane details available
    Steps:
      1. Register remote lane through supported config/action
      2. Query manager list/health
      3. Assert remote lane appears with stream and CDP endpoints
    Expected Result: remote lane treated as first-class lane
    Evidence: .sisyphus/evidence/browser-lanes/task-12-remote-attach.txt

  Scenario: panel renders remote lane through same-origin path
    Tool: Playwright or agent-browser
    Preconditions: remote lane reachable and proxied
    Steps:
      1. Open Palot browser panel for remote lane
      2. Assert iframe/pane still uses Palot same-origin route
      3. Assert remote lane stream content appears
    Expected Result: remote implementation detail hidden behind same contract
    Evidence: .sisyphus/evidence/browser-lanes/task-12-remote-panel.png
  ```

  **Commit**: NO

- [x] 13. Harden profile persistence and restart semantics

  **What to do**:
  - Ensure lane restarts reuse same profile.
  - Handle image/profile drift and stale lock cases as explicitly as possible.
  - Add reset-profile flow that is deliberate and visible.

  **Must NOT do**:
  - Do not silently wipe profiles.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: runtime persistence edge-case handling.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 15, 16
  - **Blocked By**: 5, 6

  **References**:
  - `agent-orchestra/deploy/dell/chromium/docker-compose.yml:15` - persistent profile volume precedent.
  - `agent-orchestra/docs/HUB_BROWSER_STREAMING_TODAY.md:182` - per-account isolation value.

  **Acceptance Criteria**:
  - [ ] Full runtime restart preserves profile.
  - [ ] Reset-profile action is explicit and separately verified.
  - [ ] Lock/degraded states do not masquerade as clean start.

  **QA Scenarios**:
  ```
  Scenario: login/session survives restart
    Tool: interactive_bash + browser smoke
    Preconditions: lane has visible session state or equivalent persisted marker
    Steps:
      1. Start lane and create persistent browsing state
      2. Stop runtime fully
      3. Start runtime again
      4. Assert persisted state remains
    Expected Result: profile continuity proven
    Evidence: .sisyphus/evidence/browser-lanes/task-13-profile-persist.txt

  Scenario: reset-profile creates clean lane state only when requested
    Tool: Bash + browser smoke
    Preconditions: persisted lane exists
    Steps:
      1. Trigger explicit reset-profile action
      2. Restart lane
      3. Assert prior persisted marker/session gone
    Expected Result: destructive action deliberate and effective
    Evidence: .sisyphus/evidence/browser-lanes/task-13-profile-reset.txt
  ```

  **Commit**: NO

- [x] 14. Add broken-runtime, reconnect, and stale-route UX

  **What to do**:
  - Cover blank stream, backend dead, websocket dead, stale route, and CDP-only alive states.
  - Provide reconnect/restart/open diagnostics actions.

  **Must NOT do**:
  - Do not leave blank iframe as only signal.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UX/state presentation hardening.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 15, 16
  - **Blocked By**: 10

  **References**:
  - `docs/firefly-desktop-merge-workplan.md:89` - shell/runtime proof expectations.
  - `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx` current failure handling baseline.

  **Acceptance Criteria**:
  - [ ] Blank/dead runtime states show recovery UX.
  - [ ] Reconnect/restart actions are accessible in panel.
  - [ ] Stale route/backend mismatch produces actionable state.

  **QA Scenarios**:
  ```
  Scenario: dead backend shows recovery controls
    Tool: Playwright or app smoke harness
    Preconditions: lane stopped while panel open
    Steps:
      1. Stop lane backend
      2. Observe panel state
      3. Assert restart/reconnect controls and clear error copy appear
    Expected Result: actionable dead-backend UX
    Evidence: .sisyphus/evidence/browser-lanes/task-14-dead-backend.png

  Scenario: stale route recovers after restart
    Tool: Playwright or app smoke harness
    Preconditions: route or backend cycled
    Steps:
      1. Trigger stale route/dead websocket state
      2. Use recovery action
      3. Assert live stream returns
    Expected Result: recoverable operator workflow
    Evidence: .sisyphus/evidence/browser-lanes/task-14-stale-route.png
  ```

  **Commit**: NO

- [x] 15. Prove local end-to-end browser lane flow

  **What to do**:
  - Run full local install/start/proxy/panel/CDP flow.
  - Capture durable evidence for stream, same-origin route, visible panel, CDP attach, and profile persistence.

  **Must NOT do**:
  - Do not stop at typecheck-only proof.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: integrated systems proof.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential in Wave 4
  - **Blocks**: FINAL
  - **Blocked By**: 3, 4, 7, 9, 10, 11, 13, 14

  **References**:
  - All prior local tasks.
  - `agent-orchestra/docs/HUB_BROWSER_LANES.md:52` - verification shape to mirror.

  **Acceptance Criteria**:
  - [ ] Local lane install succeeds through script.
  - [ ] Same-origin route returns live stream.
  - [ ] Panel displays live stream.
  - [ ] CDP attaches to same lane and changes visible page.
  - [ ] Profile persists across restart.

  **QA Scenarios**:
  ```
  Scenario: full local lane happy path
    Tool: interactive_bash + Playwright/agent-browser
    Preconditions: implementation complete, Docker available
    Steps:
      1. Run local install/start scripts for lane `default`
      2. Request Palot same-origin `/browser/default/` route and assert 200
      3. Open Palot browser panel and assert live stream visible
      4. Attach to CDP and navigate to `https://example.com`
      5. Assert panel visibly updates to `Example Domain`
    Expected Result: full visible + controllable local lane working
    Evidence: .sisyphus/evidence/browser-lanes/task-15-local-e2e.txt

  Scenario: local restart retains profile
    Tool: interactive_bash + browser smoke
    Preconditions: local lane with persisted marker/session
    Steps:
      1. Stop lane completely
      2. Start lane again
      3. Assert previous persisted marker/session still present
    Expected Result: persistence proven in integrated path
    Evidence: .sisyphus/evidence/browser-lanes/task-15-local-restart.txt
  ```

  **Commit**: NO

- [x] 16. Prove remote attach end-to-end flow

  **What to do**:
  - Install or attach remote Linux runtime using repo-owned script/helper.
  - Proxy remote stream into Palot same-origin route.
  - Verify panel render and CDP attach against remote lane.

  **Must NOT do**:
  - Do not count raw remote backend URL in browser as sufficient product proof.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: integrated remote proof.
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential in Wave 4
  - **Blocks**: FINAL
  - **Blocked By**: 3, 4, 7, 10, 11, 12, 13, 14

  **References**:
  - `agent-orchestra/docs/HUB_BROWSER_STREAMING_TODAY.md` remote pattern.
  - `agent-orchestra/docs/HUB_BROWSER_LANES.md` route/publication proof shape.

  **Acceptance Criteria**:
  - [ ] Remote runtime can be installed or attached through supported helper flow.
  - [ ] Palot proxies remote lane through same-origin route.
  - [ ] Panel renders remote lane content.
  - [ ] CDP connects to same remote lane and visible stream updates.

  **QA Scenarios**:
  ```
  Scenario: remote lane attach happy path
    Tool: interactive_bash + Playwright/agent-browser
    Preconditions: reachable remote Linux host or Dell lane target
    Steps:
      1. Run remote install/attach helper for lane `remote-default`
      2. Assert manager reports remote lane healthy
      3. Open Palot panel and assert live remote stream visible through same-origin route
      4. Attach to remote lane CDP and navigate to `https://example.com`
      5. Assert visible stream updates accordingly
    Expected Result: remote lane behaves like local lane from UI perspective
    Evidence: .sisyphus/evidence/browser-lanes/task-16-remote-e2e.txt

  Scenario: remote connectivity failure shows degraded-but-safe behavior
    Tool: Bash + panel smoke
    Preconditions: remote lane registered
    Steps:
      1. Make remote host unreachable or point to invalid endpoint
      2. Query health and open panel
      3. Assert degraded remote state and actionable copy appear
    Expected Result: remote failure explicit, no silent blank panel
    Evidence: .sisyphus/evidence/browser-lanes/task-16-remote-failure.txt
  ```

  **Commit**: NO

---

## Final Verification Wave <!-- oc:id=sec_am -->

- [x] F1. **Plan Compliance Audit** — `deep`
  Read plan and changed files. Verify browser lane subsystem exists, `webview` is no longer core browser primitive, same-origin route exists, scripts exist, and evidence files exist for local/remote + CDP split.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run lint and typecheck. Review changed files for AI slop, dead code, hardcoded Dell-only values, stream/CDP conflation, and missing failure-state handling.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Types [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real QA Execution** — `unspecified-high`
  Execute all task QA scenarios, especially same-origin websocket proof, panel live stream proof, CDP visible-lane proof, and profile persistence proof. Save artifacts to `.sisyphus/evidence/browser-lanes/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  Confirm MVP includes one local lane + remote attach support, scripts, same-origin stream, separate CDP plane, and proof. Reject if work expands into native desktop lane runtime or broader browser workflow/product domains outside scope.
  Output: `Tasks [N/N compliant] | Scope Creep [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- Keep feature work grouped by slice:
  - contracts/state
  - runtime/scripts
  - proxy/IPC
  - UI/health
  - proof/hardening
- Use conventional messages, e.g.:
  - `feat(browser-lanes): add shared lane contract and manager`
  - `feat(browser-lanes): add docker runtime and scripts`
  - `feat(browser-panel): replace webview with same-origin lane surface`
  - `test(browser-lanes): add end-to-end health and CDP proof`

---

## Success Criteria <!-- oc:id=sec_an -->

### Verification Commands <!-- oc:id=sec_ao -->
```bash
bun run lint
bun run check-types
scripts/browser-lane/healthcheck --lane default
```

### Final Checklist <!-- oc:id=sec_ap -->
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] Local lane install/start/proxy/panel/CDP proof captured
- [x] Remote attach/proxy/panel/CDP proof captured
- [x] Lint passes
- [x] Typecheck passes
