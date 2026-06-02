# Current Goal

## Goal As Stated

"Entire thing done. All features complete. All app, all. All the repos merged together. Everything working, verified end-to-end."

## Interpreted Goal

Ship ONE cohesive Firefly **desktop** front end by merging `aios-superapp` (Tauri super-app) and `palot` (Electron OpenCode GUI) into a single app, re-themed entirely on `@ch5me/firefly-design`, with every feature of both apps present and working.

Decision already made and published (`ch5-company/firefly-frontend-merge-plan.md`, commit `dc0abb0`):
- **Base = palot** (this repo). It becomes the Firefly desktop front end.
- **aios is absorbed as a pane layer**, not as a runtime. Rebuild aios's super-app pane-shell + command-palette UX on palot's stack; bring aios features in as firefly-themed, **Jotai-flag-gated pane modules**.
- aios's Rust/Tauri backend is reference-only; any kept native feature is reimplemented in palot's Electron main (`apps/desktop/src/main/`). Never import Tauri/Rust.
- **Federation, not repo merge:** desktop (palot) + web (firefly-cloud) stay coherent via shared `@ch5me/*` chat/runtime/theme packages.

"All repos merged" = palot is the single app; aios functionality is reproduced inside it; ch5-packages is consumed (not merged); firefly-cloud is federated (not merged).

## Success Criteria

- Single palot desktop app builds, lints, typechecks clean: `bun run check-types && bun run lint && bun run build`.
- **Workspace pane-shell** exists: resizable multi-pane grid + global Cmd-K palette + pane registry (`id → component + enabled-flag + native-deps`).
- **Flagship pane = chat-first OpenCode IDE** (palot's chat + tool-call viz + diff/review + automations) opens by default and works against a local OpenCode server.
- **Every aios feature is present** as a registered pane, firefly-themed: Chat, Terminal, Files, Browser, Memory Graph, CRM/Contacts, Database Workbench, MotionBoards Studio, Automations, Bridges, Notes, Editor, Pulse/Usage, Plugins/Skills, Voice.
- **Flag toggling works**: any heavy pane can be turned on/off from Cmd-K with no code change, nothing deleted.
- **Theme is 100% firefly**: no aios `--color-*`/`--aios-*` leakage; dark/light both correct; uses `@ch5me/ch5-ui-web` primitives.
- **Mac packaged build** smoke-launches: `CSC_IDENTITY_AUTO_DISCOVERY=false bun run package:mac`.
- End-to-end verified: launch app, spawn multiple panes, run a real chat turn, toggle flags, exercise each enabled feature.

## Constraints

- palot is the base; do not switch runtimes. No Tauri/Rust imports.
- firefly-design is the SOLE token authority. No second design system.
- OpenCode is the primary chat runtime; do not maintain two chat stacks (aios multi-engine is optional/secondary).
- Mac first, Windows next — Electron anchor; macOS-only natives (Liquid Glass, WKWebView→WebContentsView, Whisper) stay flagged until Windows backends exist.
- Tailwind v4 `@source` must scan new pane dirs or utilities won't generate.
- Respect concurrent work: other agents/Chris have live uncommitted edits in this repo (side-panel, chat-view, review-panel). Commit coherent isolated slices; never sweep up others' work.
- Company alignment: federate via `@ch5me/elf-auth-client` + `@ch5me/log-client-*`; keep chat UI in shared `@ch5me/*` packages.

## Non-Goals

- Not merging firefly-cloud, folio-db, open-pencil repos in — they federate.
- Not porting aios's Rust backend; not keeping aios as a runtime.
- Not Windows-shipping the macOS-native panes in v1 (they ship flagged-off).
- Not a web/Next.js rebuild — this is the desktop surface.

## Current State

- **Decision + audit: DONE.** Published to `ch5-company/firefly-frontend-merge-plan.md` (`dc0abb0`). Full working plan: `~/.claude/plans/okay-i-d-like-you-adaptive-forest.md`.
- **Firefly theming: DONE across products** (prior session handoff `handoff-20260531.md`). palot already bridges `@ch5me/firefly-design` tokens in `packages/ui/src/styles/globals.css`; warm brand fallbacks preserved. Repo `ahead 2` of origin/main with the firefly bridge commits.
- **In-flight (other work, uncommitted):** `apps/desktop/src/renderer/components/side-panel/` (new), edits to `chat-view.tsx`, `review-panel.tsx`, `agent-detail.tsx`, `atoms/ui.ts`. Leave to its owner.
- **Pane-shell + aios feature ports: NOT STARTED.**

## Plan

1. **Orient in real renderer** — read `router.tsx`, root layout, `atoms/feature-flags.ts`, the in-flight side-panel, command palette wiring. Confirm extension points without colliding with live edits.
2. **Workspace pane-shell layer** (additive, new `apps/desktop/src/renderer/workspace/`): `paneRegistry.ts`, `PaneGrid.tsx` (use existing `react-resizable-panels`), extend Cmd-K to spawn panes.
3. **Flagship pane**: wrap current OpenCode chat IDE (chat + review) as the default-open registered pane.
4. **Port aios features as flag-gated panes**, by native coupling:
   - Pure-frontend first: Notes, Memory Graph (3d-force-graph), Pulse (`@ch5me/charts-web`).
   - Electron-main reimpl: Terminal (node-pty, keep ON), Files (merge w/ review), Database (better-sqlite3/pg).
   - Defer behind flags: Browser (WebContentsView), CRM, MotionBoards, Bridges, Plugins, Voice.
5. **Feature-flag wiring**: one Jotai `atomWithStorage` per module in `atoms/feature-flags.ts`; registry filters by enabled flags. v1 = heavy panes OFF, nothing removed.
6. **Federation seams**: `@ch5me/elf-auth-client` SSO, `@ch5me/log-client-*` telemetry, chat lifecycle aligned to Firefly tool-registry.
7. **Verify end-to-end** each slice: typecheck/lint/build, dev launch, spawn panes, real chat turn, flag toggles; finally Mac package smoke-launch.

Execution discipline: land in small, coherent, independently-verified slices. Commit each slice (goal doc + related code) and push. Update this doc when scope/criteria/state change.

## Next Update Triggers

- goal changes
- constraints change
- acceptance criteria change
- plan or blocker state changes materially
- each major slice lands (update Current State)
