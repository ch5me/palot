# Upgrade @ch5me/workspace + Integrate into Palot <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Upgrade the shared `@ch5me/workspace` package to support resizable animated three-column layouts with drag seams, collapsible side panels, and Tailwind-compatible theming. Then integrate it into Palot to replace the fixed-width sidebar layout with a Codex-style workspace.
> 
> **Deliverables**:
> - Upgraded `@ch5me/workspace` package with resizable shell, animated collapse, enhanced seams, snap sizes, CSS variable theming
> - Updated Storybook stories demonstrating all new behaviors
> - Palot integration: three-column workspace replacing `SidebarLayout`
> 
> **Estimated Effort**: Medium-Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Package API design → Shell refactor → Palot integration → Final verification

---

## Context

### Original Request
Replace Palot's fixed-width sidebar layout with a Codex-style three-column resizable workspace. Upgrade the shared `@ch5me/workspace` package (in `ch5-packages/`) to support: resizable left/center/right columns with drag seams, animated collapse/expand for side panels, generic pane toggle toolbar, configurable default/snap sizes, and Tailwind-compatible CSS variable theming. Then integrate into Palot, keeping all inner content untouched.

### Interview Summary
**Key Discussions**:
- User wants to refine the shared package, not work around it
- All columns should be resizable with draggable seams
- Side panels should animate in/out on collapse/expand
- Generic toolbar for toggling panel visibility
- Snap sizes for left/right columns
- Theme via CSS variables bridge to Tailwind
- Inner content (ChatView, AppSidebar, ReviewPanel) stays untouched

**Research Findings**:
- `@ch5me/workspace` already has `ResizablePanes`, `Pane`, `PaneSeam`, `PaneToggleToolbar`, `usePaneVisibility`, `WorkspaceShell`, `CollapsibleSidebar`
- All built on `react-resizable-panels` (v4.11.1 in workspace, v4.6.2 in Palot)
- `WorkspaceShell` uses fixed-width CSS Grid columns — not resizable
- `CollapsibleSidebar` has no animation on collapse
- `PaneSeam` is basic (6px, col-resize cursor, no hover states)
- All workspace styling is inline via `WS_TOKENS` CSS variables
- Palot already has `react-resizable-panels` with shadcn wrappers

### Metis Review
**Identified Gaps** (addressed):
- Controlled vs uncontrolled API → Default: workspace components are controlled (consumer owns state via props)
- State ownership → Palot Jotai atoms drive visibility; workspace is pure presentation
- Collapse semantics → Left/right collapse to 0 width (hidden); left can optionally show rail (48px)
- Snap sizes → Configurable via prop array; sensible defaults (240/320/400px for left, 320/400/500px for right)
- CSS variable bridge → Explicit mapping file from `--ws-*` to Palot `--background`/`--border`/etc.
- Version alignment → Move `react-resizable-panels` to peerDependencies in workspace package
- Edge cases → Both panels collapsed, near-min width, rapid toggle during resize

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Produce a production-ready `@ch5me/workspace` package with resizable animated three-column layout, then swap it into Palot's layout shell without touching inner content components.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- `ch5-packages/packages/workspace/contract/src/shell/WorkspaceShell.tsx` — Resizable left/right columns
- `ch5-packages/packages/workspace/contract/src/panes/PaneSeam.tsx` — Enhanced with hover/drag states
- `ch5-packages/packages/workspace/contract/src/sidebar/CollapsibleSidebar.tsx` — Animated collapse
- `ch5-packages/packages/workspace/contract/src/panes/ResizablePanes.tsx` — Snap size support
- `ch5-packages/packages/workspace/contract/src/theme/tokens.css` — CSS variable bridge file
- `ch5-packages/packages/workspace/contract/src/Workspace.stories.tsx` — Updated stories
- `palot/apps/desktop/src/renderer/components/sidebar-layout.tsx` — Integrated workspace layout
- `palot/apps/desktop/src/renderer/styles/workspace.css` — Palot theme bridge

### Definition of Done <!-- oc:id=sec_af -->
- [ ] `cd ch5-packages/packages/workspace/contract && bun run typecheck` passes
- [ ] `cd palot && bun run check-types` passes
- [ ] `cd palot && bun run lint` passes
- [ ] Storybook renders all 5+ workspace stories correctly
- [ ] Palot renders with resizable three-column layout

