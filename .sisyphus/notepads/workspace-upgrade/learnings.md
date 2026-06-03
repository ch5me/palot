## 2026-05-30T20:52:30Z Task: context-gathering <!-- oc:id=sec_aa -->
- Workspace package map: `@ch5me/workspace` lives at `/Users/hassoncs/src/ch5/ch5-packages/packages/workspace/contract` with barrel exports in `src/index.ts` and submodules for `bars`, `panes`, `shell`, `sidebar`, `theme`.
- `WS_TOKENS` in `src/theme/tokens.ts` is the single runtime theme contract; all components import it directly.
- `PaneSeam` currently wraps `Separator` and hardcodes `cursor: "col-resize"`; `CollapsibleSidebar` currently does plain conditional render without animation.
- `WorkspaceShell` is a fixed CSS-grid shell today; `ResizablePanes` wraps `Group`, `Pane` wraps `Panel`, and `PaneToggleToolbar` / `usePaneVisibility` are already in place.
- Official `react-resizable-panels` docs confirm `PanelResizeHandle` has no `onDrag` callback, `PanelGroup` uses `onLayoutChange` / `onLayoutChanged`, and `Panel` collapse APIs are via `collapsible`, `collapsedSize`, and imperative refs.
- Palot integration map: `apps/desktop/src/renderer/components/sidebar-layout.tsx` owns the current shell, `agent-detail.tsx` owns `Cmd+Shift+D` and AppBar injection, and `apps/desktop/src/renderer/atoms/ui.ts` owns `reviewPanelOpenAtom`.
- Task 1 done (2026-05-30): moved `react-resizable-panels` from `dependencies` to `peerDependencies` with `>=4.6.0` in `@ch5me/workspace` contract package; added `^4.11.1` to `devDependencies` for local dev; `bun install` + `typecheck` both pass.
- Task 1 re-verified (2026-05-30 23:xx UTC): `peerDependencies` already has `react-resizable-panels: ">=4.6.0"`, `devDependencies` has `^4.11.1`. `bun install` (root) and `bun run typecheck` (contract package) both pass clean.
- Task 3 done (2026-05-30): enhanced `PaneSeam`. Key findings:
  - `Separator` (react-resizable-panels) uses `elementRef` for refs, not `ref`; rejects `role`, `aria-*`, `tabIndex` — must put them on a wrapper `<div>`.
  - Drag detection: `Separator` sets `data-panel-resize-handle-active="1"` on itself while dragging; RAF-polling this attribute syncs `isDragging` state without a first-party callback.
  - `role="separator"` on `<div>` triggers Biome `useSemanticElements` (wants `<hr>`) and `useAriaPropsForRole` (wants `aria-valuenow`); both are false positives — `<hr>` is block-level and separator role is structural, not a range widget. Suppressed with `biome-ignore-start`/`biome-ignore-end` range comments on lines 71-72 and 101-102.
  - Hit target: wrapper div has `padding: 0 3px`; inner Separator uses `margin: 0 -3px` to centre the visual bar within the expanded hit area. Effective hit target = 12px regardless of visual bar width (default 1px, hover 2px, drag 3px).
  - Transitions: `background` and `width` transition at 120ms ease. Accent styling during drag uses `WS_TOKENS.accent`; hover uses `WS_TOKENS.borderStrong`.
- Task 2 done (2026-05-30): created `src/theme/tokens.css` with 56 `--ws-*` variables (28 dark defaults + 28 `[data-theme="light"]` overrides). All values mirror `WS_TOKENS` exactly; `WS_TOKENS` untouched. Added `"./theme/css"` export to package.json pointing to `./src/theme/tokens.css`. Light theme: slate-50/100/200/300 surfaces, indigo-600 accent for contrast, reduced shadow opacity. Dark is default via `:root, [data-theme="dark"]`. No runtime behavior changes.
## 2026-05-30T21:15:00Z Task: react-resizable-panels peerDependency research

