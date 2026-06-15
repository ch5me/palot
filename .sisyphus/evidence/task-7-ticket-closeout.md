## CLOUD000-174 Ticket Closeout Text <!-- oc:id=sec_aa -->

Ready to paste into the ticket.

---

### Palette 3-Pane Finish -- Closeout Summary

**Status: Code complete, browser-mode proved, Electron proof blocked.**

#### What shipped

1. **Doc-lane state contract** -- Document pane openness is now explicit durable UI state (`documentPanelOpen` + `lastDocumentPanelTab`), separate from utility pane state. Disabled/unavailable doc surfaces fall back deterministically.

2. **Metadata-driven lane classification** -- `FireflySurfaceLane` type in `shared/firefly-surface-ids.ts` is the renderer-free authority. Every registry row declares `lane: "utility" | "document"`. Catalog-projected tabs derive lane from host target slot. Adding a future doc surface is one metadata declaration.

3. **Palot Storybook story** -- `palot-three-pane-shell.stories.tsx` mirrors the real nested shell (sidebar + chat + doc pane + utility pane) with `react-reverse-portal` for mount-preserving tab swaps.

4. **Defaults/toggle cleanup** -- Removed duplicate PDF Review toggle from command palette. Fixed the one registry/feature-flag default mismatch (`browser` surface) across 17 surfaces.

5. **Bridge/runtime proof** -- Automated tests prove `open_side_panel("studio")` and `open_side_panel("pdf-review")` route to the document lane through the real Palot bridge path, preserving utility-surface availability.

6. **Final-wave reviewer fixes** -- `PalotUiStateSnapshot` now models both `sidePanel` and `documentPanel` honestly across preload/main/plugin seams; renderer interactions sync that snapshot back to main, and the command-palette utility open affordance is gated by utility-lane availability rather than doc-only availability.

7. **Browser-mode manual proof** -- Live browser session confirmed three-pane composition, utility/doc independence, doc surface switching (`studio` <-> `pdf-review`), unavailable-surface fallback, and session switch restore.

#### Blocker

**Electron dev runtime crashes on load** with `ERR_UNSUPPORTED_ESM_URL_SCHEME` for `bun:` protocol. The renderer never opens, so Electron-mode proof is not possible. This is a pre-existing dev-environment issue, not a regression from this plan. Once the Electron loader issue is fixed, Task 6 Electron proof needs to be re-run.

#### Evidence

- Browser proof: `.sisyphus/evidence/task-6-browser-proof.md` + screenshot
- Electron blocker: `.sisyphus/evidence/task-6-electron-pane.txt` + `.sisyphus/evidence/task-6-electron-proof.md`
- Full closeout: `.sisyphus/evidence/task-7-closeout.md`
- Notepads: `.sisyphus/notepads/cloud000-174-palette-3pane-finish/`

#### Final verification

- `cd apps/desktop && bun test src/main/palot-browser-ipc.test.ts src/main/palot-managed-runtime-verification.test.ts src/renderer/atoms/ui.test.ts` -- pass
- `cd apps/desktop && bun run check-types` -- pass
- `cd apps/desktop && bun run lint` -- pass

#### Working tree

Unrelated experimental diffs were removed from the slice: `apps/desktop/package.json`, `apps/desktop/src/main/palot-runtime/artifact-store.ts`, and `bun.lock`.

#### What is NOT done

- Electron-mode three-pane proof (blocked by `bun:` ESM loader crash)
- Final commit of the working tree changes
