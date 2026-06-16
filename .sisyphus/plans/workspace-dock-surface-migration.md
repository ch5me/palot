# Workspace Dock + Surface Migration — Authoritative Plan

- **Date:** 2026-06-15
- **Branch:** `feat/workspace-dock-surface-migration`
- **Status:** ✅ COMPLETE on `feat/workspace-dock-surface-migration` (27 commits, pushed, PR-ready). All 16 surfaces migrated to V2 plugins; feature flags removed; dock is the sole session UI (proven by default in the web build); deep-link focus wired; Storybook regression proof landed. tsgo + biome + full electron-vite build all green. Deferred (documented below): eviction enforcement + resource controllers (safe no-op today; needs test infra), the pre-existing `@ch5me/agent-ui-web` terminal-in-web quirk, and an Electron click-through.
- **Author authority:** Chris (2026-06-15) — supersedes any prior tracked plan where they conflict (see §4).

## Progress (updated 2026-06-16, overnight)

Done + pushed on `feat/workspace-dock-surface-migration`:
- **Phase 0** (`0b6cf0327`) — SurfaceHost registry + reverse-portal transport + SurfaceOutlet + HiddenSurfaceHostLayer + vendored dock shell, gated behind temp `workspaceDock` flag (default OFF). Includes `surface-prop-bridge` (republishes live props to once-mounted hosts).
- **Phase 0.5** (`d248d0803`) — dock seeds from the merged surface-tab list; migration state transparent to the dock.
- **All 16 surface migrations DONE** (V1 row + flag atom deleted, manifest+panel+tests added, stable persistenceKey/telemetryNamespace preserved, flag→enabled carry-over): review, files, artifacts, bridges, pulse, memory, editor, terminal, claude, oracle, voice, browser, studio, ch5pm, pdf-review, crm. Plus `ch5pm` import-path fix (`6b2ba3b02`). Each batch verified: `tsgo --noEmit`, `biome check .`, full `electron-vite build` all green; lazy chunks emit per panel.
- `CATALOG_SERVED_SURFACE_IDS` = 17 (16 + notes). Only the **host-only `plugins`** row remains in `FIREFLY_SURFACE_REGISTRY` (by design — operator UI, never a plugin).
- Verified at BUILD/TYPECHECK/LINT level only. **Dock NOT yet runtime-verified** (visual smoke in progress).

Remaining (gated on dock runtime proof before the irreversible cutover):
- Runtime-verify the dock renders (flag ON) — chat in main + surfaces as dock tabs, drag preserves state.
- Cleanup: reframe `plugins` host-only off `FIREFLY_SURFACE_REGISTRY`, then DELETE the registry; flip `workspaceDock` default / remove the flag + legacy SplitPane path.
- Resource-specific controllers (Monaco/PTY/iframe) + eviction enforcement (currently a no-op stub, so nothing evicts — surfaces stay mounted, which is why every slice was uniform passive plumbing).
- The 5 regression tests (§Phase Persistence).
- Orphaned `shared/firefly-plugin/memory-surface-manifest.ts` shim (+ its standalone test) — delete in Cleanup (no longer in `BUILT_IN_MANIFESTS`).

## Runtime verification — web smoke (2026-06-16, PROVEN)

Verified in the running web build (devmux web :20883) with `elf:workspaceDockEnabled=true`. Commits added since: dock full-height fix (`d96786806`), in-renderer web catalog bridge (`64c24190a`).

- **Dock renders end-to-end.** Chat fills the main zone at full height; the right zone shows the migrated surfaces as real Dockview tabs (Changes, Browser, Notes, Pulse, Artifacts, Memory, Files, Terminal, Editor, Bridges, CRM, Voice, Oracle, Claude, CH5PM…). Catalog built with 21 plugins.
- **Tab switching works** — selecting Changes/Files renders their content; panel crashes are caught by `PluginPanelBoundary` ("Restart surface"), not blank zones.
- **Web parity restored** — the `elf.plugins bridge is not exposed` error is gone after the in-renderer catalog bridge; `V2PluginsPanel` no longer crashes the web route.

### Known follow-ups (NOT migration regressions)
- **(D) Terminal panel renders `undefined` in the WEB build** ("Element type is invalid … TerminalContent"). Root cause is PRE-EXISTING: `terminal-panel.tsx` imports `Terminal*` from `@ch5me/agent-ui-web` — byte-identical to the pre-migration file (`git show 344496bc7:…/side-panel/terminal-panel.tsx`). The export resolves to `undefined` only in the web bundle; Electron is unaffected (imports unchanged, terminal worked there). The dock merely now *exposes* terminal in web. Fix belongs in `@ch5me/agent-ui-web`/web bundling, not this migration. Caught gracefully by the boundary.
- **(E) Document-lane surfaces (studio, pdf-review).** Migrated as `formFactor: "side-panel-tab"` so they appear as utility tabs. `catalogPanelToTabDescriptor` returns `null` for non-side-panel-tab (`firefly-plugin-surface-merge.ts:82`), so true main-pane/document projection isn't wired in the catalog merge. **Product decision needed:** keep a separate document lane (bottom dock zone) — which needs the merge to project main-pane surfaces into `docTabs` — or treat studio/pdf-review as ordinary dock tabs. Bottom zone is currently empty.

## Cutover — GATED on Chris + Electron runtime check (NOT done)

