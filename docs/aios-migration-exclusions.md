# AIOS Superapp -> Palot Migration Exclusions <!-- oc:id=sec_aa -->

## Purpose <!-- oc:id=sec_ab -->

Record the surfaces, modules, and assumptions from `~/Workspaces/aios-superapp`
that were intentionally NOT ported into Palot. Anything listed here is
explicitly out of scope for the migration and is the reason the
superapp repo can be retired.

## Excluded Surfaces <!-- oc:id=sec_ac -->

The following superapp surfaces have no Palot equivalent and are
**not** in the migration plan. They were dropped because Palot's
existing surfaces (chat + side-panel + new-chat sidebar) cover the
same product surface in a more compact, single-runtime form.

| Superapp source                                                       | Palot replacement                                    | Why dropped                                         |
|----------------------------------------------------------------------|------------------------------------------------------|----------------------------------------------------|
| `src/components/MotionPane.tsx`                                      | n/a                                                  | Motion is out of scope; palot has its own React+UI  |
| `src-tauri/src/motion.rs`                                            | n/a                                                  | No motion backend; not part of OpenCode's lane    |
| `src/lib/motion.ts`                                                  | n/a                                                  | Same as above                                       |
| `src/components/DatabasePane.tsx` + `src-tauri/src/db.rs` + `lib/db.ts` | n/a (chat-history is rendered by Review/ChatView)   | Drizzle migrations live in Palot; superapp DB module was a separate store |
| `src/components/IdleDashboard.tsx`                                   | n/a (replaced by `agentsAtom` + new-chat sidebar)   | Palot's sidebar lists live agents directly          |
| `src/components/SidebarUsage.tsx`                                   | n/a (replaced by `pulse-panel.tsx`)                 | Pulse subsumes usage display as a side-panel tab   |
| `src/components/MonitorDashboard*` + `src-tauri/src/monitor.rs`    | n/a                                                  | OpenCode metrics are surfaced via `session-metrics.ts` and the Pulse panel |
| `src/components/DeviceTile*` + `src-tauri/src/device.rs`            | n/a                                                  | Tauri device probes; no equivalent in Electron      |

## Excluded Assumptions <!-- oc:id=sec_ad -->

The superapp was Tauri v2 (Rust). Palot is Electron 40 (Node main).
The following superapp assumptions do **not** apply to Palot:

- `tauri::Window`, `tauri::WebviewWindow` -- Palot uses
  `BrowserWindow` / `webContents`.
- `tauri::Manager`, `tauri::State` -- Palot uses Electron's
  `app`/`ipcMain` directly.
- `tauri::api::path::home_dir()` -- Palot uses `app.getPath("userData")`
  with a `process.env.PALOT_DATA_DIR` override for tests.
- `tauri-plugin-shell` and `tauri-plugin-dialog` -- Palot uses
  `child_process` / `dialog` from the Electron `electron` module.
- `tauri::ipc::Channel<T>` (streaming) -- Palot uses
  `webContents.send(channel, payload)` + `ipcRenderer.on(channel, ...)`,
  mirroring the existing `pty:data` / `pty:exit` patterns.
- WebView window (`<webview>` is the same in Electron, but
  WKWebView-specific Tauri commands are not present).

## Reference Scrub <!-- oc:id=sec_ae -->

Verified with grep (2026-06-04) that Palot code does not import
or shell out to the superapp repo:

- `aios-superapp` -- 0 matches in `apps/desktop/src/`
- `Workspaces/aios` -- 0 matches
- `firefly-superapp` -- 0 matches
- `from '@tauri-apps/...'` -- 0 matches

The `aios-` and `AIOS_` references that remain in Palot are:

- `apps/desktop/src/main/oracles.ts`: tmux session naming
  convention (`aios-${identity}`) carried over verbatim from the
  superapp's tmux socket format. These are session names, not code
  references to the superapp repo.
- `apps/desktop/src/main/bridges.ts`: `aios-bridge` /
  `aios/bridge` / `inbox-worker` process needles from the
  superapp's launchd bridge service. These are probe patterns, not
  code dependencies.
- `apps/desktop/src/renderer/atoms/pane-bus.ts`: the
  `application/x-aios-path` MIME type. Treated as a stable,
  external MIME; the pane bus still publishes it for interop.
- `apps/desktop/src/main/pty.ts`: `aios-term-${name}` tmux
  session naming carried over for terminal persistence.

None of these are imports of the superapp source. The superapp
repo can be safely deleted after this migration plan is
approved via F4.

## Why this matters <!-- oc:id=sec_af -->

Palot and the superapp were two different products solving the
"AI agent desktop" problem. The superapp was a Tauri playground
with motion / device / idle tiles; Palot is the OpenCode desktop
companion. Carrying the excluded surfaces would have re-introduced
the very surface-area sprawl the migration plan was meant to
collapse. The plan delivers the high-value side-panel tab set
(terminal, files, editor, oracle, voice, bridges, contacts, studio,
plugins, claude-compat, notes, pulse, memory) and drops the rest
with this written record.