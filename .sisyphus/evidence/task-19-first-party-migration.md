# Task 19 — First-Party Migration Plan from Hardcoded Registries to Plugins <!-- oc:id=sec_aa -->

> Wave 4, Task 19 of plan `firefly-plugin-system-v2`. Do not modify plan file.
> Grounded in `task-1-contribution-inventory.md`, `task-3-command-inventory.md`, `task-8-family-contracts.md`, `task-13-renderer-projection.md`, `task-16-theme-pipeline.md`, `task-17-commands-projection.md`, current hardcoded registries, and current Palot bridge tool surface.

## 0. What this means for V2 <!-- oc:id=sec_ab -->

V2 rollout must prove completeness by moving every current first-party side panel, both session widgets, command-palette families, and bundled themes onto one built-in plugin path while keeping a small host-only shell for chrome, persistence, routing, capability brokering, and native side effects. Lower-level runtime work lands first: projection stream, capability broker, lifecycle/quarantine, host-generated wrappers, and tool projection. Only after those foundations exist should first-party features migrate out of hardcoded renderer registries. `firefly-surface-registry.tsx`, `session-widget-registry.tsx`, hardcoded palette sections, and `lib/themes.ts` become compatibility projections or data feeders during rollout, then retire once the built-in plugin catalog becomes canonical. First-party migration is not optional polish; it is acceptance proof that panels, widgets, commands, themes, and agent tools all run through same V2 manifest/runtime path.

## 1. Migration order with rationale <!-- oc:id=sec_ac -->

### Phase 0 — Runtime foundations first <!-- oc:id=sec_ad -->

1. **Canonical descriptor + projection stream** <!-- oc:id=item_aa -->
   - Land `PluginManifest` -> `PluginDescriptor` normalization, `PluginInstance`, `PluginSessionHandle`, and renderer projection stream from main.
   - Rationale: feature migration without canonical projection would only recreate parallel registries.
1. **Capability broker + lifecycle/quarantine** <!-- oc:id=item_ab -->
   - Enforce declared capabilities, deny-by-default grants, crash posture, quarantine, enable/disable state.
   - Rationale: first-party plugins must prove same trust and teardown rules as third-party plugins.
1. **Host-generated wrappers + OpenCode projection** <!-- oc:id=item_ac -->
   - Generate `plugin.panel.*`, `plugin.widget.*`, `plugin.command.*`, `plugin.theme.*`, plus introspection tools.
   - Rationale: UI and agent surface must move together; first-party migration fails if only renderer moves.
1. **Renderer consumers demoted to projections** <!-- oc:id=item_ad -->
   - Rewrite `firefly-surface-registry.tsx`, `session-widget-registry.tsx`, palette composition, and theme picker to consume projected contributions instead of authoring them.
   - Rationale: keeps UI stable while canonical source shifts to plugin descriptors.

### Phase 1 — Migrate built-in side panels first <!-- oc:id=sec_ae -->

1. Move all `SidePanelTabId` entries into built-in plugin manifests. <!-- oc:id=item_ae -->
1. Keep host `openSidePanelTabAtom`, persistence, focus token, and pane routing. <!-- oc:id=item_af -->
1. Keep transitional `surface.<id>.open` / `.toggle` aliases host-generated. <!-- oc:id=item_ag -->

Rationale:
- Panels touch most host seams: renderer projection, persistence, command wrappers, side-panel UI state, and `open_side_panel` tool.
- Plan requires every current first-party side panel to migrate during V2 rollout.
- Migrated panels prove runtime completeness faster than widgets/themes alone.

### Phase 2 — Migrate widgets next <!-- oc:id=sec_af -->

1. Convert `session-task-list` and `genui-artifacts` into built-in widget contributions. <!-- oc:id=item_ah -->
1. Keep host-owned zone vocabulary and placement persistence. <!-- oc:id=item_ai -->

Rationale:
- Widgets reuse projection machinery from panels but less host chrome.
- Confirms session-scoped mounting and per-session teardown behavior.

### Phase 3 — Migrate command families and feature toggles <!-- oc:id=sec_ag -->

