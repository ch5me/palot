# Firefly Superapp Port — Remaining Real Implementation Work <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->
> **Summary**: This plan replaces the optimistic port matrix as the execution source of truth for the remaining real Firefly-in-Palot implementation work. Shared shell substrate is already landed; remaining work is runtime/product completion for Browser, Bridges, Studio/Office, Voice, plus explicit Oracle and Claude boundary handling.
> **Deliverables**: real browser runtime, real Bridges connector backends (OpenCode + Claude Code if available), first Studio preview runtime, real voice capture/transcription runtime, explicit Oracle boundary implementation, final integration proof.
> **Effort**: XL
> **Parallel**: YES — 6 waves
> **Critical Path**: T1 -> T2/T3 -> T4/T5 -> T6 -> F1-F4

---

## Purpose
This is the durable source of truth for the **remaining implementation work only** behind the Firefly superapp port in `palot`.

This plan intentionally excludes:
- already-landed side-panel/registry/flags/command-palette substrate
- retired/non-goal surfaces
- CRM runtime work for now
- docs-first cleanup work

This plan should drive `/start-work` execution. Older matrix/backlog artifacts become reference-only input, not execution authority.

---

## Original Request <!-- oc:id=sec_ac -->
Create an honest, implementation-oriented remaining-work plan for the Firefly superapp port in Palot. The old matrix became too optimistic because many surfaces are proof shells. New plan must focus on remaining runtime/product work only, support ultrawork execution, use TDD-oriented planning, define atomic commits, and be practical for `/start-work`.

---

## What Already Exists — Do Not Rewrite

| Area | Path | Current Truth |
|---|---|---|
| Surface registry | `apps/desktop/src/renderer/firefly-surface-registry.tsx:87` | Shared Firefly surface registry exists and is the right substrate. |
| Feature flags | `apps/desktop/src/renderer/atoms/feature-flags.ts:26` | Per-surface persisted flags and toggles already exist. |
| Command palette | `apps/desktop/src/renderer/components/command-palette.tsx:255` | Surface discoverability/toggle substrate exists. |
| Side-panel host | `apps/desktop/src/renderer/components/agent-detail.tsx` | Shared side-panel integration path already exists. |
| Browser shell | `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:62` | Browser has a real embedded shell but still needs production runtime/persistence/proof hardening. |
| Bridges shell | `apps/desktop/src/renderer/components/side-panel/bridges-panel.tsx:238` | Real UI and backend seam exist, but backend data is still demo/mock-backed. |
| Bridges API seam | `apps/desktop/src/renderer/services/backend.ts:231` | `fetchBridges()` and `fetchBridgeActivity()` already define the renderer contract. |
| Studio shell | `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx:8` | Proof shell only. No preview runtime yet. |
| Voice shell | `apps/desktop/src/renderer/components/side-panel/voice-panel.tsx:8` | Proof shell only. No capture/STT runtime yet. |
| Oracle shell | `apps/desktop/src/renderer/components/side-panel/oracle-panel.tsx:10` | Real roster view exists. Decision needed is whether roster-only is final for this phase. |
| Claude shell | `apps/desktop/src/renderer/components/side-panel/claude-panel.tsx:8` | Compatibility/import shell exists. Live Claude runtime is intentionally out of scope. |
| Claude migration runtime | `apps/desktop/src/main/onboarding.ts` | Real Claude migration/onboarding work already exists and should be reused, not duplicated. |

---

## Explicit Non-Goals / Retirements <!-- oc:id=sec_ad -->
- CRM runtime in this plan
- Dashboard revival
- Device surface revival
- Monitor surface revival
- Database surface port
- Motion surface port
- Second interactive coding runtime beside OpenCode
- Docs-heavy cleanup as a priority lane

---

## Product Boundary Decisions Locked By This Plan

### Browser
Browser stays in scope. Treat it as real remaining implementation work because it still needs production-grade runtime behavior, persistence, and proof.

