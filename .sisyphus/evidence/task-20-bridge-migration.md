# Task 20 — Bridge Migration Plan from `palot-bridge` to V2 Tool/Runtime System <!-- oc:id=sec_aa -->

> Wave 4, Task 20 of plan `firefly-plugin-system-v2`. Do not modify the plan file.
> Inputs read first: Task 2 bridge seams, Task 7 manifest/schema, Task 9 tool projection, Task 10 capability broker, Task 14 bridge projection.

## What this means for V2 <!-- oc:id=sec_ab -->

The current `palot-bridge` is one built-in OpenCode plugin plus a localhost callback bridge. V2 keeps the working behaviors that matter — browser lane control, side-panel control, UI state reads, session-aware context injection, and connected-app discovery — but stops treating them as a one-off plugin with hardcoded tool names and implicit authority. The migration path is: move every current bridge surface into a `PluginDescriptor`/`PluginSessionHandle` projection model, shrink the standalone bridge server into a generic managed-server transport adapter, keep managed-server support working first, and bound or remove Palot-specific assumptions (`palot-bridge` id, duplicated tab enums, hardcoded context arrays, flat tool namespace, global availability, callback hydration mythology). V2.0 still supports the managed server best; attached-server parity stays deferred behind the explicit install pathway already named in Task 14.

---

## 1. Current seam to V2 target map

### 1.1 Runtime object re-shape

| Current object / seam | Current role | V2 landing point | Migration note |
|---|---|---|---|
| `apps/desktop/.opencode/plugins/palot-bridge.js` | compatibility shim exporting default `{ id: "palot-bridge", server }` | temporary compatibility entry only | keep only as managed-server adapter during cutover; stop treating it as canonical source |
| `apps/desktop/src/main/palot-plugin/plugin.js` | canonical first-party bridge plugin with inline tools/hooks | split across built-in plugin manifest + host-generated wrappers + generic dispatch adapter | business logic moves into first-party plugin runtime package; wrapper generation moves to host projection |
| `createPalotPlugin(...)` factory | ad hoc callback/bridge hybrid seam | built-in plugin worker entry implementing declared `contributes.tools[]` handlers | factory becomes plugin-runtime bootstrap, not system architecture |
| `palot-opencode-plugin-shim.ts` | validates `{ id, server }`, hydrates test/runtime callbacks | generalized managed-server projection installer + legacy adapter loader | callback hydration becomes test harness / local runtime helper only |
| `palot-bridge-schemas.ts` | bridge/request/result/session/UI schemas plus tool arg shapes | shared V2 schema package for bridge transport payloads + first-party plugin manifests | keep schema ownership shared; reorganize by projection family instead of one bridge file |
| localhost bridge server in `palot-browser-ipc.ts` | ad hoc authority callback replacement for managed OpenCode runtime | generic host transport adapter for OpenCode plugin projection | keep transport, remove Palot-specific action names and payload assumptions |
| resolver output (`PalotResolverResult`) | one-off session binding + UI snapshot shape | `PluginSessionHandle` snapshot + host introspection payloads | split general session-handle fields from first-party plugin-specific snapshot extras |
| `session-bindings.json` store | Palot bridge session binding persistence | host-owned session-handle backing store | keep persistence in main; expose through generic session-handle APIs |

### 1.2 Per-tool landing points for every current bridge tool and hook

