# Current Goal

## Goal As Stated

"Entire thing done. All features complete. All app, all. All the repos merged together. Everything working, verified end-to-end."

## Interpreted Goal

Ship ONE cohesive Firefly **desktop** front end by merging `aios-superapp` (Tauri super-app) and `elf` (Electron OpenCode GUI) into a single app, re-themed entirely on `@ch5me/firefly-design`, with every feature of both apps present and working.

Decision already made and published (`ch5-company/firefly-frontend-merge-plan.md`, commit `dc0abb0`):
- **Base = elf** (this repo). It becomes the Firefly desktop front end.
- **aios is absorbed as a pane layer**, not as a runtime. Rebuild aios's super-app pane-shell + command-palette UX on elf's stack; bring aios features in as firefly-themed, **Jotai-flag-gated pane modules**.
- aios's Rust/Tauri backend is reference-only; any kept native feature is reimplemented in elf's Electron main (`apps/desktop/src/main/`). Never import Tauri/Rust.
- **Federation, not repo merge:** desktop (elf) + web (firefly-cloud) stay coherent via shared `@ch5me/*` chat/runtime/theme packages.

"All repos merged" = elf is the single app; aios functionality is reproduced inside it; ch5-packages is consumed (not merged); firefly-cloud is federated (not merged).

## Success Criteria

