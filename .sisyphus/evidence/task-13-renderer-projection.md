# Task 13 — Renderer Projection Architecture <!-- oc:id=sec_aa -->

> Wave 3, Task 13 of plan `firefly-plugin-system-v2`. Do not modify the plan file.
> Grounded in: Task 7 manifest schema (canonical `PluginDescriptor`),
> Task 8 family contracts, Task 6 lifecycle / trust tiers, plan §`Source Of Truth Model`.

## 0. One-line stance <!-- oc:id=sec_ab -->

`PluginDescriptor` is the canonical contribution source of truth. The renderer
never holds its own canonical list of side panels, widgets, commands, or themes.
`firefly-surface-registry.tsx`, `session-widget-registry.tsx`, and the
hardcoded command list in `command-palette.tsx` are demoted to **consumer
shims over a host-derived projection stream**. `atoms/session-widgets.ts`
remains the only host-owned placement atom because widget placement is
session-scoped host state, not a contribution.

## 1. Renderer projection architecture <!-- oc:id=sec_ac -->

### 1.1 Where `PluginDescriptor` is consumed

The host main process owns the four canonical runtime objects
(`PluginManifest`, `PluginDescriptor`, `PluginInstance`, `PluginSessionHandle`).
Main process derives a serialized **projection stream** and ships it to the
renderer over the existing `window.elf` IPC seam. The renderer never imports
plugin manifests directly and never parses Zod; it subscribes.

```text
main process                                renderer
-----------                                 --------
plugin catalog (disk)
  +-> Zod parse + normalize                 +----------------------------+
        +-> PluginDescriptor (canonical)    | usePluginProjectionStream |
              +-> PluginInstance ---------> +-> projectionReducer       |
              +-> PluginSessionHandle ----> |   +- panelDefs            |
                                              |   +- widgetDefs           |
capability broker (deny-by-default) -------> |   +- commandDefs          |
lifecycle supervisor (state + posture) ----> |   +- themeDefs            |
                                              |   +- toolDefs (passthru)  |
                                              |   +- uiHints              |
                                              +----------------------------+
                                                          |
                                              Jotai projection atoms
                                              (panelsAtom, widgetsAtom,
                                               commandsAtom, themesAtom,
                                               availabilityAtom)
```

The renderer projection has **three** inputs and produces **four** derived
collections plus **two** cross-cutting signals. There is no per-plugin
arbitrary data type in V2; every contribution is bucketed into one of the
four families from Task 8.

### 1.2 Projection stream event shape

Main process pushes a single event type with discriminated `kind`. Each event
is a structural diff the renderer applies to its atoms. The renderer never
re-derives contribution data; it only applies the diff and lets React/Jotai
re-render.

```ts
// apps/desktop/src/shared/plugin-projection.ts (new)
import type { z } from "zod"
import type { PluginDescriptor, PluginInstance, PluginSessionHandle } from "./plugin-descriptor"

export type ProjectionProjection =
  | { kind: "plugin.snapshot"; pluginId: string; descriptor: PluginDescriptor; instance: PluginInstance; session: PluginSessionHandle | null }
  | { kind: "plugin.removed"; pluginId: string }
  | { kind: "plugin.panels.dirty"; pluginId: string; panels: ProjectedPanelDef[] }
  | { kind: "plugin.widgets.dirty"; pluginId: string; widgets: ProjectedWidgetDef[] }
  | { kind: "plugin.commands.dirty"; pluginId: string; commands: ProjectedCommandDef[] }
  | { kind: "plugin.themes.dirty"; pluginId: string; themes: ProjectedThemeDef[] }
  | { kind: "session.toolAvailability.changed"; pluginId: string; sessionId: string; available: boolean; reasonCode?: string }
```

Renderer applies events into:

| Atom | Source | Why it's an atom |
|---|---|---|
| `pluginCatalogAtom` | `plugin.snapshot` + `plugin.removed` | Full per-plugin state, used by operator surfaces (Task 24) |
| `projectedPanelsAtom` | `plugin.panels.dirty` | Memoized `ProjectedPanelDef[]` keyed by `<pluginId>/<contributionId>` |
| `projectedWidgetsAtom` | `plugin.widgets.dirty` | Memoized `ProjectedWidgetDef[]` |
| `projectedCommandsAtom` | `plugin.commands.dirty` | Memoized `ProjectedCommandDef[]` |
| `projectedThemesAtom` | `plugin.themes.dirty` | Memoized `ProjectedThemeDef[]` |
| `pluginAvailabilityAtom` | `plugin.snapshot` + lifecycle | Map `pluginId -> AvailabilityState` (see section 3) |
| `sessionToolAvailabilityAtom` | `session.toolAvailability.changed` | Map `pluginId -> Map<sessionId, boolean>` |

The current `firefly-surface-registry.tsx` and `session-widget-registry.tsx`
files become **derivation functions** that read from these atoms. They are not
deleted in V2; they are rewritten as pure consumers.

### 1.3 Ownership table (locked)