| Current bridge surface | Current behavior | V2 tool/runtime landing point | Scope / capability in V2 | Cutover disposition |
|---|---|---|---|---|
| `search_tools` | stub discovery tool | host-generated `plugins.tools` plus `plugin.connections.tool.search` business tool for MCP/connected-app search | `session`, `tool:register` for plugin, no extra privilege for host introspection | replace stub; remove from flat root namespace |
| `describe_tool` | stub tool description lookup | host-generated `plugins.tools` / `plugins.describe` plus optional `plugin.connections.tool.describe` | `session`, read-only introspection | replace stub |
| `call_tool` | stub queued call surface | `plugin.connections.tool.call` business tool backed by connection runtime | `session`; brokered by target tool capability policy, not bridge bypass | replace stub with real runtime dispatch |
| `tools_status` | stub connection/runtime status | host-generated `plugins.state`, `plugins.permissions`, optional `plugin.connections.status` | `session`, read-only | replace stub |
| `browser_status` | browser lane status read | `plugin.palot.browser.status` business tool plus `plugin.palot.panel.state` wrapper for browser panel | `session`; `bridge:session-read`, `bridge:ui-state-read` | preserve behavior; rename into plugin namespace |
| `browser_open` | open URL in lane | `plugin.palot.browser.open` business tool | `session`; `browser:lane-control` | preserve behavior; routed through generic transport |
| `browser_navigate` | navigate current lane | `plugin.palot.browser.navigate` business tool | `session`; `browser:lane-control` | preserve behavior |
| `browser_tabs` | list/open/close/activate tabs | `plugin.palot.browser.tabs` business tool | `session`; `browser:lane-control` | preserve behavior; eventually split verbs if desired |
| `browser_click` | click by coords/metadata | `plugin.palot.browser.click` business tool | `session`; `browser:lane-control` | preserve behavior; keep low-confidence error in plugin-scoped code |
| `browser_type` | type text | `plugin.palot.browser.type` business tool | `session`; `browser:lane-control` | preserve behavior |
| `browser_scroll` | scroll lane | `plugin.palot.browser.scroll` business tool | `session`; `browser:lane-control` | preserve behavior |
| `open_side_panel` | open a side-panel tab | host-generated `plugin.palot.panel.open` wrapper with `panelId` / `tabId`, optionally backed by host adapter only | `session` or `app` depending panel class; `bridge:ui-state-write` | move out of ad hoc root tool; host wrapper owns enum validation |
| `ui_state` | read mirrored side-panel UI state | host-generated `plugin.palot.panel.state` and/or `plugins.state` UI section | `session` or `app`; `bridge:ui-state-read` | remove dedicated one-off root tool |
| hook `experimental.chat.system.transform` | append `<elf-context>` / product-control block | host-generated plugin context channel from `PluginDescriptor` + `PluginSessionHandle` | non-secret, no direct capability; filtered by grants and inject flags | remove hardcoded block builder |
| hook `event` | refresh on `session.idle` | host session-handle reconcile lifecycle, not plugin-defined hook semantics | host-owned | remove special hook; replace with generic session-handle refresh loop |

### 1.3 Current hook/tool families to V2 contribution families

| Current family | V2 family | Notes |
|---|---|---|
| Browser tools | `contributes.tools[]` in built-in `palot.core` (or equivalent) plugin | stay imperative; declared statically, gated per session |
| UI tools | host-generated wrappers from `contributes.panels[]` | no special root tools after cutover |
| Discovery tools | host introspection + first-party connections plugin tools | stop mixing discovery stubs into browser bridge plugin |
| Prompt/context hook | `bridge` metadata + context projection config on descriptor | host renders context blocks, plugin does not handcraft strings |
| Event refresh hook | host lifecycle/session-handle machinery | not a plugin contribution family in V2 |

---

## 2. Phased cutover: declarative manifest first, imperative dynamic tools second <!-- oc:id=sec_ac -->

### Phase 0 — Freeze current bridge semantics behind inventory and adapters <!-- oc:id=sec_ad -->

Goal: no behavior change, just pin the seam.

- Keep `palot-bridge` working for managed servers exactly as today.
- Mark `apps/desktop/.opencode/plugins/palot-bridge.js` as compatibility shim only.
- Treat `plugin.js` as source to be decomposed, not as future architecture.
- Add explicit mapping comments/docs: each current root tool has a V2 namespaced target.
- Acceptance: no current browser/UI control path regresses while migration scaffolding lands.

### Phase 1 — Declarative manifest projection for first-party built-ins <!-- oc:id=sec_ae -->

Goal: make descriptor the source of truth before changing transport.

- Introduce built-in first-party plugin manifests for Palot surfaces, likely split into at least:
  - `palot.browser`
  - `palot.panels`
  - `palot.connections` (or a similarly named first-party plugin)
- Declare all current surfaces in `contributes.panels[]`, `contributes.commands[]`, `contributes.tools[]`, and `bridge` metadata.
- Generate host introspection (`plugins.*`) and host wrappers (`plugin.<id>.panel.*`) from descriptors.
- Continue routing actual execution through existing bridge handlers where needed.
- Acceptance: current bridge tools and hooks now have descriptor-backed identities and namespaces even if execution still calls old transport.

