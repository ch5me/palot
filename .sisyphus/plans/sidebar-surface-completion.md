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

### Current-state snapshots
- Browser
  - Current state: Electron-oriented browser surface exists but browser-mode inline embedding path does not
  - Known gap: no same-origin published browser stream path in Palot yet
  - Existing seam: browser panel UI + renderer/backend hybrid boundary
- Claude
  - Current state: compat/import panel only
  - Known gap: no live Claude session/runtime lane
  - Existing seam: PTY/tmux/oracle lifecycle and streaming primitives already exist
- Memory
  - Current state: memory surface exists but not as simple file-tree/editor workflow
  - Known gap: no synthetic-doc hierarchy/editor contract
  - Existing seam: memory service + files/editor surface patterns
- CRM
  - Current state: real but drafts-only / Electron-only
  - Known gap: not worth surfacing now
  - Existing seam: can be hidden without backend redesign
- Pulse
  - Current state: present but intentionally incomplete for current product goal
  - Known gap: no chosen operator contract
  - Existing seam: can stay deferred
- CH5PM
  - Current state: exists with mock-seeded fallback and unclear product intent
  - Known gap: no approved product direction
  - Existing seam: keep deferred until explicit review

## Work Objectives <!-- oc:id=sec_ag -->

### Core objective <!-- oc:id=sec_ah -->
Turn the remaining incomplete side-panel surfaces into a coherent, intentionally scoped product roadmap, with browser and Claude elevated to first-class implementation targets and memory simplified into a usable editing lane.

### Concrete deliverables <!-- oc:id=sec_ai -->
- One browser architecture plan grounded in Hub browser-lane pattern and Palot runtime constraints
- One Claude live-lane plan grounded in AIOS Claude + Palot PTY/oracle primitives
- One memory editor plan grounded in existing file/editor surfaces and Palot memory service
- One full surface policy pass defining which tabs are enabled, hidden, deferred, revealed, or command-palette-only across the whole sidebar system
- One owner table covering browser runtime owner, browser stream publisher owner, Claude session owner, and memory canonical store owner
- One canonical data contract per priority surface (Browser lane, Claude session, Memory doc)
- Updated evidence and QA expectations for these surfaces

### Definition of done <!-- oc:id=sec_aj -->
- [x] Browser implementation path is explicit about runtime model, same-origin publishing, Electron vs browser-mode behavior, profile/lane model, and non-goals
- [x] Claude implementation path is explicit about runtime seam, command flow, streaming path, auth/runtime assumptions, migration-surface disposition, and UI shape
- [x] Memory implementation path is explicit about data model, editor reuse, and verification path
- [x] CRM/Pulse/CH5PM disposition is explicit and intentional
- [x] Plan can be executed without new architectural ambiguity

### Must have <!-- oc:id=sec_ak -->
- Browser plan must copy Hub architecture principle: same-origin owned browser stream surface, not direct third-party iframe embedding
- Claude plan must reuse Palot PTY/oracle seams instead of inventing unrelated runtime infrastructure
- Memory plan must stay simple and reuse existing components
- Surface reveal policy must distinguish default-on vs hidden vs deferred
- Each phase must end with at least one user-usable surface outcome, not only backend or architectural preparation

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

### Target disposition matrix

| Surface | Current state | Target disposition | Discoverability | Default after completion | Notes |
|---|---|---|---|---|---|
| Review | Real diff lane with availability gating | Reveal now | Visible tab when diff exists; hidden otherwise | Default on | Keep current diff-driven availability contract in `firefly-surface-registry.tsx` |
| Browser | Partial, Electron-only webview with no browser-mode publisher | Implement first | Visible tab | Default off until same-origin publisher works in Electron and browser mode; then default on | Product lane must embed Palot-owned same-origin browser surfaces only |
| Notes | Real proof surface | Reveal now | Visible tab | Default on | No major changes in this wave |
| Pulse | Intentional placeholder with no chosen operator contract | Defer | Hidden from sidebar and command palette | Off | Keep code parked; revisit only after operator contract and metrics owner are defined |
| Memory | Real list/pin surface but wrong UX for target use | Implement after Claude | Visible tab | Default off until open/edit/save/reopen proof passes; then default on if stable | Replace current list/pin UX with synthetic docs + editor lane |
| Files | Real file-tree and preview lane | Reveal now | Visible tab | Default on | Canonical tree/preview reuse reference for Memory |
| Terminal | Real PTY lane | Reveal now | Visible tab | Default on | Remains separate product surface; Claude may reuse PTY internals without replacing Terminal |
| Editor | Real Monaco lane | Reveal now | Visible tab | Default on | Canonical editor reuse reference for Memory |
| Plugins | Real inventory surface | Reveal now | Visible tab | Default on | Inventory only; no new plugin control scope |
| Bridges | Real bridge inventory/activity surface | Reveal now | Visible tab | Default on | May host Claude availability signals later, but no major work in this wave |
| CRM | Real but drafts-only / Electron-only and not wanted now | Hide | Hidden from sidebar and command palette | Off | Preserve implementation, remove product discoverability for now |
| Studio / Office | Real office/doc preview lane | Reveal now | Visible tab | Default on | No major changes in this wave |
| Voice | Real but bounded | Reveal now | Visible tab | Default on | TTS and deeper voice work stay deferred |
| Oracle | Real tmux/oracle roster and attach lane | Reveal now | Visible tab | Default on | Existing runtime helper surface Claude can lean on during implementation |
| Claude | Compat/import only, no live runtime lane | Implement first | Visible tab | Default on | Keep `claude` tab id; replace body in place with live lane; move compat/import affordances into compact secondary UX |
| CH5PM | Placeholder / mock-seeded dashboard with unclear product intent | Defer | Hidden from sidebar; optional command-palette breadcrumb only | Off | No sidebar visibility until explicit product review and backend owner exist |

**Disposition labels used in this plan**
- `Reveal now`: keep current surface visible and supported in the sidebar.
- `Implement first`: priority implementation lane in this roadmap; visible, but not default-on until its minimum bar is met if called out above.
- `Implement after Claude`: implementation lane that follows Browser and Claude on the critical path.
- `Hide`: keep code, remove sidebar and command-palette discoverability.
- `Defer`: keep code out of normal discoverability and document the revisit trigger before re-surfacing.

- [x] 1. Lock surface disposition matrix

  **What to do**:
  - Produce final status table for every current side-panel surface
  - Mark each as one of: reveal now, implement first, hide, defer, or command-palette-only
  - Record default-on/off decisions after implementation
  - Include explicit decisions for Browser, Claude, Memory, CRM, Pulse, and CH5PM

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
  - [x] Matrix exists for all surfaces
  - [x] Browser/Claude/Memory/CRM/Pulse/CH5PM each have explicit disposition
  - [x] Existing always-on surfaces are included so full-system transitions stay coherent
  - [x] Discoverability mode for each target surface is explicit (visible, hidden, command-palette-only, deferred)
  - [x] No surface remains in ambiguous state

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

