# palot → Loom Implementation Plan <!-- oc:id=sec_aa -->

> **Status:** Planning-only. No migration code is being written.
> **Companion docs:** `.sisyphus/plans/loom-alignment-assessment.md` (the *why*),
> `.sisyphus/plans/loom-build-prompts/` (the *how*, one prompt per wave),
> `.sisyphus/plans/loom-progress.md` (the *status*).
> **Constraints:** plan respects the Loom protocol spec + AXI 10 principles.
> Each phase below is small enough to land behind a feature flag, prove, and
> ship independently. Every phase ends with a **proof criterion** the PM can
> check before clearing the next wave.

## 0. Sequencing rule <!-- oc:id=sec_ab -->

Phases are **ordered by dependency**, not by Loom spec order. Wave 0 is the
non-Loom prerequisite (consolidate the 7 mirror lists). Wave 1 is the smallest
Loom-shaped win (Zod-typed component registry + `list` / `describe` discovery,
no transport change). Wave 2 introduces the wire. Waves 3–5 build on top.

| Wave | Loom invariant introduced | Touches transport? | Shippable? | Reversible? |
|---|---|---|---|---|
| 0 | none directly (prereq) | no | yes (mirror lists collapse) | yes |
| 1 | §6 (typed registry, smallest-schema-first) | no (plugin CLI only) | yes (introspectable registry) | yes |
| 2 | §5.1 (`render`/`patch`/`poll`), §4 (session + `rev`) | yes (localhost bridge verbs) | yes (Loom wire, single component) | yes |
| 3 | §7 (dual signal/state bindings) | partial (state delta channel) | yes (one dual-binding component) | yes |
| 4 | §8 (per-node `rev` + dirty-field protection) | no (runtime only) | yes (conflict surfaces) | yes |
| 5 | §4 (durable artifact id), §12.5 (streaming `append`) | partial (`append` frame) | yes | yes |
| 6 | §3 (plugin manifest = component contract) | no | yes (V2 `contributes.components`) | yes |

Waves 2–5 can be sub-divided (2a/2b/2c etc.) if a single wave proves too big.
The build prompts in `.sisyphus/plans/loom-build-prompts/` are scoped to one wave each.

## 1. Open decisions to resolve before Wave 2 <!-- oc:id=sec_ac -->

These come from Loom spec §12 and the design review (per
`~/.claude/skills/axi-loom/SKILL.md`). Resolve them before writing Wave 2 code;
Wave 0 and Wave 1 are unaffected.

| # | Decision | Recommendation for palot | Source |
|---|---|---|---|
| D1 | Transport to surface (WS vs SSE+POST) | **WebSocket**. The Electron renderer can hold a persistent socket to the localhost bridge; the proxy story is moot because Electron is the host; the same socket lets us add presence/typing later. | spec §12.1 |
| D2 | Streaming `append` frame | **Include it.** The renderer already does pending skeletons; making the protocol explicitly support `append` is cheap and saves N fence re-emits per streaming token. | spec §12.5 |
| D3 | Patch addressing | **Node-id + field**, not JSON Pointer. Tree reshaping is common (collapsing/expanding lists, swapping cards) and node-id is robust against it. | spec §12.2 |
| D4 | Event batching window for `state` deltas | **250 ms** default, exposed as a host-tunable. Coalesce-same-field. | spec §12.3 |
| D5 | Component versioning on hot-reload | **Version-pin per session.** If a plugin's `apiVersion` bumps mid-session, the running tree continues on the pinned version; new sessions pick up the new version. Surface `component_version_mismatch` to the agent. | spec §12.4 |
| D6 | TOON for the surface channel | **No.** Keep JSON over the WS. The surface is the React renderer, not a second agent; bytes are cheap there. | spec §12.6 |

D1–D3 are blocking for Wave 2. D4–D5 can be decided in Wave 2/3. D6 is a
defer-and-document.

## 2. Shared architectural decisions <!-- oc:id=sec_ad -->

These hold across all waves.

### 2.1 Where Loom core lives <!-- oc:id=sec_ae -->

`apps/desktop/src/main/palot-runtime/` (new directory). Contains:

- `session-store.ts` — authoritative tree + per-node `rev` + event queue.
- `commands.ts` — `render` / `patch` / `poll` / `state` / `components` / `end`.
- `revision.ts` — monotonic per-session counter, conflict detection.
- `dirty.ts` — per-field `dirty` set, conflict policy.
- `wire.ts` — TOON encoding/decoding for the agent boundary, JSON for the
  surface WS.

