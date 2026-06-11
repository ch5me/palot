# Task 17 — Command / Menu / Keybinding Projection <!-- oc:id=sec_aa -->

> Wave 3, Task 17 of plan `firefly-plugin-system-v2`. Do not modify the plan file.
> Reads: `task-3-command-inventory.md` (six command families, current ids), `task-8-family-contracts.md` (`commands` declarative contract), `task-9-tool-projection.md` (host-generated wrappers, reserved namespaces, tool-call state machine).

## What this means for V2 <!-- oc:id=sec_ab -->

Commands are the only contribution family that touches three different host surfaces (palette + menus + keybindings) and the only one whose IDs are user-visible hot strings. V2 collapses the current hand-rolled `command-palette.tsx` (732 lines, hardcoded built-ins, surface-bound `commandIds` arrays in `firefly-surface-registry.tsx`) into one declarative `contributes.commands` contract plus one host-generated `plugin.<id>.command.run` wrapper per plugin. The renderer no longer authors palette rows, menus, or keybindings in parallel with the manifest — it consumes a single host-produced projection over `PluginDescriptor` + `PluginSessionHandle`. Surface-bound `surface.<id>.open` / `surface.<id>.toggle` ids become host-reserved built-in projections generated from the panel contribution, not registry strings.

## 1. Host-generated command list construction <!-- oc:id=sec_ac -->

The host computes one `ProjectedCommand[]` list per renderer render. Inputs are pure — no I/O, no disk reads, no worker calls — all derivable from in-memory `PluginDescriptor` + `PluginInstance` + `PluginSessionHandle`.

### 1.1 Construction pipeline <!-- oc:id=sec_ai -->

```
PluginDescriptor[]                    ← static
  + PluginInstance[] (active only)    ← runtime lifecycle
  + PluginSessionHandle[] (active)    ← session-scoped state
  + host policy (grants, reservations, quarrantine)
        │
        ▼
[1] reserved-prefix check              ← reject reserved ids, see §3
[2] cross-plugin id dedup              ← reject duplicates, see §3
[3] shortcut conflict resolution       ← host shortcut wins, see §3.4
[4] when-clause evaluation             ← static + runtime context, see §4
[5] capability-gate filter             ← drops commands whose required capabilities are not granted
[6] menu placement resolution          ← category sort, see §2.2
[7] recent-uses overlay                ← host-owned recents list (not plugin-controlled)
        │
        ▼
ProjectedCommand[]                     ← fed to palette + menus + keybindings renderer
```

### 1.2 `ProjectedCommand` shape (host-side projection, not manifest) <!-- oc:id=sec_aj -->

```ts
interface ProjectedCommand {
  // Source identity
  pluginId: string                 // "*" for host-owned built-ins
  id: string                       // full command id, namespaced
  title: string                    // resolved from manifest + l10n
  category: string                 // host-derived from category field, falls back to plugin label
  icon?: string

  // Display
  menu: MenuLocation[]             // resolved menu placements (see §2.2)
  shortcut?: ResolvedKeybinding    // after conflict resolution (see §2.3)
  shortcutConflict?: "shadowed" | "host-wins" | "reassigned"

  // Activation state
  visible: boolean                 // when-clause + capability gate + session state
  enabled: boolean                 // available + not disabled + not quarantined
  disabledReason?: "no-session" | "quarantined" | "denied" | "loading" | "unavailable"
  source: "static" | "dynamic"     // static = manifest declaration; dynamic = host-generated wrapper

  // Invocation
  handlerPluginOnly: boolean       // true = must route through plugin worker; false = host adapter ok
  requiresCapabilities: string[]   // already filtered against grants by stage 5
  invocationScope: "session" | "app" // session = per-session effect; app = app-wide effect
  sessionBinding?: { sessionId: string } // present iff invocationScope = "session" and session resolved

  // Tool mirror
  toolName?: string                // set iff mirrored as `plugin.<id>.command.run`
  toolSchema?: JSONSchema          // for agent introspection
}
```