1. Move panel-open commands to host-generated wrappers from panel contributions. <!-- oc:id=item_aj -->
1. Move first-party product actions and tool-launch commands into built-in plugins where they represent product features. <!-- oc:id=item_ak -->
1. Keep core chrome/session/native commands host-only. <!-- oc:id=item_al -->
1. Replace hardcoded feature-toggle section with host operator commands backed by plugin lifecycle state or host preference state. <!-- oc:id=item_am -->

Rationale:
- Commands depend on migrated panel/widget ids, capability gates, and session handles.
- Palette/menu/keybinding projection should not stabilize before panel ids and plugin namespaces do.

### Phase 4 — Migrate themes last among feature families <!-- oc:id=sec_ah -->

1. Move bundled themes into built-in theme plugin. <!-- oc:id=item_an -->
1. Keep host apply path, `themeAtom`, `colorSchemeAtom`, `opaqueWindowsAtom`, and native-theme sync. <!-- oc:id=item_ao -->
1. Add importer path after built-in themes prove pipeline. <!-- oc:id=item_ap -->

Rationale:
- Themes are data-only and app-scoped, so they are least blocked by session/runtime complexity.
- Theme migration should consume already-finished projection and lifecycle machinery, not drive it.

### Phase 5 — Compatibility cleanup / hardcoded removal <!-- oc:id=sec_ai -->

1. Delete hardcoded registry ownership once built-in plugins fully drive renderer and tools. <!-- oc:id=item_aq -->
1. Keep only compatibility alias tables and migration of persisted keys where required. <!-- oc:id=item_ar -->
1. Remove duplicate unions for side-panel ids and widget ids. <!-- oc:id=item_as -->

Rationale:
- Cleanup only after first-party plugins prove parity on same path as future third-party plugins.

## 2. Built-in plugin vs host-only decisions <!-- oc:id=sec_aj -->

### Host-only wrappers <!-- oc:id=sec_ak -->

| Surface / subsystem | Decision | Rationale |
|---|---|---|
| Side-panel open state, active tab, focus token, pane routing (`atoms/ui.ts`) | host-only | App chrome, routing, and persistence authority stay with host. Plugins contribute panels; host owns where chrome mounts them. |
| Side-panel persisted last-tab / panel-open preference (`fireflySurfacePreferencesAtom`, `sidePanelOpenAtom`) | host-only | Persistence of chrome state is app concern, not plugin concern. |
| Widget zone vocabulary and layout persistence (`above-chat`, `chat-inline-right`, `sessionWidgetLayoutStorageAtom`) | host-only | Task 8 locks widget zones as host vocabulary; plugins choose among zones but cannot mint new ones. |
| Theme application (`useThemeEffect`, `<style id="elf-theme-vars">`, `window.elf.setNativeTheme`) | host-only | Task 8/16 lock themes as data-only. Plugins contribute data, host applies DOM/native side effects. |
| Capability broker, lifecycle supervisor, quarantine, grants | host-only | Security boundary. Plugin cannot supervise itself. |
| Core chrome/session/native commands: `palette.open`, `sidebar.toggle`, `sidepanel.toggle`, `session.undo`, `session.redo`, `reload.config`, `relaunch.app`, `opaque.toggle` | host-only | These operate host chrome, native relaunch, or session transport. They are not plugin business features. |
| `open_side_panel` and `ui_state` wrappers | host-only wrapper over plugin projections | Tools query/control host UI state. They can target plugin-contributed panels, but authority remains host-owned. |
| Browser/tool dispatch transport, MCP transport, preload bridge, main-process IPC | host-only | Privileged transport and desktop integration cannot move into plugin runtime. |

### Built-in, unremovable plugins <!-- oc:id=sec_al -->

