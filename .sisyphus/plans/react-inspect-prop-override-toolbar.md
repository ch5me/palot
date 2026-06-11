# Plan: @ch5me/react-dev-surface — React Live Inspect + Prop Override Debug Toolbar <!-- oc:id=sec_aa -->

**Ticket:** DEVTOOLS-56
**Planner:** Prometheus
**Status:** Draft for Atlas execution
**Package home:** `ch5-packages/packages/web/react-dev-surface/`
**Workspace integration first:** `palot/apps/desktop` (then `ch5-packages/apps/agent-gen-ui-surface`)
**Mode model:** one holistic system — `inspect | props | text-edit` now, `save-to-source` later

---

## 1. Context and Problem Statement

Developing React UIs in dev mode today requires constant context-switching between:
- **Running app** — what the UI actually looks like and does
- **Source code** — which component owns which part of the UI
- **Storybook/manual props** — how does changing a prop affect the component
- **Inline text/content editing** — changing visible copy directly in the live UI

The vision is one holistic dev-only surface with explicit modes:
1. **Inspect mode** — hover any element, see React component name + source location
1. **Prop mode** — click/select component, override props in a Dialkit-style panel
1. **Text edit mode** — directly edit visible text in place using the existing `createTextEditSession()` foundation from `@ch5me/html-react-inspector`
1. **Future source-save mode** — turn approved runtime/text changes into source edits

This is not three separate tools. It is one shared toolbar, one state model, one selected-target model, one persistence model, and one future save-to-source lane.

### Existing Foundations Already Available

| Asset | Location | Reuse Value |
|---|---|---|
| React Fiber inspection engine (`createReactDomInspector`, `createInspectSession`, `createTextEditSession`) | `ch5-packages/packages/web/html-react-inspector` (already extracted) | Core engine — zero duplication |
| Hover highlight + tooltip (component name, source file:line) | `react-voice-inspector/extension/src/content/components/Highlight.tsx` | CSS + positioning patterns |
| CSS design system (oklch variables, toast, panel chrome) | `react-voice-inspector/extension/src/content/styles.css` | Overlay + toolbar styling |
| Skip pattern registry (`ComponentSkipRule`, `BUILTIN_SKIP_RULES`) | `react-voice-inspector/extension/src/lib/types.ts` | Config for wrapper-skipping |
| Props sanitization (redact passwords, tokens) | `main-world.ts` (sensitive pattern redaction) | Security for prop display |
| Session persistence via Jotai (`atomWithStorage` + reload pattern) | `palot/apps/desktop/src/renderer/atoms/react-scan.ts` | Dev-only toggle UX |
| `@ch5me/elf-ui` component library | `palot/packages/ui` | Base UI components for toolbar + popover |

### What Must Be Built

Everything above is foundation. The net-new work is:
- The toolbar UI shell and its toggle state
- The prop override registry and live-editing surface (Dialkit integration)
- The app-level provider that makes all of this available
- A `withInspect` HOC for opt-in component registration
- An `InspectOverlay` component that renders the highlight into a React Portal
- Keyboard shortcut handling (Escape to exit inspect mode)
- React DevTools hook fallback for editing props the fiber layer can read

---

## 2. Package Structure <!-- oc:id=sec_ab -->

> **Junior-dev rule:** if a file is named in this section, it must either be created in Wave A/B/C/D/E or explicitly marked future-only. No hidden files.

