# Task 8 — Contribution Family Contracts <!-- oc:id=sec_aa -->

> Wave 2, Task 8 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## What this means for V2 <!-- oc:id=sec_ab -->

V2 defines one declarative contract per family: `panels`, `widgets`, `commands`, `themes`. The same family contract feeds both the renderer projection (per Task 13) and the OpenCode tool projection (per Task 9). This document is the contract; projections consume it. There is no separate "OpenCode contract" for surfaces — the tool projection is generated from these contracts.

## 1. Family comparison table <!-- oc:id=sec_ac -->

| Field/Aspect | `panels` | `widgets` | `commands` | `themes` |
|---|---|---|---|---|
| Allowed escape hatch | `surface: iframe` (with capability `host:ui`) | none | n/a | none |
| Host-rendered default | yes (reconciler) | yes | yes (palette) | yes (host applies) |
| Plugin may write DOM directly | no (iframe only) | no | no | no |
| Session-scoped state by default | yes (per session) | yes (per session) | yes (per session) | no (app-scoped) |
| Persistence scope | session (placement) + app (defaults) | session (placement) | session (recents) | app (active theme) |
| Activation events | `onPanelOpen`, `onStartup`, `onCommand` | `onWidgetMount`, `onPanelOpen` | `onStartup`, `onCommand`, `onToolCall` | `onStartup`, `onThemeApply` |
| Host generates tool wrapper | `plugin.panel.state`, `plugin.panel.open` | `plugin.widget.list`, `plugin.widget.state` | `plugin.command.run`, `plugin.command.list` | `plugin.theme.list`, `plugin.theme.apply`, `plugin.theme.reset`, `plugin.theme.preview` |
| Identifier source | plugin-provided id, host-namespaced | plugin-provided id, host-namespaced | plugin-provided id, host-namespaced (under `plugin.<id>.*`) | plugin-provided id, globally unique |
| Default-on policy | host `defaultEnabled` plus user opt-in | host `defaultEnabled` plus user opt-in | host always on unless disabled | host respects user pick precedence |
| Source-of-truth ownership | plugin descriptor | plugin descriptor | plugin descriptor | plugin descriptor (data only) |
| Apply ownership | host renderer | host renderer | host router + plugin handler | host apply (theme contributions are data-only) |

## 2. `panels` contract <!-- oc:id=sec_ad -->

Allowed fields in manifest (see Task 7 for Zod schema):

- `id` (string, plugin-scoped, host-namespaced at projection)
- `title`, `icon`
- `location`: `sidebar-left | sidebar-right | bottom | main`
- `surface`: `reconciler | iframe` (default `reconciler`)
- `entry`: worker module path + export
- `defaultEnabled`: boolean
- `requiresCapabilities`: array
- `when`: declarative visibility condition string

Host-owned fields not in manifest (computed at projection):

- `availability(ctx)` runtime function result (live runtime check, not declarative)
- `persistenceKey` (host-derived from `id`)
- `telemetryNamespace` (host-derived)
- `target` (host-derived from `location`)
- `commandIds` (host-generated, see Task 3)

Session scope: panel state is per-session; the panel's reactive state lives in `PluginSessionHandle`-bound context, not worker memory. Persistence: user opt-out/in is per-user per-app; placement decisions (if any) are session-scoped.

