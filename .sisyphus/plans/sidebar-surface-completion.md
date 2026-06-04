# Sidebar Surface Completion Plan <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->
> Complete the remaining non-final side-panel surfaces by turning the current browser, Claude, and memory placeholders/partials into credible product lanes; hide CRM for now; keep CH5PM and Pulse deferred.
>
> Primary thrust:
> - Browser: Hub-style same-origin browser lane architecture, starting with simple embedded view only
> - Claude: AIOS-style live Claude Code lane over tmux/PTY streaming
> - Memory: file-tree + markdown editor on top of Palot memory service
>
> Deliverables:
> - Browser lane subsystem + same-origin route publishing plan
> - Live Claude surface plan using existing PTY/oracle seams
> - Memory surface simplification plan
> - Reveal/hide/default-on policy for surfaces
>
> Effort: Large
> Parallel: YES — 4 waves
> Critical Path: Browser architecture -> Claude runtime lane -> Memory editor lane -> surface reveal + QA

## Context <!-- oc:id=sec_ac -->

### Original request <!-- oc:id=sec_ad -->
User wants a plan for all sidebar surfaces that are still hidden, partial, stubbed, bounded, or blocked by missing backend/runtime work. Browser is top priority. Memory should become simpler and usable. Claude should become a real live connector. CRM should be hidden. Pulse should remain deferred. CH5PM remains placeholder/deferred.

### Clarified product decisions <!-- oc:id=sec_ae -->
- Browser starts simpler than long-term vision:
  - Electron mode: embedded browser surface
  - Browser mode: same-origin iframe/browser-stream fallback
  - No agent control required in first implementation slice
  - No direct provider-site iframe architecture
- Claude should mirror prior AIOS behavior as closely as practical:
  - Real Claude Code / Claude CLI running in tmux/PTY lane
  - Surface streams live output
  - Text box sends commands into the running Claude session
  - Compat/import affordances must either stay visible somewhere or be intentionally relocated
- Memory should not be a complex memory-ops cockpit for now:
  - hierarchical memory file tree
  - markdown editor
  - reuse files/editor components where possible
- Plugins stay inventory-only
- Pulse stays deferred
- CRM hidden
- CH5PM deferred until product intent clearer

### Research findings <!-- oc:id=sec_af -->
- Side-panel registry source of truth: `apps/desktop/src/renderer/firefly-surface-registry.tsx`
- Current off-by-default surfaces: browser, pulse, memory, ch5pm
- Browser currently works only as Electron-side embedded browser; browser-mode inline view is absent
- Claude current panel is compatibility/import boundary only; no live runtime
- Browser implementation should explicitly copy Hub browser-lane principles: owned same-origin stream surface, separate stream plane from future control plane, persistent lane/profile model
- Palot already has strong PTY/tmux/oracle seams:
  - `apps/desktop/src/main/pty.ts`
  - `apps/desktop/src/main/oracles.ts`
  - IPC/preload/backend wrappers already wired
- AIOS prior Claude pattern had two useful reference shapes:
  - persistent structured Claude stream-json chat lane
  - PTY/tmux-backed Claude Code terminal lane with text composer
- Hub browser pattern is explicit reference for browser streaming:
  - same-origin published browser lanes
  - stream plane separate from control plane
  - embed owned stream URL, never provider URL directly

## Work Objectives <!-- oc:id=sec_ag -->

### Core objective <!-- oc:id=sec_ah -->
Turn the remaining incomplete side-panel surfaces into a coherent, intentionally scoped product roadmap, with browser and Claude elevated to first-class implementation targets and memory simplified into a usable editing lane.

### Concrete deliverables <!-- oc:id=sec_ai -->
- One browser architecture plan grounded in Hub browser-lane pattern and Palot runtime constraints
- One Claude live-lane plan grounded in AIOS Claude + Palot PTY/oracle primitives
- One memory editor plan grounded in existing file/editor surfaces and Palot memory service
- One surface policy pass defining which tabs are enabled, hidden, deferred, or revealed
- Updated evidence and QA expectations for these surfaces