| Object | Owns | Does NOT own |
|---|---|---|
| `PluginDescriptor` (main) | identity, contributions, declared capabilities, declared entry points, manifest metadata | runtime state, persistence keys, telemetry namespaces, command ids, placement |
| `PluginInstance` (main) | activation state, crash counters, posture, transport handle, granted capability subset | contributions, persistence keys |
| `PluginSessionHandle` (main, per session) | session availability, per-session tool exposure, session-scoped visibility | contributions, host-owned placement |
| Renderer projection (main, derived) | host-derived `persistenceKey`, host-derived `telemetryNamespace`, host-derived `commandIds`, host-derived `target`, host-derived render factory reference | plugin identity, plugin entry, plugin business logic |
| Renderer atoms (renderer) | last-applied projection snapshot, Jotai subscription fan-out | any canonical contribution data |

### 1.4 Why the renderer does not hold a registry

Per plan §`Source Of Truth Model`, four projections consume the four canonical
runtime objects. Letting the renderer hold its own registry:

- re-introduces a parallel source of truth for contributions
- blocks OpenCode bridge from seeing the same data without duplication
- forces a second update channel on hot reload (renderer + OpenCode) with
  drift risk
- makes per-session availability and quarantine impossible to compute at
  registry build time

The renderer holds the **last applied projection** so the UI can render
without re-fetching. The host main process is the only writer; renderer is
subscribe-only.

## 2. Field mapping: current `firefly-surface-registry` -> V2 projection <!-- oc:id=sec_ad -->

The current `FireflySurfaceDef` (apps/desktop/src/renderer/firefly-surface-registry.tsx)
maps cleanly into the V2 projection. The same mapping applies to
`FireflySidePanelTab` (the read-model) and to `SessionWidgetDefinition` (apps/desktop/src/renderer/session-widget-registry.tsx)
by family substitution. `commands` projection derives from
`CommandContribution` in Task 8 section 4. `themes` projection from Task 8 section 5.

| Current field on `FireflySurfaceDef` (V1) | V2 source | V2 projection field | Where computed |
|---|---|---|---|
| `id: SidePanelTabId` (literal union, 18 ids) | `contributes.panels[i].id` from descriptor | `ProjectedPanelDef.id` = host-namespaced `<pluginId>/<id>` | host namespacing function in main |
| `title: string` | `contributes.panels[i].title` | `ProjectedPanelDef.title` (passthrough) | none |
| `icon: LucideIcon` (literal import) | `contributes.panels[i].icon` (string token, e.g. `"git-branch"`) | `ProjectedPanelDef.iconToken: string` | host icon registry maps string -> Lucide component |
| `formFactor: "side-panel-tab" \| "main-pane"` | derived from `location: "sidebar-left" \| "sidebar-right" \| "bottom" \| "main"` | `ProjectedPanelDef.formFactor: "side-panel-tab" \| "main-pane"` | host form-factor map (sidebar-* + bottom -> side-panel-tab; main -> main-pane) |
| `enabledFlag: { key, atom }` (per-surface feature flag atom) | `defaultEnabled` + lifecycle `state` + `enablement.global/perProject` (Task 6) | `ProjectedPanelDef.enabled: boolean` + `ProjectedPanelDef.enabledReasonCode?: string` | host derivation per section 3 |
| `defaultOn: boolean` | `contributes.panels[i].defaultEnabled` | folded into `enabled` computation | none |
| `availability: (ctx) => Availability` (live function) | `PluginSessionHandle.availability` + `when` (declarative) + `requiresCapabilities` (manifest) + lifecycle `state` | `ProjectedPanelDef.availability: AvailabilityState` enum (see section 3) | host projection reducer; renderer treats as data, not code |
| `commandIds: string[]` (e.g. `["surface.review.open", "surface.review.toggle"]`) | `contributes.commands[i].id` declared by plugin, plus host-generated `plugin.<id>.open` and `plugin.<id>.state` (Task 8 section 2) | `ProjectedPanelDef.commandIds: string[]` | host namespacing: `surface.<id>.open` is an alias for `plugin.<pluginId>.<panelId>.open`; renderer sees both old and new ids during migration |
| `persistenceKey: string` (e.g. `"side-panel.review"`) | not in manifest; derived from `id` | `ProjectedPanelDef.persistenceKey = "side-panel.<pluginId>/<contributionId>"` | host namespacing function; first-party migration task (Task 19) maps old keys to new keys once |
| `telemetryNamespace: string` (e.g. `"firefly.surface.review"`) | not in manifest; derived from `pluginId` + `id` | `ProjectedPanelDef.telemetryNamespace = "firefly.plugin.<pluginId>.<contributionId>"` | host namespacing function; old `firefly.surface.*` namespaces remain valid for built-in plugins via stable alias table |
| `target: FireflySurfaceTarget` (e.g. `{ kind: "side-panel", tab: "review" }`) | derived from `location` | `ProjectedPanelDef.target: ProjectedPanelTarget` (host enum: `side-panel`, `main-pane`, `bottom-dock`) | host form-factor map |
| `spawn: (ctx) => ReactNode` (literal component reference) | `entry: string` (worker module path + export) | `ProjectedPanelDef.renderFactory: (ctx) => ReactNode` (host-resolved lazy import) | host: import the worker's `entry` and bind it to a host-rendered reconciler context; plugins cannot inject raw React components into host tree directly (host reconciler is the only path; iframe is the only escape hatch - Task 8 section 2) |
| n/a (V1 has no lifecycle link) | `PluginInstance.state`, `PluginInstance.posture` | `ProjectedPanelDef.lifecycleState`, `ProjectedPanelDef.posture` | host projection reducer |
| n/a (V1 has no session binding) | `PluginSessionHandle.sessionId` | `ProjectedPanelDef.sessionId` (if surface is session-scoped) | host projection reducer |
| n/a (V1 has no capabilities) | `contributes.panels[i].requiresCapabilities` + granted subset | `ProjectedPanelDef.requiredCapabilities: CapabilityId[]`, `ProjectedPanelDef.grantedCapabilities: CapabilityId[]` | host capability broker |
| n/a (V1 has no iframe declaration) | `surface: "reconciler" \| "iframe"` | `ProjectedPanelDef.surface: "reconciler" \| "iframe"`, `ProjectedPanelDef.iframeSandbox?: string`, `ProjectedPanelDef.iframeSrc?: string` | host applies `sandbox` attribute; per Task 8 section 2, iframe requires `host:ui` + `networkDomains` allowlist |
| n/a (V1 has no async/loading state) | plugin worker startup | `ProjectedPanelDef.loadingState: "loading" \| "ready" \| "errored"` (see section 3) | host projection reducer |