```
ch5-packages/packages/web/react-dev-surface/
├── src/
│   ├── index.ts                          # Public exports
│   ├── types.ts                          # Shared types (ComponentRecord, PropOverride, InspectMode, etc.)
│   ├── context/
│   │   ├── DevSurfaceContext.tsx         # React context (registry, selected, mode, overrides)
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useDevSurface.ts              # Consumer hook: access context
│   │   ├── useInspectSession.ts           # Wires createInspectSession() from @ch5me/html-react-inspector
│   │   ├── useTextEditMode.ts             # Wires createTextEditSession() from @ch5me/html-react-inspector
│   │   ├── usePropOverrides.ts            # Override state, undo stack, apply/revert
│   │   └── useKeyboardShortcuts.ts        # Escape to exit, Cmd/Ctrl+Shift+I to toggle
│   ├── components/
│   │   ├── DevSurfaceProvider.tsx         # App root wrapper
│   │   ├── DevSurfaceToolbar.tsx          # The docked toolbar (bottom or top strip)
│   │   ├── InspectOverlay.tsx             # Portal-based highlight overlay
│   │   ├── ComponentInfoPanel.tsx         # Slide-in panel after selection (name, file, props summary)
│   │   ├── EditIntentQueue.tsx            # Unified queue for prop + text edits
│   │   ├── PropOverridePopover.tsx        # Dialkit popover — per-prop controls
│   │   ├── PropEditor.tsx                 # Type-aware editor: bool toggle, string input, number slider, enum radio
│   │   └── withInspect.tsx                # HOC for explicit component registration
│   ├── lib/
│   │   ├── skipRules.ts                   # Built-in ComponentSkipRule defaults
│   │   ├── propUtils.ts                   # sanitizeProps(), getEditableProps(), inferPropType()
│   │   ├── dialkit-adapter.ts             # Single seam for upstream vs vendored dialkit
│   │   ├── edit-intents.ts                # JSON export + source-save placeholder helpers
│   │   └── cssVariables.ts                # Re-export of oklch CSS vars from styles.css
│   └── styles/
│       └── dev-surface.css                # CSS vars + overlay + toolbar + popover styles
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

**Sibling reuse chain:**
```
@ch5me/html-react-inspector   ← engine (already extracted, no changes needed)
@ch5me/elf-ui                ← base components (already exists, no changes needed)
@ch5me/react-dev-surface     ← NEW (this package)
```

---

## 3. Wave 0 — Shared Primitives Extraction (prerequisite, do first)

### 0.1: Extract shared styles + primitives from react-voice-inspector

The explore confirmed these specific assets should be extracted for shared use:

| Asset | Source | Target |
|---|---|---|
| `Highlight` (highlight border + tooltip) | `extension/src/content/components/Highlight.tsx` | `packages/ui/src/components/debug/highlight-overlay.tsx` |
| `Toast` (5-type toast system) | `extension/src/content/components/Toast.tsx` | `packages/ui/src/components/debug/toast.tsx` |
| `formatIdentifier` / `formatShortIdentifier` | `extension/src/lib/utils.ts` | `packages/shared/src/format-component.ts` |
| `compileSkipPattern`, `buildSkipPredicate`, `originMatchesScope` | `extension/src/lib/utils.ts` | `@ch5me/html-react-inspector/src/utils/skipPatterns.ts` |
| Source map resolver wrapper | `extension/src/lib/sourceMapResolver.ts` | Already in `@ch5me/html-react-inspector` — confirm it's exported correctly |
| CSS vars | `extension/src/content/styles.css` | `packages/ui/src/styles/dev-tokens.css` |

> **Key architectural note:** The react-voice-inspector extension uses Chrome's MAIN world / isolated world split (main-world.ts = vanilla TS in page context, ContentApp.tsx = React in content script). The React library approach does NOT need this bridge — it runs inside the app's React context directly. This means `createInspectSession` from `@ch5me/html-react-inspector` is the correct integration point, not the main-world bridge.

### 0.2: Extract shared styles from react-voice-inspector into a CSS module

**Touched files:** `react-voice-inspector/extension/src/content/styles.css`

Extract the following sections into `react-dev-surface/src/styles/shared-vars.css` (a new file that gets committed to both repos via a note, or alternatively just copy the CSS var block — CSS is cheap to duplicate):

```css
:root {
  /* rvi-* vars: only the overlay and toolbar subset, not the transcript panel vars */
  --rds-bg-0: oklch(0.13 0.012 168);
  --rds-bg-1: oklch(0.17 0.013 168);
  --rds-line: oklch(0.30 0.018 168);
  --rds-t-0: oklch(0.97 0.003 168);
  --rds-t-2: oklch(0.66 0.012 168);
  --rds-brand: oklch(0.85 0.11 152);
  --rds-brand-tint: oklch(0.30 0.05 152 / 0.20);
  --rds-ease: cubic-bezier(0.16, 1, 0.3, 1);
  --rds-sans: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --rds-mono: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, monospace;
}
```

**Proof:** CSS vars file exists, referenced in `react-dev-surface/src/styles/dev-surface.css`.

---

## 4. Wave A — Package Scaffold + Context <!-- oc:id=sec_ac -->

### A.0: Workspace wiring first (required before any package work) <!-- oc:id=sec_ac0 -->

**Touched files:**
- `palot/package.json`
- `ch5-packages/package.json` (only if needed for workspace visibility in that repo)

**What to do:**
- Add `../ch5-packages/packages/web/react-dev-surface` to `palot/package.json` `workspaces` before trying to consume the package locally.
- Verify Bun workspace resolution sees the new package from palot.
- If Atlas chooses file dependency instead of workspace dependency, document exact reason in commit.

**Proof:** from palot root, workspace install/type resolution sees `@ch5me/react-dev-surface` without manual symlink hacks.

### A.1: Create package in ch5-packages <!-- oc:id=sec_ad -->

Create `ch5-packages/packages/web/react-dev-surface/package.json`:
```json
{
  "name": "@ch5me/react-dev-surface",
  "version": "0.1.0",
  "type": "module",
  "description": "React dev-only live inspect toolbar with in-situ prop overrides. Wraps an app with a debug surface.",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "default": "./dist/index.js" }
  },
  "peerDependencies": { "react": ">=18", "react-dom": ">=18" },
  "dependencies": {
    "@ch5me/html-react-inspector": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "@types/react": "^19.0.0",
    "vitest": "^3.2.4"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "test": "vitest run src"
  }
}
```

**Proof:** `package.json` exists, TypeScript compiles with no errors, test suite passes.

### A.2: Define core types <!-- oc:id=sec_ae -->

**File:** `src/types.ts`

```typescript
export interface ComponentRecord {
  id: string
  name: string
  file?: { fileName: string; lineNumber: number }
  props: Record<string, unknown>
  /** Props the developer has explicitly marked as editable */
  editableProps?: string[]
  /** Optional display name for the inspector tooltip */
  displayName?: string
}

