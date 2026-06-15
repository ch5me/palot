# Elf Agent Instructions

## Purpose of This File

This file is injected into every agent session for this project. Keep it short.
Only add entries here if an agent is likely to get stuck or repeat a mistake without them.
Do NOT add one-time setup notes, general knowledge, or things discoverable from config files.

## Project Structure

- **Monorepo**: Turborepo + Bun workspaces (Bun 1.3.8)
- **`packages/ui`** (`@ch5me/elf-ui`): Storybook + global styles host for the CH5-owned UI packages (`@ch5me/ch5-ui-web`, `@ch5me/agent-ui-web`). Holds **no components of its own** — apps import UI directly from those upstream packages. (Historically a shadcn/ui shim layer; the 133 pass-through shims were burned down 2026-06-14.)
- **`packages/configconv`**: Universal agent config converter library (`@ch5me/elf-configconv`) -- converts between Claude Code, OpenCode, and Cursor formats
- **`packages/configconv-cli`**: Thin CLI wrapper (`configconv`) for the converter library
- **`apps/desktop`**: Electron 40 + Vite + React 19 desktop app (via `electron-vite`)
- **`apps/server`**: Bun + Hono backend -- used only in browser-mode dev (`dev:web`), NOT bundled with Electron

### Desktop App Layout (`apps/desktop/src/`)

- **`main/`** -- Electron main process (Node.js): window management, IPC handlers, OpenCode server lifecycle, filesystem reads
- **`preload/`** -- Electron preload bridge: exposes `window.elf` API via `contextBridge`
- **`renderer/`** -- React app (browser context): components, hooks, services, atoms (Jotai)

## Cross-Repo Development

`@ch5me/workspace` is developed in `ch5-packages` and consumed here via bun workspace symlink.
The symlink is in `package.json` workspaces: `../ch5-packages/packages/workspace/contract`.

When the provider's `dist/` is stale (new exports not in built output), rebuild:
```bash
cd ~/src/ch5/ch5-packages/packages/workspace/contract && pnpm run build
```

Vite needs React dedup aliases because `@react-spring/web` resolves its own React.
See `apps/desktop/src/renderer/vite.web.config.ts` for the aliases.

For full details, load the `cross-repo-dev` skill.

## Skills

Project-specific skills live in `.agents/skills/`. Load a skill before starting
work that matches its domain -- they contain patterns and footguns that override
generic knowledge.

| Skill | When to load |
|---|---|
| `react-best-practices` | Writing or reviewing renderer components, optimizing re-renders or bundle size |

## Docs / Wiki

- GenUI and artifact architecture is documented in `docs/genui-artifact-architecture.md`. Read it before changing the GenUI registry, renderer, artifact atoms, session widget surfaces, side-panel artifact surface, or prompt-context injection.
- Session debugging runbook lives in `docs/session-debugging.md`. Use it when Palette/OpenCode sessions look stuck or DB/UI state disagrees.
- `bun run debug:sessions -- <session-id>` now compares SQLite history with live active-session presence and `session.status()` truth. Use it first for hidden active sessions, stale recency, and child divergence.
- Palot/OpenCode plugin/runtime seam is documented in `docs/palot-opencode-plugin-bridge.md`. Read it before changing plugin loading, tool registration, resolver payloads, browser action dispatch, or side-panel UI command bridges.
- For this repo, do not treat unrelated dirty worktrees as an automatic blocker. Assume parallel agents are active, commit your scoped work frequently, and move forward unless a direct file-level conflict makes the current edit unsafe.

## Temporary Staging Policy (expires after staging launch)

**Browser-mode proof is the required verification path for Palette/three-pane finish work until the Electron dev runtime `bun:` ESM loader crash is fixed.** Electron-side manual proof is explicitly skipped during this staging window.