### Must Have <!-- oc:id=sec_ag -->
- Resizable left and right columns via drag seams
- Animated collapse/expand on side panels (CSS transitions, 200ms ease-in-out)
- Generic `PaneToggleToolbar` for panel visibility
- CSS variable theming (`--ws-*`) bridgeable to Tailwind
- Controlled API: consumer owns pane sizes/visibility via props
- Default sizes, min/max sizes, and snap size arrays for each column
- Updated Storybook stories

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- NO business logic changes in ChatView, AppSidebar, ReviewPanel, or PromptToolbar
- NO redesign of AppBar injection architecture
- NO new global state atoms beyond what's needed for panel toggle integration
- NO persistence of layout widths across app restarts (future feature)
- NO mobile/responsive redesign
- NO new animation libraries (CSS transitions only)
- NO changes to routing or data flow
- NO rewrite of shadcn sidebar provider/state
- NO Palot-specific code in the `@ch5me/workspace` package

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (workspace package has no test runner, only Storybook)
- **Automated tests**: None — visual verification via Storybook + typecheck/lint
- **Framework**: Typecheck via `tsc --noEmit`, lint via Biome

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Package changes**: Typecheck + Storybook build + visual check via screenshots
- **Palot integration**: Typecheck + lint + desktop dev server + Playwright screenshots

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Parallel Execution Waves <!-- oc:id=sec_aj -->

```
Wave 1 (Start Immediately — workspace package foundation):
├── Task 1: Align react-resizable-panels version + peer dep [quick]
├── Task 2: Define CSS variable theming contract + bridge file [quick]
├── Task 3: Enhance PaneSeam with hover/drag states [quick]
└── Task 4: Add animated collapse to CollapsibleSidebar [quick]

Wave 2 (After Wave 1 — workspace shell + stories):
├── Task 5: Refactor WorkspaceShell for resizable columns (depends: 1, 3) [deep]
├── Task 6: Add snap size support to ResizablePanes (depends: 1) [quick]
├── Task 7: Refine PaneToggleToolbar for theme bridge (depends: 2) [quick]
└── Task 8: Update Storybook stories (depends: 3, 4, 5, 6, 7) [unspecified-high]

Wave 3 (After Wave 2 — Palot integration):
├── Task 9: Add @ch5me/workspace dep to Palot + theme bridge CSS (depends: 2) [quick]
├── Task 10: Replace SidebarLayout with workspace components (depends: 5, 9) [deep]
├── Task 11: Wire panel toggle atoms + keyboard shortcuts (depends: 10) [quick]
└── Task 12: Final build verification + visual QA (depends: 10, 11) [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix <!-- oc:id=sec_ak -->

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 5, 6 |
| 2 | — | 7, 9 |
| 3 | — | 5, 8 |
| 4 | — | 8 |
| 5 | 1, 3 | 8, 10 |
| 6 | 1 | 8 |
| 7 | 2 | 8 |
| 8 | 3, 4, 5, 6, 7 | 12 |
| 9 | 2 | 10 |
| 10 | 5, 9 | 11, 12 |
| 11 | 10 | 12 |
| 12 | 8, 10, 11 | F1-F4 |

### Agent Dispatch Summary <!-- oc:id=sec_al -->

- **Wave 1**: 4 tasks — T1-T4 → `quick`
- **Wave 2**: 4 tasks — T5 → `deep`, T6 → `quick`, T7 → `quick`, T8 → `unspecified-high`
- **Wave 3**: 4 tasks — T9 → `quick`, T10 → `deep`, T11 → `quick`, T12 → `unspecified-high`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Align react-resizable-panels version + move to peer dep

  **What to do**:
  - Read `ch5-packages/packages/workspace/contract/package.json`
  - Move `react-resizable-panels` from `dependencies` to `peerDependencies`
  - Set peer range to `">=4.6.0"` (compatible with Palot's v4.6.2)
  - Add `react-resizable-panels` to `devDependencies` for local development
  - Run `bun install` from `ch5-packages/` root to update lockfile
  - Verify typecheck passes in workspace package

  **Must NOT do**:
  - Do not change any component code in this task
  - Do not upgrade react-resizable-panels beyond 4.x

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`caveman`]
    - `caveman`: Simple file edits, no complex reasoning needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `ch5-packages/packages/workspace/contract/package.json` — Current dep structure, move react-resizable-panels to peerDeps

  **API/Type References**:
  - `ch5-packages/packages/workspace/contract/src/panes/ResizablePanes.tsx:1` — Imports from react-resizable-panels

  **Acceptance Criteria**:
  - [ ] `react-resizable-panels` is in `peerDependencies` with range `">=4.6.0"`
  - [ ] `react-resizable-panels` is in `devDependencies` for local dev
  - [ ] `cd ch5-packages/packages/workspace/contract && bun run typecheck` exits 0

  **QA Scenarios**:
  ```
  Scenario: Package installs correctly with peer dep
    Tool: Bash
    Steps:
      1. cd /Users/hassoncs/src/ch5/ch5-packages && bun install
      2. cd packages/workspace/contract && bun run typecheck
    Expected Result: Both commands exit 0 with no errors
    Failure Indicators: Non-zero exit code or TypeScript errors
    Evidence: .sisyphus/evidence/task-1-peer-dep-check.txt

  Scenario: react-resizable-panels types resolve correctly
    Tool: Bash
    Steps:
      1. cd /Users/hassoncs/src/ch5/ch5-packages/packages/workspace/contract
      2. grep "react-resizable-panels" node_modules/.package-lock.json || ls node_modules/react-resizable-panels/dist/index.d.ts
    Expected Result: Module exists and types are accessible
    Evidence: .sisyphus/evidence/task-1-type-resolution.txt
  ```

  **Commit**: YES
  - Message: `chore(workspace): move react-resizable-panels to peerDependencies`
  - Files: `packages/workspace/contract/package.json`

- [x] 2. Define CSS variable theming contract + bridge file

  **What to do**:
  - Read existing `ch5-packages/packages/workspace/contract/src/theme/tokens.ts`
  - Create `ch5-packages/packages/workspace/contract/src/theme/tokens.css` with `:root` defaults for all `--ws-*` variables
  - Add a new export `./theme/css` in the package.json exports map pointing to the CSS file
  - Document each variable with its purpose and Tailwind equivalent
  - Ensure all existing `WS_TOKENS` references in the codebase still work (they already use `var(--ws-*, fallback)`)

  **Must NOT do**:
  - Do not change the TypeScript `WS_TOKENS` object (it's the runtime API)
  - Do not add Tailwind as a dependency to the workspace package

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`caveman`]
    - `caveman`: Straightforward CSS file creation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 7, 9
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `ch5-packages/packages/workspace/contract/src/theme/tokens.ts` — All CSS variable names and their fallback values

  **External References**:
  - shadcn/ui CSS variable naming: `--background`, `--foreground`, `--card`, `--border`, `--muted`, `--primary` — the target variables Palot uses

  **Acceptance Criteria**:
  - [ ] `tokens.css` file exists with all `--ws-*` variables defined in `:root`
  - [ ] CSS file includes light and dark theme variants
  - [ ] Package.json exports map includes `./theme/css`
  - [ ] All variables documented with comments

  **QA Scenarios**:
  ```
  Scenario: CSS file is valid and loads
    Tool: Bash
    Steps:
      1. cd /Users/hassoncs/src/ch5/ch5-packages/packages/workspace/contract
      2. cat src/theme/tokens.css | head -5
      3. Verify :root selector present
    Expected Result: File starts with :root { --ws-bg: ... }
    Evidence: .sisyphus/evidence/task-2-css-valid.txt

  Scenario: Export map includes CSS entry
    Tool: Bash
    Steps:
      1. cd /Users/hassoncs/src/ch5/ch5-packages/packages/workspace/contract
      2. cat package.json | grep "theme/css"
    Expected Result: Output contains "./theme/css" export entry
    Evidence: .sisyphus/evidence/task-2-export-map.txt
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `feat(workspace): add CSS variable theming contract`
  - Files: `src/theme/tokens.css`, `package.json`

