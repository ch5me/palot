# Appendix C — palot architecture map (addendum, post-assessment) <!-- oc:id=sec_aa -->

> **Provenance:** this addendum was produced after the prometheus planning
> session found an OMO background_output recovery bug: a subagent's
> full ~34 KB architecture map of palot's GenUI/plugin/artifact/surface
> system was returned as "(Empty Result)" because the subagent's text
> was emitted in the reasoning channel, not as a final text part. The
> real content was salvaged to
> `/tmp/palot-genui-architecture-map.recovered.md`. This appendix folds
> the recovered findings into the alignment assessment.

The original `.sisyphus/plans/loom-alignment-assessment.md` was written without the
full architecture map. The recovered map confirms everything in the
original assessment *and* adds several structural findings the
assessment should have called out. This addendum is the canonical
supplement; the original assessment stays the source of truth for the
gap analysis.

## C.1 What the recovered map adds to the assessment <!-- oc:id=sec_ab -->

### C.1.1 The bridge server is missing from the current source (HIGH) <!-- oc:id=sec_ac -->

> `apps/desktop/src/main/opencode-manager.ts:15` imports
> `ensurePalotBridgeServer` from `./palot-browser-ipc`. The current
> `palot-browser-ipc.ts` is 200 lines and does **not** export the
> symbol. The V1 plugin's `createBridgeClient` therefore returns
> `null` in the current source, and the V1 plugin's tools fall
> through to the queued/permission-denied envelopes
> (`plugin.js:215–265, 224–230`).

**Implication for the plan.** The V1 plugin's `palot-browser-ipc.ts`
bridge is the seam every wave 2+ depends on. The
`ensurePalotBridgeServer` symbol was reintroduced in a stash
(`@{0}: pre-v2-impl-WIP-snapshot`) and rolled back. The first wave to
ship against the bridge must either re-land the bridge server or
explicitly call out the missing symbol as a pre-flight task.

**Action item.** The wave 2 prompt's "Touched files" list must add a
pre-flight check: confirm `ensurePalotBridgeServer` exists, or
reintroduce it. Otherwise the WS server the wave 2 plan calls for
cannot bind, and every Loom wire command falls through to
`errorCode: "unbound_session"`.

### C.1.2 The V2 system is parallel-but-disconnected from the bridge (MEDIUM) <!-- oc:id=sec_ad -->

> `apps/desktop/src/main/opencode-manager.ts:604–615` (`appendPalotPlugin`)
> only injects the V1 plugin file and writes the V1 bridge URL/token.
> It does not consult `buildPluginCatalog` and does not project
> `bridge.systemContextBlock` or `bridge.hookSubscriptions` from V2.
> `useFireflyPlugins` (renderer) reads the V2 catalog and renders
> `V2PluginsPanel`, but the OpenCode spawn path is still V1.

**Implication.** The wave 6 (`contributes.components`) plan already
calls for the V2 manifest to declare built-in components. The
assessment + plan should also note that the **spawn-time** bridge
env-injection path is a parallel workstream: V2 components declared
in `palot-bridge-manifest.ts` need to reach the spawned OpenCode
process via the existing `OPENCODE_PLUGIN` env, not a new channel. The
V1 plugin's `plugin.js` can stay as the runtime carrier; the
V2 catalog's tool list and system-context block are the **content**
the V1 plugin exposes.

**Action item.** Wave 6's "Touched files" list gains
`apps/desktop/src/main/opencode-manager.ts:604–615` and
`apps/desktop/src/main/firefly-plugin/catalog.ts:138–223`. Wave 6
must wire `buildPluginCatalog` → `projectBridgeToolDefinitions` →
`projectSystemContextBlock` → V1 plugin's system.transform hook.

### C.1.3 The V1 plugin's `search_tools` / `describe_tool` / `call_tool` / `tools_status` are stubbed fixtures (LOW) <!-- oc:id=sec_ae -->

> `apps/desktop/src/main/palot-plugin/plugin.js:301–379` — these four
> tools return hardcoded fixture responses. They do not consult
> `mcp-connections-runtime.ts`, which is the real MCP authority.

