# Firefly Desktop Merge Workplan <!-- oc:id=sec_aa -->

## Status <!-- oc:id=sec_ab -->

This document replaces stale continuation state that pointed at completed-or-misaligned plans.

Two older plan threads existed:
- The retired superapp plan `elf-supra-remaining-merge-plan.md` tracked Elf work from the wrong repo and is no longer a continuation source.
- `elf/.sisyphus/plans/firefly-design-standardization-across-products.md` completed the migration architecture/token work, but its remaining unchecked items are closure/publish tasks, not more product implementation.

Current truth:
- Elf is the only execution repo for Firefly desktop merge work.
- Firefly shell infrastructure is in place.
- Browser, notes, pulse, and memory are registered surfaces, but browser is placeholder-only and the other three are still proof shells.
- Firefly design standardization is implementation-done but closure-incomplete.

## Canonical Remaining Work <!-- oc:id=sec_ac -->

### A. Closure lane — finish design-standardization honestly <!-- oc:id=sec_ad -->

- [ ] Shared package API review
  - [ ] Review `@ch5me/firefly-design` exports for token TS, CSS vars, Tailwind bridge, status copy, and typography/radius/spacing contract.
  - [ ] Review `@ch5me/firefly-ui-web` exports for generic-only primitives.
  - [ ] Audit package names and public import stability.
  - [ ] Confirm package docs explain CSS import, token import, and web primitive import.
- [ ] Shared package hardening proof
  - [ ] Add or confirm durable regression proof against TS/CSS token drift.
  - [ ] Reconcile package repo state so the shared-package repo can be claimed clean after any closure fixes.
- [ ] Firefly Cloud closure pass
  - [ ] Run targeted install/typecheck proof and record non-migration blockers separately.
  - [ ] Confirm deleted local token/web files are not referenced anywhere.
  - [ ] Run root dependency-resolution proof.
  - [ ] Run affected lint/type/build gates for web, storybook, runtime, and any impacted mobile lane.
  - [ ] Confirm push gate passes cleanly or document exact external blocker.
- [ ] Firefly Cloud docs cleanup
  - [ ] Remove stale `@ch5me/firefly-ui` wording in `apps/firefly/README.md`, `docs/firefly-app-boundary.md`, and `brand.md`.
  - [ ] Document dev resolution policy for workspace link vs published package vs any remaining symlink lane.
- [ ] Published-package parity
  - [ ] Publish `@ch5me/firefly-design` and `@ch5me/firefly-ui-web` through the real semver flow.
  - [ ] Re-verify one consumer path against published versions instead of workspace/local-link-only proof.
- [ ] Repo-state reconciliation
  - [ ] Classify dirty state across `ch5-packages`, `firefly-cloud`, `elf`, `folio-db`, and `open-pencil`.
  - [ ] Separate unrelated concurrent changes from standardization closure work.
  - [ ] Only claim closure once clean/pushed state is either real or explicitly waived.

### B. Product lane — finish Elf Firefly merge <!-- oc:id=sec_ae -->

- [ ] Shell correctness and command behavior
  - [ ] Wire surface `commandIds` to actual open/focus behavior.
  - [ ] Make command-palette surface actions open/focus the selected surface instead of only closing the palette.
  - [ ] Fix restore/fallback behavior when the previously active surface is disabled.
  - [ ] Align default-on/default-off flags with actual surface maturity.
- [ ] Notes surface
  - [ ] Replace local `useState` notes storage with `use-draft`-backed persistence.
  - [ ] Add autosave + restore behavior.
  - [ ] Add note lifecycle behavior: create/edit/clear plus session attachment rules.
  - [ ] Add send-to-AI or inject-into-chat flow.
  - [ ] Decide session-scoped vs project-scoped persistence.
- [ ] Pulse surface
  - [ ] Reuse real session metrics instead of static cards.
  - [ ] Show branch/worktree/session heartbeat and token/cost/time summaries.
  - [ ] Add automation/runtime status where current backend seams already exist.
  - [ ] Add empty/populated/error states.
- [ ] Memory surface
  - [ ] Choose first backend contract: hosted, local, project-scoped, or hybrid.
  - [ ] Add backend/preload/service seam for read/search/list operations.
  - [ ] Ship a useful first real view — list/search before graph.
  - [ ] Add loading/error/empty states.
  - [ ] Decide whether write/pin/forget is v1 or later.
- [ ] Browser surface
  - [ ] Replace placeholder panel with real browser/native seam.
  - [ ] Define navigation model, URL state, and open/focus behavior.
  - [ ] Decide session/profile persistence and failure states.
  - [ ] Add browser-to-agent workflows only after core browsing works.
- [ ] Bigger daily-driver surfaces
  - [ ] Terminal surface contract and integration.
  - [ ] Files/review consolidation into a first-class workflow.
  - [ ] Decide which additional domains deserve route-level surfaces vs side-panel tabs.
- [ ] Product seams
  - [ ] Auth seam.
  - [ ] Telemetry seam.
  - [ ] Billing / attribution seam.
  - [ ] `firefly-cloud` shared chat/UI seam.
  - [ ] Deep-link / route strategy.
- [ ] Scope decisions for missing domains
  - [ ] Skills/plugins surface: ship now, flag, or defer.
  - [ ] Voice: explicit defer or first thin slice.
  - [ ] CRM/bridges/motion/database: explicitly defer, drop, or re-plan.
- [ ] Local green proof
  - [ ] Fix the local desktop boot blocker (`electron-vite: command not found`) so `cd apps/desktop && bun run dev` is a real proof lane again.
  - [ ] Re-run lint and typecheck.
  - [ ] Run desktop/browser-mode proof for changed surfaces.
  - [ ] Verify feature-flag on/off behavior and restore behavior.
  - [ ] Verify shell opens without fatal errors.

## Evidence Behind This Checklist <!-- oc:id=sec_af -->

- Shell/proof-surface reality: `docs/firefly-supra-conversion-audit.md`
- Surface authoring rules: `.agents/skills/firefly-plugins/SKILL.md`
- Standardization closure mismatch: `.sisyphus/notepads/firefly-design-standardization-across-products/problems.md`
- Notes/pulse/memory/browser audits: `.sisyphus/evidence/firefly-scope-classification-matrix.md`
- Desktop boot blocker: `.sisyphus/evidence/elf-package-build-hygiene-audit.md`

## Retired Artifacts <!-- oc:id=sec_ag -->

These should no longer drive continuation:
- the retired superapp plan `elf-supra-remaining-merge-plan.md`
- the retired superapp boulder artifact `boulder.json2`
- `elf/.sisyphus/boulder.json` pointing at the standardization plan
- `elf/.sisyphus/plans/firefly-design-standardization-across-products.md` as an implementation continuation source

## Immediate Next Actions <!-- oc:id=sec_ah -->

1. Finish closure-lane decision: do we want published-semver parity now, or explicitly waive it for this phase? <!-- oc:id=item_aa -->
1. Fix local desktop boot proof so product-lane work can be verified honestly. <!-- oc:id=item_ab -->
1. Start with Notes, Browser, Pulse, Memory in that order unless the boot fix reveals a more urgent shell/runtime blocker. <!-- oc:id=item_ac -->