### Definition of done <!-- oc:id=sec_aj -->
- [ ] Browser implementation path is explicit about runtime model, same-origin publishing, Electron vs browser-mode behavior, profile/lane model, and non-goals
- [ ] Claude implementation path is explicit about runtime seam, command flow, streaming path, auth/runtime assumptions, migration-surface disposition, and UI shape
- [ ] Memory implementation path is explicit about data model, editor reuse, and verification path
- [ ] CRM/Pulse/CH5PM disposition is explicit and intentional
- [ ] Plan can be executed without new architectural ambiguity

### Must have <!-- oc:id=sec_ak -->
- Browser plan must copy Hub architecture principle: same-origin owned browser stream surface, not direct third-party iframe embedding
- Claude plan must reuse Palot PTY/oracle seams instead of inventing unrelated runtime infrastructure
- Memory plan must stay simple and reuse existing components
- Surface reveal policy must distinguish default-on vs hidden vs deferred

### Must NOT have <!-- oc:id=sec_al -->
- No direct cross-origin provider iframe architecture
- No browser-control complexity in phase 1 browser slice
- No full memory-ops cockpit scope creep
- No half-defined Claude "connector" that lacks runtime/process model
- No attempt to make Pulse real in the same effort

## Verification Strategy <!-- oc:id=sec_am -->

### Plan verification standard <!-- oc:id=sec_an -->
This is a planning artifact. Verification is evidence-based inspection, not implementation.

### Required evidence sources <!-- oc:id=sec_ao -->
- Surface registry and feature flags in renderer
- PTY/oracle/preload/backend seams in desktop main/preload/renderer
- AIOS Claude architecture reference files
- Hub browser-lane architecture reference and route publishing docs

### QA policy <!-- oc:id=sec_ap -->
Each implementation task below includes acceptance criteria and explicit operator/agent verification scenarios to be executed by implementation agents later.

## Execution Strategy <!-- oc:id=sec_aq -->

### Parallel execution waves <!-- oc:id=sec_ar -->

Wave 1 (foundation research + policy)
- Task 1: Surface inventory and disposition lock
- Task 2: Browser lane architecture and same-origin publishing model
- Task 3: Claude lane runtime mapping from AIOS -> Palot
- Task 4: Memory surface simplification model

Wave 2 (runtime/backend planning)
- Task 5: Browser runtime adapter + route contract
- Task 6: Claude PTY/tmux/backend seam plan
- Task 7: Surface registry/flag reveal-hide plan

Wave 3 (UI composition + reuse planning)
- Task 8: Browser surface UI plan
- Task 9: Claude surface UI plan
- Task 10: Memory file-tree/editor UI plan

Wave 4 (integration + rollout planning)
- Task 11: Verification and rollout sequence
- Task 12: Deferred surfaces and non-goal documentation

Final Wave
- F1: Plan compliance audit
- F2: Architecture quality review
- F3: Scope fidelity review
- F4: Execution-readiness review

## TODOs <!-- oc:id=sec_as -->

