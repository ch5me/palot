# Palot OpenCode Plugin Bridge Completion Plan <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> Finish the Palot/OpenCode seam from current repo state by closing the callback hydration gap, deciding plugin injection policy, hardening the contract with shared Zod schemas, completing real browser action dispatch, and proving one end-to-end execution path.
>
> Deliverables:
> - verified host-runtime callback hydration path for the Palot bridge plugin
> - explicit plugin injection policy for managed vs pre-existing OpenCode servers
> - shared Zod-backed runtime seam schemas
> - completed browser action runtime for click/type/scroll
> - one executable end-to-end verification lane
>
> Estimated Effort: Medium
> Parallel Execution: YES - 3 main waves
> Critical Path: runtime callback hydration -> schema hardening -> real action dispatch -> end-to-end proof

---

## Context

### Original Request
Create a shorter, completion-oriented plan for the remaining Palot/OpenCode plugin bridge work so everything left is visible in `.sisyphus/plans/`.

### Current State
- Canonical seam doc exists: `docs/palot-opencode-plugin-bridge.md`
- Managed OpenCode spawn injects plugin via `OPENCODE_PLUGIN`: `apps/desktop/src/main/opencode-manager.ts`
- Plugin exists and exposes browser/UI tools: `apps/desktop/.opencode/plugins/palot-bridge.js`
- Main-owned binding/snapshot/action infrastructure exists:
  - `apps/desktop/src/main/palot-session-binding.ts`
  - `apps/desktop/src/main/palot-resolver.ts`
  - `apps/desktop/src/main/palot-browser-ipc.ts`
  - `apps/desktop/src/main/palot-browser-dispatcher.ts`
