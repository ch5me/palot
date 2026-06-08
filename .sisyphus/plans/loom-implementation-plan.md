# palot → Loom Implementation Plan <!-- oc:id=sec_aa -->

> **Status:** Atlas-dispatchable. This is the single plan. A worker reading only this file can execute it end-to-end.
> **Why** (reference, not a dependency): `.sisyphus/plans/loom-alignment-assessment.md` — file-anchored gap analysis with Appendix C recovered-map findings.
> **Status tracker** (reference, not a dependency): `.sisyphus/plans/loom-progress.md` — update on each wave's completion.

## TL;DR <!-- oc:id=sec_ab -->

palot is ~60% of the way to Loom already. Close the rest in 8 ordered waves: collapse 7 mirror lists (prereq), Zod-typed component registry + discovery (wave 1), render/poll/patch wire (wave 2), dual signal/state bindings (wave 3), per-node `rev` + dirty-field (wave 4), durable artifact identity + streaming `append` (wave 5), `contributes.components` in the V2 manifest (wave 6), tool-renderer consolidation deferred (wave 7). Each wave lands behind a feature flag, ships independently, and is fully reversible. Open decisions D1–D6 are resolved at the plan level. Open `D-pre-flight: ensurePalotBridgeServer` is wave 2's first must-do (the symbol is imported but not exported in the current `palot-browser-ipc.ts` source).

## Work Objectives <!-- oc:id=sec_ac -->

### Definition of Done <!-- oc:id=sec_ad -->

- [ ] All TODOs 1–8 complete with their inline acceptance criteria passing.
- [ ] `.sisyphus/plans/loom-progress.md` reflects the final state (each wave marked shipped with date).
- [ ] F1, F2, F3, F4 all pass (see Final Verification Wave).
- [ ] `bun run check-types` clean across the whole repo.
- [ ] `bun run lint` (Biome) clean across the whole repo.
- [ ] New Bun tests for each wave pass.
- [ ] A real OpenCode session drives the Loom wire end-to-end (session open → render → poll → patch → close).
- [ ] The Loom protocol spec's §13 minimal end-to-end walkthrough is reproducible in a `bun test` with no live OpenCode.
- [ ] No regression in the existing fence-render path (` ```dag ` / ` ```genui ` flows still work).
- [ ] The pre-existing dirty tree is not modified by any wave's commits.

### Must Have <!-- oc:id=sec_ae -->

- Every GenUI component declared as a Zod schema (props + events + state) with `list` / `describe` discovery through the existing `palot-bridge` plugin.
- The full Loom protocol wire (TOON on the agent boundary, JSON over WS to the surface): `session` (open/end), `render`, `patch`, `poll`, `state`, `components list|describe`.
- Per-session monotonic `rev` + per-node `rev`; `palot_patch --expected-rev N` rejects stale with `errorCode: "stale_rev"` + current `rev` + delta.
- Dual binding model: `signal` (round-trips to agent via `poll`) and `state` (optimistic local mutation, reported as a delta). Per-affordance, not global.
- Dirty-field protection: agent patch to a dirty field is held and surfaced as `conflict` on the next `poll`. Per-component `conflictPolicy: "agent-wins" | "human-wins" | "merge" | "ask"`. Default `ask`.
- Durable artifact identity (`art_<ulid>`); per-session `rev` snapshot to disk at `~/.local/share/elf/loom/`; cross-session pin survives renderer restart.
- Streaming `append` frame (`palot_patch --append`); renderer applies incrementally.
- V2 `contributes.components` family in `apps/desktop/src/shared/firefly-plugin/manifest.ts:357–421`; built-in `dag-sparkline` + `decision_card`; `acme` third-party exemplar.
- One source of truth for the 18 side-panel surface ids (collapse the 7 mirror lists to one).

### Must NOT Have <!-- oc:id=sec_af -->

- No CRDT. v0 is last-write-wins with dirty protection. CRDT is a v2 multi-human concern.
- No V1 bridge plugin rewrite. The JS plugin stays; the V2 manifest is the source of content. The JS plugin is the runtime carrier.
- No new transport. WS to surface reuses the existing `127.0.0.1` + token seam.
- No TOON for the surface channel. Surface is JSON over WS.
- No V2 `contributes.components` until wave 6.
- No tool-renderer consolidation in this plan (wave 7 is the deferred follow-up).
- No bundling the bridge-server bug fix into wave 2's runtime work. The first must-do of wave 2 is to land the bridge server symbol before opening any WS.
- No FFI to OpenCode fork. SessionStart hook for Loom core is a separate repo task.
- No new components other than `dag-sparkline` (built-in from day 1), `decision_card` (wave 3 fixture), and `acme.loyalty_progress_bar` (wave 6 exemplar).
- No new components in waves 2, 4, 5. Those waves are infrastructure, not components.

## TODOs <!-- oc:id=sec_ag -->