- [ ] 1. Lock surface disposition matrix

  **What to do**:
  - Produce final status table for every current side-panel surface
  - Mark each as one of: reveal now, implement first, hide, defer
  - Record default-on/off decisions after implementation

  **Must NOT do**:
  - Do not collapse all surfaces into one implementation bucket
  - Do not leave CRM/Pulse/CH5PM ambiguous

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: `[]`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 7, 11, 12
  - Blocked By: None

  **References**:
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx` - authoritative surface registry and current default-on flags
  - `apps/desktop/src/renderer/atoms/feature-flags.ts` - persisted enable/disable defaults and labels
  - `apps/desktop/src/renderer/atoms/ui.ts` - tab identity contract

  **Acceptance Criteria**:
  - [ ] Matrix exists for all surfaces
  - [ ] Browser/Claude/Memory/CRM/Pulse/CH5PM each have explicit disposition
  - [ ] No surface remains in ambiguous state

  **QA Scenarios**:
  Scenario: inventory completeness
    Tool: file inspection
    Steps:
      1. Read registry and flag files <!-- oc:id=item_aa -->
      1. Count surfaces and compare against disposition table <!-- oc:id=item_ab -->
      1. Confirm every `SidePanelTabId` appears in the matrix <!-- oc:id=item_ac -->
    Expected Result: one-to-one match
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-1-matrix.txt`

  Scenario: policy consistency
    Tool: file inspection
    Steps:
      1. Compare matrix against current defaults in feature flags <!-- oc:id=item_ad -->
      1. Mark where defaults need change vs where surface stays hidden/deferred <!-- oc:id=item_ae -->
    Expected Result: no contradictory disposition
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-1-policy.txt`

- [ ] 2. Define browser architecture using Hub browser-lane pattern

  **What to do**:
  - Translate Hub browser-lane architecture into Palot-compatible subsystem
  - Define lane model, runtime abstraction, stream plane, same-origin route publishing, and browser-mode embedding strategy
  - Keep phase 1 browser non-agent-controlled and same-origin only

  **Must NOT do**:
  - Do not propose direct provider iframe embedding
  - Do not entangle CDP automation with the initial visible browser MVP

  **Recommended Agent Profile**:
  - Category: `deep`
  - Skills: [`agent-browser`]
    - `agent-browser`: useful for separating visual stream plane from later automation plane

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 5, 8, 11
  - Blocked By: None

  **References**:
  - Hub browser plan supplied by user - source architecture to copy
  - `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx` - existing browser surface shell
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx` - current browser tab registration
  - `apps/desktop/src/renderer/services/backend.ts` - renderer/native boundary for hybrid runtime work

  **Acceptance Criteria**:
  - [ ] BrowserLane-style contract defined
  - [ ] Electron runtime path defined
  - [ ] Browser-mode same-origin iframe path defined
  - [ ] Same-origin publishing approach explicit
  - [ ] Persistent lane/profile model explicit
  - [ ] Phase-1 non-goals documented

  **QA Scenarios**:
  Scenario: architecture completeness
    Tool: design review
    Steps:
      1. Verify architecture covers stream surface, runtime adapter, route publishing, profile persistence, and embedding path <!-- oc:id=item_af -->
      1. Check that no direct provider iframe is used anywhere in proposal <!-- oc:id=item_ag -->
    Expected Result: complete Hub-style architecture with Palot-specific mapping
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-2-browser-architecture.txt`

  Scenario: MVP constraint integrity
    Tool: design review
    Steps:
      1. Inspect browser plan phases <!-- oc:id=item_ah -->
      1. Confirm phase 1 omits agent-control complexity and keeps same-origin-only constraint <!-- oc:id=item_ai -->
    Expected Result: phase 1 remains intentionally simple
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-2-browser-scope.txt`

