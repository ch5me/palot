# palot → Loom Alignment Assessment <!-- oc:id=sec_aa -->

> **Status:** Planning-only. No migration code is being written.
> **Source of truth:** `~/src/ch5/ch5-company/docs/loom-protocol-spec.md` + `~/src/ch5/ch5-company/docs/agent-ui-direction-axi-loom.md` + `~/.claude/skills/axi-loom/SKILL.md` + <https://axi.md/>.
> **Companion docs:** `.sisyphus/plans/loom-implementation-plan.md`, `.sisyphus/plans/loom-progress.md`, `.sisyphus/plans/loom-build-prompts/`.
> **palot's role:** reference build-out for the company. Firefly/ELF plugins and the OpenCode fork align to whatever lands here.

## 0. TL;DR <!-- oc:id=sec_ab -->

palot is **60–70% of the way to Loom** already, and one of its subsystems — the V2 Firefly plugin manifest/projection pipeline — is *already* a Loom-shaped typed registry that nobody has yet connected to a render/poll/patch loop. The five remaining gaps are:

1. **No typed Zod introspection of the GenUI registry.** `apps/desktop/src/renderer/genui/registry.ts:19–32` carries a hand-rolled `parseProps: (raw) => Result<P>` per entry; there is no canonical Zod schema, so the agent cannot `describe` a component. <!-- oc:id=item_aa -->
1. **No agent→UI patch/poll protocol.** The render layer (`apps/desktop/src/renderer/genui/genui-renderer.tsx:148–184`) parses fences once and treats them as immutable; updates require a full assistant turn to re-emit. There is no `rev`, no `patch` path, no long-poll. <!-- oc:id=item_ab -->
1. **No dual binding model.** A `GenUiEntry` has `parseProps` and `Component` and nothing else; there is no per-affordance declaration of `signal` vs `state` and no path for the human to drive a control whose update must round-trip to the agent. <!-- oc:id=item_ac -->
1. **Durable artifact identity is session-local + localStorage-only.** `apps/desktop/src/renderer/atoms/genui-artifacts.ts:40–43` stores `SessionGenUiArtifactsState` under the renderer key `elf:genui-artifacts`. There is no main-process store, no schema-versioned identity, no cross-session artifacts, no agent addressable handle. <!-- oc:id=item_ad -->
1. **Streaming fence parsing is optimistic, not protocol-aware.** `genui-renderer.tsx:14–15, 47–55, 78–91, 93–140` carries two regex fences plus a pending-frame branch that is hardcoded to `dag-sparkline`. The dispatcher is fence-shape-driven, not component-contract-driven, and the legacy ```` ```dag ``` ```` shortcut is the only component-aware code in an otherwise generic parser. <!-- oc:id=item_ae -->

But the **V2 plugin pipeline is already the right shape**:

- `apps/desktop/src/shared/firefly-plugin/manifest.ts:357–421` (`pluginManifestSchema`, Zod) is exactly the "plugin manifest = component contract" artifact Loom calls for.
- `apps/desktop/src/shared/firefly-plugin/family-contracts.ts:160–333` is the per-family typed contract layer.
- `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts:13–163` already produces `ProjectedSidePanel` / `ProjectedSessionWidget` / `ProjectedCommand` / `ProjectedTheme` from manifests.
- `apps/desktop/src/main/firefly-plugin/catalog.ts:65–223` is the single authority that materializes projections in one pass.
- `apps/desktop/src/shared/firefly-plugin/descriptor.ts:33–40` already closes the host's panel-slot/widget-zone vocabulary (`HOST_PANEL_SLOTS = ["side-panel","main-pane"]`, `HOST_WIDGET_ZONES = ["above-chat","chat-inline-right"]`).
- `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts:60–252` is the first-party exemplar.

The migration is **collapse V1 + V2 onto one typed registry, wire a render/poll/patch loop, and use the existing plugin-bridge transport for the agent CLI**. The smallest safe first step is a 1-wave "type the existing V1 GenUI registry with Zod and surface it through the V2 manifest" — no transport change, no protocol change, no behavior change. That alone unlocks 4 of the 5 gaps.

## 1. The five load-bearing Loom ideas, mapped to palot <!-- oc:id=sec_ac -->