- [x] 2. Define browser architecture using Hub browser-lane pattern

  **What to do**:
  - Translate Hub browser-lane architecture into Palot-compatible subsystem
  - Define canonical BrowserLane contract now: `laneId`, `profileId`, `runtimeKind`, `publishedUrl`, `status`
  - Define lane model, runtime abstraction, stream plane, same-origin route publishing, and browser-mode embedding strategy
  - Keep phase 1 browser non-agent-controlled and same-origin only

  **Architecture decision**:
  - Phase 1 BrowserLane is a Palot-owned visual stream lane, not a provider-controlled iframe. The renderer only embeds `publishedUrl` values that Palot itself serves from a same-origin route.
  - Electron runtime keeps a native lane adapter in the desktop runtime. For the first implementation slice, the adapter can continue to use the existing `<webview>` shell behind the Browser surface because Electron 40 still supports it, but the long-lived contract is a lane publisher owned by the host runtime, not a raw `webview.src` of arbitrary third-party pages. Electron's own docs mark `<webview>` as not recommended and steer new architecture toward `iframe` or `WebContentsView`, so the plan treats today's webview wrapper as a temporary adapter, not the canonical contract.
  - Browser mode cannot use Electron primitives. Its only supported happy path is an `iframe` pointed at a same-origin Palot route published by `apps/server`; if no publisher exists, the surface must fail closed into an unavailable state or external-open-only affordance.

  **Canonical BrowserLane contract**:
  - `laneId`: stable opaque lane identity, unique within a Firefly profile and reused across app restarts.
  - `profileId`: the active Firefly profile that owns cookies/session partitioning and default lane selection.
  - `runtimeKind`: one of `electron-web-contents`, `electron-webview-adapter`, or `server-published-iframe`, so the renderer knows which embed path and capability set is honest.
  - `publishedUrl`: same-origin URL served by Palot when the lane is publishable; nullable only while provisioning or when unavailable.
  - `status`: `provisioning | ready | unavailable | error | closing`, with renderer UX keyed off this state instead of probing embed internals.
  - Recommended companion metadata for later tasks: `displayUrl`, `lastNavigatedUrl`, `capabilities`, `lastError`, and `updatedAt`.

  **Lane and profile model**:
  - Browser profile is the durable owner of browsing identity. It maps to the current persisted browser partition/history concept in `apps/desktop/src/renderer/atoms/browser.ts`, but the plan widens that from one remembered URL into a reusable profile record.
  - Browser lane is the durable owner of a single visible browsing surface under a profile. Multiple lanes can exist later, but phase 1 may expose just one default lane per profile while still using the lane contract above so later multi-lane work does not require redesign.
  - Renderer cache is read-only convenience state. Canonical lane metadata lives in the runtime owner for the current mode, not inside ad hoc renderer atoms.

  **Runtime abstraction**:
  - Define a `BrowserLaneRuntimeAdapter` with responsibilities: create/resume lane, publish same-origin surface, report lane status, refresh/reload lane, and open externally.
  - Electron adapter owner: desktop main process. It owns any native embedded browsing primitive and exposes lane metadata through preload/backend seams.
  - Browser-mode adapter owner: `apps/server`. It owns the same-origin publisher contract and serves the lane route the renderer iframes.
  - Stream plane and future control plane stay separate. Phase 1 implements only the visual/publishing path plus basic refresh/open-external actions; automation/CDP/control APIs are follow-on work.

  **Same-origin publishing model**:
  - The renderer never embeds a direct provider URL. It embeds only URLs under Palot control, for example `/firefly/browser-lanes/:laneId` or a similar same-origin route defined by the runtime owner.
  - The published route can internally proxy, mirror, or host the underlying browsing session, but that implementation detail stays behind the runtime adapter boundary.
  - Browser mode must reuse the app's own origin and route tree so iframe embedding remains same-origin and consistent with Electron's web-embed guidance.

  **Electron path**:
  - Near-term: keep the current Browser tab shell and persisted profile history while swapping the meaning of `currentUrl` from arbitrary third-party destination to lane/display metadata returned by the adapter.
  - Preferred long-term host primitive: `WebContentsView` owned by the main process, because Electron recommends `WebContentsView` over `webview` for new embedded content architecture. If phase 1 ships faster on top of the existing `<webview>` wrapper, document it as adapter debt rather than the final architecture.
  - Native session/cookie isolation should remain profile-scoped, analogous to the existing `partition: persist:elf-browser-${profileId}` pattern.

  **Browser-mode path**:
  - Add a same-origin lane publisher in `apps/server` that serves lane routes under the Palot origin already used by `dev:web`.
  - Renderer Browser surface uses an `iframe` for published routes only. It may show the current target URL as display metadata, but the actual embed source is always the Palot-owned `publishedUrl`.
  - If the server-side publisher is disabled, missing, or cannot create a lane, Browser mode must show an explicit unavailable state rather than falling back to a direct remote embed.

  **Fail-closed rule**:
  - Browser mode and Electron mode both obey the same invariant: owned same-origin published surface or unavailable state; never provider iframe embed.
  - `Open externally` is the only acceptable fallback for a raw provider/site URL when publishing is unavailable.

  **Phase-1 non-goals**:
  - No CDP, agent-control, scripted browsing, or automation controls.
  - No arbitrary multi-lane management UI beyond what is needed for one credible visible lane.
  - No direct provider iframe architecture.
  - No browser-mode dependency on Electron-only primitives.
  - No attempt to solve the entire long-term browser control plane in the MVP.

  **Must NOT do**:
  - Do not propose direct provider iframe embedding
  - Do not embed raw remote/provider URLs in renderer even if technically possible
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
  - `apps/server/src/index.ts` and `apps/server/src/routes/files.ts` - current browser-mode route ownership pattern; no lane publisher exists yet
  - Electron web embed guidance: `https://www.electronjs.org/docs/latest/tutorial/web-embeds`

  **Acceptance Criteria**:
  - [x] Canonical BrowserLane contract defined with stable identity fields
  - [x] Electron runtime path defined
  - [x] Browser-mode same-origin iframe path defined
  - [x] Same-origin publishing approach explicit
  - [x] Browser-mode fail-closed rule explicit: owned same-origin published surface or unavailable state, never direct provider embed
  - [x] Persistent lane/profile model explicit
  - [x] Phase-1 non-goals documented

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