**Implication.** The wave 1 prompt's `palot components list` /
`palot components describe <name>` are Loom-shaped and would be the
real version of these tools. We should not introduce a parallel
"Loom-flavored" discovery surface; the wave 1 tools should replace
the stubbed fixtures at the same `search_tools` / `describe_tool`
names. (Naming decision: keep `palot_components_list` /
`palot_components_describe` as the Loom verbs, but they back the
agent's mental model of "discover components." The MCP tools stay for
external MCP server discovery.)

**Action item.** Wave 1's "Must do" gains: "the Loom
`palot_components_list` / `palot_components_describe` tools are the
GenUI component discovery surface; they do not replace the V1
`search_tools` / `describe_tool` MCP discovery tools." This makes the
boundary explicit and avoids a naming collision.

### C.1.4 `genui-artifact-context.ts` is dead code (LOW) <!-- oc:id=sec_af -->

> `apps/desktop/src/renderer/atoms/genui-artifact-context.ts` (24 LOC)
> defines `sessionArtifactPromptContextFamily` and
> `markArtifactPromptContextInjectedAtom`. Both are exported but
> never imported. The actual artifact prompt context is built inline
> at `apps/desktop/src/renderer/atoms/chat.ts:95–111`
> (`buildArtifactPromptContext`).

**Implication.** Wave 0 should delete the file. Wave 4's durable
identity migration must not preserve it. Wave 5's `append` IPC
channel is the only durable artifact-prompt-context surface; the
inline `buildArtifactPromptContext` stays.

**Action item.** Wave 0 "Touched files" gains
`apps/desktop/src/renderer/atoms/genui-artifact-context.ts` (delete).
Wave 4 / 5 explicitly call this out as a non-goal.

### C.1.5 `genui-artifact-prop-actions.tsx` only knows about `dag-sparkline` (LOW) <!-- oc:id=sec_ag -->

> The shipped "Tweak" prop patch action is hardcoded to
> `{ showLabels: true, animate: "flow" }` — DAG-specific. The
> component's `propActions` surface in the registry is missing.

**Implication.** The wave 1 registry change (add `events` and `state`
slots) is the right place to also add a `propActions?: PropAction[]`
slot. Per-component prop actions, like per-component bindings, are
the Loom way. Wave 3 (dual bindings) and the wave 4 conflict
resolution both depend on per-component prop behavior.

**Action item.** Wave 1's `GenUiEntry` shape gains
`propActions?: PropAction[]`. Wave 0 collapses the mirror lists; wave
1 lifts the prop-action shortcut into the registry; wave 3 wires
the binding model.

### C.1.6 `GenUiArtifactPlacement.side-panel` is not a valid V2 widget zone (LOW) <!-- oc:id=sec_ah -->

> `apps/desktop/src/renderer/lib/types.ts:140–175` defines
> `GenUiArtifactPlacement = "inline" | "above-chat" |
> "chat-inline-right" | "side-panel"`. The V2
> `HOST_WIDGET_ZONES = ["above-chat", "chat-inline-right"]`
> (`apps/desktop/src/shared/firefly-plugin/descriptor.ts:39`)
> excludes `side-panel` (which is a panel slot, not a widget zone).

**Implication.** When artifacts migrate to V2, the `side-panel`
placement option must be either dropped or split (a panel placement
vs. a widget zone). Wave 4's durable identity migration is the right
time to clean this up; the new sqlite schema enforces the V2
vocabulary.

**Action item.** Wave 4's "Touched files" gains
`apps/desktop/src/renderer/lib/types.ts`. The new
`GenUiArtifactPlacement` drops `side-panel`; artifacts pinned to
the side panel migrate to a `placement: "side-panel:<tabId>"` shape
that round-trips through the V2 panel vocabulary.

### C.1.7 `palot-update-artifact` / `palot-pin-artifact` / `palot-remove-artifact` tools don't exist (LOW) <!-- oc:id=sec_ai -->

> The V1 plugin has `open_side_panel` for `artifacts` but no
> artifact-mutation tools. Artifact mutation is UI-only.

**Implication.** The V2 `palot-bridge-manifest.ts` should contribute
three new V2 `ToolContribution`s: `plugin.palot-bridge.artifact_pin`,
`plugin.palot-bridge.artifact_update`,
`plugin.palot-bridge.artifact_remove`. Wave 6 (`contributes.components`)
is the right place; the existing manifest gains the tools alongside
the components.

