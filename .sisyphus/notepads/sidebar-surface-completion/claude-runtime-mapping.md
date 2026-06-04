# Claude Runtime Mapping Notes <!-- oc:id=sec_aa -->

## Current findings <!-- oc:id=sec_ab -->
- Task 3 completed.
- AIOS has two distinct Claude products:
  - live Claude Code TUI lane: `src/components/TerminalPane.tsx` + `src/components/TerminalComposer.tsx`
  - headless structured lane: `src/components/ChatPane.tsx` + `src/lib/chat.ts`
- Palot current Claude surface is compat/import only.
- Palot already has reusable PTY/tmux seams in `apps/desktop/src/main/pty.ts`, `apps/desktop/src/main/oracles.ts`, `apps/desktop/src/main/ipc-handlers.ts`, `apps/desktop/src/preload/index.ts`, and `apps/desktop/src/renderer/services/backend.ts`.
- Best phase-1 mapping is Claude Code TUI over tmux/PTY, keeping the `claude` tab id and demoting migration tools into a secondary section.
- Concrete seam bug found for later backend planning: `apps/desktop/src/main/ipc-handlers.ts` re-registers `pty:spawn-oracle` and `pty:spawn-tmux` with stub handlers later in the file, shadowing the real attach handlers.

## Open questions <!-- oc:id=sec_ac -->
- How should Palot preflight Claude CLI/auth status in phase 1: dedicated backend probe vs attach failure parsing?
- Should the Claude surface be a thin wrapper around the existing Terminal panel or a distinct surface sharing the PTY internals only?