### 1.3 Three command sources <!-- oc:id=sec_ak -->

| Source | Definition | Visible to agent? | Visible to user? | Session scope |
|---|---|---|---|---|
| **Host-reserved built-ins** | declared in host source, `pluginId: "*"` | yes (as `plugins.commands` introspection) | yes | app or session per id |
| **Plugin-contributed** | declared in `contributes.commands[]` | yes (via `plugin.<id>.command.list`) | yes (if visible) | session (default) or declared |
| **Host-generated wrappers** | `plugin.<id>.command.run`, `plugin.<id>.command.list` | yes | no (not user-invokable; agent-only) | session |

`source: "dynamic"` is reserved for the third row. Plugins may NOT mark their own contributed commands as dynamic — that field is host-reserved for wrappers so the renderer knows not to render a palette row for them.

### 1.4 Built-in first-party projection <!-- oc:id=sec_al -->

Current `surface.<id>.open` / `surface.<id>.toggle` ids in `firefly-surface-registry.tsx` (18 surfaces × 2 ids = 36 entries) become **host-generated projections** derived from the `panels` contribution. The host emits one `ProjectedCommand` per panel:

- `surface.<panelId>.open` — always `visible: true` when the panel is enabled, `handlerPluginOnly: false` (host routes focus), `invocationScope: "app"`.
- `surface.<panelId>.toggle` — transitional compatibility alias for first-party panels; long-term all toggle behaviour moves to `plugin.<panelId>.panel.open` so V2 reduces to one shape. The `.toggle` form stays available until Wave 4 migration (Task 19) explicitly retires it.

First-party user commands (`session.undo`, `session.redo`, `palette.open`, `sidebar.toggle`, `sidepanel.toggle`, `theme.open`, `theme.set`, `mock.toggle`, `reactscan.toggle`, `automations.toggle`, `reload.config`, `relaunch.app`, `opaque.toggle`) are host-reserved and live in the `pluginId: "*"` namespace. They are NOT in the manifest schema — they are static in the host code that produces the projection. The first-party palette built-ins must be reproducible by reading host code, not by reading any plugin manifest.

## 2. Palette, menu, keybinding projection rules <!-- oc:id=sec_ad -->

### 2.1 Command palette <!-- oc:id=sec_am -->

- Source: every `ProjectedCommand` where `visible: true` AND `source != "dynamic"`.
- Render order: pinned built-ins → category → title. `category` is host-derived; plugins cannot pin themselves.
- Filter input: fuzzy match on `title` and `category`. Plugin `id` and `toolName` are NOT matched by default (avoids leaking namespaced identifiers into user-visible search).
- Empty-result: show host-only "no commands" hint, never plugin-supplied.
- Recents: host-owned ring buffer keyed by `(pluginId, id)`. Plugins cannot read or write it.
- Hidden but discoverable: commands with `visible: false` are still introspectable via `plugins.commands` and `plugin.<id>.command.list`. Palette never shows them; agent always can.

### 2.2 Menus <!-- oc:id=sec_an -->

`contributes.menus[]` entries declare one placement. The `menu` field on a command is an array — a single command may appear in multiple menus.

| `MenuLocation` | Render target | Notes |
|---|---|---|
| `palette` | command palette (default) | implicit when no menu declared |
| `sidebar` | left/right sidebar context menu | gated by surface availability |
| `panel-header` | the host-owned panel header strip | only valid for commands tied to a panel |
| `context` | right-click / contextual actions | requires an attached `when` clause binding to context type |
| `app-menu` | OS application menu (top-level on macOS, system menu elsewhere) | host policy decides which slots are open; plugins request by name, host grants |

#### Menu placement rules <!-- oc:id=sec_ao -->

