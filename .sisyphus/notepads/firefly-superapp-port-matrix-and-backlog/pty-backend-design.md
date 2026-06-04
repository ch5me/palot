# PTY / Backend Slice Design <!-- oc:id=sec_aa -->

## Decision <!-- oc:id=sec_ab -->

Use `node-pty` for the PTY host, but do not add it yet in this slice.

## Why this choice <!-- oc:id=sec_ac -->

- It is the standard Node/Electron PTY substrate.
- It fits Elf's Electron main-process architecture better than inventing a custom shell-stream layer.
- It supports the worktree-first cwd policy already decided.

## Minimal protocol when implementation starts <!-- oc:id=sec_ad -->

### Main process <!-- oc:id=sec_ae -->

Add a terminal session manager in main process with methods to:
- create terminal session with `{ sessionId, cwd }`
- write input to session
- resize session
- close session
- subscribe to output chunks and lifecycle status

### Preload bridge <!-- oc:id=sec_af -->

Expose a `terminal` namespace with methods like:
- `createSession(sessionId, cwd)`
- `write(sessionToken, data)`
- `resize(sessionToken, cols, rows)`
- `close(sessionToken)`
- `onOutput(sessionToken, callback)`
- `onExit(sessionToken, callback)`

### Renderer seam <!-- oc:id=sec_ag -->

Renderer should first consume a minimal backend service wrapper, not call preload directly.

Suggested service shape:
- `createTerminalSession(sessionId, cwd)`
- `writeTerminalInput(token, data)`
- `resizeTerminal(token, cols, rows)`
- `closeTerminalSession(token)`
- output subscription helper

## Scope cut for the first real PTY lane <!-- oc:id=sec_ah -->

The first real PTY implementation should stop at:
- one live terminal session per visible Terminal surface
- cwd bound to `worktreePath` first, else `directory`
- stdin write
- stdout/stderr streaming
- close on unmount

Explicitly defer:
- multiple tabs inside the terminal surface
- persistent scrollback restore
- shell history integration
- xterm-grade terminal emulation if plain ANSI rendering is still sufficient for proof

## Frontend note <!-- oc:id=sec_ai -->

Because the repo already has a presentational ANSI terminal component, the next profitable intermediate step is likely:
- PTY backend first
- reuse existing terminal UI to render streamed output
- only add `@xterm/xterm` later if interactive fidelity becomes the blocker