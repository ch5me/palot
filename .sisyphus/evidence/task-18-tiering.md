# Task 18: MVP vs Full Integration Tiering <!-- oc:id=sec_aa -->

## Tiering Strategy <!-- oc:id=sec_ab -->
To prevent "all-at-once" implementation paralysis, Folio surfaces are split into three explicit execution tiers:

### Phase 1: Proof / Narrow Slice (Current Work) <!-- oc:id=sec_ac -->
**Scope**: `nav-sidebar` host shell + `DiscreteTabs` + built-in tab switching + 1-2 plugin-tab proof-of-concepts.
**Goal**: Validate the new manifest family, projection pipeline, and host-owned shell contract without touching complex routing or auth.
**Why**: Unblocks the foundational surface architecture with minimal risk.

### Phase 2: MVP First-Class Integration <!-- oc:id=sec_ad -->
**Scope**: 
- `page` surface contract (Document + Database basic views).
- `command` contract (Create page, open database from palette).
- `nav-sidebar` populated with actual Folio tree data (via injected client or bridge tool).
- Basic auth/session bridge (fail-loud if missing).
**Goal**: A user can open Palot, see their Folio workspace in the nav-sidebar, click a document, and edit it in a Palot page.
**Why**: Delivers the core "Folio feels native" value proposition without needing every edge case.

### Phase 3: Full Parity / Later <!-- oc:id=sec_ae -->
**Scope**:
- `settings-section` (Org admin, member management).
- Advanced `page` features (Sheet presence, complex database views like calendar/timeline).
- `side-panel` contextual surfaces (row inspectors, backlinks).
- Advanced `data-bridge` (local-first offline sync resilience, conflict resolution surfacing).
**Goal**: 1:1 feature parity with standalone Folio web app, fully hosted inside Palot.
**Why**: These require deep runtime integration and are lower priority than core navigation + document editing.

## Tiering Validation <!-- oc:id=sec_af -->
- No surface family is relegated to "maybe later" without explicit rationale (e.g., complex views are Phase 3 because they depend on Phase 2 page contract).
- Phase 1 remains strictly narrower than MVP, preventing scope creep during the nav-sidebar proof.

## Acceptance Check <!-- oc:id=sec_ag -->
- [x] Each Folio surface family has explicit tier assignment and rationale.
- [x] Bounded rollout tiers with no hidden all-at-once scope.