Loom core is **not a plugin**. It is built into Electron main. Component packs
are V2 plugin contributions; see Wave 6.

### 2.2 Where the surface WS lives <!-- oc:id=sec_af -->

`apps/desktop/src/main/loom-bridge.ts` (new file). Lives next to
`palot-browser-ipc.ts`; reuses the same `PALOT_BRIDGE_URL` + token env seam.
Renders speak JSON to a `ws://127.0.0.1:<port>/loom/<sessionId>` endpoint
backed by `SessionStore`. The HTTP POST channel still exists for the agent
CLI; both channels converge on `SessionStore`.

### 2.3 Where the renderer subscription lives <!-- oc:id=sec_ag -->

`apps/desktop/src/renderer/loom/` (new directory). Contains:

- `use-loom-session.ts` — opens WS, replays tree, applies patches.
- `loom-context.tsx` — provider that mounts one WS per active Loom session.
- `loom-renderer.tsx` — walks the tree, dispatches to registered components.

Initial mount is gated on a feature flag (`loom.enabled`) and a per-session
opt-in (no session auto-promotes to Loom until Wave 5).

### 2.4 What changes in the V2 plugin manifest <!-- oc:id=sec_ah -->

`apps/desktop/src/shared/firefly-plugin/manifest.ts` gains a new family
`contributes.components` (Zod schema in Wave 6). Each component contribution
is:

```ts
{
  id: "firefly.built-in.dag-sparkline",      // canonical name
  apiVersion: 1,                              // pins the contract version
  category: "diagram" | "decision" | "form" | "viewer" | "layout" | "custom",
  props: z.ZodTypeAny,                        // prop contract
  events: { [eventName]: z.ZodTypeAny },      // signal bindings
  state:  { [stateName]:  z.ZodTypeAny },     // local bindings
  supports_append: boolean,                   // Wave 5
  example: { component: "decision_card", props: { ... } },
  capabilityGates: string[],                  // agent must hold these
  hostVocabulary: { slots: string[], zones: string[] },
}
```

The GenUI registry (`apps/desktop/src/renderer/genui/registry.ts`) becomes
the list of *built-in* V2 component contributions. The V2 catalog
(`apps/desktop/src/main/firefly-plugin/catalog.ts`) is the single authority.

### 2.5 What stays unchanged <!-- oc:id=sec_ai -->

- `apps/desktop/src/renderer/firefly-surface-registry.tsx` (until Wave 0
  collapses the mirror lists).
- `apps/desktop/src/main/palot-plugin/plugin.js` (until Wave 2 adds the
  Loom CLI verbs — at which point it is the **agent-side** entry; the
  surface WS lives separately in `loom-bridge.ts`).
- `apps/desktop/src/renderer/components/chat/chat-tool-call.tsx` (until
  Wave 7's tool-renderer consolidation, which is *after* Loom is in
  production — see Risks).
- `AGENTS.md` (update once at the end of Wave 6, not per wave).

## 3. The phases <!-- oc:id=sec_aj -->

### Phase 0 — Mirror lists collapse (prerequisite, no Loom code) <!-- oc:id=sec_ak -->

**Goal:** one source of truth for the 18 side-panel surface ids. No
behavior change. No Loom-shaped API yet.

**Scope:**

- The 18 surface ids appear in 7 places today. Consolidate to one
  `SurfaceContribution` table derived from the V2 manifest's
  `panels` family. See Appendix A in `.sisyphus/plans/loom-alignment-assessment.md`.
- `apps/desktop/src/renderer/atoms/feature-flags.ts:26–180` — collapse 17
  per-surface storage atoms into one `surfaceFlagsFamily(panelId)` atom
  family. The `fireflySurfaceFlagAtoms` table at `:68–87` becomes the
  single source.
- `apps/desktop/src/renderer/atoms/ui.ts:25–43` — `SidePanelTabId` becomes
  derived from the registry (compile-time `as const`).
- `apps/desktop/src/renderer/components/agent-detail.tsx:27–44, 220–285`
  — replace 17 `useAtomValue` calls with one
  `useFireflySurfaceContext(agent)` hook.
- `apps/desktop/src/renderer/components/command-palette.tsx:460–648` —
  iterate the registry for the Features group instead of 17 hand-rolled
  `<CommandItem>` blocks. The Surfaces group at `:649–671` is already
  registry-driven.
