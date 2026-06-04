# Claude UI Slice Notes <!-- oc:id=sec_aa -->

## Current findings <!-- oc:id=sec_ab -->
- Task 9 completed.
- Current `claude-panel.tsx` is still a migration/detection surface with no live runtime affordances.
- `terminal-panel.tsx` already proves the basic PTY stream shell: title/header, streaming terminal body, attach command helper, and text input.
- `oracle-panel.tsx` already proves attach/create/list/error/empty/admin states for tmux-backed sessions.
- Locked UI direction:
  - Claude keeps the same tab id
  - live lane is Claude Code TUI over tmux/PTY
  - migration/import tools survive as secondary UX, not the primary body
  - failure states explicitly include missing CLI, unauthenticated CLI, busy session, crashed session, and attach timeout
  - ship as a Claude-first product surface, not a generic terminal with a renamed heading

## Open questions <!-- oc:id=sec_ac -->
- Should the primary Claude body use a fully branded Claude-first shell around the PTY, or a lighter wrapper around the existing Terminal component with stronger state framing?
- Does v1 need explicit session switching in-panel, or is create/reattach to the one canonical session enough until later?