- [x] 3. Map AIOS Claude lane to Palot runtime model

  **What to do**:
  - Deep-map AIOS Claude architecture to Palot equivalents
  - Lock phase-1 Claude choice now: PTY/tmux-backed Claude Code TUI lane first
  - Keep existing `SidePanelTabId` / Claude tab id unless a stronger contradiction is proven
  - Treat structured stream-json/headless Claude lane as later upgrade, not phase-1 branch
  - Define exact command/data flow from textbox -> running Claude session -> streamed output

  **Runtime decision**:
  - Phase 1 Claude is a live Claude Code TUI lane, not a headless chat lane. AIOS proves the product shape: its `TerminalPane.tsx` and `TerminalComposer.tsx` drive a raw PTY attached to a persistent tmux session, while its `ChatPane.tsx` is a separate headless `claude -p --output-format stream-json` surface. Palot should copy the TUI lane first and explicitly defer the headless structured lane.
  - Keep the existing `claude` tab id and replace the current compat/import body in place. This preserves registry identity, feature flags, persistence keys, and user muscle memory while changing the contents from a passive migration summary to a live runtime surface.

  **AIOS -> Palot responsibility map**:
  - AIOS `TerminalPane.tsx` owns PTY session lifecycle, output streaming, resize, and pane-scoped composer registration. Palot already has equivalent PTY spawn/write/resize/kill and event seams in `apps/desktop/src/main/pty.ts`, `apps/desktop/src/main/ipc-handlers.ts`, `apps/desktop/src/preload/index.ts`, and `apps/desktop/src/renderer/services/backend.ts`.
  - AIOS `TerminalComposer.tsx` owns Claude-specific command affordances (`/clear`, `/model`, `/resume`, plan/mode toggles, stop, file/image insertion) and routes them as raw bytes into the PTY. Palot has no Claude-specialized composer yet, but its existing `TerminalPanel` proves the minimal write path and can be wrapped or extended rather than replaced by a second PTY stack.
  - AIOS `OracleRoster.tsx` and backend oracle/tmux helpers show that oracle sessions are first-class attach targets and can optionally launch `claude` on creation. Palot already has an Oracle surface and tmux/oracle CRUD/attach backend in `apps/desktop/src/main/oracles.ts`, `apps/desktop/src/renderer/components/side-panel/oracle-panel.tsx`, and preload/backend wrappers.
  - AIOS `ChatPane.tsx` is explicitly a different product: persistent headless stream-json chat with resume/session recording and control-protocol approvals. Palot should reference it only as a later upgrade path, not as phase-1 ambiguity.

  **Phase-1 runtime model**:
  - Canonical session owner: tmux session plus attached PTY stream. The tmux session is the durable process owner; the visible PTY is just the current attachment surface.
  - Preferred session shape: one Palot-managed persistent tmux session per Claude lane, analogous to AIOS `aios-term-<name>` sessions. If Palot initially reuses `spawnPtyTerminal`, the Claude lane should sit on top of that capability rather than invent a new process family.
  - Oracle helpers remain adapters, not the source of truth. They are useful for attach/list/create flows, but the Claude surface should not depend on the oracle roster being open.

  **Input/output flow**:
  - User opens the Claude tab.
  - Renderer performs a preflight check for Electron runtime plus Claude CLI/auth/session availability.
  - Renderer asks backend to create or attach a Claude tmux-backed PTY session.
  - Main process returns a PTY id; renderer subscribes to `onPtyData` and `onPtyExit` using the existing backend service.
  - Output stream paints live terminal content in the Claude surface.
  - Textbox/composer sends either plain text plus newline or raw PTY bytes for Claude Code commands into `writePty`.
  - Resize events propagate through `resizePty`.
  - Reconnect/reattach repeats the attach step against the same tmux session owner and resumes the live stream.

  **Auth/runtime assumptions**:
  - Electron runtime is required for phase 1 because Palot's PTY/oracle seams are Electron-only today.
  - Claude CLI must be installed locally and authenticated before the lane is usable.
  - Browser-only mode has no live Claude lane in phase 1; it should render an explicit unavailable state, not a degraded fake runtime.
  - A missing or unauthenticated CLI is not a hidden failure: the surface must show a concrete preflight error with the shortest recovery path.

  **Session naming and lifecycle**:
  - Use a stable session name derived from project/session identity so the Claude lane can reattach after pane close or app relaunch, matching the AIOS persistence pattern.
  - Lifecycle states to model explicitly: preflight, creating, attaching, ready, busy, exited, crashed, unavailable.
  - Stop/kill must be an explicit user action; closing the side panel should detach from the PTY attachment, not silently destroy the underlying tmux session if the product wants Claude continuity.

  **Staged migration path from current panel**:
  - Stage 0: current `claude-panel.tsx` remains the compatibility/import summary.
  - Stage 1: same tab becomes a live Claude lane shell with preflight, attach/create, streamed output, and input box.
  - Stage 2: migration/import affordances collapse into a compact secondary section inside the Claude tab or move to Settings → Migration as the primary home.
  - Stage 3: optional later work adds structured/headless Claude lane concepts only if a second product need survives after the TUI lane ships.

  **Home for compat/import affordances**:
  - Keep provider detection summary and restore-backup affordance available, but demote them below the live lane or move them into a collapsible "Migration tools" section.
  - Settings → Migration remains the canonical full workflow home, as the current panel already states.
  - The Claude tab should stop being described as a pure compatibility boundary once the live lane ships.

  **Later follow-on, not MVP**:
  - AIOS-style structured stream-json/headless chat lane.
  - Session recording/resume picker for Claude Code conversations if the TUI lane later needs first-class history UX beyond tmux continuity.
  - Mid-turn approval/control-protocol handling beyond what Claude Code itself already provides in the TUI.

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
  - `apps/desktop/src/renderer/components/side-panel/terminal-panel.tsx` - current Palot PTY lane shell
  - AIOS `src/components/TerminalPane.tsx` and `src/components/TerminalComposer.tsx` - Claude Code TUI lane reference
  - AIOS `src/components/ChatPane.tsx` and `src/lib/chat.ts` - explicit later headless/structured lane reference

  **Acceptance Criteria**:
  - [x] Phase-1 Claude runtime model is explicitly PTY/tmux-backed Claude Code TUI and justified
  - [x] Later structured/headless Claude lane is explicitly marked as follow-on, not MVP ambiguity
  - [x] Input/output/streaming path explicit
  - [x] Auth/runtime assumptions explicit
  - [x] Staged path from current compat panel to live lane explicit
  - [x] Home for current migration/compat affordances explicit

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

- [x] 4. Define simplified memory surface model

  **What to do**:
  - Plan memory as file-tree + markdown editor over existing memory service
  - Reuse existing Files and Editor surface patterns where possible
  - Lock memory file model now: synthetic hierarchical markdown docs backed by memory-service records, rendered in Files-like tree with virtual paths
  - Define where hierarchy comes from and how edits persist

  **Model decision**:
  - Memory v1 becomes a synthetic document workspace, not a fact list and not a raw filesystem mirror. The user interacts with virtual markdown docs that are derived from memory records and saved back through the memory service.
  - Canonical path scheme: `memory/<scope>/<topic>.md`. This path is the stable UI identity for tree rows, breadcrumbs, open documents, dirty state, and deep-linking.
  - The path is synthetic only. No phase-1 memory doc is backed by a real file on disk.

  **Canonical store and hierarchy**:
  - Canonical store owner is the existing memory service (`apps/desktop/src/renderer/services/memory-service.ts`), which already unifies local pinned facts and remote Cloudflare-backed records into one `MemoryItem` abstraction.
  - `scope` is derived from source + project context:
    - local pinned fact for current project -> `memory/project/<topic>.md`
    - remote item with project/topic context -> `memory/project/<topic>.md`
    - remote item without project-specific topic -> `memory/shared/<topic>.md`
    - future user/global memories can map into `memory/user/<topic>.md` or `memory/global/<topic>.md` without changing the UI contract.
  - `topic` comes from `topicKey` when present; otherwise derive a deterministic slug from `memoryClass` + leading body text or a stable fallback like `<memoryClass>-<id>`. The slug must be stable across reloads so reopen/deep-link behavior is predictable.
  - Folder structure is deterministic and re-derived on every load from the fetched `MemoryItem[]`; no separate folder metadata store is needed in v1.

  **Document shape**:
  - Each virtual doc wraps exactly one canonical memory record in v1. Avoid multi-record stitched docs for the first slice.
  - Renderer expands a `MemoryItem` into markdown text with a small deterministic header block plus body content, for example title/topic metadata and source stamps followed by the editable body.
  - Non-editable metadata should either stay outside the editable markdown region or be regenerated from the canonical record so the user cannot accidentally corrupt ownership fields.

  **Load/save path**:
  - Load path: `fetchMemories()` -> derive tree nodes + path map -> open selected virtual path -> materialize markdown text for editor.
  - Save path: edited markdown -> parse back into a memory-doc payload -> persist through the memory service -> refresh the in-memory tree/list -> keep the same virtual path if the topic slug did not change.
  - Local mode writes through `pinnedFactsAtom`-backed actions for local records.
  - Remote mode writes through remote memory-service APIs.
  - Hybrid mode should prefer the record's native owner: local records save locally, remote records save remotely. Do not silently fork one record into two backends.

  **Dirty-state owner**:
  - Dirty state belongs to the memory editor surface, not to the service layer. Mirror the existing `EditorPanel` pattern: selected doc path + current editor buffer + dirty/saved indicators live in renderer state.
  - The canonical store remains clean until explicit save.
  - If the topic slug changes on save, the save flow must update the selected virtual path and any open-doc reference atom in one transaction so the user does not appear to "lose" the document.

  **Conflict and stale-change policy**:
  - On open, capture the source record `updatedAt`.
  - On save, if the backing record changed since open, surface a stale-change warning and require reload/overwrite resolution rather than silently clobbering newer content.
  - V1 can use a simple single-writer policy: one open editor doc at a time, no multi-tab merge UI.

  **Reuse strategy**:
  - Reuse Files surface structure for the left rail: folder/file tree, search/filter, selected row affordance, empty/loading/error shells, and path/breadcrumb mental model.
  - Reuse Editor surface structure for the right pane: Monaco host, dirty/saved indicators, keyboard save, loading/error overlays.
  - Do not reuse the real filesystem search hook as-is, because memory docs are virtual. Instead, implement a memory-doc tree/search adapter that feeds Files-like rows from `MemoryItem[]`.
  - Monaco is acceptable for v1 because it already exists and can edit markdown/text with minimal new surface area. No new editor stack.

  **UI contract for task 10**:
  - Left pane: virtual memory tree rooted at `memory/`, grouped by scope folders.
  - Right pane: single selected markdown doc.
  - Search filters virtual docs by path/topic/body summary, not by real filesystem paths.
  - Empty state should explain that memories become editable docs, not generic analytics.

  **Persistence semantics**:
  - Remote/local/hybrid mode stays a top-level memory source setting, but the file-tree/editor UX is mode-agnostic.
  - The path contract must remain identical across modes so the UI does not change shape when the backend mode flips.
  - The current add/remove quick actions can survive as secondary affordances, but the primary product lane becomes open/edit/save/reopen through synthetic docs.

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
  - `apps/desktop/src/renderer/atoms/preferences.ts` - local pinned fact store and memory mode config

  **Acceptance Criteria**:
  - [x] Memory hierarchy model is explicitly synthetic/virtual, not raw filesystem-backed markdown
  - [x] Canonical store, virtual path scheme, and dirty-state owner explicit
  - [x] Reused component strategy explicit
  - [x] Save/load path explicit
  - [x] Scope stays simple

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