export interface EditIntentBase {
  id: string
  kind: 'prop-override' | 'text-edit'
  componentId?: string
  sourceRange?: {
    fileName: string
    startLine: number
    startColumn?: number
    endLine?: number
    endColumn?: number
  } | null
  persisted: 'runtime' | 'localStorage' | 'source-file'
  appliedAt: number
}

export interface PropOverride extends EditIntentBase {
  kind: 'prop-override'
  componentId: string
  propKey: string
  /** null = reset to original */
  value: unknown | null
}

export type SurfaceMode = 'inspect' | 'props' | 'text-edit'

export interface InspectMode {
  active: boolean
  currentMode: SurfaceMode
  selected: ComponentRecord | null
  hoveredId: string | null
}

export interface TextEditChangeRecord extends EditIntentBase {
  kind: 'text-edit'
  beforeText: string
  afterText: string
  contextText: string
}

export interface DevSurfaceConfig {
  /** Extra skip patterns (in addition to built-ins) */
  skipPatterns?: string[]
  /** Components to register eagerly at startup */
  initialComponents?: ComponentRecord[]
  /** Called when user commits a prop override */
  onOverride?: (override: PropOverride) => void
  /** Called when user resets a prop */
  onReset?: (componentId: string, propKey: string) => void
  /** Persist overrides + text edits to localStorage (default: true in dev) */
  persist?: boolean
  /** Enable direct text edit mode */
  enableTextEdit?: boolean
}
```

**Proof:** `src/types.ts` compiles, all interfaces exported from `index.ts`.

### A.3: DevSurfaceContext <!-- oc:id=sec_af -->

**File:** `src/context/DevSurfaceContext.tsx`

State shape:
```typescript
interface DevSurfaceState {
  mode: InspectMode            // active, selected, hovered, currentMode
  registry: Map<string, ComponentRecord>
  overrides: PropOverride[]    // stack — applied prop overrides
  textEdits: TextEditChangeRecord[] // stack — applied inline text edits
  config: DevSurfaceConfig
}
```

Exposed via `useDevSurface()`:
```typescript
const {
  mode,           // InspectMode
  registry,        // Map<string, ComponentRecord>
  overrides,       // PropOverride[]
  textEdits,       // TextEditChangeRecord[]
  setActive,       // (bool) => void
  setMode,         // ('inspect' | 'props' | 'text-edit') => void
  select,          // (ComponentRecord) => void
  register,        // (ComponentRecord) => void
  override,        // (componentId, propKey, value) => void
  reset,           // (componentId, propKey?) => void  // ? = all props
  applyTextEdit,   // (change: TextEditChangeRecord) => void
  resetTextEdit,   // (changeId?: string) => void
} = useDevSurface()
```

**Proof:** Context renders without error, `useDevSurface()` returns all keys, multiple providers in tree is an error (enforce singleton via assertion).

---

## 5. Wave B — Inspect Mode + Overlay

### B.1: useInspectSession hook

**File:** `src/hooks/useInspectSession.ts`

Wires `@ch5me/html-react-inspector`'s `createInspectSession()`:

```typescript
export function useInspectSession({ onHover, onSelect }: {
  onHover?: (id: string | null) => void
  onSelect?: (record: ComponentRecord) => void
}) { ... }
```

Key behaviors:
- Calls `setActive(true/false)` when `mode.active` flips
- On `onSelect`: looks up the fiber-derived component name in `registry` (exact name match, then closest parent). If found → calls `select(record)`. If not found → calls `select` with a lightweight `ComponentRecord` constructed from fiber data (name, file, props — no `editableProps`)
- Sets `document.body.style.cursor = 'crosshair'` in inspect mode, restores on exit
- Cleans up all listeners on `destroy()`

**Proof:** Inspect mode activates on toolbar toggle, hover fires `onHover`, click fires `onSelect`, Escape exits.

### B.2: InspectOverlay component

**File:** `src/components/InspectOverlay.tsx`

- Renders via `createPortal` into `document.body`
- CSS: `position: fixed; inset: 0; pointer-events: none; z-index: 2147483646`
- Shows brand-colored box (`--rds-brand`, `1.5px solid`) at `hovered` element's `DOMRect`
- Shows tooltip above: `@ComponentName` + `file.tsx:line` in monospace
- On `selected`: overlay stays visible with slightly stronger tint + checkmark indicator
- `pointer-events: none` so clicks pass through to the page
- Hidden when `mode.active === false`

**Proof:** Hovering any React element shows highlight box, tooltip shows correct component name, overlay disappears on Escape.

### B.2.5: Explicit mode-switch rules

**Rules:**
- Only one mode can be active at a time.
- Switching to `text-edit` must deactivate inspect listeners first.
- Switching to `inspect` must deactivate text-edit session first.
- Switching to `props` does not start a session by itself; it only changes the panel for the current selected target.
- `Escape` from `inspect` or `text-edit` returns to `props` if a target is selected, otherwise `off`.
- Clicking outside the popover must not exit current mode automatically.

**Proof:** no overlapping inspect + text-edit listeners, and `Escape` behavior is deterministic.

### B.3: DevSurfaceToolbar component

**File:** `src/components/DevSurfaceToolbar.tsx`

Layout: fixed bottom bar, full width, ~48px tall.

Buttons:
1. **Inspect** — enters `inspect` mode
1. **Text Edit** — enters `text-edit` mode
1. **Selected** — shows current `mode.selected?.name || '—'`, click opens `ComponentInfoPanel`
1. **Edits** — badge with combined count of prop overrides + text edits, opens `EditIntentQueue`
1. **Reset All** — only visible when edits exist, resets all overrides + text edits
1. **Settings** — future: skip pattern config

Visual: dark surface (`--rds-bg-0`), `--rds-brand` active state, slim icon buttons. Uses `@ch5me/elf-ui` `Button` base.

**Proof:** Toolbar renders at bottom, all 4+ buttons visible, toggle activates inspect mode.

### B.4: ComponentInfoPanel

**File:** `src/components/ComponentInfoPanel.tsx`

Slide-in panel (right edge, ~320px wide) shown after selection.

Contents:
- Component name (bold)
- Source file + line (monospace, clickable — opens in editor)
- Props table: key, inferred type badge, current value (truncated), override indicator
- "Override" button per prop row → opens `PropOverridePopover` anchored to that row

**Proof:** Panel slides in on selection, shows correct data, source link resolves to file.

---

## 6. Wave C — Prop Override + Prop Editor <!-- oc:id=sec_ag -->

> **⚠️ Dialkit constraint and decision:** upstream `dialkit`'s `useDialKit` is a global singleton with no programmatic setters (GitHub issue #12, open). It cannot drive a selected-component inspector by itself. However, `dialkit` **does** expose a public `DialStore` plus individual controls (`Slider`, `Toggle`, `ColorControl`, `TextControl`, `SelectControl`, `SpringControl`, `TransitionControl`, `PresetManager`). Plan decision: start by using the individual controls inside our own custom panel shell. If state-sync friction remains, fork/vendor dialkit into CH5 source and add programmatic setter support there. Do NOT build our own control set first. Build on dialkit as far as practical.

### C.0: Vendor/Fork seam for dialkit <!-- oc:id=sec_a0 -->

**Decision:** keep Wave C implementation behind a seam:
- Initial import target: upstream `dialkit`
- Optional fork target if needed: `ch5-packages/packages/web/react-dev-surface/vendor/dialkit/`
- Our app code imports through one adapter module only: `src/lib/dialkit-adapter.ts`

**What to do:**
- Create `dialkit-adapter.ts` that re-exports only the control primitives we use plus any `DialStore` helpers.
- If Atlas discovers we need programmatic setters or separate inline instances, vendor/fork dialkit immediately and keep the public adapter unchanged.
- Treat upstream issues #12 (programmatic setters), #33 (multiple inline instances), and #36 (define presets via code) as likely fork triggers.

**Proof:** swapping upstream `dialkit` for vendored implementation requires changing only `dialkit-adapter.ts` imports, not the prop panel components.

### C.1: usePropOverrides hook <!-- oc:id=sec_ah -->

**File:** `src/hooks/usePropOverrides.ts`

```typescript
interface UsePropOverridesResult {
  overrides: PropOverride[]
  effectiveValue: (componentId: string, propKey: string) => unknown
  apply: (componentId: string, propKey: string, value: unknown) => void
  reset: (componentId: string, propKey?: string) => void
  undo: () => void
  redoStack: PropOverride[]
}
```

- Stores overrides as ordered array (newest last)
- `effectiveValue`: scans overrides newest-first for last override of `(componentId, propKey)`
- `apply`: pushes `PropOverride`, fires `config.onOverride`
- `reset`: removes matching overrides, fires `config.onReset`
- `undo`: pops last override, pushes to `redoStack`
- `localStorage` persistence is required. Use `atomWithStorage`-style keys:
  - `dev-surface:overrides`
  - `dev-surface:text-edits`
  - `dev-surface:active-mode`
  - `dev-surface:selected-component`
- Add named preset support later, but persist raw override state in v1.

**Proof:** Override applies, effectiveValue reflects it, undo restores original, Reset removes it, and state survives reload from localStorage.

### C.2: Text edit mode — direct visible text editing <!-- oc:id=sec_ai0 -->

**File:** `src/hooks/useTextEditMode.ts`

Use existing `createTextEditSession()` from `@ch5me/html-react-inspector` as first-class part of the same dev surface.

**What to do:**
- Start/stop a text edit session when `mode.currentMode === 'text-edit'`.
- Reuse selected/hovered target state so inspect mode and text-edit mode share one target model.
- On text change, write `TextEditChangeRecord` into `textEdits` store.
- Show changed text in same right-side panel used by props, under separate tab/section.
- Persist text edits to localStorage.
- Support reset of one text edit or all text edits.
- Future seam: text edits become source-save candidates.

**Proof:** In text-edit mode, user can click visible text, edit inline, change is recorded, survives reload, and can be reset.

### C.3: PropEditor — type-aware per-prop control <!-- oc:id=sec_ai -->

**File:** `src/components/PropEditor.tsx`

Renders the right input based on inferred prop type:

| Inferred type | Control |
|---|---|
| `boolean` | Toggle switch |
| `string` | Text input (truncated preview for long strings) |
| `number` | Number input + range slider |
| `enum` (string union from propTypes/TS) | Radio group |
| `object` / `array` | Collapsed accordion with JSON tree (read-only) |
| `function` | Badge: "function — not editable" |
| `ReactNode` | Badge: "ReactNode — not editable" |

Type inference: check `propTypes`, then `FlowIntersection`, then runtime `typeof`.

**Proof:** Each type renders correct control, function/object shows not-editable badge.

### C.3: PropOverridePopover <!-- oc:id=sec_aj -->

**File:** `src/components/PropOverridePopover.tsx`

Dialkit-style popover anchored below the "Override" button.

Layout:
- Header: `propKey` (monospace) + type badge
- Current value display (original, not overridden)
- `PropEditor` for the new value
- "Apply" / "Cancel" buttons
- "Reset" button if this prop has an active override

On "Apply":
1. Calls `override(componentId, propKey, value)` <!-- oc:id=item_aa -->
1. Calls `onOverride` callback with `PropOverride` <!-- oc:id=item_ab -->
1. Popover closes <!-- oc:id=item_ac -->

**Proof:** Popover opens anchored to row, Apply changes value, value reflected in `ComponentInfoPanel`, popover closes.

### C.4: React DevTools Hook Fallback <!-- oc:id=sec_ak -->

**File:** `src/lib/devToolsHook.ts`

When `withInspect` or fiber fallback yields a component without pre-registered `editableProps`:

- Attach to `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`
- Read component's `props` and `memoizedProps` from the fiber
- Use `PropTypes` or TypeScript `Props<T>` to enumerate editable prop names as a hint
- `inferPropType` from `propUtils.ts` provides runtime type hints

**Proof:** DevTools hook attaches in dev mode, fallback props available when fiber read succeeds.

---

## 7. Wave D — App Integration

### D.1: DevSurfaceProvider — the app root wrapper

**File:** `src/components/DevSurfaceProvider.tsx`

```typescript
<DevSurfaceProvider config={config}>
  {children}
  <InspectOverlay />
  <DevSurfaceToolbar />
