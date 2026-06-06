# Palot Dev Inspector Self-Debug <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Add a dev-only in-app inspector to Palot that can hover/click renderer UI, resolve the underlying React element back to source/component context, collect commentary, and launch a Palot-scoped OpenCode debug session preloaded with that inspection payload.
>
> **Deliverables**:
> - Dev-only build/runtime instrumentation for source-aware React inspection
> - Renderer inspect mode toggle, overlay, target details panel, and note capture flow
> - Debug artifact/payload model and prompt composition path for self-debug sessions
> - Session launcher that creates/focuses an OpenCode session in the Palot repo and sends the captured context
> - Verification coverage for browser-mode and Electron dev flows
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 -> Task 4 -> Task 8 -> Task 14 -> Task 18 -> Final Verification

---

## Context

### Original Request
Build a Palot feature that lets the app inspect itself in development: enter a mode, hover/click renderer elements, see React/source information, attach commentary inside the app, and immediately start a Palot OpenCode debug session that uses that context to work on fixing the app.

### Interview Summary
**Key Discussions**:
- Feature is dev-mode first; production support is explicitly out of scope for this first pass.
- Repo/build control is available, so dev-only build instrumentation is acceptable.
- Preferred technical direction is hybrid: stable build/runtime metadata plus optional React fiber ancestry for richer context.
- The resulting flow should trigger a real OpenCode session inside the Palot repo, not just copy text to clipboard.

**Research Findings**:
- Renderer Vite stacks already use `@vitejs/plugin-react` in `apps/desktop/electron.vite.config.ts` and `apps/desktop/src/renderer/vite.web.config.ts`, giving a natural dev-only Babel instrumentation seam.
- Existing OpenCode session creation and prompt dispatch live in `apps/desktop/src/renderer/hooks/use-server.ts` and `apps/desktop/src/renderer/services/opencode.ts`.
- Existing launcher composition pattern exists in `apps/desktop/src/renderer/project-manager-launcher.ts`.
- Existing overlay UI precedent exists in `apps/desktop/src/renderer/components/side-panel/browser-cursor-overlay.tsx`.
- Existing artifact capture/store architecture exists in `docs/genui-artifact-architecture.md`, `apps/desktop/src/renderer/genui/genui-renderer.tsx`, and `apps/desktop/src/renderer/atoms/genui-artifacts.ts`.
- External research recommends dev-only `babel-plugin-transform-react-jsx-source` as the baseline, plus DOM -> fiber walk for `_debugSource`, with custom DOM attribute instrumentation used only where it materially improves reliability.
- Existing review-comment UX, pane bus, and side-panel registry provide reusable patterns for note capture and prompt injection: `apps/desktop/src/renderer/components/review/review-comments.tsx`, `apps/desktop/src/renderer/atoms/pane-bus.ts`, and `apps/desktop/src/renderer/firefly-surface-registry.tsx`.
- Existing live-preview/browser lane work is useful as UI precedent only, not as the core technical path for self-inspection. It already has overlay/event contracts, but its click/inspect path is lane-oriented and not a fit for renderer self-inspection without major extra scope.

### Metis Review
**Identified Gaps** (addressed):
- Needed tighter scope control around “full fiber inspection” so V1 does not balloon into building React DevTools inside Palot.
- Needed explicit guardrails separating stable source lookup from optional unstable fiber internals.
- Needed acceptance criteria for both browser-mode (`vite.web`) and Electron renderer flows.
- Needed negative-case coverage for anonymous components, portals/fragments, and non-instrumented DOM.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Ship a dev-only self-inspection workflow in Palot that captures actionable source/component context from the live renderer UI and feeds that context directly into a new or focused OpenCode debug session scoped to the Palot repo.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- Dev-only renderer instrumentation enabled in both `electron-vite` renderer and browser-mode Vite configs.
- Inspector state model and feature gating so the capability is invisible in production builds.
- In-app inspect mode toggle/button, hover highlight, click capture, details panel, and note/comment input.
- Structured inspection payload model containing source, component, bounds, ancestry, and user commentary.
- Debug session launch path and prompt template that packages the captured payload for Palot self-debugging.
- Evidence-producing verification path for both browser-mode and Electron dev runtime.

### Definition of Done <!-- oc:id=sec_af -->
- [ ] In dev mode, a user can toggle inspect mode, hover/click a rendered Palot element, see resolved source/component info, attach a note, and launch a Palot-scoped OpenCode debug session containing that context.
- [ ] In production build mode, the inspect controls and instrumentation are absent or inert.
- [ ] Browser-mode and Electron renderer dev flows both verify the inspection pipeline end to end.

### Must Have <!-- oc:id=sec_ag -->
- Dev-only gating via build/runtime checks.
- Stable source resolution path for typical renderer components.
- A structured debug payload, not an ad hoc string blob.
- Session launch from inside Palot using existing OpenCode integration patterns.
- Agent-executable verification without human-only steps.

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- No production/runtime shipping of inspector UI or metadata in this first slice.
- No attempt to build a full React DevTools clone or full component tree explorer in V1.
- No dependency on remote browser lanes, browser-use, or Palot’s external browser overlay systems for renderer self-inspection.
- No broad new persistence layer beyond what is needed for session-scoped payloads/artifacts.
- No brittle hard-dependence on fiber internals as the sole resolution path; fiber is enrichment, not the only source of truth.
- No iframe/CDP/browser-lane element picking in V1; this plan is for Palot renderer self-inspection, not live lane inspection.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (limited; desktop app has app verification commands but little automated UI coverage)
- **Automated tests**: Tests-after
- **Framework**: Bun/Vitest-style repo commands + targeted renderer/component tests where practical
- **If TDD**: Not required for this plan; implementation tasks may still add targeted tests first where helpful

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use browser-mode dev server and/or Electron dev runtime with browser automation or DOM-level tests.
- **Renderer/logic**: Use targeted test files where feasible.
- **Session launch/integration**: Use existing OpenCode client/session flows in dev environment and assert created prompts/session metadata.

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Parallel Execution Waves <!-- oc:id=sec_aj -->

Wave 1 (Start Immediately — foundations + contracts):
- Task 1: Define inspector architecture, feature flag, and payload contract [unspecified-high]
- Task 2: Audit and codify session launch/prompt integration seam [quick]
- Task 3: Design artifact/comment storage approach for captured inspections [quick]
- Task 4: Add dev-only instrumentation hooks to both Vite configs [unspecified-high]
- Task 5: Define inspector prompt template and session naming strategy [writing]

Wave 2 (After Wave 1 — core inspection runtime):
- Task 6: Implement inspector state atoms/hooks/provider [quick]
- Task 7: Implement DOM/fiber/source resolution helper pipeline [deep]
- Task 8: Implement inspect overlay, hover targeting, and click capture UX [visual-engineering]
- Task 9: Implement details panel/card for captured targets [visual-engineering]
- Task 10: Implement failure-state UX for unresolved/anonymous/uninstrumented targets [quick]

Wave 3 (After Wave 2 — debug launch + artifacts):
- Task 11: Implement note/comment capture and structured payload assembly [quick]
- Task 12: Integrate captured inspection records into session-scoped artifact/state surfaces [unspecified-high]
- Task 13: Implement self-debug session launcher + prompt dispatch [deep]
- Task 14: Add app entry controls/button placement and dev gating polish [visual-engineering]
- Task 15: Add editor/open-file or source-jump affordance if needed by UX [quick]

Wave 4 (After Wave 3 — hardening + verification plumbing):
- Task 16: Add targeted tests for source resolution and payload formatting [quick]
- Task 17: Add targeted tests for overlay state and fallback paths [quick]
- Task 18: Add end-to-end dev verification flow for browser-mode and Electron [unspecified-high]
- Task 19: Document feature, guardrails, and developer workflow in repo docs/wiki [writing]

