# Task 14 — OpenCode Bridge Projection Architecture <!-- oc:id=sec_aa -->

> Wave 3, Task 14 of plan `firefly-plugin-system-v2`. Do not modify the plan file.
> Inputs: Task 7 (manifest + bridge metadata), Task 9 (tool projection model + envelope + state machine), Task 12 (API tiering + evolution rules), plus Task 2 (current `palot-bridge` reality) as the seam this design replaces.

## 1. Server-mode behavior matrix (V2 initial stance, decided) <!-- oc:id=sec_ab -->

| Server mode | Plugin install | Tool projection | Introspection | Context injection | Lifecycle controls | Operator UX status | Canonical error code |
|---|---|---|---|---|---|---|---|
| Managed (Palot-spawned) | Yes | Yes | Yes | Yes | Full | Normal | none |
| Attached existing server, no V2 bridge install path applied | No | No | No | No | Disabled | "Bridge unsupported on attached server" badge | `bridge_unsupported_server` |
| Attached existing server, after V2 generalized plugin install path (deferred to v2.1) | Yes (restricted to manifests declaring install pathway) | Yes | Yes | Yes | Full | Normal | none |
| Offline / no OpenCode server | N/A | Empty (no tool surface) | Empty | N/A | Plugin controls gated | "No active server" badge | `no_active_server` |
| Reconnect after server loss | N/A | Re-derives after reconnect | Empty mid-reconnect, recovers after | Paused | Re-derives `PluginSessionHandle` | "Session lost, reconnecting…" | `session_lost` |

V2 initial rollout is managed-server-only; the attached-server generalized-install pathway is explicitly deferred to v2.1 with a dedicated workstream.

### Why this matrix is now locked <!-- oc:id=sec_ac -->

The current `palot-bridge` (Task 2 §4) is `OPENCODE_PLUGIN` env-var injection that only fires inside `spawnServer` (`apps/desktop/src/main/opencode-manager.ts:650`). `appendPalotPlugin` is never reached on the `detectExistingServer` / lockfile-reconnect path. The bridge doc (`docs/palot-opencode-plugin-bridge.md:79-91`) is explicit about this gap. Generalizing it requires one of: (a) OpenCode supporting hot plugin load (it does not today), (b) writing `~/.config/opencode/config.json` without explicit user consent (violates deny-by-default), or (c) restarting the user's server (orphans in-flight sessions). The matrix above is the architectural mirror of that reality: managed gets full projection, attached-without-v2.1 is honestly marked unsupported, and v2.1 is named as the workstream that will close the gap for plugins that declare a manifest-level install pathway.

---

## 2. Bridge projection architecture (how `PluginDescriptor` + `PluginSessionHandle` are consumed) <!-- oc:id=sec_ba -->

The OpenCode bridge is a **projection consumer** — it reads the four canonical objects (per Task 7) and emits three concrete things into the running OpenCode server: (1) tool definitions, (2) system-context blocks, and (3) introspection results. It never mutates the descriptor.

### 2.1 Inputs (what the projection reads, and from which object) <!-- oc:id=sec_bb -->

| Projection output | `PluginDescriptor` fields | `PluginInstance` fields | `PluginSessionHandle` fields | Host policy state |
|---|---|---|---|---|
| Tool definition entries | `contributes.tools[]`, `contributes.commands[]`, `contributes.panels[]`, `contributes.widgets[]`, `contributes.themes[]` | — | — | reserved namespaces, tier=stable/proposed/internal rules |
| Introspection summaries | `id`, `version`, `publisher`, `apiVersion`, `fireflyClientVersion`, `tier`, `trust`, `capabilities[]`, `contributes.*` counts | `activationStatus`, `crashCount`, `quarantineState`, `grantedCapabilities` | `sessionAvailability`, `perSessionToolExposure` | operator-applied deprecations |
| System-context block | `id`, `version`, `contributes.panels[].id`, `contributes.commands[].id`, `contributes.themes[].id` (only those marked `injectIntoContext: true`) | `activationStatus` | `boundSession`, `viewerUrl`, `laneHealth` | context budget caps (e.g. 4 KB per block) |
| Dispatch routing | `contributes.tools[].name`, `contributes.commands[].handlerPluginOnly` | transport handle, granted capabilities | `sessionID` | capability grants, network domains |
| Lifecycle controls (enable/disable/quarantine) | `trust`, `tier` | `lifecycleState`, `quarantineReason`, `crashCount` | — | operator policy, per-project vs per-app grants |