- `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts:21–40`
  and `apps/desktop/src/main/palot-plugin/plugin.js:124–143` — derive
  `palotSidePanelTabSchema` and `VALID_SIDE_PANEL_TABS` from the registry.
- Update `docs/firefly-surface-playbook.md:25–31` to reflect the
  single-source path.

**Touched files (illustrative; the build prompt is precise):**

- `apps/desktop/src/renderer/firefly-surface-registry.tsx`
- `apps/desktop/src/renderer/atoms/feature-flags.ts`
- `apps/desktop/src/renderer/atoms/ui.ts`
- `apps/desktop/src/renderer/components/agent-detail.tsx`
- `apps/desktop/src/renderer/components/command-palette.tsx`
- `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts`
- `apps/desktop/src/main/palot-plugin/plugin.js`
- `docs/firefly-surface-playbook.md`

**Proof criteria:**

- `git grep "review" -- '*SidePanel*' '*feature-flags*' '*ui.ts' '*command-palette*' '*palot-bridge-manifest*' 'palot-plugin/plugin.js'` returns exactly one *definition* and the rest are derived references.
- `bun run check-types` clean.
- `bun run lint` clean.
- Adding a new surface requires editing **one** file.
- Manual smoke: open a chat, open the side panel, toggle every tab — visuals unchanged.

### Phase 1 — Typed registry + `list` / `describe` discovery (Loom §6) <!-- oc:id=sec_al -->

**Goal:** GenUI registry is Zod-typed and discoverable through the bridge
CLI. No transport change. No patch/poll yet.

**Scope:**

- `apps/desktop/src/renderer/genui/registry.ts:19–32` — replace
  `parseProps: (raw) => Result<P>` with `props: z.ZodTypeAny`. Keep
  `parseProps` as a thin `props.safeParse` wrapper. Add optional
  `events: { [name]: z.ZodTypeAny }` and `state: { [name]: z.ZodTypeAny }`
  fields (declared but unused until Wave 3).
- `apps/desktop/src/renderer/genui/components/dag-sparkline.tsx` —
  declare props as a Zod schema; remove hand-rolled parsing.
- `apps/desktop/src/renderer/genui/registry.ts:78–93` —
  `buildGenUiCatalog()` regenerates from the typed entries; emits
  smallest-schema (name + one-line) by default. Keep JSON for now;
  switch the bridge CLI to TOON.
- `apps/desktop/src/main/palot-plugin/plugin.js` — add
  `palot components list` and `palot components describe <name>` tools.
  Output TOON. `list` returns `{name, one_line, category}`. `describe`
  returns the full Zod schema + one example + capability gates.
- `apps/desktop/src/shared/palot-bridge-schemas.ts` — add Zod schemas for
  the new tool args/results.
- `apps/desktop/src/main/palot-browser-ipc.ts:271–326` — add a route
  for the new tools.
- A `loom.componentsList` family flag (`feature-flags.ts`) gates the
  new tools so the change is reversible.

**Touched files:**

- `apps/desktop/src/renderer/genui/registry.ts`
- `apps/desktop/src/renderer/genui/genui-renderer.tsx` (parseProps call site)
- `apps/desktop/src/renderer/genui/components/dag-sparkline.tsx`
- `apps/desktop/src/main/palot-plugin/plugin.js`
- `apps/desktop/src/shared/palot-bridge-schemas.ts`
- `apps/desktop/src/main/palot-browser-ipc.ts`
- `apps/desktop/src/renderer/atoms/feature-flags.ts` (flag)
- New: `apps/desktop/src/main/palot-runtime/toon.ts` (TOON encode/decode, minimal)

**Proof criteria:**

- `palot components list` returns TOON, smallest-schema.
- `palot components describe dag-sparkline` returns TOON, full Zod schema.
- `dag-sparkline` renders identically with the new schema path (regression
  test in `apps/desktop/src/renderer/genui/`).
- System prompt size **decreases** for sessions that do not use
  GenUI components (smallest-schema-first).
- `bun run check-types` clean.

### Phase 2 — The wire: `render` / `patch` / `poll` (Loom §5.1, §4) <!-- oc:id=sec_am -->

**Goal:** the agent can render a typed tree, poll for events/state, and
patch nodes. Surface speaks JSON over a localhost WS. Agent speaks TOON
to the bridge HTTP. Session has an authoritative tree with `rev`.