**Action item.** Wave 6's "Touched files" gains
`apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts`
(add three V2 tool contributions) and
`apps/desktop/src/main/firefly-plugin/dispatch.ts:82–158` (register
three handlers).

### C.1.8 `genui-artifacts.ts` has no `remove` atom (LOW) <!-- oc:id=sec_aj -->

> `apps/desktop/src/renderer/atoms/genui-artifacts.ts` exposes `pin`,
> `patch`, `upsert` but no `remove`. There is no delete flow.

**Implication.** Wave 4 (durable identity) must add
`removeGenUiArtifactAtom`. Without it, the cross-session pin from
wave 5 has no removal path and the artifact store grows forever.

**Action item.** Wave 4's "Touched files" gains
`apps/desktop/src/renderer/atoms/genui-artifacts.ts` (add
`removeGenUiArtifactAtom` + IPC channel to main).

### C.1.9 No `scope` field on persisted session bindings (LOW) <!-- oc:id=sec_ak -->

> `apps/desktop/src/main/palot-session-binding.ts` persists
> `{ openCodeSessionId, browserLaneId, magicBrowserSessionId, status,
> createdAt, updatedAt, releasedAt }`. No `scope` field. V2
> `ToolContribution.scope` is `session | project | app`.

**Implication.** Wave 6 (V2 `contributes.components`) is the right
place to add `scope` to the persisted record. The V2 catalog
projections are scope-aware; the persisted bindings should be too.

**Action item.** Wave 6's "Touched files" gains
`apps/desktop/src/main/palot-session-binding.ts:33–55`. The new
record gains `scope: "session" | "project"` with a default migration
to `session` for existing rows.

### C.1.10 `opencode-manager.ts:650` is the only V1-plugin-injection site (LOW) <!-- oc:id=sec_al -->

> `appendPalotPlugin` is called from `spawnServer` at
> `apps/desktop/src/main/opencode-manager.ts:650` (the only
> `appendPalotPlugin` call site). Detected/attached server paths
> (`ensureServer` at `:74, :103`) intentionally skip it. Out-of-process
> OpenCode servers do not get the bridge plugin.

**Implication.** This is a known operational caveat from
`docs/palot-opencode-plugin-bridge.md:88–90`. The Loom migration does
not change this. Wave 2 (the wire) lives behind the V1 plugin's
injection path; the existing-server caveat carries through.

**Action item.** No change. Document in the wave 2 prompt's "Out of
scope."

## C.2 Net change to the alignment assessment <!-- oc:id=sec_am -->

The recovered map does not contradict the assessment. It sharpens it
in three ways:

1. **The bridge server's absence is a wave 2 blocker, not a wave 6 <!-- oc:id=item_aa -->
   nice-to-have.** Wave 2's prompt must add a pre-flight task to
   re-land or replace `ensurePalotBridgeServer` before the WS server
   can bind.
1. **Wave 6 (V2 `contributes.components`) is bigger than the plan <!-- oc:id=item_ab -->
   says.** It must also wire the V2 catalog into the OpenCode spawn
   path so the V2 tool list and system context reach the spawned
   process, and add three V2 tool contributions for artifact
   mutation. The plan's "Touched files" list for wave 6 is
   incomplete without these.
1. **Wave 1's registry change is the right place to also generalize <!-- oc:id=item_ac -->
   `genui-artifact-prop-actions.tsx`.** Per-component prop actions
   are part of the same registry discipline.

The original assessment, the plan, and the wave 0 / wave 1 prompts
are correct as written. The wave 2, wave 4, and wave 6 prompts need
the additions in §C.1 above folded in before dispatch. The
"addendum" semantic lets the assessment stay stable while the
prompts absorb the recovered findings.

## C.3 Source <!-- oc:id=sec_an -->

`/tmp/palot-genui-architecture-map.recovered.md` (recovered from
background subagent `ses_158303fdcffeLFZDnZyM6g9mh6` after an OMO
background_output recovery bug; the bug is being fixed in the
parent OMO repo).