The same shape applies to widgets by substitution: `entry` becomes
`renderFactory` resolving to a host-defined `WidgetZone` slot, `defaultZoneId`
is preserved as the host's seed zone vocabulary
(`above-chat` | `chat-inline-right` per Task 8 section 3), and `placement` is still
read from `atoms/session-widgets.ts` because placement is session-scoped host
state, not a contribution.

## 3. Per-state UI states <!-- oc:id=sec_ae -->

A projected surface has **two** orthogonal state dimensions:
`AvailabilityState` (semantic: can the user see/interact with this?) and
`LoadingState` (mechanical: is the worker ready to render?). Both are derived
on the host and stamped onto `ProjectedPanelDef` / `ProjectedWidgetDef` /
`ProjectedCommandDef` / `ProjectedThemeDef`.

### 3.1 `AvailabilityState` enum

```ts
export type AvailabilityState =
  | { kind: "available" }                                    // surface is live and ready
  | { kind: "loading"; reason: "worker-starting" | "session-attaching" | "manifest-validating" }
  | { kind: "unavailable"; reason: UnavailableReason }       // surface is not usable right now
  | { kind: "errored"; reason: ErrorReason; cause?: string } // surface failed and needs attention
  | { kind: "quarantined"; reason: QuarantineReason; since: number } // posture overlay from Task 6 section 2.3
```

### 3.2 `UnavailableReason` enum (UI-readable reasons)

| Reason | Trigger | User-visible message | First-party mapping (V1) |
|---|---|---|---|
| `flag-disabled` | `defaultEnabled` false, host preference off | "Surface is disabled in preferences" | current `feature-flags.ts` `false` |
| `capability-missing` | `requiresCapabilities` not in granted subset | "Plugin needs additional permissions" | n/a (V1) |
| `not-in-session` | surface is session-scoped, no session bound | "Open a session to use this surface" | n/a (V1) |
| `session-disconnected` | `PluginSessionHandle.available === false`, OpenCode server lost | "Session lost, reconnecting..." | n/a (V1) |
| `host-version-too-new` | `fireflyClientVersion` in manifest > host | "Plugin needs a newer version of Firefly" | n/a (V1) |
| `host-version-too-old` | `fireflyClientVersion` < host-supported floor | "Plugin requires an older version of Firefly" | n/a (V1) |
| `tier-rejected` | tier detection produced `rejected` (Task 6 section 6.3) | "Plugin was rejected at install time" | n/a (V1) |
| `no-active-server` | OpenCode bridge offline (Task 14 server-mode matrix) | "No active server" | n/a (V1) |
| `desktop-feature-off` | renderer-only feature flag (legacy V1 case during migration) | "Feature is disabled" | current `feature-flags.ts` `false` (compatibility shim) |
| `command-only` | widget zone disabled in this session (e.g. `chat-inline-right` off) | "Zone not enabled in this session" | current `inlineRightEnabled: false` |
| `custom` | plugin-declared `when` expression evaluated false | plugin-supplied message | n/a (V1) |

### 3.3 `ErrorReason` enum (failure states)

| Reason | Trigger | User-visible message | Recovery |
|---|---|---|---|
| `worker-crashed` | `PluginInstance.crashCount > 0`, posture not yet quarantined | "Plugin crashed (N times). Restarting..." | auto-restart until posture threshold (Task 6 section 5.1) |
| `worker-hung` | heartbeat missed > ceiling | "Plugin is not responding" | force-quarantine per Task 11 |
| `entry-not-found` | `entry` module path did not resolve | "Plugin entry point not found" | re-install |
| `entry-threw` | `entry` import or factory threw | "Plugin failed to start" | surface stays `errored` until reload |
| `capability-violation` | plugin asked for cap not in manifest | "Plugin asked for an undeclared permission" | auto-quarantine (`capability-violation` per Task 6 section 5.1) |
| `api-incompatible` | host SDK rejected plugin's bundle shape | "Plugin is not compatible with this Firefly build" | re-install at compatible version |
| `iframe-src-denied` | iframe `src` not in `networkDomains` allowlist | "Plugin iframe source blocked" | capability prompt or reject |
| `iframe-load-failed` | iframe `load` event returned non-OK | "Plugin iframe failed to load" | user can retry |