- [x] 3. Enhance PaneSeam with hover/drag visual feedback

  **What to do**:
  - Read `ch5-packages/packages/workspace/contract/src/panes/PaneSeam.tsx`
  - Add hover state: thicker (2px) and lighter background color on mouse enter/leave
  - Add dragging state: accent color + even thicker (3px) while dragging
  - Use `useState` for hover tracking, `react-resizable-panels` `onDragging` prop for drag state
  - Add CSS transition for smooth size/color changes (120ms ease)
  - Increase hit target: keep visual width at 1-2px but add invisible padding via `::before` or padding for easier grab
  - Add `aria-label="Resize"` for accessibility
  - Add `role="separator"` attribute

  **Must NOT do**:
  - Do not add new npm dependencies (CSS transitions only)
  - Do not change the `ResizablePanes` or `Pane` components

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`caveman`]
    - `caveman`: Small focused component enhancement

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 5, 8
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `ch5-packages/packages/workspace/contract/src/panes/PaneSeam.tsx` — Current implementation (26 lines)
  - `ch5-packages/packages/workspace/contract/src/theme/tokens.ts` — WS_TOKENS for border/accent colors

  **External References**:
  - `react-resizable-panels` Separator props: `onDragging`, `onDrag` for drag state callbacks

  **Acceptance Criteria**:
  - [ ] Seam thickens on hover (visual width increases)
  - [ ] Seam changes color on drag (accent color)
  - [ ] Transitions are smooth (CSS transition 120ms)
  - [ ] Hit target is at least 12px wide for easy grabbing
  - [ ] Has `role="separator"` and `aria-label`

  **QA Scenarios**:
  ```
  Scenario: PaneSeam renders with accessible attributes
    Tool: Bash
    Steps:
      1. cd /Users/hassoncs/src/ch5/ch5-packages/packages/workspace/contract
      2. bun run typecheck
      3. grep -c 'role="separator"' src/panes/PaneSeam.tsx || echo "Check component"
    Expected Result: Typecheck passes, separator role present in source
    Evidence: .sisyphus/evidence/task-3-seam-a11y.txt

  Scenario: PaneSeam has transition styles
    Tool: Bash
    Steps:
      1. grep "transition" src/panes/PaneSeam.tsx
    Expected Result: CSS transition property present in component
    Evidence: .sisyphus/evidence/task-3-seam-transition.txt
  ```

  **Commit**: YES (groups with Tasks 1-2)
  - Message: `feat(workspace): enhance PaneSeam with hover/drag states`
  - Files: `src/panes/PaneSeam.tsx`

