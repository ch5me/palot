# Session Sync Audit Remediation <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->
> **Quick Summary**: Rebuild PALOT's session synchronization around a single reconciled session graph that merges OpenCode server truth, live SSE activity, local client/process presence, and message/part activity into one consistent model.
>
> **Deliverables**:
> - Unified session-state contract and freshness model across client + server
> - Full-session reconciliation pipeline for discovery, reconnect, and live updates
> - Reliable active/recent/spinning session surfacing for all relevant local sessions
> - Timestamp/activity semantics based on real message/part/session events
> - Observability, debug tooling, and regression coverage for sync failures
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: state contract -> reconciliation pipeline -> UI derivation -> observability + verification

---

## Context

### Original Request
Plan out everything needed to keep PALOT and OpenCode session/client state totally in sync and fill all gaps/smells.

### Interview Summary
**Key Discussions**:
- PALOT currently shows a disconnect between what the client displays and what the local OpenCode server/runtime is doing.
- Running OpenCode sessions are not consistently surfacing as active/recent/spinning in the PALOT client.
- Session/message activity is not consistently updating session timestamps or derived UI state.
- The user wants a comprehensive remediation plan, not a narrow bugfix.

**Research Findings**:
- Discovery only preloads a narrow focused subset of projects and sessions, so many valid sessions never enter the renderer store.
- Attached-session presence is tracked independently from session list hydration, so a session can be known as locally attached but still absent from the sidebar/session graph.
- `session.time.updated` can lag behind message/part activity, making recency ordering stale.
- SSE reconnect logic can drop buffered events and does not perform a full reconciliation pass.
- Streaming flush depends on `session.status idle` handling, while related semantics may also travel through other event paths.
- Child-task/sub-agent liveness can diverge from parent task-card status.

### Metis Review
**Identified Gaps** (addressed):
- Need explicit guardrails separating canonical state fixes from unrelated product/UI redesign.
- Need acceptance criteria that verify both correctness and resilience after reconnects, stale sessions, and background activity.
- Need rollout/observability work, not only code-path fixes.
- Need explicit invariants for timestamps, active-session visibility, and reconciliation behavior.
- Need clear distinction between SDK/session semantics (`session.status`, `session.idle`, `parentID`, children) and PALOT UI-only derived states.
- Need explicit handling for sessions that are live in OpenCode but absent from discovery preload or process-presence assumptions.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Make PALOT session state trustworthy by ensuring the renderer always converges on accurate OpenCode session truth, including active local sessions, fresh activity timestamps, child-session state, and reconnect recovery.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- Unified session synchronization design covering process presence, server APIs, SSE events, and renderer state.
- Reconciled session hydration flow for startup, discovery, reconnect, and background activity.
- Improved local-active-session detection beyond narrow `opencode attach` assumptions.
- Fresh activity/timestamp derivation tied to real message/part/session updates.
- Sidebar, command palette, tray, and related surfaces reading from the same coherent session model.
- Session-sync observability: diagnostics, logging, counters, drift detection, and operator tooling.
- Regression coverage for reconnect gaps, stale timestamps, hidden active sessions, and task/child divergence.

### Definition of Done <!-- oc:id=sec_af -->
- [ ] Any locally running OpenCode session that PALOT considers in-scope appears in the client without needing manual navigation or lucky preload timing.
- [ ] Active/recent ordering reflects real latest activity, not stale `session.time.updated` alone.
- [ ] SSE reconnect and startup perform deterministic reconciliation that converges the client store to current server truth.
- [ ] Child-session/task status cannot silently diverge from actual child session liveness without emitting diagnostics.
- [ ] Operator tooling can explain why a given session is or is not visible/active in PALOT.
- [ ] Unknown live events (`session.status`, `permission.asked`, `question.asked`, message activity) never disappear silently because the session row was not pre-hydrated.
- [ ] `session.idle` and `session.status idle` paths both converge the renderer to the same final flushed state.
- [ ] Sandbox/worktree session grouping stays correct after runtime changes, not only initial discovery.
- [ ] Electron and browser runtimes use equivalent active-session discovery semantics.

### Must Have <!-- oc:id=sec_ag -->
- Canonical invariants for visibility, activity, attachment, freshness, and hierarchy.
- One source-of-truth derivation path for session lists and badges across sidebar/tray/command palette.
- Recovery behavior after SSE loss, HMR, server restart, and partial event loss.
- Strong observability and explicit stale/drift detection.
- Explicit reconciliation between OpenCode SDK semantics (`SessionStatus`, `session.idle`, `parentID`, children) and PALOT-derived states (`running`, `waiting`, `recent`, `active`).

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- No unrelated redesign of browser lane, PDF review, or side-panel product surfaces.
- No papering over sync bugs with cosmetic UI-only fixes.
- No silent heuristic-only state without diagnostics and traceability.
- No dependence on a single narrow presence signal like only `opencode attach` processes.
- No acceptance criteria that rely on human guesswork instead of agent-executable checks.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: Partial
- **Automated tests**: Tests-after
- **Framework**: existing Bun/tsgo tests where applicable, plus repo-local helper assertions
- **Agent-Executed QA**: mandatory for all tasks

### QA Policy
Every task below includes concrete agent-executed QA scenarios. Evidence stored under `.sisyphus/evidence/session-sync/`.

- **CLI / runtime inspection**: Bash + helper scripts (`bun run debug:sessions`, service status, SQLite reads)
- **Client state proof**: browser/dev surface checks via existing local app surfaces and structured evidence capture
- **API / event flow**: direct server requests and deterministic reconnection scenarios
- **Library/module**: targeted tests or scripted assertions

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Parallel Execution Waves <!-- oc:id=sec_aj -->

Wave 1 (State contract + observability foundation):
- Task 1: Define canonical session sync invariants and scope boundaries
- Task 2: Map every session-state source and freshness signal
- Task 3: Design timestamp/activity model replacing stale `session.time.updated` reliance
- Task 4: Add sync diagnostics model and drift vocabulary
- Task 5: Expand operator debug tooling for session visibility and freshness analysis

Wave 2 (Hydration + reconciliation core):
- Task 6: Redesign startup/discovery hydration so active sessions cannot be skipped by preload limits
- Task 7: Redesign local-active-session presence detection beyond attach-only assumptions
- Task 8: Add full reconciliation pass after SSE connect/reconnect/server switch
- Task 9: Fix event batching/flush semantics for idle, buffered parts, and stale-loop disposal
- Task 10: Define child-session/task reconciliation contract

Wave 3 (Renderer derivation + product surfaces):
- Task 11: Refactor renderer session store around reconciled freshness fields
- Task 12: Refactor sidebar Active/Recent/PM derivation to use canonical session graph
- Task 13: Refactor command palette and tray session surfacing to share the same model
- Task 14: Add explicit session visibility reasons and stale-state indicators in debug surfaces
- Task 15: Add resilience for HMR/base-client/project-client recovery paths