The dock is proven in web; the only web-only issues are the pre-existing agent-ui-web quirk. Electron has the `elf.plugins` bridge and a working terminal, so the dock should work there — but flipping the entire app's default UX is irreversible and unverified in Electron, so it is held for review.

Recipe when approved (verify in Electron first — `bun run dev:electron-local`, toggle the flag, click through surfaces):
1. Resolve (E): decide doc-lane handling; wire main-pane projection if keeping it.
2. Reframe host-only `plugins` off `FIREFLY_SURFACE_REGISTRY` (host surface source independent of the registry), then DELETE `firefly-surface-registry.tsx` + `getFireflySurfaceTabs` consumers + the now-dead `mergeSurfaceTabs` legacy branch.
3. Delete the temp `workspaceDockEnabledAtom` and the legacy SplitPane branch in `agent-detail.tsx`; make the dock the sole path.
4. Delete the orphaned `memory-surface-manifest.ts` shim + test.
5. Then: resource-specific controllers (Monaco/PTY/iframe) + eviction enforcement + the 5 regression tests.

## Thesis

Palot today renders surfaces through two coupled legacy systems: a ~450-line hardcoded `FIREFLY_SURFACE_REGISTRY` gated by 17 renderer feature-flag atoms, laid out by nested `SplitPane`s in `agent-detail.tsx` / `sidebar-layout.tsx`. We converge the entire app onto a Dockview-based workspace shell **and** migrate all 17 side-panel surfaces to the V2 plugin catalog in one campaign, because the two efforts share a single seam: **the V2 plugin panel components ARE the "surfaces", they get mounted once into an app-owned Surface Host Registry, and a Dockview panel is just a lightweight SLOT that attaches to an already-mounted host.** Dockview owns layout/chrome/drag/serialization only; the app owns heavy content lifetime keyed by stable identity. Each per-surface slice does four things at once — (i) author manifest + move panel to the plugin catalog (notes recipe), (ii) register a SurfaceController with stable identity + retention policy, (iii) render it through a `SurfaceOutlet` slot in the dock shell, (iv) delete its feature-flag atom + its `FIREFLY_SURFACE_REGISTRY` row and migrate the flag value to plugin-enabled state. At the end: no `*SurfaceEnabledAtom`, no `FIREFLY_SURFACE_REGISTRY`, no `SplitPane` app layout. No legacy remains.

---

## 1. Background & Current State (file-anchored)

### Render path (the live left-nav → chat → side-panel chain)
- Outer chrome: `apps/desktop/src/renderer/components/sidebar-layout.tsx` — full-viewport grid, row 1 = `UpdateBanner` + `AppBar`, row 2 = a single left `SplitPane` (`@ch5me/workspace`, imported line 2). Its `panel` is the left nav (`SidebarProvider`, lines 174–197); main content (`<Outlet/>`, line 204) mounts in the SplitPane child. **This is the live left-nav render path — do not break it.**
- Providers: `apps/desktop/src/renderer/components/root-layout.tsx` renders providers only; `<Outlet/>` at line 191 behind a `contentReady` crossfade. This is where `<SurfaceHostProvider>` will wrap.
- Detail surface: `apps/desktop/src/renderer/components/agent-detail.tsx`:
  - imports `react-reverse-portal` at line 28 (`createHtmlPortalNode, InPortal, OutPortal, HtmlPortalNode`).
  - Two nested right-side `SplitPane`s (lines 574–588 utility panel → `SessionSidePanel`; lines 589–606 document panel → `DocumentPaneShell`), chat innermost child at line 607.
  - **The proven SurfaceHost transport pattern already lives here:** `docPortalNodesRef` keeps one portal node per doc tab across renders (lines 402–408); `InPortal` mounts each doc surface's `tab.render()` ONCE outside the SplitPane tree (lines 565–573); `OutPortal` projects the live node into the visible pane (lines 162–164 inside `DocumentPaneShell`). Switching `activeDocTab` swaps which node the single `OutPortal` shows — DOM/state survives show/hide and tab switch with no remount. **This is exactly ReversePortalTransport; we generalize it.**
  - Surface tabs derive via `mergeSurfaceTabs(getFireflySurfaceTabs(ctx), catalogSurfaceTabs)` (line 307); `ctx.flags` packed from the 17 atoms (lines 287–304).
- Utility tabs: `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx` — Radix `Tabs`; inactive `TabsContent` are CSS-hidden, NOT unmounted (so retention today = "never evict"). Utility tab content renders inline via `tab.render()` (lines 44–86), so switching utility tabs **remounts** (unlike the doc lane).

### Registry / flags (the legacy to delete)
- `apps/desktop/src/renderer/firefly-surface-registry.tsx`: `FireflySurfaceDef` (lines 48–65; note no `defaultZone` — placement driven by `lane` + `target`), `FIREFLY_SURFACE_REGISTRY` array (lines 80–456, 17 rows), `getFireflySurfaceTabs(ctx)` (lines 511–531) binding `render: () => surface.spawn(ctx)`. Drift guard lines 499–509 (`18 = 17 + ["notes"]`).
- `apps/desktop/src/renderer/atoms/feature-flags.ts`: 17 `*SurfaceEnabledAtom` (lines 99–115; Browser is `browserPanelEnabledAtom`), `toggle*` atoms (lines 157–223), `fireflySurfaceDefaults` (77–95), `fireflySurfaceFlagAtoms` (117–135), `fireflySurfaceLabels` (137–155).