### Phase 2 — Imperative dynamic-tool support inside declared superset <!-- oc:id=sec_af -->

Goal: preserve live/session-aware availability without bringing back ad hoc registration.

- Keep static manifest-declared superset for all first-party business tools.
- Move runtime variability to `PluginSessionHandle.perSessionToolExposure`, not runtime creation of new ids.
- Example: browser tools are always declared, but hidden/disabled for sessions with no lane binding.
- Move connected-app discovery off stubs and onto live connection runtime, but under statically declared tool names.
- Acceptance: no current behavior depends on runtime minting of tool ids; session-aware visibility comes from handles.

### Phase 3 — Host-generated wrappers replace root bridge tools <!-- oc:id=sec_ag -->

Goal: remove flat root names and special-case wrappers.

- Replace root `open_side_panel` with host-generated `plugin.<id>.panel.open`.
- Replace root `ui_state` with `plugin.<id>.panel.state` and richer `plugins.state` sections.
- Replace root discovery tools with `plugins.*` plus namespaced first-party business tools.
- Keep browser control tools namespaced under plugin ownership.
- Maintain temporary alias layer only for backward compatibility in managed mode.
- Acceptance: new sessions see only namespaced V2 surfaces by default; aliases become optional compatibility surface.

### Phase 4 — Generic transport adapter replaces Palot-specific bridge protocol <!-- oc:id=sec_ah -->

Goal: same transport, generic protocol.

- Convert bridge actions from Palot-specific verbs (`resolve-binding`, `dispatch-browser-tool`, `get-ui-state`, `open-side-panel`) to a generic projection protocol such as:
  - `resolve-session-handle`
  - `dispatch-tool`
  - `query-surface-state`
  - `invoke-surface-wrapper`
- Request envelope becomes discriminated by projection kind, not hardcoded Palot action names.
- `palot-opencode-plugin-shim.ts` stops describing Palot-only callback names and instead hydrates a generic runtime adapter for tests/dev.
- Acceptance: transport can service any first-party or third-party plugin projection, not only Palot browser/UI surfaces.

### Phase 5 — Fade root `palot-bridge` identity to compatibility layer only <!-- oc:id=sec_ai -->

Goal: generalized runtime becomes canonical.

- Canonical first-party built-ins are loaded from V2 plugin catalog, not from `id: "palot-bridge"` module identity.
- The old `palot-bridge` entry remains only as a migration/legacy adapter for OpenCode managed-server plugin loading until OpenCode install/runtime story is generalized further.
- Attached-server v2.1 path plugs into the same descriptor + transport layer, not a second custom bridge.
- Acceptance: special-case Palot bridge assumptions are bounded to the compatibility adapter, not the architecture.

---

## 3. Standalone bridge transport fade path

### 3.1 What stays

- Managed-server bridge transport over localhost stays in V2.0 because it is the only working standalone authority seam for OpenCode plugin runtime today.
- Main process remains the sole authority for browser lane control, session binding state, UI snapshot mutation, and secret-held viewer state.
- Env injection stays the managed-server install mechanism in V2.0 (`OPENCODE_PLUGIN`, `PALOT_BRIDGE_URL`, `PALOT_BRIDGE_TOKEN`) because Task 14 already locked attached-server support as deferred.

### 3.2 What changes

| Current transport trait | Problem | V2 fade action |
|---|---|---|
| `PALOT_BRIDGE_URL` / `PALOT_BRIDGE_TOKEN` named for one plugin | transport looks product-specific | rename logically in code/docs to generic host projection transport; keep legacy env names only as compatibility aliases if needed |
| action names are Palot-only | blocks reuse for other plugins | move to generic discriminated request envelope |
| response shape mostly interface-only | weak validation | add Zod request/response schemas at transport boundary |
| bridge serves one plugin's callback contract | architecture tied to `createPalotPlugin` seam | serve host projection runtime contract instead |
| plugin decides when to call `resolveBinding` | session-handle logic split across plugin and host | host becomes source of `PluginSessionHandle`; plugin asks for standardized session snapshot |

