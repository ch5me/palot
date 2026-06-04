# Layout / Drop-Zone Defer <!-- oc:id=sec_aa -->

## Decision <!-- oc:id=sec_ab -->

Do not port `ResizableGrid.tsx` or `PaneDropZone.tsx` yet.

## Why <!-- oc:id=sec_ac -->

Current Elf shell already has enough layout power for the next surfaces:
- `SplitPane` in `sidebar-layout.tsx` handles app-level sidebar vs main workspace
- `ResizablePanes` in `agent-detail.tsx` handles session chat vs side-panel work
- the surface-form policy now constrains new surfaces to side-panel, main-pane, or route-level before generalized docking exists

No current shipped or next-up Wave 2 surface requires drag-reorderable multi-pane docking to prove value.

## Reopen condition <!-- oc:id=sec_ad -->

Reopen this only when a concrete surface cannot be expressed as:
- side-panel tab
- single main-pane workspace inside a session
- dedicated route-level workspace

Likely triggers later:
- Terminal + Editor need simultaneous dockable peers with independent visibility/order
- Files becomes a multi-region workspace with persistent browser + preview + diff panes

## Implication <!-- oc:id=sec_ae -->

Treat the layout/drop-zone item as explicitly deferred, not missing due to oversight.
The next profitable move is Files, not generalized docking infrastructure.