### Bridges
First real Bridges connectors should be:
1. OpenCode
2. Claude Code, if meaningful live status/activity can be sourced without inventing a second interactive runtime

Bridges is not a fake “integration backlog” card wall anymore once these land. It must expose real runtime state.

### Studio / Office
Supported formats are **not decided yet**. First task is a format decision with executable proof. Sensible default recommendation:
- start with **PDF first**
- then expand to **DOCX** only if proof is clean and low-friction
- leave XLSX/PPTX for later unless the decision task proves they are cheap and reliable

Reason: PDF gives immediate user value with lowest ambiguity and best preview odds.

### Voice
Voice backend must be real in this plan. No adapter-only fake progress. End state must support:
- real capture
- real transcription
- insert transcription into active prompt/input flow

### Oracle
Recommended handling for this plan:
- **keep Oracle as roster-first**, not full tmux/orchestration control plane
- implement only the boundary work needed to make that decision explicit and coherent in-product
- if one small follow-up action is cheap and real (for example open/focus related session context), it can land
- do **not** grow Oracle into a second orchestration project in this plan

Meaning: Oracle is “done for this phase” when it is a solid roster/status surface with clear non-goal boundary, not when it becomes a tmux dashboard.

### Claude
Recommended handling for this plan:
- keep Claude as compatibility/import boundary only
- improve panel usefulness only if it directly leverages real migration/runtime signals already available
- do not embed live Claude Code execution

Meaning: Claude is “done for this phase” when the panel truthfully reflects compatibility/import state and helps migration users, not when it becomes another coding surface.

---

## Remaining Work Summary <!-- oc:id=sec_ae -->

| Lane | Current Truth | Target Slice | Priority |
|---|---|---|---|
| Browser | Embedded shell exists, but runtime/persistence/QA are not locked as production-ready | hardened browser runtime with navigation state, persistence, failure handling, and executable proof | P0 |
| Bridges | Real UI + seam, demo backend data | real OpenCode connector + real Claude Code connector if available | P0 |
| Studio / Office | proof shell only | first real preview runtime with explicit format decision first | P1 |
| Voice | proof shell only | real capture + transcription + insert-into-chat flow | P1 |
| Oracle boundary | roster exists, scope confusion remains | explicit roster-first phase boundary, small real affordance only if cheap | P2 |
| Claude boundary | compatibility shell exists | truthful compatibility/import state using existing migration/runtime signals | P2 |

---

## Execution Contract
- This plan is the sole execution source of truth for remaining Firefly port work.
- Only the orchestrator updates checkboxes.
- Every task must ship with executable acceptance criteria.
- TDD default:
  - RED -> GREEN -> REFACTOR when test seam exists
  - if no test seam exists, task must add one or provide durable executable verification helper
- One task = one concern = one atomic commit unless inseparable
- No docs-first tasks unless needed to unblock implementation or capture final boundary truth

---

## Verification Strategy <!-- oc:id=sec_af -->
> ZERO HUMAN-ONLY CLAIMS. All completion claims need executable proof.

### Global gates <!-- oc:id=sec_ag -->
- `bun run lint`
- `bun run check-types`
- `bun run build`

### Evidence rules <!-- oc:id=sec_ah -->
- Save outputs under `.sisyphus/evidence/firefly-remaining-work/`
- Naming:
  - `task-{N}-{slug}.txt`
  - `task-{N}-{slug}.png`
  - `final-{slug}.txt`

### QA minimum per task <!-- oc:id=sec_ai -->
- 1 happy-path scenario
- 1 failure/edge scenario
- evidence artifact path named in task

---

## Atomic Commit Strategy