- IPC/preload/renderer side-panel bridge exists:
  - `apps/desktop/src/main/ipc-handlers.ts`
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/renderer/services/backend.ts`
  - `apps/desktop/src/renderer/components/agent-detail.tsx`

### Main Gaps
- Host-runtime callback hydration path into `createPalotPlugin({ resolve, dispatch, getUiState, openSidePanel })` is still not fully proven.
- Plugin injection is guaranteed only for Palot-managed servers, not attached long-lived existing servers.
- Browser tools `click/type/scroll` are still not fully real runtime actions.
- Runtime seam is mostly TypeScript-typed, not Zod-validated.
- End-to-end verification is not yet a single proved lane.

### Scope Decision
This is a completion plan, not a greenfield redesign plan.

IN:
- runtime callback seam
- injection policy
- shared schemas
- browser action completion
- end-to-end proof
- doc updates needed to reflect reality

OUT:
- broad product redesign
- unrelated MCP/runtime surface work
- broad UX polish beyond proving the seam
- speculative multi-browser architecture expansion

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Turn the current partial Palot/OpenCode bridge into a verified, durable runtime seam that consistently loads, validates, dispatches, and proves the Palot browser/UI control path.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- One verified path showing where and how the Palot plugin receives runtime callbacks.
- One explicit policy for how plugin loading works on managed and non-managed OpenCode servers.
- One shared schema module used at the bridge boundaries.
- Real implementations for the remaining browser action tools or explicit typed rejection behavior if a runtime lane is unavailable.
- One end-to-end executable verification path with evidence.

### Definition of Done <!-- oc:id=sec_af -->
- [x] Callback hydration path is implemented or decisively documented with live proof.
- [x] Managed-vs-attached plugin behavior is explicit and reflected in docs/config.
- [x] Shared Zod schemas validate tool args, resolver output, dispatcher input, IPC payloads, and binding JSON.
- [x] `palot_browser_click`, `palot_browser_type`, and `palot_browser_scroll` are either real dispatches or explicitly typed unsupported states with verified behavior.
- [x] One test flow proves plugin load, context injection, side-panel opening, and browser navigation/action-event flow.

### Must Have <!-- oc:id=sec_ag -->
- No ambiguity about where plugin callbacks come from.
- No schema-free bridge at critical boundaries.
- No silent mismatch between docs and runtime behavior.
- No claim of support for pre-existing servers unless actually implemented.

### Must NOT Have <!-- oc:id=sec_ah -->
- No second giant architecture rewrite.
- No new localhost sidecar.
- No renderer-owned authority for binding resolution.
- No secret/token exposure in plugin output, renderer state, or persisted binding JSON.
- No human-only verification criteria.

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES, partial
- **Automated tests**: Tests-after
- **Framework**: Bun / node tests where already present, plus repo checks
- **Agent-Executed QA**: Mandatory

### Verification Commands
- `bun run lint`
- `bun run check-types`
- targeted plugin tests
- targeted main-process tests
- one managed runtime proof flow

### QA Policy
Every completion task must include agent-executed verification and evidence under `.sisyphus/evidence/`.

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Parallel Execution Waves <!-- oc:id=sec_aj -->

Wave 1 (resolve hard seam + policy):
- T1. Runtime callback hydration proof and implementation
- T2. Plugin injection policy decision and implementation
- T3. Schema inventory and shared Zod module skeleton

Wave 2 (runtime hardening):
- T4. Zod integration across plugin/main/IPC/persistence
- T5. Real browser action completion for click/type/scroll
- T6. Docs and runtime consistency sweep

Wave 3 (proof):
- T7. End-to-end managed-server verification lane
- T8. Attached/pre-existing server behavior verification or explicit fallback UX

Wave FINAL:
- F1. Plan compliance audit
- F2. Code quality + repo verification
- F3. Real QA replay
- F4. Scope fidelity review

Critical Path: T1 -> T4 -> T5 -> T7 -> Final

### Dependency Matrix <!-- oc:id=sec_ak -->
- T1: none -> T4, T7
- T2: none -> T6, T8
- T3: none -> T4
- T4: T1, T3 -> T5, T7
- T5: T4 -> T7
- T6: T2 -> Final
- T7: T1, T4, T5 -> Final
- T8: T2 -> Final

---

## TODOs

- [x] 1. Runtime callback hydration proof and implementation

  **What to do**:
  - Trace the exact host-runtime path that turns the plugin file into a live Palot bridge instance with `resolve`, `dispatch`, `getUiState`, and `openSidePanel` callbacks.
  - If that path is missing, implement the smallest correct bridge so the plugin is instantiated with Palot-owned callbacks at runtime.
  - Prove the live runtime path with evidence, not only source inspection.
  - Update `docs/palot-opencode-plugin-bridge.md` to replace uncertainty with confirmed truth.

  **Must NOT do**:
  - Do not assume `OPENCODE_PLUGIN` alone proves callback hydration.
  - Do not hide unresolved wiring behind docs-only language.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: T4, T7
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/main/opencode-manager.ts`
  - `apps/desktop/.opencode/plugins/palot-bridge.js`
  - `apps/desktop/src/main/palot-opencode-plugin-shim.ts`
  - `docs/palot-opencode-plugin-bridge.md`

  **Acceptance Criteria**:
  - [ ] Exact runtime callback path is identified.
  - [ ] If missing, bridge implementation is landed.
  - [ ] Documentation reflects proven runtime truth.

  **QA Scenarios**:
  Scenario: Callback hydration proof
    Tool: Bash / targeted test or runtime proof
    Preconditions: managed Palot/OpenCode server path available
    Steps:
      1. Start the managed OpenCode server through Palot.
      2. Verify the plugin loads.
      3. Verify a plugin tool or system transform uses live Palot callback-backed data.
    Expected Result: proof that runtime callbacks are real, not only scaffolded.
    Evidence: `.sisyphus/evidence/task-1-runtime-callback-proof.md`