### 3.4 `QuarantineReason` enum (posture overlay)

Direct passthrough of Task 6 section 5.1 enum: `restart-loop`, `runtime-unstable`,
`capability-violation`, `signature-mismatch`, `api-abuse`, `operator-action`,
`publisher-revoked`. Renderer adds the `since` timestamp for badge display.

### 3.5 `LoadingState` enum (mechanical)

```ts
export type LoadingState =
  | { kind: "idle" }                                          // never started
  | { kind: "loading"; sub: "manifest-fetch" | "manifest-parse" | "worker-start" | "session-attach" | "first-render" }
  | { kind: "ready" }
  | { kind: "failed"; error: ErrorReason; cause?: string }    // transitions to errored availability
```

`LoadingState` is independent of `AvailabilityState` only for
`kind: "loading"`; everything else collapses into the availability semantics
above. Renderer renders `loading` skeleton until `LoadingState.kind === "ready"`
**and** `AvailabilityState.kind === "available"`. A `loading` surface with
`unavailable` reason (e.g. `flag-disabled` while worker is still spinning up)
renders the unavailable message with a "loading..." badge so the user sees the
underlying reason once the worker finally responds.

### 3.6 Per-state UI behaviors (canonical matrix)

| `AvailabilityState.kind` | `LoadingState.kind` | UI render | Telemetry event | Tool exposure |
|---|---|---|---|---|
| `available` | `ready` | full surface, normal chrome | `surface.opened` on first render | full |
| `available` | `loading` (sub: `first-render`) | surface body + skeleton header | `surface.skeleton-shown` | full |
| `loading` | any | empty placeholder with spinner; no chrome | `surface.loading` | none (no commands run) |
| `unavailable` (`flag-disabled`) | any | disabled tab/button with tooltip; opens settings on click | `surface.unavailable.flag-disabled` | commands hidden from palette |
| `unavailable` (`capability-missing`) | any | disabled tab with "needs permission" badge; click opens permission prompt | `surface.unavailable.capability-missing` | commands hidden |
| `unavailable` (`no-active-server` / `session-disconnected`) | any | disabled tab with reconnect badge | `surface.unavailable.session-lost` | commands hidden |
| `errored` (`worker-crashed`) | `failed` | error card with "Restart plugin" + "View logs" actions | `surface.errored.worker-crashed` | commands disabled, status `denied` |
| `errored` (`entry-thrown`) | `failed` | error card with "Reload plugin" action | `surface.errored.entry-thrown` | commands disabled |
| `quarantined` | n/a (worker forced stop) | quarantined badge with reason; "Review" link to operator surface | `surface.quarantined.<reason>` | commands return `unavailable` / `PLUGIN_QUARANTINED` |
| `unavailable` (`command-only` widget zone) | any | widget hidden; zone shows empty | `surface.unavailable.zone-disabled` | n/a |

The matrix above is the contract. Renderer is forbidden from inventing
additional states; new reasons must be added to the enums and the matrix
together. This is what makes "loading/error/availability semantics exist for
projected surfaces" a verifiable acceptance criterion.

### 3.7 First-run / activation window

Per Task 6 section 2.2, the lifecycle state `activating` is the only state where
surfaces can be partially projected. Renderer rule:

- `state === "activating"` -> `AvailabilityState.kind === "loading"`,
  `LoadingState.sub === "worker-start"`. No `surface.opened` telemetry yet.
- `state === "active"` -> `AvailabilityState.kind === "available"` once
  `LoadingState.kind === "ready"`. Emit `surface.opened` on transition.
- `state === "degraded"` -> `AvailabilityState.kind === "errored"` with
  `ErrorReason.worker-hung` (or similar). Telemetry adds `surface.degraded`
  per Task 11 supervisor ticks.
- `state === "disabled"`, `installed`, `validated`, `discovered`,
  `rejected`, `removed` -> `AvailabilityState.kind === "unavailable"` with
  reason reflecting posture (e.g. `flag-disabled` for `disabled`).

## 4. Render factories and component-kit primitives <!-- oc:id=sec_af -->

### 4.1 The rule: no plugin React in the host tree

Plan §`Layered Runtime Ownership` and Task 8 section 2 both lock: **host-owned DOM,
default reconciler**, iframe as the only escape hatch. V2 renderer projection
therefore exposes a small, well-typed set of **render factory primitives** the
host passes to the plugin worker. The plugin returns a host-renderable
descriptor; the host tree never imports a plugin React component.

```ts
// apps/desktop/src/renderer/plugin-kit/render-primitives.ts (new)
export interface PluginRenderNode {
  kind: "stack" | "row" | "grid" | "tabs" | "card" | "text" | "button" | "input" | "list" | "tree" | "code" | "markdown" | "iframe" | "custom"
  props: Record<string, unknown>
  children: PluginRenderNode[]
  // host binds events, not plugins
}

export interface PluginRenderRoot {
  root: PluginRenderNode
  // for "custom" kind, plugin returns a slot id; host owns the renderer
  slotId?: string
}
```