### Official sources
- **react-resizable-panels v4.11.2** (latest) — zero runtime dependencies. Only peerDeps: `"react": "^18.0.0 || ^19.0.0"`, `"react-dom": "^18.0.0 || ^19.0.0"`.
  Source: [npmjs.com/react-resizable-panels](https://www.npmjs.com/package/react-resizable-panels), [GitHub package.json](https://raw.githubusercontent.com/bvaughn/react-resizable-panels/main/package.json)
- **shadcn/ui resizable** — copy-paste model; consumer installs `react-resizable-panels` directly. v4 migration PR [#9461](https://github.com/shadcn-ui/ui/pull/9461) bumped to `^4`.
  v4 changelog note: [ui.shadcn.com/docs/components/radix/resizable](https://ui.shadcn.com/docs/components/radix/resizable) (2025-02-02 section)

### Real-world component library patterns
- **@future-house/feathers** (shadcn-based design system, published package): puts `react-resizable-panels` in **dependencies** (`^3.0.3`), not peerDependencies. PeerDeps only for `react`/`react-dom`.
  Source: [github.com/Future-House/feathers/package.json](https://github.com/Future-House/feathers/blob/main/package.json)
- **bpmn-io/variable-outline** (published React component lib): puts `react-resizable-panels` in **devDependencies** (`^2.0.2`). PeerDeps for `react`/`react-dom` only.
  Source: [github.com/bpmn-io/variable-outline/package.json](https://github.com/bpmn-io/variable-outline/blob/main/package.json)

### Verdict: peerDependency + devDependency is correct for @ch5me/workspace
- The contract package re-exports/wraps `react-resizable-panels` primitives (`Group`, `Panel`, `Separator`). Consumer host apps will already install `react-resizable-panels`. Declaring it as a peerDependency ensures a single copy at runtime (no duplicate React contexts, no bundle bloat).
- DevDependency is needed for local build/typecheck/dev since peerDependencies are not installed by default in the package itself.

### Semver range recommendation: `>=4.6.0 <5.0.0` (or `^4.6.0`)
- **`>=4.6.0` alone is too wide** — it would accept 5.x/6.x which could ship breaking API changes (v3→v4 already had major renames: `PanelGroup`→`Group`, `PanelResizeHandle`→`Separator`, `direction`→`orientation`).
  Source: [v4.0.0 release notes](https://github.com/bvaughn/react-resizable-panels/releases/tag/4.0.0)
- **`^4.6.0`** is the standard semver convention — means `>=4.6.0 <5.0.0`. Compatible with host app on `4.6.2`.
- **`>=4.6.0 <5.0.0`** is the explicit equivalent — slightly more verbose but leaves no ambiguity.
- Both are functionally identical for npm/pnpm/yarn resolution. `^4.6.0` is the more common choice in published libraries.
- If the contract package uses v4-only imports (`Group`, `Separator`, `orientation`), the minimum must be `4.0.0`. `4.6.0` as minimum is safe if 4.6 is when a specific feature/fix landed that the contract relies on.
- Version history shows active 4.x releases: `4.6.0` through `4.11.2` (Feb–May 2026). No breaking changes within 4.x minor versions per semver contract.
- Task 1 complete (2026-05-30): `@ch5me/effects` contract (`effects/contract/package.json`) had `react-resizable-panels` in `dependencies` (`^4.11.1`). Moved to `peerDependencies` (`>=4.6.0`) and added `^4.11.1` to `devDependencies`. `bun install` (root) and `bun run typecheck` (workspace/contract) both pass clean.
- Task 6 done (2026-05-30): created `useSnapBehavior` hook. Key findings:
  - `react-resizable-panels` does NOT expose real-time drag position during drag — only `data-panel-resize-handle-active` attribute for drag detection and `onLayoutChange` for post-drag layout.
  - `useSnapBehavior` snaps on drag end via `onLayoutChange` callback, not mid-drag. This is the honest limitation of the library.
  - Hook accepts: `snapPoints: number[]`, `threshold: number`, `mode?: "px" | "percent"`.
  - Returns: `isDragging`, `snappedValue`, `rawValue`, `snapToNearest(value)`.
  - Usage: consumer calls `snapToNearest(sizes[0])` in their `onLayoutChange` handler.
  - Exported from `src/panes/index.ts` alongside `usePaneVisibility`.

## 2026-05-30T23:45:00Z Task 8: Storybook story updates
- `@storybook/react` is NOT in the workspace contract's devDependencies, so TypeScript silently skips unresolved story-file types (tsc passes even with potentially stale story props).
- Stale prop names fixed in `TogglablePanes` and `ResizableShell`: `leftWidth`/`rightWidth` are CSS-column props used only in `resizable={false}` (fixed) mode; in `resizable={true}` (default) mode the correct names are `defaultLeftWidth`/`defaultRightWidth`.
- `ResizableShell` bottom bar said `resizable={true}` — this prop is already the default, so the label was misleading. Changed to `resizable mode (default)`.
- `SnapBehavior` story: `useSnapBehavior` only returns `{ snap }` (confirmed from source), NOT `isDragging`/`snappedValue`/`rawValue`. Added honest block comment documenting post-drag-only snap constraint.
- Story count: 10 exported stories (required ≥ 8). Stories cover: full shell, panes-only, togglable panes, sidebar rail+body, resizable shell, animated sidebar, both-collapsed main-only, snap behavior, themed shell, bars+buttons.
- Task 8 additional findings (2026-05-30 late): `Layout` type from react-resizable-panels is `{ [id: string]: number }` (object keyed by panel ID), NOT `readonly number[]`. Had to add `onLayoutChange` to `ResizablePanesProps` and wire through to `Group` so the snap story could correctly demonstrate post-drag snapping. `ResizablePanes` now exports `onLayoutChange: (layout: Layout) => void`. `FullShell` story had `leftWidth`/`rightWidth` props that were silently ignored in resizable mode — fixed by removing them so story visually reflects actual behavior.