- [x] 5. Design browser runtime adapter and publishing contract

  **What to do**:
  - Define lane runtime abstraction for Linux/macOS/Windows
  - Separate stream plane and future control plane
  - Specify same-origin route publishing contract for Palot-hosted browser streams
  - Name exact serving owner per runtime: Electron main-owned local publisher vs browser-mode `apps/server` publisher, plus renderer discovery path
  - Add explicit state-ownership table for lane metadata vs lane browsing-session state: durable owner, transient owner, renderer cache
  - Define exact browser-mode unavailable-publisher fallback UX: disabled state, external-open-only, or explicit unavailable card

  **Runtime adapter contract**:
  - Define a shared `BrowserLaneRuntimeAdapter` interface with five responsibilities only: `ensureLane(profileId, laneId?)`, `getLane(laneId)`, `publishLane(laneId)`, `reloadLane(laneId)`, and `openExternal(laneId)`.
  - The adapter returns lane metadata, never raw provider embed instructions. Renderer decisions come from metadata such as `laneId`, `profileId`, `runtimeKind`, `publishedUrl`, `status`, `displayUrl`, `capabilities`, and `lastError`.
  - The visual stream plane is the only phase-1 concern. Any future control plane (navigation steering, automation, CDP, agent driving) is a separate adapter surface and must not leak into this contract.

  **Per-runtime serving owners**:
  - Electron owner: desktop main process. It owns native browsing primitives, session partitioning, and any local publisher bridge needed to expose an owned `publishedUrl` to the renderer.
  - Browser-mode owner: `apps/server`. It owns the HTTP route that serves a same-origin browser lane frame/shell and any server-side discovery endpoint the renderer needs.
  - Renderer owner: discovery + presentation only. Renderer reads lane metadata via `services/backend.ts`, embeds a same-origin `publishedUrl`, and caches transient UI state, but never becomes the source of truth for lane lifecycle.

  **State ownership table**:
  - Durable lane metadata owner: runtime adapter (`Electron main` or `apps/server`), because lane identity/status must survive renderer reloads.
  - Durable browsing-session/profile owner: profile-scoped runtime storage. In Electron this aligns with the existing partition/profile model (`persist:elf-browser-${profileId}`); in browser mode this must be owned by the server-side lane runtime, not by iframe-local state.
  - Renderer cache owner: lightweight UI cache such as last visible lane selection, current selected lane id, and optimistic status text.
  - Per-page transient browsing state owner: the runtime's embed primitive (web contents / hosted lane session), not the renderer.

  **Same-origin publishing contract**:
  - Browser-mode publisher must expose a stable same-origin route family, e.g. `/firefly/browser-lanes/:laneId` for the embeddable frame and `/api/browser-lanes/:laneId` for metadata if a JSON discovery endpoint is needed.
  - Electron must expose an equivalent `publishedUrl` contract even if the implementation comes from a local publisher bridge or a main-process-owned view; the renderer consumes the same metadata shape in both runtimes.
  - The published route must be embeddable by same-origin iframe in browser mode and by the Browser surface in Electron without leaking provider URLs.

  **Browser-mode fallback UX**:
  - If no publisher exists, the Browser surface shows an explicit unavailable card with three facts: browser mode requires a lane publisher, the lane is not currently publishable, and `Open externally` is the only available action.
  - Disabled state is preferred over a blank iframe. The user should see a truthful unavailable surface rather than a spinner with no owner.
  - If metadata resolves but `status !== ready`, use a structured state card (`provisioning`, `error`, `unavailable`) instead of attempting to embed.

  **Cross-platform strategy**:
  - App-layer contract stays platform-neutral: profile id, lane id, publish, reload, open external, and published URL are the only renderer-visible primitives.
  - Platform-specific implementation lives behind the Electron main adapter. macOS/Linux/Windows differences are allowed there, but the renderer and browser-mode server must not branch on OS-specific assumptions.
  - Do not hard-code Docker, a single browser engine, or Linux-only tooling into the contract. If a platform cannot host a given native strategy, it must still surface the same metadata/error model.

  **Relationship to existing seams**:
  - `apps/server/src/index.ts` proves browser mode already owns same-origin Hono routes, but no browser-lane publisher exists yet.
  - `apps/server/src/routes/files.ts` proves Palot already uses server-owned route contracts for browser-mode resource access and safe write/read boundaries.
  - `apps/desktop/src/renderer/services/backend.ts` is already the right hybrid seam: browser-mode calls can go through HTTP while Electron calls can stay IPC-backed.
  - `browserPanelStateAtom` and `activeFireflyProfileAtom` show existing persisted browser/profile concepts that the adapter should consume, not replace.

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
  - `apps/server/src/index.ts` - current route mount pattern for browser mode
  - `apps/server/src/routes/files.ts` - route + ownership pattern for browser-mode resources
  - `apps/desktop/src/renderer/atoms/preferences.ts` - browser/profile persistence seams

  **Acceptance Criteria**:
  - [x] Runtime adapter interface defined
  - [x] Same-origin publishing contract defined
  - [x] Route-host ownership per runtime explicit
  - [x] Lane metadata owner vs browsing-session/profile owner explicit
  - [x] Browser-mode unavailable-publisher fallback UX explicit
  - [x] Cross-platform strategy explicit

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