| Commit | Scope | Rule |
|---|---|---|
| 1 | browser runtime hardening | browser only |
| 2 | bridges real backend foundation | bridges contract/backend only |
| 3 | bridges OpenCode connector | one real connector |
| 4 | bridges Claude connector or explicit availability boundary | one connector / one boundary |
| 5 | studio format decision + preview foundation | decision + service seam |
| 6 | studio first real format support | preview runtime only |
| 7 | voice capture foundation | capture/runtime contract |
| 8 | voice transcription + insert flow | voice UX/runtime only |
| 9 | oracle + claude boundary polish | boundary-only work |
| 10 | final integration fixes + proof | only cross-lane cleanup needed for green verification |

Rules:
- No mixed commits across unrelated lanes
- No giant “remaining work” commit
- Pre-commit proof must be listed in each task
- If two tasks are inseparable, say so explicitly in the task

---

## Parallel Execution Waves <!-- oc:id=sec_aj -->

### Wave 0 — Global blockers only <!-- oc:id=sec_ak -->
- [ ] T1. Shell correctness and verification lane audit
  - Goal: eliminate cross-cutting shell bugs that would invalidate all later runtime proof
  - Includes:
    - command open/focus behavior
    - disabled-surface restore fallback
    - any local dev/build boot blocker that prevents real verification
  - Deliverables:
    - open/focus works from command palette for in-scope surfaces
    - disabled active surface falls back safely
    - verification lane runs clean enough to support later waves
  - Files likely touched:
    - `apps/desktop/src/renderer/components/command-palette.tsx`
    - `apps/desktop/src/renderer/atoms/ui.ts`
    - related side-panel host files only if needed
  - TDD plan:
    - add/extend targeted UI/state tests if harness exists
    - otherwise add executable state verification helper and durable proof
  - Acceptance criteria:
    - [ ] opening Browser/Bridges/Studio/Voice from palette focuses correct surface
    - [ ] disabling active in-scope surface does not strand UI in invalid state
    - [ ] global gates pass
  - QA scenarios:
    - Happy: open each in-scope surface from command palette -> correct tab opens
    - Edge: disable currently active surface -> valid fallback opens
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-1-open-focus.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-1-restore-fallback.txt`
  - Commit:
    - `fix(shell): harden firefly surface open and restore behavior`

### Wave 1 — Browser + Bridges foundation <!-- oc:id=sec_al -->
- [ ] T2. Browser runtime hardening
  - Goal: move Browser from “embedded shell exists” to production-credible runtime
  - Includes:
    - navigation model audit
    - persistence decision and implementation for current URL/history-safe state
    - failure/loading states
    - external-open and reload correctness
  - Must NOT do:
    - browser-to-agent workflow extras before core browsing is solid
  - Files likely touched:
    - `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx`
    - `apps/desktop/src/renderer/atoms/preferences.ts` or other persistence atom location
    - preload/main only if runtime hardening truly needs it
  - TDD plan:
    - add tests around URL normalization/state restoration if test seam exists
    - add executable Electron/browser-mode proof helper for manual runtime evidence
  - Acceptance criteria:
    - [ ] browser opens with stable initial state
    - [ ] navigation/back/forward/reload behave correctly
    - [ ] persisted state restores correctly across relaunch if persistence is enabled
    - [ ] invalid URL / load failure path surfaces clear feedback
  - QA scenarios:
    - Happy: load known URL -> navigate -> back -> forward -> reload
    - Edge: submit malformed/unsupported URL -> graceful failure path
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-2-browser-happy.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-2-browser-error.txt`
  - Commit:
    - `feat(browser): harden firefly browser runtime`