- [ ] 3. Map AIOS Claude lane to Palot runtime model

  **What to do**:
  - Deep-map AIOS Claude architecture to Palot equivalents
  - Lock phase-1 Claude choice now: PTY/tmux-backed Claude Code TUI lane first
  - Treat structured stream-json/headless Claude lane as later upgrade, not phase-1 branch
  - Define exact command/data flow from textbox -> running Claude session -> streamed output

  **Must NOT do**:
  - Do not leave Claude as vague "backend work"
  - Do not ignore existing PTY/oracle infrastructure

  **Recommended Agent Profile**:
  - Category: `deep`
  - Skills: `[]`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 6, 9, 11
  - Blocked By: None

  **References**:
  - AIOS Claude audit results and source files under `/Users/hassoncs/Workspaces/aios-superapp/src/` and `/Users/hassoncs/Workspaces/aios-superapp/src-tauri/src/`
  - `apps/desktop/src/main/pty.ts` - existing PTY controller
  - `apps/desktop/src/main/oracles.ts` - tmux/oracle session control
  - `apps/desktop/src/main/ipc-handlers.ts` - existing oracles/pty IPC contract
  - `apps/desktop/src/preload/index.ts` - preload bridge for pty/oracles
  - `apps/desktop/src/renderer/services/backend.ts` - renderer access surface
  - `apps/desktop/src/renderer/components/side-panel/claude-panel.tsx` - current compat-only surface

  **Acceptance Criteria**:
  - [ ] Phase-1 Claude runtime model is explicitly PTY/tmux-backed Claude Code TUI and justified
  - [ ] Later structured/headless Claude lane is explicitly marked as follow-on, not MVP ambiguity
  - [ ] Input/output/streaming path explicit
  - [ ] Auth/runtime assumptions explicit
  - [ ] Staged path from current compat panel to live lane explicit
  - [ ] Home for current migration/compat affordances explicit

  **QA Scenarios**:
  Scenario: runtime mapping
    Tool: architecture review
    Steps:
      1. Compare each AIOS Claude responsibility against a Palot runtime counterpart <!-- oc:id=item_aj -->
      1. Confirm no required capability lacks an owner in Palot design <!-- oc:id=item_ak -->
    Expected Result: full Claude lane mapping with no critical gaps
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-3-claude-mapping.txt`

  Scenario: flow integrity
    Tool: architecture review
    Steps:
      1. Trace textbox input to backend seam to tmux/PTY/Claude process and back to streamed UI <!-- oc:id=item_al -->
      1. Confirm every hop names a concrete file or subsystem <!-- oc:id=item_am -->
    Expected Result: end-to-end flow is explicit and implementable
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-3-claude-flow.txt`