- [x] 6. Design Claude PTY/tmux/backend seam implementation slices

  **What to do**:
  - Decide incremental backend work to turn current compat panel into live Claude lane
  - Reuse or extend existing `pty` / `oracles` IPC channels where practical
  - Lock canonical phase-1 session owner now: tmux session + attached PTY stream as source of truth, with oracle/terminal helpers treated as adapters around that owner
  - Add explicit preflight slice for CLI/auth/session availability before stream attach
  - Define whether Claude UI exposes this as terminal-specialized wrapper or distinct Claude product surface with terminal internals hidden

  **Backend implementation slices**:
  - Slice 0 — seam repair: remove the duplicate stub `pty:spawn-oracle` and `pty:spawn-tmux` handlers at `apps/desktop/src/main/ipc-handlers.ts:620` so preload/API typings once again match the real PTY attach behavior registered earlier in the file.
  - Slice 1 — Claude preflight endpoint: add one explicit backend probe that answers four questions before attach: Electron runtime available, Claude CLI installed, Claude CLI authenticated, and tmux available/attachable. Keep it narrow; this is status discovery, not session creation.
  - Slice 2 — stable Claude session resolver: add a focused helper that deterministically maps `{ project/session/profile } -> tmux session name }` for Claude lanes. Reuse `spawnPtyTerminal` semantics where possible instead of inventing a second persistent-session system.
  - Slice 3 — create/attach operation: add a Claude-specific backend entrypoint that creates or reattaches to the resolved tmux-backed session and returns the PTY attachment id plus enough session metadata for the renderer to label the surface.
  - Slice 4 — live stream reuse: renderer Claude surface consumes existing `onPtyData`, `onPtyExit`, `writePty`, `resizePty`, and `killPty` flows; no second streaming transport is needed for MVP.
  - Slice 5 — explicit lifecycle commands: if UX needs them beyond generic `killPty`, add narrow helpers for detach/terminate/restart against the Claude session owner so panel-close vs stop-runtime semantics stay unambiguous.

  **Reused vs new seams**:
  - Reuse as-is:
    - `spawnPtyTerminal` for persistent tmux-backed PTY creation/attach
    - `writePty`, `resizePty`, `killPty`, `onPtyData`, `onPtyExit` for the live stream loop
    - `listTmuxSessions` / `killTmuxSession` / `createOracle`-style tmux helpers as operational references
    - preload `window.elf.pty.*` and `services/backend.ts` PTY wrappers
  - New narrow seams only where unavoidable:
    - `claude:preflight` or equivalent backend probe
    - `claude:attach` or equivalent create/reattach helper that resolves the stable Claude session name and delegates to PTY/tmux internals
    - optional `claude:status` / `claude:stop` only if generic PTY methods leave lifecycle semantics too implicit for the product surface
  - Do NOT create a brand-new streaming channel, a second PTY manager, or a headless Claude service for phase 1.

  **Canonical phase-1 session owner**:
  - Source of truth is the tmux session itself.
  - The PTY id is an attachment handle, not the durable session identity.
  - Oracle/tmux roster helpers are adapters for discovery and operations, but the Claude product lane should resolve its own stable session identity directly rather than depending on manual oracle selection.

  **Session naming/lifecycle model**:
  - Use a deterministic Claude session name tied to project/session/profile context, analogous to the existing persistent terminal naming pattern in `spawnTerminal()`.
  - Lifecycle states: `preflight_failed`, `creating`, `attaching`, `ready`, `busy`, `detached`, `exited`, `crashed`.
  - `attach/create`: resolve stable tmux session name, create if missing, attach PTY client, begin streaming.
  - `resize`: pass through existing PTY resize.
  - `send`: pass through existing PTY write.
  - `detach`: close the PTY attachment without killing the tmux session when the UI merely closes/hides the lane.
  - `stop`: explicit destructive action that terminates the Claude session owner, not just the visible PTY client.

  **Preflight scope**:
  - Verify Claude CLI presence on PATH or via known install location.
  - Verify auth by running the lightest credible Claude status/probe command available to this repo policy, or by detecting a known authenticated state without exposing secrets.
  - Verify tmux availability because the phase-1 runtime model depends on it.
  - Return structured reasons the UI can render directly: `missing_cli`, `unauthenticated_cli`, `missing_tmux`, `runtime_unavailable`, `attach_failed`.

  **UI product shape implication**:
  - Backend slices support a distinct Claude product surface that hides generic terminal internals by default, even if the renderer reuses terminal components under the hood.
  - The Claude lane may still expose an escape hatch like "open raw terminal" or "copy attach command," but the main UX should not read like a generic shell pane.

  **Verification path**:
  - Local proof after implementation should cover: preflight fail states, first create, reattach to existing session, send input, resize, detach without destroy, explicit stop, and recovery from crashed session.
  - Existing `pty.test.ts` and `oracles.test.ts` provide a starting seam-level proof surface; add or extend tests only around the new helper logic and the duplicate-handler fix.

  **Known blocker recorded for this task**:
  - Duplicate stub IPC handlers in `apps/desktop/src/main/ipc-handlers.ts` currently shadow the real oracle/tmux PTY attach handlers. This must be fixed before a Claude lane can safely reuse those seams.

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
  - [x] Backend implementation slices defined in order
  - [x] Reused vs new IPC channels explicit
  - [x] Canonical phase-1 session owner explicit
  - [x] Session naming/lifecycle model explicit
  - [x] Verification path explicit

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