1. Plugin declares `menu: ["palette", "sidebar"]` — host splits the declaration into two render targets; the same `ProjectedCommand` is materialized twice (once per placement) with shared `id` and `source` so the renderer can keep them linked for recents. <!-- oc:id=item_aa -->
1. `panel-header` placements require a sibling `panels` contribution with the same `id` prefix. The host rejects manifest activation if `panel-header` is requested for a plugin that contributes no panel. <!-- oc:id=item_ab -->
1. `app-menu` placements are constrained to a host-published set of named slots (e.g. `app-menu/file`, `app-menu/edit`, `app-menu/view`). Plugins may not invent new top-level slots in V2. Reserved slots like `app-menu/firefly` and `app-menu/help` are host-only. <!-- oc:id=item_ac -->
1. Menu order within a location: pinned host items first, then by `category`, then by `title`. Plugins cannot pin themselves. <!-- oc:id=item_ad -->
1. `when` clause for a menu entry evaluates the same context object as for palette visibility (see §4.1). <!-- oc:id=item_ae -->

### 2.3 Keybindings <!-- oc:id=sec_ap -->

`contributes.keybindings[]` is an array of `{ commandId, key, when }`. The host owns final binding assignment.

| Field | Source | Constraint |
|---|---|---|
| `commandId` | manifest | must resolve to a declared command (same plugin or a host-reserved id the plugin explicitly cross-references) |
| `key` | manifest | chord string, e.g. `"Cmd+Shift+G"`; host normalizes to platform form |
| `when` | manifest | same context grammar as `when` on the command itself |

#### Keybinding resolution algorithm <!-- oc:id=sec_aq -->

```
for each declared keybinding (in manifest order):
  1. parse key chord
  2. look up existing binding for that chord
  3. case "no existing binding":
       → install, record provenance
  4. case "existing binding is host-reserved":
       → reject plugin keybinding, mark command.shortcutConflict = "host-wins"
       → emit warning to plugins.permissions introspection
  5. case "existing binding is from a higher-priority plugin":
       → priority order: built-in plugins > local-dev > signed-third-party > unsigned-third-party
       → reject new keybinding, mark command.shortcutConflict = "shadowed"
  6. case "existing binding is from same priority class":
       → earlier-activated plugin wins
       → reject new keybinding, mark command.shortcutConflict = "reassigned"
```

#### Keybinding invariants <!-- oc:id=sec_ar -->

- `Cmd+K` (palette.open) and `Cmd+B` (sidebar.toggle) are **host-locked**. The host refuses to reassign them under any plugin manifest.
- A plugin may NOT declare a keybinding whose `commandId` resolves to a host-reserved command unless that command is explicitly marked `keybindingReassignable: true` in the host source. None exist in V2 initial scope.
- `key` may be a chord (max 3 segments). Single-key bindings (no modifier) are rejected for non-palette commands — too easy to trigger accidentally.
- Platform normalization: the host rewrites `Cmd` → `CmdOrCtrl` on Windows/Linux; `Option` → `Alt`. Manifests may use either form. The rendered shortcut in the palette shows the platform form.

### 2.4 Cross-projection invariants <!-- oc:id=sec_as -->

- One `ProjectedCommand` → at most one palette row + zero-or-more menu rows + zero-or-one keybinding. The host's render layer treats these as facets of the same command, not three independent entities.
- A command hidden by `visible: false` is also stripped from menus and keybindings (binding is inert while hidden). The binding re-activates automatically when the command becomes visible again.
- Recents list is keyed by command id, not by surface. Running a command from a context menu promotes the same `ProjectedCommand` in the palette recents.

## 3. Reserved prefixes and collision detection <!-- oc:id=sec_ae -->

### 3.1 Reserved namespaces (host-owned, plugins may NOT declare) <!-- oc:id=sec_at -->

```
firefly.*         core host (legacy + future)
surface.*         panel open/toggle projections + transitional surface commands
session.*         session lifecycle (undo/redo, etc.)
theme.*           theme apply/reset/preview
sidebar.*         sidebar chrome control
sidepanel.*       sidepanel chrome control
plugins.*         introspection tool namespace (per Task 9)
bridge.*          bridge internals
lifecycle.*       plugin lifecycle operator surface
app-menu/firefly  host-locked top-level menu slot
app-menu/help     host-locked top-level menu slot
```

