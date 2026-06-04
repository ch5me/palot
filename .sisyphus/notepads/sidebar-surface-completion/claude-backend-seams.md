# Claude Backend Seam Notes <!-- oc:id=sec_aa -->

## Current findings <!-- oc:id=sec_ab -->
- Task 6 completed.
- Current PTY stack already supports shell, persistent terminal, oracle attach, tmux attach, write, resize, and kill.
- Canonical owner stays: tmux session + attached PTY stream.
- Concrete backend bug confirmed: `apps/desktop/src/main/ipc-handlers.ts` re-registers `pty:spawn-oracle` and `pty:spawn-tmux` later in the file with stub `{ ok, args }` handlers, shadowing the real PTY attach handlers.
- Preload and API typings still promise numeric PTY ids for `spawnOracle` and `spawnTmux`, so the duplicate stub handlers are a correctness bug, not just dead code.
- Best seam plan: keep PTY/tmux transport generic, add only a thin Claude preflight and create/reattach helper.

## Open questions <!-- oc:id=sec_ac -->
- Should Claude preflight get its own explicit IPC endpoint, or should phase 1 compose existing checks from renderer + attach failure parsing?
- Should the Claude surface create dedicated `pty:spawn-claude` / `claude:*` channels, or wrap `spawnPtyTerminal` plus a few focused helper endpoints?
