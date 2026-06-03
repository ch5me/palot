# Task 12: Visual/Manual QA — Blocker Evidence <!-- oc:id=sec_aa -->

**Date:** 2026-05-30  
**Session:** Unsigned (current)  
**Attempted launch:** `OPENCODE_PORT=4096 node ../../node_modules/.bin/electron-vite dev` (from `apps/desktop/`)  
**Browser-mode attempted:** `bun run dev:web` (renderer) + `bun run dev` (server, port 3100)

## Blocker: Missing `workspace.css` import path <!-- oc:id=sec_ab -->

**File:** `apps/desktop/src/renderer/index.css` (line 8)  
**Import:** `@import "./workspace.css";`  
**Actual file location:** `apps/desktop/src/renderer/styles/workspace.css`  
**Result:** Build fails in both dev (Vite pre-transform) and production (`electron-vite build`)

### Evidence <!-- oc:id=sec_ac -->

```
✗ Build failed in 101ms
error during build:
[@tailwindcss/vite:generate:build] Can't resolve './workspace.css' in '/Users/hassoncs/src/ch5/palot/apps/desktop/src/renderer'
file: /Users/hassoncs/src/ch5/palot/apps/desktop/src/renderer/index.css
```

The `@import "./workspace.css"` is a relative import from `index.css`'s directory (`apps/desktop/src/renderer/`). The file lives at `styles/workspace.css`, not at `./workspace.css`.

### Fix required (NOT applied — task says no source changes) <!-- oc:id=sec_ad -->

Change line 8 of `apps/desktop/src/renderer/index.css`:
```css
/* Current (broken): */
@import "./workspace.css";

/* Required: */
@import "./styles/workspace.css";
```

### Impact <!-- oc:id=sec_ae -->

- Electron dev (`bun run dev`): fails at Vite pre-transform
- Browser-mode dev (`bun run dev:web`): same Vite error
- Production build (`bun run build`): fails at client bundle stage

**No panel states can be verified.** The app cannot start in any mode.

## Panel State Contract (verified from source) <!-- oc:id=sec_af -->

The four states are controlled by two atoms:

| State | `leftPanelOpenAtom` | `reviewPanelOpenAtom` | Toggle |
|---|---|---|---|
| All visible | `true` (default) | `true` (Cmd+Shift+D) | — |
| Left collapsed | `false` (Cmd+B) | `true` | Cmd+B |
| Right collapsed | `true` | `false` (Cmd+Shift+D) | Cmd+Shift+D |
| Both collapsed | `false` | `false` | Cmd+B + Cmd+Shift+D |

**Component path:** `sidebar-layout.tsx` → `WorkspaceShell` (left) + `agent-detail.tsx` → `ResizablePanes` (right)

## Root Cause <!-- oc:id=sec_ag -->

The `@import "./workspace.css"` was likely added expecting the file to live at `apps/desktop/src/renderer/workspace.css` (root of renderer). It was actually created at `apps/desktop/src/renderer/styles/workspace.css` (styles subdirectory). The import path was never corrected.