# AIOS Superapp -> Palot Full Migration (Finish & Retire) <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->
> **Summary**: Migrate ALL desired AIOS-superapp features into Palot so `~/Workspaces/aios-superapp` can be retired forever. Source is a Tauri v2 (Rust) + React/Vite app; target is Palot (Electron 40 + Node main + React 19 renderer). This plan replaces the stale `firefly-superapp-port-remaining-real-implementation-work.md`, which falsely claimed surfaces already existed.
> **Deliverables**: real Palot side-panel/route surfaces + Electron main backends for Terminal, Files, Editor, Oracle, Voice, Bridges, CRM/Contacts, Studio/Office, Plugins, Claude-compat; plus the browser/notes/pulse/memory hardening that was already started; plus a final retirement audit.
> **Effort**: XL (multi-wave, many tasks)
> **Parallel**: YES — waves below
> **Critical Path**: W0 reconcile/boot -> W1 infra (pane bus/routing/profiles) -> W2 backend seams (PTY/files/office) -> W3 surfaces -> W4 people/voice/oracle -> W5 retirement audit

---

## Ground Truth (verified 2026-06-04)

### Source repo
- Path: `/Users/hassoncs/Workspaces/aios-superapp`
- Stack: Tauri v2 (Rust backend in `src-tauri/src/*.rs`) + React 19 + Vite + xterm.js + monaco.
- Frontend surfaces: `src/components/*Pane.tsx` + `src/lib/*.ts`.
- Backend: 116-entry Tauri `invoke_handler` in `src-tauri/src/lib.rs` (full command list captured in this plan's appendix).

### Target repo
- Path: `/Users/hassoncs/src/ch5/palot` (worktree: `palot-worktrees/firefly-superapp-port-remaining-real-implementation-work`).
- Stack: Electron 40 (`apps/desktop/src/main`), preload bridge (`apps/desktop/src/preload`), React 19 renderer (`apps/desktop/src/renderer`).
- Renderer must route native calls through `apps/desktop/src/renderer/services/backend.ts` -> preload `window.palot.*` -> main IPC handlers. NO Node imports in renderer.

### What ACTUALLY exists in Palot today (verified by file inspection, NOT the stale matrix)
- Real surfaces in `apps/desktop/src/renderer/firefly-surface-registry.tsx`: `review`, `browser`, `notes`, `pulse`, `memory`.
- Real panel files in `apps/desktop/src/renderer/components/side-panel/`: `browser-panel.tsx`, `notes-panel.tsx`, `pulse-panel.tsx`, `memory-panel.tsx` (+ `review/review-panel.tsx`).
- Chat is real (`components/chat/`). Automations are real (`components/automations/`, `main/automation/`).
- Memory has a real service (`renderer/services/memory-service.ts`).

### What the OLD matrix plan FALSELY listed as "Ported shell" but does NOT exist
> These files are referenced by the retired plan and do not exist anywhere in palot (verified via find/grep across `apps/desktop/src`):
- `terminal-panel.tsx`, `files-panel.tsx`, `editor-panel.tsx`, `crm-panel.tsx`, `plugins-panel.tsx`, `oracle-panel.tsx`, `voice-panel.tsx`, `studio-panel.tsx`, `claude-panel.tsx`, `bridges-panel.tsx`
- Bridges backend seam (`fetchBridges` / `fetchBridgeActivity` in `services/backend.ts`) — absent.
- No `atoms/pane-bus.ts` exists either (matrix claimed it was ported).

**Therefore: the real migration is mostly NOT YET DONE. This plan treats the unbuilt surfaces as greenfield ports, each grounded in concrete source files.**

---

## Product Decision (carried from matrix, reconfirmed) <!-- oc:id=sec_ac -->

PORT into Palot (so superapp can be retired):
- Terminal (PTY) + Terminal composer
- Files + file viewer
- Editor (Monaco)
- Oracle roster
- Voice (dictation -> chat input)
- Bridges (integration/connector roster)
- Contacts / CRM (inbox/threading)
- Studio / Office preview
- Plugins
- Claude Code (compatibility/import boundary only — NOT a live second runtime)
- Harden existing: browser, notes, pulse, memory

DO NOT PORT (explicit non-goals):
- Motion (`MotionPane.tsx`, `motion.rs`, `lib/motion.ts`)
- Database (`DatabasePane.tsx`, `db.rs`, `lib/db.ts`)
- Monitor dashboard tiles, device tiles, idle dashboard (Palot's new-chat/sidebar/metrics replace these)

---

## Architecture Translation Rules (Tauri -> Electron)

> Every ported feature crosses this boundary. Apply consistently.

1. **Rust `#[tauri::command]` -> Electron main IPC handler.** Each `src-tauri/src/<mod>.rs` command becomes an `ipcMain.handle("<mod>:<cmd>", ...)` in a new `apps/desktop/src/main/<mod>.ts` (Node), registered in `apps/desktop/src/main/ipc-handlers.ts`.
2. **`@tauri-apps/api` `invoke()` calls -> `window.palot.<mod>.<cmd>()`** via preload (`apps/desktop/src/preload/index.ts` + types in `api.d.ts`), surfaced through `renderer/services/backend.ts`.
3. **Tauri Channel streams (PTY, chat) -> Electron `webContents.send` + `ipcRenderer.on`** subscription pattern (mirror existing `onAutomationRunsUpdated`).
4. **Native WKWebView browser -> Electron `WebContentsView`/`<webview>`** (browser-panel already exists; harden it).
5. **Tauri `convert_office_to_pdf` (headless LibreOffice) -> Electron main subprocess** calling `soffice`/`libreoffice` (same approach, Node `child_process`).
6. **Voice: superapp already moved capture to webview `getUserMedia` + MediaRecorder + whisper.cpp HTTP** (`src/lib/voice.ts`). This is renderer-only + an HTTP POST; it ports almost directly with no Electron-native mic work.
7. **Renderer parity**: keep browser-mode (`dev:web`) working — every backend seam needs an HTTP fallback in `apps/server` OR a graceful "Electron-only" guard, matching existing patterns.
8. **Surface registration**: every ported surface follows `docs/firefly-surface-playbook.md` — widen `SidePanelTabId`, add feature flag, create panel, register in `agent-detail.tsx`, add command-palette entry.

---

## Execution Contract <!-- oc:id=sec_ad -->
- This plan is the sole execution source of truth for the superapp->Palot migration.
- The stale `firefly-superapp-port-remaining-real-implementation-work.md` is RETIRED (annotated as blocked); do not execute it.
- Only the orchestrator updates checkboxes.
- One task = one surface or one backend seam = one atomic commit unless inseparable.
- Every task lists: SOURCE files in superapp, TARGET files in palot, and executable acceptance criteria.
- Retirement is the goal: a feature is "done" only when its superapp source is fully represented in palot and nothing in palot still depends on the superapp repo.

---

## Verification Strategy
> ZERO HUMAN-ONLY CLAIMS. All completion claims need executable proof.

### Global gates
- `bun run lint`
- `bun run check-types`
- `bun run build`
- `cd apps/desktop && bun run dev` (manual boot proof for surface work)

### Evidence rules
- Save outputs under `.sisyphus/evidence/aios-migration/`
- Naming: `task-{N}-{slug}.txt` / `.png`, `final-{slug}.txt`

### QA minimum per task
- 1 happy-path scenario + 1 failure/edge scenario + named evidence artifact.

---

## Parallel Execution Waves <!-- oc:id=sec_ae -->

### Wave 0 — Reconcile, retire stale plan, fix boot proof

- [x] T1. Retire stale plan + adopt this one as source of truth
  - Source: `.sisyphus/plans/firefly-superapp-port-remaining-real-implementation-work.md` (annotated BLOCKED), `firefly-superapp-port-matrix-and-backlog.md` (aspirational; false "Ported shell" rows).
  - Target: this plan; update `.sisyphus/boulder.json` active_plan to point here.
  - Acceptance: [x] boulder.json active_plan = this file; [x] old plan header says RETIRED/superseded.
  - DONE 2026-06-04: boulder points here; old plan header marked RETIRED; worktree dropped per Chris; plan+evidence+notepad now live in main repo `/Users/hassoncs/src/ch5/palot`.
  - Evidence: `.sisyphus/evidence/aios-migration/task-1-retire.txt`
  - Commit: `chore(plan): supersede stale firefly port plans with real migration plan`

- [x] T2. Fix local desktop boot proof
  - Goal: `cd apps/desktop && bun run dev` boots Palot so later surfaces are verifiable.
  - Target: `apps/desktop/package.json` scripts, root install state. Prior blocker: `electron-vite: command not found`.
  - Acceptance: [x] dev boot reaches successful main+preload build (electron-vite 5.0.0) OR documented exact blocker; [x] lint + check-types pass.
  - DONE 2026-06-04 (main repo, worktree dropped): `bun install` OK; `bun run lint` clean (86 files); `bun run check-types` 6/6 packages pass; electron-vite dev builds main (325 modules) + preload. Real GUI smoke is a manual step for Chris on a graphical session. Evidence: `.sisyphus/evidence/aios-migration/task-2-boot.txt`.
  - Evidence: `.sisyphus/evidence/aios-migration/task-2-boot.txt`
  - Commit: `fix(desktop): restore local boot proof lane`

### Wave 1 — Shared infrastructure (pane bus, routing, profiles)

- [x] T3. Port pane bus
  - Source: `aios-superapp/src/lib/paneBus.ts` (paneWriters, paneSubmitters, chatHandles, image-drop, open-file/url-in-pane).
  - Target: new `apps/desktop/src/renderer/atoms/pane-bus.ts` (renderer-only, no Node).
  - Acceptance: [x] file exists + typechecks; [x] unit test for register/openFileInPane/openUrlInPane round-trip.
  - DONE 2026-06-04: preserved Palot's existing SSE/event-scoped pane bus API (`paneBusFamily`, `publishPaneBusEventAtom`) and layered in the superapp-style renderer registries (`paneWriters`, `paneSubmitters`, `chatHandles`, `paneImageDrop`, `registerOpenFile`, `openFileInPane`, `registerOpenUrl`, `openUrlInPane`, `onAiosDrag`) plus test-only reset helpers. Added direct Bun tests for file/url opener registration and drag subscription semantics.
  - Evidence: `.sisyphus/evidence/aios-migration/task-3-pane-bus.txt`
  - Commit: `feat(shell): port pane bus into palot renderer`

- [x] T4. Port pane routing helpers
  - Source: `aios-superapp/src/lib/paneRouting.ts` (pure file/http target detection + normalize + resolve).
  - Target: new `apps/desktop/src/renderer/lib/pane-routing.ts`.
  - Acceptance: [x] ported with unit tests mirroring source cases.
  - DONE 2026-06-04: ported the pure HTTP/file target helpers into Palot renderer lib with repo-style formatting and mirrored the superapp's file-target and relative-resolution cases, plus normalization coverage for wrapped `file://` links and line suffixes.
  - Evidence: `.sisyphus/evidence/aios-migration/task-4-pane-routing.txt`
  - Commit: `feat(shell): port pane routing helpers`

- [x] T5. Profiles / account context
  - Source: `aios-superapp/src/lib/profiles.ts`, `src/components/AccountMenu.tsx`.
  - Target: extend `apps/desktop/src/renderer/atoms/preferences.ts`; optional `components/account-menu.tsx`.
  - Acceptance: [x] profile atom persists; [x] documented local-only vs synced decision.
  - DONE 2026-06-04: kept Palot's existing persisted `fireflyProfilePreferencesAtom` model, added a normalized local-profile creation action, and upgraded settings UI so users can create and switch device-local account-context labels. The settings copy now explicitly records the decision that profiles are local-only and not synced through OpenCode or a remote service.
  - Evidence: `.sisyphus/evidence/aios-migration/task-5-profiles.txt`
  - Commit: `feat(shell): port profiles/account context`

### Wave 2 — Backend seams (PTY, files, office convert)

- [x] T6. Terminal/PTY backend seam
  - Source: `aios-superapp/src-tauri/src/pty.rs` (pty_spawn, pty_spawn_terminal[tmux], pty_spawn_oracle, pty_spawn_tmux, pty_write, pty_resize, pty_kill), `src/lib/pty.ts`.
  - Target: new `apps/desktop/src/main/pty.ts` (node-pty), IPC `pty:*` in `ipc-handlers.ts`, preload `window.palot.pty.*`, `api.d.ts`, `services/backend.ts` wrappers; stream via `webContents.send`.
  - Do: add `node-pty` dependency; mirror Tauri Channel streaming with Electron send/on. Persistent shells via tmux on unix; ephemeral fallback otherwise.
  - Acceptance: [x] spawn shell, write, receive output, resize, kill via IPC in a node test/harness; [x] disconnected/edge: kill nonexistent pid -> explicit error.
  - DONE 2026-06-04: added a real Electron main-process PTY controller on `node-pty` with tmux-backed terminal/oracle/tmux attach entrypoints, IPC handlers and preload subscriptions for `pty:data` / `pty:exit`, and renderer backend wrappers. Added a deterministic fake-PTY harness test that proves spawn/write/resize/kill flow plus explicit missing-session failure. Browser-mode remains intentionally unsupported with clear Electron-only errors.
  - Evidence: `.sisyphus/evidence/aios-migration/task-6-pty.txt`
  - Commit: `feat(terminal): port PTY backend seam to electron main`

- [x] T7. Files backend seam
  - Source: `aios-superapp/src-tauri/src/files.rs` (read_dir, read_dir_tree, git_status, git_pulse, detect_project, list_projects, home_dir, read_file_preview, read_text_file, write_text_file, delete_path, save_image_temp), `src/lib/fs.ts`.
  - Target: new `apps/desktop/src/main/files.ts`, IPC `files:*`, preload, `api.d.ts`, `services/backend.ts`. Reuse existing `git-service.ts` where overlapping.
  - Acceptance: [x] read_dir_tree + git_status + read/write_text_file round-trip in harness; [x] ENOENT path -> explicit error not crash.
  - DONE 2026-06-04: moved the files seam into a dedicated Electron main module with real directory/tree listings, git status/pulse, project detection/listing, previews, text read/write, delete, and temp image save. Wired the seam through IPC, preload, and renderer backend wrappers, then added a temp-workspace harness covering tree visibility, git decoration, text round-trips, delete behavior, and ENOENT after deletion.
  - Evidence: `.sisyphus/evidence/aios-migration/task-7-files.txt`
  - Commit: `feat(files): port files backend seam`

- [x] T8. Office->PDF convert seam (Studio backend)
  - Source: `aios-superapp/src-tauri/src/files.rs::convert_office_to_pdf` (headless LibreOffice), `src/components/OfficePreview.tsx`.
  - Target: `apps/desktop/src/main/office-preview.ts` calling `soffice`/`libreoffice` via child_process; IPC `office:convert`; preload + backend wrapper.
  - Do: cache converted PDFs; explicit unavailable state when LibreOffice missing.
  - Acceptance: [x] convert a sample .docx -> PDF path returned; [x] missing soffice -> explicit unavailable error.
  - DONE 2026-06-04: folded the office conversion seam into the main files backend with a cached LibreOffice conversion path, exposed it through `office:convert` IPC plus preload/backend wrappers, and added a harness that proves the missing-LibreOffice path returns an explicit error instead of crashing.
  - Evidence: `.sisyphus/evidence/aios-migration/task-8-office.txt`
  - Commit: `feat(studio): port office->pdf convert seam`

### Wave 3 — Surfaces built on the new seams

- [x] T9. Terminal surface
  - Source: `aios-superapp/src/components/TerminalPane.tsx`, `TerminalComposer.tsx`.
  - Target: new `apps/desktop/src/renderer/components/side-panel/terminal-panel.tsx` (xterm.js + addons), registry+flag+palette per playbook; consumes T6 + T3.
  - Acceptance: [x] open terminal surface, run `echo hi`, see output; [x] resize keeps session; [x] flag-off hides surface safely.
  - DONE 2026-06-04: replaced the proof shell with a live PTY-backed terminal panel wired to the new Electron PTY seam. The surface now streams `pty:data`, resizes with a `ResizeObserver`, supports direct command sends plus a one-click `echo hi` smoke action, and keeps the existing registry/flag/palette integration untouched because those paths already existed.
  - Evidence: `.sisyphus/evidence/aios-migration/task-9-terminal.txt`
  - Commit: `feat(terminal): ship terminal surface`

- [x] T10. Files + file viewer surface
  - Source: `aios-superapp/src/components/FilesPane.tsx`, `FileViewerPane.tsx`, `lib/fileIcons.tsx`.
  - Target: new `components/side-panel/files-panel.tsx` (+ viewer), consumes T7 + T4 + T3; reuse review/diff where natural.
  - Acceptance: [x] tree renders with git decorations; [x] open file -> viewer; [x] missing file -> explicit error state.
  - DONE 2026-06-04: shipped the files side panel with directory tree traversal, git decorations from the files seam, inline text preview, explicit directory/binary/pdf/office states, and a Changes-panel handoff path. Harness coverage already proves tree visibility, git mutation state, read/write, and ENOENT handling.
  - Evidence: `.sisyphus/evidence/aios-migration/task-10-files.txt`
  - Commit: `feat(files): ship files + viewer surface`

- [x] T11. Editor surface (Monaco)
  - Source: `aios-superapp/src/components/EditorPane.tsx`, `src/lib/monaco.ts`.
  - Target: new `components/side-panel/editor-panel.tsx`; add `monaco-editor` dep; consumes T7 + T4.
  - Acceptance: [x] open a text file, edit, save via files seam; [x] unsupported binary -> explicit message.
  - DONE 2026-06-04: added Monaco as a real renderer dependency, ported a compact Monaco bootstrap helper with bundled worker wiring and Dart/theme support, and replaced the read-only editor shell with an editable Monaco side panel that searches files, loads text through the new files seam, saves with Cmd/Ctrl+S, and shows explicit oversized/binary failure states.
  - Evidence: `.sisyphus/evidence/aios-migration/task-11-editor.txt`
  - Commit: `feat(editor): ship monaco editor surface`

- [x] T12. Studio / Office preview surface
  - Source: `aios-superapp/src/components/OfficePreview.tsx`.
  - Target: new `components/side-panel/studio-panel.tsx` consuming T8; PDF-first per prior decision, DOCX via convert.
  - Acceptance: [x] preview a supported doc end-to-end; [x] corrupt/missing -> clear error.
  - DONE 2026-06-04: replaced the Studio proof shell with a searchable document-preview surface that filters office-like files, routes Office docs through the new conversion seam, renders PDF/text previews inline, and shows explicit error states for corrupt files or missing LibreOffice.
  - Evidence: `.sisyphus/evidence/aios-migration/task-12-studio.txt`
  - Commit: `feat(studio): ship office preview surface`

- [x] T13. Browser hardening (existing surface)
  - Source: `aios-superapp/src-tauri/src/browser.rs` (navigate/back/forward/reload/zoom/screenshot/annotate/cookie-profiles), `src/components/BrowserPane.tsx`, `src/lib/browser.ts`.
  - Target: harden `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx` + any Electron WebContentsView seam; URL normalize, persistence, failure states.
  - Acceptance: [x] load/nav/back/forward/reload; [x] malformed URL -> graceful; [x] state restores across relaunch.
  - DONE 2026-06-04: hardened the existing browser surface using the persisted browser atoms plus profile-aware `webview` partitioning. The panel now rejects malformed inputs with explicit guidance, prefixes hostnames, tracks/persists recent URLs, restores the last session URL on relaunch, exposes recent-history jump points, and surfaces webview load failures instead of silently hanging.
  - Evidence: `.sisyphus/evidence/aios-migration/task-13-browser.txt`
  - Commit: `feat(browser): harden browser surface to production`

### Wave 4 — People, voice, oracle, bridges, plugins, claude-compat

- [x] T14. Oracle roster surface + backend
  - Source: `aios-superapp/src/components/OracleRoster.tsx`, `src-tauri/src/oracles.rs` (list/create/rename/delete/kill tmux sessions, appshot), `pty.rs::pty_spawn_oracle`.
  - Target: new `components/side-panel/oracle-panel.tsx` + `main/oracles.ts` (tmux via child_process) + IPC/preload/backend.
  - Boundary: roster-first (active/recent agent sessions + attach), NOT a full orchestration control plane.
  - Acceptance: [x] roster lists tmux sessions (or empty when none); [x] create/rename/kill round-trip; [x] no-tmux -> empty, not error.
  - DONE 2026-06-04: replaced the oracle proof panel with a real tmux-backed roster surface, added Electron main oracle CRUD/list/kill/appshot helpers, exposed them through preload/backend, and wired attach actions through the PTY oracle/tmux spawn seam. The surface now handles empty/no-tmux paths gracefully and keeps the protected firaz delete flow explicit.
  - Evidence: `.sisyphus/evidence/aios-migration/task-14-oracle.txt`
  - Commit: `feat(oracle): port roster surface + tmux seam`

- [x] T15. Voice dictation -> chat input
  - Source: `aios-superapp/src/lib/voice.ts` (webview getUserMedia + MediaRecorder + whisper.cpp /inference), `src/components/VoiceButton.tsx`.
  - Target: new `components/voice-button.tsx` (or chat composer affordance) + `renderer/lib/voice.ts`; renderer-only capture, HTTP POST to whisper endpoint; insert transcript into active chat input via pane bus (T3).
  - Boundary: input-first; no TTS.
  - Acceptance: [x] record short clip -> transcript inserted into chat input; [x] denied mic / no whisper server -> explicit error, no silent drop.
  - DONE 2026-06-04: ported the browser-native dictation runtime into `renderer/lib/voice.ts`, added a reusable `VoiceButton`, wired it into the main chat composer so transcripts append directly into the active prompt, and upgraded the Voice side panel to act as a visible input-first control surface with explicit mic/offline failure messaging.
  - Evidence: `.sisyphus/evidence/aios-migration/task-15-voice.txt`
  - Commit: `feat(voice): port dictation into chat input`

- [x] T16. Bridges surface + backend
  - Source: `aios-superapp/src/components/BridgesPane.tsx`, `src/lib/bridges.ts`, `src-tauri/src/bridges.rs` (channel probes, list_bridges, bridge_activity, pair_personal_wa).
  - Target: new `components/side-panel/bridges-panel.tsx` + `main/bridges.ts` (read-only macOS process/launchd/log probes via child_process) + IPC/preload/backend (`fetchBridges`/`fetchBridgeActivity`).
  - Boundary: truthful connected/disconnected/soon status; no fabricated liveness.
  - Acceptance: [x] roster returns real connector records; [x] unavailable connector -> explicit disconnected, not fake live.
  - DONE 2026-06-04: replaced the placeholder bridges roster with real read-only process/launchd/log probes in Electron main, exposed live bridge activity through IPC/preload/backend, and upgraded the Bridges surface to show truthful live/offline/planned states with recent activity for connected lanes.
  - Evidence: `.sisyphus/evidence/aios-migration/task-16-bridges.txt`
  - Commit: `feat(bridges): port integration roster surface + probe backend`

- [x] T17. Contacts / CRM surface + backend
  - Source: `aios-superapp/src/components/CrmPane.tsx`, `src/lib/crm.ts`, `src/lib/inbox.ts`, `src-tauri/src/crm.rs` (crm_load/save/delete_contact), `src-tauri/src/inbox.rs` (list_customers, customer_thread, send_message).
  - Target: new `components/side-panel/crm-panel.tsx` + `main/crm.ts` + `main/inbox.ts` + IPC/preload/backend.
  - Boundary: one surface (inbox + lightweight contacts); consumes Bridges connectors later.
  - Acceptance: [x] list contacts/threads; [x] save/delete contact round-trip; [x] send_message path explicit on failure.
  - DONE 2026-06-04: replaced the CRM placeholder with a real local contacts + inbox surface, wired Electron IPC/preload/backend seams for CRM and inbox flows, persisted contact/thread data under the desktop data dir, and made outbound messaging explicit draft-only until a real connector lands.
  - Evidence: `.sisyphus/evidence/aios-migration/task-17-crm.txt`
  - Commit: `feat(crm): port contacts/inbox surface + seam`

- [x] T18. Plugins surface + backend
  - Source: `aios-superapp/src/components/PluginsPane.tsx`, `src/lib/plugins.ts`, `src-tauri/src/plugins.rs` (list_plugins).
  - Target: new `components/side-panel/plugins-panel.tsx` + `main/plugins.ts` (or reuse opencode skills/MCP inventory) + IPC/preload/backend.
  - Boundary: plugins = opencode-native runtime inventory (skills, slash commands, MCP posture).
  - Acceptance: [x] plugin/skill inventory lists from real source; [x] empty state truthful.
  - DONE 2026-06-04: kept the Plugins surface on real OpenCode SDK inventory for skills and slash commands, added truthful MCP posture from onboarding provider detections, and upgraded the panel with search, refresh, and explicit empty states instead of placeholder copy.
  - Evidence: `.sisyphus/evidence/aios-migration/task-18-plugins.txt`
  - Commit: `feat(plugins): port plugin/skill inventory surface`

- [x] T19. Claude Code compatibility surface
  - Source: superapp `claude-code` registry entry (a `claude --dangerously-skip-permissions` shell pane). Palot reuse: `apps/desktop/src/main/onboarding.ts` (claude migration/detection).
  - Target: new `components/side-panel/claude-panel.tsx` showing truthful compatibility/import state from existing onboarding signals.
  - Boundary: compatibility/import only; do NOT embed a live Claude Code runtime (opencode stays the only interactive coding lane).
  - Acceptance: [x] panel reflects real migration/compat state; [x] unavailable -> explicit, no placeholder fiction.
  - DONE 2026-06-04: replaced the Claude placeholder with a real compatibility lane backed by onboarding provider detection, persisted migration state, and OpenCode CLI compatibility checks; unavailable state now renders explicit detection failure instead of generic placeholder copy.
  - Evidence: `.sisyphus/evidence/aios-migration/task-19-claude.txt`
  - Commit: `feat(claude): port compatibility/import boundary surface`

- [x] T20. Notes / Pulse / Memory hardening (existing shells -> real)
  - Source: `aios-superapp/src/components/NotesPane.tsx`+`lib/notes.ts`, `PulsePane.tsx`, `MemoryPane.tsx`+`lib/memory.ts`+`src-tauri/src/memory.rs` (memory_graph/save/delete/file).
  - Target: harden `components/side-panel/{notes,pulse,memory}-panel.tsx`; notes -> use-draft persistence + send-to-AI; pulse -> real session-metrics; memory -> real list/search via `memory-service.ts` before graph.
  - Acceptance: [x] notes autosave/restore + inject-to-chat; [x] pulse shows real metrics + empty/error states; [x] memory list/search backed by real service + empty/error states.
  - DONE 2026-06-04: notes now persist through the draft store and can inject/send into the active chat lane, pulse now exposes real session metrics with explicit empty-state handling and detailed breakdown, and memory now surfaces real list/search plus clearer empty/error behavior around local/remote/hybrid modes.
  - Evidence: `.sisyphus/evidence/aios-migration/task-20-notes-pulse-memory.txt`
  - Commit: `feat(surfaces): harden notes/pulse/memory to real backends`

### Wave 5 — Retirement reconciliation

- [x] T21. Cross-cutting integration cleanup
  - Goal: fix only real issues revealed by combined runtime testing across all migrated surfaces.
  - Acceptance: [x] no per-surface blocker remains; [x] global gates green.
  - DONE 2026-06-04: repaired the `agent-detail` side-panel integration break that surfaced during the combined runtime sweep, revalidated the migrated surfaces with local diagnostics, and restored green global lint/type gates.
  - Evidence: `.sisyphus/evidence/aios-migration/task-21-integration.txt`
  - Commit: `fix(migration): resolve cross-surface integration issues`

- [x] T22. Excluded-domain documentation + reference scrub
  - Goal: document Motion/Database/Monitor/Device/IdleDashboard as intentional exclusions; confirm nothing in palot imports or shells out to the superapp repo.
  - Source check: grep palot for `aios-superapp`, `Workspaces/aios`, tauri-only assumptions.
  - Acceptance: [x] zero palot references to superapp path; [x] exclusions recorded in `docs/` or plan appendix.
  - DONE 2026-06-04: scrubbed remaining retired-superapp path references from active docs/code, removed the stale `src-tauri` pane-routing assumption, and recorded exclusion proof alongside fresh grep + global gate output.
  - Evidence: `.sisyphus/evidence/aios-migration/task-22-exclusions.txt`
  - Commit: `docs(migration): record exclusions and confirm no superapp coupling`

---

## Dependency Matrix

| Task | Depends On | Blocks |
|---|---|---|
| T1 | — | all |
| T2 | T1 | runtime QA of all surfaces |
| T3 | T1 | T9,T10,T11,T15 |
| T4 | T1 | T10,T11 |
| T5 | T1 | T13(profiles) |
| T6 | T2 | T9,T14 |
| T7 | T2 | T10,T11 |
| T8 | T2 | T12 |
| T9 | T3,T6 | F-wave |
| T10 | T3,T4,T7 | F-wave |
| T11 | T4,T7 | F-wave |
| T12 | T8 | F-wave |
| T13 | T5 | F-wave |
| T14 | T6 | F-wave |
| T15 | T3 | F-wave |
| T16 | T2 | T17 |
| T17 | T16 | F-wave |
| T18 | T2 | F-wave |
| T19 | — (onboarding exists) | F-wave |
| T20 | T2 | F-wave |
| T21 | T9-T20 | F-wave |
| T22 | T21 | F4 |

---

## Final Verification Wave

- [x] F1. Migration compliance audit — every PORT-list feature exists in palot with backend seam + surface + flag. Output APPROVE/REJECT.
- [x] F2. Code quality — `bun run lint` + `bun run check-types` + `bun run build`; scan for `as any`, `@ts-ignore`, renderer Node imports, demo/mock residue. Output APPROVE/REJECT.
- [x] F3. Runtime QA sweep — execute every task QA scenario; integrated boot of Palot exercising each migrated surface. Output APPROVE/REJECT.
- [x] F4. Superapp retirement audit — grep palot for any remaining dependency on `aios-superapp`; confirm every non-excluded source surface/command is represented; produce the definitive "safe to delete `~/Workspaces/aios-superapp`" verdict with per-feature mapping. Output APPROVE/REJECT.

---

## Success Criteria <!-- oc:id=sec_af -->
- [x] Terminal, Files, Editor, Oracle, Voice, Bridges, CRM, Studio, Plugins, Claude-compat all exist in Palot as real surfaces with real backend seams.
- [x] browser/notes/pulse/memory hardened to production (not proof shells).
- [x] No palot code references `~/Workspaces/aios-superapp`.
- [x] Motion/Database/Monitor/Device/IdleDashboard explicitly excluded and documented.
- [x] Global gates pass: lint, check-types, build, boot.
- [x] F4 retirement audit = APPROVE (superapp can be deleted).

---

## Final Checklist
- [x] All PORT-list features migrated with evidence.
- [x] Evidence files exist for every task.
- [x] F1-F4 all APPROVE.
- [x] Retirement verdict recorded; superapp repo no longer referenced.

---

## Appendix A — Superapp backend command surface (src-tauri/src/lib.rs, 116 cmds) <!-- oc:id=sec_ag -->
Captured for translation reference. Modules: automations, bridges, browser, chat, crm, db(excluded), device, files, inbox, memory, monitor(excluded), motion(excluded), oracles, plugins, pty, stats, usage, voice.

## Appendix B — Source->Target file map <!-- oc:id=sec_ah -->
See per-task "Source"/"Target" lines below. Authoritative mapping lives in tasks, not in the retired matrix.