### 3.3 Fade milestones

1. **Bridge as adapter, not architecture**
   - Document/implement transport as `managed OpenCode callback adapter`.
   - Stop naming future design around `palot-bridge`.
2. **Generic request envelope**
   - Replace ad hoc action strings with typed generic dispatch kinds.
3. **Descriptor-addressed routing**
   - Requests route by `pluginId`, `toolId`, `surfaceId`, `sessionId`, not by hardcoded tool families.
4. **Compatibility aliases only**
   - Old root tools and old action names shimmed temporarily.
5. **Optional retirement**
   - If OpenCode later exposes direct host callback or generalized plugin install/runtime seams, bridge transport can collapse behind that without changing descriptor/tool architecture.

### 3.4 Boundaries that must not move

- No plugin code in main.
- No renderer authority bypass.
- No secret-bearing viewer token in plugin-visible or renderer-visible state.
- No attached-server silent retrofit in V2.0.

---

## 4. Session-binding re-shape <!-- oc:id=sec_aj -->

### 4.1 From Palot binding record to generic `PluginSessionHandle` <!-- oc:id=sec_ak -->

Current binding is one Palot-shaped record persisted at `~/.config/elf/opencode/session-bindings.json`. V2 should treat that store as one backing source for a more general host session-handle layer.

| Current field / concept | Current shape | V2 target | Why |
|---|---|---|---|
| `openCodeSessionId` | persisted string | `PluginSessionHandle.sessionId` | canonical session address across all plugin projections |
| `browserLaneId` | persisted nullable string | first-party plugin session state for `palot.browser` | not every plugin has a lane; keep plugin-specific |
| `magicBrowserSessionId` | persisted nullable string | first-party plugin session state | same |
| `status` (`unbound`, `attaching`, etc.) | persisted binding status | host session-availability state + plugin-specific binding state | split generic availability from browser-specific binding |
| `viewerUrl` / health / viewport | derived non-secret snapshot | plugin session snapshot data | remains derived, not persisted |
| `uiState` inclusion in resolver payload | optional mixed into resolver result | separate host UI snapshot query feeding wrappers | avoid overloading session-handle snapshot with unrelated app state |
| `opaqueActionTarget` | Palot-specific dispatch token | generic transport address for plugin worker / host adapter | abstract transport target |

### 4.2 Proposed shape split <!-- oc:id=sec_al -->

- **Host session registry**
  - session existence
  - server mode (`managed`, `attachedUnsupported`, `offline`, `reconnecting`)
  - per-session availability state
- **PluginSessionHandle**
  - plugin id
  - session id
  - visible tools for that session
  - granted capabilities subset for that session
  - plugin-scoped non-secret state snapshot
- **First-party browser binding state**
  - lane id
  - magic browser session id
  - binding lifecycle
  - viewer URL hint
  - health / last actions

This removes the current assumption that one Palot binding record is the universal session-control object.

### 4.3 Lifecycle re-shape <!-- oc:id=sec_am -->

Current `event` hook refresh on `session.idle` is too weak and too plugin-specific. V2 should instead:

- derive/refresh `PluginSessionHandle` on server event stream changes,
- reconcile when browser lane attaches/detaches,
- reconcile when capabilities change,
- reconcile when plugin lifecycle changes (disable/quarantine/update),
- expose stale/unavailable status via introspection and wrappers.

The plugin should not own the refresh contract. Host does.

### 4.4 Persistence rule <!-- oc:id=sec_an -->

- Persist only generic host session-linkage state and first-party plugin state that must survive restart.
- Keep secrets in main-only secret cache.
- Do not persist plugin-computed UI or context strings.
- Version the store for V2 migration so `version: 1` Palot binding data can hydrate `PluginSessionHandle`-backed state safely.

---

## 5. Special-case bridge assumption removals

### 5.1 Assumptions to remove entirely

