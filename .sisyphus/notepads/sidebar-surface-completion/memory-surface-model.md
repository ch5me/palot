# Memory Surface Model Notes <!-- oc:id=sec_aa -->

## Current findings <!-- oc:id=sec_ab -->
- Task 4 completed.
- Current `memory-panel.tsx` is a list/pin/search surface, not a file-tree/editor lane.
- Existing reuse candidates are strong:
  - `files-panel.tsx` already has tree + selected-node preview states.
  - `editor-panel.tsx` already has Monaco load/edit/save behavior and dirty/saved indicators.
- Current canonical stores:
  - local pinned facts in `pinnedFactsAtom`
  - remote/hybrid memory records through `memory-service.ts`
- Current `MemoryItem` shape is record-oriented (`id`, `body`, `memoryClass`, `topicKey`, timestamps, source) with no document/path abstraction yet.
- Chosen v1 abstraction: one synthetic markdown doc per canonical memory record, with stable path scheme `memory/<scope>/<topic>.md`.
- Save/load stays service-owned; dirty state stays renderer-owned.

## Open questions <!-- oc:id=sec_ac -->
- How should topic slug renames remap selected/open doc state during save in task 10?
- Should the v1 editor expose metadata header text as editable markdown or keep metadata outside the editable body entirely?