Wave FINAL (After ALL tasks — 4 parallel reviews):
- F1: Plan compliance audit
- F2: Code quality review
- F3: Real manual QA via scripted agent execution
- F4: Scope fidelity check

Critical Path: 1 -> 4 -> 7 -> 13 -> 18 -> FINAL
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 5

### Dependency Matrix <!-- oc:id=sec_ak -->
- **1**: None -> 6, 7, 8, 11
- **2**: None -> 13, 18
- **3**: None -> 12
- **4**: None -> 7, 8, 10, 18
- **5**: None -> 13, 19
- **6**: 1 -> 8, 9, 11, 14, 17
- **7**: 1, 4 -> 8, 9, 10, 11, 16, 18
- **8**: 1, 4, 6, 7 -> 9, 10, 14, 17, 18
- **9**: 6, 7, 8 -> 11, 14, 18
- **10**: 4, 7, 8 -> 17, 18
- **11**: 1, 6, 7, 9 -> 12, 13, 18
- **12**: 3, 11 -> 13, 18, 19
- **13**: 2, 5, 11, 12 -> 14, 18, 19
- **14**: 6, 8, 9, 13 -> 18
- **15**: 7, 9 -> 18, 19
- **16**: 7, 11 -> FINAL
- **17**: 6, 8, 10 -> FINAL
- **18**: 2, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15 -> FINAL
- **19**: 5, 12, 13, 15 -> FINAL

### Agent Dispatch Summary <!-- oc:id=sec_al -->
- **Wave 1**: T1 `unspecified-high`, T2 `quick`, T3 `quick`, T4 `unspecified-high`, T5 `writing`
- **Wave 2**: T6 `quick`, T7 `deep`, T8 `visual-engineering`, T9 `visual-engineering`, T10 `quick`
- **Wave 3**: T11 `quick`, T12 `unspecified-high`, T13 `deep`, T14 `visual-engineering`, T15 `quick`
- **Wave 4**: T16 `quick`, T17 `quick`, T18 `unspecified-high`, T19 `writing`
- **FINAL**: F1 `oracle`, F2 `unspecified-high`, F3 `unspecified-high`, F4 `deep`

---

## TODOs

- [ ] 1. Define inspector architecture, feature flag, and payload contract

  **What to do**:
  - Define the dev-only inspector architecture in code-facing terms: gating model, runtime boundaries, and source-of-truth for inspection metadata.
  - Decide and document the structured payload shape for a captured inspection record: source path, line/column, component/display name, optional owner chain, DOM bounds, selector hints, freeform note, timestamp, and originating session/project context.
  - Define the single helper boundary for unstable React internals so fiber lookup is isolated and replaceable.
  - Identify where the feature flag/state should live so renderer controls, instrumentation, and prompt launch all agree on dev-only enablement.

  **Must NOT do**:
  - Do not implement UI yet.
  - Do not let fiber internals leak across multiple modules.
  - Do not define a payload that depends on production-only or browser-lane-only fields.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: cross-cutting architecture and contract work across renderer/config/session domains.
  - **Skills**: [`caveman`]
    - `caveman`: keeps contract/spec work terse and unambiguous.
  - **Skills Evaluated but Omitted**:
    - `software-design-principles`: useful, but task can follow existing repo patterns without loading extra doctrine.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5)
  - **Blocks**: 6, 7, 8, 11
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/preload/api.d.ts:143` - existing typed preload/shared contracts pattern; mirror this style for any new typed payloads crossing surfaces.
  - `apps/desktop/src/renderer/lib/types.ts` - canonical home for renderer-side shared types; inspect existing session/artifact type patterns before adding new inspector records.
  - `docs/genui-artifact-architecture.md:148` - artifact record design language and scope rules already used in Palot.
  - `apps/desktop/src/renderer/atoms/genui-artifacts.ts:10` - concrete example of session-scoped record state shape.
  - `apps/desktop/src/renderer/components/side-panel/browser-cursor-overlay.tsx:37` - overlay precedent that already treats runtime coordinates and transient UI state carefully.

  **Acceptance Criteria**:
  - [ ] A single canonical inspection payload/interface location exists.
  - [ ] Dev-only gating strategy is explicit and referenced by later tasks.
  - [ ] Unstable React/fiber access is constrained to one helper/service boundary.

  **QA Scenarios**:
  ```
  Scenario: Contract compiles cleanly
    Tool: Bash
    Preconditions: Type definitions and contract wiring added
    Steps:
      1. Run the repo typecheck command after introducing the new inspector payload types
      2. Confirm all new inspector-related modules import the canonical type instead of redefining it
      3. Search for direct `__reactFiber$` access outside the designated helper module
    Expected Result: Typecheck passes and only one helper owns direct fiber access
    Failure Indicators: Multiple payload definitions, scattered direct fiber access, or type errors
    Evidence: .sisyphus/evidence/task-1-contract-compile.txt

  Scenario: Production gate remains explicit
    Tool: Bash
    Preconditions: Gating constant/helper added
    Steps:
      1. Search for inspector feature checks across renderer/config files
      2. Confirm each check resolves through the intended dev-only gate or helper
    Expected Result: Feature activation flows through a single explicit dev gate
    Failure Indicators: Hard-coded booleans, multiple ad hoc env checks, or production-default enablement
    Evidence: .sisyphus/evidence/task-1-dev-gate-audit.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-1-contract-compile.txt`
  - [ ] `.sisyphus/evidence/task-1-dev-gate-audit.txt`

  **Commit**: NO

- [ ] 2. Audit and codify session launch/prompt integration seam

  **What to do**:
  - Identify the exact Palot-side abstraction to create/focus a self-debug session for the Palot repo.
  - Decide whether to reuse an existing launcher pattern directly or factor a smaller shared launcher helper.
  - Define how an inspection payload becomes prompt input: inline structured markdown, attachment-like context, or both.
  - Specify whether launching should always create a fresh session or optionally reuse/focus a named debug session.

  **Must NOT do**:
  - Do not add actual inspector UI here.
  - Do not fork the PM launcher into a broad generic framework unless needed.
  - Do not couple the launch flow to a specific model/provider.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded audit of existing integration seams.
  - **Skills**: [`caveman`]
    - `caveman`: keeps the resulting seam narrow.
  - **Skills Evaluated but Omitted**:
    - `send-to-session`: useful if cross-session messaging changes were required; likely unnecessary for first-pass local launcher reuse.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4, 5)
  - **Blocks**: 13, 18
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/project-manager-launcher.ts:43` - existing launcher orchestration pattern for session creation + prompt composition.
  - `apps/desktop/src/renderer/hooks/use-server.ts:159` - canonical createSession hook path in renderer.
  - `apps/desktop/src/renderer/hooks/use-server.ts:140` - canonical promptAsync dispatch path and model/agent option handling.
  - `apps/desktop/src/renderer/services/opencode.ts:280` - lower-level sendPrompt helper if a shared service abstraction is preferred.
  - `apps/desktop/src/renderer/components/session-view.tsx:1` - existing session-centric UI shell to understand how a launched debug session will surface.

  **Acceptance Criteria**:
  - [ ] Chosen launch seam is documented in code comments or adjacent module structure.
  - [ ] Prompt assembly strategy is explicit and stable.
  - [ ] The implementation path does not require new OpenCode server APIs.

  **QA Scenarios**:
  ```
  Scenario: Launch seam remains inside existing Palot primitives
    Tool: Bash
    Preconditions: Launch integration helper/refactor implemented
    Steps:
      1. Search for session creation calls used by the inspector launch path
      2. Confirm they flow through existing Palot createSession/sendPrompt hooks or services
    Expected Result: No duplicate session-launch stack exists for inspector mode
    Failure Indicators: Direct one-off client calls bypassing existing patterns
    Evidence: .sisyphus/evidence/task-2-launch-seam-audit.txt

  Scenario: Prompt payload formatting is deterministic
    Tool: Bash
    Preconditions: Prompt composition helper added
    Steps:
      1. Execute a small unit or snapshot test for prompt composition if implemented
      2. If no test harness, run a script/helper to print a sample prompt from a known mock payload
      3. Verify required sections exist: target, source, note, expected debugging task
    Expected Result: Prompt format is stable and complete
    Failure Indicators: Missing fields, unordered sections, or raw object dump without structure
    Evidence: .sisyphus/evidence/task-2-prompt-format.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-2-launch-seam-audit.txt`
  - [ ] `.sisyphus/evidence/task-2-prompt-format.txt`

  **Commit**: NO