**Rule**: the OpenCode projection never reads from disk. Every value is computed in main from the four canonical objects at projection time. This mirrors Task 7 §8.

### 2.2 Three output channels into the OpenCode server <!-- oc:id=sec_bc -->

The bridge injects into the OpenCode server via three independent channels, all governed by the same `PluginDescriptor` + `PluginSessionHandle` view:

1. **Tool channel** — projected `tool.{name}.execute` entries and `tool.<pluginId>.*` host-generated wrappers; consumed by OpenCode's tool-call dispatcher (see §3 below).
2. **Context channel** — `experimental.chat.system.transform` (and its v2 evolution equivalent) returns appended `<elf-context>` blocks derived from `PluginSessionHandle` snapshot (see §4 below).
3. **Introspection channel** — the host-generated `plugins.*` and `plugin.<id>.*` family tools (Task 9 §2) are serialized into the same tool channel but are marked read-only in their envelope; they do not produce `<elf-context>` blocks.

These three channels are the only legitimate output surfaces. The renderer never calls the OpenCode bridge directly; the renderer is mediated through the host (plan §`Layered Runtime Ownership`).

### 2.3 Per-server-mode projection policy <!-- oc:id=sec_bd -->

```text
on ServerModeChange(mode: ServerMode):
  switch mode:
    case Managed:
      projection.install = full
      projection.tools = full
      projection.introspection = full
      projection.context = full
      projection.lifecycle = full
      projection.error = none

    case AttachedUnsupported:
      projection.install = none
      projection.tools = empty
      projection.introspection = empty
      projection.context = none
      projection.lifecycle = disabled
      projection.error = "bridge_unsupported_server"
      operatorUX = "Bridge unsupported on attached server" badge

    case AttachedV21:
      projection.install = restricted
      projection.tools = full
      projection.introspection = full
      projection.context = full
      projection.lifecycle = full
      projection.error = none

    case Offline:
      projection.tools = empty
      projection.introspection = empty
      projection.context = none
      projection.lifecycle = gated
      projection.error = "no_active_server"
      operatorUX = "No active server" badge

    case Reconnecting:
      projection.tools = empty mid-reconnect, re-derives after reconnect
      projection.introspection = empty mid-reconnect
      projection.context = paused
      projection.lifecycle = paused
      projection.error = "session_lost"
      operatorUX = "Session lost, reconnecting…"
```

The same `PluginDescriptor` powers all five rows. The matrix is the **policy table**, not a separate code path per mode. Every row re-enters through `deriveProjection(mode, descriptor)`.

### 2.4 Architectural replacement for the current `palot-bridge` plugin file <!-- oc:id=sec_be -->

The current `apps/desktop/.opencode/plugins/palot-bridge.js` (21-line shim) and `apps/desktop/src/main/palot-plugin/plugin.js` (477 lines) collapse to:

- **No single plugin file.** The 13 inline tool definitions (Task 2 §1) become contributions in `palot.core` (a `built-in` plugin) plus the surface wrappers from Task 9 §3.
- **No inline `PRODUCT_CONTROL_TOOLS` / `CONNECTION_DISCOVERY_TOOLS` arrays.** These hardcoded arrays (plugin.js:35-46) are the source of the "prompt block can lie about which tools exist" gap (Task 2 §7 item 6). They are replaced by `PluginDescriptor.contributes.{panels,commands,themes}[].id` filtered by `injectIntoContext: true`.
- **No `VALID_SIDE_PANEL_TABS` duplication.** The plugin's local enum (plugin.js:124) is derived from `sidePanelTabSchema` via the descriptor.
- **The bridge HTTP server stays** (it is the right transport for managed servers), but its 4 actions become 1 action: `dispatch({ kind, payload })` dispatched on `PluginDescriptor` namespace. Discovery tools move from stubs to live projections over `mcp-connections-runtime.listMcpConnectionRecords()`.

This is the bridge architecture. The mechanics of *how* a single tool call flows through it are in §3.