- [x] 7. Define surface reveal/hide rollout policy

  **What to do**:
  - Decide which surfaces flip default-on after implementation
  - Define which remain hidden/deferred
  - Include CRM hide and Pulse/CH5PM defer policy
  - Explicitly decide Claude registry behavior during transition: same tab replaced, same tab with mode switch, or compat surface relocated

  **Rollout policy**:
  - Reveal-now surfaces stay default on and continue to appear in both registry and command-palette flows: Review, Notes, Files, Terminal, Editor, Plugins, Bridges, Studio / Office, Voice, Oracle, and Claude.
  - Browser remains visible but default off until the same-origin publisher works in Electron and browser mode. After that proof gate passes, Browser flips to default on.
  - Memory remains visible but default off until the synthetic-doc open/edit/save/reopen path is proven. After that proof gate passes, Memory flips to default on.
  - CRM moves from current visible/default-on behavior to hidden/off. It should disappear from normal side-panel discoverability and from the command-palette feature toggles for this product phase.
  - Pulse remains deferred/off and should not be presented as a normal feature toggle once this policy lands.
  - CH5PM remains deferred/off and should be removed from sidebar visibility; if any discoverability survives, it is an explicit command-palette breadcrumb only, not a peer feature toggle.

  **Exact default policy after implementation milestones**:
  - Immediately / before new implementation ships:
    - Keep existing mature surfaces default on.
    - Keep Browser off.
    - Keep Memory off.
    - Keep Pulse off.
    - Keep CH5PM off.
    - Change CRM from on -> off as part of the hide pass.
  - After Browser milestone passes runtime proof in Electron + browser mode:
    - Browser default becomes on.
  - After Memory milestone passes save/reopen proof:
    - Memory default becomes on.
  - Claude does not need a default flip because it already starts on; the change is body replacement, not discoverability expansion.

  **Hide/defer behavior by surface**:
  - `Hide`: CRM. Remove normal registry/palette discoverability but preserve code.
  - `Defer`: Pulse and CH5PM. Keep them out of ordinary product discoverability until an explicit product review reactivates them.
  - `Optional breadcrumb only`: CH5PM only, and only if the team wants a narrow operator breadcrumb in the palette. No sidebar tab.
  - No surface with deferred intent should remain exposed through the generic "Features" toggle list by accident.

  **Claude transition policy**:
  - Use the same tab id, same registry entry, same persistence key, and same feature flag.
  - Replace the body in place rather than introducing a second Claude tab or a temporary mode switch.
  - Current compat/import affordances move into a compact secondary section inside the Claude tab during transition, with Settings → Migration remaining the canonical full workflow.
  - Do not keep a separate "compatibility-only" Claude surface visible once the live lane exists.

  **Registry/flag implications**:
  - `fireflySurfaceDefaults` and the corresponding `atomWithStorage` defaults must match this policy, especially CRM.
  - Registry availability for deferred/hidden surfaces must stop depending solely on the feature flag if that would still make them visible through normal product affordances.
  - Command-palette feature toggles must be pruned so hidden/deferred surfaces do not look like supported peer features.

  **Implementation-order alignment**:
  - Step 1: hide CRM and remove generic defer-surface exposure (Pulse, CH5PM) so the shell reflects product intent now.
  - Step 2: keep Browser and Memory visible but off-by-default until their proof gates land.
  - Step 3: swap Claude body in place while preserving the current tab identity.
  - Step 4: after Browser/Memory proof, flip their defaults on.

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
  - [x] Default-on/off policy explicit
  - [x] Hide/defer policy explicit
  - [x] Claude transition policy explicit in registry/tab model
  - [x] Policy aligns with implementation order

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

- [x] 8. Design browser surface UI slice

  **What to do**:
  - Define concrete browser surface UI for phase 1
  - Specify Electron embedded view and browser-mode iframe fallback behavior
  - Define minimum controls: URL display, refresh, open externally, load/failure states, lane selection if needed

  **UI decision**:
  - Phase-1 Browser becomes a product-lane viewer, not a raw mini-browser. The shell may still resemble the current panel, but every visible affordance now speaks in terms of a Palot-owned lane and its published surface rather than arbitrary destination browsing.
  - The panel keeps the same side-panel footprint and must read clearly in both `session-side-panel.tsx` modes: with the right-side vertical tab strip and in single-surface full-width mode.

  **Shared shell**:
  - Header row: title (`Browser` / `Browser Lane`), short sublabel naming the active project/profile context, and a compact state chip (`Ready`, `Loading`, `Unavailable`, `Error`).
  - Secondary control row: read-only displayed destination URL, refresh button, open externally button, and optional reload/reconnect button if lane publishing fails.
  - Remove emphasis on freeform URL typing as the primary interaction. If a manual URL field survives in Electron for internal navigation, it should be visually secondary to the lane status and display URL.

  **Electron runtime UI**:
  - Primary content region is the embedded browsing surface backed by the Electron adapter.
  - Ready state:
    - show the embedded lane surface
    - show display URL text
    - enable refresh and external-open
    - show history/recent entries only if they still map to valid lane destinations under the owned-lane model
  - Loading/provisioning state:
    - keep the frame region reserved
    - show inline loading indicator + state copy such as "Preparing browser lane…"
    - keep external-open available only when a destination exists
  - Error state:
    - show explicit error card in the content region with lane error summary and retry action
    - keep external-open visible when a raw destination exists
  - Empty/reset state:
    - show a calm empty card when no lane/destination has been chosen yet, not `about:blank` as a product-facing concept

  **Browser-mode UI**:
  - Ready state:
    - embed the same-origin published route in an iframe
    - show the same header/state chip/control model as Electron so runtime differences are honest but familiar
  - Unavailable state (most important browser-mode-specific case):
    - replace the current "needs Electron" placeholder with an explicit lane-publisher unavailable card
    - copy should explain that browser mode needs a Palot-published same-origin lane and that the publisher is not currently available
    - offer `Open externally` when a destination exists
  - Error state:
    - show route/publisher failure message with retry/reconnect action
    - never attempt direct provider iframe fallback
  - Loading state:
    - show provisioning/loading card while route metadata or iframe source is being prepared

  **MVP controls**:
  - Required:
    - displayed URL / destination label
    - refresh / reload
    - open externally
    - status chip or inline state label
  - Optional only if lane model truly needs it in phase 1:
    - lane selector when multiple lanes exist
  - Explicitly deferred:
    - automation controls
    - devtools-style controls
    - arbitrary provider URL entry as the primary workflow
    - advanced multi-tab browser chrome

  **State inventory to render explicitly**:
  - `loading/provisioning`
  - `ready`
  - `empty/no lane yet`
  - `unavailable publisher`
  - `load failure / route error`
  - `invalid destination input` only if manual URL entry survives as a secondary control

  **Parity rule**:
  - Both runtimes keep the same outer information architecture: header, state chip, minimal controls, content frame region, and explicit fallback/error cards.
  - The only runtime difference is the embed primitive and the unavailable-state copy. No runtime should have a mysterious blank surface.

  **Lane selection guidance**:
  - If multi-lane is still deferred, omit a visible selector in v1 and just show the active lane/profile context in header text.
  - If one lane selector must ship, keep it compact and secondary; do not turn the MVP into a tabbed browser manager.

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
  - [x] Browser UI states defined for both runtimes
  - [x] MVP controls defined
  - [x] Explicit error/empty/loading states defined

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