- [ ] 3. Design artifact/comment storage approach for captured inspections

  **What to do**:
  - Decide whether inspection captures should reuse the GenUI artifact store directly, use a sibling session-scoped atom family, or wrap both under a more generic artifact/comment model.
  - Define how notes/comments are attached to a captured inspection and whether multi-capture queues are supported in V1.
  - Keep source linkage and prompt-launch consumption easy without over-generalizing the artifact layer.
  - Specify persistence behavior in dev: in-memory only vs session storage/local storage reuse.

  **Must NOT do**:
  - Do not introduce project-global persistence.
  - Do not turn this into a full annotation system for all Palot surfaces.
  - Do not rewrite GenUI architecture unless the minimum needed seam demands it.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: state-shape design adjacent to an existing architecture.
  - **Skills**: [`caveman`]
    - `caveman`: useful for narrow state-surface choices.
  - **Skills Evaluated but Omitted**:
    - `software-design-principles`: optional, but existing GenUI/store docs provide enough precedent.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4, 5)
  - **Blocks**: 12
  - **Blocked By**: None

  **References**:
  - `docs/genui-artifact-architecture.md:202` - explains current store layer and why Jotai is the chosen substrate.
  - `apps/desktop/src/renderer/atoms/genui-artifacts.ts:40` - concrete storage atom setup and record ordering logic.
  - `apps/desktop/src/renderer/components/genui/genui-artifact-inline-actions.tsx:10` - simple artifact action surface precedent.
  - `apps/desktop/src/renderer/components/side-panel/artifacts-panel.tsx:1` - current session-scoped artifact surfacing.

  **Acceptance Criteria**:
  - [ ] V1 storage scope is explicit and session-bounded.
  - [ ] Notes/comments association model is unambiguous.
  - [ ] State design does not force unrelated GenUI refactors.

  **QA Scenarios**:
  ```
  Scenario: Inspector state stays session-scoped
    Tool: Bash
    Preconditions: Storage atoms/selectors implemented
    Steps:
      1. Read the storage atom definitions for inspection records
      2. Confirm keys and selectors are scoped by session or explicit dev context rather than global singleton state
    Expected Result: Captures belong to the active session context only
    Failure Indicators: Global mutable singleton store or production-persistent storage without gating
    Evidence: .sisyphus/evidence/task-3-storage-scope.txt

  Scenario: Notes remain linked to their capture records
    Tool: Bash
    Preconditions: Record shape and write actions implemented
    Steps:
      1. Run a targeted state test or script that creates a capture, attaches a note, and reads it back
      2. Verify note text and source linkage stay attached to the same record id
    Expected Result: Record-note linkage is stable
    Failure Indicators: Detached notes, duplicate records, or note loss after update
    Evidence: .sisyphus/evidence/task-3-note-linkage.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-3-storage-scope.txt`
  - [ ] `.sisyphus/evidence/task-3-note-linkage.txt`

  **Commit**: NO

- [ ] 4. Add dev-only instrumentation hooks to both Vite configs

  **What to do**:
  - Update both renderer build paths (`electron-vite` renderer and browser-mode Vite) so React dev source metadata is available in development.
  - Prefer the smallest stable config: official React dev Babel/source plugins or equivalent supported transform path.
  - If additional custom instrumentation is required, implement it as a dev-only plugin/helper with minimal DOM pollution and clear opt-in behavior.
  - Ensure production builds do not include the inspector-specific transform behavior.

  **Must NOT do**:
  - Do not enable inspector metadata in production builds.
  - Do not break fast refresh/HMR.
  - Do not create divergent instrumentation behavior between browser-mode and Electron without documenting why.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: build pipeline changes across two renderer entrypoints with dev/prod behavior concerns.
  - **Skills**: [`caveman`]
    - `caveman`: keeps build-surface changes minimal.
  - **Skills Evaluated but Omitted**:
    - `project-setup`: broader than needed; this is not repo bootstrap work.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 5)
  - **Blocks**: 7, 8, 10, 18
  - **Blocked By**: None

  **References**:
  - `apps/desktop/electron.vite.config.ts:64` - Electron renderer plugin/config insertion point.
  - `apps/desktop/src/renderer/vite.web.config.ts:28` - browser-mode Vite plugin/config insertion point.
  - `apps/desktop/src/renderer/vite-env.d.ts` - add any typed dev env flags here if needed.
  - `apps/desktop/electron.vite.config.ts:66` - existing `react()` plugin call to extend rather than replace.

  **Acceptance Criteria**:
  - [ ] Dev renderer builds expose source metadata required by the inspector.
  - [ ] Production builds do not enable the instrumentation path.
  - [ ] HMR/dev boot still works in both browser-mode and Electron renderer.

  **QA Scenarios**:
  ```
  Scenario: Browser-mode dev build includes source metadata path
    Tool: Bash
    Preconditions: Vite web config updated
    Steps:
      1. Start browser-mode dev services using repo-approved commands
      2. Load the renderer and inspect a known instrumented element through the new helper or a temporary test harness
      3. Confirm source metadata is present in dev
    Expected Result: Source location resolves in browser-mode dev
    Failure Indicators: Missing `_debugSource`/metadata or broken dev boot
    Evidence: .sisyphus/evidence/task-4-browser-dev-metadata.txt

  Scenario: Production build path excludes inspector instrumentation
    Tool: Bash
    Preconditions: Production build config still available
    Steps:
      1. Run a production build or static config assertion for the renderer
      2. Confirm inspector-specific Babel/plugin flags are gated off outside dev
    Expected Result: Production path omits dev-only instrumentation
    Failure Indicators: Dev plugins always enabled or production bundle references inspector metadata path
    Evidence: .sisyphus/evidence/task-4-prod-gate.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-4-browser-dev-metadata.txt`
  - [ ] `.sisyphus/evidence/task-4-prod-gate.txt`

  **Commit**: YES
  - Message: `feat(inspector): add dev-only renderer instrumentation`