The plugin worker returns a `PluginRenderRoot`. The host's reconciler walks
the tree and binds it to the host React tree using **component-kit primitives**
from `packages/ui` (`@ch5me/elf-ui`).

### 4.2 Component-kit primitives

All host render factories are wrappers over `@ch5me/elf-ui` components. The
table below maps `PluginRenderNode.kind` to the host primitive. Every primitive
is a thin React component, exported from
`apps/desktop/src/renderer/plugin-kit/primitives/`. Plugins cannot escape this
set; the host reconciler rejects unknown `kind` values with `surface.errored.api-incompatible`.

| `kind` | Host primitive | Source | Notes |
|---|---|---|---|
| `stack` | `<Stack direction="vertical" \| "horizontal">` | `@ch5me/elf-ui` shadcn stack | flex container |
| `row` | `<Row>` | `@ch5me/elf-ui` shadcn row | alias for horizontal stack |
| `grid` | `<Grid cols={n}>` | new in `plugin-kit` | CSS grid, `n` from props |
| `tabs` | `<Tabs items={...}>` | `@ch5me/elf-ui` shadcn tabs | plugin returns `items` array |
| `card` | `<Card title={...}>` | `@ch5me/elf-ui` shadcn card | `props.title` only |
| `text` | `<Text variant={...}>` | `@ch5me/elf-ui` shadcn text | `variant` enum: `h1..h4`, `body`, `caption`, `code` |
| `button` | `<Button intent={...}>` | `@ch5me/elf-ui` shadcn button | `intent` enum: `primary`, `secondary`, `ghost`, `destructive`; `onClick` -> plugin event name |
| `input` | `<Input type={...}>` | `@ch5me/elf-ui` shadcn input | `onChange` -> plugin event name |
| `list` | `<List items={...}>` | new in `plugin-kit` | virtualized via TanStack Virtual for >50 items |
| `tree` | `<Tree nodes={...}>` | new in `plugin-kit` | lazy-expand, host owns expand state |
| `code` | `<Code language={...}>` | wraps Shiki renderer | language from `props.language` |
| `markdown` | `<Markdown>` | wraps existing renderer in `apps/desktop` | plugin returns string |
| `iframe` | `<PluginIframe>` | new in `plugin-kit` | applies `sandbox` and `src` from `ProjectedPanelDef.iframe*`; only legal when `ProjectedPanelDef.surface === "iframe"` |
| `custom` | `<PluginSlot slotId={...}>` | new in `plugin-kit` | host-owned slot for first-party plugins only; third-party plugins cannot use `custom` |

The host reconciler enforces:

- depth limit (max 32 nested `PluginRenderNode` levels)
- child count limit (max 500 per parent)
- text length limit (max 100KB per text node)
- iframe `src` must be in `ProjectedPanelDef.iframeSrc` (already validated against `networkDomains`)

Violations produce `surface.errored.api-incompatible` and refuse to render
that subtree, but the rest of the surface still renders.

### 4.3 Event binding

Plugins return a `PluginRenderNode` tree with event handler **names**
(`"onClick": "open-repo"`), not function references. The host reconciler
registers a single global event dispatcher:

```ts
// apps/desktop/src/renderer/plugin-kit/event-bus.ts (new)
export type PluginEvent = { pluginId: string; contributionId: string; event: string; payload: unknown }
export const pluginEventBus: Subject<PluginEvent> // -> IPC -> main -> worker
```

The renderer never holds a direct reference to plugin worker functions. Every
event crosses the IPC seam into main, where the capability broker validates
the event and dispatches to the worker. This is the same authority boundary
that already governs OpenCode tool calls (Task 9).

### 4.4 Widgets

Widgets use the same primitive set, but the host passes a `zoneId` constraint
so the reconciler knows which zone slot to fill. Widgets cannot use
`kind: "iframe"` or `kind: "custom"` per Task 8 section 3.

### 4.5 Commands

Commands have no render factory. They are pure metadata projections feeding
the command palette (Task 17) and the host router. Renderer reads
`ProjectedCommandDef` and feeds the existing `cmdk`-based command palette.

### 4.6 Themes

Themes have no render factory. They are data-only per Task 8 section 5. The render
fabric is `useThemeEffect` (existing) plus a new
`usePluginThemeProjection` hook that watches `projectedThemesAtom` and
re-applies via the precedence matrix in Task 16.

## 5. Persistence keys, telemetry, commandIds, namespacing <!-- oc:id=sec_ag -->

All four are **host-derived** in the projection. Plugins declare
identity + contributions; the host owns the rest.

### 5.1 Persistence keys

| V1 key shape | V2 key shape | Source |
|---|---|---|
| `elf:side-panel-open` (renderer-side `atomWithStorage`) | unchanged | renderer host atom |
| `elf:sidebar-sections` | unchanged | renderer host atom |
| `elf:session-widget-layouts` (per-session widget placement) | unchanged | renderer host atom; this is host-owned placement, not a contribution |
| `side-panel.<name>` (per-surface persistence) | `side-panel.<pluginId>/<contributionId>` | host namespacing function; first-party migration task (Task 19) provides a one-time alias table that maps old keys to new keys for built-in plugins |
| `side-panel.review` etc. (V1 literals) | `side-panel.firefly/review-panel/review` (built-in namespace per Task 6 section 1.1) | migration alias table: built-in plugins live under `firefly/<id>` |

