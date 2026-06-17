## Task 7: Final Cleanup and Ticket Closeout <!-- oc:id=sec_aa -->

- Date: 2026-06-14
- Plan: `.sisyphus/plans/cloud000-174-palette-3pane-finish.md`
- Notepads: `.sisyphus/notepads/cloud000-174-palette-3pane-finish/`

---

### What shipped (Tasks 1-6, all in working tree, uncommitted)

**Task 1 -- Doc-lane state contract.**
Doc lane is now explicit durable UI state, not derived from the shared `sidePanelActiveTab`.
`documentPanelOpenAtom` + `lastDocumentPanelTabAtom` in `apps/desktop/src/renderer/atoms/ui.ts` persist separately from utility pane state. Unavailable remembered doc tab falls back to the first available doc surface; if none remain, the doc lane closes explicitly.
Files: `atoms/ui.ts`, `atoms/preferences.ts`, `components/agent-detail.tsx`, `components/side-panel/session-side-panel.tsx`.

**Task 2 -- Metadata-driven lane classification.**
`FireflySurfaceLane` type (`"utility" | "document"`) lives in `apps/desktop/src/shared/firefly-surface-ids.ts` as the renderer-free authority. Every registry row in `firefly-surface-registry.tsx` carries an explicit `lane` field. Catalog-projected tabs derive lane from `hostTarget.slot` (`main-pane` => document, `side-panel` => utility). Adding a future doc surface requires one metadata declaration, not a new routing helper.
Files: `shared/firefly-surface-ids.ts`, `firefly-surface-registry.tsx`, `firefly-plugin-surfaces.tsx`, `firefly-plugin-surface-merge.ts`.

**Task 3 -- Palot Storybook proof story.**
`packages/ui/src/stories/ai-elements/palot-three-pane-shell.stories.tsx` (17.2K) mirrors the real `agent-detail` shell: left sidebar, center chat, inner doc pane, outer utility pane. Uses `react-reverse-portal` to prove doc surfaces stay mounted across tab swaps. Toggles for `studio`, `pdf-review`, and utility surfaces. Intentionally uses mock doc content (not live runtime coupling). The proof target is nested pane composition and portal-backed switching.

**Task 4 -- Defaults and toggle cleanup.**
Removed duplicate PDF Review toggle from command palette (`command-palette.tsx`, -11 lines). Aligned `browser` surface registry `defaultOn` from `false` to `true` to match `fireflySurfaceDefaults.browserPanelEnabled: true`. One mismatch found and fixed across 17 registry surfaces.

**Task 5 -- Bridge/runtime proof for doc surfaces.**
Automated tests in `palot-browser-ipc.test.ts` and `palot-managed-runtime-verification.test.ts` prove `open_side_panel` accepts `studio` and `pdf-review`, rebroadcasts those exact ids, and preserves separate utility/doc lane inventories. The shared preload/main/plugin snapshot contract now exposes both `sidePanel` and `documentPanel`, so runtime proof no longer has to infer doc state indirectly from mixed `availableTabs`.

**Task 6 -- Browser and Electron manual proof.**
Browser-mode proof succeeded. Evidence: `.sisyphus/evidence/task-6-browser-proof.md` + `.sisyphus/evidence/task-6-browser-proof.png`. Proved three-pane composition, utility/doc independence, doc surface switching (`studio` -> `pdf-review`), unavailable-surface fallback (`pdf-review` disabled -> falls back to `studio`), and session switch restore.
Electron-mode proof blocked. Evidence: `.sisyphus/evidence/task-6-electron-proof.md` + `.sisyphus/evidence/task-6-electron-pane.txt`. Electron dev runtime crashes during app load with `ERR_UNSUPPORTED_ESM_URL_SCHEME` for `bun:` protocol before a usable window appears.

---

### Evidence verification <!-- oc:id=sec_ab -->

All referenced evidence files confirmed present:

| File | Size | Status |
|------|------|--------|
| `.sisyphus/evidence/task-6-browser-proof.md` | 4.6K | exists |
| `.sisyphus/evidence/task-6-browser-proof.png` | 1.0M | exists |
| `.sisyphus/evidence/task-6-electron-proof.md` | 1.8K | exists |
| `.sisyphus/evidence/task-6-electron-pane.txt` | 895B | exists |
| `.sisyphus/notepads/cloud000-174-palette-3pane-finish/learnings.md` | present | 18 entries |
| `.sisyphus/notepads/cloud000-174-palette-3pane-finish/decisions.md` | present | 15 entries |
| `.sisyphus/notepads/cloud000-174-palette-3pane-finish/issues.md` | present | 10 entries |

Implementation files in working tree for Tasks 1-6 plus final-wave repair:
- `apps/desktop/src/shared/firefly-surface-ids.ts` -- lane type + authority map
- `apps/desktop/src/renderer/firefly-surface-registry.tsx` -- lane field on all rows
- `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx` -- catalog lane projection
- `apps/desktop/src/renderer/firefly-plugin-surface-merge.ts` -- merge lane support
- `apps/desktop/src/renderer/atoms/ui.ts` -- explicit doc-lane state atoms
- `apps/desktop/src/renderer/atoms/preferences.ts` -- doc-lane preference persistence
- `apps/desktop/src/renderer/components/agent-detail.tsx` -- doc/utility lane routing
- `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx` -- restore alignment
- `apps/desktop/src/renderer/components/command-palette.tsx` -- duplicate toggle removed
- `apps/desktop/src/main/palot-browser-ipc.ts` -- honest dual-lane snapshot contract in main
- `apps/desktop/src/main/ipc-handlers.ts` -- renderer-to-main snapshot sync IPC
- `apps/desktop/src/main/palot-plugin/plugin.js` -- `ui_state` / `open_side_panel` dual-lane output
- `apps/desktop/src/main/palot-browser-ipc.test.ts` -- bridge doc-surface tests
- `apps/desktop/src/main/palot-managed-runtime-verification.test.ts` -- runtime doc-surface tests
- `apps/desktop/src/preload/api.d.ts` -- dual-lane snapshot typing
- `apps/desktop/src/preload/index.ts` -- snapshot setter bridge
- `apps/desktop/src/renderer/services/backend.ts` -- renderer sync helper
- `apps/desktop/src/renderer/__tests__/surface-mirror-lists.test.ts` -- lane metadata tests
- `apps/desktop/src/renderer/firefly-plugin-surface-merge.test.ts` -- merge lane tests
- `apps/desktop/src/renderer/atoms/ui.test.ts` -- doc-lane atom tests (new file)

Storybook story (new file):
- `packages/ui/src/stories/ai-elements/palot-three-pane-shell.stories.tsx` (17.2K)

Removed from this ticket slice as unrelated experimental churn:
- `apps/desktop/package.json`
- `apps/desktop/src/main/palot-runtime/artifact-store.ts`
- `bun.lock`

---

### Remaining blocker

**Electron dev runtime crash: `ERR_UNSUPPORTED_ESM_URL_SCHEME` on `bun:` protocol.**

The Electron main process crashes during app load because Node's default ESM loader rejects `bun:` import URLs. This is a pre-existing dev-environment issue, not a regression from this plan's changes. The renderer never opens, so no Electron-mode user-facing proof is possible.

Exact error (from `.sisyphus/evidence/task-6-electron-pane.txt`):
```
Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file, data, node,
and electron are supported by the default ESM loader. Received protocol 'bun:'
```

This blocker is independent of the 3-pane finish work. Once the Electron dev loader issue is resolved, Task 6 Electron proof should be re-run to complete two-runtime coverage.

---

### Honest scope statement <!-- oc:id=sec_ac -->

- Browser-mode three-pane behavior is proved end-to-end (automated tests + manual browser evidence).
- Electron-mode three-pane behavior is NOT proved because the Electron dev runtime never reached a usable window.
- Storybook proof uses mock content; it proves nested pane composition, not live runtime coupling.
- All code changes are in the working tree and have not been committed yet.
- Final desktop verification now re-run on current tree state:
  - `cd apps/desktop && bun test src/main/palot-browser-ipc.test.ts src/main/palot-managed-runtime-verification.test.ts src/renderer/atoms/ui.test.ts` -- pass
  - `cd apps/desktop && bun run check-types` -- pass
  - `cd apps/desktop && bun run lint` -- pass