**Scope:**

- New: `apps/desktop/src/main/palot-runtime/session-store.ts` — in-memory
  per-session tree with per-node `rev`, monotonic session `rev`, event
  queue, state delta accumulator.
- New: `apps/desktop/src/main/palot-runtime/commands.ts` —
  `render`, `patch`, `poll`, `state`, `session` (open/end). Errors are
  TOON; non-zero exit on `palot CLI`; structured `errorCode` field.
- New: `apps/desktop/src/main/loom-bridge.ts` — accepts JSON-over-WS from
  the renderer; the existing HTTP bridge (`palot-browser-ipc.ts`) gains
  the `render` / `patch` / `poll` / `state` routes next to its current
  4 actions.
- New: `apps/desktop/src/renderer/loom/loom-context.tsx` — provider that
  opens a WS per active Loom session and replays the tree.
- New: `apps/desktop/src/renderer/loom/use-loom-session.ts` — hook
  returning `{ tree, subscribe, sendEvent, sendStateDelta, applyPatch }`.
- New: `apps/desktop/src/renderer/loom/loom-renderer.tsx` — walks the
  tree, dispatches nodes to registered components.
- `apps/desktop/src/main/palot-plugin/plugin.js` — add `palot_render`,
  `palot_patch`, `palot_poll`, `palot_state`, `palot_session` tools.
  Schemas in `palot-bridge-schemas.ts`.
- One end-to-end demo: a `dag-sparkline` rendered via the wire, then
  patched (e.g. add a node), with the surface updating live.

**Open decisions enforced in code:**

- D1: WS to the surface.
- D3: node-id + field for patches.
- D4: 250 ms batching window for state deltas.

**Touched files:**

- `apps/desktop/src/main/palot-plugin/plugin.js`
- `apps/desktop/src/shared/palot-bridge-schemas.ts`
- `apps/desktop/src/main/palot-browser-ipc.ts`
- New: `apps/desktop/src/main/palot-runtime/*` (5 files)
- New: `apps/desktop/src/main/loom-bridge.ts`
- New: `apps/desktop/src/renderer/loom/*` (3 files)
- `apps/desktop/src/main/palot-resolver.ts` (expose `openLoomSession`)
- `apps/desktop/src/renderer/atoms/feature-flags.ts` (`loom.enabled`)
- `apps/desktop/src/renderer/components/chat/chat-view.tsx` (mount
  `LoomContext` when `loom.enabled && session has an open Loom session`)

**Proof criteria:**

- `palot_session open --title "demo"` returns `{session_id, surface_url, rev: 0}`.
- `palot_render <tree.toon>` → `rev: 1`; the renderer displays the tree.
- `palot_patch <patch.toon>` → `rev: 2`; the renderer shows the diff live.
- `palot_poll --rev 0` returns no events (idle).
- A simulated human click on a placeholder `button` node produces a
  queued event; `palot_poll --rev 2` returns the event.
- No regression in the existing fence-render path (parallel path; feature
  flag).

### Phase 3 — Dual signal/state bindings (Loom §7) <!-- oc:id=sec_an -->

**Goal:** one component ships with both a local `state` binding and a
`signal` event. The agent sees only the signal; the surface mutates state
optimistically.

**Scope:**

- `apps/desktop/src/renderer/genui/registry.ts` — finalize the
  `events` and `state` declaration slots from Wave 1; a binding helper
  attaches the right `onChange` / `onClick` to each affordance.
- New: `apps/desktop/src/main/palot-runtime/dirty.ts` (placeholder for
  Wave 4) and per-affordance `onSignal` / `onState` plumbing through
  `use-loom-session`.
- `palot_poll` returns both `events[]` and `state[]` since `--rev`.
- A new `decision_card` component shipped as a built-in V2 contribution
  (placeholder manifest in `palot-bridge-manifest.ts`) demonstrates
  the dual binding: a `notes` text field is `state`, a `submit` button
  is `signal`.
- Renderer-side state deltas are coalesced at 250 ms (D4) before being
  sent to the runtime.

**Touched files:**

- `apps/desktop/src/renderer/genui/registry.ts`
- New: `apps/desktop/src/renderer/genui/components/decision-card.tsx`
- `apps/desktop/src/renderer/loom/use-loom-session.ts`
- `apps/desktop/src/main/palot-runtime/commands.ts`
- `apps/desktop/src/shared/palot-bridge-schemas.ts`
- `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts` (add decision_card as built-in)