</DevSurfaceProvider>
```

- Renders `children` as-is (no extra DOM wrapper)
- Renders overlay + toolbar as portals into `document.body`
- Checks `process.env.NODE_ENV === 'development'` — throws in production builds
- Asserts single instance (singleton pattern)

**Usage in app root:**
```tsx
// Before (your app):
<Router><App /></Router>

// After (wrap in dev only):
import { DevSurfaceProvider } from '@ch5me/react-dev-surface'
<DevSurfaceProvider>
  <Router><App /></Router>
</DevSurfaceProvider>
```

### D.1.5: Future source-save lane — normalize everything as EditIntent[]

**Decision:** do not treat prop overrides and text edits as unrelated features. Normalize both into one `EditIntent[]` pipeline now.

**What to do:**
- Every prop override creates a `PropOverride` intent.
- Every text edit creates a `TextEditChangeRecord` intent.
- Both carry `sourceRange` when available from instrumentation/fiber/source metadata.
- Add export helper: `exportEditIntents()` returns deterministic JSON snapshot.
- Add future placeholder button in panel: `Save to source` (disabled in v1, visible only when source ranges exist).
- Future implementation path can convert intents into deterministic patch requests or agent prompts.

**Proof:** panel can list both prop and text edits in one queue, export them as one JSON shape, and disabled Save-to-source button appears only when source ranges exist.

### D.2: withInspect HOC — explicit component registration

**File:** `src/components/withInspect.tsx`

```typescript
const UserCard = withInspect(UserCardBase, {
  id: 'UserCard',
  editableProps: ['name', 'avatarUrl', 'onClick'],
  displayName: 'UserCard',
})
```

- Wraps component, registers it in `registry` on mount
- Registers with `editableProps` so the popover knows which props are safe to expose
- Cleans up on unmount

**Proof:** Registered component appears in registry, `editableProps` filter controls shown in popover.

### D.3: Keyboard shortcuts

**File:** `src/hooks/useKeyboardShortcuts.ts`

| Shortcut | Action |
|---|---|
| `Escape` | Exit current active session mode (`inspect` or `text-edit`) |
| `Ctrl+Shift+I` / `Cmd+Shift+I` | Toggle inspect mode |
| `Ctrl+Shift+E` / `Cmd+Shift+E` | Toggle text-edit mode |
| `Ctrl+Z` / `Cmd+Z` | Undo last edit intent |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo |

**Conflict rule:** when a text input, textarea, contenteditable, or code editor inside the dev surface has focus, global shortcuts must not fire except `Escape`.

Registered once on mount into `document`, cleaned up on destroy.

### D.4: Palot desktop integration

**Touched files (palot):**
- `apps/desktop/src/renderer/App.tsx` — wrap `<App />` with `<DevSurfaceProvider>`
- `apps/desktop/src/renderer/atoms/` — add `devSurfaceEnabledAtom` (Jotai, `atomWithStorage`, key `elf:devSurface`, default `false`)
- Toolbar shows at bottom of desktop renderer viewport
- Command palette entry: "Toggle Dev Surface" → flips atom + reload

**Proof:** Toolbar visible in dev desktop build, toggle persists across sessions, all 4 waves functional in palot desktop.

---

## 8. Dependency and Seams Map <!-- oc:id=sec_al -->

```
ch5-packages/packages/web/
├── html-react-inspector/     ← engine, READ-ONLY, no new deps on this
└── react-dev-surface/        ← NEW
    ├── src/types.ts
    ├── src/context/           ← DevSurfaceContext (Jotai atom at core, React context on top)
    ├── src/hooks/             ← useInspectSession, usePropOverrides, useKeyboardShortcuts
    ├── src/components/        ← Provider, Toolbar, Overlay, Panel, Popover, PropEditor, withInspect
    ├── src/lib/               ← skipRules, propUtils, cssVariables
    └── src/styles/           ← dev-surface.css (depends on shared CSS vars from Wave 0)
         │
         │ depends on
         ▼