- **Blocker**: Electron dev runtime crashes on app load with `ERR_UNSUPPORTED_ESM_URL_SCHEME` for the `bun:` protocol before a usable renderer window appears. Evidence: `.sisyphus/evidence/task-6-electron-pane.txt` and `.sisyphus/evidence/task-6-electron-proof.md`.
- **What this means**: browser-mode manual proof (live Chrome + OS automation, screenshot + DOM capture) is sufficient for verification gating. Do not block final scope review or ticket closeout on missing Electron proof while this crash persists.
- **Expires**: after staging launch, when the Electron `bun:` loader issue is resolved. At that point, re-enable Electron-side manual proof as a required verification step.
- **Not permanent**: this is a temporary staging-window exception, not a permanent relaxation of Electron verification requirements. Once the blocker is fixed, both runtimes must be proved again.

## Commands

- **Runtime policy**: manage dev services only through the root devmux wrapper commands below. Do not start `vite`, `electron-vite`, `apps/server`, `apps/desktop`, `npm`, `npx`, or raw `node ...vite` foreground processes directly in agent sessions; that fights other agents, stale tmux panes, and owned ports. If you need logs, use `bun run svc:attach -- <service>`. If a bounded diagnostic ever needs a direct process, stop it immediately and restore devmux before handoff.
- **Start project**: `bun run dev` (starts browser-mode stack via devmux: backend on `30206`, web on `20883`)
- **Service status**: `bun run svc:status`
- **Attach logs**: `bun run svc:attach -- <service>`
- **Stop services**: `bun run svc:stop -- <service>`
- **Electron dev**: use devmux service `desktop` / `desktop-wayland`; do not run `cd apps/desktop && bun run dev:electron-local` manually unless editing that service definition
- **Browser-only dev**: devmux service `web` runs Vite on `20883`; do not run `cd apps/desktop && bun run dev:web` manually unless editing that service definition
- **Backend server** (browser mode only): devmux service `server` runs Bun server on `30206`; do not run `cd apps/server && bun run dev` manually unless editing that service definition
- **Storybook**: `packages/ui` (@ch5me/elf-ui) owns a local Storybook — devmux service `storybook` on port `10618` (`bun run svc:status`; tmux `omo-elf-storybook`). Start it like any other service via devmux (`cd ~/src/ch5/palot && npx devmux ensure storybook`); do not run `cd packages/ui && bun run storybook` manually unless editing that service definition. Stories live in `packages/ui/src/stories/{foundations,ai-elements,animate}`; the React-Vite + `@tailwindcss/vite` config is `packages/ui/.storybook`. Stories render the CH5-owned upstream packages (`@ch5me/ch5-ui-web` + `@ch5me/agent-ui-web`) — this is the parity/visual surface for them. (The companion generic-UI Storybooks still live in `~/src/ch5/ch5-packages`: `pnpm run storybook` design-system on `10616`, `pnpm run storybook:fx` effects on `10617`.)
- **Session debug**: `bun run debug:sessions -- <session-id> [session-id...]`