**Proof criteria:**

- The `decision_card` ships with a `notes` field (state) and a
  `submit` button (signal).
- Typing into `notes` updates the surface **immediately** (no agent
  round-trip).
- The next `palot_poll` returns the `notes` state delta.
- Clicking `submit` produces a `decision_card#card1 → submit` event on
  the next `palot_poll`.
- `palot_patch` that touches the `notes` field while the user is typing
  is held and surfaces as `conflict` on the next `palot_poll` (preview
  of Wave 4; full conflict resolution lands in Wave 4).

### Phase 4 — Per-node `rev` + dirty-field protection (Loom §8) <!-- oc:id=sec_ao -->

**Goal:** the agent's tree is authoritative; concurrent human edits are
never silently clobbered.

**Scope:**

- `apps/desktop/src/main/palot-runtime/session-store.ts` — add
  per-node `rev`; each `patch` carries the expected `rev`; mismatches
  are rejected with a 409 + current `rev` + a delta (optimistic
  concurrency).
- `apps/desktop/src/main/palot-runtime/dirty.ts` — track per-field
  `dirty` set; patches to dirty fields are held and surface as
  `conflict` on the next `poll`.
- `use-loom-session.ts` — surface `conflict` events to the registered
  component via a `onConflict(nodeId, field, humanValue, agentValue)`
  callback declared in the registry.
- `palot_patch` returns a structured `errorCode: "stale_rev" | "dirty_field"` on
  conflict (TOON).
- Conflict policy default: agent override-able per-component via
  `conflictPolicy: "agent-wins" | "human-wins" | "merge" | "ask"` in the
  component's binding declaration. Default is `"ask"`.

**Touched files:**

- `apps/desktop/src/main/palot-runtime/session-store.ts`
- New: `apps/desktop/src/main/palot-runtime/dirty.ts`
- `apps/desktop/src/main/palot-runtime/commands.ts`
- `apps/desktop/src/renderer/loom/use-loom-session.ts`
- `apps/desktop/src/renderer/genui/registry.ts` (`conflictPolicy` slot)
- `apps/desktop/src/shared/palot-bridge-schemas.ts`
- Tests under `apps/desktop/src/main/palot-runtime/` (Bun test; matches
  `AGENTS.md:242–248` convention).

**Proof criteria:**

- A simulated stale-rev patch returns `errorCode: "stale_rev"` + the
  current `rev` + a delta.
- An agent patch to a dirty field returns `errorCode: "dirty_field"` +
  the held human value.
- A policy of `"merge"` concatenates the two values per the component's
  `merge` function; `"ask"` surfaces a `conflict` event to the
  `decision_card` and does not apply the patch.
- A regression test covers each policy.

### Phase 5 — Durable artifact identity + streaming `append` (Loom §4, §12.5) <!-- oc:id=sec_ap -->

**Goal:** artifacts survive across sessions. The agent can stream a
node's content token-by-token without re-emitting a fence.

**Scope:**

- `apps/desktop/src/renderer/atoms/genui-artifacts.ts:20–23` — switch
  ID minting to ULID; `genui-artifacts` sqlite at
  `~/.local/share/elf/loom/artifacts.sqlite` (mirror the
  `automation/paths.ts` XDG pattern from `AGENTS.md:210–212`).
- `apps/desktop/src/renderer/lib/types.ts` — `GenUiArtifactRecord`
  gains `version: number`, `dirty: string[]`, `lastAgentPatchAt: number`,
  `lastHumanEditAt: number`.
- New IPC channel `palot-artifact:{get, list, patch}` between renderer
  and main. Persistence writes go through main; renderer reads from a
  mirror.
- Migrate existing `atomWithStorage` entries into sqlite on first boot
  (one-shot; behind a flag).
- New `append` verb in `palot_patch` protocol: `palot_patch --append
  <nodeId> <chunk.toon>` grows a `text`/`markdown` field token-by-token.
  Component declares `supports_append: boolean` in its manifest (D2).
- `genui-renderer.tsx` keeps the legacy fence path; Loom `append` is a
  separate channel. Both work.

**Touched files:**