| Built-in plugin id | Includes | Why built-in plugin, not host-only |
|---|---|---|
| `firefly.panels.review` | `review` panel | Proves side-panel contribution path for review UX while host still owns diff persistence/chrome. |
| `firefly.panels.browser` | `browser` panel | Pairs current browser tool surface with real panel contribution. |
| `firefly.panels.workspace` | `notes`, `files`, `terminal`, `editor`, `artifacts` panels | Shared workspace/productivity surfaces; strong proof for generic panel runtime. |
| `firefly.panels.operator` | `plugins`, `bridges`, `pulse`, `memory`, `oracle`, `ch5pm` panels | Operator/observability surfaces should prove plugin runtime can host introspection and management surfaces. |
| `firefly.panels.comms` | `crm`, `studio`, `voice`, `claude` panels | Product-specific side panels, still first-party, should not bypass V2 path. |
| `firefly.panels.documents` | `pdf-review` panel | Specialized document UI still migrates to prove nontrivial feature path completeness. |
| `firefly.widgets.session` | `session-task-list`, `genui-artifacts` widgets | Proves both widget zones via same built-in plugin path. |
| `firefly.commands.product` | first-party plugin-contributed product commands that are not pure host chrome | Consolidates command contribution proof under same plugin system. |
| `firefly.themes.core` | `default`, `cortex`, `liquid-glass` | Bundled themes must prove `contributes.themes[]` path before import support. |
| `firefly.bridge.desktop` | browser tools, connected-app discovery tools, product-context injection metadata | Existing Palot bridge already behaves like plugin; becomes first built-in tool plugin. |

### Why some first-party features still stay partly host-owned <!-- oc:id=sec_am -->

Built-in plugin does not mean plugin owns privileged implementation. In V2, first-party plugin declares contributions and optional handlers, while host adapters still own:
- native window restarts and opacity
- session undo/redo transport
- side-panel chrome and focus
- theme DOM/native apply
- browser lane process lifecycle
- MCP registration/runtime

This split is required by plan guardrails: no plugin code in main, no direct DOM mutation, no bypass around capability broker.

## 3. Per-side-panel migration table (`SidePanelTabId` complete) <!-- oc:id=sec_an -->