Escape hatch policy: only `panels` may opt into `surface: iframe`. iframe requires `host:ui` capability plus `networkDomains` allowlist (for the iframe's source) and `sandbox` attribute restrictions. The iframe must be same-origin from host's perspective; cross-origin network access is brokered.

## 3. `widgets` contract <!-- oc:id=sec_ae -->

Allowed fields:

- `id` (plugin-scoped)
- `title`
- `zoneId`: `above-chat | chat-inline-right` (host-owned vocabulary; plugins may not invent new zones in V2)
- `defaultEnabled`: boolean
- `entry`: worker module path + export
- `requiresCapabilities`: array
- `when`: declarative visibility

Host-owned fields not in manifest:

- `placement` (per session, per zone, host-derived from `atoms/session-widgets.ts`)
- `available` runtime check (returns boolean per session)

Session scope: widget mount/unmount is per session. Placement is per session, persisted via existing `sessionWidgetLayoutStorageAtom`. Widget code may not manipulate layout state directly; user-driven moves go through host APIs.

Escape hatch: none in V2. Widgets are host-rendered reconciler only. If a widget needs rich rendering, it should declare a `panels` contribution instead.

## 4. `commands` contract <!-- oc:id=sec_af -->

Allowed fields:

- `id` (string under `plugin.<pluginId>.*` namespace; reserved namespaces per Task 3)
- `title`, `category`, `icon`
- `shortcut`: optional keybinding
- `menu`: where the command appears (`palette | sidebar | panel-header | context`)
- `when`: declarative visibility
- `handlerPluginOnly`: boolean
- `requiresCapabilities`: array

Host-owned fields not in manifest:

- effective shortcut binding (after conflict resolution)
- resolved menu placement (after category sorting)
- recent-uses list (host-owned)

Session scope: command visibility is per session (driven by `PluginSessionHandle.toolAvailability` and `when` evaluation). Recents list is per user, not per session.

Escape hatch: none. Commands are metadata only; behavior is always a host call into the plugin's worker.

## 5. `themes` contract <!-- oc:id=sec_ag -->

Allowed fields:

- `id` (globally unique within host catalog)
- `label`
- `uiTheme`: `vs | vs-dark | hc-black | hc-light` (compat classification)
- `data`: arbitrary key->value record (JSONC, sparse, fallback chains handled by host)
- `precedence`: integer 0-100 (default 50)
- `dataOnly`: literal `true` (locked invariant; plugins cannot ship executable theme code)

Host-owned fields not in manifest:

- effective application result (`useThemeEffect` output)
- native-theme sync (host applies via `setNativeTheme` IPC)
- CSS var injection (`<style id="elf-theme-vars">`)
- precedence resolution per the matrix in Task 16 (user pick > plugin > imported > default; preview never mutates applied)

Session scope: themes are app-scoped. Theme-related tools (`plugin.theme.*`) are callable from any session, but they inspect/request against app scope and never create per-session themes.

Escape hatch: none. Themes are data only. If a theme needs runtime behavior, it should be a `contributes.commands` tool instead.

## 6. Cross-family rules <!-- oc:id=sec_ah -->

- An interactive plugin contribution must declare a `tools` entry if the agent must be able to invoke it. UI contributions are not automatically agent-callable.
- All four families produce paired `plugin.<family>.*` host-generated tool wrappers, so the agent can always list/inspect/control.
- Activation events that span families are independent: a plugin may activate on `onStartup` for `panels` and on `onCommand` for `commands`.
- Capability gating: each contribution field accepts `requiresCapabilities`; the host rejects activation if the granted subset does not satisfy them.
- iframe escape hatch (panels only) is itself capability-gated by `host:ui` plus `networkDomains`.

## 7. Mapping from current repo to V2 contract <!-- oc:id=sec_ai -->

| Current source | V2 contract family | Notes |
|---|---|---|
| `apps/desktop/src/renderer/firefly-surface-registry.tsx` | `panels` | demoted to projection; `enabledFlag` host-derived, `commandIds` host-generated |
| `apps/desktop/src/renderer/session-widget-registry.tsx` | `widgets` | demoted; only `above-chat` and `chat-inline-right` zones in V2 |
| `apps/desktop/src/renderer/components/command-palette.tsx` | `commands` | rebuilt on top of `contributes.commands` + host wrappers |
| `apps/desktop/src/renderer/lib/themes.ts` | `themes` | first-party themes become built-in plugin `contributes.themes[]` |
| `apps/desktop/src/renderer/hooks/use-theme.ts` | host apply (unchanged) | host-owned, not a plugin contribution |
| `apps/desktop/src/renderer/atoms/session-widgets.ts` | host widget placement | unchanged but considered a projection consumer |

## 8. Acceptance summary <!-- oc:id=sec_aj -->

- [x] Each family has a clear declarative contract
- [x] Host-rendered path and escape-hatch rules are explicit