### Notes V2 template (proven)
- Anchor commit `df616e407` ("Notes panel served from the plugin catalog … first migrated sidebar"). Manifest `apps/desktop/plugins/notes/manifest.ts`, panel `apps/desktop/plugins/notes/panel/notes-panel.tsx` (`export default`), catalog `apps/desktop/src/main/firefly-plugin/catalog.ts` `BUILT_IN_MANIFESTS`, renderer wiring `apps/desktop/src/renderer/firefly-plugin-surfaces.tsx` (`PLUGIN_PANEL_COMPONENTS` lazy map + `PANEL_ICONS`), flag carry-over `apps/desktop/src/renderer/firefly-plugin-flag-migration.ts`, dispatch `apps/desktop/src/main/firefly-plugin/dispatch.ts`. Test template `apps/desktop/plugins/notes/notes-plugin.test.tsx`. Full recipe in §6.

### Dependencies already installed (no new top-level deps to ship Phase 0)
- `react-reverse-portal ^2.1.1` — already a dep, already used in `agent-detail.tsx`.
- `dockview-react ^6.6.1` — already a dep of `@ch5me/workspace` (and consumable; we vendor the pattern, see §3).
- React 19.2.4 — `<Activity>` available (hidden-UI use only, see §3).

---

## 2. The Unifying Insight (encode verbatim in intent)

The V2 plugin panel component **is** the surface. It is mounted exactly once into the app-owned Surface Host Registry by **stable identity** (not Dockview panel id), lives in a long-lived hidden host layer, and is rendered into a Dockview panel SLOT via a `SurfaceOutlet` that attaches the already-mounted host on layout effect and **detaches (never destroys)** on unmount. The plugin-migration effort and the dock-workspace effort converge at this `SurfaceHost` seam: migrating a surface to the catalog produces the component that the dock slot renders. "Moving a tab" must never equal "unmounting content."

---

## 3. Target Architecture

### CORE DECISION (North Star, verbatim intent)
Do **NOT** let Dockview own heavy content lifetime. Dockview owns ONLY layout, tab chrome, drag/drop, floating/popout, and layout serialization. The app owns a separate **Surface Host Registry** that keeps heavy React/DOM surfaces MOUNTED by stable identity. A Dockview panel is a lightweight SLOT. Moving/revealing a panel attaches the slot to an existing host — it NEVER recreates the host.

### SplitDock decision: COPY, do not import
Survey confirms `@ch5me/workspace` v0.1.3 exports **no** dock/tab/persistence component — all dockview code (zone model, drag bridge, descriptor, component map, theme objects) is story-private in `SplitDockExample.stories.tsx` + `agentDetailScaffold.tsx`, not re-exported, and the demo has **no layout persistence** (panels rebuilt imperatively in `onReady`). The only importable pieces are split-pane primitives + `WS_TOKENS`. **Decision: vendor/copy the SplitDock pattern into palot under `renderer/workspace/`, wrapping `dockview-react` directly; reuse only `WS_TOKENS` and (optionally) `SplitPane` for outer zone frames.** Rationale: we need app-owned layout persistence (toJSON/fromJSON) and a SurfaceHost slot component the package does not provide, and promoting them upstream first would block the overnight campaign. Reconsider upstreaming after the dock shell stabilizes (§9).

### Identity keys (stable, app-owned — NEVER key heavy components by Dockview panel id)
```
chat:sessionId:viewId   editor:fileUri   terminal:ptyId   browser:tabId
```
Enables two live chat panels from different sessions side by side (`chat:session-a:view-main` + `chat:session-b:view-main`) and later two views of one session (`chat:session-a:view-left` / `view-right`). Side-panel surfaces use `<surfaceType>:<sessionId>` (e.g. `review:session-a`) unless the resource demands finer keying.

### Object model (`renderer/surface-host/types.ts`)
```ts
type SurfaceVisibility = "visible" | "hidden" | "detached"

interface SurfaceInstance {
  instanceId: string                 // stable identity key, e.g. "chat:session-a:view-main"
  type: "chat" | "editor" | "terminal" | "browser" | string
  title: string
  createdAt: number
  retainCount: number
  visibility: SurfaceVisibility
  lastFocusedAt?: number
  scroll?: ScrollAnchor              // semantic, see chat pitfall
  focusTarget?: string
  layout?: { width: number; height: number; dpr: number }
}

type DockZone = "main" | "right" | "bottom"
interface DockPanelRecord {
  dockPanelId: string                // Dockview-owned, ephemeral
  zone: DockZone
  surfaceInstanceId: string
  surfaceType: string
  title: string
}
```
**A tab move updates `dockPanel.zone` ONLY. It must NOT recreate `surfaceRegistry[instanceId]`.**

### Transport seam (`renderer/surface-host/transport.ts`)
```ts
interface SurfaceTransport {
  createNode(instanceId: string): void
  mount(instanceId: string, element: ReactNode): void
  attach(instanceId: string, container: HTMLElement): void
  detach(instanceId: string): void
  destroy(instanceId: string): void
}
```
- **First adapter `ReversePortalTransport`** (`renderer/surface-host/transport-reverse-portal.tsx`): wraps `react-reverse-portal` (already used in `agent-detail.tsx`). `createNode`→`createHtmlPortalNode()`; `mount`→render via `InPortal`; `attach`→render `OutPortal` into container; `detach`→stop projecting (host stays mounted). Renders once then moves DOM with no re-render / no state loss. **Wrap it; never use naked reverse-portal.** (Known iframe-reload caveat → see browser pitfall.)
- **Progressive adapter `NativeMoveBeforeTransport`** (`renderer/surface-host/transport-move-before.ts`, §9): feature-detect `Element.prototype.moveBefore()` (Chromium ≥133). Preserves iframe/focus/animation state. Use for app-owned host DOM nodes only, not arbitrary React children inside Dockview. Fallback to reverse-portal / `appendChild` when unavailable.