| Side panel id | Current file | Target plugin id | Target family | Target tool surface | Required capabilities | Rollout phase |
|---|---|---|---|---|---|---|
| `review` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `ReviewPanel` from `apps/desktop/src/renderer/components/review/review-panel` | `firefly.panels.review` | `panels` | host-generated `plugin.panel.open`, `plugin.panel.state`; compatibility alias `surface.review.open`; optional plugin business tool `plugin.firefly.panels.review.diff.focus` later | `host:ui`, `session:read`, `workspace:diff-read` | Phase 1A |
| `browser` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `BrowserPanel` from `apps/desktop/src/renderer/components/side-panel/browser-panel` | `firefly.panels.browser` | `panels` | `plugin.panel.open`, `plugin.panel.state`; `open_side_panel`; bridge tools stay in `firefly.bridge.desktop` (`browser_*`) | `host:ui`, `browser:lane-read`, `browser:lane-control` | Phase 1A |
| `notes` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `NotesPanel` | `firefly.panels.workspace` | `panels` | `plugin.panel.open`, `plugin.panel.state`; optional `plugin.firefly.panels.workspace.notes.*` later | `host:ui`, `session:read`, `storage:session-write` | Phase 1B |
| `pulse` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `PulsePanel` | `firefly.panels.operator` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `telemetry:read`, `session:read` | Phase 1C |
| `artifacts` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `ArtifactsPanel` | `firefly.panels.workspace` | `panels` | `plugin.panel.open`, `plugin.panel.state`; optional artifact inspection tool later | `host:ui`, `session:read`, `artifact:read` | Phase 1B |
| `memory` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `MemoryPanel` | `firefly.panels.operator` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `memory:read`, `session:read` | Phase 1C |
| `files` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `FilesPanel` | `firefly.panels.workspace` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `workspace:file-read` | Phase 1B |
| `terminal` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `TerminalPanel` | `firefly.panels.workspace` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `terminal:read`, `terminal:control` | Phase 1B |
| `editor` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `EditorPanel` | `firefly.panels.workspace` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `workspace:file-read`, `workspace:file-write` | Phase 1B |
| `plugins` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `PluginsPanel` | `firefly.panels.operator` | `panels` | `plugin.panel.open`, `plugin.panel.state`; host introspection tools `plugins.*` feed content | `host:ui`, `plugin:catalog-read`, `plugin:lifecycle-read` | Phase 1A |
| `bridges` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `BridgesPanel` | `firefly.panels.operator` | `panels` | `plugin.panel.open`, `plugin.panel.state`; surface reads connected-app status from `firefly.bridge.desktop` / host introspection | `host:ui`, `bridge:read`, `connected-apps:read` | Phase 1A |
| `crm` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `CrmPanel` | `firefly.panels.comms` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `contacts:read` | Phase 1D |
| `studio` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `StudioPanel` | `firefly.panels.comms` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `workspace:file-read`, `media:preview-read` | Phase 1D |
| `voice` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `VoicePanel` | `firefly.panels.comms` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `microphone:read`, `audio:playback` | Phase 1D |
| `oracle` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `OraclePanel` | `firefly.panels.operator` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `agent:catalog-read`, `session:read` | Phase 1C |
| `claude` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `ClaudePanel` | `firefly.panels.comms` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `migration:read`, `config:read` | Phase 1D |
| `ch5pm` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `Ch5PmDashboardPanel` | `firefly.panels.operator` | `panels` | `plugin.panel.open`, `plugin.panel.state` | `host:ui`, `pm:read`, `session:read` | Phase 1C |
| `pdf-review` | `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> `PdfReviewPanel` | `firefly.panels.documents` | `panels` | `plugin.panel.open`, `plugin.panel.state`; future document-grounding tools remain separate | `host:ui`, `document:read`, `document:annotation-read`, `workspace:file-read` | Phase 1E |

### Notes on panel table <!-- oc:id=sec_ao -->

- `review`, `plugins`, `bridges`, and `browser` migrate first because they validate most host wrappers: side-panel open/focus, tool mirroring, session scope, and operator visibility.
- `pdf-review` lands after generic panel runtime stabilizes because it carries extra document-state complexity but must still ship in V2.
- `artifacts` remains first-party plugin-owned even though GenUI artifact rendering itself stays a host subsystem; panel is contribution, artifact runtime is host service.
- Existing duplicate unions for side-panel ids in `atoms/ui.ts`, `atoms/preferences.ts`, and `palot-bridge-schemas.ts` should collapse to one generated host catalog once panel migration finishes.

## 4. Per-widget migration entries for both zones <!-- oc:id=sec_ap -->

| Widget id | Current file | Current zone | Target plugin id | Target family | Target tool surface | Required capabilities | Rollout phase |
|---|---|---|---|---|---|---|---|
| `session-task-list` | `apps/desktop/src/renderer/session-widget-registry.tsx` -> `SessionTaskList` | `above-chat` | `firefly.widgets.session` | `widgets` | host-generated `plugin.widget.list`, `plugin.widget.state`; optional `plugin.firefly.widgets.session.task-list.focus` later | `host:ui`, `session:read`, `tasks:read` | Phase 2A |
| `genui-artifacts` | `apps/desktop/src/renderer/session-widget-registry.tsx` -> `GenUiArtifactWidget` | `chat-inline-right` | `firefly.widgets.session` | `widgets` | `plugin.widget.list`, `plugin.widget.state`; optional artifact-open commands later | `host:ui`, `session:read`, `artifact:read` | Phase 2B |

### Widget migration rules <!-- oc:id=sec_aq -->

- Host keeps `SessionWidgetZoneId = "above-chat" | "chat-inline-right"` and layout persistence in `sessionWidgetLayoutStorageAtom`.
- Built-in widget plugin contributes default zone metadata only. Actual per-session placement and rehome logic remain host-owned wrappers.
- `genui-artifacts` migration must respect `inlineRightEnabled` zone gating; widget contribution exists even when zone is unavailable.

## 5. Commands / feature-toggles migration split <!-- oc:id=sec_ar -->

### 5.1 Host-only commands that stay outside plugin manifests <!-- oc:id=sec_as -->

| Current command / family | Decision | Why |
|---|---|---|
| `palette.open` | host-only | App chrome bootstrap. |
| `sidebar.toggle` | host-only | Left chrome control. |
| `sidepanel.toggle` | host-only | Right chrome control. |
| `session.undo` / `session.redo` | host-only | Session transport + revert semantics are host/runtime owned. |
| `reload.config` | host-only | Reloads host-managed config/runtime. |
| `relaunch.app` | host-only | Native relaunch. |
| `opaque.toggle` | host-only | Native window/transparency preference. |
| session navigation items (`New Session`, active/all session rows, fork session nav shell) | host-only | Routing / session creation shell, not plugin business logic. |

### 5.2 Commands that become built-in plugin contributions <!-- oc:id=sec_at -->

| Current command / family | Target owner | V2 form |
|---|---|---|
| `surface.<id>.open` for all first-party panels | host-generated from built-in panel contributions | `surface.<id>.open` compatibility alias + canonical `plugin.panel.open` wrapper |
| `surface.<id>.toggle` for all first-party panels | host-generated transitional alias | keep during migration; retire after consumers stop depending on toggle naming |
| Browser/product control commands tied to current Palot bridge tool surface | `firefly.bridge.desktop` built-in plugin | plugin tools plus optional palette/menu metadata |
| Feature-facing commands specific to first-party panels/widgets | respective built-in panel/widget plugin | `contributes.commands[]` under `plugin.<pluginId>.*` |
| Theme picker entries | `firefly.themes.core` built-in plugin data + host `plugin.theme.apply` wrapper | no hardcoded palette rows |

### 5.3 Feature-toggle migration split <!-- oc:id=sec_au -->

Current palette `Features` group mixes two distinct things. V2 must split them.

1. **Plugin lifecycle toggles** -> become host operator commands over plugin enablement state. <!-- oc:id=item_at -->
   - Current surface toggles for `review`, `browser`, `notes`, `pulse`, `memory`, `files`, `terminal`, `editor`, `plugins`, `bridges`, `crm`, `studio`, `voice`, `claude`, `ch5pm`, `artifacts`, `pdf-review` map to built-in plugin/panel enablement.
   - Host stores user enable/disable decision as lifecycle/preferences state, not ad hoc per-surface atom API.
1. **Host preference / developer toggles** -> remain host-only commands. <!-- oc:id=item_au -->
   - `automations.toggle` stays host-only because automations subsystem is host-owned.
   - `mock.toggle` and `reactscan.toggle` stay host-only developer switches.
   - Color scheme (`dark` / `light` / `system`) remains host-only preference because it controls host theme resolver, not plugin contribution identity.

### 5.4 Resulting command-palette composition after migration <!-- oc:id=sec_av -->

- Palette becomes pure consumer of projected commands.
- Host injects reserved command groups for core chrome/session/native actions.
- Built-in plugins inject feature/product commands through same manifest path future third-party plugins use.
- No hardcoded per-surface toggle rows remain in `command-palette.tsx` once lifecycle commands project from plugin catalog.

## 6. Themes migration entries <!-- oc:id=sec_aw -->

| Current theme id | Current file | Target plugin id | Target family | Target tool surface | Required capabilities | Rollout phase |
|---|---|---|---|---|---|---|
| `default` (System) | `apps/desktop/src/renderer/lib/themes.ts` | `firefly.themes.core` | `themes` | host-generated `plugin.theme.list`, `plugin.theme.apply`, `plugin.theme.reset`, `plugin.theme.preview` | `theme:contribute` | Phase 4A |
| `cortex` | `apps/desktop/src/renderer/lib/themes.ts` | `firefly.themes.core` | `themes` | same host-generated theme wrappers | `theme:contribute` | Phase 4A |
| `liquid-glass` | `apps/desktop/src/renderer/lib/themes.ts` | `firefly.themes.core` | `themes` | same host-generated theme wrappers | `theme:contribute` | Phase 4A |

### Theme rules during migration <!-- oc:id=sec_ax -->

- `lib/themes.ts` becomes seed data for built-in plugin manifest or generated catalog input, then loses canonical ownership.
- `useThemeEffect` remains host-owned and unchanged in responsibility.
- `themeAtom`, `colorSchemeAtom`, and `opaqueWindowsAtom` remain host preferences; plugin theme contributions never mutate them directly.
- Imported themes only come after built-in themes prove path parity.

## 7. Teardown rules <!-- oc:id=sec_ay -->

Teardown must be deterministic for four cases: disable, uninstall, hot reload update, and crash quarantine. Host owns teardown; plugin contributes metadata only.

### 7.1 If plugin owns currently open side panel <!-- oc:id=sec_az -->

1. Host marks panel contribution unavailable before worker stop. <!-- oc:id=item_av -->
1. If active tab belongs to plugin being disabled/uninstalled/quarantined: <!-- oc:id=item_aw -->
   - switch to first remaining available side panel tab in projected order, or
   - close side panel if none remain.
1. Host increments focus token only when switching to fallback tab. <!-- oc:id=item_ax -->
1. `plugin.panel.state` and `open_side_panel` immediately reflect new availability. <!-- oc:id=item_ay -->
1. Any persisted `lastSidePanelTab` pointing at removed panel is preserved as dormant compatibility state until plugin returns, but active UI must not point at missing tab. <!-- oc:id=item_az -->

### 7.2 If plugin owns mounted widget <!-- oc:id=sec_ba -->

1. Host unmounts widget shell immediately when plugin enters disabling/uninstalling/quarantined state. <!-- oc:id=item_ba -->
1. Layout persistence keeps widget id in session placement record for one cycle so hot reload/re-enable can restore placement automatically. <!-- oc:id=item_bb -->
1. If widget remains unavailable after uninstall completes, host may prune stale widget ids from persisted layout on next layout normalization pass. <!-- oc:id=item_bc -->
1. If zone becomes empty after unmount, zone renders normal empty state; no fallback widget is auto-inserted unless host default-layout repair runs. <!-- oc:id=item_bd -->

### 7.3 If plugin owns active command registrations <!-- oc:id=sec_bb -->

1. Host removes projected command rows, menu entries, and keybindings before worker stop completes. <!-- oc:id=item_be -->
1. Reserved compatibility aliases (`surface.<id>.open` / `.toggle`) disappear when owning contribution disappears. <!-- oc:id=item_bf -->
1. Palette recents survive as inert history entries but are filtered from visible command list until command returns. <!-- oc:id=item_bg -->
1. Any attempted invocation after disable/uninstall returns standard unavailable envelope (`status: "unavailable"`, stable error code like `PLUGIN_DISABLED` / `PLUGIN_UNINSTALLED` / `PLUGIN_QUARANTINED`). <!-- oc:id=item_bh -->

### 7.4 If plugin owns in-flight tool call <!-- oc:id=sec_bc -->

1. Host stamps plugin lifecycle transition reason on call record. <!-- oc:id=item_bi -->
1. If call has not started dispatch, cancel immediately with `status: "cancelled"` and reason `plugin-stopping`. <!-- oc:id=item_bj -->
1. If call is running in worker and plugin is disabled/uninstalled/quarantined: <!-- oc:id=item_bk -->
   - send cooperative cancel first,
   - wait bounded timeout,
   - if no ack, terminate worker and finalize result as `status: "cancelled"` or `status: "failed"` with stable code `PLUGIN_TERMINATED`.
1. Tool provenance must include plugin id and lifecycle reason. <!-- oc:id=item_bl -->
1. Wrapper tools (`plugin.panel.open`, `plugin.theme.apply`) that are host-owned may still succeed if host can complete action without plugin worker. <!-- oc:id=item_bm -->

### 7.5 Theme-specific teardown <!-- oc:id=sec_bd -->

1. If disabled/uninstalled plugin contributed currently effective fallback theme but user did not explicitly pick it, resolver falls through precedence matrix to next layer. <!-- oc:id=item_bn -->
1. If user explicitly picked a theme id that disappears, keep `themeAtom` value, apply fallback effective theme, and restore original pick automatically if theme returns. <!-- oc:id=item_bo -->
1. `plugin.theme.reset` remains explicit user escape hatch; teardown never silently rewrites user pick. <!-- oc:id=item_bp -->

### 7.6 Built-in plugin uninstall rule <!-- oc:id=sec_be -->

- Built-in first-party plugins are **unremovable** in V2 initial scope.
- They may be disabled only if product allows disabling that specific contribution family.
- Unremovable means package cannot be deleted from shipped catalog, but lifecycle disable/quarantine still works so runtime completeness is exercised under same control path.

## 8. Acceptance checklist mapping <!-- oc:id=sec_bf -->

- **Every current hardcoded family has migration disposition**
  - panels -> built-in plugin contributions + host panel chrome wrappers
  - widgets -> built-in widget plugin + host placement wrappers
  - commands -> split between built-in plugin contributions and explicit host-only core commands
  - feature toggles -> split between plugin lifecycle operator commands and host-only preferences/dev toggles
  - themes -> built-in theme plugin contributions + host apply path
- **Every existing first-party side panel has plugin migration row with target plugin/tool/capability mapping**
  - all current `SidePanelTabId` values covered in Section 3
- **Built-in plugin vs host-only decisions are explicit**
  - Sections 2 and 5 lock ownership boundary