---

## 3. Tool definition serialization and dispatch pathway <!-- oc:id=sec_ca -->

### 3.1 Serialization format (host -> OpenCode) <!-- oc:id=sec_cb -->

The host emits, for every active session in managed mode:

```text
tool.<pluginId>.<verb>          // business tool from contributes.tools[]
plugin.<pluginId>.panel.list
plugin.<pluginId>.panel.state
plugin.<pluginId>.panel.open
plugin.<pluginId>.widget.list
plugin.<pluginId>.widget.state
plugin.<pluginId>.widget.mount
plugin.<pluginId>.widget.unmount
plugin.<pluginId>.command.list
plugin.<pluginId>.command.run
plugin.<pluginId>.theme.list
plugin.<pluginId>.theme.apply
plugin.<pluginId>.theme.reset
plugin.<pluginId>.theme.preview
plugins.list
plugins.describe
plugins.tools
plugins.panels
plugins.widgets
plugins.commands
plugins.themes
plugins.state
plugins.permissions
plugins.lifecycle
```

Each entry is serialized as `{ description, args: <z.ZodRawShape derived from inputSchema>, sessionScope, timeoutMs, dispatchingCeilingMs, requiresCapabilities, uiHints? }`. The dual-shape pattern from Task 2 §5 (raw shape for OpenCode `args`, ZodObject for runtime `.parse()`) is preserved.

**Stability contract** (Task 12 §1, applied to every emitted tool id):
- `tier: stable` -> host never renames or removes the id within the major
- `tier: proposed` -> id is listed in `enabledApiProposals` on the plugin manifest
- `tier: internal` -> never emitted for third-party plugin activation

**Reserved namespaces** (Task 9 §7, frozen): `plugins.*`, `plugin.*`, `firefly.*`, `surface.*`, `session.*`, `theme.*`, `sidebar.*`, `sidepanel.*`, `bridge.*`, `lifecycle.*`. Third-party plugins can only mint ids under `plugin.<theirId>.*`.

### 3.2 Dispatch pathway (OpenCode -> plugin worker) <!-- oc:id=sec_cc -->

```
OpenCode runtime tool call
  -> SDK resolves tool id in its current tool catalog
  -> if catalog empty (Offline/AttachedUnsupported):
       return envelope { status: "unavailable",
                         errorCode: "no_active_server" | "bridge_unsupported_server" }
  -> host bridge receives call from OpenCode via the existing transport seam
     (managed: env-var-injected `palot` plugin calls back through the localhost bridge;
      future: a documented OpenCode runtime callback)
  -> host pre-flight checks (in order):
       1. session mode (matrix §2.3)         -> "unavailable" envelope on no_active_server / bridge_unsupported_server
       2. tool exists in descriptor          -> "unavailable" envelope on tool_unavailable if plugin disabled
       3. session scope matches call scope   -> "denied" envelope on scope mismatch
       4. capability broker grant            -> "denied" envelope on permission_denied
       5. input Zod parse against inputSchema -> "failed" envelope on validation_error
  -> on success, transition queued -> dispatching
  -> host acquires worker transport handle from PluginInstance
  -> transition dispatching -> running (start ceiling timer; default 5s for dispatching, 60s for running)
  -> worker executes; emits progress events; may stream partial results
  -> on terminal: completed | failed | cancelled | timeout -> failed
  -> host serializes canonical envelope (Task 9 §5) and returns to OpenCode
  -> tool-call state machine (Task 9 §6) updates; the 9 states are observable in the operator log
```

The pre-flight order is **load-bearing**:
- Mode check first: a server-mode that forbids projection must never trigger a capability prompt, never start a worker, never allocate a tool slot. The mode check is the only thing that can short-circuit the entire pathway with `unavailable`.
- Scope check before capability check: a session-scoped tool called with `scope: app` must be denied with the scope error, not silently allowed and then misrouted.
- Capability check before Zod parse: a `denied` envelope must not consume a Zod parse cycle or log a `validation_error` for a request that would have been denied anyway.

### 3.3 Dispatch for plugin business tools vs host-generated wrappers <!-- oc:id=sec_cd -->