- `apps/desktop/src/renderer/atoms/genui-artifacts.ts`
- `apps/desktop/src/renderer/lib/types.ts`
- `apps/desktop/src/main/palot-runtime/session-store.ts` (persist tree
  snapshots to sqlite, snapshot per `rev`)
- `apps/desktop/src/main/palot-runtime/commands.ts` (`append` verb)
- `apps/desktop/src/main/loom-bridge.ts`
- `apps/desktop/src/renderer/loom/use-loom-session.ts`
- `apps/desktop/src/shared/palot-bridge-schemas.ts`
- `apps/desktop/src/renderer/genui/registry.ts` (`supports_append`)

**Proof criteria:**

- A pinned artifact survives a renderer reload and a session restart.
- The agent can `palot_patch --append <nodeId> "foo "` and the surface
  streams the appended text without a full re-render.
- A regression test: render a tree, kill the renderer, restart it,
  confirm the tree replays from `rev` 0.
- `~/.local/share/elf/loom/artifacts.sqlite` contains the artifact
  records.

### Phase 6 — `contributes.components` in the V2 manifest (Loom §6, §3) <!-- oc:id=sec_aq -->

**Goal:** the plugin manifest *is* the component contract. A third-party
plugin can contribute a Loom component with a Zod schema, an example,
and declared bindings. The GenUI registry becomes the list of built-in
V2 contributions.

**Scope:**

- `apps/desktop/src/shared/firefly-plugin/manifest.ts:357–421` — add
  a new `contributes.components` family (Zod schema for the contribution
  shape).
- `apps/desktop/src/shared/firefly-plugin/family-contracts.ts` — add
  `COMPONENT_CONTRACT` mirroring `PANEL_CONTRACT` / `WIDGET_CONTRACT`.
- `apps/desktop/src/shared/firefly-plugin/descriptor.ts` — extend
  `derivePluginDescriptor` to normalize `components`.
- `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts` —
  add `ProjectedComponent` and `projectComponentsFromCatalog`.
- `apps/desktop/src/main/firefly-plugin/catalog.ts:65–223` — wire
  components into the catalog.
- The GenUI registry (`apps/desktop/src/renderer/genui/registry.ts`)
  becomes the source for built-in V2 component contributions
  (`BUILT_IN_COMPONENTS: SurfaceContribution[]`).
- `palot-bridge-manifest.ts` adds a built-in `decision_card` component
  contribution; the manifest becomes the source of truth.

**Touched files:**

- `apps/desktop/src/shared/firefly-plugin/manifest.ts`
- `apps/desktop/src/shared/firefly-plugin/family-contracts.ts`
- `apps/desktop/src/shared/firefly-plugin/descriptor.ts`
- `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts`
- `apps/desktop/src/shared/firefly-plugin/renderer-projection.test.ts`
  (extend coverage)
- `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts`
- `apps/desktop/src/main/firefly-plugin/catalog.ts`
- `apps/desktop/src/renderer/genui/registry.ts` (built-in list)
- `apps/desktop/src/renderer/hooks/use-firefly-plugins.ts` (expose
  `useFireflyPluginComponents`)
- New: `apps/desktop/src/renderer/components/loom/component-mount.tsx`
  (host reconciler — looks up a `Component` by id from the registry
  + projection)

**Proof criteria:**

- A V2 plugin manifest declaring `contributes.components: [{ id,
  apiVersion, props, events, state, ... }]` is accepted by
  `pluginManifestSchema`; `BUILT_IN_MANIFESTS` validates.
- The renderer mounts the contributed component when its id is in the
  active session tree.
- A second exemplar manifest (`acme.components.exemplar` or similar)
  demonstrates a non-built-in contribution and a feature flag
  enables/disables it.

### Phase 7 — Tool-renderer consolidation (NOT in scope of Loom, but worth scheduling) <!-- oc:id=sec_ar -->

**Why here:** `apps/desktop/src/renderer/components/chat/chat-tool-call.tsx`
is 1318 lines of switch statements. After Loom ships, the same registry
discipline applies to tool-call renderers. Schedule this as a separate
phase so the Loom migration itself stays small and reviewable.

**Scope (deferred, see Risks):**

- A `ToolRendererContribution` table next to the dispatcher.
- Collapse the 6 switches into one dispatch.
- Tie into the V2 `contributes.tools` family in a later manifest bump.

## 4. Phasing summary <!-- oc:id=sec_as -->