- [x] 4. Add animated collapse/expand to CollapsibleSidebar

  **What to do**:
  - Read `ch5-packages/packages/workspace/contract/src/sidebar/CollapsibleSidebar.tsx`
  - Add CSS `transition` on the body container: `transition: min-width 200ms ease-in-out, opacity 150ms ease-in-out`
  - When collapsing: animate `min-width` from `bodyWidth` to `0`, fade `opacity` to `0` at 150ms
  - When expanding: animate `min-width` from `0` to `bodyWidth`, fade `opacity` from `0` to `1` starting at 50ms
  - Use `overflow: hidden` on the body container to clip content during animation
  - Add `aria-expanded` attribute on the sidebar container
  - Add `aria-hidden` on the body when collapsed

  **Must NOT do**:
  - Do not add framer-motion or any animation library
  - Do not change the `SidebarRail` or `Bar` components
  - Do not change the `collapsed` prop semantics

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`caveman`]
    - `caveman`: Small CSS transition addition

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Task 8
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `ch5-packages/packages/workspace/contract/src/sidebar/CollapsibleSidebar.tsx` — Current implementation (56 lines)
  - Palot's review panel animation: `palot/apps/desktop/src/renderer/components/agent-detail.tsx:302` — `transition-[width] duration-250 ease-in-out` pattern

  **Acceptance Criteria**:
  - [ ] Sidebar body animates width on collapse/expand (200ms ease-in-out)
  - [ ] Content fades during collapse (opacity transition)
  - [ ] `overflow: hidden` clips content during animation
  - [ ] `aria-expanded` attribute on container
  - [ ] `aria-hidden` on body when collapsed

  **QA Scenarios**:
  ```
  Scenario: CollapsibleSidebar typechecks with transitions
    Tool: Bash
    Steps:
      1. cd /Users/hassoncs/src/ch5/ch5-packages/packages/workspace/contract
      2. bun run typecheck
    Expected Result: Exit 0, no TypeScript errors
    Evidence: .sisyphus/evidence/task-4-sidebar-typecheck.txt

  Scenario: Transition CSS is present in component
    Tool: Bash
    Steps:
      1. grep "transition" src/sidebar/CollapsibleSidebar.tsx
      2. grep "aria-expanded" src/sidebar/CollapsibleSidebar.tsx
    Expected Result: Both strings found in source
    Evidence: .sisyphus/evidence/task-4-sidebar-transition.txt
  ```

  **Commit**: YES (groups with Tasks 1-3)
  - Message: `feat(workspace): add animated collapse to CollapsibleSidebar`
  - Files: `src/sidebar/CollapsibleSidebar.tsx`