| Loom idea | palot today | File anchors | Verdict |
|---|---|---|---|
| **Asymmetric transport** (agent speaks CLI/text; human gets socket; runtime bridges) | **Half-aligned.** The agent-facing side is the OpenCode `palot-bridge` plugin (`apps/desktop/src/main/palot-plugin/plugin.js`) injected via `OPENCODE_PLUGIN`; transport to the bridge is via direct callback or HTTP (`PALOT_BRIDGE_URL`+`PALOT_BRIDGE_TOKEN`); the human side is the renderer. The bridge is currently **text-only on the agent side, JSON over HTTP/iframe postMessage on the runtime side**. No persistent socket to the surface yet; no `poll` semantics. | `apps/desktop/src/main/palot-plugin/plugin.js:152–174` (`createBridgeClient`); `apps/desktop/src/main/palot-browser-ipc.ts:271` (localhost bridge server); `apps/desktop/src/main/opencode-manager.ts:414, 422, 466` (env injection) | Partially aligned. Bridge transport is close; surface socket is missing. |
| **Typed component registry = plugin surface** | **Two registries exist; neither is a full Loom surface.** V1 GenUI (`genui/registry.ts`) hand-rolls `parseProps` per entry; V2 manifest (`shared/firefly-plugin/manifest.ts`) Zod-validates contributions but does not currently validate GenUI component props. The V2 manifest *is* the right artifact; it is just not pointed at GenUI components yet. | `apps/desktop/src/renderer/genui/registry.ts:19–32, 40–54`; `apps/desktop/src/shared/firefly-plugin/manifest.ts:357–421`; `apps/desktop/src/shared/firefly-plugin/family-contracts.ts:160–333`; `apps/desktop/src/main/firefly-plugin/catalog.ts:65–223` | Aligned at the manifest layer. GenUI side is the gap. |
| **Dual signal/state bindings** | **Absent.** `GenUiEntry` has no concept of an affordance, a binding, an event, or a state mutation. The fence parser in `genui-renderer.tsx:148–184` produces segments; nothing in the chain declares "this checkbox is local state, this submit button is a signal". | `apps/desktop/src/renderer/genui/registry.ts:19–32`; `apps/desktop/src/renderer/genui/genui-renderer.tsx:190–280` (`GenUiBlock`); `apps/desktop/src/renderer/components/genui/*` | Missing. Big gap. |
| **render/poll/patch loop with deltas only** | **Render-only, no poll, no patch.** The renderer parses fences once per assistant turn; the agent has no way to push a delta. Updates require re-emitting the whole fence. Artifact state (`genui-artifacts.ts`) supports `patchGenUiArtifactPropsAtom` (`:157–188`) but only for local prop mutation; the agent never sees a patch, only a re-fence. | `apps/desktop/src/renderer/genui/genui-renderer.tsx:148–184`; `apps/desktop/src/renderer/atoms/genui-artifacts.ts:157–188`; `apps/desktop/src/renderer/atoms/chat.ts:79, 95–111` | Missing. |
| **Agent-authoritative reconciliation with dirty-field protection** | **Optimistic local mutation exists, but no agent authority.** `patchGenUiArtifactPropsAtom` (`genui-artifacts.ts:157–188`) merges a `propsPatch` into the local store with no concurrency check, no per-node `rev`, no conflict surfacing. There is no notion of the agent's tree being authoritative — there is no agent-side tree at all. | `apps/desktop/src/renderer/atoms/genui-artifacts.ts:157–188`; `apps/desktop/src/renderer/lib/types.ts` (`GenUiArtifactRecord` types) | Missing. |
| **Plugin manifest = component contract** | **Manifest is the right artifact, not yet pointed at GenUI.** V2 manifest declares `panels`, `widgets`, `commands`, `themes`, `tools` (no `components` family yet). | `apps/desktop/src/shared/firefly-plugin/manifest.ts:183–329` (per-family sub-schemas); `apps/desktop/src/shared/firefly-plugin/descriptor.ts:111–171` (normalizer) | Almost there — add a `components` family in the manifest schema. |
| **TOON wire format on the agent boundary** | **JSON everywhere.** The bridge plugin returns `JSON.stringify(...)` for browser/UI tool responses (`palot-plugin/plugin.js:181–195`); system-prompt injection is text but structured ad-hoc (`buildProductContextBlock`, `:73–101`); GenUI catalog is human-readable text (`buildGenUiCatalog`, `genui/registry.ts:78–93`). | `apps/desktop/src/main/palot-plugin/plugin.js:73–101, 181–195`; `apps/desktop/src/renderer/genui/registry.ts:78–93`; `apps/desktop/src/shared/palot-bridge-schemas.ts` (Zod, but JSON) | Missing. Migration wave should introduce a TOON surface in the bridge. |

## 2. Where palot already fits (the wins to defend) <!-- oc:id=sec_ad -->

These should not regress during the migration; they are evidence that the architecture's instincts are right:

- **The render layer is allowlist-only.** `genui-renderer.tsx:60–76` rejects any fence that is not a registered entry; the agent cannot emit arbitrary HTML. This is exactly the "typed registry, not HTML" Loom posture. The only HTML is the safe JSON tree and the React components shipped by the host.
- **V1 prompts and renderer derive from one source.** `buildGenUiCatalog()` (`genui/registry.ts:78–93`) and the renderer's `resolveGenUiEntry` (`genui/registry.ts:60–67`) both read `ENTRIES`. The catalog cannot drift from the renderer. This is the smallest piece of what Loom calls for ("plugin manifest = component contract"), and it is solid.
- **Per-tool Zod schemas exist for the bridge.** `apps/desktop/src/shared/palot-bridge-schemas.ts` is a 360-line Zod-validated tool surface: `sidePanelTabSchema` (`:24`), `browserActionErrorCodeSchema` (`:26`), `sessionBindingStatusSchema` (`:52`), `browserLaneHealthSchema` (`:80`), and a discriminated union over `kind` for `browserActionEventSchema` (`:152`). The bridge's tool call/return path is already structurally typed; what is missing is the typed *component* layer and the *event* layer above it.
- **Capability broker / trust model is real.** `apps/desktop/src/shared/firefly-plugin/capabilities.ts` (`lookupCapability`, `evaluateBrokerRequest`) and `apps/desktop/src/main/firefly-plugin/authority.ts` are Loom-shaped primitives already wired into the projection pipeline. This is the agent authority seam: it just needs to wrap the render/poll/patch loop.
- **`firefly-surface-registry.tsx` is a V1 Loom prototype in disguise.** It is fully data-driven: 18 entries with `id`, `title`, `icon`, `formFactor`, `enabledFlag.{key,atom}`, `defaultOn`, `availability(ctx)`, `commandIds[]`, `persistenceKey`, `telemetryNamespace`, `target`, `spawn(ctx)`. The projection in `shared/firefly-plugin/renderer-projection.ts:77–97` (`ProjectedSidePanel`) mirrors it field-for-field. The two layers are not yet unified (7 mirror lists of the same 18 ids — see `docs/firefly-surface-playbook.md:25–31` and the audit at the end of this doc) but the shape is correct.
- **The plugin bridge is testable and tool-agnostic.** `apps/desktop/src/main/palot-opencode-plugin-shim.ts:11` validates only module shape (`{id, server}`), and the bridge has its own `createBridgeClient` factory (`plugin.js:152–174`) that takes `fetchImpl` and `env` — already unit-testable without a live OpenCode.
- **The `palotSidePanelTabSchema` Zod enum is exactly the closed vocabulary Loom wants for the agent-tool surface.** `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts:21–40` is a 18-variant `z.enum`. The same 18 ids appear in `atoms/ui.ts:25–43`, in `palot-plugin/plugin.js:124–143`, and in the docs playbook.

## 3. The five gaps, with file:line anchors, ranked <!-- oc:id=sec_ae -->

### Gap 1 — No typed/introspectable component registry with exported schemas (HIGH) <!-- oc:id=sec_af -->

**Evidence.** `apps/desktop/src/renderer/genui/registry.ts:19–32` defines a hand-rolled `GenUiEntry<P>` with a `parseProps: (raw) => ParsePropsResult<P>` callable. There is no Zod schema per entry; the only Zod in the renderer GenUI flow is implicit (callable returns `{ok, props}` or `{ok:false, error}`). The agent cannot `describe <component>` because there is nothing to describe.

**Why it matters.** Loom's `components list` / `components describe <name>` discovery pattern requires an introspectable schema. Without it, the agent either guesses props (cost) or carries the full schema (MCP-style bloat). AXI's empirical case (185K tokens/task MCP vs 79K AXI) lands here.

**Risk if left unfixed.** Even the existing fence-render flow leaks: any new component must hand-author both a `parseProps` and an `example` (`genui/registry.ts:30–32`) in the same hand-roll style. Two components → 2 hand-rolled parsers; N components → N.

**Effort to close.** Small. Replace `parseProps: (raw) => Result<P>` with `propsSchema: ZodType<P>`, derive `parseProps` from `propsSchema.safeParse`, and add `events: Record<string, ZodType>` + `state: Record<string, ZodType>` placeholders (filled later by Gap 3). One file, one type change, no behavior change in v0. ~1 day.

### Gap 2 — No agent→UI patch/poll protocol (HIGH) <!-- oc:id=sec_ag -->

**Evidence.** `genui-renderer.tsx:148–184` produces `GenUiSegment[]` once per assistant text frame. There is no command that takes a TOON patch, no `rev` on a node, no `poll` long-poll. The artifact store (`genui-artifacts.ts`) has `upsertGenUiArtifactAtom` and `patchGenUiArtifactPropsAtom` but the *agent* never invokes them — only the local renderer does, on its own observation of new fences.

**Why it matters.** Loom's `render → poll → patch → poll → …` loop is the entire reason the agent can update a long-lived surface without re-emitting the whole fence. Without it, every update is a full assistant turn + re-render = a non-starter for "the agent leaves a decision card open while the human edits a notes field".

**Risk if left unfixed.** The dual-binding model (Gap 3) is impossible without a patch channel. The whole point of Loom — agent pushes deltas, human drives the surface — is absent.

