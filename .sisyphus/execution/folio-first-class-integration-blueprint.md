# Folio First-Class Integration Blueprint <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->
Build Folio as a real first-class built-in plugin inside Palot.

End state:
- Folio nav lives in a host-owned `nav-sidebar` shell with `DiscreteTabs`
- Folio pages render as first-class Palot `page` surfaces
- Folio admin/settings live in host settings surfaces
- Folio actions register into Palot command infrastructure
- Auth, tRPC, cache, and sync bridges are explicit and fail loud
- No permanent Folio-only special-case runtime path outside normal plugin/catalog authority

---

## Execution Lanes (Ticket-Ready)

### Lane 1: Nav-Sidebar Foundation (IN-FLIGHT)
**Ticket**: `CLOUD000-125` (Executing on mini worker)
**Status**: Started ~30m ago from plan commit `af8d872d`.
**Scope**: 
- Host-owned left nav shell with `DiscreteTabs`
- Dynamic `nav-sidebar` state (separate from side-panel)
- Built-in tab one + duplicate tab two proving shared outlet switching
- No layout collapse, no route-owned fallback
**Action**: Do not parallelize or duplicate this work. Await completion evidence from `CLOUD000-125` before wiring actual Folio tree data.

### Lane 2: Schema & Projection Expansion
**Target Ticket**: To be created (Phase 2)
**Goal**: Teach Palot plugin runtime about first-class host surfaces.
**Files**:
- `apps/desktop/src/shared/firefly-plugin/manifest.ts`
- `apps/desktop/src/shared/firefly-plugin/family-contracts.ts`
- `apps/desktop/src/shared/firefly-plugin/descriptor.ts`
- `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts`
- `apps/desktop/src/main/firefly-plugin/catalog.ts`
- `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts`
**Work**:
- Add unified `surface` family with discriminated `kind` (`nav-sidebar`, `page`, `settings-section`, `side-panel`, `command`)
- Add projection types and catalog summaries for new kinds
- Add collision handling for duplicate surface ids
- Ensure fail-loud behavior for invalid projections
**Definition of Done**: Manifest -> descriptor -> catalog -> renderer path exists for new surface kinds without overloading current `panels` semantics.

### Lane 3: Route, Auth & Data Bridges
**Target Ticket**: To be created (Phase 3)
**Goal**: Make Folio runtime work inside Palot without ambiguity.
**Files**:
- `apps/desktop/src/main/firefly-plugin/catalog.ts`
- `apps/desktop/src/plugins/folio/bridges/` (new)
- `apps/desktop/src/renderer/atoms/ui.ts`
**Folio Source Refs**:
- `../folio-db/apps/web/src/documents/route.ts`
- `../folio-db/packages/client/src/index.ts`
- `../folio-db/packages/sync/src/index.ts`
- `../folio-db/apps/web/src/documents/local-cache.ts`
**Work**:
- Host intercepts Folio `?route=` identity; plugin does not own outer routing
- Host provides shared Folio client context (single instance via React Context) to prevent duplicate network connections
- Auth bridge: explicit bridge-period Better Auth cookie support with future Firefly auth handoff path
- Offline/cache/sync lifecycle tied to mounted Folio page surfaces
- Explicit runtime failure matrix (missing auth, missing workspace, API unavailable, cache unavailable, sync failure, quarantined plugin, unsupported route)
**Definition of Done**: Every bridge has one owner, every failure has visible host UX, no silent fallback behavior.

### Lane 4: First-Class Surface Wiring
**Target Ticket**: To be created (Phase 4)
**Goal**: Wire actual Folio UI families into Palot host surfaces.
**Files**:
- `apps/desktop/src/plugins/folio/surfaces/` (new)
- `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx`
- `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts`
**Folio Source Refs**: Sidebar, WorkspaceHome, BaseDocumentPage, DatabasePage, OrgAdminPanel, SearchPanel, ActionsOverlayPanel, ShareOverlayPanel
**Work**:
- Mount Folio sidebar content as `nav-sidebar` tab body (consumes Lane 1 completion)
- Mount Folio page surfaces (`WorkspaceHome`, `BaseDocumentPage`, `DatabasePage`) into Palot `page` container
- Sync page title/breadcrumb context upward to host app bar
- Register Folio commands (`create-page`, `create-database`, `apply-template`) in host command palette
- Expose `OrgAdminPanel` via `settings-section`
- Map contextual overlays (row preview, backlinks) to `side-panel` or host-native dialogs
**Definition of Done**: A user can open Palot and use Folio core flows without leaving host chrome.