- [ ] 4. Define simplified memory surface model

  **What to do**:
  - Plan memory as file-tree + markdown editor over existing memory service
  - Reuse existing Files and Editor surface patterns where possible
  - Lock memory file model now: synthetic hierarchical markdown docs backed by memory-service records, rendered in Files-like tree with virtual paths
  - Define where hierarchy comes from and how edits persist

  **Must NOT do**:
  - Do not expand back into generic memory-cockpit complexity
  - Do not plan a new editor stack

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: `[]`

  **Parallelization**:
  - Can Run In Parallel: YES
  - Parallel Group: Wave 1
  - Blocks: 10, 11
  - Blocked By: None

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx` - current memory surface behavior
  - `apps/desktop/src/renderer/services/memory-service.ts` - current Palot memory service
  - `apps/desktop/src/renderer/components/side-panel/files-panel.tsx` - tree UX to reuse
  - `apps/desktop/src/renderer/components/side-panel/editor-panel.tsx` - editor UX to reuse

  **Acceptance Criteria**:
  - [ ] Memory hierarchy model is explicitly synthetic/virtual, not raw filesystem-backed markdown
  - [ ] Canonical store, virtual path scheme, and dirty-state owner explicit
  - [ ] Reused component strategy explicit
  - [ ] Save/load path explicit
  - [ ] Scope stays simple

  **QA Scenarios**:
  Scenario: reuse discipline
    Tool: architecture review
    Steps:
      1. Compare proposed memory UI against files/editor components <!-- oc:id=item_an -->
      1. Confirm proposal prefers reuse over net-new heavy UI <!-- oc:id=item_ao -->
    Expected Result: simple memory editor plan with clear reuse map
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-4-memory-reuse.txt`

  Scenario: persistence clarity
    Tool: architecture review
    Steps:
      1. Trace memory file load/save path through existing service boundaries <!-- oc:id=item_ap -->
      1. Confirm write target/source of truth is explicit <!-- oc:id=item_aq -->
    Expected Result: no ambiguity about memory persistence path
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-4-memory-persistence.txt`

- [ ] 5. Design browser runtime adapter and publishing contract

  **What to do**:
  - Define lane runtime abstraction for Linux/macOS/Windows
  - Separate stream plane and future control plane
  - Specify same-origin route publishing contract for Palot-hosted browser streams
  - Add explicit state-ownership table for lane/profile persistence: durable owner, transient owner, renderer cache

  **Must NOT do**:
  - Do not hard-code Docker as the only abstraction
  - Do not make browser-mode depend on Electron-native primitives

  **Recommended Agent Profile**:
  - Category: `deep`
  - Skills: [`agent-browser`]

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 2
  - Blocks: 8, 11
  - Blocked By: 2

  **References**:
  - Hub browser plan supplied by user
  - `apps/desktop/src/renderer/services/backend.ts` - hybrid transport seam
  - `apps/server/` - browser-mode HTTP surface where relevant

  **Acceptance Criteria**:
  - [ ] Runtime adapter interface defined
  - [ ] Same-origin publishing contract defined
  - [ ] Cross-platform strategy explicit

  **QA Scenarios**:
  Scenario: portability review
    Tool: design review
    Steps:
      1. Validate adapter contract across Linux/macOS/Windows assumptions <!-- oc:id=item_ar -->
      1. Confirm stream publishing is abstracted from runtime choice <!-- oc:id=item_as -->
    Expected Result: no Linux-only architectural lock-in at app layer
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-5-browser-runtime.txt`

  Scenario: route contract review
    Tool: design review
    Steps:
      1. Inspect proposed route shape for browser streams <!-- oc:id=item_at -->
      1. Confirm same-origin embedding remains valid in both Electron and browser mode <!-- oc:id=item_au -->
    Expected Result: route contract is stable and embed-safe
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-5-browser-routes.txt`

- [ ] 6. Design Claude PTY/tmux/backend seam implementation slices

  **What to do**:
  - Decide incremental backend work to turn current compat panel into live Claude lane
  - Reuse or extend existing `pty` / `oracles` IPC channels where practical
  - Define whether Claude runs as dedicated oracle/session, dedicated terminal lane, or wrapper over both

  **Must NOT do**:
  - Do not invent an unrelated Claude backend stack if PTY/oracle seams suffice
  - Do not blur compat/import boundary work with live-lane runtime work

  **Recommended Agent Profile**:
  - Category: `deep`
  - Skills: `[]`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 2
  - Blocks: 9, 11
  - Blocked By: 3

  **References**:
  - `apps/desktop/src/main/pty.ts`
  - `apps/desktop/src/main/oracles.ts`
  - `apps/desktop/src/main/ipc-handlers.ts`
  - `apps/desktop/src/preload/index.ts`
  - `apps/desktop/src/preload/api.d.ts`
  - `apps/desktop/src/renderer/services/backend.ts`
  - AIOS Claude lane reference files from audit

  **Acceptance Criteria**:
  - [ ] Backend implementation slices defined in order
  - [ ] Reused vs new IPC channels explicit
  - [ ] Session naming/lifecycle model explicit
  - [ ] Verification path explicit

  **QA Scenarios**:
  Scenario: seam reuse review
    Tool: design review
    Steps:
      1. Compare proposed Claude seam work against existing PTY/oracle API surface <!-- oc:id=item_av -->
      1. Confirm reuse-first approach and identify only unavoidable new seams <!-- oc:id=item_aw -->
    Expected Result: minimal-credible backend delta
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-6-claude-seams.txt`

  Scenario: lifecycle review
    Tool: design review
    Steps:
      1. Trace create/attach/send/resize/detach/kill behavior for Claude sessions <!-- oc:id=item_ax -->
      1. Confirm lifecycle semantics are explicit <!-- oc:id=item_ay -->
    Expected Result: no hidden lifecycle ambiguity
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-6-claude-lifecycle.txt`

- [ ] 7. Define surface reveal/hide rollout policy

  **What to do**:
  - Decide which surfaces flip default-on after implementation
  - Define which remain hidden/deferred
  - Include CRM hide and Pulse/CH5PM defer policy
  - Explicitly decide Claude registry behavior during transition: same tab replaced, same tab with mode switch, or compat surface relocated

  **Must NOT do**:
  - Do not reveal surfaces without minimum implementation bar
  - Do not keep half-finished surfaces visible by accident

  **Recommended Agent Profile**:
  - Category: `quick`
  - Skills: `[]`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 2
  - Blocks: 11, 12
  - Blocked By: 1

  **References**:
  - `apps/desktop/src/renderer/atoms/feature-flags.ts`
  - `apps/desktop/src/renderer/firefly-surface-registry.tsx`
  - `apps/desktop/src/renderer/components/command-palette.tsx`

  **Acceptance Criteria**:
  - [ ] Default-on/off policy explicit
  - [ ] Hide/defer policy explicit
  - [ ] Claude transition policy explicit in registry/tab model
  - [ ] Policy aligns with implementation order

  **QA Scenarios**:
  Scenario: flag policy review
    Tool: design review
    Steps:
      1. Compare rollout policy against current feature flag defaults <!-- oc:id=item_az -->
      1. Mark exact changes required after each implementation milestone <!-- oc:id=item_ba -->
    Expected Result: reveal sequence is explicit
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-7-rollout.txt`

  Scenario: accidental exposure review
    Tool: design review
    Steps:
      1. Check whether any deferred surface would still appear visible after planned rollout <!-- oc:id=item_bb -->
      1. Confirm hide logic for CRM/Pulse/CH5PM <!-- oc:id=item_bc -->
    Expected Result: no unintended visible placeholder surfaces
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-7-exposure.txt`

- [ ] 8. Design browser surface UI slice

  **What to do**:
  - Define concrete browser surface UI for phase 1
  - Specify Electron embedded view and browser-mode iframe fallback behavior
  - Define minimum controls: URL display, refresh, open externally, load/failure states, lane selection if needed

  **Must NOT do**:
  - Do not mix advanced automation controls into the first slice
  - Do not assume arbitrary external cross-origin pages are embeddable directly

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: [`agent-browser`]

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 3
  - Blocks: 11
  - Blocked By: 2, 5

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx`
  - Hub browser plan supplied by user
  - `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx`

  **Acceptance Criteria**:
  - [ ] Browser UI states defined for both runtimes
  - [ ] MVP controls defined
  - [ ] Explicit error/empty/loading states defined

  **QA Scenarios**:
  Scenario: runtime parity review
    Tool: design review
    Steps:
      1. Compare Electron and browser-mode browser UI states <!-- oc:id=item_bd -->
      1. Confirm no runtime has undefined UX <!-- oc:id=item_be -->
    Expected Result: both runtimes have explicit, honest behavior
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-8-browser-ui.txt`

  Scenario: MVP simplicity review
    Tool: design review
    Steps:
      1. Inspect planned browser controls <!-- oc:id=item_bf -->
      1. Confirm scope excludes future automation controls <!-- oc:id=item_bg -->
    Expected Result: phase 1 browser UI remains minimal
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-8-browser-simplicity.txt`