- [x] 5. Refactor WorkspaceShell for resizable left/right columns

  **What to do**:
  - Read `ch5-packages/packages/workspace/contract/src/shell/WorkspaceShell.tsx`
  - Replace the fixed CSS Grid columns with an internal `ResizablePanes` composition when `resizable` prop is true
  - New props to add:
    - `resizable?: boolean` (default `true`)
    - `minLeftWidth?: number | string` (default `"15%"`)
    - `maxLeftWidth?: number | string` (default `"40%"`)
    - `minRightWidth?: number | string` (default `"15%"`)
    - `maxRightWidth?: number | string` (default `"40%"`)
    - `defaultLeftWidth?: number | string` (default `260`)
    - `defaultRightWidth?: number | string` (default `320`)
    - `snapPoints?: { left?: number[], right?: number[] }` — array of pixel values to snap to during drag
    - `onLeftWidthChange?: (width: number) => void`
    - `onRightWidthChange?: (width: number) => void`
  - When `resizable=false`, keep the existing fixed CSS Grid behavior (backward compatible)
  - When `resizable=true` (default), render:
    ```
    ┌── top ──────────────────────┐
    ├── toolbar ──────────────────┤
    │ [Left] [Seam] [Center] [Seam] [Right] │  ← ResizablePanes
    ├── bottom ───────────────────┤
    ```
  - When `left` or `right` is not provided, omit that pane and its seam
  - Ensure `min-w-0` and `overflow: hidden` on all pane containers to prevent content blowout
  - Keep the CSS Grid for top/toolbar/bottom rows (they span full width)

  **Must NOT do**:
  - Do not change the `Bar`, `PaneToggleToolbar`, or `IconButton` components
  - Do not add new dependencies
  - Do not make the shell aware of specific content (AppSidebar, ChatView, etc.)
  - Do not break the existing fixed-width `resizable=false` path

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`caveman`]
    - `caveman`: Complex layout refactor requiring careful prop design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7)
  - **Blocks**: Tasks 8, 10
  - **Blocked By**: Tasks 1, 3

  **References**:
  **Pattern References**:
  - `ch5-packages/packages/workspace/contract/src/shell/WorkspaceShell.tsx` — Current implementation (96 lines), CSS Grid layout
  - `ch5-packages/packages/workspace/contract/src/panes/ResizablePanes.tsx` — Re-export of Group
  - `ch5-packages/packages/workspace/contract/src/panes/PaneSeam.tsx` — Enhanced in Task 3
  - `ch5-packages/packages/workspace/contract/src/panes/Pane.tsx` — Re-export of Panel

  **API/Type References**:
  - `react-resizable-panels` Group props: `direction`, `onLayout` for size change callbacks
  - `react-resizable-panels` Panel props: `defaultSize`, `minSize`, `maxSize`, `collapsible`, `collapsedSize`

  **Acceptance Criteria**:
  - [ ] `resizable` prop defaults to `true`
  - [ ] When `resizable=true`, left/center/right are inside `ResizablePanes` with `PaneSeam` between them
  - [ ] When `left` or `right` is omitted, that pane and its seam are not rendered
  - [ ] `minLeftWidth`/`maxLeftWidth`/`minRightWidth`/`maxRightWidth` props are respected
  - [ ] `onLeftWidthChange`/`onRightWidthChange` callbacks fire during resize
  - [ ] `resizable=false` preserves original fixed CSS Grid behavior
  - [ ] All pane containers have `min-w-0 overflow-hidden`
  - [ ] `cd ch5-packages/packages/workspace/contract && bun run typecheck` passes

  **QA Scenarios**:
  ```
  Scenario: WorkspaceShell renders with resizable columns
    Tool: Bash
    Steps:
      1. cd /Users/hassoncs/src/ch5/ch5-packages/packages/workspace/contract
      2. bun run typecheck
      3. grep -c "ResizablePanes" src/shell/WorkspaceShell.tsx
    Expected Result: Typecheck passes, ResizablePanes is imported and used in shell
    Evidence: .sisyphus/evidence/task-5-shell-typecheck.txt

  Scenario: Backward compatibility — resizable=false path
    Tool: Bash
    Steps:
      1. grep -c "resizable" src/shell/WorkspaceShell.tsx
      2. grep "gridTemplateColumns" src/shell/WorkspaceShell.tsx
    Expected Result: Both resizable conditional and gridTemplateColumns exist (backward compat)
    Evidence: .sisyphus/evidence/task-5-shell-compat.txt

  Scenario: Snap points prop is accepted
    Tool: Bash
    Steps:
      1. grep "snapPoints" src/shell/WorkspaceShell.tsx
    Expected Result: snapPoints prop defined in type and referenced in implementation
    Evidence: .sisyphus/evidence/task-5-shell-snap.txt
  ```

  **Commit**: YES
  - Message: `feat(workspace): resizable columns in WorkspaceShell`
  - Files: `src/shell/WorkspaceShell.tsx`

- [x] 6. Add snap size support to ResizablePanes

  **What to do**:
  - Read `ch5-packages/packages/workspace/contract/src/panes/ResizablePanes.tsx`
  - Add a `useSnapBehavior` hook in a new file `src/panes/useSnapBehavior.ts`:
    - Takes: `snapPoints: number[]` (pixel values), `threshold: number` (default 15px — how close to snap)
    - Returns: a function that intercepts drag events and snaps to nearest point when within threshold
  - Integrate with `PaneSeam`'s `onDrag` callback to apply snap behavior
  - Export the hook from `src/panes/index.ts`
  - Update `ResizablePanes` to accept optional `snapPoints` prop per pane

  **Must NOT do**:
  - Do not modify react-resizable-panels source
  - Do not add new npm dependencies
  - Make snap behavior opt-in (no snap when snapPoints not provided)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`caveman`]
    - `caveman`: Small utility hook, clear scope

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7)
  - **Blocks**: Task 8
  - **Blocked By**: Task 1

  **References**:
  **Pattern References**:
  - `ch5-packages/packages/workspace/contract/src/panes/ResizablePanes.tsx` — Current Group wrapper
  - `ch5-packages/packages/workspace/contract/src/panes/usePaneVisibility.ts` — Existing hook pattern in the panes module

  **API/Type References**:
  - `react-resizable-panels` Separator `onDrag` callback: `(event: PointerEvent, direction: 'left' | 'right') => void`

  **Acceptance Criteria**:
  - [ ] `useSnapBehavior` hook file exists with correct types
  - [ ] Hook returns a snap function that rounds to nearest snap point within threshold
  - [ ] Exported from `src/panes/index.ts`
  - [ ] Typecheck passes

  **QA Scenarios**:
  ```
  Scenario: useSnapBehavior hook typechecks
    Tool: Bash
    Steps:
      1. cd /Users/hassoncs/src/ch5/ch5-packages/packages/workspace/contract
      2. bun run typecheck
      3. grep "useSnapBehavior" src/panes/index.ts
    Expected Result: Typecheck passes, hook is exported
    Evidence: .sisyphus/evidence/task-6-snap-typecheck.txt
  ```

  **Commit**: YES (groups with Tasks 5, 7)
  - Message: `feat(workspace): add snap size behavior hook`
  - Files: `src/panes/useSnapBehavior.ts`, `src/panes/index.ts`