- [ ] 5. Define inspector prompt template and session naming strategy

  **What to do**:
  - Write the prompt contract used when launching a self-debug session from an inspection capture.
  - Define session title/naming rules so debug sessions are identifiable but not noisy.
  - Include expectations for the agent: inspect current file/component, understand note, reproduce issue if possible, propose/fix within Palot repo context.
  - Keep the prompt format structured enough to support future automation or snapshot tests.

  **Must NOT do**:
  - Do not overload the prompt with generic repo onboarding text already available elsewhere.
  - Do not hardcode one model/agent.
  - Do not assume a single issue type; prompt should work for layout, logic, state, or UX notes.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: prompt/template clarity is the primary deliverable.
  - **Skills**: [`caveman`]
    - `caveman`: keeps prompt concise and high-signal.
  - **Skills Evaluated but Omitted**:
    - `brainstorming`: too broad; prompt should be operational, not expansive.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 4)
  - **Blocks**: 13, 19
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/project-manager-launcher.ts:96` - existing prompt document + user request composition pattern.
  - `apps/desktop/src/renderer/components/chat/chat-view.tsx` - understand how sessions and prompts are surfaced to users in current chat UX.
  - `AGENTS.md` - repo constraints the self-debug prompt should implicitly respect.

  **Acceptance Criteria**:
  - [ ] Prompt template includes target/source/note/request sections.
  - [ ] Session naming is deterministic enough to test.
  - [ ] Template does not repeat large static context unnecessarily.

  **QA Scenarios**:
  ```
  Scenario: Prompt template renders all required sections
    Tool: Bash
    Preconditions: Prompt helper/template added
    Steps:
      1. Execute a sample prompt build from a representative inspection payload
      2. Verify sections for component, source file, note, and requested action appear in order
    Expected Result: Prompt is readable and complete
    Failure Indicators: Missing note/source/action sections or malformed formatting
    Evidence: .sisyphus/evidence/task-5-prompt-template.txt

  Scenario: Session naming is deterministic
    Tool: Bash
    Preconditions: Naming helper added
    Steps:
      1. Run the naming helper against two representative payloads
      2. Verify names remain stable and suitably scoped to Palot self-debugging
    Expected Result: Session naming format is predictable
    Failure Indicators: Randomized naming, missing inspector context, or excessively long titles
    Evidence: .sisyphus/evidence/task-5-session-naming.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-5-prompt-template.txt`
  - [ ] `.sisyphus/evidence/task-5-session-naming.txt`

  **Commit**: NO

- [ ] 6. Implement inspector state atoms/hooks/provider

  **What to do**:
  - Create the renderer-side state model for inspector enablement, active hover target, selected target, captured records queue/current draft, note draft, and launch-in-progress state.
  - Add a provider/hook seam so multiple UI surfaces can consume the same inspector state without prop drilling.
  - Keep the state model dev-only aware and session-aware where relevant.
  - Ensure state resets cleanly on inspector exit and session/project switches.

  **Must NOT do**:
  - Do not bury business logic inside presentational components.
  - Do not create duplicate state in both component local state and atoms without a reason.
  - Do not persist ephemeral hover state across app restarts.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: focused renderer state work using existing Jotai patterns.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: aligns hook/provider/state decomposition with existing renderer patterns.
  - **Skills Evaluated but Omitted**:
    - `visual-tdd`: overlay visuals come later; this task is state substrate first.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 8, 9, 10)
  - **Blocks**: 8, 9, 11, 14, 17
  - **Blocked By**: 1

  **References**:
  - `apps/desktop/src/renderer/atoms/chat.ts` - pattern for session-scoped feature state and actions.
  - `apps/desktop/src/renderer/atoms/ui.ts` - precedent for transient UI atom state.
  - `apps/desktop/src/renderer/atoms/store.ts` - appStore access patterns.
  - `apps/desktop/src/renderer/hooks/use-session-chat.ts` - hook composition style in renderer.

  **Acceptance Criteria**:
  - [ ] Inspector state is accessible through a single provider/hook seam.
  - [ ] State resets correctly on exit and session switches.
  - [ ] Note drafts and selected targets are represented without coupling to view components.

  **QA Scenarios**:
  ```
  Scenario: Inspector state resets on exit
    Tool: Bash
    Preconditions: State provider/hooks and a targeted test or harness exist
    Steps:
      1. Simulate enabling inspector, selecting a target, entering a note, then disabling inspector
      2. Read state back through the hook test/harness
    Expected Result: Hover/selection/draft state resets per design while retained records behave as intended
    Failure Indicators: Stale selected target or note draft remains active after exit
    Evidence: .sisyphus/evidence/task-6-state-reset.txt

  Scenario: Session switch clears cross-session leakage
    Tool: Bash
    Preconditions: Session-aware state logic implemented
    Steps:
      1. Simulate inspector activity under one session context
      2. Switch to a second session context in test/harness
      3. Verify active selection/launch state does not leak incorrectly
    Expected Result: Session boundaries are respected
    Failure Indicators: Previous session capture appears as active state in another session
    Evidence: .sisyphus/evidence/task-6-session-scope.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-6-state-reset.txt`
  - [ ] `.sisyphus/evidence/task-6-session-scope.txt`

  **Commit**: NO

- [ ] 7. Implement DOM/fiber/source resolution helper pipeline

  **What to do**:
  - Build the dev-only resolution helper that takes a clicked/hovered DOM node and resolves inspection metadata.
  - Prefer a stable-first pipeline: nearest explicit instrumentation/source metadata first, then optional fiber walk for owner-chain enrichment and `_debugSource` fallback.
  - Normalize output for function components, memo, forwardRef, fragments, anonymous wrappers, and non-instrumented DOM.
  - Keep all internal React assumptions isolated and well-documented.

  **Must NOT do**:
  - Do not scatter `__reactFiber$` scanning across UI components.
  - Do not fail hard on unsupported nodes; return structured fallback states.
  - Do not expose raw fiber objects outside the helper boundary.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: nuanced resolution logic and internal React caveats.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: helpful for React runtime caveats and clean helper boundaries.
  - **Skills Evaluated but Omitted**:
    - `investigate`: useful if debugging unknown runtime failures; initial implementation is more design-heavy than incident response.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 8, 9, 10)
  - **Blocks**: 8, 9, 10, 11, 16, 18
  - **Blocked By**: 1, 4

  **References**:
  - `apps/desktop/src/renderer/vite.web.config.ts:30` - dev instrumentation source enabling assumptions.
  - `apps/desktop/electron.vite.config.ts:66` - matching Electron renderer dev instrumentation path.
  - `apps/desktop/src/renderer/components/side-panel/browser-cursor-overlay.tsx:37` - coordinate/overlay relationship with hovered targets.
  - `apps/desktop/src/renderer/lib/monaco.ts` - example of renderer helper encapsulation style for non-trivial library/runtime integration.

  **Acceptance Criteria**:
  - [ ] Common rendered elements resolve source path and component name in dev.
  - [ ] Unsupported cases return structured fallback info, not crashes.
  - [ ] Fiber ancestry, if included, is normalized into serializable metadata.

  **QA Scenarios**:
  ```
  Scenario: Instrumented component resolves source metadata
    Tool: Bash
    Preconditions: Resolution helper and a fixture/harness component exist
    Steps:
      1. Render a known component fixture in dev mode
      2. Pass its DOM node into the resolution helper
      3. Assert returned source file, component name, and line/column are present
    Expected Result: Source resolution succeeds for normal components
    Failure Indicators: Null metadata, wrong component name, or unhandled error
    Evidence: .sisyphus/evidence/task-7-source-resolution.txt

  Scenario: Unsupported node fails gracefully
    Tool: Bash
    Preconditions: Helper supports fallback path
    Steps:
      1. Pass a non-instrumented or synthetic DOM node to the helper
      2. Verify the helper returns a fallback status with explanation instead of throwing
    Expected Result: Graceful unresolved result
    Failure Indicators: Exception thrown or malformed fallback payload
    Evidence: .sisyphus/evidence/task-7-fallback-resolution.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-7-source-resolution.txt`
  - [ ] `.sisyphus/evidence/task-7-fallback-resolution.txt`

  **Commit**: YES
  - Message: `feat(inspector): resolve renderer targets to source context`

- [ ] 8. Implement inspect overlay, hover targeting, and click capture UX

  **What to do**:
  - Add the full-screen or app-surface overlay used during inspect mode.
  - Implement hover outlines, target hit-testing, click capture, and escape/cancel behavior.
  - Ensure the overlay works without permanently hijacking normal app interaction outside inspect mode.
  - Reuse existing overlay visual language where useful, but tune for UI-element inspection rather than browser cursor playback.

  **Must NOT do**:
  - Do not let the overlay remain interactive in production mode.
  - Do not block basic exit/escape paths.
  - Do not tightly couple hit-testing to one renderer route only.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: interaction-heavy overlay UX with dev-tool feel.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: helps keep interaction and rendering efficient.
  - **Skills Evaluated but Omitted**:
    - `visual-tdd`: could help later for polish, but not required for first implementation.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 9, 10)
  - **Blocks**: 9, 10, 14, 17, 18
  - **Blocked By**: 1, 4, 6, 7

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/browser-cursor-overlay.tsx:56` - existing overlay layering and badge treatment.
  - `apps/desktop/src/renderer/components/root-layout.tsx` - identify a root-level mount point for global overlay UI.
  - `apps/desktop/src/renderer/components/app-bar.tsx` - where the mode toggle may need to live near other global controls.

  **Acceptance Criteria**:
  - [ ] Enabling inspect mode visibly changes the app into an inspection state.
  - [ ] Hovering highlights the current candidate target.
  - [ ] Clicking captures the selected target and exits or advances according to the chosen UX.

  **QA Scenarios**:
  ```
  Scenario: Hover and click capture a visible target
    Tool: Browser automation
    Preconditions: Dev app running with inspector enabled
    Steps:
      1. Open Palot in dev mode
      2. Activate inspect mode via the UI button
      3. Hover a known visible component selector
      4. Assert highlight overlay appears around that element
      5. Click the element and verify a capture event/details surface appears
    Expected Result: Hover + click flow works end to end
    Failure Indicators: No highlight, wrong target, or click passes through without capture
    Evidence: .sisyphus/evidence/task-8-hover-click.png

  Scenario: Escape cancels inspect mode
    Tool: Browser automation
    Preconditions: Inspect mode active
    Steps:
      1. Press Escape while inspect mode is active
      2. Verify overlay disappears and normal interaction resumes
    Expected Result: Safe cancel path works
    Failure Indicators: Overlay remains stuck or app remains blocked
    Evidence: .sisyphus/evidence/task-8-escape-cancel.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-8-hover-click.png`
  - [ ] `.sisyphus/evidence/task-8-escape-cancel.txt`

  **Commit**: YES
  - Message: `feat(inspector): add dev inspect overlay`