@ch5me/elf-ui/               ← Button, Tooltip, Badge, Popover (existing, no changes)
@ch5me/html-react-inspector  ← createInspectSession, createReactDomInspector (READ-ONLY)

palot/                        ← first consumer
└── apps/desktop/             ← DevSurfaceProvider wraps <App />, Jotai atom for toggle
```

---

## 9. Phasing and Execution Order

| Wave | Deliverable | Approx scope |
|---|---|---|
| **Wave 0** | `src/styles/shared-vars.css` extracted | ~1 file |
| **Wave A** | Package scaffold + `DevSurfaceContext` + types | ~6 files |
| **Wave B** | `InspectOverlay` + `DevSurfaceToolbar` + `useInspectSession` | ~5 files |
| **Wave C** | Prop override: `usePropOverrides`, `PropEditor`, dialkit individual controls | ~5 files |
| **Wave D** | `DevSurfaceProvider`, `withInspect`, keyboard shortcuts, palot integration | ~6 files |
| **Wave E** | `ComponentInfoPanel`, DevTools hook fallback | ~3 files |
| **Total** | **~25 files** | **~3–4 Atlas sessions** |

**Atlas execution recommendation:** 4 parallel-ready groups:
1. Wave 0 + Wave A (types, context, scaffold)
2. Wave B (overlay + toolbar, session hook)
3. Wave C (prop override system)
4. Wave D + Wave E (integration, panel, keyboard shortcuts)

---

## 10. Packaging Decision <!-- oc:id=sec_am -->

**Standalone reusable lib: YES**

Package lives in `ch5-packages/packages/web/react-dev-surface/` — the same workspace where `@ch5me/html-react-inspector` already lives.

Rationale:
- `ch5-devtools` is explicitly CLI + agent-runtime only; React/web packages violate its policy
- `palot/packages/` is app-local UI components; this is a general-purpose library
- `ch5-packages/packages/web/` is the correct home: it's where `html-react-inspector` and other reusable web packages live
- Works with any React 18+ host app (Vite, Next.js, Electron, CRA)

**ch5-packages workspace note:** The palot workspace (`palot/package.json`) does not include `ch5-packages` as a workspace reference. The `@ch5me/react-dev-surface` package is consumed by adding it as a workspace dependency:

```json
// in palot/package.json workspaces, add:
"../ch5-packages/packages/web/react-dev-surface"
```

Or as a direct file dep:
```json
"@ch5me/react-dev-surface": "file:../ch5-packages/packages/web/react-dev-surface"
```

---

## 11. Known Constraints and Risks

| Risk | Mitigation |
|---|---|
| Prop override is ephemeral only — no shared state with component | Document clearly; future: `useOverrideStore` with Zustand that components can subscribe to |
| Functions/ReactNodes not editable | Shown as not-editable badge; future: component-level code injection for handlers |
| React internals change between React versions | `@ch5me/html-react-inspector` handles version detection; keep it updated |
| Production bundle inclusion | Provider throws in non-dev builds; tree-shake to zero in production |
| Browser CSP restrictions in some hosts | Overlay uses `createPortal` into `document.body`; works in most CSP configs |
| Multiple React roots on same page | `inspectSession` scoped to `document`; each root gets its own overlay |

---

## 12. Future Extension Points (out of scope for v1, note for design) <!-- oc:id=sec_an -->

- **Voice mode**: Integrate with `react-voice-inspector` relay → component selection becomes a voice command
- **Storybook export**: Export current prop state as a Storybook `args` object
- **Shared prop presets**: Store/load named prop scenarios via `localStorage`
- **Storybook addon**: Wrap as a Storybook addon (`@storybook/react`) that injects the toolbar
- **React Native**: Adapt overlay for mobile — `__reactNativeFiber` keys differ from `__reactFiber$`
- **Vite plugin**: `@ch5me/vite-plugin-react-dev-surface` — auto-injects provider + registers components via AST transform

---

## 13. Verification Criteria (per wave)

### Wave 0
- [ ] `src/styles/shared-vars.css` exists with `--rds-*` variables

### Wave A
- [ ] `package.json` exports `"."` as ESM module
- [ ] `src/types.ts` exports `ComponentRecord`, `PropOverride`, `InspectMode`, `DevSurfaceConfig`
- [ ] `DevSurfaceContext` provides `useDevSurface()` hook with all keys
- [ ] `DevSurfaceProvider` renders children without extra DOM wrapper
- [ ] TypeScript: `tsc --noEmit` passes

### Wave B
- [ ] Inspect mode: toolbar toggle activates hover highlight
- [ ] Hover: brand-colored box appears at correct DOM element
- [ ] Hover tooltip: shows `@ComponentName` + `file:line`
- [ ] Click: selects component, opens `ComponentInfoPanel`
- [ ] Escape: exits inspect mode, deselects

### Wave C
- [ ] Toggle prop: boolean renders switch, applies override
- [ ] String/number props: render correct inputs
- [ ] Text-edit mode starts `createTextEditSession()` and records `TextEditChangeRecord`
- [ ] Text edits survive reload from localStorage
- [ ] "Apply" in popover: value reflected in panel
- [ ] Undo: reverts last edit intent, redo restores it
- [ ] Reset All: clears all overrides + text edits

### Wave D
- [ ] `DevSurfaceProvider` wraps app without errors
- [ ] `<DevSurfaceProvider>` throws in `NODE_ENV === 'production'`
- [ ] `withInspect` registers component, unregisters on unmount
- [ ] Keyboard shortcuts work: `Escape`, `Cmd/Ctrl+Shift+I`, `Cmd/Ctrl+Shift+E`, `Cmd/Ctrl+Z`
- [ ] palot desktop: toolbar visible, toggle persists via Jotai atom
- [ ] Mode switching does not leave overlapping listeners active

### Wave E
- [ ] `ComponentInfoPanel` slides in on selection
- [ ] `EditIntentQueue` lists both prop overrides and text edits
- [ ] DevTools hook attaches when available
- [ ] Source link opens correct file
- [ ] Disabled `Save to source` control appears only when source ranges exist