- [x] 7. Refine PaneToggleToolbar for theme bridge

  **What to do**:
  - Read `ch5-packages/packages/workspace/contract/src/bars/PaneToggleToolbar.tsx` (actually in `src/panes/PaneToggleToolbar.tsx`)
  - Replace hardcoded inline styles with CSS variable references from `WS_TOKENS` where not already done
  - Add `className` prop passthrough to the container div
  - Add `buttonClassName` prop for custom button styling
  - Ensure active/inactive button states use `--ws-accent-bg`, `--ws-accent-border`, `--ws-accent-text` variables
  - Verify all color references use CSS variables (no hardcoded hex)

  **Must NOT do**:
  - Do not add Tailwind class names to the component itself
  - Do not change the component's API shape (only add optional props)
  - Do not change `IconButton` or `Bar`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`caveman`]
    - `caveman`: Style variable replacement

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 2

  **References**:
  **Pattern References**:
  - `ch5-packages/packages/workspace/contract/src/panes/PaneToggleToolbar.tsx` — Current implementation (91 lines), mostly inline styles
  - `ch5-packages/packages/workspace/contract/src/theme/tokens.ts` — All available CSS variables

  **Acceptance Criteria**:
  - [ ] `className` prop accepted and applied to container
  - [ ] All colors reference `WS_TOKENS` / CSS variables (no hardcoded hex outside WS_TOKENS)
  - [ ] Active/inactive button states use accent variables
  - [ ] Typecheck passes

  **QA Scenarios**:
  ```
  Scenario: PaneToggleToolbar accepts className
    Tool: Bash
    Steps:
      1. grep "className" ch5-packages/packages/workspace/contract/src/panes/PaneToggleToolbar.tsx
    Expected Result: className prop in type definition and applied to div
    Evidence: .sisyphus/evidence/task-7-toolbar-classname.txt

  Scenario: No hardcoded colors
    Tool: Bash
    Steps:
      1. grep -cE '#[0-9a-fA-F]{3,8}' ch5-packages/packages/workspace/contract/src/panes/PaneToggleToolbar.tsx
    Expected Result: 0 hardcoded hex colors (all via WS_TOKENS)
    Evidence: .sisyphus/evidence/task-7-toolbar-no-hex.txt
  ```

  **Commit**: YES (groups with Tasks 5-6)
  - Message: `feat(workspace): theme-bridge PaneToggleToolbar`
  - Files: `src/panes/PaneToggleToolbar.tsx`

- [x] 8. Update Storybook stories for all new behaviors

  **What to do**:
  - Read `ch5-packages/packages/workspace/contract/src/Workspace.stories.tsx`
  - Update existing stories to use new props (resizable, snap points, animated collapse)
  - Add new stories:
    1. **Resizable Shell** — `WorkspaceShell` with `resizable=true`, drag seams between left/main/right
    1. **Animated Sidebar** — `CollapsibleSidebar` with toggle button, animated collapse/expand
    1. **Snap Behavior** — `ResizablePanes` with snap points, show snapping to predefined sizes
    1. **Both Panels Collapsed** — Shell with both side panels collapsed, center takes full width
    1. **Themed Shell** — Shell with CSS variable overrides for light theme
  - Update the existing `TogglablePanes` story to use the new `WorkspaceShell` resizable mode
  - Verify all stories render without errors in Storybook

  **Must NOT do**:
  - Do not create Palot-specific stories (keep it generic)
  - Do not add new dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`caveman`]
    - `caveman`: Story composition, following existing patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 3, 4, 5, 6, 7

  **References**:
  **Pattern References**:
  - `ch5-packages/packages/workspace/contract/src/Workspace.stories.tsx` — Current stories (262 lines), all 5 story patterns
  - `ch5-packages/packages/workspace/contract/src/shell/WorkspaceShell.tsx` — Updated in Task 5
  - `ch5-packages/packages/workspace/contract/src/sidebar/CollapsibleSidebar.tsx` — Updated in Task 4

  **Acceptance Criteria**:
  - [ ] At least 8 stories in the stories file (5 existing + 3 new minimum)
  - [ ] Resizable Shell story demonstrates drag seams
  - [ ] Animated Sidebar story shows collapse/expand
  - [ ] Snap Behavior story shows snapping to predefined sizes
  - [ ] Both Panels Collapsed story works
  - [ ] `cd ch5-packages/packages/workspace/contract && bun run typecheck` passes

  **QA Scenarios**:
  ```
  Scenario: Stories file typechecks
    Tool: Bash
    Steps:
      1. cd /Users/hassoncs/src/ch5/ch5-packages/packages/workspace/contract
      2. bun run typecheck
    Expected Result: Exit 0
    Evidence: .sisyphus/evidence/task-8-stories-typecheck.txt

  Scenario: Stories file has expected story count
    Tool: Bash
    Steps:
      1. grep -c "export const" src/Workspace.stories.tsx
    Expected Result: >= 8 exported stories
    Evidence: .sisyphus/evidence/task-8-stories-count.txt
  ```

  **Commit**: YES
  - Message: `docs(workspace): update stories for resizable shell + animated collapse`
  - Files: `src/Workspace.stories.tsx`