- **Lint check**: `bun run lint` (from root)
- **Lint/format fix**: `bun run lint:fix` or `bunx biome check --write .` (from root)
- **Type check all**: `bun run check-types` (from root, via Turborepo)
- **Type check desktop**: `cd apps/desktop && bun run check-types` (uses `tsgo`)
- If a declared verify/build/test/typecheck command fails only because a prerequisite like `tsgo`, Bun types, generated `.d.ts`, or another expected tool is missing, fix that prerequisite before handoff. Broken verification plumbing is part of the task.
- **Run all tests**: `cd packages/configconv && bun test`
- **Run single test file**: `cd packages/configconv && bun test test/converter/config.test.ts`
- **Run tests by name**: `cd packages/configconv && bun test --grep "converts model"`
- **MCP connections proof**: `bun run generate:mcp-verification-fixture -- --scenario mixed --output /tmp/palot-mcp-mixed.json` then `bun test apps/desktop/src/main/mcp-connections-runtime.test.ts apps/desktop/src/renderer/lib/mcp-connections-verification.test.ts apps/desktop/src/renderer/lib/mcp-connections-verification-fixtures.test.ts apps/desktop/src/renderer/lib/mcp-connections-e2e.test.ts apps/desktop/.opencode/plugins/palot-bridge.test.js` then `bun run verify:mcp-connections -- --file /tmp/palot-mcp-mixed.json --require-gateway --require-cloud-restore` and `bun run verify:mcp-connections:e2e -- --file /tmp/palot-mcp-mixed.json`
- **Palot plugin implementation**: canonical source is `apps/desktop/src/main/palot-plugin/plugin.js`; `apps/desktop/.opencode/plugins/palot-bridge.js` is only a compatibility shim.
- **Rebuild server types**: `cd apps/server && bun run build:types` (required after adding server routes)
- **Add UI component**: add it to the upstream CH5 package (`ch5-packages/packages/web/ch5-ui-web` or `agent-ui-web`), then import directly via `@ch5me/ch5-ui-web` / `@ch5me/agent-ui-web`. Do NOT add components to `packages/ui` (`@ch5me/elf-ui`) — it is a Storybook/styles host only, with no local components, and `@ch5me/elf-ui/components/*` no longer resolves.
- **Package**: `cd apps/desktop && bun run package` (or `package:linux`, `package:mac`, `package:win`, `package:all`)
- **Package without code signing (macOS)**: `CSC_IDENTITY_AUTO_DISCOVERY=false cd apps/desktop && bun run package:mac`
- **Changeset -- add**: `bun changeset` (interactive -- pick packages, bump type, write description)
- **Changeset -- version**: `bun run version-packages` (applies pending changesets, bumps versions, updates changelogs)

## Code Style

### Formatting (enforced by Biome 2.3.14)

- Tabs for indentation (width 2), line width 100, LF line endings
- Double quotes, no semicolons, trailing commas everywhere
- Arrow functions always use parentheses: `(x) => x`
- Run `bunx biome check --write .` from root to auto-fix

### Imports

- `node:` protocol for all Node.js builtins: `import path from "node:path"`
- Use `import type { ... }` for type-only imports (Biome warns otherwise)
- Order: external packages first, then internal/relative imports (no blank line between)
- Main process: `node:` builtins first, then `electron`, then local
- Renderer: `@ch5me/ch5-ui-web` / `@ch5me/agent-ui-web` -> `@tanstack/*` -> `lucide-react` -> `react` -> local atoms/hooks/services

### Naming Conventions

- **Files**: `kebab-case.ts` / `kebab-case.tsx` everywhere
- **Functions/variables**: `camelCase` -- `createLogger()`, `fetchDiscovery()`
- **Components**: `PascalCase` -- `ChatView`, `AppSidebar`, `CommandPalette`
- **Types/interfaces**: `PascalCase` -- `DiscoveredProject`, `AgentStatus`
- **Props**: `ComponentNameProps` -- `ChatViewProps`, `AppSidebarProps`
- **Module-level constants**: `UPPER_SNAKE_CASE` -- `FRAME_BUDGET_MS`, `OPENCODE_PORT`
- **Jotai atoms**: `camelCaseAtom` -- `sessionIdsAtom`, `serverUrlAtom`
- **Atom families**: `camelCaseFamily` -- `sessionFamily`, `partsFamily`

### Types

- Prefer `interface` for object shapes, `type` for unions/aliases
- Export types only when used across modules
- Props: named interface for complex props, inline destructured type for small sub-components
- UI library uses `React.ComponentProps<"element">` intersection pattern for wrapper components

### React Patterns

- Functional components only, no class components
- State: **Jotai atoms** (NOT Zustand -- codebase has migrated). Store in `renderer/atoms/`
- Thin hook wrappers around atoms (e.g., `useAgents()` returns `useAtomValue(agentsAtom)`)
- Use `memo()` with named function expressions for perf-critical sub-components
- Custom hooks return objects, not arrays
- Named exports everywhere -- no default exports (except Hono route modules and Bun server entry)

### Error Handling

- No custom error classes -- use `new Error("descriptive message")`
- Services: try/catch, log with tagged logger, then rethrow
- Hooks: try/catch, set error state (`err instanceof Error ? err.message : "fallback"`)
- Main process IPC: wrap handlers with `withLogging()` for structured error logging
- Filesystem: check `(err as NodeJS.ErrnoException).code === "ENOENT"` for missing files
- Parallel IO: use `Promise.allSettled()` for resilient partial success
- SSE reconnect: exponential backoff loop capped at 30s