### Lane 5: Bundled Plugin Packaging & Hardening
**Target Ticket**: To be created (Phase 5)
**Goal**: Package Folio as a normal first-party built-in plugin with full telemetry and crash isolation.
**Files**:
- `apps/desktop/src/plugins/folio/manifest.ts`
- `apps/desktop/src/plugins/folio/index.ts`
- `apps/desktop/src/renderer/components/plugin-surface-boundary.tsx` (new, if not existing)
**Work**:
- Create bundled Folio plugin structure under `apps/desktop/src/plugins/folio/`
- Wrap all Folio surfaces in `PluginSurfaceBoundary` (error boundary) for crash isolation
- Implement quarantine logic for repeated runtime failures
- Add telemetry namespace (`firefly.surface.folio.*`) for opens, switches, crashes, restores
- Ensure changesets are added for any user-facing changes to the bundled plugin
**Definition of Done**: Folio loads through normal built-in plugin authority path with no bespoke runtime bypass.

---

## Contracts To Implement <!-- oc:id=sec_ac -->

### `nav-sidebar` <!-- oc:id=sec_ad -->
- **Host owns**: shell, header, collapse state, persistence, ordering resolution
- **Plugin owns**: body content only
- **Required fields**: `id`, `title`, `icon`, `orderHint`, `defaultState`, `persistenceKey`, `renderMode`, `capabilityGates`

### `page` <!-- oc:id=sec_ae -->
- **Host owns**: outer routing, app bar, breadcrumbs, top-level error boundary
- **Plugin owns**: inner content, local editor/view state, autosave/status details
- **Required fields**: `id`, `title`, `routeIdentityPattern`, `icon`, `breadcrumbs`, `persistence`

### `settings-section` <!-- oc:id=sec_af -->
- **Host owns**: settings shell, section nav, visibility gating, search
- **Plugin owns**: section body
- **Required fields**: `id`, `title`, `category`, `orderHint`, `visibility`

### `command` <!-- oc:id=sec_ag -->
- **Host owns**: palette, keybindings, `when` evaluation
- **Plugin owns**: command metadata, target route/action payload
- **Required fields**: `id`, `title`, `category`, `icon`, `when`, `action`

---

## Verification Plan

### Unit / Contract
- [ ] Manifest parsing for new surface kinds
- [ ] Descriptor derivation and projection logic
- [ ] Collision handling behavior
- [ ] Catalog summaries inclusion
- [ ] Fail-loud invalid config paths

### Local Runtime
- [ ] Nav-sidebar shell renders with `DiscreteTabs` (Lane 1 evidence)
- [ ] Built-in tab one and duplicate tab two switch through same outlet (Lane 1 evidence)
- [ ] Folio workspace tree mounts in nav-sidebar (Lane 4)
- [ ] Opening a document mounts a page surface (Lane 4)
- [ ] Opening a database mounts page surface table view (Lane 4)
- [ ] Command palette exposes Folio create/open actions (Lane 4)
- [ ] Org admin mounts in settings section (Lane 4)
- [ ] Disabled/quarantined surface behavior is visible and deterministic (Lane 5)

### Evidence Convention
- `.sisyphus/evidence/task-{N}-{slug}.{ext}`

### Must Prove
- Full first-class citizenship
- Not just manifest parsing
- Not just one sidebar demo

---

## Non-Negotiables <!-- oc:id=sec_ah -->

- No silent fallback behavior
- No permanent Folio-only special case path
- No reuse of static side-panel tab enum for nav-sidebar
- Host owns chrome, routing, persistence, visibility gating
- Plugin owns content and local domain logic
- Build for future bundled apps, not just Folio