### Registry (`renderer/surface-host/registry.ts`)
Owns the `Map<instanceId, SurfaceInstance>`, the `SurfaceController` per instance, the active `SurfaceTransport`, and the `DockPanelRecord` table. API: `getOrCreate(instanceId, factory)`, `attachSlot(instanceId, el)`, `detachSlot(instanceId)`, `setVisibility`, `recordDockMove(dockPanelId, zone)`, `evict(instanceId)`. Durable source of truth across `fromJSON` (see §7 warning).

### Controller contract (`renderer/surface-host/controller.ts`)
```ts
interface SurfaceController {
  onAttach(slotEl: HTMLElement): void
  onDetach(): void
  onVisible(): void
  onHidden(): void
  onResize(rect: DOMRectReadOnly): void
  onFocusRequest(reason: string): void
  onDestroy(): void
}
```
Per-type controllers live under `renderer/surface-host/controllers/` (`chat-controller.ts`, `editor-controller.ts`, `terminal-controller.ts`, `browser-controller.ts`, plus a default `passive-controller.ts` for lightweight surfaces). Pitfalls baked into each:
- **Monaco** (`editor-controller.ts`): model lifetime app-owned keyed by URI, SEPARATE from editor widget keyed by `instanceId`; `editor.layout()` in `requestAnimationFrame` after attach (guard the 0-size frame); `ResizeObserver` on the visible slot.
- **Terminal/xterm** (`terminal-controller.ts`): PTY/session lifetime in main/service layer, SEPARATE from xterm widget; `fitAddon.fit()` in rAF after attach; hidden terminals keep PTY alive but ring-buffer output. (Today `terminal-panel.tsx` kills PTY on unmount cleanup — keepAlways required to avoid silent kill.)
- **iframe/browser** (`browser-controller.ts`): never change `src`, never re-render the iframe element via React, prefer `moveBefore()` else keep in always-connected hidden host; reverse-portal has known iframe-reload issues. For real browser panels in Electron prefer `WebContentsView`/`<webview>` over iframe for session/auth/process isolation.
- **chat/virtualized list** (`chat-controller.ts`): store scroll SEMANTICALLY — `{mode:"pinned-to-bottom"}` | `{mode:"anchored-message", messageId, offsetPx}` — NOT raw `scrollTop` (heights change after images/code load); on attach measure → restore anchor → resume auto-scroll if pinned.
- **Focus** (`renderer/surface-host/focus-service.ts`): explicit `focusService.requestFocus(instanceId, {reason})`; each surface implements `focusPrimary/saveFocusState/restoreFocusState`. Don't rely on browser focus surviving moves.
- **Resize** (3 layers): Dockview layout/active events → `ResizeObserver` on slot → `surface.layout(rect)`.

### React `<Activity>` (React 19.2.4)
Use for light/medium hidden UI subtrees INSIDE a surface (hides via `display:none`, cleans up effects when hidden). Do NOT use it to move Monaco/iframe/terminal between zones, and do NOT rely on it for live PTY/stream/iframe lifetime.

### Components / file map (all under `apps/desktop/src/renderer/`)
| Module | Path | Role |
|---|---|---|
| Provider | `surface-host/surface-host-provider.tsx` | `<SurfaceHostProvider>` wraps app (mount in `root-layout.tsx`) |
| Hidden host layer | `surface-host/host-layer.tsx` | `<HiddenSurfaceHostLayer>` mounts ALL heavy surfaces once, long-lived, OUTSIDE Dockview groups |
| Slot/outlet | `surface-host/surface-outlet.tsx` | `<SurfaceOutlet surfaceInstanceId>` / `<DockviewSurfaceSlot>`: registers container, attaches host on layout effect, emits visibility/focus/resize, DETACHES (not destroys) on unmount |
| Registry | `surface-host/registry.ts` | object model + transport orchestration |
| Transport iface | `surface-host/transport.ts` | `SurfaceTransport` |
| Reverse-portal adapter | `surface-host/transport-reverse-portal.tsx` | first adapter |
| moveBefore adapter | `surface-host/transport-move-before.ts` | progressive (§9) |
| Controller iface | `surface-host/controller.ts` + `controllers/*` | per-type lifecycle |
| Focus service | `surface-host/focus-service.ts` | explicit focus |
| Eviction | `surface-host/eviction.ts` | keepAlways/keepLRU/destroyAfterHiddenMs (§EVICTION) |
| Persistence | `surface-host/persistence.ts` | Dockview toJSON/fromJSON separate from surface state (§7) |
| Dock shell | `workspace/dock-shell.tsx` | vendored SplitDock: 3 Dockview zones (main/right/bottom) in nested split frames; panel component = `DockviewSurfaceSlot` |
| Dock theme/bridge | `workspace/dock-theme.ts`, `workspace/dock-drag-bridge.ts` | copied from story; cross-zone native-DnD bridge over `application/x-ch5-panel` |