| Tool class | Where the handler lives | What the host does |
|---|---|---|
| Introspection (`plugins.*`) | host-only | always synthesized from descriptor + instance + handle; never reaches plugin worker |
| Surface inventory (`plugin.<id>.<family>.list`) | host-only | always synthesized from descriptor |
| Surface control wrappers (`plugin.<id>.<family>.<verb>`) | mixed | host validates scope+capability, then either calls plugin handler (if `handlerPluginOnly: true`) or calls host adapter (e.g. host applies theme, opens side panel) |
| Plugin business tools (`plugin.<id>.<verb>`) | plugin-only | host forwards to plugin worker transport handle; plugin handler returns typed result |
| Dynamic session tools (visibility changes only) | plugin-owned names, host gates availability | host sets `visible: false` for sessions where the tool is gated; the name stays in the declared namespace |

The boundary between host and plugin handler is **the capability broker**. A surface wrapper that ends up calling a host adapter (e.g. opening a side panel) still passes through the broker for the `bridge:ui-state-write` capability. A plugin business tool passes through the broker for the capabilities declared in `contributes.tools[].requiresCapabilities[]`. There is no shortcut.

### 3.4 Cross-server-mode dispatch table <!-- oc:id=sec_ce -->

| Server mode | Plugin business tool call | Surface wrapper call | Introspection call |
|---|---|---|---|
| Managed | full path; worker transport required | full path; host adapter or worker | returns live snapshot |
| AttachedUnsupported | `unavailable` envelope, `errorCode: bridge_unsupported_server` | same | empty list, `errorCode: bridge_unsupported_server` |
| AttachedV21 (v2.1) | full path | full path | full path |
| Offline | `unavailable` envelope, `errorCode: no_active_server` | same | empty list, `errorCode: no_active_server` |
| Reconnecting | queued at host; `unavailable` envelope, `errorCode: session_lost`; auto-retries after reconnect | same | empty mid-reconnect; re-derives on reconnect |

---

## 4. System-context block generation <!-- oc:id=sec_da -->

### 4.1 Trigger <!-- oc:id=sec_db -->

The OpenCode runtime calls `experimental.chat.system.transform` (and the future v2 evolution equivalent) on every system prompt assembly. The bridge intercepts that call and may append one or more context blocks. The current implementation (Task 8) appends a single `<elf-context>` block; V2 generalizes this.

### 4.2 Block shape (host-generated, per plugin) <!-- oc:id=sec_dc -->

```ts
type PluginContextBlock = {
  pluginId: string                           // reverse-domain, never empty
  schemaVersion: `${number}.${number}`      // mirrors PluginDescriptor.apiVersion
  trust: "built-in" | "local-dev" | "signed-third-party"
  activationStatus: PluginInstance["activationStatus"]  // never exposes crash counter or quarantine internals
  sessionRef: {
    opencodeSessionId: string                // from PluginSessionHandle
    bindingStatus: "attached" | "attaching" | "suspended" | "released" | "unbound"
    laneId?: string                          // present iff lane is attached
    magicBrowserSessionId?: string           // present iff Magic Browser lane is bound
    viewerUrl?: string                      // non-secret hint; no token
  } | null
  injectedSurfaces: Array<{
    family: "panel" | "widget" | "command" | "theme" | "tool"
    id: string                               // host-namespaced projection id
    label: string                            // human-readable, model-readable
    hint: string                             // when to use this surface, <= 200 chars
  }>
  capsBudget: number                         // bytes used so far; host enforces hard cap
  version: string                            // PluginDescriptor.version
}
```

The block is **non-secret by construction**: no `viewerAuthToken`, no `PALOT_BRIDGE_TOKEN`, no `safeStorage` decrypt calls. The only Magic Browser field exposed is the session id (which is already a non-secret derived identifier per Task 2 §2 secret/cache split).

### 4.3 Generation rules <!-- oc:id=sec_dd -->