The namespacing function is the single source of truth for V2 persistence
keys:

```ts
// apps/desktop/src/main/plugin-runtime/projection/namespacing.ts (new)
export function panelPersistenceKey(pluginId: string, contributionId: string): string {
  return `side-panel.${pluginId}/${contributionId}`
}
export function widgetPersistenceKey(pluginId: string, contributionId: string): string {
  return `widget.${pluginId}/${contributionId}.placement`  // placement is per-session, namespaced
}
export function commandPersistenceKey(pluginId: string, commandId: string): string {
  return `command.${pluginId}/${commandId}.recents`
}
export function themePersistenceKey(pluginId: string, themeId: string): string {
  return `theme.${themeId}.user-pick`  // user-pick is global; theme id is already globally unique
}
```

Old V1 keys are kept as **read-only aliases** during the migration window. The
renderer projection sets both the old and new keys on writes until the V1
registry files are removed. This avoids losing user preferences during the
rollover (Task 19).

### 5.2 Telemetry namespaces

| V1 namespace | V2 namespace | Source |
|---|---|---|
| `firefly.surface.<name>` (e.g. `firefly.surface.review`) | `firefly.plugin.<pluginId>.<contributionId>` (e.g. `firefly.plugin.firefly/review-panel.review`) | host namespacing function |
| n/a (V1 has no per-plugin telemetry) | per-plugin telemetry key inside `PluginDescriptor.telemetryHint` (optional override) | manifest field |
| `elf:command-palette` etc. (host-level) | unchanged | renderer host |

The namespacing function is shared with persistence:

```ts
export function telemetryNamespace(pluginId: string, contributionId: string): string {
  return `firefly.plugin.${pluginId}.${contributionId}`
}
```

For first-party plugins using Task 6 section 1.1 reserved scopes, the resulting
namespace is `firefly.plugin.firefly/review-panel.review`, which matches the
shape of the V1 namespace `firefly.surface.review` (replaced via the
alias table during migration).

### 5.3 Command ids

Per Task 3 section 6 and Task 8 section 4, the host reserves namespaces
(`firefly.*`, `surface.*`, `lifecycle.*`) and plugins use the
`plugin.<pluginId>.*` namespace. The V2 command projection adds two host-generated
commands per panel and per widget, per the matrix in Task 8 section 1:

| Family | Plugin-declared command ids | Host-generated command ids (per contribution) |
|---|---|---|
| `panels` | `plugin.<pluginId>.<panelId>.open` (or whatever the plugin declares) | `surface.<pluginId>.<panelId>.open`, `surface.<pluginId>.<panelId>.toggle`, `surface.<pluginId>.<panelId>.state` |
| `widgets` | `plugin.<pluginId>.<widgetId>.refresh` (optional) | `widget.<pluginId>.<widgetId>.show`, `widget.<pluginId>.<widgetId>.hide` |
| `commands` | `plugin.<pluginId>.<commandId>` (whatever declared in `contributes.commands`) | none - plugin owns the command id |
| `themes` | none | `theme.<themeId>.apply`, `theme.<themeId>.preview` |

The host-generated command ids are the V2 replacements for the V1 literal
ids like `surface.review.open`. The first-party migration task (Task 19)
generates the same V1 ids for first-party plugins so existing command palette
keybindings, automation rules, and user muscle memory keep working. The
`commandIds` field on `ProjectedPanelDef` is the union of plugin-declared and
host-generated command ids, with the V1 id last (lowest priority during
collision resolution per Task 17).

### 5.4 Identifiers and host namespacing

| Identifier type | Format | Source | Example |
|---|---|---|---|
| `pluginId` | reverse-domain, `<scope>/<name>` | Task 6 section 1.1 | `firefly/review-panel` |
| `panel.id` (raw, in manifest) | plugin-scoped | manifest | `review` |
| `ProjectedPanelDef.id` (projected) | `<pluginId>/<panel.id>` | host namespacing | `firefly/review-panel/review` |
| `ProjectedPanelDef.persistenceKey` | `side-panel.<pluginId>/<panel.id>` | host namespacing | `side-panel.firefly/review-panel/review` |
| `ProjectedPanelDef.telemetryNamespace` | `firefly.plugin.<pluginId>.<panel.id>` | host namespacing | `firefly.plugin.firefly/review-panel.review` |
| `ProjectedPanelDef.commandIds` (legacy aliases included) | `surface.<panel.id>.*` (alias) + `surface.<pluginId>.<panel.id>.*` (canonical) | host namespacing | `["surface.review.open", "surface.review.toggle", "surface.firefly/review-panel.review.open"]` |
| `ProjectedWidgetDef.id` | `<pluginId>/<widget.id>` | host namespacing | `firefly/review-panel/session-task-list` |
| `ProjectedWidgetDef.zoneId` | `above-chat` | `chat-inline-right` | manifest + Task 8 section 3 host vocabulary | `above-chat` |
| `ProjectedCommandDef.id` | `plugin.<pluginId>.<command.id>` | host namespacing | `plugin.firefly/review-panel.open-repo` |
| `ProjectedThemeDef.id` | `<theme.id>` (already globally unique per Task 8 section 5) | manifest | `ch5me.cortex-dark` |