- [x] 9. Add @ch5me/workspace dependency to Palot + create theme bridge CSS

  **What to do**:
  - Add `"@ch5me/workspace": "workspace:*"` to `palot/apps/desktop/package.json` dependencies
  - Run `bun install` from palot root
  - Create `palot/apps/desktop/src/renderer/styles/workspace.css` mapping `--ws-*` vars to Palot theme vars:
    ```css
    .workspace-shell { --ws-bg: hsl(var(--background)); --ws-panel: hsl(var(--card)); --ws-border: hsl(var(--border)); --ws-text-primary: hsl(var(--foreground)); --ws-text-secondary: hsl(var(--muted-foreground)); --ws-accent: hsl(var(--primary)); }
    ```
  - Import in `palot/apps/desktop/src/renderer/styles/globals.css`
  - Verify typecheck passes

  **Must NOT do**: No component file changes. No hardcoded colors in workspace package.
  **Recommended Agent Profile**: `quick` + `caveman`
  **Parallelization**: Wave 3 start. Blocks: T10. Blocked By: T2.
  **References**: `palot/apps/desktop/package.json`, `palot/packages/ui/src/styles/globals.css`, `ch5-packages/.../theme/tokens.ts`
  **Acceptance Criteria**: workspace.css exists, Palot typecheck passes, CSS imported.
  **QA Scenarios**:
  ```
  Scenario: CSS bridge valid + typecheck
    Tool: Bash
    Steps: 1. cat palot/apps/desktop/src/renderer/styles/workspace.css 2. cd palot && bun run check-types
    Expected: File with --ws-* vars, exit 0
    Evidence: .sisyphus/evidence/task-9-css-bridge.txt
  ```
  **Commit**: YES — `feat(desktop): add workspace dep + theme bridge`

- [x] 10. Replace SidebarLayout with workspace components

  **What to do**:
  - Replace flex layout in `sidebar-layout.tsx` with `ResizablePanes`: Left(sidebar) | Seam | Center(outlet) | Seam | Right(review)
  - AppBar (46px) stays above the pane row
  - In `agent-detail.tsx`: remove manual `transition-[width]` review panel wrapper (lines 300-309)
  - Wire `reviewPanelOpenAtom` to right pane visibility via `usePaneVisibility`
  - Add `leftPanelOpenAtom` in `atoms/ui.ts` (default: true)
  - Keep `SidebarProvider` for internal sidebar state
  - Ensure `min-w-0 overflow-hidden` on all pane containers
  - Preserve `Cmd+B` and `Cmd+Shift+D` shortcuts

  **Must NOT do**: No changes to ChatView, ReviewPanel, PromptToolbar, AppBar injection, routing, or AppSidebar internals.
  **Recommended Agent Profile**: `deep` + `caveman`
  **Parallelization**: Sequential Wave 3. Blocks: T11, T12. Blocked By: T5, T9.
  **References**:
  - `sidebar-layout.tsx` (264 lines) — primary file to modify
  - `agent-detail.tsx:295-311` — review panel wrapper to REMOVE
  - `agent-detail.tsx:142-162` — keyboard shortcuts to PRESERVE
  - `agent-detail.tsx:202-235` — AppBar injection to PRESERVE
  - `@ch5me/workspace` exports: WorkspaceShell, ResizablePanes, Pane, PaneSeam, usePaneVisibility
  - `atoms/ui.ts:19` — reviewPanelOpenAtom
  **Acceptance Criteria**: WorkspaceShell/ResizablePanes in SidebarLayout, left/right/center panes, review panel in right pane, Cmd+B/⌘⇧D work, ChatView renders, typecheck+lint pass.
  **QA Scenarios**:
  ```
  Scenario: Typecheck + lint after integration
    Tool: Bash
    Steps: 1. cd palot && bun run check-types 2. cd palot && bun run lint
    Expected: Both exit 0
    Evidence: .sisyphus/evidence/task-10-build.txt

  Scenario: Workspace import present, no manual animation
    Tool: Bash
    Steps: 1. grep "@ch5me/workspace" sidebar-layout.tsx 2. grep -c "transition-\[width\]" agent-detail.tsx
    Expected: Import present, 0 manual width transitions
    Evidence: .sisyphus/evidence/task-10-integration.txt
  ```
  **Commit**: YES — `feat(desktop): integrate workspace layout`