- [ ] 9. Implement details panel/card for captured targets

  **What to do**:
  - Build the UI surface that shows the captured target’s component name, file path, line/column, and any owner-chain/context info.
  - Choose whether this lives inline, in a sheet/card/popover, or in an existing side panel area.
  - Make the surface readable and copy-friendly for developers without becoming a full devtools tree.
  - Include affordances for note entry and launch action handoff points, even if those actions are wired later.

  **Must NOT do**:
  - Do not turn the panel into a general component explorer.
  - Do not dump raw JSON as the primary UX.
  - Do not bury the key file/source data below noisy metadata.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: developer-facing information design and interaction layout.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: helps keep state/view separation clean.
  - **Skills Evaluated but Omitted**:
    - `vision-proof-review`: more useful after visual proof exists.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 10)
  - **Blocks**: 11, 14, 18
  - **Blocked By**: 6, 7, 8

  **References**:
  - `packages/ui/src/components/dialog.tsx` - if modal/sheet semantics are needed, use existing UI primitives.
  - `apps/desktop/src/renderer/components/side-panel/artifacts-panel.tsx:1` - existing detail-list surface pattern.
  - `apps/desktop/src/renderer/components/chat/context-items.tsx` - compact structured context display precedent.

  **Acceptance Criteria**:
  - [ ] Captured targets show key metadata in a readable hierarchy.
  - [ ] File path and component name are visible without expanding raw details.
  - [ ] Surface is ready for note + launch actions.

  **QA Scenarios**:
  ```
  Scenario: Captured target details render correctly
    Tool: Browser automation
    Preconditions: Inspect capture available
    Steps:
      1. Capture a known target in inspect mode
      2. Open or verify the details panel/card
      3. Assert visible text contains component name and source path
    Expected Result: Developer-relevant details are immediately visible
    Failure Indicators: Missing source path, collapsed hidden data, or unreadable formatting
    Evidence: .sisyphus/evidence/task-9-details-card.png

  Scenario: Long metadata remains usable
    Tool: Browser automation
    Preconditions: Fixture with long path/component ancestry available
    Steps:
      1. Capture a target with longer metadata values
      2. Verify the details UI truncates or wraps cleanly without obscuring the core path/name
    Expected Result: UI remains readable under longer values
    Failure Indicators: Overflow, clipped unreadable text, or layout breakage
    Evidence: .sisyphus/evidence/task-9-long-metadata.png
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-9-details-card.png`
  - [ ] `.sisyphus/evidence/task-9-long-metadata.png`

  **Commit**: NO

- [ ] 10. Implement failure-state UX for unresolved, anonymous, or uninstrumented targets

  **What to do**:
  - Add fallback UI/logic for targets that cannot resolve cleanly.
  - Distinguish between recoverable unresolved states (e.g. anonymous wrapper, no source metadata) and unsupported states.
  - Provide enough context for the user to understand why resolution failed and what still can be sent to a debug session.
  - Ensure unresolved cases can still be dismissed cleanly and do not poison later captures.

  **Must NOT do**:
  - Do not silently fail.
  - Do not crash or leave the overlay wedged.
  - Do not present misleading file/source certainty when the resolver is unsure.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: focused fallback-path UX and state handling.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: keeps fallback states explicit and predictable.
  - **Skills Evaluated but Omitted**:
    - `investigate`: not needed unless runtime failures become unclear.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9)
  - **Blocks**: 17, 18
  - **Blocked By**: 4, 7, 8

  **References**:
  - `apps/desktop/src/renderer/genui/genui-renderer.tsx:203` - error-block pattern for unsupported/invalid render cases.
  - `apps/desktop/src/renderer/components/chat/chat-tool-call.tsx` - current app style for rendering structured failures or fallback states.

  **Acceptance Criteria**:
  - [ ] Resolver failure states show explicit messaging.
  - [ ] User can dismiss or continue from unresolved captures.
  - [ ] No false certainty is shown for unknown component/source mappings.

  **QA Scenarios**:
  ```
  Scenario: Unresolved target shows explicit fallback UI
    Tool: Browser automation
    Preconditions: Resolver fallback case available
    Steps:
      1. Trigger inspect on a node intentionally lacking source metadata
      2. Verify the UI communicates unresolved status and available next actions
    Expected Result: Clear, non-crashing fallback UI appears
    Failure Indicators: Blank panel, crash, or misleading fake source path
    Evidence: .sisyphus/evidence/task-10-unresolved-ui.png

  Scenario: Failed capture does not poison next capture
    Tool: Browser automation
    Preconditions: One unresolved target and one resolvable target available
    Steps:
      1. Trigger an unresolved capture
      2. Dismiss it
      3. Capture a normal supported target
      4. Verify the second capture succeeds normally
    Expected Result: State recovers cleanly after failure path
    Failure Indicators: Stuck error state or subsequent captures fail incorrectly
    Evidence: .sisyphus/evidence/task-10-recovery-flow.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-10-unresolved-ui.png`
  - [ ] `.sisyphus/evidence/task-10-recovery-flow.txt`

  **Commit**: NO