- [x] 2. Plugin injection policy decision and implementation

  **What to do**:
  - Decide and codify one policy:
    - managed-server only, with explicit behavior for attached servers, or
    - support attached/pre-existing servers via install/config path.
  - Implement the policy.
  - Ensure the UI/docs do not imply stronger guarantees than reality.

  **Must NOT do**:
  - Do not leave attached-server behavior ambiguous.
  - Do not claim global plugin availability unless actually implemented.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: T6, T8
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/main/opencode-manager.ts`
  - `docs/palot-opencode-plugin-bridge.md`

  **Acceptance Criteria**:
  - [ ] Policy is explicit in code/docs.
  - [ ] Attached-server behavior is verified or intentionally unsupported with clear handling.

  **QA Scenarios**:
  Scenario: Managed vs attached behavior
    Tool: Bash
    Steps:
      1. Verify managed spawn path loads plugin.
      2. Verify attached pre-existing server behavior matches documented policy.
    Expected Result: no ambiguity between implementation and documentation.
    Evidence: `.sisyphus/evidence/task-2-injection-policy.md`

- [x] 3. Shared Zod schema module skeleton

  **What to do**:
  - Introduce a shared schema module for the Palot/OpenCode seam.
  - Define initial schemas for tool args, resolver output, dispatcher input, IPC payloads, and persisted binding JSON.
  - Keep ownership narrow and reusable across plugin/main/preload boundaries.

  **Must NOT do**:
  - Do not scatter duplicate shape definitions.
  - Do not create one-off per-file validators for the same contract.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: T4
  - **Blocked By**: None

  **References**:
  - `docs/palot-opencode-plugin-bridge.md:428`
  - `apps/desktop/src/preload/api.d.ts`
  - `apps/desktop/.opencode/plugins/palot-bridge.js`

  **Acceptance Criteria**:
  - [ ] Shared schema module exists.
  - [ ] Target contract boundaries are represented.

  **QA Scenarios**:
  Scenario: Schema compile smoke
    Tool: `bun run check-types`
    Expected Result: schema module integrates cleanly.
    Evidence: `.sisyphus/evidence/task-3-schema-skeleton.md`

- [x] 4. Zod integration across plugin, main, IPC, and persistence

  **What to do**:
  - Wire the shared schemas into live runtime paths.
  - Validate plugin tool args before execution.
  - Validate resolver payload shape passed into plugin hooks.
  - Validate browser dispatcher input before branching.
  - Validate IPC payloads in main handlers.
  - Validate persisted binding store file before use.

  **Must NOT do**:
  - Do not leave “fake schema” markers in the plugin for completed tools.
  - Do not validate only at the edge while leaving persistence unsafe.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: T5, T7
  - **Blocked By**: T1, T3

  **References**:
  - `apps/desktop/.opencode/plugins/palot-bridge.js`
  - `apps/desktop/src/main/palot-browser-dispatcher.ts`
  - `apps/desktop/src/main/ipc-handlers.ts`
  - `apps/desktop/src/main/palot-session-binding.ts`

  **Acceptance Criteria**:
  - [ ] All major seam boundaries parse shared Zod schemas.
  - [ ] Invalid inputs fail with typed errors.

  **QA Scenarios**:
  Scenario: Invalid payload rejection
    Tool: targeted tests
    Steps:
      1. Pass malformed plugin args / IPC payloads / persisted JSON fixtures.
      2. Assert typed failure, not silent acceptance.
    Expected Result: invalid contract inputs are rejected deterministically.
    Evidence: `.sisyphus/evidence/task-4-zod-integration.md`

- [x] 5. Real browser action completion for click/type/scroll

  **What to do**:
  - Implement actual runtime dispatch for `palot_browser_click`, `palot_browser_type`, and `palot_browser_scroll`, or explicitly map them to supported failure states if a prerequisite runtime lane is absent.
  - Ensure request/result action events still publish correctly.
  - Preserve takeover and geometry-low-confidence typed behavior.

  **Must NOT do**:
  - Do not leave tool names advertised as working while remaining no-ops.
  - Do not bypass the action bus.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: T7
  - **Blocked By**: T4

  **References**:
  - `apps/desktop/src/main/palot-browser-dispatcher.ts`
  - `apps/desktop/src/main/palot-browser-ipc.ts`
  - `apps/desktop/.opencode/plugins/palot-bridge.js`

  **Acceptance Criteria**:
  - [ ] Click/type/scroll behavior is either real or explicitly typed unsupported.
  - [ ] Action event flow stays correct.

  **QA Scenarios**:
  Scenario: Browser action dispatch
    Tool: targeted tests / runtime proof
    Steps:
      1. Trigger each browser tool.
      2. Assert request/result events and runtime outcome.
    Expected Result: no silent placeholder behavior.
    Evidence: `.sisyphus/evidence/task-5-browser-actions.md`

- [x] 6. Docs and runtime consistency sweep

  **What to do**:
  - Update canonical docs after T1-T5 are true.
  - Ensure `AGENTS.md` breadcrumbs still point to the right doc.
  - Remove uncertainty language that is no longer true, and add explicit caveats where still needed.

  **Must NOT do**:
  - Do not leave drift between docs and runtime.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: Final
  - **Blocked By**: T2

  **References**:
  - `docs/palot-opencode-plugin-bridge.md`
  - `AGENTS.md`

  **Acceptance Criteria**:
  - [ ] Docs reflect actual runtime truth.
  - [ ] No stale caveats or false guarantees remain.

  **QA Scenarios**:
  Scenario: Doc/code alignment review
    Tool: Read + grep
    Expected Result: every major documented claim maps to live code or an explicit caveat.
    Evidence: `.sisyphus/evidence/task-6-doc-alignment.md`

- [ ] 7. End-to-end managed-server verification lane

  **What to do**:
  - Build one executable proof flow for the managed path.
  - Prove the full chain:
    - Palot-managed OpenCode server starts with plugin
    - `experimental.chat.system.transform` injects Palot context
    - `palot_open_side_panel` visibly opens a requested side panel tab
    - `palot_browser_navigate` emits request/result events and navigates the lane
  - Capture evidence suitable for future regression checks.

  **Must NOT do**:
  - Do not stop at unit tests.
  - Do not rely on hand-wavy “should work” reasoning.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Final
  - **Blocked By**: T1, T4, T5

  **References**:
  - `docs/palot-opencode-plugin-bridge.md:497`
  - `apps/desktop/.opencode/plugins/palot-bridge.js`
  - `apps/desktop/src/main/opencode-manager.ts`

  **Acceptance Criteria**:
  - [ ] Managed path is proven live end-to-end.
  - [ ] Evidence captures each step in the chain.

  **QA Scenarios**:
  Scenario: Managed runtime proof
    Tool: managed runtime + evidence capture
    Steps:
      1. Start Palot-managed server.
      2. Verify plugin load.
      3. Verify context injection.
      4. Trigger side-panel open tool.
      5. Trigger browser navigate tool.
      6. Assert visible UI and event-bus results.
    Expected Result: end-to-end success on managed path.
    Evidence: `.sisyphus/evidence/task-7-managed-e2e.md`

- [x] 8. Attached/pre-existing server behavior verification or fallback UX

  **What to do**:
  - Verify the attached-server path against the chosen policy.
  - If attached servers are unsupported for the bridge, ensure the app presents a clear status/fallback instead of pretending support.
  - If supported, prove how the plugin is installed/loaded there too.

  **Must NOT do**:
  - Do not leave the attached path undefined.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Blocks**: Final
  - **Blocked By**: T2

  **References**:
  - `apps/desktop/src/main/opencode-manager.ts`
  - `docs/palot-opencode-plugin-bridge.md`

  **Acceptance Criteria**:
  - [ ] Attached-server path matches documented policy.
  - [ ] Unsupported path has explicit UX or operator guidance.

  **QA Scenarios**:
  Scenario: Attached-server policy proof
    Tool: runtime verification
    Steps:
      1. Connect Palot to a pre-existing server.
      2. Confirm whether plugin features are available or intentionally unavailable.
    Expected Result: exact match with documented policy.
    Evidence: `.sisyphus/evidence/task-8-attached-policy.md`

---

## Final Verification Wave <!-- oc:id=sec_al -->

- [x] F1. Plan compliance audit
  Verify every completion objective above has code and evidence.

- [x] F2. Code quality review
  Run repo checks and inspect for contract duplication, fake schemas, and secret leakage.

- [x] F3. Real QA replay
  Re-run the managed proof flow and attached-server policy proof from clean state.

- [x] F4. Scope fidelity review
  Confirm work stayed inside completion scope and did not sprawl into unrelated product work.

---

## Commit Strategy

- Group by seam where possible:
  - runtime bridge
  - schema hardening
  - browser actions
  - docs/proof

---

## Success Criteria <!-- oc:id=sec_am -->

### Final Checklist <!-- oc:id=sec_an -->
- [x] Runtime callback hydration path is proven.
- [x] Injection policy is explicit.
- [x] Zod-backed shared seam exists and is used.
- [x] Remaining browser actions are real or explicitly unsupported.
- [x] Managed path is proven end-to-end.
- [x] Attached/pre-existing path is explicit and verified.
- [x] Canonical docs match runtime truth.