### Comments and File Organization

- Module-level `/** ... */` JSDoc at top of files for documentation
- `// ============================================================` section dividers for major sections
- `// ---` sub-section dividers within long functions
- File order: imports -> constants -> types -> state -> helpers -> public API/components -> sub-components

### Accessibility

- Always add `aria-hidden="true"` to decorative inline SVGs

## Critical Footguns

### Electron -- Two Runtime Contexts

The main process runs in Node.js, the renderer runs in a Chromium sandbox. They communicate via IPC only. Never import Node.js modules (`fs`, `child_process`, `path`) in the renderer -- use the `window.elf` bridge or `services/backend.ts` instead.

### Backend Service Layer -- `services/backend.ts`

All hooks must import from `services/backend.ts`, NOT from `services/elf-server.ts` directly. The backend module detects Electron (`"elf" in window`) and routes to IPC or HTTP automatically.

### Jotai + React 19

The codebase uses Jotai for state management. Derive data with `useMemo` from atom values -- do NOT create new objects inside selectors.

### Tailwind v4 Monorepo -- Missing Styles

`packages/ui/src/styles/globals.css` must `@source` the upstream package builds plus the local stories:

```css
@source "../stories";
@source "../../../../node_modules/@ch5me/ch5-ui-web/dist";
@source "../../../../node_modules/@ch5me/agent-ui-web/dist";
```

The components live in the sibling `ch5-packages` repo and Tailwind v4 auto-detection ignores `node_modules`, so without these explicit `@source` lines their utility classes (`bg-primary`, `h-9`, `px-4`, `inline-flex`, …) never generate and components render **unstyled** (transparent, no padding/height). The path is relative to the CSS file, so it works for every consumer (app + Storybook). Do NOT remove these lines. (The old `@source "../components"` is dead — that dir was deleted in the 2026-06-14 shim burn-down.)

### Biome -- CSS Disabled

Biome v2 cannot parse Tailwind v4 syntax. CSS linting/formatting is disabled. Do not try to enable it.

### Changesets -- versioning workflow

All five workspace packages are **linked** (version together). When making user-facing changes, run `bun changeset` before opening a PR.

### Packaging -- macOS without code signing

Always set `CSC_IDENTITY_AUTO_DISCOVERY=false` when building locally without an Apple Developer certificate.

### OpenCode SSE -- directory scoping

Use `/global/event` (not `/event`) to stream events from ALL projects. The SDK exposes this as `client.global.event()`.

### OpenCode SDK -- Always use v2 types

The `@opencode-ai/sdk` package ships both v1 and v2 type definitions. Always import from `@opencode-ai/sdk/v2/client` and check types under `dist/v2/gen/types.gen.d.ts` (NOT `dist/gen/types.gen.d.ts`). The v2 types are more complete (e.g., `session.create` accepts `permission?: PermissionRuleset`, `Permission` class has `respond`/`reply`/`list` methods). The v1 types are missing many fields and namespaces.

Always prefer re-using types from the SDK rather than defining local copies. The `@opencode-ai/sdk/v2/client` entry point re-exports all types from `gen/types.gen.js`, so types like `PermissionRuleset`, `PermissionRule`, `Session`, `Event`, etc. can be imported directly:

```ts
import type { PermissionRuleset, Session } from "@opencode-ai/sdk/v2/client"
```

### OpenCode model resolution

Always pass the resolved model to `promptAsync`. The server has no single "current model" concept.

### Server type regeneration (browser mode only)

When adding routes to `apps/server`, run `cd apps/server && bun run build:types` to regenerate `.d.ts` files. Without this, new routes won't have type inference in the frontend RPC client.

### Electron -- Preload Timing

The `window.elf` bridge is not available until the preload script finishes. Early-running renderer code (e.g., module-level calls, top-of-file side effects) must guard with optional chaining: `window.elf?.someMethod()`.