- [ ] T3. Bridges backend replacement foundation
  - Goal: remove hardcoded/demo bridge data path
  - Includes:
    - replace mock roster/activity producers with real service layer
    - keep renderer contract stable if possible
    - define connector model that supports OpenCode and Claude Code first
  - Files likely touched:
    - `apps/desktop/src/main/ipc-handlers.ts`
    - new `apps/desktop/src/main/bridges/*`
    - `apps/desktop/src/preload/index.ts`
    - `apps/desktop/src/preload/api.d.ts`
    - `apps/desktop/src/renderer/services/backend.ts`
  - TDD plan:
    - add service-level tests/fixtures for connector roster/activity mapping
    - RED on hardcoded-data assumptions removal, GREEN with real providers
  - Acceptance criteria:
    - [ ] Bridges no longer depends on hardcoded demo roster/activity data
    - [ ] connector roster is sourced from real runtime inspection/service code
    - [ ] renderer contract remains executable
  - QA scenarios:
    - Happy: bridges roster returns real connector records
    - Edge: missing connector/runtime yields explicit disconnected/unavailable state, not fake “live”
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-3-bridges-foundation.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-3-bridges-unavailable.txt`
  - Commit:
    - `feat(bridges): replace demo roster with real backend foundation`

### Wave 2 — First real Bridges connectors <!-- oc:id=sec_am -->
- [ ] T4. OpenCode Bridges connector
  - Goal: make OpenCode a real Bridges connector with truthful status/activity if available
  - Includes:
    - live status
    - meaningful activity or health signal
    - clear unavailable path
  - Dependencies:
    - T3
  - Files likely touched:
    - `apps/desktop/src/main/bridges/opencode.ts`
    - `apps/desktop/src/main/ipc-handlers.ts`
    - `apps/desktop/src/renderer/components/side-panel/bridges-panel.tsx`
  - TDD plan:
    - fixture-based service tests for connected/disconnected states
  - Acceptance criteria:
    - [ ] OpenCode bridge reflects real runtime state
    - [ ] activity/health signal is real, not placeholder text
    - [ ] disconnected state is explicit
  - QA scenarios:
    - Happy: running OpenCode environment -> connector reports connected and meaningful activity
    - Edge: unavailable OpenCode state -> connector reports disconnected without fake traffic
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-4-opencode-connected.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-4-opencode-disconnected.txt`
  - Commit:
    - `feat(bridges): add real opencode connector`

- [ ] T5. Claude Code Bridges connector or explicit hard boundary
  - Goal: add real Claude Code connector if truthful runtime/status signals are available; otherwise ship explicit unavailable boundary with no fake live state
  - Dependencies:
    - T3
  - Files likely touched:
    - `apps/desktop/src/main/bridges/claude.ts`
    - `apps/desktop/src/main/ipc-handlers.ts`
    - `apps/desktop/src/renderer/components/side-panel/bridges-panel.tsx`
    - possibly `apps/desktop/src/main/onboarding.ts` reuse points
  - TDD plan:
    - RED on expected connector mapping / unavailable boundary cases
  - Acceptance criteria:
    - [ ] if Claude runtime/status is discoverable, connector is real
    - [ ] if not discoverable, UI clearly marks connector unavailable/planned without pretending it is live
    - [ ] no second interactive coding runtime is introduced
  - QA scenarios:
    - Happy: if runtime signal exists, connector shows truthful status
    - Edge: if signal absent, connector shows explicit unavailable boundary
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-5-claude-state.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-5-claude-boundary.txt`
  - Commit:
    - `feat(bridges): add claude connector boundary`

### Wave 3 — Studio / Office decision and first runtime <!-- oc:id=sec_an -->
- [ ] T6. Studio format decision + preview foundation
  - Goal: make file-format support an explicit proved decision, then lay preview service foundation
  - Recommendation bias:
    - prefer PDF first
    - add DOCX only if decision task proves clean path
  - Includes:
    - evaluate candidate preview path
    - choose first supported format set
    - create preview service seam
  - Must NOT do:
    - broad office-suite ambition before first format proof
  - Files likely touched:
    - new `apps/desktop/src/main/preview-service.ts`
    - `apps/desktop/src/main/ipc-handlers.ts`
    - `apps/desktop/src/preload/index.ts`
    - `apps/desktop/src/preload/api.d.ts`
    - `apps/desktop/src/renderer/services/backend.ts`
    - `apps/desktop/src/renderer/components/side-panel/studio-panel.tsx`
  - TDD plan:
    - service-level tests around preview job/result contract where possible
  - Acceptance criteria:
    - [ ] first supported format decision is encoded in code/path, not only prose
    - [ ] preview service seam exists and returns executable result state
    - [ ] unsupported format path is explicit
  - QA scenarios:
    - Happy: supported test file yields preview-ready result
    - Edge: unsupported file yields explicit unsupported state
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-6-format-decision.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-6-unsupported-format.txt`
  - Commit:
    - `feat(studio): add preview foundation and first format decision`