- [x] 11. Wire panel toggle atoms + keyboard shortcuts

  **What to do**:
  - Verify `Cmd+B` toggles `leftPanelOpenAtom` in SidebarLayout
  - Verify `Cmd+Shift+D` toggles `reviewPanelOpenAtom` in AgentDetail
  - Verify toggle buttons in AppBar show active/highlighted state
  - Verify `Cmd+Shift+F` for review panel expand still works

  **Must NOT do**: No new shortcut system. No existing shortcut changes.
  **Recommended Agent Profile**: `quick` + `caveman`
  **Parallelization**: Sequential after T10. Blocks: T12. Blocked By: T10.
  **References**: `sidebar-layout.tsx:186-204` (shortcuts), `agent-detail.tsx:147-162` (review shortcuts), `agent-detail.tsx:425-452` (toggle button)
  **Acceptance Criteria**: Shortcuts work, toggle buttons active state, typecheck+lint pass.
  **QA Scenarios**:
  ```
  Scenario: Shortcuts + typecheck
    Tool: Bash
    Steps: 1. grep "keydown" sidebar-layout.tsx 2. cd palot && bun run check-types
    Expected: Keydown present, exit 0
    Evidence: .sisyphus/evidence/task-11-shortcuts.txt
  ```
  **Commit**: YES — `fix(desktop): wire panel toggles to workspace layout`

- [x] 12. Final build verification + visual QA

  **What to do**:
  - Full build pipeline: workspace typecheck → Palot typecheck → Palot lint
  - Start Palot dev server, take Playwright screenshots: all panels, left collapsed, right collapsed, both collapsed
  - Kill dev server after verification

  **Must NOT do**: No source code changes.
  **Recommended Agent Profile**: `unspecified-high` + `playwright`
  **Parallelization**: Final sequential. Blocks: F1-F4. Blocked By: T8, T10, T11.
  **References**: All modified files — final state verification.
  **Acceptance Criteria**: All builds pass, dev server starts, 4 screenshots captured.
  **QA Scenarios**:
  ```
  Scenario: Full build pipeline
    Tool: Bash
    Steps: workspace typecheck → palot typecheck → palot lint
    Expected: All exit 0
    Evidence: .sisyphus/evidence/final-qa/build-pipeline.txt

  Scenario: Dev server + visual states
    Tool: Playwright + interactive_bash
    Steps: Start dev server, open app, capture 4 layout states
    Expected: Server starts, screenshots show correct layouts
    Evidence: .sisyphus/evidence/final-qa/*.png
  ```
  **Commit**: NO

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks) <!-- oc:id=sec_am -->

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run typecheck in both repos. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names. Verify Biome lint passes.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start Palot desktop dev server. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Test edge cases: both panels collapsed, near-min width, rapid toggle. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(workspace): add CSS variable theming + enhanced seams + animated collapse` — workspace package changes
- **Wave 2**: `feat(workspace): resizable shell + snap sizes + updated stories` — workspace shell + stories
- **Wave 3**: `feat(desktop): integrate workspace layout` — Palot integration

---

## Success Criteria <!-- oc:id=sec_an -->

### Verification Commands <!-- oc:id=sec_ao -->
```bash
# Workspace package
cd /Users/hassoncs/src/ch5/ch5-packages/packages/workspace/contract && bun run typecheck
# Expected: exit 0, no errors

# Palot
cd /Users/hassoncs/src/ch5/palot && bun run check-types
# Expected: exit 0, no errors

cd /Users/hassoncs/src/ch5/palot && bun run lint
# Expected: exit 0, no errors
```

### Final Checklist <!-- oc:id=sec_ap -->
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] Workspace package typecheck passes
- [ ] Palot typecheck passes
- [ ] Palot lint passes
- [ ] Storybook stories render correctly
- [ ] Palot renders three-column resizable layout
- [ ] Side panels animate on collapse/expand
- [ ] Drag seams have hover/active visual states
- [ ] Theme CSS variables bridge correctly