### Persistence (North Star)
Persist Dockview layout (`api.toJSON`/`fromJSON`) SEPARATELY from app surface state. Serialized panels store only lightweight references `{surfaceInstanceId, zone}`. **Restore order:** restore registry metadata → create hidden hosts lazily → restore Dockview layout → attach visible slots → surface-specific restore/layout/focus. **WARNING:** `fromJSON()` removes panels not in the layout — hidden heavy panels do NOT survive a naive `fromJSON`; the registry is the durable source.

### Eviction policy (`surface-host/eviction.ts`)
`keepAlways` list; `keepLRU` per type (chat:8, editor:20, browser:4, terminal:8); `destroyAfterHiddenMs` per type (chat 30m, editor Infinity, browser 10m, terminal manual). Per-surface assignment in §5.

### Library ranking (decided)
1) App-owned SurfaceHost + adapter — build it. 2) `react-reverse-portal` — best OSS primitive, wrap behind `SurfaceTransport`. 3) native `moveBefore()` — feature-detect progressive enhancement. 4) React `<Activity>` — hidden UI only. **AVOID:** keepalive-for-react (StrictMode-incompatible), react-activation (React 19 + iframe + portal issues), old react-keep-alive.

---

## 4. Reconciliation with Existing Tracked Plans

- **Canonical matrix:** `apps/desktop/src/shared/firefly-plugin/first-party-migration.ts` (`FIRST_PARTY_MIGRATION_MATRIX`, append-only binding ground truth). `ROLLOUT_PHASES` enum is locked: `phase-1 → phase-2 → phase-3 → phase-4 → defer`. We **keep that phase ordering where compatible** (§5 sequences lightweight phase-1 first, chat phase-4 last).
- **Dockview was never explicitly planned.** The supra-audit (`docs/firefly-supra-conversion-audit.md`) and all loom docs contain zero dockview/docking/layout statements (grep-verified). The only `dockview` token in the corpus is an incidental filename (`pm-dockview.tsx`) at `sidebars-as-first-class-plugins.md:69`. **This plan supersedes the implicit "side-panel tab strip stays the switcher" stance with Chris's dated direction (2026-06-15):** the tab strip becomes a dock surface.
- **Authority invariant preserved:** the V2 model locks "plugins may choose from host-defined panel slots / widget zones; they do not mint arbitrary host chrome." The dock shell **is host-owned**: plugins contribute panels into host-owned dock zones; they do NOT mint dock regions. The host-only `side-panel-tab-strip` row is reframed (strip → dock chrome) without making the dock itself a plugin. Host-only exceptions (plugins panel, settings shell, left-nav sidebar, app bar, command-palette shell, startup overlay, update banner, default theme) remain host-only.
- **Flag → enabled migration** stays as decided (`sidebars-as-first-class-plugins.md` Task 5): one-time `flag value → plugin enabled state`, via `SURFACE_FLAG_MIGRATIONS` rows.
- **CRM tension reconciled:** source matrix routes CRM phase-2-plugin; `sidebar-surface-completion.md` says hide it. **Consistent reading: migrate-but-default-off/hidden.** Same for Pulse, CH5PM, Memory, Browser (visible-but-off until proof gates).

---

## 5. Phased Plan (checkbox task list)

> Each per-surface slice = the 4-step convergence in §6 + verification (§8) + a commit. ONE surface per VERIFIED slice. Build agents must follow §6 verbatim.

### Phase 0 — Foundation (behind temporary `workspaceDock` flag)
- [ ] Add temporary `workspaceDockEnabledAtom` (flag key `workspaceDock`) to `atoms/feature-flags.ts` — the ONLY new flag; removed in Cleanup.
- [ ] `surface-host/types.ts` — object model (§3).
- [ ] `surface-host/transport.ts` + `surface-host/transport-reverse-portal.tsx` (`ReversePortalTransport`).
- [ ] `surface-host/registry.ts` + `surface-host/surface-host-provider.tsx`; mount `<SurfaceHostProvider>` in `root-layout.tsx`.
- [ ] `surface-host/host-layer.tsx` (`<HiddenSurfaceHostLayer>`) — mounts heavy surfaces once, outside Dockview.
- [ ] `surface-host/surface-outlet.tsx` (`<SurfaceOutlet>` / `<DockviewSurfaceSlot>`) — register/attach/detach + emit visibility/focus/resize.
- [ ] `surface-host/controller.ts` + `controllers/passive-controller.ts` + `focus-service.ts` + resize wiring (3-layer).
- [ ] `workspace/dock-shell.tsx` + `dock-theme.ts` + `dock-drag-bridge.ts` — vendor SplitDock (copy from `SplitDockExample.stories.tsx` + `agentDetailScaffold.tsx`), Dockview panel component = `DockviewSurfaceSlot`, reuse `WS_TOKENS`.
- [ ] Proof surfaces in dock: **CHAT** (mounted via SurfaceHost, identity `chat:<sessionId>:view-main`) + **ONE simple panel** (`files` or `review`).
- [ ] Gate: `agent-detail.tsx` renders dock shell when `workspaceDock` on, else legacy SplitPane path (parallel, no regression to live left-nav path).
- [ ] **Verified:** `electron-vite` build green; `tsc` clean; `eslint` clean; app launches; move the proof panel main→right→bottom and confirm state preserved (no remount). Commit.

### Phase 1..N — Per-surface slices (matrix order; lightweight first)
Each surface row lists **resource type → retention** and the per-surface gotcha. Order chosen so each slice adds at most one new platform seam (mirrors plan §2.4 intra-phase-1 ordering, extended through phases 2–3).