**Effort to close.** Medium-large. The bridge already has a localhost HTTP server (`apps/desktop/src/main/palot-browser-ipc.ts:271`); adding a `POST /loom/{session,poll,patch,components,end}` namespace behind the same `env[BRIDGE_ENV_TOKEN]` is the smallest wire. The runtime needs an in-memory `rev`-stamped tree (one file, ~200 LoC). The renderer needs a `useLoomSession()` hook that subscribes to the tree and applies patches. Surface channel: WS (already an option) vs SSE+POST (proxy-friendlier). This is a wave-2/3 build, but the wire shape is dictated by Gap 1's registry.

### Gap 3 — No dual signal/state bindings declared per affordance (HIGH) <!-- oc:id=sec_ah -->

**Evidence.** `GenUiEntry` has no `events`, no `state`, no per-affordance binding class. `genui-renderer.tsx:190–280` (`GenUiBlockImpl`) dispatches a React component with validated props and stops. There is no path for the surface to emit an event back to the runtime, nor for a local state mutation to be reported as a delta.

**Why it matters.** This is the defensible idea. Without it, every interactive control is either a slow form (agent round-trip) or an invisible local mutation (no agent awareness). The "decision_card with locally-bound notes and a signal-bound submit" pattern from the Loom spec is impossible.

**Risk if left unfixed.** Even if Gap 2 lands, every control would be a signal — the UI feels like molasses. This is the gap that distinguishes Loom from every other approach.

**Effort to close.** Medium. Add `events: { name: ZodType }` and `state: { name: ZodType }` to the registry type (extending the Gap 1 change). The renderer becomes "given a binding, attach the right `onChange`/`onClick` handler that either mutates local state or queues an event". The runtime needs a `signal` queue and a `state` delta accumulator (per Loom §8). The event channel piggybacks on Gap 2's poll/patch loop.

### Gap 4 — Durable artifact identity is session-scoped + localStorage-only (MEDIUM) <!-- oc:id=sec_ai -->

**Evidence.** `apps/desktop/src/renderer/atoms/genui-artifacts.ts:40–43` (`sessionGenUiArtifactsStorageAtom = atomWithStorage<...>("elf:genui-artifacts", {})`) stores the whole artifact map under a single renderer localStorage key. `apps/desktop/src/renderer/atoms/genui-artifacts.ts:20–23` generates IDs as `artifact_<6-char-session>_<ts36>_<rand8>` — session-prefixed, never validated, never reused cross-session, never addressable by the agent. The only persistence file today is `~/.config/elf/opencode/session-bindings.json` (`apps/desktop/src/main/palot-session-binding.ts:131`).

**Why it matters.** Loom artifacts need a stable handle the agent can reference across turns: `poll` events carry `node: "<id>"`; the agent patches by `id`; the artifact persists past the chat turn that produced it. A `localStorage` key per session is the opposite of durable identity.

**Risk if left unfixed.** The agent can never "come back" to an artifact in a later session. Pinned artifacts cannot be re-shared. The Loom spec calls this out as a non-goal but palot's artifact design has it as an implicit promise ("durable references" in `docs/genui-artifact-architecture.md:178–204`).

**Effort to close.** Small at the schema level (`ArtifactId = "art_<ulid>"`, schema-versioned record), larger at the persistence layer (move store from `atomWithStorage` to main-process sqlite at `~/.local/share/elf/loom/<id>.json`, same XDG pattern as `automation/paths.ts`). Wave-1 = schema + id minting, wave-2/3 = persistence swap.

### Gap 5 — Streaming fence parsing is optimistic, not protocol-aware (LOW) <!-- oc:id=sec_aj -->