### Electron -- External Links

Never open external URLs inside the Electron window. Use `setWindowOpenHandler` in the main process to deny and redirect to `shell.openExternal()`. This prevents navigation to untrusted content inside the app.

### Elf storage -- XDG Base Directory

Elf follows the XDG Base Directory Specification (same convention as OpenCode). Config at `~/.config/elf/`, data at `~/.local/share/elf/`. Automation configs live at `~/.config/elf/automations/<id>/`, SQLite database at `~/.local/share/elf/elfdb`. See `main/automation/paths.ts` for the implementation. Do NOT use `~/.elf/` (legacy) or Electron's `userData` path for automation storage.

### electron-vite -- Three Build Targets

`electron.vite.config.ts` has three sections: `main`, `preload`, `renderer`. Main and preload use `externalizeDepsPlugin()` to keep Node.js deps external.

### OpenCode server modes (dev vs packaged)

`apps/server` selects the OpenCode lifecycle owner via `OPENCODE_MODE` (see `server-manager.ts`):

- **`external`** (dev, set by `devmux.config.json`): palot points at the shared OpenCode host on **127.0.0.1:4096** (supervised by process-compose `opencode-serve`, running the local dev build of opencode) and **never spawns** OpenCode. If the shared host is down, palot fails loud with `OpenCodeExternalServerMissingError` instead of respawning it out from under the supervisor. Active-session presence works in this mode because TUI clients attach to the same :4096 origin.
- **`managed`** (default; packaged/customer builds): palot spawns and owns `opencode serve` on `OPENCODE_PORT` (default 14096 — never 4096, reserved for the shared host). The binary is `OPENCODE_BIN` when set; otherwise `opencode` resolved with `~/.opencode/bin` first on PATH (the dev copy). Customer packaging must set `OPENCODE_BIN` to the bundled portable opencode binary (see the `portable-opencode` repo) — do not assume a global install on user machines. Cold start can take ~60s before `/session` responds; readiness waits up to 120s.

`opencode-manager.ts` (Electron desktop) has its own lifecycle with the same `OPENCODE_PORT` env override; devmux points it at :4096 in dev. It does not yet honor `OPENCODE_MODE` — port it to the same contract before shipping desktop builds that bundle portable opencode.

To connect a one-off desktop dev run to an existing server:
```bash
cd apps/desktop && OPENCODE_PORT=4096 node ../../node_modules/.bin/electron-vite dev
```

### Consuming CH5 UI from other repos

`@ch5me/elf-ui` is **internal-only** — it is NOT published to GitHub Packages (a `npm view` returns 404) and holds no components. After the 2026-06-14 burn-down, the shared UI lives in `@ch5me/ch5-ui-web` and `@ch5me/agent-ui-web` (in `ch5-packages`). External consumers (e.g. Firefly Cloud) should depend on **those** packages, not on elf-ui.

**Cross-repo React-dedup lesson (still load-bearing):** different physical copies of `react` / `@types/react` / `lucide-react` / `react-hook-form` across the bun(palot)↔pnpm(ch5-packages) boundary cause duplicate React instances (→ `useState`/`useEffect` errors in Electron) and break type assignability at the package seam. Pin identical exact versions in BOTH repos — palot via root `package.json` `overrides`, ch5-packages via `pnpm-workspace.yaml` `overrides:`. See `docs/ui-component-unification-audit.md` for the exact pins.

## Testing

- **Framework**: Bun's built-in test runner (`bun:test`) -- no vitest/jest/playwright
- **Tests exist only in `packages/configconv`** -- desktop app, server, and UI have no tests
- Tests are NOT run in CI (only lint, type-check, and build are)
- Run all: `cd packages/configconv && bun test`
- Run one file: `cd packages/configconv && bun test test/converter/mcp.test.ts`
- Run by name: `cd packages/configconv && bun test --grep "pattern"`

## @ch5me packages

`@ch5me/*` registry auth: `NPM_TOKEN` in repo Hush — run installs/publishes via `hush run --`. Doctrine: global skill `ch5me-npm-packages`.