- [x] 9. Design Claude surface UI slice

  **What to do**:
  - Define the live Claude panel UX
  - Decide now whether this is a terminal-specialized wrapper or distinct Claude-first product surface
  - Decide how much is terminal-first vs Claude-specific affordances
  - Define attach/create/select/reconnect session, input box, streaming output, and runtime status affordances
  - Define explicit failure/auth states: missing Claude CLI, unauthenticated CLI, busy session, crashed session, attach timeout

  **UI decision**:
  - Claude should ship as a distinct Claude-first product surface, not as a raw generic terminal panel. Under the hood it can reuse the same PTY/terminal components, but the visible information architecture should center on Claude readiness, session continuity, and command flow rather than on shell mechanics.
  - Keep the existing `claude` tab id and replace the body in place. Migration/import tools move into a compact secondary section or collapsible drawer inside the Claude tab.

  **Primary layout**:
  - Header block:
    - title: `Claude Code`
    - project/session context subtitle
    - runtime status chip (`Checking`, `Ready`, `Busy`, `Unavailable`, `Crashed`)
    - refresh / reconnect action
  - Main body:
    - live PTY transcript/terminal region as the dominant visual surface
    - one persistent composer/input row docked below it
  - Secondary utility strip:
    - copy attach command
    - open raw terminal / advanced fallback entry if we keep that escape hatch
    - compact session metadata (project, branch/worktree if helpful, active session label)
  - Secondary migration section:
    - collapsed by default once the live lane exists
    - contains detection/import/restore affordances and a link/nudge to Settings → Migration

  **Terminal-first vs Claude-first balance**:
  - Terminal internals are implementation, not the product framing.
  - The PTY stream can still use the existing terminal renderer component, but the surrounding UX should not read like "Terminal with a new name".
  - Claude-specific affordances should lead: runtime state, attach/create/reconnect, prompt composer, stop/restart, migration tools.
  - Shell-oriented affordances such as raw attach command belong in a secondary utility cluster.

  **First-time path**:
  - User opens Claude tab.
  - Surface runs preflight automatically.
  - If no session exists and preflight passes, surface offers a primary CTA like `Start Claude session`.
  - Once started, the live stream fills the main region and the composer becomes active.
  - If a reusable session already exists, the tab lands in `Reconnect / Resume` instead of pretending nothing happened.

  **Steady-state path**:
  - User sees live Claude output in the stream pane.
  - User types follow-up input into the composer and sends it without leaving the tab.
  - Surface exposes clear `Busy` vs `Ready` semantics so the user knows whether Claude is still running or awaiting input.
  - If the pane is closed and reopened, the UI should prefer reattach/resume to creating a duplicate session.

  **Session affordances**:
  - Required in v1:
    - create / start
    - attach / reconnect
    - send follow-up input
    - stop / terminate explicitly
    - refresh status
  - Optional in v1 only if needed by the stable session model:
    - compact session selector when multiple Claude sessions per project truly exist
  - Deferred:
    - rich conversation history browser
    - advanced mode/model pickers beyond whatever Claude Code itself exposes inside the TUI
    - multi-session dashboard inside the tab

  **Failure and auth states**:
  - `missing Claude CLI`:
    - explicit setup card with concise explanation and recovery action
  - `unauthenticated Claude CLI`:
    - explicit sign-in/auth-needed card
  - `busy session`:
    - visible busy chip/state; composer can still queue or send follow-up depending on runtime semantics, but the user must understand Claude is mid-run
  - `crashed session`:
    - error card with restart/reconnect actions
  - `attach timeout`:
    - timeout card with retry and raw attach fallback
  - `runtime unavailable` (browser mode or unsupported environment):
    - honest unavailable card, not a fake migration summary

  **State inventory**:
  - `checking preflight`
  - `ready with active stream`
  - `ready idle / awaiting input`
  - `creating / attaching`
  - `busy`
  - `missing_cli`
  - `unauthenticated_cli`
  - `attach_timeout`
  - `crashed_session`
  - `runtime_unavailable`
  - `empty/no session yet`

  **Migration/compat handling**:
  - Detection/import summary remains available but demoted below the live lane.
  - Restore-backup stays accessible from the migration section when runtime allows it.
  - Settings → Migration remains the primary place for full migration workflow.
  - Once live lane ships, the top-of-tab copy must stop describing the surface as compatibility-only.

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
  - [x] Live Claude surface UX defined
  - [x] Session/input/output states explicit
  - [x] Failure/auth states explicit
  - [x] Migration/compat info either retained or intentionally relocated

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

- [x] 10. Design memory file-tree/editor UI slice

  **What to do**:
  - Define exact memory surface UX using existing files/editor ideas
  - Decide tree structure, file open/edit/save states, and markdown editing behavior
  - Lock one canonical synthetic path scheme now: `memory/<scope>/<topic>.md` so tree, breadcrumbs, open/save, and deep-linking share one contract
  - Define deterministic hierarchy derivation from memory records -> virtual folders/files
  - Define edit conflict policy for backing-store changes outside editor
  - Decide single-doc vs multi-tab editing behavior
  - Identify reuse path for Monaco/markdown/plain editor as appropriate

  **UI decision**:
  - Memory v1 uses the same broad two-pane shell as Files/Editor: virtual tree on the left, one active document on the right.
  - It is a single-doc editor in v1. No multi-tab memory workspace, no side-by-side compare, no analytics subpanes.
  - The surface should feel like a native sibling of Files and Editor, but the content model is explicitly virtual and memory-specific.

  **Tree structure**:
  - Root folder label: `memory/`
  - First level folders: `project/`, `shared/`, and any later supported scope buckets (`user/`, `global/`) derived from the memory model.
  - Leaf nodes: one markdown doc per canonical memory record, named from the canonical synthetic path scheme `memory/<scope>/<topic>.md`.
  - Deterministic hierarchy derivation:
    - fetch `MemoryItem[]`
    - map each item to `{ path, scope, topic, recordId }`
    - group by scope folder
    - sort folders deterministically, then sort docs alphabetically by topic/path
  - Tree rows should show folder/file icons and selected-state behavior matching Files, but omit git decorations because memory docs are not filesystem artifacts.

  **Open/edit/save flow**:
  - Default/empty state:
    - left rail still visible with search + tree chrome
    - right pane says `Select a memory doc to edit it` or `No memory docs yet` depending on loaded data
  - Open:
    - selecting a leaf opens the materialized markdown doc in the right pane
    - header shows selected synthetic path and compact metadata (scope/source/updated time)
  - Edit:
    - Monaco-backed markdown editor reuses the Editor panel interaction model
    - dirty indicator mirrors Editor (`unsaved dot`, saved check, `Cmd/Ctrl+S` affordance)
  - Save:
    - save runs through the memory service back to the owning record backend
    - on success, clear dirty state, refresh metadata timestamps, and refresh the tree if the topic slug/path changed
  - Reopen:
    - reopening the same synthetic path after save should land on the same doc unless a slug change intentionally remapped it

  **Markdown editing behavior**:
  - Use Monaco for v1. No new markdown editor stack.
  - The editable body should focus on the human-meaningful memory content.
  - Metadata should preferably live as read-only chrome above the editor or in a generated/protected section, not as freeform editable fields the user can accidentally corrupt.
  - Search box filters virtual docs by topic/path/body summary, not by raw backend ids.

  **Conflict / stale-change policy**:
  - Capture the source record `updatedAt` at open time.
  - If save sees a newer backing `updatedAt`, surface a stale-change conflict card or modal with explicit choices: reload latest or overwrite intentionally.
  - Do not silently merge in v1.
  - If the record disappears remotely while open, show a `doc removed` error state instead of saving into the void.

  **Single-doc vs multi-doc behavior**:
  - Single-doc only in v1.
  - Opening a different doc replaces the current editor target; if current doc is dirty, require save/discard/continue decision before switching.
  - Deep-linking and restore logic can still remember the last selected synthetic path, but not a tab set.

  **Reuse plan**:
  - Reuse from Files:
    - left-rail proportions and row styling
    - selected-item chrome
    - loading/empty/error shell patterns
  - Reuse from Editor:
    - Monaco host
    - dirty/saved status strip
    - keyboard save behavior
    - editor loading/error overlay treatment
  - Do not reuse:
    - filesystem read/write hooks directly
    - file preview fallback logic for binary/image/pdf kinds

  **Explicit states to render**:
  - `loading docs`
  - `no docs yet`
  - `no search matches`
  - `doc selected / ready`
  - `dirty`
  - `saving`
  - `save success`
  - `stale conflict`
  - `save/load error`

  **Topic rename behavior**:
  - If save changes the topic slug/path, update the selected node and path display immediately after successful persistence.
  - Treat it as rename-in-place from the user's perspective, not as a disappearance followed by an unrelated new file.

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
  - [x] Memory file-tree/editor UX defined
  - [x] Canonical synthetic path scheme explicit
  - [x] Conflict/stale-change policy explicit
  - [x] Open/edit/save flow explicit
  - [x] Editor technology/reuse decision explicit

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