### 5.5 Availability metadata flow

`ProjectedPanelDef.availability` is **data, not code**. The renderer treats it
as an enum-tagged union. The current `FireflySurfaceDef.availability: (ctx)
=> Availability` is replaced by the host's projection reducer, which evaluates
the same logic against the canonical runtime objects. The renderer never
imports a function from a plugin manifest and never calls plugin code from
within a synchronous React render.

The reducer's evaluation order (locked):

1. `PluginInstance.state` -> base availability (`active|activating` passes;
   everything else -> `unavailable` with mapped reason)
2. `PluginInstance.posture === "quarantined"` -> `quarantined` with
   `QuarantineReason` from Task 6 section 5.1
3. `PluginInstance.posture === "rollback-pending"` -> `available` (still
   usable; UI shows subtle "rolling back" badge)
4. `PluginSessionHandle.availability` (per session) -> `available` or
   `unavailable` with `session-disconnected` / `not-in-session`
5. `requiresCapabilities` vs granted subset -> `unavailable` with
   `capability-missing` if any missing
6. `contributes.panels[i].defaultEnabled` + user preference override ->
   `unavailable` with `flag-disabled` if off
7. `when` expression (declarative, host-evaluated) -> `unavailable` with
   `custom` (plugin-supplied message) if false
8. Bridge server mode (Task 14 matrix) -> `unavailable` with
   `no-active-server` if bridge offline
9. `LoadingState` -> `loading` if `state === "activating"` or
   `first-render` not yet fired; transitions to `ready` on first render

The reducer is pure and idempotent; it re-runs whenever the projection stream
emits a new event.

## 6. Putting it together: a projected panel end-to-end <!-- oc:id=sec_ah -->

Walkthrough using the first-party `firefly/review-panel` plugin (built-in
replacement for current `review` surface). This is the canonical V2 path;
Task 19 turns the current V1 surface entries into built-in plugins of this
shape.

1. Disk: `apps/desktop/.firefly-client/built-in/firefly/review-panel/manifest.json` (new location per Task 7 section 6)
2. Main loads manifest, Zod-parses, normalizes -> `PluginDescriptor`
3. Main builds `PluginInstance` (state = `active` for built-in core), grants
   full built-in capability set (Task 6 section 6.1)
4. Main emits `plugin.snapshot` event with descriptor, instance, no session
   binding (panel is session-aware but not session-bound; binding happens on
   `plugin.sessionHandle.created` per Task 14)
5. Renderer applies snapshot to `pluginCatalogAtom`; reducer computes
   `ProjectedPanelDef` for the `review` contribution
6. Reducer stamps `availability: { kind: "available" }`,
   `lifecycleState: "active"`, `posture: null`,
   `persistenceKey: "side-panel.firefly/review-panel/review"`,
   `telemetryNamespace: "firefly.plugin.firefly/review-panel.review"`,
   `commandIds: ["surface.review.open", "surface.review.toggle",
   "surface.firefly/review-panel.review.open"]`
7. Reducer emits derived `ProjectedCommandDef` entries for the two
   host-generated commands (`surface.firefly/review-panel.review.open`,
   `surface.firefly/review-panel.review.toggle`)
8. `usePluginPanelTabs()` hook reads `projectedPanelsAtom` + `pluginAvailabilityAtom`,
   filters to `formFactor === "side-panel-tab"`, and returns
   `FireflySidePanelTab[]` (the same shape V1 consumer code already
   understands; this is the migration shim)
9. Existing `AppSidebar` / side-panel chrome reads from the hook and
   renders; no V1 code change required for the chrome, only the source of
   `FireflySidePanelTab[]` changes from "literal registry" to "projected"
10. When user clicks the tab, host emits `surface.opened` telemetry under
    `firefly.plugin.firefly/review-panel.review`, opens the panel, lazy-imports
    the worker entry, and the reconciler binds the worker's
    `PluginRenderRoot` to the host React tree
11. If the worker crashes, host emits `plugin.panels.dirty` with new
    `availability: { kind: "errored", reason: "worker-crashed" }`; the chrome
    re-renders the error card; the existing "Restart plugin" action calls
    the host `plugin.firefly/review-panel.lifecycle({ op: "restart" })`
    tool, which is the same tool exposed to the agent

The V2 flow is the V1 flow with the registry moved into a derived atom and
the render factory moved into a host reconciler. The user-visible chrome is
unchanged in V2 phase 1; the agent/operator surface gains the new
availability semantics and lifecycle integration.

## 7. Migration shims (so V1 consumers keep compiling) <!-- oc:id=sec_ai -->

These shims live in the renderer projection package and exist only during
the Task 19 migration window. They keep `firefly-surface-registry.tsx`,
`session-widget-registry.tsx`, and the `feature-flags.ts` surface flags
working until consumers are rewritten.