### 3.2 Plugin-declared namespaces (allowed) <!-- oc:id=sec_au -->

```
plugin.<pluginId>.*         plugin business tools, wrappers, contributed commands
<pluginId>.<verb>...        NOT allowed: command id must use the `plugin.<id>.<verb>` form
```

The `plugin.<pluginId>.*` prefix is the **only** shape a plugin may use for `id` fields. The host rejects manifests where any `contributes.commands[].id`, `contributes.menus[].commandId`, or `contributes.keybindings[].commandId` does not start with `plugin.<pluginId>.`. The plugin id portion is itself validated against reverse-DNS or org-scoped normalized form (per Task 6 identity rules) — the host does not allow two plugins with different display names to share an id slot.

### 3.3 Collision detection algorithm <!-- oc:id=sec_av -->

```
on manifest activation:
  let reserved = { "firefly.*", "surface.*", "session.*", "theme.*", "sidebar.*",
                   "sidepanel.*", "plugins.*", "bridge.*", "lifecycle.*" }
  for each command id c in manifest.contributes.commands:
    if c matches any reserved prefix:
      → reject manifest activation
      → errorCode: "command_reserved_namespace"
    if c does not start with "plugin." + manifest.id + ".":
      → reject manifest activation
      → errorCode: "command_bad_namespace"
  for each active plugin p_other (other than self):
    for each command id c_other in p_other.contributes.commands:
      if c == c_other:
        → reject the later-activated manifest
        → errorCode: "command_id_collision"
  for each surface-bound projection s in host-built-ins:
    for each command id c in s.emits (e.g. surface.review.open):
      if any plugin id c:
        → reject manifest activation
        → errorCode: "command_id_collision"

on hot reload (Task 18):
  re-run the above against the *new* manifest; the slot is held under the
  previous version's activation until the new version passes the check, so
  transient collision during reload is not a visible state.
```

### 3.4 Shortcut conflict resolution <!-- oc:id=sec_aw -->

See §2.3 for the algorithm. The collision class is `keybinding_conflict` and the four sub-codes are:

- `keybinding_host_reserved` — chord belongs to a host-locked binding
- `keybinding_shadowed` — chord belongs to a higher-priority plugin
- `keybinding_reassigned` — chord belongs to a same-priority earlier plugin
- `keybinding_invalid_chord` — chord failed to parse (e.g. empty modifier)

The rejected keybinding still appears in the manifest record so the plugin author can see what happened, but the bound chord does nothing and the conflict status is surfaced via `plugins.permissions`.

### 3.5 Menu slot conflict resolution <!-- oc:id=sec_ax -->

Plugins may not invent top-level menu slots in V2. If two plugins both request `app-menu/view` placement, the order is by activation time (earlier wins), not by name. The loser's menu entry is dropped with `menu_slot_full` and surfaced via `plugins.permissions`.

## 4. Dynamic visibility per `PluginSessionHandle` <!-- oc:id=sec_af -->

### 4.1 The `when` context object <!-- oc:id=sec_ay -->

Every command's `when` clause evaluates against a host-computed context object. The context is recomputed whenever any of its inputs change, and the projection re-derives the affected `visible` / `enabled` flags.

```ts
interface CommandContext {
  // App / chrome state
  app: {
    hasOpenServer: boolean
    serverMode: "managed" | "attached" | "offline" | "reconnecting"
    activeThemeId: string
  }

  // Active session (the one the palette is being rendered for, or the focused session)
  session: {
    id: string | null
    hasLaneBinding: boolean
    opencodeState: "idle" | "busy" | "error" | "lost"
  }

  // Per-plugin runtime state
  plugin: {
    status: "active" | "activating" | "deactivating" | "crashed" | "quarantined" | "disabled"
    crashCount: number
    grantedCapabilities: string[]
    toolAvailability: Map<string, "available" | "disabled" | "denied">
  }

  // Surface availability (so a command tied to a panel can hide when the panel is unavailable)
  surface: {
    panelEnabled: Record<string, boolean>     // keyed by surface id
    widgetMounted: Record<string, boolean>    // keyed by zoneId
  }

  // User preference / feature flags
  user: {
    featureFlag: Record<string, boolean>      // keys mirror atoms/feature-flags.ts
    commandHidden: string[]                   // user-muted command ids
  }
}
```