Wave 4 (Verification + rollout):
- Task 16: Add regression tests and scripted fixtures for missed active sessions
- Task 17: Add regression tests and scripted fixtures for reconnect/event-loss drift
- Task 18: Add regression tests and scripted fixtures for child/session timeout divergence
- Task 19: Rollout plan, migration safeguards, and failure fallback behavior
- Task 20: Documentation, runbook updates, and team debugging workflow hardening

Wave FINAL:
- F1: Plan compliance audit
- F2: Code quality review
- F3: Real QA execution across live/reconnect scenarios
- F4: Scope fidelity check

### Dependency Matrix <!-- oc:id=sec_ak -->
- **1**: — -> 6, 7, 8, 10
- **2**: — -> 6, 7, 8, 9, 11, 12, 13
- **3**: — -> 11, 12, 13, 16, 17
- **4**: — -> 5, 14, 19, 20
- **5**: 4 -> 16, 17, 18, 20
- **6**: 1, 2 -> 11, 12, 13, 15
- **7**: 1, 2 -> 11, 12, 13, 16
- **8**: 1, 2 -> 9, 11, 15, 17
- **9**: 2, 8 -> 11, 17
- **10**: 1, 2 -> 11, 14, 18
- **11**: 2, 3, 6, 7, 8, 9, 10 -> 12, 13, 14, 16, 17, 18
- **12**: 2, 3, 6, 7, 11 -> 16, 19
- **13**: 2, 3, 6, 7, 11 -> 16, 19
- **14**: 4, 10, 11 -> 18, 20
- **15**: 6, 8 -> 17, 19
- **16**: 3, 5, 7, 11, 12, 13 -> F1-F4
- **17**: 3, 5, 8, 9, 11, 15 -> F1-F4
- **18**: 5, 10, 11, 14 -> F1-F4
- **19**: 4, 12, 13, 15 -> F1-F4
- **20**: 4, 5, 14 -> F1-F4

### Agent Dispatch Summary <!-- oc:id=sec_al -->
- **Wave 1**: T1 `deep`, T2 `unspecified-high`, T3 `deep`, T4 `writing`, T5 `quick`
- **Wave 2**: T6 `deep`, T7 `unspecified-high`, T8 `deep`, T9 `unspecified-high`, T10 `deep`
- **Wave 3**: T11 `deep`, T12 `visual-engineering`, T13 `unspecified-high`, T14 `visual-engineering`, T15 `quick`
- **Wave 4**: T16 `unspecified-high`, T17 `unspecified-high`, T18 `deep`, T19 `writing`, T20 `writing`
- **Final**: F1 `deep`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

> **Junior Executor Rules**
> 1. Do tasks in order unless a task explicitly says it can run in parallel.
> 2. For every task, create the named artifact or code change first, then run the listed QA scenarios before marking it done.
> 3. Never change two layers at once without first writing down the invariant you are protecting.
> 4. If a live event arrives for a session that is missing from the store, treat that as a bug immediately — do not "wait and see."
> 5. If Electron mode and browser/server mode disagree on active sessions, stop and fix parity before adding more heuristics.
> 6. If a timestamp or active/recent list looks wrong, compare against message/part activity, not only `session.time.updated`.
> 7. Any reconnect fix is incomplete until you prove post-disconnect reconciliation with evidence.
> 8. Any child-task fix is incomplete until you prove parent and child state stay aligned under timeout, waiting, and recovery cases.

> **Implementation Order Cheat Sheet**
> - First fix the contract: Tasks 1-4
> - Then fix operator visibility: Task 5
> - Then fix hydration/presence/reconnect core: Tasks 6-10
> - Then fix renderer and UI derivation: Tasks 11-15
> - Then add proof, rollout, and docs: Tasks 16-20

- [x] 1. Define canonical session sync invariants and scope boundaries

  **Junior summary**:
  - Write down the rules first.
  - Decide what PALOT must always get right before touching code.
  - If this step is vague, every later step will be messy.

  **What to do**:
  - Write the explicit invariants PALOT must maintain: visibility, freshness, active-state, child-session linkage, attachment, and reconciliation guarantees.
  - Define which local OpenCode sessions are considered in-scope for surfacing and which are intentionally excluded.
  - Document failure-state semantics: stale, missing, orphaned, detached, waiting, retrying, invisible-but-running.

  **Must NOT do**:
  - Do not jump to implementation before invariants are explicit.
  - Do not redefine product scope beyond session synchronization.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires architectural clarity and exact invariants across multiple state sources.
  - **Skills**: [`opencode-session-internals`]
    - `opencode-session-internals`: aligns plan with real OpenCode session semantics.
  - **Skills Evaluated but Omitted**:
    - `opencode-plugin-tools`: not needed yet because this task is contract design, not tool implementation.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 6, 7, 8, 10
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/lib/types.ts:94` - PALOT-side `AgentStatus` and session-facing types that need stronger semantics.
  - `apps/desktop/src/renderer/atoms/derived/agents.ts:67` - current status derivation is too narrow and should be the baseline for new invariants.
  - `docs/session-debugging.md:1` - current debugging vocabulary and operator-facing interpretation.

  **Acceptance Criteria**:
  - [ ] Canonical invariant list exists in a durable repo doc or plan-linked design note.
  - [ ] Invariants explicitly define source-of-truth precedence for server API, SSE, local process presence, and DB/debug evidence.

  **QA Scenarios**:
  ```text
  Scenario: Invariant review artifact is complete
    Tool: Bash
    Preconditions: Task design artifact written
    Steps:
      1. Read the artifact and assert it names visibility, freshness, attachment, child-session linkage, reconnect recovery, and exclusion rules.
      2. Assert each invariant names a concrete source of truth or precedence rule.
    Expected Result: No major sync domain is missing.
    Failure Indicators: Missing freshness definition, missing child-session rule, or no source precedence.
    Evidence: .sisyphus/evidence/session-sync/task-1-invariants.md

  Scenario: Scope boundaries reject unrelated surfaces
    Tool: Bash
    Preconditions: Artifact written
    Steps:
      1. Search artifact for unrelated product work items.
      2. Verify browser-lane/PDF items only appear when directly tied to session-sync symptoms.
    Expected Result: Scope remains tightly on session synchronization.
    Evidence: .sisyphus/evidence/session-sync/task-1-scope-check.md
  ```

  **Commit**: NO

- [x] 2. Map every session-state source and freshness signal

  **What to do**:
  - Enumerate all session state inputs: project/session list APIs, `session.status`, `session.idle`, `session.updated`, `message.updated`, `message.part.updated`, `message.part.delta`, process presence, attach streams, and any child-task metadata.
  - Explicitly call out which events can arrive before a session row exists, and which current code paths drop them.
  - Explicitly map sandbox/worktree freshness inputs and how they refresh after initial discovery.
  - Build an end-to-end source map with exact owners, update cadence, and known blind spots.
  - Mark whether each source is authoritative, advisory, or debug-only.

  **Must NOT do**:
  - Do not leave any state source implicit or “understood.”

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Broad code-tracing task across many modules.
  - **Skills**: [`opencode-session-internals`]
    - `opencode-session-internals`: helps distinguish DB/runtime/session semantics correctly.
  - **Skills Evaluated but Omitted**:
    - `review-work`: this is discovery, not review orchestration.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 6, 7, 8, 9, 11, 12, 13
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/services/connection-manager.ts:312` - project session loading and status bootstrap.
  - `apps/desktop/src/renderer/hooks/use-discovery.ts:167` - discovery preload/focus logic.
  - `apps/desktop/src/main/opencode-manager.ts:339` - local process presence detection.
  - `apps/desktop/src/renderer/services/backend.ts:83` - active-session presence snapshot shape.

  **Acceptance Criteria**:
  - [ ] Complete source map exists with owner, cadence, consumer, and failure mode columns.
  - [ ] Every visible PALOT session surface can be traced back to its input sources.

  **QA Scenarios**:
  ```text
  Scenario: Source map covers all session surfaces
    Tool: Bash
    Preconditions: Source map artifact written
    Steps:
      1. Check the map includes sidebar, command palette, tray, session view, attached-session presence, and child-task cards.
      2. Verify each surface lists its backing state source(s).
    Expected Result: No user-visible session surface is unaccounted for.
    Evidence: .sisyphus/evidence/session-sync/task-2-source-map.md

  Scenario: Freshness signals are classified
    Tool: Bash
    Preconditions: Source map artifact written
    Steps:
      1. Verify the map labels `session.time.updated`, message timestamps, part timestamps, and process presence heartbeat separately.
      2. Confirm each signal is marked authoritative/advisory/debug-only.
    Expected Result: Freshness ambiguity is removed.
    Evidence: .sisyphus/evidence/session-sync/task-2-freshness-map.md
  ```

  **Commit**: NO