- [ ] 1. [Wave 0 — Collapse the 7 mirror lists (prerequisite, no Loom code)](docs/loom-alignment-assessment.md#appendix-a)
  - **Goal:** one source of truth for the 18 side-panel surface ids. Zero behavior change. No Loom-shaped API yet. Prereq for every later wave.
  - **Touched files:**
    - `apps/desktop/src/renderer/firefly-surface-registry.tsx` — add a `manifestId` field; the 18-entry array becomes the canonical list.
    - `apps/desktop/src/renderer/atoms/feature-flags.ts:26–180` — collapse 17 per-surface storage atoms into one `surfaceFlagsFamily(panelId)`. Keep the same `atomWithStorage` key so user prefs survive.
    - `apps/desktop/src/renderer/atoms/ui.ts:25–43` — derive `SidePanelTabId` from the registry at module load (compile-time `as const`).
    - `apps/desktop/src/renderer/components/agent-detail.tsx:27–44, 220–285` — replace 17 `useAtomValue` calls with a single `useFireflySurfaceContext(agent)` hook (new file `apps/desktop/src/renderer/hooks/use-firefly-surface-context.ts`).
    - `apps/desktop/src/renderer/components/command-palette.tsx:460–648` — iterate the registry for the Features group. The Surfaces group at `:649–671` is already registry-driven.
    - `apps/desktop/src/renderer/components/side-panel/side-panel-tabs.tsx` — consume the new hook.
    - `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts:21–40` — replace `palotSidePanelTabSchema` with a derived `z.enum`.
    - `apps/desktop/src/main/palot-plugin/plugin.js:124–143` — replace `VALID_SIDE_PANEL_TABS` with a JS array imported from a shared file the renderer registry exports. Use JSON sidecar at `apps/desktop/src/renderer/firefly-surface-registry-ids.json` (read by both runtimes). No code generation step.
    - `apps/desktop/src/renderer/atoms/genui-artifact-context.ts` — **delete (dead code; 24 LOC, no callers)**.
    - `docs/firefly-surface-playbook.md:25–31` — rewrite the "add a surface" checklist to "add a row to the table".
  - **Must do:**
    - New test `apps/desktop/src/renderer/__tests__/surface-mirror-lists.test.ts` that iterates the registry and asserts: `SidePanelTabId`, `surfaceFlagsFamily` keys, `palotSidePanelTabSchema` options, `plugin.js` `VALID_SIDE_PANEL_TABS`, `fireflySurfaceLabels` table, `fireflySurfaceFlagAtoms` table, command-palette Features group registry iteration — all derive from the same set. **Fails CI if any list drifts.**
    - Hook `useFireflySurfaceContext(agent)` returns a stable `flags` object + `toggle(panelId)` mutator.
    - All 18 surfaces' `defaultOn`, persistence keys, command ids, telemetry namespaces, feature-flag keys come from the registry.
    - Public type stability: `SidePanelTabId` keeps the same string-literal type. `window.elf` API unchanged.
    - `firefly-surface-registry.tsx` stays the source of truth for `id` + `title` + `icon` + `spawn`.
  - **Must NOT do:** no new transport, no new bridge tools, no WS, no TOON. No new components. No changes to `genui/registry.ts` or any GenUI fence logic. No new persistence path. No deprecation of any public path. No V2 `contributes.components`. No feature flag (this is a refactor).
  - **Proof criteria:**
    - `git grep "review.*browser.*notes.*pulse" -- 'apps/desktop/**' 2>/dev/null` returns at most 3 hits (canonical JSON, docs, test).
    - The new mirror-list test passes.
    - `bun run check-types` clean. `bun run lint` clean.
    - Manual smoke: open a chat, open the side panel, toggle every tab — visuals unchanged, feature-flag defaults unchanged, persistence survives a reload.
  - **Risk:** low. Pure refactor, no behavior change. Failure mode: forgetting a derivation point. The new test catches it.
  - **Definition of done:** all proof criteria pass. `.sisyphus/plans/loom-progress.md` updated with `Wave 0: complete (date)`. No changeset (not user-facing). PR opened; description cites the assessment's Appendix A and this plan's TODO 1.

- [ ] 2. [Wave 1 — Typed Zod GenUI registry + `list` / `describe` discovery](docs/loom-alignment-assessment.md#3-where-palot-diverges-the-gap-matrix)
  - **Goal:** every registered GenUI component is described by a Zod schema. The agent can call `palot components list` and `palot components describe <name>` through the existing `palot-bridge` plugin. No transport change. No patch/poll yet. **First Loom wave**; smallest safe first step.
  - **Feature flag:** `loom.componentTools.enabled` (default off for v0, on after dogfood).
  - **Open decisions enforced:** D5 (component versioning) — `apiVersion: 1` hardcoded in `DagSparklineEntry` for this wave.
  - **Touched files:**
    - `apps/desktop/src/renderer/genui/registry.ts:19–32, 78–93` — replace `parseProps` with `props: z.ZodTypeAny`. Add required `events: { [name]: z.ZodTypeAny }` (default `{}`), required `state: { [name]: z.ZodTypeAny }` (default `{}`), optional `legacyFences?: { fence: string; parseBody: (body: string) => unknown }[]`. `buildGenUiCatalog()` regenerates from typed entries.
    - `apps/desktop/src/renderer/genui/components/dag-sparkline.tsx` — declare props as a Zod schema; remove hand-rolled parsing.
    - `apps/desktop/src/renderer/genui/genui-renderer.tsx:190–280` — call site for `parseProps` switches to `props.safeParse`.
    - `apps/desktop/src/renderer/genui/genui-renderer.tsx:14–15, 47–55, 78–91, 93–140` — lift the `dag` legacy shortcut into the registry as `legacyFences` on `DagSparklineEntry`. Generalize `inferPendingFrameProps` to look up by entry (no more hardcoded `name === "dag-sparkline"`).
    - `apps/desktop/src/main/palot-runtime/toon.ts` (NEW) — minimal TOON encode/decode. ~80 LoC. Primitives, arrays, tabular `name[count]{cols}:` form, indented scalars.
    - `apps/desktop/src/main/palot-plugin/plugin.js:1–484` — add `palot components list` and `palot components describe <name>` tools. Follow the shape of `search_tools` / `describe_tool` at `:35`. Output TOON.
    - `apps/desktop/src/shared/palot-bridge-schemas.ts` — add Zod args/results for the two new tools.
    - `apps/desktop/src/main/palot-browser-ipc.ts:271` — add routes for the two new tools.
    - `apps/desktop/src/renderer/atoms/feature-flags.ts` — add `loom.componentTools.enabled` flag.
    - New tests: `apps/desktop/src/main/palot-runtime/__tests__/toon.test.ts`, `apps/desktop/src/renderer/genui/__tests__/registry-zod.test.ts`, `apps/desktop/src/main/palot-plugin/__tests__/component-discovery.test.ts`.
  - **Must do:**
    - `GenUiEntry.props: z.ZodTypeAny` replaces `parseProps`; `parseProps` becomes derived `(raw) => props.safeParse(raw)`.
    - `legacyFences?: { fence: string; parseBody: (body: string) => unknown }[]` declared on the entry; `dag` legacy fence moves from `genui-renderer.tsx:14–15, 47–55, 107–125` into `DagSparklineEntry.legacyFences`.
    - `genui-renderer.tsx` parser iterates entries for legacy fences, not hardcoded `DAG_FENCE_RE`.
    - `inferPendingFrameProps` is generic (no `name === "dag-sparkline"` branch).
    - `palot components list` returns TOON: `count: N\ncomponents[N]{name,one_line,category}:\n  ...`. AXI principle 2: 3–4 fields per item.
    - `palot components describe <name>` returns TOON: full Zod schema + one example + capability gates. Unknown names: `errorCode: "unknown_component"`.
    - `palot components list --category <cat>` filters. `palot components describe <name> --full` returns full schema (default is the shape summary).
    - TOON follows the AXI spec exactly.
    - `loom.componentTools.enabled` flag (default off) gates the new tools. When off, tool descriptions are hidden from the system prompt.
  - **Must NOT do:** no new transport, no WS, no new wire protocol. No patch/poll/render yet. No `state` mutations yet (declared, unused). No `append` frame. No changes to `palot-browser-ipc.ts` outside the two new routes. No changes to `feature-flags.ts` outside the one new flag. No persistence changes.
  - **Proof criteria:**
    - `palot components list` returns TOON, smallest-schema. Matches `components[1]{name,one_line,category}: dag-sparkline,Render DAG with node + edge props,diagram`.
    - `palot components describe dag-sparkline` returns TOON, full Zod schema. Round-trip through `zod.toJSONSchema()` recovers the same schema.
    - `palot components describe unknown` returns TOON with `errorCode: "unknown_component"` and `help[]: Run \`palot components list\` to see available components.`
    - `dag-sparkline` renders identically with the new schema path. Regression test in `apps/desktop/src/renderer/genui/`.
    - System prompt size **decreases** for sessions that do not use GenUI components.
    - `bun run check-types` clean. `bun run lint` clean. All new tests pass.
  - **Risk:** low. Additive. Failure modes: TOON spec violations (caught by `toon.test.ts`); legacy fence moved but parser still hardcodes (caught by `registry-zod.test.ts`).
  - **Definition of done:** all proof criteria pass. `.sisyphus/plans/loom-progress.md` updated with `Wave 1: complete (date)`. Changeset added. PR opened. Manual dogfood: real OpenCode session calls `palot_components_describe dag-sparkline`, emits a fence, renders.

- [ ] 3. [Wave 2 — The Loom wire: `session` / `render` / `patch` / `poll` / `state` / `end`](docs/loom-alignment-assessment.md#3-where-palot-diverges-the-gap-matrix)
  - **Goal:** the full Loom protocol commands exist as bridge tools. TOON on the agent boundary. JSON over a localhost WS to the surface. The runtime owns a `rev`-stamped tree. The renderer subscribes to patches. Single end-to-end demo on `dag-sparkline`.
  - **Pre-flight (FIRST must-do — non-negotiable):** the symbol `ensurePalotBridgeServer` is imported by `apps/desktop/src/main/opencode-manager.ts:15` from `palot-browser-ipc` but is **not exported** by the current `palot-browser-ipc.ts` (the file is 200 lines; the symbol was reintroduced in stash `@{0}: pre-v2-impl-WIP-snapshot` and rolled back). The V1 plugin's `createBridgeClient` returns `null` and falls through to queued/permission-denied envelopes. **Re-land or replace the bridge server symbol in `palot-browser-ipc.ts` BEFORE any wave 2 wire work.** Verify with `grep -n "export function ensurePalotBridgeServer" apps/desktop/src/main/palot-browser-ipc.ts`.
  - **Open decisions enforced:**
    - D1: **WebSocket** to the surface (D1 resolved at plan level).
    - D3: **node-id + field** for patch addressing.
    - D4: **250 ms** batching window for `state` deltas. `LOOM_POLL_BATCH_MS` env-tunable.
    - D5: version-pin per session — `session open` snapshots the component catalog.
  - **Feature flags:** `loom.enabled`, `loom.dagSparklineDemo`.
  - **Touched files (NEW):**
    - `apps/desktop/src/main/palot-runtime/session-store.ts` — in-memory per-session tree with per-node `rev`, monotonic session `rev`, event queue, state delta accumulator. ~200 LoC.
    - `apps/desktop/src/main/palot-runtime/commands.ts` — `render` / `patch` / `poll` / `state` / `session open` / `session end`.
    - `apps/desktop/src/main/palot-runtime/revision.ts` — monotonic per-session counter.
    - `apps/desktop/src/main/palot-runtime/wire.ts` — TOON encode/decode for the agent boundary.
    - `apps/desktop/src/main/loom-bridge.ts` — localhost WS server. Reuses `PALOT_BRIDGE_URL` + `env[BRIDGE_ENV_TOKEN]` env seam. `ws://127.0.0.1:<port>/loom/<sessionId>`.
    - `apps/desktop/src/renderer/loom/loom-context.tsx` — provider that opens a WS per active Loom session, replays the tree.
    - `apps/desktop/src/renderer/loom/use-loom-session.ts` — hook returning `{ tree, subscribe, sendEvent, sendStateDelta, applyPatch }`.
    - `apps/desktop/src/renderer/loom/loom-renderer.tsx` — walks the tree, dispatches nodes to registered components.
    - `apps/desktop/src/main/palot-runtime/__tests__/{session-store,commands,wire}.test.ts`
    - `apps/desktop/src/renderer/loom/__tests__/use-loom-session.test.ts`
  - **Touched files (CHANGED):**
    - `apps/desktop/src/main/palot-browser-ipc.ts` — add the Loom CLI routes next to the existing 4 actions. Re-export or re-add `ensurePalotBridgeServer` per pre-flight.
    - `apps/desktop/src/main/palot-plugin/plugin.js:1–484` — add the 6 new tools (`palot_session open|end`, `palot_render`, `palot_patch`, `palot_poll`, `palot_state`). Delegate to the runtime module.
    - `apps/desktop/src/shared/palot-bridge-schemas.ts` — add Zod args/results for the new tools.
    - `apps/desktop/src/main/opencode-manager.ts:414, 422, 466` — add `LOOM_RUNTIME_URL` env if needed.
    - `apps/desktop/src/main/palot-resolver.ts` — expose `openLoomSession` to the bridge.
    - `apps/desktop/src/renderer/atoms/feature-flags.ts` — add `loom.enabled`, `loom.dagSparklineDemo`.
    - `apps/desktop/src/renderer/components/chat/chat-view.tsx` — mount `LoomContext` when `loom.enabled && session has an open Loom session`.
    - `apps/desktop/src/renderer/genui/genui-renderer.tsx:148–184` — add a parallel path: if a Loom session is active, subscribe to the tree instead of parsing fences.
  - **Must do:**
    - TOON encode/decode round-trips the Loom spec's §13 example through `wire.test.ts` byte-equal.
    - SessionStore: `Map<sessionId, { tree, rev, eventQueue, stateDelta, dirty }>`. `render(tree.toon)` replaces the tree, increments `rev`, queues a `tree` frame to subscribed surfaces. `patch(patch.toon)` applies a node-id+field patch, increments `rev`, queues a `patch` frame. `poll(--rev N)` returns events + state delta + tree slice.
    - `state(frame.toon)` placeholder accepted by runtime, accumulates per-field deltas, returned on next `poll`. (Full impl in wave 3.)
    - Surface WS: replay tree on connect; broadcast `event`, `state`, `patch` frames; token-gated via `env[BRIDGE_ENV_TOKEN]`.
    - Six bridge tools in `palot-plugin/plugin.js`:
      - `palot_session open --title <t>` → `{session_id, surface_url, rev: 0}`.
      - `palot_session end` → `{rev}`.
      - `palot_render <tree.toon>` → `{rev}`.
      - `palot_patch <patch.toon>` → `{rev}` or `{errorCode: "stale_rev", rev, delta}`.
      - `palot_poll --rev N` → `{rev, events, state_delta, tree_slice}`. Long-poll cap 30s.
      - `palot_state <delta.toon>` → `{rev}`. (Placeholder; full impl in wave 3.)
    - `useLoomSession({sessionId})` opens WS, replays tree, applies incoming `patch`, exposes `sendEvent` and `sendStateDelta` (250 ms coalesced).
    - Single end-to-end demo: `dag-sparkline` rendered via the wire, then patched (add a node), surface updates live. Behind `loom.dagSparklineDemo`.
    - AXI compliance per tool: `--help`, TOON output, `count: 0` empty state, no interactive prompts.
    - The Loom spec's §13 minimal end-to-end walkthrough reproducible in `bun test` with no live OpenCode.
  - **Must NOT do:** no persistence. No dirty-field protection (wave 4). No dual bindings yet (wave 3). No `state` schema validation (wave 3). No streaming `append` frame (wave 5). No V2 `contributes.components` (wave 6). No changes to `palot-browser-ipc.ts` outside the new routes + the bridge-server pre-flight. No changes to firefly-plugin manifest beyond a comment in the bridge manifest noting new CLI tools.
  - **Proof criteria:**
    - `palot_session open --title "demo"` returns `{session_id, surface_url, rev: 0}`.
    - `palot_render` → `rev: 1`; renderer displays tree.
    - `palot_patch` → `rev: 2`; renderer shows diff live.
    - `palot_poll --rev 0` returns no events (idle).
    - Simulated click on a placeholder `button` node → queued event; `palot_poll --rev 2` returns it.
    - Spec §13 walkthrough reproducible in `bun test`.
    - `palot_patch` against stale `rev` returns structured error.
    - No fence-render regression. `dag-sparkline` still renders from a fence.
    - `bun run check-types` clean. `bun run lint` clean. All new tests pass.
  - **Risk:** **High.** New IPC, new runtime module, new surface WS, new bridge tools, new renderer context. Mitigations: feature flags, parallel fence path, spec §13 walkthrough tests. Failure modes: TOON spec violations (`wire.test.ts`); WS auth bypass (reused `env[BRIDGE_ENV_TOKEN]`); OpenCode plugin runtime timeout on long-poll (fall back to short-poll + agent retry).
  - **Definition of done:** all proof criteria pass. Spec §13 walkthrough reproducible in `bun test`. `.sisyphus/plans/loom-progress.md` updated with `Wave 2: complete (date)`. Changeset added. PR opened. Manual dogfood: real OpenCode session uses the wire end-to-end.

- [ ] 4. [Wave 3 — Dual `signal`/`state` bindings + `decision_card` fixture](docs/loom-alignment-assessment.md#3-where-palot-diverges-the-gap-matrix)
  - **Goal:** one component ships with both a local `state` binding and a `signal` event. Agent sees only the signal; surface mutates state optimistically. Demonstrated on a new `decision_card` component. (Note: dirty-field protection is folded into this wave, not split into a separate wave 4 — the assessment confirmed the binding model is the precondition for the dirty model.)
  - **Feature flag:** `loom.dualBindings`.
  - **Open decisions enforced:** D4 (250 ms batching) now active in renderer.
  - **Touched files (NEW):**
    - `apps/desktop/src/main/palot-runtime/bindings.ts` — per-affordance `binding: "signal" | "state"`, Zod event payload schema.
    - `apps/desktop/src/main/palot-runtime/dirty.ts` — per-field `dirty` set per node. `setDirty(nodeId, field, true)` from renderer. Runtime mirrors. Patch to dirty field holds + queues `conflict`.
    - `apps/desktop/src/main/palot-runtime/conflict.ts` — per-component `conflictPolicy: "agent-wins" | "human-wins" | "merge" | "ask"`. Default `"ask"`. `merge` requires a per-component `merge` function.
    - `apps/desktop/src/renderer/loom/loom-binding-host.tsx` — React primitives that wrap a node's `events` / `state` and attach the right `onChange` / `onClick` handler per binding class.
    - `apps/desktop/src/renderer/genui/components/decision-card.tsx` — the new built-in V2 contribution fixture.
    - `apps/desktop/src/main/palot-runtime/__tests__/{bindings,dirty,conflict}.test.ts`
    - `apps/desktop/src/renderer/genui/__tests__/decision-card.test.ts`
  - **Touched files (CHANGED):**
    - `apps/desktop/src/main/palot-runtime/session-store.ts` — extend tree to carry per-node `rev` + per-field `dirty` flags. `patch` marks fields dirty before applying; on conflict, held value queued.
    - `apps/desktop/src/main/palot-runtime/commands.ts` — `poll` returns `events[]` + `state_delta[]` + `conflicts[]` in TOON. `patch` returns `errorCode: "stale_rev" | "dirty_field"` on conflict (TOON). New: `palot_patch --expected-rev N`.
    - `apps/desktop/src/main/palot-runtime/wire.ts` — TOON shape for `conflicts[]`: `{nodeId, field, humanValue, agentValue, policy}`.
    - `apps/desktop/src/renderer/loom/loom-renderer.tsx` — consume `loom-binding-host.tsx`; route events through WS client.
    - `apps/desktop/src/renderer/loom/use-loom-session.ts` — emit `event` and `state` frames; coalesce state deltas at 250 ms.
    - `apps/desktop/src/renderer/genui/registry.ts` — finalize `events` and `state` declaration slots; validator enforces both present (Zod `min(0)`); conflict policy per component.
    - `apps/desktop/src/shared/firefly-plugin/component-zod.ts` (NEW in this wave) — Zod-to-summary must include binding class per affordance.
    - `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts` — declare built-in `decision_card` contribution.
    - `apps/desktop/src/shared/palot-bridge-schemas.ts` — Zod schemas for conflict response.
  - **Must do:**
    - `bindings.ts` parses each component's `events` / `state`. At `render`, runtime attaches binding declaration. At interaction, renderer routes to signal or state.
    - `dirty.ts` tracks `Map<nodeId, Set<field>>`. State mutation → mark dirty. Runtime mirrors on next state delta. Patch to dirty field holds + queues `conflict` + increments session `rev`.
    - `conflictPolicy` per component:
      - `"ask"` (default): hold the patch, surface `conflict` on next `poll`. Do NOT apply.
      - `"agent-wins"`: apply patch, clear dirty, surface `conflict_resolved: "agent-wins"`.
      - `"human-wins"`: drop patch, clear dirty, surface `conflict_resolved: "human-wins"`.
      - `"merge"`: call component's `merge(humanValue, agentValue)`, apply, clear dirty, surface `conflict_resolved: "merge"`.
    - `decision_card` fixture: `props: { title, options: [{id, label}], selected: string | null }` (Zod). `events: { submit: { optionId: string } }` (signal). `state: { notes: string }` (state). `conflictPolicy: "ask"`.
    - Renderer Loom client sends `event` for signal, `state` for state. State coalesced at 250 ms.
    - `poll` returns `events[]` + `state_delta[]` + `conflicts[]` in TOON.
    - `patch` returns `{rev}` or `{errorCode: "stale_rev" | "dirty_field", rev, held}` (TOON).
    - AXI compliance: every binding type surfaces in `components describe` output. `decision_card`'s `events` + `state` listed.
    - Test fixtures: clean patch applies; dirty patch held; each policy behaves per declaration. Regression test for all 4 policies on `decision_card` `notes` field.
    - Renderer exposes `onConflict(nodeId, field, humanValue, agentValue)` to component for conflict banner UI.
  - **Must NOT do:** no persistence (wave 5). No `append` frame (wave 5). No V2 `contributes.components` (wave 6). No new transport. No changes to existing fence flow. Do not bundle `decision_card` into the `dag-sparkline` migration. No CRDT.
  - **Proof criteria:**
    - `bindings.test.ts`: state mutation renders instantly, accumulates in `state_delta` for next `poll`. Signal event queues, returns on next `poll`. State coalescing: 5 keystrokes within 250 ms collapse to one `state_delta` entry with final value. Signal events bypass coalescing: one click = one `event` entry.
    - `dirty.test.ts`: agent patch to dirty field held; next `poll` returns `conflict` frame with both values. Clean field accepts.
    - `conflict.test.ts`: each of 4 policies produces expected outcome + expected `conflict` / `conflict_resolved` event.
    - `decision_card` reproducible end-to-end: open session → render card → human types notes (state, no round-trip) → human clicks submit (signal) → agent receives submit event + notes delta in one `poll` → agent patches `selected: "opt_b"` → renderer updates.
    - `palot_patch --node card1 --field notes --value "agent's version" --expected-rev 0` after a human edit returns `errorCode: "stale_rev"`.
    - Existing fence path still works.
    - `bun run check-types` clean. `bun run lint` clean. All new tests pass.
  - **Risk:** **Medium.** Renderer behavior change. Failure modes: state coalescing misfires (tests assert 250 ms); dirty tracking one-way (add `clearDirty(nodeId, field)` on patch ack); `merge` non-deterministic (use `notes: humanValue + " " + agentValue` as the template). Per-session `max_pending_conflicts` cap auto-resolves oldest with default policy.
  - **Definition of done:** all proof criteria pass. `decision_card` works end-to-end in a real session. `.sisyphus/plans/loom-progress.md` updated with `Wave 3: complete (date)`. Changeset added. PR opened.

- [ ] 5. [Wave 4 — Durable artifact identity + streaming `append` (Loom §4, §12.5)](docs/loom-alignment-assessment.md#3-where-palot-diverges-the-gap-matrix)
  - **Goal:** artifacts survive across sessions. The agent can stream a node's content token-by-token via the `append` frame. Artifact identity is a schema-versioned `ArtifactId` (ULID), backed by main-process sqlite at `~/.local/share/elf/loom/`.
  - **Open decisions enforced:** D2 (include `append` frame) + D5 (version-pin per session).
  - **Feature flags:** `loom.persistence.migrate`, `loom.appendFrame`.
  - **Touched files (NEW):**
    - `apps/desktop/src/main/palot-runtime/artifact-store.ts` — sqlite at `~/.local/share/elf/loom/artifacts.sqlite`. Schema: `artifacts(id PK, schemaVersion, component, props JSON, source JSON, pin JSON, createdAt, updatedAt, lastRenderedAt, dirty JSON)`. Mirrors the XDG pattern in `apps/desktop/src/main/automation/paths.ts` (per `AGENTS.md:210–212`).
    - `apps/desktop/src/main/palot-runtime/migrate-localstorage.ts` — one-shot import from `elf:genui-artifacts` on first boot. Guarded by `loom:artifacts-migrated` flag in main.
    - `apps/desktop/src/main/palot-runtime/persistence.ts` — snapshot per-session `rev` to `~/.local/share/elf/loom/sessions/<sessionId>/<rev>.json`. Replay on session open.
    - `apps/desktop/src/main/palot-runtime/append.ts` — `append` verb implementation; `palot_patch --append` is a thin wrapper.
    - `apps/desktop/src/main/palot-runtime/ipc.ts` — IPC `palot-artifact:{get, list, patch, pin, remove}`.
    - `apps/desktop/src/shared/loom/artifact-id.ts` — ULID minting + validation. `art_<ulid>` format. CSPRNG via `crypto.randomBytes`.
    - `apps/desktop/src/main/palot-runtime/__tests__/{artifact-store,migrate-localstorage,append}.test.ts`
  - **Touched files (CHANGED):**
    - `apps/desktop/src/renderer/atoms/genui-artifacts.ts:20–23` — switch ID minting to `art_<ulid>`. Add `removeGenUiArtifactAtom`. Renderer reads from new IPC channel.
    - `apps/desktop/src/renderer/atoms/genui-artifacts.ts:157–188` — keep `patchGenUiArtifactPropsAtom`.
    - `apps/desktop/src/renderer/lib/types.ts` — `GenUiArtifactRecord` gains `schemaVersion: 1`, `id: ArtifactId`, `dirty: string[]`, `lastAgentPatchAt: number`, `lastHumanEditAt: number`. **`GenUiArtifactPlacement.side-panel` removed** (not a valid V2 widget zone — V2 closed vocabulary is `["above-chat", "chat-inline-right"]`).
    - `apps/desktop/src/renderer/components/genui/genui-artifact-prop-actions.tsx` — generalize the DAG-specific `Tweak` patch action. Per-component prop-action declaration in the registry (this is the right place to fix the prop-action hardcode; template: `decision_card`'s `notes` binding).
    - `apps/desktop/src/main/palot-runtime/session-store.ts` — persist tree snapshots to sqlite; replay on session open.
    - `apps/desktop/src/main/palot-runtime/commands.ts` — add `--append` mode to `palot_patch`.
    - `apps/desktop/src/main/loom-bridge.ts` — surface channel supports `append` frames.
    - `apps/desktop/src/renderer/loom/use-loom-session.ts` — apply `append` frames incrementally (no full re-render for `append`).
    - `apps/desktop/src/renderer/genui/registry.ts` — add `supports_append: boolean` to entry. Default `false`.
    - `apps/desktop/src/shared/palot-bridge-schemas.ts` — Zod for `--append` args.
  - **Must do:**
    - `ArtifactId = "art_<ulid>"` in `apps/desktop/src/shared/loom/artifact-id.ts`. Use a known ULID implementation (e.g. `ulid` npm package; verify dep is acceptable before adding).
    - Add new sqlite store at `~/.local/share/elf/loom/artifacts.sqlite` with the schema above.
    - Migrate existing `atomWithStorage` entries into sqlite on first boot. One-shot; behind `loom.persistence.migrate`. Failures: log + continue (localStorage data preserved as backup).
    - Add `palot_patch --append --node <id> --chunk <text.toon>`. Component declares `supports_append: boolean`. Runtime appends to node's `text` or `markdown` field. Surface emits `append` frame; renderer incrementally renders.
    - Per-session `rev` snapshots to disk. On session open, runtime replays tree from last snapshot.
    - Cross-session pin: pinned artifact survives renderer reload AND session restart.
    - `palot-artifact:{get, list, patch, pin, remove}` IPC channels. Renderer uses these instead of `atomWithStorage`. Graceful degrade if main unavailable.
    - AXI compliance: TOON on stdout, `--help`, structured errors, contextual `help[]`.
    - Tests:
      - `artifact-store.test.ts`: round-trip create/read/update/pin across process restarts (temp `XDG_DATA_HOME`).
      - `migrate-localstorage.test.ts`: populate `localStorage` with known fixture, run migration, assert new store contains same data, assert localStorage key removed, assert `loom:artifacts-migrated` flag set.
      - `append.test.ts`: `palot_patch --append` returns `{rev}` and surface streams. `supports_append: false` returns `errorCode: "append_unsupported"`.
    - `genui-renderer.tsx` legacy fence path keeps working. New persistent identity is additive.
  - **Must NOT do:** no CRDT. No V2 `contributes.components` (wave 6). No tool-renderer consolidation (wave 7, deferred). Do not bundle migration with cross-session pin. Do not change wire binding model or conflict policy.
  - **Proof criteria:**
    - `artifact-store.test.ts` + `migrate-localstorage.test.ts` + `append.test.ts` pass.
    - Real OpenCode session opens Loom session, agent renders `dag-sparkline`, agent pins artifact, renderer restarted, pin survives.
    - Agent streams long-form `markdown` node via `palot_patch --append`; surface renders chunks incrementally.
    - First-boot migration: install new build over existing; existing pinned artifacts migrate to sqlite; localStorage key removed.
    - Legacy fence path still works.
    - `bun run check-types` clean. `bun run lint` clean.
  - **Risk:** **Medium-large.** State migration + new IPC + persistence swap. Mitigations: one-shot migration behind flag (reversible); tests cover create/read/update/pin across restarts; renderer IPC degrades gracefully. Failure modes: migration corrupts data (test with fixture); `append` applied to non-text field (validate field type).
  - **Definition of done:** all proof criteria pass. `.sisyphus/plans/loom-progress.md` updated with `Wave 4: complete (date)`. Changeset added. PR opened. Manual dogfood: real OpenCode session uses `append` to stream markdown; pinned artifacts survive renderer restart.

- [ ] 6. [Wave 5 — `contributes.components` in the V2 plugin manifest (Loom §3, §6)](docs/loom-alignment-assessment.md#4-cross-cutting-findings)
  - **Goal:** the plugin manifest **is** the component contract. A third-party plugin can contribute a Loom component with a Zod schema, an example, and declared bindings. The GenUI registry becomes the list of *built-in* V2 component contributions. Closes the cross-project loop with Firefly/ELF and OpenCode fork.
  - **Open decisions enforced:** D5 (version-pin per session) is enforced at the manifest level. Manifest gains `apiVersion`; `session open` snapshots the catalog.
  - **Feature flag:** `loom.v2Components`, `loom.v2.acmeComponents`.
  - **Touched files (NEW):**
    - `apps/desktop/src/shared/firefly-plugin/component-zod.ts` — tiny Zod-to-JSON-Schema-ish summary helper for agent prompt-context injection (smallest-schema-first).
    - `apps/desktop/src/renderer/components/loom/component-mount.tsx` — host reconciler; looks up `Component` by id from registry + projection. Falls back to "pending" skeleton if not loaded.
    - `apps/desktop/src/shared/firefly-plugin/exemplars/acme-components-exemplar.ts` — third-party manifest declaring `contributes.components` entry. Trust: `signed-third-party`.
    - `apps/desktop/src/shared/firefly-plugin/COMPONENT_CONTRACT.md` — the cross-project contract doc Firefly/ELF + OpenCode fork consume.
  - **Touched files (CHANGED):**
    - `apps/desktop/src/shared/firefly-plugin/manifest.ts:357–421` — add `contributes.components: ComponentContribution[]` to `pluginManifestSchema`. Each contribution:
      ```ts
      {
        id: string,                              // canonical name
        apiVersion: number,                      // contract version
        category: "diagram" | "decision" | "form" | "viewer" | "layout" | "custom",
        props: z.ZodTypeAny,                     // prop contract
        events: { [name]: z.ZodTypeAny },        // signal bindings
        state:  { [name]: z.ZodTypeAny },        // local bindings
        supports_append: boolean,                // wave 4
        example: { component: string, props: unknown },
        capabilityGates: string[],
        hostVocabulary: { slots: string[], zones: string[] },
        conflictPolicy: "agent-wins" | "human-wins" | "merge" | "ask", // default "ask"
      }
      ```
    - `apps/desktop/src/shared/firefly-plugin/family-contracts.ts` — add `COMPONENT_CONTRACT` mirroring `PANEL_CONTRACT` / `WIDGET_CONTRACT`.
    - `apps/desktop/src/shared/firefly-plugin/descriptor.ts` — extend `derivePluginDescriptor` to normalize `components`.
    - `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts` — add `ProjectedComponent` and `projectComponentsFromCatalog`. Mirror `ProjectedSidePanel` shape.
    - `apps/desktop/src/main/firefly-plugin/catalog.ts:65–223` — wire components into `buildPluginCatalog`.
    - `apps/desktop/src/main/palot-plugin/plugin.js` — add three new V2 `ToolContribution`s for artifact mutation: `plugin.palot-bridge.artifact_pin`, `plugin.palot-bridge.artifact_update`, `plugin.palot-bridge.artifact_remove`. **Wire V2 catalog into `appendPalotPlugin`** at `opencode-manager.ts:604–615` so V2 tool list and system context reach the spawned OpenCode process.
    - `apps/desktop/src/main/firefly-plugin/dispatch.ts:82–158` — register handlers for the three artifact-mutation tools.
    - `apps/desktop/src/main/palot-session-binding.ts:33–55` — add `scope: "session" | "project"` to persisted record. Default migration to `session` for existing rows.
    - `apps/desktop/src/main/ipc-handlers.ts:404–451` — add `palot:artifact-pin`, `palot:artifact-update`, `palot:artifact-remove` channels.
    - `apps/desktop/src/renderer/hooks/use-firefly-plugins.ts:99–145` — expose `useFireflyPluginComponents`, mirroring `useFireflyPluginTools`.
    - `apps/desktop/src/renderer/genui/registry.ts` — existing GenUI entries become *built-in* V2 component contributions (`BUILT_IN_COMPONENTS: ComponentContribution[]`). Source for built-in.
    - `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts` — registers built-in `decision_card` + `dag-sparkline` as first-party component contributions.
  - **Must do:**
    - Define the Zod schema for `contributes.components` in `manifest.ts`. Add `COMPONENT_CONTRACT` in `family-contracts.ts`.
    - Extend `derivePluginDescriptor` to normalize `components`.
    - Add `ProjectedComponent` and `projectComponentsFromCatalog`. Mirror `ProjectedSidePanel`.
    - Add `useFireflyPluginComponents` hook.
    - Renderer mounts contributed components via `component-mount.tsx`. Lookup: GenUI registry (built-in) + projection (third-party).
    - Migrate existing `GenUiEntry[]` to be the source for built-in contributions.
    - Add real third-party exemplar: `acme-components-exemplar.ts` with `acme.loyalty_progress_bar` (Zod schema, example, `capabilityGates: ["acme:read"]`).
    - Host reconciler mounts contributed component when id appears in active Loom session tree. Behind `loom.v2.acmeComponents`.
    - Wire V2 catalog → spawn path: at `opencode-manager.ts:604–615`, call `buildPluginCatalog`, project tool defs + system context blocks, write both `OPENCODE_PLUGIN` and bridge env from V2 projection.
    - Tests:
      - `renderer-projection.test.ts` (extend) — `projectComponentsFromCatalog` produces expected rows.
      - `catalog.test.ts` — built-in manifests validate; exemplar validates.
      - Smoke test that mounts `acme.loyalty_progress_bar` in a Loom session tree.
  - **Must NOT do:** no new transport. No new components other than `dag-sparkline` + `decision_card` (built-ins) and `acme.loyalty_progress_bar` (exemplar). No FFI to OpenCode fork. Do not break the existing `palot-bridge-manifest.ts`'s `palotSidePanelTabSchema` (wave 0's contract); `contributes.components` is added alongside.
  - **Proof criteria:**
    - V2 manifest `BUILT_IN_MANIFESTS` accepts `palot-bridge-manifest` (with new `components` family) and `acme-components-exemplar`.
    - `BUILT_IN_COMPONENTS` includes `dag-sparkline` and `decision_card` as first-party contributions.
    - Renderer mounts `acme.loyalty_progress_bar` when feature flag on and Loom session tree references its id.
    - `palot_components_list` (from wave 1) returns union of built-in + contributed.
    - V2 catalog is read at `opencode-manager.ts:604–615` spawn time and tool list + system context reach the spawned OpenCode process.
    - `genui-artifact-pin`, `genui-artifact-update`, `genui-artifact-remove` V2 tools registered; `dispatch.ts` handlers respond.
    - `palot-session-binding.ts` persisted record gains `scope: "session" | "project"`.
    - Cross-project contract documented in `COMPONENT_CONTRACT.md`.
    - Existing fence path still works.
    - `bun run check-types` clean. `bun run lint` clean. All new tests pass.
  - **Risk:** **Medium.** Manifest is the cross-project contract surface. Mitigations: `contributes.components` is additive; existing families unchanged; exemplar gated by feature flag (default off). Failure mode: third-party manifest's `props` Zod schema rejects valid fences (host reconciler surfaces structured error, not crash).
  - **Definition of done:** all proof criteria pass. V2 manifest is the source of truth. Built-in + third-party both work. `.sisyphus/plans/loom-progress.md` updated with `Wave 5: complete (date)`. Follow-up note: Firefly/ELF and OpenCode fork work ready to dispatch. Changeset added. PR opened. Manual dogfood: real OpenCode session renders `acme.loyalty_progress_bar` end-to-end. Update `~/src/ch5/ch5-company/docs/agent-ui-direction-axi-loom.md` palot row to "Reference build-out: complete (Wave 5)".

- [ ] 7. [Wave 6 — Tool-renderer consolidation (deferred post-Loom, ship after wave 5 lands)](docs/loom-alignment-assessment.md#4-cross-cutting-findings)
  - **Goal:** collapse `apps/desktop/src/renderer/components/chat/chat-tool-call.tsx`'s 6 switch statements into a `ToolRendererContribution` table. Wire V2 plugin commands into the command palette automatically.
  - **Why deferred:** it is a refactor, not a Loom feature. The 1318-line file bundled with the Loom migration would inflate the review surface. Ship after Loom is in production.
  - **Touched files (NEW):**
    - `apps/desktop/src/renderer/components/chat/tool-renderer-registry.ts` — `Record<ToolName, {icon, title, pendingLabel, defaultOpen, Content}>`.
    - `apps/desktop/src/renderer/components/chat/tool-renderer-content/{bash,edit,write,patch,dag,read,search,webfetch,todo,generic}.tsx` — per-tool `*Content` files.
  - **Touched files (CHANGED):**
    - `apps/desktop/src/renderer/components/chat/chat-tool-call.tsx` — rewrite to consume the registry; collapse to ~200 LoC.
    - `apps/desktop/src/renderer/components/command-palette.tsx:369–399, 460–648` — Features + Plugins groups iterate the V2 catalog.
  - **Must do:**
    - Split each `case "x":` body in `chat-tool-call.tsx` into a per-tool `*Content` file. Keep behavior identical.
    - Build `tool-renderer-registry.ts` mapping `ToolName` to `{icon, title, pendingLabel, defaultOpen, Content}`.
    - Rewrite the 6 switches as a single dispatch.
    - Wire V2 `useFireflyPluginTools()` into the registry. Each `OpenCodeToolDefinition` registers a default `Content` (the existing `GenericContent`) unless a more specific one is contributed.
    - Update command palette's Plugins group to iterate V2 catalog.
    - No behavior change. Visual diff against the prior render.
  - **Must NOT do:** no new tools. No new transport. No new wire. No GenUI changes. No Loom changes. Do not bundle with the Loom migration.
  - **Proof criteria:**
    - `chat-tool-call.tsx` shrinks from 1318 lines to under 300.
    - All existing tool-call render behaviors still work.
    - Command palette's Plugins group auto-discovers the two exemplar plugins.
    - `bun run check-types` clean. `bun run lint` clean.
  - **Risk:** **Low.** Pure refactor. No behavior change. Failure mode: tool behavior lost in split (visual diff catches; add snapshot test per tool).
  - **Definition of done:** all proof criteria pass. `chat-tool-call.tsx` is under 300 lines. `.sisyphus/plans/loom-progress.md` updated with `Wave 6: complete (date)`. PR opened.

## Final Verification Wave <!-- oc:id=sec_ah -->

- [ ] F1. [Spec compliance — does the implementation match the Loom protocol spec?]
  - Open the Loom protocol spec at `~/src/ch5/ch5-company/docs/loom-protocol-spec.md` and verify every Loom invariant is honored:
    - Asymmetric transport: agent only speaks CLI/TOON (verified in wave 2). Surface only speaks JSON over WS.
    - Typed component registry (verified in wave 1 + 5). Per-affordance Zod props, events, state.
    - Dual signal/state bindings (verified in wave 3).
    - `render` / `patch` / `poll` / `state` / `session` verbs (verified in wave 2).
    - Agent-authoritative reconciliation with `rev` + dirty-field protection (verified in wave 3).
    - Streaming `append` frame (verified in wave 4).
    - Plugin manifest = component contract (verified in wave 5).
  - Verifier: oracle or experienced reviewer. Output: a short pass/fail per invariant.

- [ ] F2. [Implementation reality — does the code actually work in the repo, with real OpenCode sessions?]
  - `bun run check-types` clean.
  - `bun run lint` (Biome) clean.
  - All new Bun tests pass: `bun test`.
  - The Loom spec's §13 minimal end-to-end walkthrough reproducible in `bun test` with no live OpenCode.
  - `apps/desktop/src/main/palot-browser-ipc.ts` exports `ensurePalotBridgeServer` (pre-flight check, grep).
  - All pre-existing tests still pass (no fence-render regression).
  - Verifier: an unspecified-high workstream that runs the full test + check suite.

- [ ] F3. [Manual QA — does a real agent use the Loom wire end-to-end?]
  - Spawn a real OpenCode session (via devmux + bun run dev).
  - Ask the agent to:
    1. Open a Loom session via `palot_session open`. <!-- oc:id=item_aa -->
    1. Describe a built-in component via `palot_components_describe dag-sparkline`. <!-- oc:id=item_ab -->
    1. Render it via `palot_render`. <!-- oc:id=item_ac -->
    1. Type into the `decision_card.notes` field (state binding) — surface updates immediately, no agent round-trip. <!-- oc:id=item_ad -->
    1. Click submit (signal binding) — agent receives the event + notes delta in one `palot_poll`. <!-- oc:id=item_ae -->
    1. Agent issues `palot_patch` to update `selected: "opt_b"`. <!-- oc:id=item_af -->
    1. Agent triggers a conflict by patching a field the human is editing. <!-- oc:id=item_ag -->
    1. Agent streams a `markdown` node via `palot_patch --append`. <!-- oc:id=item_ah -->
    1. Agent pins an artifact; renderer restarts; pin survives. <!-- oc:id=item_ai -->
  - All steps succeed. Verifier: human (Chris) or QA agent.

- [ ] F4. [Scope fidelity — did we ship only what was in the plan, not adjacent refactors?]
  - The 7 mirror lists collapse to one source of truth. No new surfaces added.
  - No new components other than `dag-sparkline` (pre-existing), `decision_card` (wave 3 fixture), `acme.loyalty_progress_bar` (wave 6 exemplar).
  - The V1 plugin (`palot-bridge` JS) stays as the runtime carrier. The V2 manifest is the source of content; no V1 plugin rewrite.
  - No CRDT, no multi-human collaboration, no OpenCode fork changes.
  - No new public API surface in `window.elf` beyond the Loom tree mount.
  - No changes to `chat-tool-call.tsx` (deferred to wave 6).
  - No changes to the V2 manifest's existing families (`panels`, `widgets`, `commands`, `themes`, `tools`); only `components` added.
  - Pre-existing dirty tree untouched.
  - Verifier: a reviewer who diffs the merged branches against the plan's "must NOT have" list.

## Commit Strategy <!-- oc:id=sec_ai -->

- Each TODO is one commit (or one PR; the worker decides). Pathspec-only.
- Commit message format: `wave-N: <verb> <noun>` or `chore: <noun>`.
- Pathspec-only commits: `git commit -m "..." -- <files>`. Never `git add -A`. Never `git add <path> && git commit`. Never commit any path outside this plan's scope.
- Push each commit. Never hoard unpushed commits.
- Update `.sisyphus/plans/loom-progress.md` on every wave's completion (single status row, then push).
- `bun changeset` is added for user-facing changes only. Wave 0 (refactor) does not need one. Waves 1–5 do (new tools, wire, persistence). Wave 6 (refactor) does not.
- The pre-existing dirty tree (other agents' work) is not yours. Do not touch, stage, commit, or revert it.

## Success Criteria <!-- oc:id=sec_aj -->

- All Definition of Done checkboxes are checked.
- F1, F2, F3, F4 all pass.
- `bun run check-types` clean.
- `bun run lint` clean.
- New Bun tests pass.
- A real OpenCode session uses the Loom wire end-to-end.
- The Loom spec's §13 walkthrough is reproducible in `bun test` without a live OpenCode.
- The 7 mirror lists collapse to one source of truth.
- Artifact identity is `art_<ulid>`; cross-session pin survives renderer restart.
- `acme.loyalty_progress_bar` renders in a real Loom session.
- No regression in the fence-render path.
- The pre-existing dirty tree is untouched.
- `.sisyphus/plans/loom-progress.md` is up to date.