### 4.2 `when` clause grammar <!-- oc:id=sec_az -->

A `when` string is a single boolean expression over the context object. Grammar (informal):

```
expr      := andExpr ("||" andExpr)*
andExpr   := unaryExpr ("&&" unaryExpr)*
unaryExpr := "!"? atom
atom      := path | "(" expr ")"
path      := IDENT ("." IDENT)*
IDENT     := [a-zA-Z_][a-zA-Z0-9_-]*
```

Allowed path shapes:

- `app.hasOpenServer` — boolean
- `app.serverMode == "managed"` — comparison; equality on string/enum fields
- `session.id != null` — nullity check
- `session.opencodeState == "busy"`
- `plugin.status == "active"`
- `plugin.grantedCapabilities includes "browser:lane-control"` — set membership
- `plugin.toolAvailability.get("plugin.<id>.<tool>") == "available"`
- `surface.panelEnabled["review"] == true`
- `surface.widgetMounted["above-chat"] == false`
- `user.featureFlag["automations"] == true`
- `user.commandHidden doesNotInclude "<commandId>"`

The grammar is deliberately tiny. Anything richer (regex, computed values, host-side JS callbacks) is rejected. The `when` clause must be deterministically evaluable on the renderer thread without a plugin worker call.

### 4.3 Three-state enablement matrix <!-- oc:id=sec_ba -->

| `visible` | `enabled` | Palette row | Menu row | Keybinding | Click result |
|---|---|---|---|---|---|
| `true` | `true` | shown, normal | shown, normal | active | dispatches handler |
| `true` | `false` | shown, dimmed, with `disabledReason` hint | shown, dimmed | inert (visible=false flips the binding off too) | no-op; renders reason tooltip |
| `false` | — | hidden | hidden | inert | not invokable from any surface |

`visible: false` and `enabled: false` are distinct:
- `visible: false` means "do not show" (e.g. plugin disabled, capability denied at install time, user muted).
- `enabled: false` means "show but do not allow" (e.g. command needs an active session but `session.id == null`; command depends on a not-yet-loaded panel).

`visible` is computed from static `when` + capability gate + plugin lifecycle. `enabled` is computed from `visible == true` + runtime `when` evaluation (session, surface availability).

### 4.4 `PluginSessionHandle` derivation <!-- oc:id=sec_bb -->

Every command's per-session visibility is derived from the active `PluginSessionHandle` for the current session. The handle carries:

```ts
interface PluginSessionHandle {
  pluginId: string
  sessionId: string
  available: boolean                 // worker attached + not quarantined
  toolAvailability: Record<string, "available" | "disabled" | "denied">
  grantedCapabilities: string[]      // per-session grant subset (may be narrower than app grant)
  crashCount: number
  lastActivationError?: string
}
```