| V1 file | V2 replacement | Shims during migration |
|---|---|---|
| `firefly-surface-registry.tsx` exports `FIREFLY_SURFACE_REGISTRY` | `projectedPanelsAtom` + `pluginCatalogAtom` | re-export the atom as a memoized `FIREFLY_SURFACE_REGISTRY` derived from the projection; the literal entries stay as a fallback during first-party plugin rollout |
| `FIREFLY_SURFACE_REGISTRY_BY_ID` lookup | same shim | re-export from the derived registry |
| `getFireflySurfaceTabs(ctx)` | `usePluginPanelTabs()` hook | keep function signature, route through the projection; mark `@deprecated` |
| `feature-flags.ts` surface flags (`reviewSurfaceEnabledAtom` etc.) | `pluginAvailabilityAtom` per plugin | per-flag atom becomes a derived boolean read from `pluginAvailabilityAtom[pluginId]?.availability.kind === "available"`; this is what keeps the existing `defaultOn` and `enabledFlag.atom` references working during migration |
| `session-widget-registry.tsx` `SESSION_WIDGET_REGISTRY` | `projectedWidgetsAtom` | re-export as a memoized object derived from the projection; widget `entry` becomes a host-reconciler reference |
| `SESSION_WIDGET_REGISTRY["session-task-list"]` literal | `firefly/chat-widgets/session-task-list` built-in plugin | migration task (Task 19) creates the built-in plugin; widget appears via projection once registered |
| `atoms/session-widgets.ts` `DEFAULT_LAYOUT` | unchanged, but reads contribution ids from projected widgets instead of literal union | rename `SessionWidgetId` from literal union to `string` keyed by `<pluginId>/<contributionId>`; old ids kept as type aliases for one release |

After Task 19 completes for a given surface, its V1 shim is removed. The
`firefly-surface-registry.tsx` file shrinks to a thin derived-atom
re-export; the literal `FIREFLY_SURFACE_REGISTRY` array is removed.

## 8. Acceptance criteria check <!-- oc:id=sec_aj -->

Maps to plan §`Task 13` acceptance criteria.

- [x] **Renderer registries become projections, not source of truth**
  - `PluginDescriptor` (main process) is the canonical source of truth.
  - Renderer holds only the last-applied projection snapshot.
  - `firefly-surface-registry.tsx` and `session-widget-registry.tsx` are
    re-implemented as derivation functions over projection atoms; their
    exported shapes survive as migration shims.
  - `atoms/session-widgets.ts` is host-owned placement, not a contribution
    registry, and remains.
- [x] **Loading/error/availability semantics exist for projected surfaces**
  - `AvailabilityState` enum has 5 kinds: `available`, `loading`,
    `unavailable`, `errored`, `quarantined`.
  - `UnavailableReason`, `ErrorReason`, `QuarantineReason`, `LoadingState`
    enums are explicit and exhaustive.
  - Per-state UI behavior matrix (section 3.6) is the contract; renderer is
    forbidden from inventing additional states.
  - Every reason maps to a first-party V1 case so the existing UX language
    is preserved (`feature-flags.ts` reason becomes `flag-disabled`; missing
    `chat-inline-right` zone becomes `command-only`; etc.).
- [x] **Mapping from V1 to V2 field-by-field** (section 2)
- [x] **Render factories and component-kit primitives are explicit** (section 4)
- [x] **Persistence keys, telemetry, commandIds are host-derived** (section 5)

## 9. Downstream handoff <!-- oc:id=sec_ak -->

| Task | Inherits from this document |
|---|---|
| Task 14 (OpenCode bridge projection) | `ProjectedPanelDef` / `ProjectedWidgetDef` / `ProjectedCommandDef` / `ProjectedThemeDef` shape for the introspection tools; `plugin.<pluginId>.*` host-generated command ids; `unavailable` / `errored` / `quarantined` reason codes |
| Task 15 (storage/state scopes) | per-session widget placement remains in `sessionWidgetLayoutStorageAtom`; per-contribution persistence keys (section 5.1) become durable storage keys; lifecycle state changes need durable writes |
| Task 17 (command/menu/keybinding projection) | `ProjectedCommandDef` shape and host-generated command ids (section 5.3); `commandIds` field on `ProjectedPanelDef` |
| Task 19 (first-party migration) | section 2 mapping table is the per-field migration spec; section 7 shim strategy keeps consumers compiling during rollover; section 5.1 alias table for `persistenceKey` rollover |
| Task 21 (first-party exemplar) | section 6 walkthrough is the exemplar template; the `firefly/review-panel` plugin shape is reusable |
| Task 24 (lifecycle UI) | `pluginAvailabilityAtom` is the operator-side read; `AvailabilityState` reason codes drive the operator badge strings; `ErrorReason` / `QuarantineReason` drive the "last error" / "why quarantined" surfaces |
| Task 26 (repo implementation matrix) | new modules named in this doc: `apps/desktop/src/shared/plugin-projection.ts`, `apps/desktop/src/renderer/plugin-kit/render-primitives.ts`, `apps/desktop/src/renderer/plugin-kit/primitives/*`, `apps/desktop/src/renderer/plugin-kit/event-bus.ts`, `apps/desktop/src/main/plugin-runtime/projection/namespacing.ts` |
| Task 28 (verification matrix) | per-state UI matrix (section 3.6) and field mapping (section 2) are the gates; the `usePluginPanelTabs()` hook is the unit-testable surface |
| Task 29 (quotas) | `ProjectedPanelDef.loadingState` is the per-surface render-budget counter input; `availability: { kind: "loading" }` is a per-render host cost |