- [x] 11. Define integrated verification and rollout order

  **What to do**:
  - Produce final execution sequence for implementation agents
  - Define verification gates after browser, Claude, and memory work
  - Include browser-mode and Electron-mode checks where relevant

  **Rollout order**:
  - Milestone 0 — shell/policy correction:
    - land CRM hide, Pulse defer, CH5PM defer, and any generic discoverability cleanup first
    - this reduces surface noise before the three priority lanes change underneath users
  - Milestone 1 — Browser backend + UI:
    - implement browser runtime adapter/publisher contract
    - implement browser UI slice
    - verify Electron and browser-mode behavior separately
    - keep Browser default off until proof gate passes
  - Milestone 2 — Claude backend + UI:
    - repair PTY/oracle seam bug
    - add Claude preflight/create-attach helpers
    - ship Claude-first live tab body in place of compatibility-only body
    - verify Electron runtime flow end to end before any release claim
  - Milestone 3 — Memory backend/UI:
    - implement synthetic-doc tree/search/editor flow
    - verify open/edit/save/reopen and stale-change behavior
    - keep Memory default off until proof gate passes
  - Milestone 4 — default flips and cleanup:
    - flip Browser on only after Milestone 1 proof
    - flip Memory on only after Milestone 3 proof
    - keep Claude on throughout because it is a body replacement, not a discoverability flip
  - Milestone 5 — final audit/release readiness:
    - run final cross-surface verification matrix
    - confirm deferred surfaces stay hidden/deferred

  **Verification gates**:
  - Global gate after every milestone:
    - `bun run lint`
    - `bun run check-types`
  - Browser-mode proof lane:
    - `bun run dev`
    - `bun run svc:status`
  - Electron proof lane:
    - `cd apps/desktop && bun run dev:electron-local`
  - Each milestone must produce a user-facing proof, not just backend readiness.

  **Surface-specific proof list**:
  - Browser Electron:
    - open Browser tab
    - load ready same-origin lane
    - refresh lane
    - open externally
    - see explicit runtime error state when lane fails
  - Browser web mode:
    - open Browser tab in browser-mode stack
    - render same-origin iframe route when publisher is available
    - show unavailable-publisher fallback when publisher is unavailable
  - Claude:
    - preflight missing/unauthenticated/ready states
    - create session
    - attach / reconnect existing session
    - send input
    - observe live output
    - resize/stream remains stable
    - explicit stop / terminate behavior
  - Memory:
    - open doc
    - edit doc
    - save doc
    - reopen same doc
    - verify stale-change conflict handling

  **Regression checks that must remain in scope**:
  - Files surface still works after Memory tree/editor reuse changes
  - Editor surface still works after Monaco reuse changes
  - Oracle surface still works after PTY/oracle seam repair
  - Command-palette discoverability matches the rollout policy
  - Feature-flag defaults match the intended release state

  **Shipping policy**:
  - Do not bundle Browser, Claude, and Memory into one unverified big-bang claim.
  - Prefer staged landing where each milestone reaches a meaningful usable state and has its own runtime proof.
  - Browser is first because it has the sharpest runtime split; Claude second because it depends on backend seam repair; Memory third because it depends on stable shell/editor reuse more than on runtime branching.

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
  - [x] Rollout order explicit
  - [x] Verification commands/gates explicit
  - [x] Browser/Electron split covered
  - [x] Surface-specific user-path proofs defined for Browser, Claude, and Memory

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

- [x] 12. Document deferred surfaces and non-goals

  **What to do**:
  - Record why Pulse, CH5PM, and CRM are not in this implementation wave
  - Distinguish hidden-vs-deferred-vs-command-palette-only-vs-later-upgrade
  - Add revisit triggers for each deferred surface
  - Prevent future scope confusion

  **Deferred surfaces and non-goals**:
  - CRM — `hidden now`
    - Why it is out of scope: current CRM surface is real but not aligned with this wave's product goal; it is drafts-only / Electron-only and not worth occupying a primary sidebar slot while Browser, Claude, and Memory are still incomplete.
    - Current treatment: hidden from sidebar and normal command-palette discoverability; code preserved.
    - Not a product deletion: this is a visibility decision, not a backend rewrite.
    - Revisit trigger: CRM becomes eligible again when outbound workflow maturity and product priority both justify a first-class operator lane.
  - Pulse — `deferred`
    - Why it is out of scope: there is no chosen operator contract for what Pulse should mean in this product wave.
    - Current treatment: off, deferred, removed from generic peer-feature discoverability.
    - Non-goal in this roadmap: no attempt to make Pulse real, define a metrics product, or expand into dashboard work during sidebar-surface completion.
    - Revisit trigger: explicit operator/metrics contract and owner are defined.
  - CH5PM — `deferred` (optional breadcrumb only)
    - Why it is out of scope: current panel uses mock-seeded fallback and product intent is still unclear.
    - Current treatment: no sidebar visibility; optional command-palette breadcrumb only if intentionally retained for operators.
    - Non-goal in this roadmap: no attempt to turn CH5PM into a first-class sidebar lane before product review.
    - Revisit trigger: explicit product review resolves owner, data source, and the reason this deserves a product lane instead of a separate workflow.

  **Meaning of each status in this plan**:
  - `hidden`: preserve code, remove normal product discoverability for now.
  - `deferred`: intentionally not part of the current implementation wave; keep out of ordinary discoverability until its trigger is met.
  - `command-palette-only`: limited breadcrumb for expert/operator recall without giving the surface normal sidebar parity.
  - `later upgrade`: possible future expansion after the current Browser/Claude/Memory work proves out.

  **Wave non-goals**:
  - No Pulse implementation in this effort.
  - No CH5PM product-definition work beyond documenting its deferral.
  - No CRM surfacing as a normal product lane in this effort.
  - No expansion of Browser into advanced agent-control work.
  - No expansion of Memory into analytics/ops cockpit behavior.
  - No second Claude runtime model beyond the phase-1 TUI lane.

  **Scope guard**:
  - If implementation work starts drifting into Pulse product design, CH5PM product design, or CRM revival, that is out of scope unless a new explicit product decision supersedes this plan.
  - Deferred surfaces should not regain visibility through feature toggles, registry defaults, or palette entries by accident.

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
  - [x] Deferred surfaces documented
  - [x] Non-goals explicit
  - [x] Future revisit points clear

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

- [x] F1. Plan compliance audit — verify browser, Claude, memory, CRM, Pulse, CH5PM decisions all appear explicitly and match user direction.
  - Result: pass. Browser is explicitly same-origin, top-priority, and MVP-bounded; Claude is explicitly a live PTY/tmux Claude Code lane; Memory is explicitly simplified into file-tree + markdown editor; CRM is explicitly hidden; Pulse is explicitly deferred; CH5PM is explicitly deferred / optional breadcrumb only.
- [x] F2. Architecture quality review — verify browser copies Hub principles, Claude reuses PTY/oracle seams, memory reuses files/editor patterns.
  - Result: pass. Browser stays same-origin and stream-plane-first; Claude stays PTY/tmux/oracle-based with TUI lane first; Memory stays reuse-heavy on Files + Editor patterns.
- [x] F3. Scope fidelity review — verify no accidental expansion into advanced browser control, Pulse implementation, or memory-cockpit complexity.
  - Result: pass. Browser keeps advanced control deferred; Pulse and CH5PM stay out of active implementation; Memory remains a simple file-tree/editor lane rather than a cockpit.
- [x] F4. Execution-readiness review — verify implementation agents could start without new product questions, and every priority surface has owner, data contract, and fallback/error policy.
  - Result: pass. Browser, Claude, and Memory each have explicit owners, contracts, verification gates, and fallback/error states, so implementation can begin without fresh product-direction discovery.

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