1. **Source**: `PluginDescriptor.contributes.*` filtered by `injectIntoContext: true` on each contribution. Default: `false`. The manifest author opts in per contribution; the host does not assume.
2. **Re-derivation**: blocks are generated on every `system.transform` call. The host does not cache them across calls. State changes (binding attach, capability grant) appear on the next prompt assembly, not after some debounce.
3. **Budget**: total injected context must not exceed the host cap (default 4 KB per plugin, 16 KB aggregate). Exceeding the cap truncates with a host-issued warning and returns `status: "completed"` with `data: { truncated: true, capBytes: <n>, usedBytes: <n> }`. There is no `failed` state for over-budget; this is a host policy, not a tool failure.
4. **Empty cases**:
   - No matching plugin in descriptor: no block emitted (and no error)
   - Plugin instance status `disabled` or `quarantined`: emit block with `activationStatus` only, `injectedSurfaces: []`; the model is told the plugin exists but no tools are available
   - Server mode != Managed or != AttachedV21: emit no block; the context channel is `paused` or `none` per matrix
   - `PluginSessionHandle` empty (reconnect): emit no block; surface `session_lost` to operator UX instead of pretending the binding is healthy
5. **Order**: blocks are appended in `PluginDescriptor.id` lexicographic order, so the model sees a deterministic, schema-versioned block order across runs.
6. **Compatibility**: the block shape is locked at `schemaVersion: "2.0"`. Any future change follows Task 12 evolution rules (additive fields only, `deprecations[]` entry on rename, `tier: proposed` first, `tier: stable` after one major).

### 4.4 What replaces the current `buildProductContextBlock` <!-- oc:id=sec_de -->

The current `buildProductContextBlock` (Task 2 §1 row 14; `palot-plugin/plugin.js:73`) reads the resolver result, hand-iterates `PRODUCT_CONTROL_TOOLS` and `CONNECTION_DISCOVERY_TOOLS` (plugin.js:35-46, hardcoded arrays), and emits a string with both lists inline. V2 replacement:

- The two hardcoded arrays are removed entirely. The block is generated by walking `PluginDescriptor.contributes.{panels,commands,themes}[]` for items with `injectIntoContext: true`, plus the per-family wrappers (Task 9 §3) that are always announced.
- The `PRODUCT_CONTROL_TOOLS` announcement is replaced by `plugin.<id>.<family>.<verb>` host-generated wrappers (always present, always announced), so the prompt block can never lie about which wrappers exist.
- The resolver call stays. The context block is generated after the resolver returns a fresh `PluginSessionHandle` snapshot, so it always reflects current binding state, not stale plugin-side cache (per Task 8 guardrail "no long-lived ... cache in plugin state").

### 4.5 Cross-server-mode context policy <!-- oc:id=sec_df -->

| Server mode | Context channel behavior |
|---|---|
| Managed | full; per-plugin blocks emitted per §4.3 |
| AttachedUnsupported | none; no block emitted; the prompt block is bare of plugin context |
| AttachedV21 (v2.1) | full; same as Managed |
| Offline | none |
| Reconnecting | paused; mid-reconnect emits no block; resumes after handle re-derives |

The session-lost event surface (matrix row 5) is **not** injected into the system prompt. It is a UX badge. Models should not be told that the session is reconnecting; the resolver retry handles that.

---

## 5. Failure mode coverage <!-- oc:id=sec_ea -->

Every failure path produces a canonical envelope with `errorCode` from the host-reserved taxonomy (Task 9 §5). The matrix below extends the 9-state tool-call state machine with the bridge projection's distinct failure paths.

### 5.1 Tool-call failure modes <!-- oc:id=sec_eb -->