- [ ] T7. Studio first real preview runtime
  - Goal: ship one real Studio preview flow end-to-end
  - Dependencies:
    - T6
  - Includes:
    - render supported file in Studio
    - loading/error/empty states
    - connect from practical entrypoint if needed
  - Acceptance criteria:
    - [ ] user can preview at least one supported file type end-to-end
    - [ ] loading and error states are real
    - [ ] unsupported files do not fail silently
  - QA scenarios:
    - Happy: preview supported file in Studio
    - Edge: corrupt/missing file -> clear error state
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-7-studio-happy.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-7-studio-error.txt`
  - Commit:
    - `feat(studio): ship first real preview runtime`

### Wave 4 — Voice real runtime <!-- oc:id=sec_ao -->
- [ ] T8. Voice capture runtime foundation
  - Goal: add real microphone capture path
  - Includes:
    - microphone permission handling
    - capture state model
    - error path for unavailable devices/permissions
  - Files likely touched:
    - `apps/desktop/src/renderer/components/side-panel/voice-panel.tsx`
    - supporting hooks/components
    - preload/main only if required by backend choice
  - TDD plan:
    - test state transitions where possible
    - durable runtime evidence for permission/capture states
  - Acceptance criteria:
    - [ ] user can start and stop real capture
    - [ ] permission/device failures are explicit
    - [ ] capture state is reflected in UI truthfully
  - QA scenarios:
    - Happy: record short clip successfully
    - Edge: denied permission/no device -> explicit failure state
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-8-voice-capture.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-8-voice-permission.txt`
  - Commit:
    - `feat(voice): add real capture runtime`

- [ ] T9. Voice transcription + insert into active prompt flow
  - Goal: complete real voice slice with backend transcription and insertion
  - Dependencies:
    - T8
  - Includes:
    - real STT backend integration
    - transcript result handling
    - insert transcript into active prompt/input flow
  - Must NOT do:
    - fake “adapter later” seam
    - TTS expansion
  - Files likely touched:
    - voice UI files
    - transcription service seam
    - prompt/input flow files
  - TDD plan:
    - RED on transcription result contract
    - GREEN with real backend path
  - Acceptance criteria:
    - [ ] recorded clip transcribes through real backend
    - [ ] transcript inserts into active chat/prompt input
    - [ ] backend failure path is explicit and recoverable
  - QA scenarios:
    - Happy: speak short phrase -> transcript appears in active input
    - Edge: backend/transcription failure -> explicit error, no silent drop
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-9-voice-transcript.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-9-voice-error.txt`
  - Commit:
    - `feat(voice): transcribe and insert captured speech`

### Wave 5 — Oracle and Claude boundary completion <!-- oc:id=sec_ap -->
- [ ] T10. Oracle roster-first boundary completion
  - Goal: remove ambiguity around Oracle scope for this phase
  - Includes:
    - make roster/status surface solid
    - add one cheap real affordance only if it strengthens roster usefulness without creating a new control-plane project
  - Must NOT do:
    - tmux fleet orchestration buildout
  - Acceptance criteria:
    - [ ] Oracle clearly behaves as roster-first surface
    - [ ] no fake orchestration affordances remain
    - [ ] any added affordance is real and cheap
  - QA scenarios:
    - Happy: active/recent roster renders correctly
    - Edge: empty roster state remains useful and truthful
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-10-oracle-roster.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-10-oracle-empty.txt`
  - Commit:
    - `feat(oracle): finalize roster-first boundary`