**Lightweight / passive controller first (prove attach/detach + flag deletion):**
- [ ] **review** — `components/review/review-panel.tsx`; virtualized list (TanStack Virtual) + Shiki worker pool → **keepLRU**. Gotcha: preserve scroll + per-file expand/"load diff" gates + in-progress diff comment edits; worker pool warmup. Pairs with git diff IPC bridge.
- [ ] **files** — `components/side-panel/files-panel.tsx`; in-memory tree + git decorations → **keepLRU**. Gotcha: preserve expanded-dir set, loaded children, selected path, root nav stack; broker-gated `main/files.ts` IPC.
- [ ] **artifacts** — `components/side-panel/artifacts-panel.tsx`; jotai list → **destroyAfterHiddenMs ~60s**. Gotcha: scroll only; paired genui-artifacts widget zone is separate.
- [ ] **bridges** — `components/side-panel/bridges-panel.tsx`; react-query polling → **destroyAfterHiddenMs ~60s**. Capability `host:bridge.session-read`; preserve selected channel/scroll.
- [ ] **memory** — `components/side-panel/memory-panel.tsx` (lazy via `PluginPanelBoundary`) → **keepLRU**. Gotcha: preserve unsaved draft textarea + search query; destroy forces chunk reload, not just refetch. Default-off.
- [ ] **pulse** — `components/side-panel/pulse-panel.tsx`; jotai metrics 60s tick → **destroyAfterHiddenMs ~30s**. Default-off, low-traffic observability.

**Monaco:**
- [ ] **editor** — `components/side-panel/editor-panel.tsx`; Monaco → **keepAlways**. Identity `editor:<fileUri>`. Use `editor-controller.ts`: model app-owned by URI, widget by instance; `editor.layout()` in rAF (guard 0-size); ResizeObserver on slot. Preserve undo stack + dirty buffer + cursor/scroll.

**PTY-backed:**
- [ ] **terminal** — `components/side-panel/terminal-panel.tsx`; xterm + PTY (`main/pty.ts`) → **keepAlways**. Identity `terminal:<ptyId>`. `terminal-controller.ts`: PTY in main/service layer separate from widget; `fitAddon.fit()` in rAF; hidden keeps PTY alive + ring-buffers. Teardown must `cancel-in-flight-tool`. NOTE: panel self-kills PTY on unmount today — keepAlways mandatory.
- [ ] **claude** — `components/side-panel/claude-panel.tsx`; NO live runtime (react-query detection) → **destroyAfterHiddenMs ~30s**. Lightweight despite PTY family; Claude Code parity surface (phase-3).
- [ ] **oracle** — `components/side-panel/oracle-panel.tsx`; polling tmux roster, PTY spawns elsewhere → **destroyAfterHiddenMs ~60s**. Preserve create/rename/delete form + hidden-set (localStorage) + scroll.

**iframe / webview (only after attach/detach proven not to reload):**
- [ ] **browser** — `components/side-panel/browser-panel.tsx`; iframe/webview (selkies-stream/CDP) → **keepAlways**. Identity `browser:<tabId>`. `browser-controller.ts`: never change src, prefer `WebContentsView`/`<webview>` for isolation, else always-connected hidden host; reverse-portal iframe-reload caveat applies. Capability `host:browser.lane-control`. Default-off until proof gate.
- [ ] **studio** — `components/side-panel/studio-panel.tsx`; iframe (office→PDF via LibreOffice) → **keepLRU**. `lane:"document"`. Gotcha: avoid re-running expensive conversion; preserve converted-PDF src + selected doc + scroll. Phase-3 iframe escape-hatch policy.
- [ ] **ch5pm** — `ch5pm-dashboard/panel.tsx` (`Ch5PmDashboardPanel`); live SSE `EventSource` → **keepLRU**. Gotcha: keep the open SSE subscription + accumulated rows; reconnect is disruptive. Default-off.
- [ ] **pdf-review** — `components/side-panel/pdf-review-panel.tsx`; placeholder stub today → **destroyAfterHiddenMs** now, **promote to keepLRU** when PDF.js viewer lands. `lane:"document"`. Teardown must `cancel-in-flight-tool` (locator dispatch). Sequenced early in source plan to prove cancellation, but kept here in iframe/document group.

**Media:**
- [ ] **voice** — `components/side-panel/voice-panel.tsx`; mic capture (`VoiceButton`) → **keepAlways while capturing, else destroyAfterHiddenMs**. Gotcha: must not interrupt in-flight recording; preserve active session + last transcript + pane-writer target. Phase-3 audio-capture capability.

**Default-off / hide:**
- [ ] **crm** — `components/side-panel/crm-panel.tsx`; react-query polling + inbox thread → **keepLRU**. Gotcha: preserve unsaved contact-edit form + in-progress inbox draft + selected customer. **Migrate-but-default-off/hidden** (reconciles matrix vs completion-plan).

**Host-only — do NOT migrate (reframe only):**
- [ ] **plugins** — `components/side-panel/v2-plugins-panel.tsx` (`V2PluginsPanel`). HOST-ONLY (operator UI for the catalog; self-reference loop). Stays host-owned; becomes a dock surface rendered by the host, not a plugin. → **destroyAfterHiddenMs ~30s**.