- [ ] 11. Implement note/comment capture and structured payload assembly

  **What to do**:
  - Add the note entry flow for a captured target.
  - Assemble the final payload sent into self-debug sessions: resolved metadata, note text, UI hints, and any optional ancestry or selector data.
  - Keep payload assembly deterministic and serializable.
  - Support a minimal V1 flow: single selected capture is enough unless multi-capture queueing proves trivial.

  **Must NOT do**:
  - Do not build a full threaded commenting system.
  - Do not include noisy transient UI state irrelevant to debugging.
  - Do not let freeform notes overwrite structured resolved metadata.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: form capture + structured serialization.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: keeps form state + payload assembly cleanly separated.
  - **Skills Evaluated but Omitted**:
    - `writing`: note UX matters, but implementation is more structured state than prose.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 12, 13, 14, 15)
  - **Blocks**: 12, 13, 18
  - **Blocked By**: 1, 6, 7, 9

  **References**:
  - `apps/desktop/src/renderer/components/chat/context-items.tsx` - context-like structured data display and composition cues.
  - `apps/desktop/src/renderer/lib/types.ts` - likely home for payload record types.
  - `apps/desktop/src/renderer/components/review/review-comments.tsx` or adjacent review comment modules - precedent for user-authored feedback capture and serialization.

  **Acceptance Criteria**:
  - [ ] Note entry persists into the selected payload.
  - [ ] Payload assembly is deterministic and excludes irrelevant transient state.
  - [ ] Launch path can consume the payload without extra ad hoc mapping.

  **QA Scenarios**:
  ```
  Scenario: Note text is preserved in payload
    Tool: Bash
    Preconditions: Payload assembly helper and note UI/state implemented
    Steps:
      1. Create a representative capture with note text in a test or harness
      2. Build the final payload
      3. Assert note text and structured metadata both exist
    Expected Result: Payload contains both human note and structured source context
    Failure Indicators: Note dropped, overwritten metadata, or non-serializable payload
    Evidence: .sisyphus/evidence/task-11-payload-note.txt

  Scenario: Empty note still yields valid payload
    Tool: Bash
    Preconditions: Payload helper supports optional note
    Steps:
      1. Build a payload from a capture with no note text
      2. Verify payload remains valid and clearly indicates absent note
    Expected Result: Optional note path works
    Failure Indicators: Launch blocked or malformed payload when note is empty
    Evidence: .sisyphus/evidence/task-11-empty-note.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-11-payload-note.txt`
  - [ ] `.sisyphus/evidence/task-11-empty-note.txt`

  **Commit**: NO

- [ ] 12. Integrate captured inspection records into session-scoped artifact/state surfaces

  **What to do**:
  - Wire inspection captures into the chosen session-scoped storage/artifact surface.
  - Make captured inspections discoverable in the appropriate Palot UI surface if they should survive beyond the immediate details card.
  - Keep the integration narrow so the debug launcher can read from one stable place.
  - Ensure records update cleanly when a note changes or launch status changes.

  **Must NOT do**:
  - Do not break existing GenUI artifact behavior.
  - Do not add global persistence.
  - Do not create duplicate authoritative sources for the same capture.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: state-surface integration touching adjacent artifact systems.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: helps manage Jotai/state-surface complexity.
  - **Skills Evaluated but Omitted**:
    - `software-design-principles`: likely unnecessary if the integration remains narrow.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 13, 14, 15)
  - **Blocks**: 13, 18, 19
  - **Blocked By**: 3, 11

  **References**:
  - `apps/desktop/src/renderer/atoms/genui-artifacts.ts:76` - upsert/write action pattern.
  - `apps/desktop/src/renderer/components/side-panel/artifacts-panel.tsx:1` - current session artifact surfacing.
  - `docs/genui-artifact-architecture.md:242` - current artifact surfaces and constraints.

  **Acceptance Criteria**:
  - [ ] Captured inspection records are readable from one canonical session-scoped source.
  - [ ] Updating note/launch status updates the same record rather than duplicating it.
  - [ ] Existing artifact surfaces continue to function.

  **QA Scenarios**:
  ```
  Scenario: Capture record upserts instead of duplicating incorrectly
    Tool: Bash
    Preconditions: Capture-store integration implemented
    Steps:
      1. Create a capture record
      2. Update its note or launch status
      3. Read store state and confirm a single record was updated
    Expected Result: Stable record identity is preserved
    Failure Indicators: Duplicate records created for one captured target update
    Evidence: .sisyphus/evidence/task-12-record-upsert.txt

  Scenario: Existing artifact UI remains intact
    Tool: Browser automation
    Preconditions: App with existing artifacts and new inspection captures available
    Steps:
      1. Open the relevant artifact/session surface
      2. Verify existing artifact content still renders
      3. Verify inspection capture appears without breaking layout
    Expected Result: New integration does not regress prior artifact surface behavior
    Failure Indicators: Existing artifacts disappear, errors render, or layout breaks
    Evidence: .sisyphus/evidence/task-12-artifact-surface.png
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-12-record-upsert.txt`
  - [ ] `.sisyphus/evidence/task-12-artifact-surface.png`

  **Commit**: YES
  - Message: `feat(inspector): store captured inspections in session artifacts`

- [ ] 13. Implement self-debug session launcher and prompt dispatch

  **What to do**:
  - Wire the launch action so a captured inspection can create or focus an OpenCode session scoped to the Palot repo.
  - Send the structured prompt/payload into that session using the chosen launcher seam.
  - Surface launch progress, success, and failure states in the inspector UI.
  - Ensure launch uses the correct project directory and does not accidentally target another repo.

  **Must NOT do**:
  - Do not require manual copy/paste for V1 completion.
  - Do not bypass existing OpenCode integration primitives without cause.
  - Do not silently swallow launch errors.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: cross-cutting integration between new inspector flow and live session lifecycle.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: helps keep async UI state sane.
  - **Skills Evaluated but Omitted**:
    - `send-to-session`: more relevant if routing into already-running arbitrary sessions; V1 may only need local session create/send.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 12, 14, 15)
  - **Blocks**: 14, 18, 19
  - **Blocked By**: 2, 5, 11, 12

  **References**:
  - `apps/desktop/src/renderer/project-manager-launcher.ts:43` - closest end-to-end launcher analog.
  - `apps/desktop/src/renderer/hooks/use-server.ts:159` - createSession path.
  - `apps/desktop/src/renderer/hooks/use-server.ts:140` - promptAsync path.
  - `apps/desktop/src/renderer/services/connection-manager.ts` - repo/client scoping patterns.
  - `apps/desktop/src/renderer/components/project-manager.tsx` - UI expectations around launcher-driven session assignment if similar patterns are needed.

  **Acceptance Criteria**:
  - [ ] Launching from a capture starts or focuses a Palot-scoped OpenCode session.
  - [ ] The sent prompt contains the structured capture payload.
  - [ ] Success/failure state is visible to the user.

  **QA Scenarios**:
  ```
  Scenario: Launch action creates a Palot debug session with inspection payload
    Tool: Browser automation + Bash
    Preconditions: Dev app connected to OpenCode server and valid capture exists
    Steps:
      1. Capture a known target and enter a note
      2. Trigger the launch action
      3. Verify a new/focused session appears for the Palot project
      4. Read the session’s latest outbound prompt or message context if accessible
      5. Confirm source path, component, and note are included
    Expected Result: End-to-end launch succeeds with correct payload
    Failure Indicators: Wrong project session, missing prompt data, or silent failure
    Evidence: .sisyphus/evidence/task-13-launch-session.txt

  Scenario: Launch failure surfaces an actionable error
    Tool: Bash or Browser automation
    Preconditions: Simulate disconnected client or session create failure
    Steps:
      1. Trigger launch while the OpenCode connection is unavailable or mocked to fail
      2. Verify the UI shows an actionable error state
    Expected Result: User sees a clear launch failure message
    Failure Indicators: Spinner hangs forever or error disappears silently
    Evidence: .sisyphus/evidence/task-13-launch-failure.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-13-launch-session.txt`
  - [ ] `.sisyphus/evidence/task-13-launch-failure.txt`

  **Commit**: YES
  - Message: `feat(inspector): launch self-debug sessions from captures`