- [ ] T11. Claude compatibility/import boundary completion
  - Goal: make Claude panel useful without becoming a second runtime
  - Includes:
    - reflect real migration/compatibility state where available
    - reuse existing onboarding/runtime signals
  - Must NOT do:
    - embed live Claude Code session execution
  - Acceptance criteria:
    - [ ] Claude panel shows truthful compatibility/import state
    - [ ] panel reuses existing real migration/runtime sources where available
    - [ ] no second interactive coding lane is introduced
  - QA scenarios:
    - Happy: migration/compatibility state renders from real source
    - Edge: unavailable state is explicit, not placeholder fiction
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-11-claude-state.txt`
    - `.sisyphus/evidence/firefly-remaining-work/task-11-claude-unavailable.txt`
  - Commit:
    - `feat(claude): finalize compatibility boundary`

### Wave 6 — Final integration proof <!-- oc:id=sec_aq -->
- [ ] T12. Cross-lane integration cleanup
  - Goal: fix only real issues revealed by combined runtime testing
  - Dependencies:
    - T2-T11
  - Acceptance criteria:
    - [ ] no lane-specific blocker remains for Browser, Bridges, Studio, Voice
    - [ ] final green verification path holds
  - Evidence:
    - `.sisyphus/evidence/firefly-remaining-work/task-12-integration.txt`
  - Commit:
    - `fix(firefly): resolve remaining integration regressions`

---

## Dependency Matrix

| Task | Depends On | Blocks |
|---|---|---|
| T1 | — | T2-T11 |
| T2 | T1 | Final verification |
| T3 | T1 | T4, T5 |
| T4 | T3 | Final verification |
| T5 | T3 | Final verification |
| T6 | T1 | T7 |
| T7 | T6 | Final verification |
| T8 | T1 | T9 |
| T9 | T8 | Final verification |
| T10 | T1 | Final verification |
| T11 | T1 | Final verification |
| T12 | T2-T11 as needed | F1-F4 |

---

## Final Verification Wave <!-- oc:id=sec_ar -->

- [ ] F1. Plan Compliance Audit
  - Verify every deliverable in this plan exists
  - Verify non-goals stayed out
  - Output verdict: APPROVE / REJECT

- [ ] F2. Code Quality Review
  - Run:
    - `bun run lint`
    - `bun run check-types`
    - `bun run build`
  - Scan for:
    - `as any`
    - `@ts-ignore`
    - dead placeholder copy in completed lanes
    - fake/demo connector residue in Bridges
  - Output verdict: APPROVE / REJECT

- [ ] F3. Runtime QA Sweep
  - Execute every task QA scenario
  - Run integrated sweep across Browser, Bridges, Studio, Voice
  - Output verdict: APPROVE / REJECT

- [ ] F4. Scope Fidelity Check
  - Verify no CRM work accidentally slipped in
  - Verify no docs-heavy work stole priority
  - Verify Oracle and Claude stayed within boundary
  - Output verdict: APPROVE / REJECT

---

## Success Criteria
- [ ] Browser is production-credible, not just embedded shell
- [ ] Bridges exposes real OpenCode connector state
- [ ] Bridges exposes real Claude Code connector state if available, otherwise explicit hard boundary
- [ ] Studio previews at least one real supported format end-to-end
- [ ] Voice supports real capture, real transcription, and insert-into-input flow
- [ ] Oracle boundary is explicit and coherent as roster-first
- [ ] Claude boundary is explicit and coherent as compatibility/import-first
- [ ] Global gates pass:
  - [ ] `bun run lint`
  - [ ] `bun run check-types`
  - [ ] `bun run build`

---

## Final Checklist <!-- oc:id=sec_as -->
- [ ] All implementation tasks complete
- [ ] Evidence files exist for every task
- [ ] F1-F4 all APPROVE
- [ ] Repo state coherent for shipping next slice