### Phase Chat-in-dock (LAST surface)
- [ ] Move `ChatView` (`components/chat`) itself into a dock panel surface, identity `chat:<sessionId>:view-main`, using `chat-controller.ts` (semantic scroll anchor). This is matrix phase-4 ("core chat loop migrates LAST, after the side-panel tier proves the platform"). Prove two chat sessions side by side independently (`chat:session-a:view-main` + `chat:session-b:view-main`).

### Phase Cleanup (no legacy remains)
- [ ] DELETE `FIREFLY_SURFACE_REGISTRY` and all of `firefly-surface-registry.tsx` once every row migrated; remove `getFireflySurfaceTabs` consumers.
- [ ] DELETE all 17 `*SurfaceEnabledAtom` + `toggle*SurfaceAtom` + `fireflySurfaceDefaults`/`fireflySurfaceFlagAtoms`/`fireflySurfaceLabels` in `atoms/feature-flags.ts`.
- [ ] Remove the temporary `workspaceDock` flag/atom and the legacy gate branch in `agent-detail.tsx`.
- [ ] Remove the old `SplitPane`-based layout in `agent-detail.tsx` and the right-side panes; `sidebar-layout.tsx` left `SplitPane` evaluated — keep only if still the host chrome frame, else fold into dock shell.
- [ ] Remove now-dead `mergeSurfaceTabs` legacy branch (catalog is the sole source).
- [ ] Drift guard / `CATALOG_SERVED_SURFACE_IDS` updated to reflect 17/17 catalog-served.
- [ ] Verified clean build/typecheck/lint/launch. Commit.

### Phase Persistence + Eviction + Regression tests
- [ ] `surface-host/persistence.ts` — Dockview layout toJSON/fromJSON separate from surface state; restore order per §3; registry as durable source.
- [ ] `surface-host/eviction.ts` — keepAlways/keepLRU/destroyAfterHiddenMs enforced per §5 assignments.
- [ ] Regression tests (North Star, the 5):
  - [ ] chat main→right→bottom preserves scroll (semantic anchor restored).
  - [ ] Monaco undo survives move.
  - [ ] terminal buffer survives move (PTY alive).
  - [ ] iframe no reload on move (browser/studio).
  - [ ] two chat sessions independent side by side.

---

## 6. Per-Surface Migration Checklist (reusable template)

> Assumes notes-landed infra exists: invoke-tool IPC (`ipc.ts:214`), preload `invokeTool` (`preload/index.ts`), `plugins/**` tsconfig globs, `runFireflyPluginFlagMigrations()` in `main.tsx`, the merge seam. For each surface `<X>`:

1. **Move the panel component.** Relocate `components/side-panel/<X>-panel.tsx` → `apps/desktop/plugins/<X>/panel/<X>-panel.tsx`. Props `{ agent: Agent }` (PluginPanelProps); ensure `export default`. Strip nothing else.
2. **Write the manifest** `apps/desktop/plugins/<X>/manifest.ts` (copy `notes/manifest.ts`): `id:"firefly.built-in.surface.<X>"`, `trust:"built-in"`, `apiVersion:"firefly.plugin/v2"`. One `contributes.panels[]`: `formFactor:"side-panel-tab"`, `defaultZone:"side-panel"`, `render:{mode:"host-reconciler"}`, `icon:"<lucide-name>"`. **`persistenceKey` and `telemetryNamespace` MUST byte-match the old registry row** (stable identity). `commands`: `open-<X>` + `toggle-<X>` (`["host:command.register"]`). `tools` (template includes): `plugin.<id>.open` + `plugin.<id>.state`. `activationEvents` for panel + each command + each tool. `capabilities` = superset of all `requires`. Export `<X>_PLUGIN_ID` etc.
3. **Register in catalog** — `catalog.ts`: import manifest, add to `BUILT_IN_MANIFESTS` (~`:80`), add to `KNOWN_PLUGIN_IDS` (~`:429`).
4. **Register renderer surface** — `firefly-plugin-surfaces.tsx`: add `"<id>.<panelId>": lazy(() => import("../../plugins/<X>/panel/<X>-panel"))` to `PLUGIN_PANEL_COMPONENTS` (~`:48`); add icon-name→Lucide to `PANEL_ICONS` (~`:55`).
5. **Confirm tab id in unions** — projected `contributionId` must be a `SidePanelTabId` (`atoms/ui.ts:32`) and present in `SIDE_PANEL_TAB_ORDER` (`firefly-plugin-surface-merge.ts:23`), else `catalogPanelToTabDescriptor` silently returns null.
6. **Register host handlers** — `dispatch.ts`: add `register<X>HostHandlers()` modeled on `registerNotesHostHandlers` (`:367`); wire `open-<X>`/`.open` → `broadcastOpenSidePanel("<X>")`, `.state` → ui-state snapshot, `toggle-<X>` → `authority.setPluginEnabled`; call from `registerBuiltInHostCommands` (~`:491`).
7. **Add flag migration row** — `firefly-plugin-flag-migration.ts:25`: append `{ pluginId:"firefly.built-in.surface.<X>", legacyStorageKey:"elf:<X>SurfaceEnabled" }`.
8. **Surface-host wiring (NEW vs notes):** register the surface in `host-layer.tsx` with its stable `instanceId` + retention bucket (§5) + controller (`controllers/<type>-controller.ts`); ensure the dock slot renders it via `<DockviewSurfaceSlot>`.
9. **Delete the V1 registry row** — `firefly-surface-registry.tsx`: remove the `FIREFLY_SURFACE_REGISTRY` entry, its panel import, its now-unused icon import. Leave "served from catalog — do not re-add" comment.
10. **Delete the V1 feature flag** — `atoms/feature-flags.ts`: remove from `fireflySurfaceDefaults`, `<X>SurfaceEnabledAtom`, `fireflySurfaceFlagAtoms`, `fireflySurfaceLabels`, `toggle<X>SurfaceAtom`.
11. **Rewire flag consumers** — `agent-detail.tsx` + `command-palette.tsx`: drop `<X>SurfaceEnabled` reads/deps; in `command-palette.tsx` (~`:276`) derive enabled from `useFireflyPlugins()` entry status (`!== "disabled" && !== "quarantined"`), toggle via `window.elf.plugins.setEnabled(id, !enabled)` + invalidate `["firefly-plugin"]`.
12. **Add slice-proof tests** (mirror `plugins/notes/notes-plugin.test.tsx`): grep-proof registry row gone; catalog-only serving; stable persistenceKey/telemetryNamespace; tool-dispatch envelopes (unknown/invalid-args/disabled/quarantined); disable↔enable round-trip; 3-crash quarantine; flag-migration idempotency. PLUS surface-host proof: attach/detach preserves the surface's live state per its retention bucket.
13. **Verify + ship.** firefly-plugin test suite + `electron-vite` build (confirm `<X>-panel-*.js` lazy chunk) + the relevant regression test (§8). Commit/push per repo policy.