- [ ] 14. Add app entry controls, button placement, and dev gating polish

  **What to do**:
  - Add the visible dev-only entrypoint for inspector mode.
  - Place it in a discoverable but not noisy location such as the app bar, command palette, or other dev-only control cluster.
  - Ensure button visibility and route availability are gated to dev.
  - Add any small UX polish needed so the flow feels intentional: active state, labels, small helper text.

  **Must NOT do**:
  - Do not expose the button in production.
  - Do not clutter the primary product surface for non-dev users.
  - Do not scatter multiple competing entrypoints unless intentionally designed.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: product-surface placement and affordance tuning.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: keeps control wiring clean.
  - **Skills Evaluated but Omitted**:
    - `brainstorm-ideas-existing`: idea generation phase is already done; task is execution-focused.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 12, 13, 15)
  - **Blocks**: 18
  - **Blocked By**: 6, 8, 9, 13

  **References**:
  - `apps/desktop/src/renderer/components/app-bar.tsx` - likely top-level button placement seam.
  - `apps/desktop/src/renderer/components/command-palette.tsx` - optional secondary discoverability path.
  - `apps/desktop/src/renderer/hooks/use-app-info.ts` or env gating helpers - for dev-only UI decisions.

  **Acceptance Criteria**:
  - [ ] A dev-only inspector entrypoint is visible in development.
  - [ ] The control reflects active/inactive inspector state.
  - [ ] The control is absent or disabled outside dev.

  **QA Scenarios**:
  ```
  Scenario: Dev control appears only in dev mode
    Tool: Browser automation + Bash
    Preconditions: Dev runtime and production-like build/runtime available
    Steps:
      1. Open the app in dev mode and verify the inspector control is visible
      2. Open the app in production-like mode or inspect built output and verify the control is absent/inert
    Expected Result: Correct environment gating of the entrypoint
    Failure Indicators: Control visible in production or missing in dev
    Evidence: .sisyphus/evidence/task-14-dev-control.txt

  Scenario: Control reflects active inspector state
    Tool: Browser automation
    Preconditions: Dev app running
    Steps:
      1. Click the inspector control to enable inspect mode
      2. Verify active visual state/label appears
      3. Disable inspect mode and verify state clears
    Expected Result: Clear active/inactive affordance exists
    Failure Indicators: No state change feedback or mismatched status
    Evidence: .sisyphus/evidence/task-14-control-state.png
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-14-dev-control.txt`
  - [ ] `.sisyphus/evidence/task-14-control-state.png`

  **Commit**: YES
  - Message: `feat(inspector): add dev entrypoint for self-inspection`

- [ ] 15. Add editor/open-file or source-jump affordance if needed by UX

  **What to do**:
  - If the chosen UX benefits from it, add a small affordance to open the resolved source file/location in the user’s editor or through an existing open-in flow.
  - Reuse existing secure preload/main patterns if renderer cannot perform the action directly.
  - Keep this optional-to-use but available from the captured target details.

  **Must NOT do**:
  - Do not make editor integration a blocker for the core self-debug session launch.
  - Do not add insecure direct filesystem/editor shell calls from the renderer.
  - Do not couple this to one specific editor vendor.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded utility integration.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: keeps UI affordance and async wiring light.
  - **Skills Evaluated but Omitted**:
    - `shell-config`: not needed unless editor command plumbing becomes shell-centric.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 12, 13, 14)
  - **Blocks**: 18, 19
  - **Blocked By**: 7, 9

  **References**:
  - `apps/desktop/src/preload/index.ts:237` - open-in preload bridge pattern.
  - `apps/desktop/src/main/ipc-handlers.ts:438` and adjacent open-in handlers later in file - how renderer requests main-process actions.
  - `apps/desktop/src/renderer/components/side-panel/files-panel.tsx` - nearby file/action surfacing conventions if applicable.

  **Acceptance Criteria**:
  - [ ] Optional source-jump action exists if adopted by the UX.
  - [ ] Action routes through approved preload/main boundaries.
  - [ ] Core inspector flow still works if source-jump is unused.

  **QA Scenarios**:
  ```
  Scenario: Source-jump action requests correct file target
    Tool: Bash or Browser automation
    Preconditions: Source-jump affordance implemented and a resolved target exists
    Steps:
      1. Capture a target with a known source path
      2. Trigger the source-jump affordance
      3. Verify the correct main/preload call or handler input was produced
    Expected Result: Correct file/location is targeted
    Failure Indicators: Wrong path, missing location info, or insecure direct renderer shelling
    Evidence: .sisyphus/evidence/task-15-source-jump.txt

  Scenario: Core flow works without using source-jump
    Tool: Browser automation
    Preconditions: Same capture flow available
    Steps:
      1. Capture a target and launch self-debug without touching source-jump
      2. Verify normal launch still succeeds
    Expected Result: Source-jump is optional, not blocking
    Failure Indicators: Launch depends on source-jump or UI state gets stuck
    Evidence: .sisyphus/evidence/task-15-optional-flow.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-15-source-jump.txt`
  - [ ] `.sisyphus/evidence/task-15-optional-flow.txt`

  **Commit**: NO

- [ ] 16. Add targeted tests for source resolution and payload formatting

  **What to do**:
  - Add targeted tests for the core resolution helper and prompt/payload formatting logic.
  - Cover normal resolution, fallback resolution, empty note, and deterministic prompt formatting.
  - Keep tests focused on pure/helper logic where possible for speed and reliability.

  **Must NOT do**:
  - Do not overbuild a giant UI test suite here.
  - Do not skip fallback-path assertions.
  - Do not rely only on manual/browser proof for core serialization logic.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded helper-level tests.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: helpful for testing React-adjacent helpers cleanly.
  - **Skills Evaluated but Omitted**:
    - `visual-tdd`: this task is logic-first, not visual.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 17, 18, 19)
  - **Blocks**: FINAL
  - **Blocked By**: 7, 11

  **References**:
  - Existing repo test patterns near `packages/configconv/test/*` for command style and assertions.
  - Any new inspector helper modules created in Tasks 7 and 11.

  **Acceptance Criteria**:
  - [ ] Tests cover normal and fallback resolution.
  - [ ] Tests cover empty-note and populated-note payload formatting.
  - [ ] Tests are runnable through declared repo tooling.

  **QA Scenarios**:
  ```
  Scenario: Targeted inspector tests pass
    Tool: Bash
    Preconditions: Tests added
    Steps:
      1. Run the targeted inspector test command(s)
      2. Verify all assertions pass
    Expected Result: Helper-level coverage passes
    Failure Indicators: Failing source-resolution or payload-format tests
    Evidence: .sisyphus/evidence/task-16-tests.txt

  Scenario: Fallback assertions are present
    Tool: Bash
    Preconditions: Tests added
    Steps:
      1. Read or grep the test files for fallback/unresolved case coverage
      2. Confirm fallback behavior is explicitly asserted
    Expected Result: Non-happy-path coverage exists
    Failure Indicators: Only success-path tests present
    Evidence: .sisyphus/evidence/task-16-fallback-coverage.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-16-tests.txt`
  - [ ] `.sisyphus/evidence/task-16-fallback-coverage.txt`

  **Commit**: NO