- Single elf desktop app builds, lints, typechecks clean: `bun run check-types && bun run lint && bun run build`.
- **Workspace pane-shell** exists: resizable multi-pane grid + global Cmd-K palette + pane registry (`id → component + enabled-flag + native-deps`).
- **Flagship pane = chat-first OpenCode IDE** (elf's chat + tool-call viz + diff/review + automations) opens by default and works against a local OpenCode server.
- **Every aios feature is present** as a registered pane, firefly-themed: Chat, Terminal, Files, Browser, Memory Graph, CRM/Contacts, Database Workbench, MotionBoards Studio, Automations, Bridges, Notes, Editor, Pulse/Usage, Plugins/Skills, Voice.
- **Flag toggling works**: any heavy pane can be turned on/off from Cmd-K with no code change, nothing deleted.
- **Theme is 100% firefly**: no aios `--color-*`/`--aios-*` leakage; dark/light both correct; uses `@ch5me/ch5-ui-web` primitives.
- **Mac packaged build** smoke-launches: `CSC_IDENTITY_AUTO_DISCOVERY=false bun run package:mac`.
- End-to-end verified: launch app, spawn multiple panes, run a real chat turn, toggle flags, exercise each enabled feature.

## Constraints

- elf is the base; do not switch runtimes. No Tauri/Rust imports.
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

- **Decision + audit: DONE.** Published to `ch5-company/firefly-frontend-merge-plan.md` (`dc0abb0`). Full working plan: `~/.claude/plans/okay-i-d-like-you-adaptive-forest.md`. Goal doc committed `ec3dea0` (pushed).
- **Firefly theming: DONE across products** (prior session handoff `handoff-20260531.md`). elf already bridges `@ch5me/firefly-design` tokens in `packages/ui/src/styles/globals.css`; warm brand fallbacks preserved.
- **ARCHITECTURE CORRECTION (discovered 2026-06-01 by reading real renderer):** elf is **session-centric**, not a free-form pane grid. Shape = chat (session/Agent) in the main area + a **right-hand side panel with a TAB REGISTRY**. The pane system the goal needs ALREADY EXISTS in embryo:
  - Registry contract: `components/side-panel/side-panel-tabs.tsx` → `SidePanelTabDef { id, label, icon, isAvailable(ctx), render(ctx) }` where `ctx = { agent }`.
  - Host: `components/side-panel/session-side-panel.tsx` (vertical tab strip + content, firefly-themed via `@ch5me/elf-ui`).
  - State: `atoms/ui.ts` → `SidePanelTabId = "review" | "browser"`, `sidePanelOpenAtom`, `sidePanelActiveTabAtom`.
  - Tabs so far: `review` (real) + `browser` (PLACEHOLDER — `browser-panel.tsx` says "Full webview coming soon… placeholder to verify the tab system works").
  - Flags: `atoms/feature-flags.ts` Jotai `atomWithStorage`, toggled via Cmd-K. (Currently only `automationsEnabledAtom`.)
  - **Therefore: aios features land as side-panel tabs (+ routes for big ones), via THIS registry. Do NOT build a parallel workspace pane-grid.**
- **Side-panel surface system: LANDED** (Chris said "take it over"). Committed + pushed:
  - `38645d6` — took over the in-flight slice: session side-panel tab registry (review + browser placeholder), rendered in `@ch5me/workspace` ResizablePanes. Also fixed a broken install: `@ch5me/motion` declares `@ch5me/vitest-react-native-mocks` as a runtime `dependency` (manifest bug — it's test-only); resolved by linking that dir in elf `workspaces`. Typecheck clean.
  - `17d2b01` — flag-gating mechanism: `browserPanelEnabledAtom` gates the Browser tab; Cmd-K > Features "Enable/Disable Browser Panel" toggle (mirrors Automations). **This is the reusable "disable without deleting" pattern every aios surface will use.** Typecheck + biome clean.
- **TECH DEBT noted:** (a) `@ch5me/motion` should move `@ch5me/vitest-react-native-mocks` to devDependencies (cross-repo fix in ch5-packages); (b) the dir-link model (`../ch5-packages/...` in `workspaces`) leaks internal test deps — the company-correct end state is published `@ch5me/*` consumption from GitHub Packages.
- **aios feature ports: STARTED** — pattern proven on Browser tab; remaining surfaces below are the bulk of the work.

## Plan (corrected to elf's real architecture — side-panel tab registry, not a pane grid)

0. **Orient: DONE.** Real renderer read; architecture corrected.
1. **Coordinate / take over in-flight slice: DONE** (`38645d6`).
2. **Feature-flag gating of side-panel surfaces: DONE** (`17d2b01`) — pattern: `<x>EnabledAtom` in `atoms/feature-flags.ts` + Cmd-K toggle + conditional registry entry in `agent-detail.tsx`.
3. **Land REAL aios surfaces as tabs** (NEXT), cheapest pure-frontend first: **Notes**, **Pulse/Usage** (`@ch5me/charts-web`), **Memory Graph** (3d-force-graph). Each = new `components/side-panel/<x>-panel.tsx` + `SidePanelTabId` widen + flag + registry entry. Then **real Browser webview** (Electron `WebContentsView` from main, replacing the placeholder).
4. **Real Browser tab** — replace the placeholder `browser-panel.tsx` with an Electron `WebContentsView` driven from `apps/desktop/src/main/` (cross-platform; supersedes aios's macOS-only WKWebView).
5. **Bigger surfaces as routes, not just tabs**, where they deserve full width: **Terminal** (node-pty in main, keep ON), **Database Workbench** (better-sqlite3/pg). Register in `router.tsx` + nav, flag-gated.
6. **Remaining aios features flag-gated**: CRM/Contacts, MotionBoards Studio, Bridges, Plugins/Skills, Voice — present but OFF in v1.
7. **Federation seams**: `@ch5me/elf-auth-client` SSO, `@ch5me/log-client-*` telemetry, chat lifecycle aligned to Firefly tool-registry.
8. **Verify end-to-end** each slice: `bun run check-types && lint && build`, dev launch, open the tab, real chat turn, flag toggle; finally Mac package smoke-launch.

Execution discipline: small coherent independently-verified slices; commit (goal doc + related code) and push each; never sweep up another worker's uncommitted edits; update this doc as state changes.

## Next Update Triggers

- goal changes
- constraints change
- acceptance criteria change
- plan or blocker state changes materially
- each major slice lands (update Current State)
