# Wave 1 — Typed Zod GenUI registry + `list` / `describe` discovery <!-- oc:id=sec_aa -->

> **Status:** ready to dispatch.
> **Plan section:** `.sisyphus/plans/loom-implementation-plan.md` §3 Phase 1.
> **Assessment anchor:** `.sisyphus/plans/loom-alignment-assessment.md` §3 Gap 1.
> **Goal:** every registered GenUI component is described by a Zod schema. The
> agent can call `palot components list` and `palot components describe <name>`
> through the existing bridge plugin. No transport change. No patch/poll yet.
> Smallest Loom-shaped win. **First Loom wave** to dispatch.

## Context (for the worker) <!-- oc:id=sec_ab -->

The GenUI registry at `apps/desktop/src/renderer/genui/registry.ts:19–32` is
hand-rolled. Each entry has a `parseProps: (raw) => Result<P>` that re-implements
Zod validation by hand. The model cannot `describe` a component because there is
no machine-checkable schema. This wave:

1. Replaces `parseProps` with a Zod schema. <!-- oc:id=item_aa -->
1. Adds `events` and `state` declaration slots (declared, unused until Wave 3). <!-- oc:id=item_ab -->
1. Exposes two new bridge tools: `palot components list` and `palot components describe <name>`. TOON output. Smallest-schema-first. <!-- oc:id=item_ac -->
1. Lifts the ` ```dag ` legacy fence shortcut into the registry as a per-entry `legacyFences?` declaration. <!-- oc:id=item_ad -->

This is the smallest Loom-shaped win: the agent becomes introspectable, the
registry discipline is established, the bridge CLI gains two tools, no
transport changes, no new wire protocol, no behavior change in the renderer.

## Why this is the right first Loom wave <!-- oc:id=sec_ac -->

- 60–70% of the substrate is already correct (V2 manifest, capability broker, allowlisted renderer, derived prompt catalog, Zod-validated bridge schemas, localhost bridge transport).
- The two new tools are additive to the existing 11 bridge tools. The agent's surface grows from 11 → 13.
- The new tools share the same `palot-browser-ipc.ts:271` route shape as the existing 4 actions. No new transport.
- TOON is the only new wire concern. Land a minimal `toon.ts` in this wave and grow it in Wave 2.
- Reversible: the new tools are gated by a `loom.componentsList` feature flag.

## Touched files <!-- oc:id=sec_ad -->

- `apps/desktop/src/renderer/genui/registry.ts:19–32, 78–93` — replace `parseProps` with `props: z.ZodTypeAny`. Add `events`, `state`, `legacyFences?` slots. `buildGenUiCatalog()` regenerates from typed entries.
- `apps/desktop/src/renderer/genui/components/dag-sparkline.tsx` — declare props as a Zod schema; remove hand-rolled parsing.
- `apps/desktop/src/renderer/genui/genui-renderer.tsx:190–280` — call site for `parseProps` switches to `props.safeParse`.
- `apps/desktop/src/renderer/genui/genui-renderer.tsx:14–15, 47–55, 78–91, 93–140` — lift the `dag` legacy shortcut into the registry as `legacyFences?: { fence: string, parseBody: (body) => unknown }[]`. Generalize `inferPendingFrameProps` to look up by entry.
- `apps/desktop/src/main/palot-runtime/toon.ts` (NEW) — minimal TOON encode/decode. Scope: primitives, arrays, tabular forms per <https://axi.md/>. ~80 LoC.
- `apps/desktop/src/main/palot-plugin/plugin.js:1–484` — add `palot components list` and `palot components describe <name>` tools. Follow the shape of `search_tools` / `describe_tool` at `:35`. Output TOON.
- `apps/desktop/src/shared/palot-bridge-schemas.ts` — add Zod args/results for the two new tools.
- `apps/desktop/src/main/palot-browser-ipc.ts:271` — add routes for the two new tools.
- `apps/desktop/src/renderer/atoms/feature-flags.ts` — add `loom.componentsList` family flag.
- New: `apps/desktop/src/main/palot-runtime/__tests__/toon.test.ts`
- New: `apps/desktop/src/renderer/genui/__tests__/registry-zod.test.ts`
- New: `apps/desktop/src/main/palot-plugin/__tests__/component-discovery.test.ts`

## Required tools <!-- oc:id=sec_ae -->

- `edit`, `write`, `read`
- `bun run check-types`, `bun run lint`
- `bun test`
- `git grep` to assert `dag` legacy shortcut is centralized

## Must do <!-- oc:id=sec_af -->

1. The new `GenUiEntry` type has `props: z.ZodTypeAny` (replaces `parseProps`). `parseProps` becomes a derived method: `(raw) => props.safeParse(raw)`. <!-- oc:id=item_ae -->
1. `events: { [name: string]: z.ZodTypeAny }` and `state: { [name: string]: z.ZodTypeAny }` are declared, default to `{}`, are **required** in the type (TS error if missing). <!-- oc:id=item_af -->
1. `legacyFences?: { fence: string, parseBody: (body: string) => unknown }[]` is declared on the entry. The `dag` legacy fence moves from `genui-renderer.tsx:14–15, 47–55, 107–125` into `DagSparklineEntry.legacyFences`. <!-- oc:id=item_ag -->
1. The `genui-renderer.tsx` parser iterates entries for legacy fences, not a hardcoded `DAG_FENCE_RE`. <!-- oc:id=item_ah -->
1. `inferPendingFrameProps` is generic: it looks up the entry by name, not a hardcoded `name === "dag-sparkline"` branch. <!-- oc:id=item_ai -->
1. `palot components list` returns TOON: `count: N\ncomponents[N]{name,one_line,category}:\n  ...`. Per AXI principle 2: 3–4 fields per item. <!-- oc:id=item_aj -->
1. `palot components describe <name>` returns TOON: full Zod schema + one example + capability gates. For unknown names, returns structured error: `errorCode: "unknown_component"`. <!-- oc:id=item_ak -->
1. `palot components list --category <cat>` filters. `palot components describe <name> --full` returns the full schema (default is the schema's shape summary; `--full` is the verbose escape). <!-- oc:id=item_al -->
1. TOON output follows the AXI spec exactly: `name[count]{cols}:` tabular form for uniform collections; indented `key: value` for scalars and non-uniform objects. <!-- oc:id=item_am -->
1. Two new tests: `toon.test.ts` round-trips the spec example; `component-discovery.test.ts` asserts the `list` tool returns exactly the registered entries and `describe` returns the full schema (round-tripable through Zod) for `dag-sparkline`. <!-- oc:id=item_an -->
1. The feature flag `loom.componentsList` (default ON) gates the new tools. Setting it OFF in the system prompt hides the tool description from the agent. <!-- oc:id=item_ao -->

## Must NOT do <!-- oc:id=sec_ag -->

- No new transport, no WS, no new wire protocol.
- No patch/poll/render yet. The two new tools are standalone.
- No `state` mutations yet. `events` and `state` are declared but unused.
- No `append` frame.
- No changes to `palot-browser-ipc.ts` outside the two new routes.
- No changes to `feature-flags.ts` outside the one new flag.
- No persistence changes.

## Proof criteria <!-- oc:id=sec_ah -->

1. `palot components list` returns TOON, smallest-schema. Output matches the spec's `list` shape (e.g. `components[1]{name,one_line,category}: dag-sparkline,Render DAG with node + edge props,diagram`). <!-- oc:id=item_ap -->
1. `palot components describe dag-sparkline` returns TOON, full Zod schema. Round-trip through `zod.toJSONSchema()` (or equivalent) recovers the same schema. <!-- oc:id=item_aq -->
1. `palot components describe unknown` returns TOON with `errorCode: "unknown_component"` and an actionable `help[]` line: `Run \`palot components list\` to see available components.` <!-- oc:id=item_ar -->
1. `dag-sparkline` renders identically with the new schema path. Regression test in `apps/desktop/src/renderer/genui/`. <!-- oc:id=item_as -->
1. System prompt size **decreases** for sessions that do not use GenUI components (smallest-schema-first; no schema in the prompt). <!-- oc:id=item_at -->
1. `bun run check-types` clean. <!-- oc:id=item_au -->
1. `bun run lint` clean. <!-- oc:id=item_av -->
1. All new tests pass. <!-- oc:id=item_aw -->

## Open decisions enforced here <!-- oc:id=sec_ai -->

- D5 (component versioning): the manifest gains `apiVersion` (introduced in Wave 6); for this wave, hardcode `apiVersion: 1` in `DagSparklineEntry`.

## Risk <!-- oc:id=sec_aj -->

- Low. Additive. Two new tools, one new type field, no behavior change.
- Failure mode: TOON spec violations in the output. `toon.test.ts` catches this.
- Failure mode: legacy fence moved but the parser still hardcodes `dag` somewhere. New test in `registry-zod.test.ts` iterates every entry and asserts the parser can handle it.

## Out of scope (for later waves) <!-- oc:id=sec_ak -->

- Wave 2 (`render` / `patch` / `poll`).
- Wave 3 (signal/state bindings actually wired).
- Wave 4 (rev + dirty-field).
- Wave 5 (artifact persistence + `append`).
- Wave 6 (`contributes.components` in V2 manifest).

## Definition of done <!-- oc:id=sec_al -->

- All proof criteria pass.
- `.sisyphus/plans/loom-progress.md` is updated with `Wave 1: complete (date)`.
- A changeset (`bun changeset`) is added.
- A PR is opened; description cites this prompt + the plan section.