| Wave | Title | Loom sections | Touches transport? | Proof artifact |
|---|---|---|---|---|
| 0 | Mirror lists collapse | n/a (prereq) | no | one-file add-surface; types clean |
| 1 | Typed registry + `list` / `describe` | §6 | no (plugin CLI only) | introspectable registry; smaller system prompt |
| 2 | `render` / `patch` / `poll` | §5.1, §4 | yes (localhost WS) | end-to-end wire demo on `dag-sparkline` |
| 3 | Dual signal/state bindings | §7 | partial (state delta channel) | `decision_card` with state + signal |
| 4 | Per-node `rev` + dirty-field | §8 | no (runtime only) | conflict surfacing + per-policy tests |
| 5 | Durable identity + `append` | §4, §12.5 | partial (`append` frame) | cross-session artifact; streamed token |
| 6 | `contributes.components` in V2 manifest | §3, §6 | no | third-party contribution mounts |
| 7 | Tool-renderer consolidation | n/a (orthogonal) | no | dispatcher registry |

## 5. Risks and mitigations <!-- oc:id=sec_at -->

| Risk | Mitigation |
|---|---|
| Wave 0 is not strictly Loom and may be deprioritized. | Frame it as a prerequisite, not a Loom wave. Pin in `.sisyphus/plans/loom-progress.md` as a blocker for Wave 1. |
| Wave 2 introduces a transport — risk of destabilizing the existing fence path. | Run both paths in parallel behind `loom.enabled`; do not retire the fence path until Wave 6. |
| `palot-plugin/plugin.js` is plain JS; the Loom verbs add complexity to an already-busy file. | Move the new verbs into a new module `apps/desktop/src/main/palot-plugin/loom-tools.js`; have the plugin entry re-export. The TS-side `palot-bridge-manifest.ts` is the type-correct reference. |
| TOON encode/decode is non-trivial. | Use the canonical TOON spec; land a minimal `toon.ts` in Wave 1 and grow it. Do not invent a TOON dialect. |
| The `dag` legacy fence is special-cased in 3 sites. | Wave 1 lifts it to `LEGACY_FENCE_ALIASES` in the registry. |
| OpenCode plugin runtime may impose constraints we have not hit. | Validate `palot_poll`'s long-poll behavior against a managed OpenCode server during Wave 2. If OpenCode enforces a tool-call timeout that is shorter than the long-poll, fall back to short-poll + agent-driven retry. |
| `chat-tool-call.tsx` is 1318 lines. | Defer to Wave 7. Do not bundle. |
| The OpenCode fork wiring (SessionStart hook for Loom core) is a separate repo. | Document the contract (`palot-bridge-manifest.ts` is the spec); coordinate the SessionStart hook in a sibling plan doc when the fork team picks it up. |
| `elm` ships to npm as `@ch5me/elf-ui`; consumers must not break. | Loom changes are renderer-side and behind flags; the published UI package is unaffected. |

## 6. Definition of done (per wave) <!-- oc:id=sec_au -->

A wave is "done" only when all of the following hold:

1. The proof criteria above pass. <!-- oc:id=item_aa -->
1. `bun run check-types` clean. <!-- oc:id=item_ab -->
1. `bun run lint` clean. <!-- oc:id=item_ac -->
1. New tests (Bun test) cover the wave's surface. <!-- oc:id=item_ad -->
1. `.sisyphus/plans/loom-progress.md` is updated with the wave's status. <!-- oc:id=item_ae -->
1. A changeset (`bun changeset`) is added if any user-facing change is
   shipped.
1. A PR is opened; the PR description cites this plan and the relevant
   build prompt from `.sisyphus/plans/loom-build-prompts/`.

## 7. First wave to dispatch <!-- oc:id=sec_av -->

**Wave 1** (typed registry + `list` / `describe` discovery). It:

- Is small (1–2 days).
- Establishes the Zod discipline every later wave depends on.
- Does not touch transport, the WS, the bridge, or any user-visible
  behavior. It is fully reversible.
- Produces a measurable win (smaller system prompts, introspectable
  registry).
- Has a clean proof criterion: `palot components list` returns TOON;
  `palot components describe dag-sparkline` returns the full Zod schema;
  the existing fence path is unchanged.

The exact prompt is in `.sisyphus/plans/loom-build-prompts/wave-01-typed-registry.md`.
The PM should dispatch it as a `quick` workstream first to validate the
prompt shape, then escalate to `ultrabrain` if it proves harder than
expected.