| Failure mode | Detection point | Envelope status | Canonical error code | Retryable? | Operator UX |
|---|---|---|---|---|---|
| Server mode == AttachedUnsupported (no v2.1) | mode check §3.2 step 1 | `unavailable` | `bridge_unsupported_server` | no | "Bridge unsupported on attached server" badge |
| Server mode == Offline | mode check §3.2 step 1 | `unavailable` | `no_active_server` | yes (when server comes back) | "No active server" badge |
| Server reconnecting (mid-flight) | mode check §3.2 step 1 | `unavailable` | `session_lost` | yes (auto) | "Session lost, reconnecting…" |
| Tool id not in descriptor (e.g. dynamic tool not declared) | tool exists check §3.2 step 2 | `unavailable` | `tool_unavailable` | no | "Tool unavailable" badge |
| Plugin instance `disabled` or `quarantined` | tool exists check §3.2 step 2 | `unavailable` | `tool_unavailable` | no | disabled / quarantined badge per plugin |
| Session scope mismatch (e.g. session tool called at app scope) | scope check §3.2 step 3 | `denied` | `permission_denied` | no | "denied: scope" badge |
| Capability broker reject | capability check §3.2 step 4 | `denied` | `permission_denied` | yes (after grant) | "denied: <capability>" badge |
| Zod parse failure on input | input parse §3.2 step 5 | `failed` | `validation_error` | yes (with corrected input) | "validation_error" badge |
| Worker transport unavailable (e.g. crash during dispatch) | dispatching step | `unavailable` | `tool_unavailable` | yes (after restart) | "plugin unavailable" badge |
| Worker throws during execute | running step | `failed` | plugin-emitted `errorCode` (scoped to pluginId) | depends on code | "failed" badge with code |
| Host timer fires (dispatching > 5s) | dispatching timer | `timeout` -> `failed` | `tool_timeout` | yes | "timed out" badge |
| Host timer fires (running > 60s, or plugin override) | running timer | `timeout` -> `failed` | `tool_timeout` | yes | "timed out" badge |
| Agent or host cancels during `queued`/`dispatching`/`running`/`timeout` | cancel listener | `cancelled` | `tool_cancelled` | yes (user/host choice) | "cancelled" badge |
| Plugin worker offline (between tool calls) | dispatching step | `unavailable` | `tool_unavailable` | yes (after recovery) | "plugin offline" badge |

### 5.2 Context block failure modes <!-- oc:id=sec_ec -->

| Failure mode | Behavior | Operator UX |
|---|---|---|
| `PluginDescriptor` missing for an installed plugin id | no block emitted for that id; other ids still emit | "plugin manifest missing" log entry |
| `PluginSessionHandle` snapshot fetch fails | no block emitted for that session; `<elf-context>` reverts to non-plugin form | "session binding unavailable" log entry |
| Total context budget exceeded (4 KB per plugin / 16 KB aggregate) | block truncated; `data.truncated: true`; no `failed` | "context truncated" log entry |
| `injectIntoContext: true` on a contribution whose `requiresCapabilities` is unmet | block emitted with `injectedSurfaces` filtered to grants present; missing capabilities noted in `data.missingCapabilities[]` | operator sees the gap in `plugins.permissions` |
| Schema version mismatch (`apiVersion` older than host supports) | block emits with `schemaVersion` annotation; host warns to operator log per Task 12 §3 | "deprecation" log entry |
| Server mode != Managed/AttachedV21 | no block emitted | matrix row badge |
| Quarantined plugin emitting context | no block emitted for that plugin; introspection still lists it as `quarantined` | quarantined badge |

### 5.3 Introspection failure modes <!-- oc:id=sec_ed -->

| Failure mode | Behavior | Operator UX |
|---|---|---|
| `plugins.list` called during server reconnect | returns last known snapshot with `data.stale: true` | "stale snapshot" warning in tool envelope |
| `plugins.describe` for a plugin id that was uninstalled | `failed` envelope, `errorCode: plugin_not_found` | error in tool envelope |
| `plugins.permissions` for a session without an active binding | returns `grantedCapabilities: []`, `data.bindingStatus: "unbound"` | normal envelope; no error |
| `plugins.lifecycle` transition refused by host (e.g. trying to enable a `quarantined` plugin) | `denied` envelope, `errorCode: lifecycle_locked` | "denied: lifecycle_locked" badge |

### 5.4 Lifecycle and quarantine effects on projection <!-- oc:id=sec_ee -->

Per Task 11 (isolation / crash / quarantine) and Task 6 (lifecycle states):

- `installing` -> tools not yet projected; `plugins.lifecycle` returns the transition
- `updating` -> old descriptor tools removed; new descriptor tools projected after install + activation
- `enabled` -> full projection
- `disabled` -> tools projected as `unavailable`; introspection still returns the plugin row
- `crashed` (one crash, counter < threshold) -> tools projected as `unavailable`; `plugins.state` returns `crashCount`; auto-restart by host supervision
- `crashed` (counter >= threshold) -> transitions to `quarantined`
- `quarantined` -> tools projected as `unavailable`; introspection returns `quarantineReason`; requires operator clearance to leave
- `uninstalling` -> tools removed from projection; in-flight tool calls get `cancelled` envelope with `cancellationSource: "host"`
- `removed` -> all projection references deleted; introspection no longer lists the plugin id