The host recomputes the projection on:
- `PluginSessionHandle` create / update (session attach, capability grant change, plugin crash, worker recovery)
- Active session change (the renderer reports the focused session id; the renderer-side projection re-derives from the host's projected commands + new context)
- Surface availability change (`surface.panelEnabled` flip)
- `user.featureFlag` change
- User mutes/unmutes a command

The host never pushes the full projection on every keystroke — only on the events above. The renderer derives per-keystroke palette filter results from the cached `ProjectedCommand[]`.

### 4.5 Capability-gated visibility <!-- oc:id=sec_bc -->

A command with `requiresCapabilities: ["browser:lane-control"]` is `visible: false` for any user/session where that capability is not in `plugin.grantedCapabilities`. The host projects `visible: true` only when every required capability is granted. A user with full grants sees the command; a user who downgraded the grant mid-session sees it disappear from the palette on the next event tick (no reload, no restart).

### 4.6 Session-bound enablement <!-- oc:id=sec_bd -->

Some commands only make sense when there is an active OpenCode session (e.g. `session.undo`, `plugin.browser-plugin.capture-page`). Their `when` clause must include `session.id != null`. The host projection is identical for all sessions; the renderer-side `context.session.id` flips per focused session, so the same command becomes `enabled: false` when no session is focused without the host having to re-broadcast.

### 4.7 Lifecycle and quarantine <!-- oc:id=sec_be -->

A quarantined plugin (`plugin.status == "quarantined"`) contributes NO commands to the projection. Its `pluginId` appears in `plugins.permissions` with `state: "quarantined"` and `commands: []`. Disabling a plugin via the lifecycle UI flips all its `visible` to `false`; re-enabling restores. Crash (`plugin.status == "crashed"`) hides commands whose handler is `handlerPluginOnly: true`; commands the host can route via its own adapter remain visible and enabled (host adapter path is independent of worker health).

## 5. Examples <!-- oc:id=sec_ag -->

### 5.1 First-party built-in <!-- oc:id=sec_bf -->

```jsonc
// host source — not in any manifest
{
  "pluginId": "*",
  "id": "session.undo",
  "title": "Undo last turn",
  "category": "Session",
  "icon": "undo",
  "menu": ["palette"],
  "shortcut": "Cmd+Z",
  "when": "session.id != null",
  "handlerPluginOnly": false,
  "requiresCapabilities": [],
  "invocationScope": "session"
}
```

Projection: `visible: true` always (it's a host-reserved id), `enabled: true` only when `session.id != null`. Palette row shown dimmed when no session focused.

### 5.2 Surface-bound built-in projection <!-- oc:id=sec_bg -->

For the `review` panel (current `surface.review.open` declared in `firefly-surface-registry.tsx:113`):

```jsonc
// host-generated, derived from `panels` contribution with id "review"
{
  "pluginId": "*",
  "id": "surface.review.open",
  "title": "Open Review",
  "category": "Panels",
  "menu": ["palette", "panel-header:review"],
  "when": "surface.panelEnabled[\"review\"] == true",
  "handlerPluginOnly": false,
  "requiresCapabilities": [],
  "invocationScope": "app",
  "source": "static"
}
```

The host emits this for every `panels` contribution. Plugins that contribute their own panel automatically get the same shape for `surface.<panelId>.open` and `surface.<panelId>.toggle`.

### 5.3 Third-party plugin command <!-- oc:id=sec_bh -->

```jsonc
// in plugin manifest
{
  "contributes": {
    "commands": [
      {
        "id": "plugin.docs-plugin.search-index",
        "title": "Search documentation index",
        "category": "Docs",
        "icon": "search",
        "menu": ["palette", "panel-header:docs"],
        "shortcut": "Cmd+Shift+D",
        "when": "session.id != null && plugin.grantedCapabilities includes \"ai:embedding\"",
        "handlerPluginOnly": true,
        "requiresCapabilities": ["ai:embedding"]
      }
    ],
    "keybindings": [
      { "commandId": "plugin.docs-plugin.search-index", "key": "Cmd+Shift+G", "when": "session.id != null" }
    ]
  }
}
```

Collision check: `plugin.docs-plugin.search-index` is not reserved, not used by any active plugin, and `Cmd+Shift+D` is a host-locked binding (`sidepanel.toggle`) → keybinding rejected with `keybinding_host_reserved`. The `Cmd+Shift+G` keybinding is free → installed. The command itself is `visible: true` only when the plugin is active AND `ai:embedding` is granted AND a session is focused.

## 6. Acceptance check <!-- oc:id=sec_ah -->

- [x] Commands, menus, and keybindings are covered together (single `ProjectedCommand` with `menu[]` + optional `shortcut`; §2.4 cross-projection invariants lock the relationship)
- [x] Dynamic visibility / enablement semantics are explicit (`when` context object grammar, three-state `visible` / `enabled` matrix, `PluginSessionHandle`-driven recompute triggers, capability gate, session bound, lifecycle / quarantine interaction; §4)