- [ ] 9. Design Claude surface UI slice

  **What to do**:
  - Define the live Claude panel UX
  - Decide how much is terminal-first vs Claude-specific affordances
  - Define attach/create/select session, input box, streaming output, and runtime status affordances

  **Must NOT do**:
  - Do not leave the UI as just the current migration summary panel
  - Do not overfit to future advanced features before the live lane works

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `[]`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 3
  - Blocks: 11
  - Blocked By: 3, 6

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/claude-panel.tsx`
  - `apps/desktop/src/renderer/components/side-panel/oracle-panel.tsx`
  - `apps/desktop/src/renderer/components/side-panel/terminal-panel.tsx`
  - AIOS Claude UI reference files from audit

  **Acceptance Criteria**:
  - [ ] Live Claude surface UX defined
  - [ ] Session/input/output states explicit
  - [ ] Migration/compat info either retained or intentionally relocated

  **QA Scenarios**:
  Scenario: UX completeness review
    Tool: design review
    Steps:
      1. Trace first-time user path from opening Claude tab to running/attaching session <!-- oc:id=item_bh -->
      1. Trace steady-state path for sending follow-up input <!-- oc:id=item_bi -->
    Expected Result: Claude surface is operationally coherent
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-9-claude-ui.txt`

  Scenario: compatibility boundary review
    Tool: design review
    Steps:
      1. Inspect how migration/compat information is handled after live lane ships <!-- oc:id=item_bj -->
      1. Confirm no useful migration affordance is lost accidentally <!-- oc:id=item_bk -->
    Expected Result: compat functionality has a clear home
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-9-claude-compat.txt`

- [ ] 10. Design memory file-tree/editor UI slice

  **What to do**:
  - Define exact memory surface UX using existing files/editor ideas
  - Decide tree structure, file open/edit/save states, and markdown editing behavior
  - Identify reuse path for Monaco/markdown/plain editor as appropriate

  **Must NOT do**:
  - Do not expand into broad memory analytics/ops
  - Do not split into multiple unrelated mini-surfaces

  **Recommended Agent Profile**:
  - Category: `visual-engineering`
  - Skills: `[]`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 3
  - Blocks: 11
  - Blocked By: 4

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx`
  - `apps/desktop/src/renderer/components/side-panel/files-panel.tsx`
  - `apps/desktop/src/renderer/components/side-panel/editor-panel.tsx`
  - `apps/desktop/src/renderer/services/memory-service.ts`

  **Acceptance Criteria**:
  - [ ] Memory file-tree/editor UX defined
  - [ ] Open/edit/save flow explicit
  - [ ] Editor technology/reuse decision explicit

  **QA Scenarios**:
  Scenario: file-editor parity review
    Tool: design review
    Steps:
      1. Compare proposed memory surface UX with existing files/editor surfaces <!-- oc:id=item_bl -->
      1. Confirm reused patterns are consistent and intentional <!-- oc:id=item_bm -->
    Expected Result: memory feels like a native sibling of files/editor
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-10-memory-ui.txt`

  Scenario: markdown editing review
    Tool: design review
    Steps:
      1. Inspect planned markdown editing behavior and save semantics <!-- oc:id=item_bn -->
      1. Confirm user can understand persistence without extra training <!-- oc:id=item_bo -->
    Expected Result: simple markdown editing path is explicit
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-10-memory-markdown.txt`

