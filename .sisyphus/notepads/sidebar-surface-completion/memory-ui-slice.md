# Memory UI Slice Notes <!-- oc:id=sec_aa -->

## Current findings <!-- oc:id=sec_ab -->
- Task 10 completed.
- Current `memory-panel.tsx` is still a flat list/pin/search UX; no tree, no editor, no open/save affordances.
- `files-panel.tsx` provides the exact left/right split shell to copy: tree rail on the left, selected-item pane on the right, with explicit empty/loading/error states.
- `editor-panel.tsx` provides the exact right-pane editor shell to copy: Monaco host, dirty/saved indicators, `Cmd/Ctrl+S`, loading overlay, and error overlay.
- Locked UI decisions:
  - canonical synthetic path scheme `memory/<scope>/<topic>.md`
  - one synthetic markdown doc per canonical memory record in v1
  - single-doc editing is acceptable in v1
  - stale-change check keys off `updatedAt`
  - topic rename should read as rename-in-place after successful save

## Open questions <!-- oc:id=sec_ac -->
- Should the memory doc header metadata be read-only chrome above the editor, or rendered into the markdown body with a protected/generated section?
- Should last-selected synthetic path restore automatically on reopen in v1, or wait until rollout/verification work defines the final restore contract?