- [ ] 17. Add targeted tests for overlay state and fallback paths

  **What to do**:
  - Add focused tests for overlay state transitions, cancel behavior, and unresolved target recovery.
  - Cover enable -> hover/select -> cancel/reset, and unresolved -> dismiss -> successful next capture.
  - Use component or state-level tests as appropriate.

  **Must NOT do**:
  - Do not rely only on manual ad hoc checking.
  - Do not ignore stuck-state regressions.
  - Do not couple tests too tightly to visual pixel styling.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded behavioral test coverage.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: helps keep state-transition tests focused.
  - **Skills Evaluated but Omitted**:
    - `visual-tdd`: visual diffing is unnecessary for this behavioral layer.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 16, 18, 19)
  - **Blocks**: FINAL
  - **Blocked By**: 6, 8, 10

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/browser-cursor-overlay.test.tsx` - nearby overlay test precedent.
  - `apps/desktop/src/renderer/components/side-panel/browser-geometry-reconciliation.test.tsx` - test organization/style precedent.

  **Acceptance Criteria**:
  - [ ] Cancel/reset path is covered.
  - [ ] Unresolved recovery path is covered.
  - [ ] Tests assert state/behavior, not only snapshots.

  **QA Scenarios**:
  ```
  Scenario: Overlay behavior tests pass
    Tool: Bash
    Preconditions: Tests added
    Steps:
      1. Run the targeted overlay/state test command(s)
      2. Verify enable/cancel/reset assertions pass
    Expected Result: Core overlay behavior is covered and passing
    Failure Indicators: Stuck-state regressions or failing cancel behavior tests
    Evidence: .sisyphus/evidence/task-17-overlay-tests.txt

  Scenario: Recovery path test exists and passes
    Tool: Bash
    Preconditions: Tests added
    Steps:
      1. Run or inspect the unresolved recovery test case
      2. Confirm it covers failed capture followed by successful next capture
    Expected Result: Recovery path explicitly covered
    Failure Indicators: No recovery assertion or failing recovery flow
    Evidence: .sisyphus/evidence/task-17-recovery-tests.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-17-overlay-tests.txt`
  - [ ] `.sisyphus/evidence/task-17-recovery-tests.txt`

  **Commit**: NO

- [ ] 18. Add end-to-end dev verification flow for browser-mode and Electron

  **What to do**:
  - Verify the complete inspect -> capture -> note -> launch flow in both browser-mode and Electron dev runtime.
  - Add any thin harnesses/scripts needed so this can be re-run reliably by agents.
  - Capture proof artifacts for source resolution, UI state, and successful debug-session launch.
  - Ensure repo-approved dev service management is used.

  **Must NOT do**:
  - Do not verify only one runtime surface.
  - Do not require manual human intervention as the only proof.
  - Do not leave verification as an undocumented one-off process.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: broad integration verification across runtime modes.
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: useful, though this is primarily integration verification.
  - **Skills Evaluated but Omitted**:
    - `devmux`: useful operationally, but the task plan itself only needs to respect repo-managed service commands.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 16, 17, 19)
  - **Blocks**: FINAL
  - **Blocked By**: 2, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15

  **References**:
  - `AGENTS.md` - repo runtime policy requiring devmux-managed services.
  - `apps/desktop/src/renderer/vite.web.config.ts:1` - browser-mode dev context.
  - `apps/desktop/electron.vite.config.ts:40` - Electron dev context.
  - `apps/desktop/src/preload/index.ts:34` - preload capabilities available in Electron runtime.

  **Acceptance Criteria**:
  - [ ] Browser-mode end-to-end flow verified.
  - [ ] Electron dev end-to-end flow verified.
  - [ ] Evidence artifacts clearly show the flow succeeded in both modes.

  **QA Scenarios**:
  ```
  Scenario: Browser-mode full self-debug flow works
    Tool: Browser automation + Bash
    Preconditions: Repo dev services running via approved commands
    Steps:
      1. Open Palot browser-mode dev UI
      2. Activate inspect mode
      3. Capture a known target
      4. Add a note
      5. Launch a self-debug session
      6. Verify the resulting session contains the expected context
    Expected Result: Full browser-mode loop succeeds
    Failure Indicators: Any step fails, source resolution missing, or session payload incomplete
    Evidence: .sisyphus/evidence/task-18-browser-e2e.txt

  Scenario: Electron dev full self-debug flow works
    Tool: Electron automation or equivalent + Bash
    Preconditions: Electron dev runtime running
    Steps:
      1. Open Palot Electron dev app
      2. Repeat the inspect -> capture -> note -> launch flow
      3. Verify launch succeeds and context is preserved
    Expected Result: Full Electron loop succeeds
    Failure Indicators: Renderer-only assumptions break in Electron, preload issues, or session launch failure
    Evidence: .sisyphus/evidence/task-18-electron-e2e.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-18-browser-e2e.txt`
  - [ ] `.sisyphus/evidence/task-18-electron-e2e.txt`

  **Commit**: YES
  - Message: `test(inspector): verify self-debug flow across dev runtimes`

- [ ] 19. Document feature, guardrails, and developer workflow in repo docs/wiki

  **What to do**:
  - Update the relevant repo docs/wiki with how the dev inspector works, where the instrumentation lives, what is dev-only, and known limits of the fiber/source resolution path.
  - Document how to run and verify the feature in both browser-mode and Electron dev.
  - Record any future-scope notes separately from V1 behavior.

  **Must NOT do**:
  - Do not leave the feature undocumented.
  - Do not imply production support exists.
  - Do not bury key caveats like unstable React internals.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: durable project knowledge capture.
  - **Skills**: [`caveman`]
    - `caveman`: keeps operational docs short and sharp.
  - **Skills Evaluated but Omitted**:
    - `deep-research`: unnecessary; docs should reflect implemented local behavior.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 16, 17, 18)
  - **Blocks**: FINAL
  - **Blocked By**: 5, 12, 13, 15

  **References**:
  - `docs/genui-artifact-architecture.md` - if inspector records intersect artifact architecture, note the relationship.
  - `AGENTS.md` - add only durable operational sharp edges, not broad feature docs.
  - `.llm/wiki/` if present - canonical repo docs surface for durable architecture notes.

  **Acceptance Criteria**:
  - [ ] Docs explain dev-only scope and known limits.
  - [ ] Docs explain how to run and verify the feature.
  - [ ] Future-scope ideas are clearly separated from shipped behavior.

  **QA Scenarios**:
  ```
  Scenario: Docs cover dev-only scope and run path
    Tool: Bash
    Preconditions: Docs updated
    Steps:
      1. Read the new/updated documentation
      2. Verify it includes where the instrumentation lives, how to run it, and that it is dev-only
    Expected Result: Operator can understand and rerun the feature from docs alone
    Failure Indicators: Missing run instructions or unclear scope caveats
    Evidence: .sisyphus/evidence/task-19-doc-audit.txt

  Scenario: Docs disclose fiber/source caveats
    Tool: Bash
    Preconditions: Docs updated
    Steps:
      1. Search the docs for caveats around unstable React internals and fallback behavior
      2. Confirm limitations are explicitly stated
    Expected Result: Known sharp edges are documented
    Failure Indicators: Docs imply perfect/stable full inspection with no caveats
    Evidence: .sisyphus/evidence/task-19-caveats.txt
  ```

  **Evidence to Capture**:
  - [ ] `.sisyphus/evidence/task-19-doc-audit.txt`
  - [ ] `.sisyphus/evidence/task-19-caveats.txt`

  **Commit**: NO

---

## Final Verification Wave <!-- oc:id=sec_am -->

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit okay before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. Verify dev-only inspector gating, overlay flow, payload contract, session launch path, and documentation outputs all exist. Confirm evidence files for inspection capture and debug-session launch scenarios exist.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run repo typecheck/lint and any new targeted tests. Review changed files for unstable internal React access being isolated behind helpers, no production leakage, no dead dev code, and no duplicate state surfaces.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Execute every QA scenario from implementation tasks in browser-mode and Electron dev runtime. Capture evidence for hover, click, note capture, fallback handling, and debug session launch.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Compare actual implementation against the plan. Confirm no production enablement, no full DevTools scope creep, and no unrelated browser-lane systems were entangled.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- Group foundation and runtime work into coherent commits, keeping instrumentation/config changes separate from UI/UX changes where practical.
- Land verification/docs updates with the feature if they are feature-specific.

## Success Criteria

### Verification Commands
```bash
bun run lint
bun run check-types
bun run dev
# plus targeted test commands added by implementation
```

### Final Checklist
- [ ] Dev-only inspect toggle exists and is inaccessible in production mode
- [ ] Clicking a renderer element resolves useful source/component context for common cases
- [ ] Failed resolution path shows graceful fallback UI
- [ ] Captured note + inspection payload can launch a Palot-scoped OpenCode debug session
- [ ] Browser-mode and Electron dev flows both verified with evidence