- [ ] 11. Define integrated verification and rollout order

  **What to do**:
  - Produce final execution sequence for implementation agents
  - Define verification gates after browser, Claude, and memory work
  - Include browser-mode and Electron-mode checks where relevant

  **Must NOT do**:
  - Do not ship browser/Claude/memory together without runtime-specific validation
  - Do not omit regression checks for existing files/editor/oracle seams

  **Recommended Agent Profile**:
  - Category: `unspecified-high`
  - Skills: `[]`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 4
  - Blocks: F1-F4
  - Blocked By: 1, 2, 3, 4, 5, 6, 8, 9, 10

  **References**:
  - `apps/desktop/package.json` - `dev`, `dev:web`, `check-types`, `lint`
  - Current evidence files in `.sisyphus/evidence/aios-migration/`

  **Acceptance Criteria**:
  - [ ] Rollout order explicit
  - [ ] Verification commands/gates explicit
  - [ ] Browser/Electron split covered
  - [ ] Surface-specific user-path proofs defined for Browser, Claude, and Memory

  **QA Scenarios**:
  Scenario: execution-sequence review
    Tool: design review
    Steps:
      1. Validate that implementation order respects architecture dependencies <!-- oc:id=item_bp -->
      1. Confirm each milestone ends in a meaningful usable state <!-- oc:id=item_bq -->
    Expected Result: rollout sequence is practical
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-11-rollout-sequence.txt`

  Scenario: verification coverage review
    Tool: design review
    Steps:
      1. Inspect verification matrix for browser, Claude, memory, and registry defaults <!-- oc:id=item_br -->
      1. Confirm each runtime-sensitive surface has explicit checks <!-- oc:id=item_bs -->
      1. Confirm mandatory proof list exists for:
         - Browser Electron: load same-origin lane, refresh, external-open, runtime error state
         - Browser web mode: iframe same-origin route, unavailable-runtime fallback
         - Claude: create, attach, send input, reconnect, resize, stop
         - Memory: open doc, edit doc, save doc, reopen doc
    Expected Result: no missing runtime verification gaps
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-11-verification.txt`