**Evidence.** `genui-renderer.tsx:14–15, 47–55, 78–91, 93–140` carries two regex fences (`GENUI_FENCE_RE`, `DAG_FENCE_RE`), a generic body parser (`parseFenceBody` at `:59–76`), a `inferPendingFrameProps` that hardcodes `name === "dag-sparkline"` (`:78–91`), and a `parsePendingGenUi` that has a dedicated ` ```dag ` start branch (`:107–125`). The legacy fence is the only component-aware code in an otherwise generic dispatcher.

**Why it matters.** This is the kind of thing that gets *more* tangled as components grow, not less. Adding a second legacy fence requires touching three sites. Adding a streaming `append` frame (one of Loom's open decisions, §12.5) requires a fourth.

**Risk if left unfixed.** Long-term maintenance hazard. Not a blocker for any single capability, but a tax on every new component.

**Effort to close.** Trivial. Lift the legacy mapping into `registry.ts` as a per-entry `legacyFences?: { fence: string, parseBody: (body) => unknown }[]`, generalize `inferPendingFrameProps` to look up the entry by name. The `append` frame decision (Loom §12.5) is orthogonal and should be resolved separately.

## 4. Cross-cutting risk: the 7 mirror lists <!-- oc:id=sec_ak -->

`firefly-surface-registry.tsx` is the *closest* the V1 side-panel gets to a Loom registry, but it is **fully hardcoded**, and the same 18 surface ids appear in at least 7 places. This is the single largest source of drift bug in the current system. Concretely:

1. `firefly-surface-registry.tsx:94–459` (id + title + icon + spawn). <!-- oc:id=item_af -->
1. `atoms/feature-flags.ts:26–180` (storage key + default + toggle atom + label). <!-- oc:id=item_ag -->
1. `atoms/ui.ts:25–43` (closed `SidePanelTabId` union). <!-- oc:id=item_ah -->
1. `components/agent-detail.tsx:27–44, 220–285` (17 hand-rolled `useAtomValue` reads + flags object literal). <!-- oc:id=item_ai -->
1. `components/command-palette.tsx:53–86, 142–172, 460–648` (17 hand-rolled `<CommandItem>` blocks for the Features group). <!-- oc:id=item_aj -->
1. `shared/firefly-plugin/palot-bridge-manifest.ts:21–40` (`palotSidePanelTabSchema`). <!-- oc:id=item_ak -->
1. `main/palot-plugin/plugin.js:124–143` (`VALID_SIDE_PANEL_TABS` plain-JS list — the validation boundary for `open_side_panel`). <!-- oc:id=item_al -->

The palot-bridge plugin is the **worst offender**: if a new tab is added to `firefly-surface-registry.tsx` but not to `VALID_SIDE_PANEL_TABS`, the agent gets `Invalid side panel tab. Expected one of: …` — a real footgun. The audit at the end of this doc (Appendix A) lists every place. **The Loom migration must collapse these to a single source of truth as a wave-0 prerequisite**, before any protocol work begins.

## 5. Firefly/ELF plugins + OpenCode fork alignment <!-- oc:id=sec_al -->

The Loom spec calls this out explicitly (§6 "Firefly tie-in", §11 "OpenCode fork"):

- **Firefly plugins.** `apps/desktop/src/shared/firefly-plugin/manifest.ts:357–421` is already the artifact Loom needs — a Zod-validated plugin manifest with `contributes: {panels, widgets, commands, themes, tools}`. The migration adds a `components` family to the same `contributes` block, sharing the same `id`/`version`/`trust`/`capabilities` envelope. The V1 GenUI registry becomes "the list of built-in V2 component contributions" with no loss of capability.
- **OpenCode fork.** palot controls the SessionStart hook surface via `OPENCODE_PLUGIN` env injection (`apps/desktop/src/main/opencode-manager.ts:414, 422, 466`). The same hook is where Loom *core* lives (Loom spec §11: "Loom core = SessionStart hook, always on. Component packs = skills/plugins, lazy."). Concretely: the `palot-bridge` plugin is the Loom core. The `palotSidePanelTabSchema`/bridge tools are the first component pack. Future packs register via the V2 manifest; the hook stays the same.

**palot is the first concrete target, but the artifact (the V2 manifest with a `components` family) is the cross-project deliverable.** The Firefly and OpenCode fork teams consume the same manifest shape; the only thing that differs is the runtime.

## 6. What this plan converges palot toward (preview of the implementation plan) <!-- oc:id=sec_am -->

1. **Wave 0 (pre-flight):** collapse the 7 mirror lists to one. Built-in panels are entries in a unified `SurfaceContribution` table derived from the V2 manifest. The `palot-bridge` plugin's `VALID_SIDE_PANEL_TABS` becomes a derived list. The `SidePanelTabId` union becomes derived. Net change: zero behavior, less code. <!-- oc:id=item_am -->
1. **Wave 1 (typed registry):** Zod-validate every `GenUiEntry`. Add `events: {name: ZodType}` + `state: {name: ZodType}` declarations. Expose `components list` / `components describe <name>` through the bridge. No transport change. Net change: agent can introspect components, but the wire is still fence-based. <!-- oc:id=item_an -->
1. **Wave 2 (the wire):** introduce the Loom wire (TOON on the agent boundary, JSON over a localhost socket to the surface). `render` / `poll` / `patch` / `session` lifecycle commands. `rev`-stamped tree in the runtime. Renderer subscribes to patches. Pinned to `127.0.0.1` (Electron main) for the v0. <!-- oc:id=item_ao -->
1. **Wave 3 (the binding model):** per-affordance `signal` vs `state`. The renderer treats each declared binding as either an optimistic local mutation (state) or a queued event (signal). The agent's `poll` returns both. Dirty-field protection on agent patches to dirty fields. <!-- oc:id=item_ap -->
1. **Wave 4 (durable identity + persistence):** move the artifact store from `atomWithStorage` to main-process sqlite at `~/.local/share/elf/loom/`. Schema-versioned `ArtifactId`. Cross-session pinning. <!-- oc:id=item_aq -->
1. **Wave 5 (declarative tools + everything else):** add a `ToolRendererContribution` table (collapse `chat-tool-call.tsx`'s 6 switch statements). Add the `append` frame if decided. Wire the V2 plugin commands into the command palette automatically. <!-- oc:id=item_ar -->

Each wave is small enough to ship behind a feature flag and a single test pass.

## 7. Open decisions to resolve *before* writing runtime code <!-- oc:id=sec_an -->

From Loom spec §12 and the design review summary:

1. **Transport to surface (WS vs SSE+POST).** Lean WS for the Electron-v0 (full duplex, presence later), SSE+POST as a fallback for pure-web future. **Decide in wave 2.** <!-- oc:id=item_as -->
1. **Streaming `append` frame.** Decide whether the agent can grow a node's content token-by-token without a patch per token. If yes, add `append` as a frame. **Decide in wave 2.** <!-- oc:id=item_at -->
1. **Patch addressing (JSON Pointer vs node-id+field).** Spec leans node-id. **Decide in wave 2.** <!-- oc:id=item_au -->
1. **Event batching window.** Spec suggests ~250ms coalescing for `state` deltas before poll-visible. **Decide in wave 2.** <!-- oc:id=item_av -->
1. **Component versioning mid-session.** Spec suggests version-pin per session. **Decide in wave 1.** <!-- oc:id=item_aw -->
1. **TOON for the surface channel too?** Currently no. **Defer until v0 ships.** <!-- oc:id=item_ax -->

The two "decide first" items in the spec are transport and the `append` frame. Both are wave-2 decisions; wave 1 can land without them.

## 8. Risks and what would derail the plan <!-- oc:id=sec_ao -->

- **V1/V2 unification is a prerequisite, not a wave-1 step.** If the 7 mirror lists are not collapsed first, every new component doubles the surface area for drift. Wave 0 is non-negotiable.
- **The `palot-bridge` plugin (`plugin.js`) is plain JS, not TS.** It is the path the agent currently uses; it is the path the OpenCode fork is forking from. Converting it to TS is a separate workstream (V2 already has the TS exemplar at `palot-bridge-manifest.ts`). Wave 2's TOON wire must work through the existing JS plugin loader or the migration breaks the agent-side path.
- **The V2 manifest lives in `shared/`, not `renderer/`.** GenUI components render in the renderer. A `components` family that points at a renderer-only file path will fail the V2 IPC contract, which is shared. Wave 1 must decide whether components ship as `renderer: { kind: "host-reconciler", id }` (host looks up a built-in component) or as a generic `iframe`/`declarative-props` payload. Spec leans host-reconciler.
- **The renderer's localStorage artifact store is renderer-only.** A `loom-artifact` sqlite path in main process is the right durable store, but it requires a new IPC channel and a migration step that preserves existing localStorage entries on first boot. Plan for that.
- **The OpenCode plugin runtime may impose constraints we have not hit yet.** `palot-opencode-plugin-shim.ts:11` validates only `{id, server}`; we do not currently test the plugin under a hostile hook surface. The Loom `poll` long-poll may exceed OpenCode's tool-call timeout for some sessions. Validate early.
- **`chat-tool-call.tsx` is 1318 lines of switch statements.** Wave 5's tool-renderer unification is a big surface. Don't try to land it in the same wave as the wire. Plan for it as a dedicated wave *after* Loom is in production.

## 9. Verdict <!-- oc:id=sec_ap -->

palot's current GenUI/plugin architecture is **in the same family as Loom** but **does not yet deliver** any of the five load-bearing Loom behaviors. The good news: 60–70% of the substrate is already correct (V2 manifest, capability broker, allowlisted renderer, derived prompt catalog, Zod-validated bridge schemas, localhost bridge transport), and the gaps are localized enough that each one can be closed in a single wave. The bad news: the surface that looks most Loom-shaped today (`firefly-surface-registry.tsx`) is held together by 7 mirror lists that are the largest source of drift bug in the system; that must be unified first.

**Recommended first dispatch:** wave 0 (collapse the 7 mirror lists) + wave 1 (typed Zod GenUI registry with `list`/`describe`). Both are small, both are provable, neither touches transport. Together they unlock 4 of the 5 gaps and make wave 2's wire work a pure add.

## Appendix A — the 7 mirror lists (consolidated, wave-0 prerequisite) <!-- oc:id=sec_aq -->

The same 18 side-panel surface ids appear in:

| # | File | Line | Role |
|---|---|---|---|
| 1 | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | 94–459 | id + title + icon + spawn |
| 2 | `apps/desktop/src/renderer/atoms/feature-flags.ts` | 26–180 | storage key + default + toggle atom + label |
| 3 | `apps/desktop/src/renderer/atoms/ui.ts` | 25–43 | closed `SidePanelTabId` union |
| 4 | `apps/desktop/src/renderer/components/agent-detail.tsx` | 27–44, 220–285 | 17 hand-rolled `useAtomValue` reads + flags object literal |
| 5 | `apps/desktop/src/renderer/components/command-palette.tsx` | 53–86, 142–172, 460–648 | 17 hand-rolled `<CommandItem>` blocks (Features group) |
| 6 | `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts` | 21–40 | `palotSidePanelTabSchema` Zod enum |
| 7 | `apps/desktop/src/main/palot-plugin/plugin.js` | 124–143 | `VALID_SIDE_PANEL_TABS` plain-JS list (validation boundary) |

Plus the docs onboarding ritual: `docs/firefly-surface-playbook.md:25–31` walks through every step of the above.

**Convergence target:** one `SurfaceContribution` table (V2 manifest `panels` family extended with `component: {kind: "host-reconciler", id}`). All 7 lists derive from it. The audit in `docs/firefly-surface-playbook.md` shrinks to "add a manifest entry".

## Appendix C — extra findings from the recovered architecture map

The original architecture scout subagent's full output was lost to an
OMO background-output recovery bug. The full map was salvaged to
`/tmp/palot-genui-architecture-map.recovered.md` and folded into this
addendum. The findings below are facts the first pass did not catch.

### C.1 `ensurePalotBridgeServer` is missing from the current source

- `apps/desktop/src/main/opencode-manager.ts:15` imports
  `ensurePalotBridgeServer` from `./palot-browser-ipc`.
- The current `palot-browser-ipc.ts` is 200 lines and does **not**
  export that symbol. The `out/main/index.js` build artifact has it
  (compiled from a different tree) at `out/main/index.js:7388`.
- Consequence: in the current source, the V1 plugin's
  `createBridgeClient` returns null and falls through to the
  queued / permission-denied envelopes (`plugin.js:215–265, 224–230`).
  Live standalone transport is not actually working on `main` right
  now — it is shipping a degraded path. This is a **pre-Loom bug**
  worth flagging to the PM; wave 2 (the wire) and wave 5 (durable
  identity) both depend on the bridge transport being live.

### C.2 `genui-artifact-context.ts` is dead code

- `apps/desktop/src/renderer/atoms/genui-artifact-context.ts` (24 LOC)
  exports `sessionArtifactPromptContextFamily` and
  `markArtifactPromptContextInjectedAtom`.
- Neither is imported anywhere in the source tree.
- The real artifact-prompt-context builder lives inline at
  `apps/desktop/src/renderer/atoms/chat.ts:95–111`
  (`buildArtifactPromptContext`).
- Action: delete the dead file as part of wave 0 or wave 1. Cheap,
  reversible, reduces confusion.

### C.3 Discovery tools are stubbed fixtures

- `apps/desktop/src/main/palot-plugin/plugin.js:301–379` ships
  `search_tools`, `describe_tool`, `call_tool`, and `tools_status` as
  hand-rolled fixtures.
- They do **not** consult the real MCP runtime
  (`apps/desktop/src/main/mcp-connections-runtime.ts`, 1.1K LOC).
- This is a palot-internal bug, not a Loom gap, but it is the right
  place to look when wave 1's `palot_components_describe` lands —
  the new tool should not collide with the existing stub.

### C.4 `appendPalotPlugin` does not consult the V2 catalog

- `apps/desktop/src/main/opencode-manager.ts:604–615` only wires the
  V1 plugin and the V1 bridge env vars.
- The V2 `buildPluginCatalog` returns descriptors with
  `bridge.systemContextBlock`, but the spawn-env path does not read
  it.
- This is the "V2 designed but not wired" gotcha. Wave 6 (V2
  `contributes.components`) is the moment this gets fixed.

### C.5 `genui-artifact-prop-actions.tsx` is DAG-specific

- The single shipped prop patch (`Tweak` →
  `{ showLabels: true, animate: "flow" }`) is hardcoded for
  `dag-sparkline` (`components/genui/genui-artifact-prop-actions.tsx:18–20`).
- A real Loom-style artifact system would let each component
  declare its own prop patch UI in its registry entry.
- Action: generalize as part of wave 3 (dual bindings). The
  `decision_card`'s `state` binding carries a real prop patch
  pattern (the `notes` textarea). Use that as the template.

### C.6 `GenUiArtifactPlacement` includes an invalid V2 zone

- `GenUiArtifactPlacement = "inline" | "above-chat" | "chat-inline-right" | "side-panel"`
  (`apps/desktop/src/renderer/lib/types.ts:140–175`).
- `side-panel` is a V2 panel **slot**, not a widget **zone**. The
  V2 host widget-zone vocabulary is closed: `["above-chat",
  "chat-inline-right"]`
  (`apps/desktop/src/shared/firefly-plugin/descriptor.ts:33–40`).
- Action: rename the renderer placement to `side-panel-slot` or
  collapse it out. Wave 6 (V2 `contributes.components`) is the
  moment this gets cleaned up.

### C.7 Three more dead code / drift sites worth flagging

- `apps/desktop/src/renderer/atoms/chat.ts:68–70`
  (`PLAN_MODE_DAG_NUDGE`) hardcodes a specific GenUI component in
  plan mode. Loom would want plan mode to be a plugin contribution
  (`plan-mode` activation event) or a tool UI hint, not a renderer
  constant. Fix in wave 6 or a follow-up.
- `apps/desktop/src/renderer/atoms/genui-artifacts.ts` exposes `pin`,
  `patch`, `upsert` but **no `remove` atom**. Wave 4's conflict
  resolution needs `remove`; add it as part of wave 4.
- The persisted session-binding JSON
  (`~/.config/elf/opencode/session-bindings.json`) has no `scope`
  field, but V2 `ToolContribution.scope` is `session | project |
  app` (`manifest.ts:314`). Wave 5's persistence layer should
  add `scope` to the binding record.

### C.8 Bridge server is the load-bearing missing piece

The plan's wave-2 prompt assumes the localhost bridge is alive. The
recovered map says it is **not alive on `main` today** — the import
in `opencode-manager.ts:15` references a symbol that does not exist
in the current source. Wave 2 should explicitly include a
"reintroduce or replace the bridge server" step before the runtime
work begins. This is a 1-day fix in `palot-browser-ipc.ts` and is
a hard prerequisite for the wire.

## Appendix B — file:line index of Loom-relevant code in palot <!-- oc:id=sec_ar -->

| Concern | File | Lines |
|---|---|---|
| GenUI registry | `apps/desktop/src/renderer/genui/registry.ts` | 1–94 |
| Fence parser + dispatcher | `apps/desktop/src/renderer/genui/genui-renderer.tsx` | 1–403 |
| Artifact atoms | `apps/desktop/src/renderer/atoms/genui-artifacts.ts` | 1–227 |
| GenUI types | `apps/desktop/src/renderer/lib/types.ts` | `GenUiArtifact*` |
| V2 manifest schema | `apps/desktop/src/shared/firefly-plugin/manifest.ts` | 183–553 |
| V2 family contracts | `apps/desktop/src/shared/firefly-plugin/family-contracts.ts` | 160–333 |
| V2 descriptor + normalizer | `apps/desktop/src/shared/firefly-plugin/descriptor.ts` | 33–171 |
| V2 renderer projection | `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts` | 13–567 |
| V2 command projection | `apps/desktop/src/shared/firefly-plugin/command-projection.ts` | 96–274 |
| V2 bridge projection | `apps/desktop/src/shared/firefly-plugin/bridge-projection.ts` | 9–312 |
| V2 capability broker | `apps/desktop/src/shared/firefly-plugin/capabilities.ts` | full file |
| V2 main catalog | `apps/desktop/src/main/firefly-plugin/catalog.ts` | 65–258 |
| V2 main IPC | `apps/desktop/src/main/firefly-plugin/ipc.ts` | 30–183 |
| V2 renderer hook | `apps/desktop/src/renderer/hooks/use-firefly-plugins.ts` | 99–145 |
| Bridge plugin (JS) | `apps/desktop/src/main/palot-plugin/plugin.js` | 1–484 |
| Bridge schemas (Zod) | `apps/desktop/src/shared/palot-bridge-schemas.ts` | 1–360 |
| Bridge plugin shim | `apps/desktop/src/main/palot-opencode-plugin-shim.ts` | 1–25 |
| Bridge HTTP transport | `apps/desktop/src/main/palot-browser-ipc.ts` | 1–~300 |
| Session binding store | `apps/desktop/src/main/palot-session-binding.ts` | 1–~200 |
| Plugin env injection | `apps/desktop/src/main/opencode-manager.ts` | 414, 422, 466 |
| Firefly surface registry (V1) | `apps/desktop/src/renderer/firefly-surface-registry.tsx` | 1–484 |
| Session widget registry | `apps/desktop/src/renderer/session-widget-registry.tsx` | 1–35 |
| Session widget atoms | `apps/desktop/src/renderer/atoms/session-widgets.ts` | 1–~200 |
| Tool-call dispatcher (hardcoded) | `apps/desktop/src/renderer/components/chat/chat-tool-call.tsx` | 1–1318 (6 switches) |
| Sidebar section ids (closed) | `apps/desktop/src/renderer/atoms/ui.ts` | 10–43 |
| Firefly surface playbook (docs) | `docs/firefly-surface-playbook.md` | 1–~120 |
| GenUI artifact architecture (docs) | `docs/genui-artifact-architecture.md` | 1–465 |
| Bridge plugin doc | `docs/palot-opencode-plugin-bridge.md` | 1–531 |