### 5.5 Cross-server-mode failure table (consolidated) <!-- oc:id=sec_ef -->

| Mode | First-line failure | Envelope | UX |
|---|---|---|---|
| Managed | none (normal) | — | Normal |
| AttachedUnsupported | any tool call | `unavailable` + `bridge_unsupported_server` | "Bridge unsupported on attached server" badge |
| AttachedV21 (v2.1) | none (normal) | — | Normal |
| Offline | any tool call | `unavailable` + `no_active_server` | "No active server" badge |
| Reconnecting | any tool call | `unavailable` + `session_lost` | "Session lost, reconnecting…" |

### 5.6 Degraded mode contract <!-- oc:id=sec_eg -->

When the projection enters a degraded mode (`AttachedUnsupported` / `Offline` / `Reconnecting`), the host guarantees:

- The bridge does not consume a worker slot for the failed call.
- The bridge does not log a `validation_error` for a request that would have been denied by the mode check.
- The `plugins.*` introspection tools are still callable in degraded mode and return the current mode + canonical error code in the envelope, so the model can self-correct without guessing.
- The renderer operator UX shows the matching badge string verbatim. The string is operator-UI copy and must never be localized away from the canonical form (this is the contract the matrix pins).

---

## 6. Acceptance summary <!-- oc:id=sec_fa -->

- [x] OpenCode projection path is explicit for both tool calls and context/introspection
- [x] Managed vs attached server behavior is planned explicitly
- [x] Managed, attached, offline, and reconnect server modes each have a deterministic matrix row with status badge string and canonical error code
- [x] `PluginDescriptor` + `PluginSessionHandle` consumption is named per output channel
- [x] Tool-call state machine (9 states, Task 9 §6) is integrated with bridge projection pre-flight and timeout policies
- [x] System-context block generation has explicit shape, source, budget, and re-derivation rules
- [x] Failure modes are covered for tool calls, context blocks, introspection, lifecycle/quarantine, and degraded server modes
- [x] Reserved namespaces and tier policy from Task 12 are preserved on every emitted tool id
- [x] Canonical error code taxonomy (Task 9 §5) is the single source of error codes; no plugin-emitted codes are hoisted into the host-reserved set

## 7. Cross-references <!-- oc:id=sec_fb -->

- Plan: `.sisyphus/plans/firefly-plugin-system-v2.md` (Wave 3, Task 14; lines 1075-1142; server-mode matrix at 1084-1090)
- Plan source-of-truth model: lines 116-161
- Plan projection matrix: lines 152-159
- Plan bridge metadata: line 172
- Plan reserved namespaces: lines 274-279
- Plan tool ownership table: lines 240-249
- Plan introspection tool list: lines 261-270
- Wave 2 evidence: `.sisyphus/evidence/task-7-manifest-schema.md`, `task-9-tool-projection.md`, `task-12-api-tiering.md`
- Wave 1 evidence: `.sisyphus/evidence/task-2-bridge-seams.md` (current bridge reality, attached-server limitation, Zod coverage matrix)
- Wave 1 evidence: `.sisyphus/evidence/task-8-plugin-context-injection.md` (current `<elf-context>` block behavior)
- Current canonical doc: `docs/palot-opencode-plugin-bridge.md:79-91` (attached-server caveat), `:472-484` (gaps and caveats)
- Current canonical plugin: `apps/desktop/src/main/palot-plugin/plugin.js:73` (`buildProductContextBlock`), `:124-143` (`VALID_SIDE_PANEL_TABS`), `:301-379` (discovery tool stubs)
- Compatibility shim: `apps/desktop/.opencode/plugins/palot-bridge.js`
- Shared schemas: `apps/desktop/src/shared/palot-bridge-schemas.ts`
- Spawn / env injection: `apps/desktop/src/main/opencode-manager.ts:604-615, 617-718`
- Detection / lockfile path: `apps/desktop/src/main/opencode-manager.ts:74, 103, 115-138, 191-233, 243-275`
- Bridge server: `apps/desktop/src/main/palot-browser-ipc.ts:375-442`