- [x] 3. Design timestamp/activity model replacing stale `session.time.updated` reliance

  **What to do**:
  - Define a canonical `lastActivityAt` model derived from the freshest reliable session signal.
  - Decide precedence between session-level timestamps, message-level completion, part-level updates, and presence heartbeats.
  - Plan how this model is computed, cached, surfaced, and debugged.

  **Must NOT do**:
  - Do not continue using raw `session.time.updated` as the only recency input.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Timestamp semantics affect every ordering and freshness rule.
  - **Skills**: [`opencode-session-internals`]
    - `opencode-session-internals`: grounds the design in actual OpenCode session/message semantics.
  - **Skills Evaluated but Omitted**:
    - `opencode-session-queries`: useful for proof, but design itself does not depend on that skill.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 11, 12, 13, 16, 17
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/atoms/derived/agents.ts:359` - current `lastActiveAt` derivation.
  - `apps/desktop/src/renderer/components/sidebar.tsx:201` - recent-session ordering depends on `lastActiveAt`.
  - `apps/desktop/src/renderer/hooks/use-discovery.ts:45` - focused-project preload ordering also depends on stale project times.

  **Acceptance Criteria**:
  - [ ] Canonical timestamp precedence is defined and testable.
  - [ ] Design explains how activity updates propagate without O(n) rescans on every event.

  **QA Scenarios**:
  ```text
  Scenario: Timestamp precedence handles stale session rows
    Tool: Bash
    Preconditions: Design artifact written
    Steps:
      1. Verify the artifact includes a case where `session.time.updated` lags message/part activity.
      2. Confirm the canonical `lastActivityAt` still advances correctly.
    Expected Result: Stale session rows no longer dominate recency.
    Evidence: .sisyphus/evidence/session-sync/task-3-precedence.md

  Scenario: Heartbeat vs content activity rule is explicit
    Tool: Bash
    Preconditions: Artifact written
    Steps:
      1. Verify the design distinguishes “alive locally” from “new content activity.”
      2. Confirm ordering rules do not incorrectly bump recent sessions solely from attach heartbeat unless intended.
    Expected Result: Presence and content freshness are separated cleanly.
    Evidence: .sisyphus/evidence/session-sync/task-3-heartbeat-rule.md
  ```

  **Commit**: NO

- [x] 4. Add sync diagnostics model and drift vocabulary

  **What to do**:
  - Define the explicit drift classes PALOT must detect: invisible-running, stale-recency, missing-child, dropped-reconnect, pending-tool-vs-dead-child, attached-but-unhydrated.
  - Define what metadata and logs each drift class must emit.
  - Plan one stable diagnostic object or trace model usable by scripts and UI.

  **Must NOT do**:
  - Do not rely on free-form logs alone.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: This is a diagnostics taxonomy and operator-contract task.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `release-notes`: wrong domain.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 5, 14, 19, 20
  - **Blocked By**: None

  **References**:
  - `docs/session-debugging.md:1` - existing operator language to extend.
  - `scripts/debug-sessions.ts` - current local debug output surface to align with the new vocabulary.

  **Acceptance Criteria**:
  - [ ] Drift classes and required metadata are documented.
  - [ ] Diagnostics model can represent both runtime and persisted-state mismatches.

  **QA Scenarios**:
  ```text
  Scenario: Drift classes cover observed bugs
    Tool: Bash
    Preconditions: Diagnostics artifact written
    Steps:
      1. Match known issues against defined drift classes.
      2. Verify each known issue lands in exactly one primary class plus optional secondary context.
    Expected Result: No observed sync bug is “miscellaneous.”
    Evidence: .sisyphus/evidence/session-sync/task-4-drift-coverage.md

  Scenario: Diagnostic schema is script-friendly
    Tool: Bash
    Preconditions: Schema drafted
    Steps:
      1. Inspect schema fields.
      2. Confirm scripts and UI can consume them without parsing prose.
    Expected Result: Structured diagnostics shape exists.
    Evidence: .sisyphus/evidence/session-sync/task-4-schema-check.md
  ```

  **Commit**: NO

- [ ] 5. Expand operator debug tooling for session visibility and freshness analysis

  **What to do**:
  - Extend current debug helper family so operators can explain why a session is hidden, stale, attached-only, or child-divergent.
  - Add tooling for comparing session DB/message freshness versus renderer/API-visible state.
  - Ensure docs/commands cover the common audit flows.

  **Must NOT do**:
  - Do not create throwaway scripts without durable documentation.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused helper/doc expansion with tight scope.
  - **Skills**: [`opencode-session-internals`]
    - `opencode-session-internals`: helps keep helper semantics aligned with OpenCode internals.
  - **Skills Evaluated but Omitted**:
    - `opencode-plugin-tools`: use only if helpers must become in-app tools later.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 16, 17, 18, 20
  - **Blocked By**: 4

  **References**:
  - `scripts/debug-sessions.ts` - current helper baseline.
  - `docs/session-debugging.md` - current runbook baseline.
  - `AGENTS.md` - command + runbook discovery surface.

  **Acceptance Criteria**:
  - [ ] Helper suite can answer “why isn’t this session showing up?” without manual SQL surgery.
  - [ ] Runbook includes startup, reconnect, hidden-active-session, and stale-timestamp audits.

  **QA Scenarios**:
  ```text
  Scenario: Hidden session explanation works
    Tool: Bash
    Preconditions: Helper updates implemented
    Steps:
      1. Run helper against a session known to be attached/running but not preloaded.
      2. Verify output names the missing hydration/discovery reason.
    Expected Result: Operator gets a concrete explanation, not just raw rows.
    Evidence: .sisyphus/evidence/session-sync/task-5-hidden-session.md

  Scenario: Freshness comparison works
    Tool: Bash
    Preconditions: Helper updates implemented
    Steps:
      1. Run helper on a session with stale `session.time.updated` but newer message/part activity.
      2. Verify output highlights the drift and canonical freshness value.
    Expected Result: Timestamp drift is obvious and actionable.
    Evidence: .sisyphus/evidence/session-sync/task-5-freshness.md
  ```

  **Commit**: YES
  - Message: `chore(session-sync): improve debug tooling`
  - Files: `scripts/`, `docs/`, `AGENTS.md`
  - Pre-commit: `bun run lint`

- [ ] 6. Redesign startup/discovery hydration so active sessions cannot be skipped by preload limits

  **Junior summary**:
  - Startup must always load sessions that are actively running, even if their projects were not in the top preload set.
  - Do not solve this by "load more stuff" blindly.
  - Build an explicit bootstrap list of sessions/projects that must be hydrated.

  **What to do**:
  - Replace or augment focused-project preload so active/running sessions are always hydrated, even outside the top-N recent projects.
  - Define an explicit “session graph bootstrap” that unions focused projects, active local sessions, currently attached sessions, and directly requested sessions.
  - Remove dependence on lucky preload timing for visibility.

  **Must NOT do**:
  - Do not solve missed sessions only by increasing preload counts blindly.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: This changes the core discovery and hydration contract.
  - **Skills**: [`opencode-session-internals`]
    - `opencode-session-internals`: ensures bootstrap logic respects session/root semantics and DB modes.
  - **Skills Evaluated but Omitted**:
    - `brainstorming`: architecture needs concrete repo-grounded fixes, not ideation.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 11, 12, 13, 15
  - **Blocked By**: 1, 2

  **References**:
  - `apps/desktop/src/renderer/hooks/use-discovery.ts:42` - current focused-project selection and preload limits.
  - `apps/desktop/src/renderer/services/connection-manager.ts:312` - project session loading path.
  - `apps/desktop/src/renderer/atoms/sessions.ts:340` - bulk hydration atom behavior.

  **Acceptance Criteria**:
  - [ ] Startup hydration contract explicitly includes active sessions even when their projects are not in the top focused preload set.
  - [ ] Session visibility no longer depends on manual navigation to the owning project.

  **QA Scenarios**:
  ```text
  Scenario: Active session outside focused project still hydrates
    Tool: Bash
    Preconditions: One local OpenCode session belongs to a non-top-focused project.
    Steps:
      1. Start PALOT with that session running.
      2. Capture hydrated session store or debug output.
      3. Verify the session appears without expanding/navigating to its project.
    Expected Result: Active session is present on first meaningful load.
    Failure Indicators: Session only appears after manual project visit.
    Evidence: .sisyphus/evidence/session-sync/task-6-hydration.md

  Scenario: Preload bounds remain controlled
    Tool: Bash
    Preconditions: New bootstrap implemented
    Steps:
      1. Measure how many projects/sessions are hydrated at startup.
      2. Confirm the contract targets active sessions specifically rather than loading the world.
    Expected Result: Visibility improves without uncontrolled preload explosion.
    Evidence: .sisyphus/evidence/session-sync/task-6-bounds.md
  ```

  **Commit**: NO

- [ ] 7. Redesign local-active-session presence detection beyond attach-only assumptions

  **What to do**:
  - Audit all ways a session can be locally running even without a matching `opencode attach` process.
  - Unify Electron and browser/server active-session discovery semantics so the same local runtime produces the same PALOT-visible active sessions in both modes.
  - Add broader local presence signals or server-side active-session enumeration that does not depend only on attach-client process scanning.
  - Define how presence confidence and source attribution are represented.

  **Must NOT do**:
  - Do not keep “attach process exists” as the only signal for local activity.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires process/runtime/server understanding with practical implementation tradeoffs.
  - **Skills**: [`opencode-session-internals`]
    - `opencode-session-internals`: important for understanding channel/DB/session runtime modes.
  - **Skills Evaluated but Omitted**:
    - `opencode-plugin-tools`: presence source belongs in sync/runtime first, not plugin tools first.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 11, 12, 13, 16
  - **Blocked By**: 1, 2

  **References**:
  - `apps/desktop/src/main/opencode-manager.ts:339` - current attach-only process discovery.
  - `apps/desktop/src/renderer/services/backend.ts:83` - active presence snapshot structure.
  - `apps/desktop/src/renderer/hooks/use-discovery.ts:241` - active presence subscription usage.

  **Acceptance Criteria**:
  - [ ] The plan defines presence sources that cover currently missed local-running sessions.
  - [ ] Presence model includes source/confidence fields so UI/debugging can explain why a session is considered active.

  **QA Scenarios**:
  ```text
  Scenario: Non-attach local session is detected
    Tool: Bash
    Preconditions: Create a local OpenCode session pattern that is running but not represented by an attach process.
    Steps:
      1. Start the session.
      2. Run presence diagnostics.
      3. Verify PALOT marks it active with a source other than attach.
    Expected Result: Session no longer disappears from active presence due to narrow process heuristics.
    Evidence: .sisyphus/evidence/session-sync/task-7-non-attach.md

  Scenario: Presence source is explainable
    Tool: Bash
    Preconditions: Presence redesign implemented
    Steps:
      1. Inspect a visible active session in diagnostics.
      2. Verify output includes source and confidence/reason fields.
    Expected Result: Presence is auditable, not magical.
    Evidence: .sisyphus/evidence/session-sync/task-7-source-model.md
  ```

  **Commit**: NO

- [ ] 8. Add full reconciliation pass after SSE connect/reconnect/server switch

  **Junior summary**:
  - Reconnect is not "stream reopened = done."
  - After every connect/reconnect/server switch, pull fresh truth and repair the store.
  - Unknown live sessions must get placeholder entries immediately, then be filled in.

  **What to do**:
  - Design a deterministic reconciliation pass that re-pulls authoritative session/status data after SSE opens or reopens.
  - Include session list, statuses, visible active sessions, and targeted session hydration for open/attached sessions.
  - Ensure any live event for an unknown session can materialize a minimal placeholder session entry immediately, to be backfilled later by reconciliation.
  - Define how reconciliation avoids reintroducing stale-server state after a server switch.

  **Must NOT do**:
  - Do not rely on stream reopening alone as proof that the renderer is synchronized.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Reconciliation semantics are central to eliminating dropped-event drift.
  - **Skills**: [`opencode-session-internals`]
    - `opencode-session-internals`: useful for understanding session API semantics around recovery.
  - **Skills Evaluated but Omitted**:
    - `review-work`: this is design/remediation, not post-change review.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 9, 11, 15, 17
  - **Blocked By**: 1, 2

  **References**:
  - `apps/desktop/src/renderer/services/connection-manager.ts:714` - SSE event loop and reconnect behavior.
  - `apps/desktop/src/renderer/services/connection-manager.ts:210` - limited attached-status bootstrap today.
  - `apps/desktop/src/renderer/services/connection-manager.ts:550` - disconnect/server switch handling.

  **Acceptance Criteria**:
  - [ ] Every reconnect/server-switch path includes an explicit reconciliation pass.
  - [ ] Reconciliation semantics define what is refreshed globally vs per-project vs per-session.

  **QA Scenarios**:
  ```text
  Scenario: Reconnect converges stale client state
    Tool: Bash
    Preconditions: Client connected, then SSE interrupted while server state changes.
    Steps:
      1. Simulate disconnect.
      2. Change session state on the server during outage.
      3. Reconnect.
      4. Verify client converges without waiting for a lucky new event.
    Expected Result: Reconciliation closes the gap deterministically.
    Evidence: .sisyphus/evidence/session-sync/task-8-reconnect.md

  Scenario: Server switch does not leak old state
    Tool: Bash
    Preconditions: Multiple server contexts or switch simulation available.
    Steps:
      1. Switch away from one server.
      2. Reconcile against the new one.
      3. Verify no stale sessions from the old server reappear.
    Expected Result: Old state is excluded while new state is fully hydrated.
    Evidence: .sisyphus/evidence/session-sync/task-8-server-switch.md
  ```

  **Commit**: NO

- [ ] 9. Fix event batching/flush semantics for idle, buffered parts, and stale-loop disposal

  **What to do**:
  - Audit and redesign how streaming and non-streaming parts flush on `session.status`, `session.idle`, reconnect boundaries, and stale-loop disposal.
  - Remove ambiguity between `session.idle` and `session.status idle` so both converge renderer state identically.
  - Ensure buffered content cannot be silently lost when loops restart.
  - Define whether flush behavior is per-session or global and how it avoids cross-session interference.

  **Must NOT do**:
  - Do not keep flush semantics that depend on one narrow event form when related state may arrive differently.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: State batching logic is tricky and failure-prone.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `opencode-plugin-tools`: wrong layer.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 11, 17
  - **Blocked By**: 2, 8

  **References**:
  - `apps/desktop/src/renderer/services/connection-manager.ts:584` - event batcher core.
  - `apps/desktop/src/renderer/services/connection-manager.ts:665` - idle-triggered flush.
  - `apps/desktop/src/renderer/services/connection-manager.ts:690` - stale disposal behavior.

  **Acceptance Criteria**:
  - [ ] Flush semantics are defined for `session.status idle`, `session.idle`, reconnect, and disconnect cases.
  - [ ] No known buffered part path can be lost silently.

  **QA Scenarios**:
  ```text
  Scenario: session.idle path still flushes
    Tool: Bash
    Preconditions: Event fixture or simulated event path exists.
    Steps:
      1. Feed a case where streaming content completes and only idle-style completion path is exercised.
      2. Verify final parts land in the main store.
    Expected Result: Completed content is never stranded in buffer.
    Evidence: .sisyphus/evidence/session-sync/task-9-idle-flush.md

  Scenario: Stale-loop disposal does not destroy unreconciled truth
    Tool: Bash
    Preconditions: Simulated reconnect/server-switch path.
    Steps:
      1. Queue buffered events.
      2. Trigger loop staleness.
      3. Verify reconciliation preserves truth instead of losing it permanently.
    Expected Result: Event loss window is closed by design.
    Evidence: .sisyphus/evidence/session-sync/task-9-stale-loop.md
  ```

  **Commit**: NO

- [ ] 10. Define child-session/task reconciliation contract

  **What to do**:
  - Define the invariant relationship between task tool parts, child sessions, descendant requests, and parent task-card state.
  - Ensure parent surfaces cannot report timeout/failure while the child is still live without a clear degraded-state explanation.
  - Add explicit rules for bubbling child freshness, status, and failure into parent context.

  **Must NOT do**:
  - Do not keep parent/child liveness as independent best-effort guesses.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Cross-session/task reconciliation touches architecture and UX semantics.
  - **Skills**: [`opencode-session-internals`]
    - `opencode-session-internals`: grounds parent/child semantics in actual session relationships.
  - **Skills Evaluated but Omitted**:
    - `summarize-meeting`: not applicable.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 11, 14, 18
  - **Blocked By**: 1, 2

  **References**:
  - `apps/desktop/src/renderer/components/chat/sub-agent-card.tsx:94` - current child-session binding logic.
  - `apps/desktop/src/renderer/atoms/derived/session-requests.ts:91` - child request bubbling.
  - `apps/desktop/src/renderer/atoms/derived/agents.ts:340` - child session IDs and parent status derivation.

  **Acceptance Criteria**:
  - [ ] Parent/child liveness contract is explicit and testable.
  - [ ] Timeout semantics define how task-card status reacts when child session activity continues.

  **QA Scenarios**:
  ```text
  Scenario: Child still live after task timeout is surfaced as divergence
    Tool: Bash
    Preconditions: Repro or fixture for timed-out parent task with active child session.
    Steps:
      1. Trigger or replay the divergence case.
      2. Verify parent surface marks it degraded/divergent, not simply failed.
    Expected Result: Operators and users can see the mismatch explicitly.
    Evidence: .sisyphus/evidence/session-sync/task-10-timeout-divergence.md

  Scenario: Descendant waiting state bubbles correctly
    Tool: Bash
    Preconditions: Child session requests permission or asks a question.
    Steps:
      1. Trigger child permission/question.
      2. Verify parent shows waiting with correct child attribution.
    Expected Result: Parent state matches child interactive block state.
    Evidence: .sisyphus/evidence/session-sync/task-10-waiting-bubble.md
  ```

  **Commit**: NO

- [ ] 11. Refactor renderer session store around reconciled freshness fields

  **Junior summary**:
  - Put the truth in one place.
  - Sidebar, tray, command palette, and chat should not each guess freshness differently.
  - Add explicit fields for canonical activity time, visibility reason, and presence source.

  **What to do**:
  - Replace or augment current `SessionEntry` / derived agent data so canonical freshness and visibility reasons are stored explicitly.
  - Ensure the store can represent authoritative session truth, local presence, reconciled activity time, child linkage, and diagnostic drift flags.
  - Reduce duplicate derivation logic across renderer consumers.

  **Must NOT do**:
  - Do not scatter freshness logic independently across multiple components.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: This is the core renderer state-model refactor.
  - **Skills**: [`opencode-session-internals`]
    - `opencode-session-internals`: keeps the store aligned with OpenCode semantics.
  - **Skills Evaluated but Omitted**:
    - `brainstorm-ideas-existing`: not needed for code-shape work.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: 12, 13, 14, 16, 17, 18
  - **Blocked By**: 2, 3, 6, 7, 8, 9, 10

  **References**:
  - `apps/desktop/src/renderer/atoms/sessions.ts:39` - current `SessionEntry` model.
  - `apps/desktop/src/renderer/atoms/derived/agents.ts:323` - current per-session agent derivation.
  - `apps/desktop/src/renderer/lib/types.ts:182` - public `Agent` shape.

  **Acceptance Criteria**:
  - [ ] Reconciled freshness and visibility fields exist in one canonical renderer state path.
  - [ ] Multiple UI consumers no longer need to infer core sync truth differently.

  **QA Scenarios**:
  ```text
  Scenario: Renderer store exposes canonical freshness
    Tool: Bash
    Preconditions: State refactor implemented
    Steps:
      1. Inspect store/debug output for a sample session.
      2. Verify canonical activity time, visibility reason, and presence source are explicit fields.
    Expected Result: UI state no longer depends on hidden derivation magic.
    Evidence: .sisyphus/evidence/session-sync/task-11-store-shape.md

  Scenario: Hidden active session becomes explainable in-store
    Tool: Bash
    Preconditions: Session previously missed by UI available for repro.
    Steps:
      1. Hydrate the session.
      2. Inspect store/debug output.
      3. Verify it carries explicit fields explaining active state and surfacing eligibility.
    Expected Result: Store contains enough data to render or debug the session correctly.
    Evidence: .sisyphus/evidence/session-sync/task-11-hidden-store.md
  ```

  **Commit**: NO

- [ ] 12. Refactor sidebar Active/Recent/PM derivation to use canonical session graph

  **What to do**:
  - Rebuild sidebar section derivation so it uses reconciled freshness, visibility rules, and explicit scope decisions.
  - Align “Active Now,” “Recent,” pinned, and PM session logic with the new canonical session graph.
  - Remove ordering logic that depends on stale `createdAt`/`lastActiveAt` shortcuts when those conflict with actual activity semantics.

  **Must NOT do**:
  - Do not keep multiple competing definitions of “active” or “recent.”

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: This is user-facing renderer derivation and list behavior work.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `react-best-practices`: may help implementation, but plan does not require it as a core dependency.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 16, 19
  - **Blocked By**: 2, 3, 6, 7, 11

  **References**:
  - `apps/desktop/src/renderer/components/sidebar.tsx:181` - current Active/Recent derivation.
  - `apps/desktop/src/renderer/components/sidebar-layout.tsx:132` - sidebar wiring.
  - `apps/desktop/src/renderer/atoms/derived/agents.ts:432` - agents list derivation.

  **Acceptance Criteria**:
  - [ ] Sidebar sections are driven by one canonical activity/visibility contract.
  - [ ] A session cannot be active locally yet absent from all intended sidebar sections without diagnostics saying why.

  **QA Scenarios**:
  ```text
  Scenario: Active local session appears in Active Now
    Tool: Bash
    Preconditions: Local running session exists.
    Steps:
      1. Launch PALOT with the session active.
      2. Capture sidebar state.
      3. Verify the session lands in Active Now or explicit excluded bucket with a reason.
    Expected Result: No silent disappearance.
    Evidence: .sisyphus/evidence/session-sync/task-12-active-sidebar.md

  Scenario: Recent ordering follows canonical activity
    Tool: Bash
    Preconditions: Sessions with stale `session.time.updated` but fresh message/part activity.
    Steps:
      1. Capture sidebar ordering.
      2. Compare against canonical activity values.
    Expected Result: Ordering matches actual activity.
    Evidence: .sisyphus/evidence/session-sync/task-12-recent-order.md
  ```

  **Commit**: NO

- [ ] 13. Refactor command palette and tray session surfacing to share the same model

  **What to do**:
  - Ensure command palette, tray, and any secondary session surface use the same canonical session graph and freshness semantics as the sidebar.
  - Remove duplicate sorting/filtering logic that can drift from sidebar rules.
  - Define how non-focused but active sessions show up consistently across these surfaces.

  **Must NOT do**:
  - Do not let tray or command palette keep bespoke session-recency logic.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Cross-surface consistency with shared state and menu logic.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `release-notes`: not relevant.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 16, 19
  - **Blocked By**: 2, 3, 6, 7, 11

  **References**:
  - `apps/desktop/src/renderer/components/command-palette.tsx:217` - active session list in command palette.
  - `apps/desktop/src/main/tray.ts:369` - tray recent/live session derivation.
  - `apps/desktop/src/renderer/components/sidebar.tsx:201` - baseline sidebar derivation to match.

  **Acceptance Criteria**:
  - [ ] Sidebar, command palette, and tray agree on which sessions are active and recent.
  - [ ] Cross-surface ordering and exclusion rules come from one shared model.

  **QA Scenarios**:
  ```text
  Scenario: Cross-surface active session consistency
    Tool: Bash
    Preconditions: Multiple local and non-local sessions exist.
    Steps:
      1. Capture sidebar, command palette, and tray session views.
      2. Compare active/recent membership.
    Expected Result: Surfaces agree except for intentional UI-specific truncation.
    Evidence: .sisyphus/evidence/session-sync/task-13-cross-surface.md

  Scenario: Hidden session does not vanish from tray only
    Tool: Bash
    Preconditions: Repro for previously hidden active session.
    Steps:
      1. Inspect all surfaces after hydration.
      2. Verify the session is consistently shown or consistently explained as excluded.
    Expected Result: No one-off tray/command-palette drift.
    Evidence: .sisyphus/evidence/session-sync/task-13-hidden-surface.md
  ```

  **Commit**: NO

- [ ] 14. Add explicit session visibility reasons and stale-state indicators in debug surfaces

  **What to do**:
  - Surface why a session is visible, hidden, stale, attached-only, child-divergent, or excluded.
  - Add lightweight debug-facing UI/state indicators for sync health.
  - Ensure diagnostics match the structured drift vocabulary.

  **Must NOT do**:
  - Do not add user-facing noise to normal product flows without debug gating.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Requires thoughtful exposure of sync state without cluttering main UX.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `vision-proof-review`: not needed for audit/debug surfaces.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 18, 20
  - **Blocked By**: 4, 10, 11

  **References**:
  - `docs/session-debugging.md` - runbook language to mirror.
  - `apps/desktop/src/renderer/components/chat/sub-agent-card.tsx:125` - current child waiting/running cues.
  - `apps/desktop/src/renderer/components/sidebar.tsx` - likely surface for debug-aware section reasoning.

  **Acceptance Criteria**:
  - [ ] Debug surfaces can explain visibility and drift state for a session.
  - [ ] Indicators are gated appropriately and do not pollute normal usage.

  **QA Scenarios**:
  ```text
  Scenario: Stale-state indicator appears on drifted session
    Tool: Bash
    Preconditions: Session with known freshness drift.
    Steps:
      1. Open debug surface or enabled debug mode.
      2. Inspect the drifted session.
    Expected Result: Surface explains stale-state condition clearly.
    Evidence: .sisyphus/evidence/session-sync/task-14-stale-indicator.md

  Scenario: Hidden-session reason is visible in debug mode
    Tool: Bash
    Preconditions: Session intentionally or unintentionally excluded from main lists.
    Steps:
      1. Enable debug surface.
      2. Inspect the session.
    Expected Result: Visibility reason is explicit.
    Evidence: .sisyphus/evidence/session-sync/task-14-visibility-reason.md
  ```

  **Commit**: NO

- [ ] 15. Add resilience for HMR/base-client/project-client recovery paths

  **What to do**:
  - Audit HMR and client recreation paths so session state survives reconnects and module resets safely.
  - Ensure base-client/project-client recovery triggers proper reconciliation rather than merely restarting SSE.
  - Define safe clearing/repopulation order for server switches.
  - Ensure recovery also refreshes sandbox/worktree mappings and any open child-session context, not just root session streams.

  **Must NOT do**:
  - Do not treat HMR recovery as “best effort” if it can wedge session state.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused runtime recovery seam, but bounded.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `opencode-plugin-tools`: wrong layer again.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 17, 19
  - **Blocked By**: 6, 8

  **References**:
  - `apps/desktop/src/renderer/services/connection-manager.ts:413` - project-client HMR recovery.
  - `apps/desktop/src/renderer/services/connection-manager.ts:499` - base-client recovery.
  - `apps/desktop/src/renderer/services/connection-manager.ts:550` - disconnect/server switch behavior.

  **Acceptance Criteria**:
  - [ ] HMR or client recreation paths converge back to correct session truth.
  - [ ] Recovery paths are explicitly tested or script-verified.

  **QA Scenarios**:
  ```text
  Scenario: HMR recovery preserves session truth
    Tool: Bash
    Preconditions: Dev environment with HMR and active sessions.
    Steps:
      1. Trigger module reload/client recreation.
      2. Verify sessions remain visible and accurate after recovery.
    Expected Result: No missing or phantom sessions after HMR.
    Evidence: .sisyphus/evidence/session-sync/task-15-hmr.md

  Scenario: Project-client recreation triggers reconciliation
    Tool: Bash
    Preconditions: Force project-client loss while session state continues on server.
    Steps:
      1. Recreate the client path.
      2. Verify session/status state is reconciled, not just re-streamed opportunistically.
    Expected Result: Recovery closes gaps deterministically.
    Evidence: .sisyphus/evidence/session-sync/task-15-project-client.md
  ```

  **Commit**: NO

- [ ] 16. Add regression tests and scripted fixtures for missed active sessions

  **Junior summary**:
  - If you cannot reproduce the old bug automatically, the fix is not safe.
  - Build fixtures for the exact bad cases, then prove they stay fixed.

  **What to do**:
  - Create reproducible fixtures/scenarios for active local sessions outside preload/focus assumptions.
  - Add regression tests or harnesses proving these sessions surface correctly.
  - Cover root sessions and any intentional exclusion cases.

  **Must NOT do**:
  - Do not rely only on ad hoc manual repro.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Needs fixture design plus automated proof.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `review-work`: not a review task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: 3, 5, 7, 11, 12, 13

  **References**:
  - `scripts/debug-sessions.ts` - helper can seed proof workflows.
  - `apps/desktop/src/renderer/hooks/use-discovery.ts:197` - preload path under test.
  - `apps/desktop/src/main/opencode-manager.ts:339` - presence path under test.

  **Acceptance Criteria**:
  - [ ] Automated fixture exists for a missed-active-session scenario.
  - [ ] Tests/harness prove the session becomes visible after remediation.

  **QA Scenarios**:
  ```text
  Scenario: Fixture proves active session visibility
    Tool: Bash
    Preconditions: Regression harness implemented.
    Steps:
      1. Run the harness.
      2. Verify expected active session is present in PALOT-facing output.
    Expected Result: Previously missed session is now surfaced.
    Evidence: .sisyphus/evidence/session-sync/task-16-fixture.md

  Scenario: Intentional exclusions remain excluded
    Tool: Bash
    Preconditions: Noise/scratch/test session fixtures available.
    Steps:
      1. Run the harness.
      2. Verify excluded sessions stay excluded with explicit reasons.
    Expected Result: Fixes do not flood the UI with junk.
    Evidence: .sisyphus/evidence/session-sync/task-16-exclusions.md
  ```

  **Commit**: NO

- [ ] 17. Add regression tests and scripted fixtures for reconnect/event-loss drift

  **What to do**:
  - Build reproducible reconnect and event-loss scenarios.
  - Prove client reconciliation restores accurate state without depending on fresh spontaneous events.
  - Cover stale timestamp, dropped buffered parts, server-switch drift, and unknown-session-first event ordering.

  **Must NOT do**:
  - Do not declare reconnect fixed without deterministic repro coverage.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Needs controlled failure simulation and proof.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `brainstorm-ideas-existing`: too loose for verification work.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: 3, 5, 8, 9, 11, 15

  **References**:
  - `apps/desktop/src/renderer/services/connection-manager.ts:714` - SSE loop under test.
  - `apps/desktop/src/renderer/services/connection-manager.ts:665` - flush behavior under test.
  - `docs/session-debugging.md` - operator audit targets.

  **Acceptance Criteria**:
  - [ ] Reconnect/event-loss fixtures exist.
  - [ ] Automated proof shows drift is corrected after remediation.

  **QA Scenarios**:
  ```text
  Scenario: Reconnect fixture restores stale state
    Tool: Bash
    Preconditions: Reconnect harness implemented.
    Steps:
      1. Run harness with server changes during disconnect.
      2. Verify reconciled client matches server truth after reconnect.
    Expected Result: No stale state remains.
    Evidence: .sisyphus/evidence/session-sync/task-17-reconnect-fixture.md

  Scenario: Buffered-part loss fixture is closed
    Tool: Bash
    Preconditions: Streaming/event-loss harness implemented.
    Steps:
      1. Simulate buffered content plus reconnect/stale-loop transition.
      2. Verify final parts and timestamps are correct.
    Expected Result: Buffered content survives via flush/reconciliation.
    Evidence: .sisyphus/evidence/session-sync/task-17-buffered-parts.md
  ```

  **Commit**: NO

- [ ] 18. Add regression tests and scripted fixtures for child/session timeout divergence

  **What to do**:
  - Build reproducible cases where task tool status diverges from child-session liveness.
  - Add verification for degraded-state surfacing and child freshness propagation.
  - Cover child permission/question waiting cases too.

  **Must NOT do**:
  - Do not treat child divergence as a rare edge case without automation.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex cross-session behavior plus verification.
  - **Skills**: [`opencode-session-internals`]
    - `opencode-session-internals`: useful for correct child-session semantics.
  - **Skills Evaluated but Omitted**:
    - `summarize-meeting`: irrelevant.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: 5, 10, 11, 14

  **References**:
  - `apps/desktop/src/renderer/components/chat/sub-agent-card.tsx:125` - task/child card behavior.
  - `apps/desktop/src/renderer/atoms/derived/session-requests.ts:121` - child-blocked state.
  - `apps/desktop/src/renderer/atoms/derived/agents.ts:340` - descendant linkage.

  **Acceptance Criteria**:
  - [ ] Fixture exists for timed-out parent vs live child case.
  - [ ] Automated proof shows corrected degraded-state handling.

  **QA Scenarios**:
  ```text
  Scenario: Parent timeout with live child is flagged correctly
    Tool: Bash
    Preconditions: Divergence harness implemented.
    Steps:
      1. Run the harness.
      2. Inspect parent and child outputs.
    Expected Result: Parent does not lie about final failure while child remains live.
    Evidence: .sisyphus/evidence/session-sync/task-18-parent-child.md

  Scenario: Child waiting state remains coherent
    Tool: Bash
    Preconditions: Child interactive-block fixture implemented.
    Steps:
      1. Trigger child permission/question path.
      2. Verify parent and child surfaces agree on waiting state.
    Expected Result: Waiting semantics remain synchronized.
    Evidence: .sisyphus/evidence/session-sync/task-18-waiting.md
  ```

  **Commit**: NO

- [ ] 19. Rollout plan, migration safeguards, and failure fallback behavior

  **What to do**:
  - Define staged rollout, safe defaults, fallbacks, and escape hatches for sync changes.
  - Plan how to compare old vs new surfacing during rollout if dual-read/diagnostic mode is needed.
  - Define what PALOT should do when reconciliation itself fails.

  **Must NOT do**:
  - Do not ship a state-model rewrite without guarded rollout.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: This is deployment strategy and operational safety design.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `release-notes`: user-facing output comes later, not now.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: 4, 12, 13, 15

  **References**:
  - `apps/desktop/src/renderer/hooks/use-discovery.ts` - startup/discovery critical path.
  - `apps/desktop/src/renderer/services/connection-manager.ts` - reconnect and disconnect critical path.
  - `docs/session-debugging.md` - fallback operator workflow baseline.

  **Acceptance Criteria**:
  - [ ] Rollout plan exists with guardrails and rollback triggers.
  - [ ] Failure fallback behavior is defined for reconciliation errors.

  **QA Scenarios**:
  ```text
  Scenario: Rollout guardrails are testable
    Tool: Bash
    Preconditions: Rollout strategy documented.
    Steps:
      1. Inspect the strategy.
      2. Verify it names safe enablement order, rollback criteria, and fallback operation mode.
    Expected Result: Rollout is operationally credible.
    Evidence: .sisyphus/evidence/session-sync/task-19-rollout.md

  Scenario: Reconciliation failure fallback is explicit
    Tool: Bash
    Preconditions: Strategy documented.
    Steps:
      1. Inspect failure-mode section.
      2. Verify it defines what the client does and what diagnostics are emitted.
    Expected Result: Failure path is defined, not improvised.
    Evidence: .sisyphus/evidence/session-sync/task-19-fallback.md
  ```

  **Commit**: NO

- [ ] 20. Documentation, runbook updates, and team debugging workflow hardening

  **What to do**:
  - Update durable docs so future debugging of sync drift is fast and standardized.
  - Document the new state model, invariants, drift classes, helper commands, and verification flows.
  - Add team/operator guidance for triage order and evidence capture.
  - Document parity expectations between Electron and browser/server modes so future regressions are obvious.

  **Must NOT do**:
  - Do not leave the new sync model tribal-knowledge only.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Durable documentation and workflow hardening.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `summarize-meeting`: insufficiently operational for runbook work.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: 4, 5, 14

  **References**:
  - `docs/session-debugging.md` - current runbook to expand.
  - `AGENTS.md` - durable agent guidance surface.
  - `scripts/debug-sessions.ts` - tooling to document.

  **Acceptance Criteria**:
  - [ ] Updated docs fully describe the new sync model and audit path.
  - [ ] A future agent can diagnose hidden/stale sessions without rediscovery.

  **QA Scenarios**:
  ```text
  Scenario: Runbook supports end-to-end triage
    Tool: Bash
    Preconditions: Docs updated.
    Steps:
      1. Follow the runbook for a known sync issue.
      2. Verify it leads to the right helper commands and interpretation points.
    Expected Result: Runbook is executable, not aspirational.
    Evidence: .sisyphus/evidence/session-sync/task-20-runbook.md

  Scenario: Agent guidance points to the right tools
    Tool: Bash
    Preconditions: AGENTS/docs updated.
    Steps:
      1. Search for session-debug instructions.
      2. Verify guidance points to the canonical helpers/runbooks.
    Expected Result: Future agents find the right workflow quickly.
    Evidence: .sisyphus/evidence/session-sync/task-20-guidance.md
  ```

  **Commit**: YES
  - Message: `docs(session-sync): add sync debugging workflow`
  - Files: `docs/`, `AGENTS.md`, helper docs
  - Pre-commit: `bun run lint`

---

## Final Verification Wave

> **Junior exit rule**
> Do not mark work complete because the UI "looks better."
> Only mark complete when:
> - a hidden-running-session repro is fixed,
> - a reconnect-drift repro is fixed,
> - a child-divergence repro is fixed,
> - Electron/browser parity is proven,
> - and docs/helpers explain the new truth model.
 <!-- oc:id=sec_am -->

- [ ] F1. **Plan Compliance Audit** — `deep`
  Verify every planned deliverable exists across architecture docs, code paths, diagnostics, helpers, and tests. Check all “must have / must not have” constraints.

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run lint/typecheck/tests for touched areas, plus inspect for state duplication, silent fallthroughs, missing logs, and brittle reconnection logic.

- [ ] F3. **Real QA** — `unspecified-high`
  Execute startup, reconnect, hidden-active-session, stale-recency, child-divergence, and server-switch scenarios with evidence.

- [ ] F4. **Scope Fidelity Check** — `deep`
  Ensure changes solve session synchronization only, without drifting into unrelated product work.

---

## Commit Strategy

- **1**: `chore(session-sync): improve debug tooling` — scripts/docs/AGENTS
- **2**: `refactor(session-sync): unify session reconciliation model` — core sync paths
- **3**: `fix(session-sync): surface active local sessions consistently` — presence/hydration/UI
- **4**: `test(session-sync): cover drift and reconnect scenarios` — tests/fixtures/docs

---

## Success Criteria <!-- oc:id=sec_an -->

### Verification Commands <!-- oc:id=sec_ao -->
```bash
bun run debug:sessions -- <session-id>
bun run svc:status
bun run lint
bun run check-types
```

### Final Checklist <!-- oc:id=sec_ap -->
- [ ] All in-scope active local sessions surface in PALOT without manual rescue
- [ ] Recent ordering follows canonical activity semantics
- [ ] Reconnect/server-switch converges state deterministically
- [ ] Child/task liveness divergence is detected and explained
- [ ] Operators have clear tooling and docs to audit sync state quickly