**Invariants:** exactly one panel per surface; surface renders exactly once (catalog wins merge collision); identity keys unchanged; fail-loud on missing component registration (`firefly-plugin-surfaces.tsx:172`) and on disk manifests claiming built-in trust (`catalog.ts:241`); enable/disable moves renderer-atom → host lifecycle with one-time idempotent carry-over; **a tab move updates `dockPanel.zone` only and never recreates the host.**

---

## 7. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| `fromJSON()` drops panels not in layout | Hidden heavy surfaces vanish on restore | Registry is durable source of truth; restore order = registry metadata → hidden hosts → `fromJSON` → attach slots → surface restore. Never expect hidden panels to survive naive `fromJSON`. |
| iframe reload on move (browser/studio) | stream/auth/conversion lost | Never change src; prefer `WebContentsView`/`<webview>` + `moveBefore()`; else always-connected hidden host; document reverse-portal iframe-reload caveat; gate browser default-off until proven. |
| PTY lifetime coupling (terminal) | Tab move silently kills user shell | keepAlways; PTY in main/service layer separate from xterm widget; controller never destroys PTY on detach; hidden ring-buffers. Regression test: buffer survives move. |
| Monaco 0-size layout | blank/broken editor after attach | `editor.layout()` in rAF, guard 0-size frame; ResizeObserver on visible slot; model lifetime separate from widget. |
| Focus loss on move | keyboard/cursor jumps | Explicit `focusService.requestFocus`; per-surface save/restore focus state; don't rely on browser focus surviving DOM move. |
| Concurrent agents on `main` | rebase conflicts overnight | One surface per slice + one commit; `git pull --rebase` → reapply → pathspec-commit only touched files → push retry on non-fast-forward. Concurrent change is steady state, never a blocker. |
| Breaking the live left-nav render path | app unusable | Phase 0 gates dock behind `workspaceDock`; legacy SplitPane path untouched until Cleanup; left-nav (`sidebar-layout.tsx`) stays host chrome; verify launch each slice. |
| reverse-portal StrictMode/double-mount quirks | duplicate hosts | Wrap behind `SurfaceTransport`; registry `getOrCreate` idempotent by instanceId. |
| Eviction kills keepLRU surface with unsaved draft | data loss (memory/crm) | keepLRU never auto-destroys under non-pressure; persist drafts; destroyAfterHiddenMs only for fully-reconstructible surfaces. |

---

## 8. Verification Strategy & Definition of Done

**Per slice:** `electron-vite` build green → `tsc --noEmit` clean → `eslint` clean → app launches to the live left-nav/chat path → the surface opens in the dock → the relevant regression test from its retention bucket passes (state preserved across main→right→bottom move). Then firefly-plugin test suite green + slice-proof test (§6.12). Commit + push; push not "done" until repo-required CI for that commit passes.

**Campaign DoD:**
- All 17 side-panel surfaces (16 plugins + `plugins` host-only reframed) catalog-served; `FIREFLY_SURFACE_REGISTRY` deleted; all `*SurfaceEnabledAtom` deleted; temporary `workspaceDock` flag removed; old `SplitPane` app layout removed.
- Chat in a dock panel; two chat sessions side by side independent.
- All 5 regression tests pass: chat scroll, Monaco undo, terminal buffer, iframe no-reload, two-session independence.
- `git status --short` clean; CI green for the final commit.

---

## 9. Out of Scope / Future

- **`NativeMoveBeforeTransport`** (`Element.prototype.moveBefore()`, Chromium ≥133) is progressive enhancement: build the adapter behind feature detection after the reverse-portal path is fully proven; not required for campaign DoD.
- **Upstreaming the dock shell** to `@ch5me/workspace` (promote the vendored SplitDock + SurfaceOutlet + persistence into the package) — revisit after the shell stabilizes in palot.
- **Module-federation third-party plugin sandbox** — out of scope; this campaign is built-in surfaces only.
- **pdf-review real PDF.js viewer** — separate work; this plan only relocates the stub and promotes its retention to keepLRU when the viewer lands.
