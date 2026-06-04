# Terminal Audit <!-- oc:id=sec_aa -->

## Current repo state <!-- oc:id=sec_ab -->

- No `node-pty` dependency in `apps/desktop/package.json`.
- No `@xterm/xterm` dependency in `apps/desktop/package.json`.
- The repo already has a presentational terminal component in `packages/ui/src/components/ai-elements/terminal.tsx` for static/streamed ANSI output.
- Existing renderer/main seams already support Electron IPC additions through `ipc-handlers.ts`, `preload/index.ts`, `preload/api.d.ts`, and `renderer/services/backend.ts`.
- Existing shell policy says terminal should likely become a `main-pane` design target later, but a thinner proof shell can land first.

## Immediate conclusion <!-- oc:id=sec_ac -->

The first terminal slice should be a proof shell, not full PTY integration yet.

Reason:
- PTY requires new native dependencies and main-process orchestration.
- No xterm or pty substrate exists yet.
- The current backlog benefits from proving shell placement and session/worktree semantics first.

## Proposed first slice <!-- oc:id=sec_ad -->

- Add a `terminal` Firefly surface as a side-panel proof shell or lightweight main-pane placeholder.
- Reuse the existing UI terminal component for command history / attach command / shell context presentation.
- Show project directory, worktree directory when present, and the `opencode attach` command as the first useful behavior.
- Defer PTY runtime until after the shell proves useful.

## PTY blocker notes <!-- oc:id=sec_ae -->

Full PTY work will need:
- dependency choice (`node-pty`, likely plus `@xterm/xterm` if a real terminal emulator is desired)
- main-process lifecycle and IPC stream protocol
- resize handling
- session model decision: project vs worktree vs agent-session bound