- [ ] 12. Document deferred surfaces and non-goals

  **What to do**:
  - Record why Pulse, CH5PM, and CRM are not in this implementation wave
  - Distinguish hidden-vs-deferred-vs-later-upgrade
  - Prevent future scope confusion

  **Must NOT do**:
  - Do not leave future readers guessing whether omission was intentional

  **Recommended Agent Profile**:
  - Category: `writing`
  - Skills: `[]`

  **Parallelization**:
  - Can Run In Parallel: NO
  - Parallel Group: Wave 4
  - Blocks: F1-F4
  - Blocked By: 1, 7

  **References**:
  - Surface disposition matrix from Task 1
  - Current draft and user decisions recorded in `.sisyphus/drafts/sidebar-surface-completion-plan.md`

  **Acceptance Criteria**:
  - [ ] Deferred surfaces documented
  - [ ] Non-goals explicit
  - [ ] Future revisit points clear

  **QA Scenarios**:
  Scenario: non-goal clarity review
    Tool: document review
    Steps:
      1. Read deferred-surface section without prior context <!-- oc:id=item_bt -->
      1. Confirm rationale and revisit trigger are understandable <!-- oc:id=item_bu -->
    Expected Result: omissions are clearly intentional
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-12-nongoals.txt`

  Scenario: scope-guard review
    Tool: document review
    Steps:
      1. Compare deferred list against active implementation tasks <!-- oc:id=item_bv -->
      1. Confirm no deferred scope sneaks back into active execution slices <!-- oc:id=item_bw -->
    Expected Result: scope boundaries remain tight
    Evidence: `.sisyphus/evidence/sidebar-surfaces/task-12-scope-guard.txt`

## Final Verification Wave <!-- oc:id=sec_at -->

- [ ] F1. Plan compliance audit — verify browser, Claude, memory, CRM, Pulse, CH5PM decisions all appear explicitly and match user direction.
- [ ] F2. Architecture quality review — verify browser copies Hub principles, Claude reuses PTY/oracle seams, memory reuses files/editor patterns.
- [ ] F3. Scope fidelity review — verify no accidental expansion into advanced browser control, Pulse implementation, or memory-cockpit complexity.
- [ ] F4. Execution-readiness review — verify implementation agents could start without new product questions.

## Commit Strategy <!-- oc:id=sec_au -->
- Planning-only markdown change set
- Commit message: `docs(plan): define sidebar surface completion roadmap`

## Success Criteria <!-- oc:id=sec_av -->
- Browser path is concrete, same-origin, and MVP-bounded
- Claude path is concrete, live-runtime-based, and grounded in existing Palot primitives
- Memory path is simple and reuse-heavy
- CRM/Pulse/CH5PM status is intentional
- Surface reveal policy is explicit
- Implementation team can execute without rediscovering architecture