| Current assumption | Why it is special-case debt | V2 replacement |
|---|---|---|
| Canonical plugin id is `palot-bridge` | architecture tied to one adapter module | canonical identity comes from built-in plugin descriptors; `palot-bridge` becomes compatibility alias |
| Flat root tool names (`browser_*`, `ui_state`, `open_side_panel`) | no namespace, hard to scale, no plugin ownership | namespaced `plugin.<id>.*` and `plugins.*` |
| Hardcoded `PRODUCT_CONTROL_TOOLS` and `CONNECTION_DISCOVERY_TOOLS` arrays | prompt block can lie; duplicated source of truth | derive from descriptor contributions + wrapper generation |
| Hardcoded `VALID_SIDE_PANEL_TABS` array in plugin file | duplicates shared schema | derive from shared panel/tab contribution metadata |
| Discovery tools live inside browser bridge plugin | unrelated concerns mixed | connections/discovery land in host introspection + dedicated first-party plugin |
| `event` hook on `session.idle` is the refresh mechanism | fragile, plugin-owned lifecycle | host session-handle reconciliation loop |
| Plugin callback names (`resolve`, `dispatch`, `getUiState`, `openSidePanel`) define architecture | test seam leaked into product design | generic transport/runtime host API |

### 5.2 Assumptions to bound, not fully remove yet

| Current assumption | Why it must remain for now | Bound in V2 by |
|---|---|---|
| Managed-server-only working path | OpenCode cannot hot-inject plugin into attached server today | Task 14 matrix: explicit unsupported row, explicit v2.1 install-path workstream |
| Localhost bridge transport | only reliable standalone authority seam today | generic transport adapter, not Palot-specific protocol |
| First-party browser/UI authority lives in main | correct security boundary | capability broker + host-owned adapters |
| Browser tools depend on session binding / lane existence | true product constraint | `PluginSessionHandle.perSessionToolExposure` and explicit `tool_unavailable` / `permission_denied` semantics |

### 5.3 Explicit non-goals during this migration

- Do not make attached/pre-existing OpenCode servers work silently in V2.0.
- Do not preserve flat root tool names as canonical forever.
- Do not let first-party built-ins bypass capability broker because "they are ours".
- Do not move browser/UI authority into renderer or plugin runtime.
- Do not keep discovery stubs once connection runtime projection exists.

---

## 6. Recommended implementation order <!-- oc:id=sec_ao -->

1. Introduce first-party built-in manifests and descriptor generation for current bridge-owned surfaces. <!-- oc:id=item_aa -->
1. Generate `plugins.*` introspection and per-family wrappers from descriptors. <!-- oc:id=item_ab -->
1. Rename/migrate current bridge tools to namespaced equivalents while keeping aliases. <!-- oc:id=item_ac -->
1. Move discovery stubs to real connection runtime tools. <!-- oc:id=item_ad -->
1. Convert bridge request protocol from Palot actions to generic projection dispatch. <!-- oc:id=item_ae -->
1. Re-shape session binding into host session registry + plugin session handles. <!-- oc:id=item_af -->
1. Demote `palot-bridge` entry to compatibility adapter only. <!-- oc:id=item_ag -->

---

## 7. Acceptance criteria check

- [x] Current bridge tools and hooks have explicit V2 landing points.
- [x] Special-case Palot bridge assumptions are reduced or bounded.
- [x] Phased cutover covers declarative manifest first, imperative dynamic tools second.
- [x] Standalone bridge transport fade path is explicit.
- [x] Session-binding re-shape is explicit.

---

## 8. Cross-references <!-- oc:id=sec_ap -->

- Plan: `.sisyphus/plans/firefly-plugin-system-v2.md` (Wave 4, Task 20)
- Prior evidence: `.sisyphus/evidence/task-2-bridge-seams.md`
- Prior evidence: `.sisyphus/evidence/task-7-manifest-schema.md`
- Prior evidence: `.sisyphus/evidence/task-9-tool-projection.md`
- Prior evidence: `.sisyphus/evidence/task-10-capability-broker.md`
- Prior evidence: `.sisyphus/evidence/task-14-bridge-projection.md`
- Current shim: `apps/desktop/.opencode/plugins/palot-bridge.js`
- Current bridge loader: `apps/desktop/src/main/palot-opencode-plugin-shim.ts`
- Current shared seam schemas: `apps/desktop/src/shared/palot-bridge-schemas.ts`
- Current bridge doc: `docs/palot-opencode-plugin-bridge.md`