# Wave 6 — `contributes.components` in the V2 plugin manifest (Loom §3, §6) <!-- oc:id=sec_aa -->

> **Status:** ready to dispatch (after wave 5 ships + dogfood).
> **Plan section:** `.sisyphus/plans/loom-implementation-plan.md` §3 Phase 6.
> **Assessment anchor:** `.sisyphus/plans/loom-alignment-assessment.md` §4.4
> (Firefly/ELF plugin tie-in), §4.5 (OpenCode fork tie-in), Gap 1.2
> (plugin manifest = component contract).
> **Goal:** the plugin manifest **is** the component contract. A
> third-party plugin can contribute a Loom component with a Zod
> schema, an example, and declared bindings. The GenUI registry
> becomes the list of *built-in* V2 component contributions.

## Context <!-- oc:id=sec_ab -->

Waves 1–5 delivered the Loom runtime, the wire, the binding model,
conflict protection, and durable identity. The V2 plugin manifest
(`apps/desktop/src/shared/firefly-plugin/manifest.ts:357–421`) is
already the right artifact — it just doesn't know about Loom
components yet. This wave:

1. Adds a new `contributes.components` family to the V2 manifest. <!-- oc:id=item_aa -->
1. Promotes the GenUI registry to a list of *built-in* V2 component <!-- oc:id=item_ab -->
   contributions.
1. Demonstrates a third-party contribution with a real manifest <!-- oc:id=item_ac -->
   (an `acme` exemplar).
1. Closes the Firefly/ELF and OpenCode-fork loops: the manifest <!-- oc:id=item_ad -->
   shape is the contract those teams consume.

This is the wave that turns palot from "Loom is here" to "Loom is
the plugin system."

## Touched files <!-- oc:id=sec_ac -->

### New <!-- oc:id=sec_ad -->

- `apps/desktop/src/shared/firefly-plugin/component-zod.ts` — tiny
  helper to convert a Zod schema to a minimal JSON-Schema-ish
  summary for the agent's prompt-context injection (smallest-schema-
  first).
- `apps/desktop/src/renderer/components/loom/component-mount.tsx` —
  host reconciler: looks up a `Component` by id from the registry +
  projection. Mounts the rendered React component for a given
  `ProjectedComponent`.
- `apps/desktop/src/shared/firefly-plugin/exemplars/acme-components-exemplar.ts` —
  third-party manifest declaring a `contributes.components` entry.
  Trust: `signed-third-party`.

### Changed <!-- oc:id=sec_ae -->

- `apps/desktop/src/shared/firefly-plugin/manifest.ts:357–421` —
  add `contributes.components` family. Zod schema:
  ```ts
  {
    id: string,                              // canonical name
    apiVersion: number,                      // contract version
    category: "diagram" | "decision" | "form" | "viewer" | "layout" | "custom",
    props: z.ZodTypeAny,                     // prop contract
    events: { [name]: z.ZodTypeAny },        // signal bindings
    state:  { [name]: z.ZodTypeAny },        // local bindings
    supports_append: boolean,                // wave 5
    example: { component: string, props: unknown },
    capabilityGates: string[],
    hostVocabulary: { slots: string[], zones: string[] },
    conflictPolicy: "agent-wins" | "human-wins" | "merge" | "ask", // default "ask"
  }
  ```
- `apps/desktop/src/shared/firefly-plugin/family-contracts.ts` —
  add `COMPONENT_CONTRACT` mirroring `PANEL_CONTRACT` /
  `WIDGET_CONTRACT`.
- `apps/desktop/src/shared/firefly-plugin/descriptor.ts` — extend
  `derivePluginDescriptor` to normalize `components`.
- `apps/desktop/src/shared/firefly-plugin/renderer-projection.ts` —
  add `ProjectedComponent` and `projectComponentsFromCatalog`.
- `apps/desktop/src/main/firefly-plugin/catalog.ts:65–223` — wire
  components into `buildPluginCatalog`.
- `apps/desktop/src/renderer/hooks/use-firefly-plugins.ts` — expose
  `useFireflyPluginComponents`, mirroring
  `useFireflyPluginTools`.
- `apps/desktop/src/renderer/genui/registry.ts` — the existing
  GenUI entries become *built-in* V2 component contributions
  (`BUILT_IN_COMPONENTS: ComponentContribution[]`).
- `apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts` —
  the bridge manifest registers the built-in `decision_card` and
  `dag-sparkline` as first-party component contributions.

## Required tools <!-- oc:id=sec_af -->

- All standard.
- `bun test`.
- `bun run dev` (devmux) for live dogfood.

## Must do <!-- oc:id=sec_ag -->

1. Define the Zod schema for `contributes.components` in <!-- oc:id=item_ae -->
   `manifest.ts`. Add `COMPONENT_CONTRACT` in `family-contracts.ts`.
1. Extend `derivePluginDescriptor` to normalize `components`. <!-- oc:id=item_af -->
1. Add `ProjectedComponent` and `projectComponentsFromCatalog` in <!-- oc:id=item_ag -->
   `renderer-projection.ts`. Mirror the `ProjectedSidePanel` shape.
1. Add `useFireflyPluginComponents` in <!-- oc:id=item_ah -->
   `hooks/use-firefly-plugins.ts:99–145`. Returns the projected
   components grouped by plugin.
1. The renderer mounts contributed components via <!-- oc:id=item_ai -->
   `component-mount.tsx`. The mount looks up the registered React
   component by `id`. The lookup is from the GenUI registry
   (built-in) + the projection (third-party).
1. Migrate the existing `GenUiEntry[]` to be the source for <!-- oc:id=item_aj -->
   built-in contributions. The registry entries are wrapped in the
   V2 contribution shape and surfaced via the V2 catalog.
1. Add a real third-party exemplar <!-- oc:id=item_ak -->
   (`acme-components-exemplar.ts`) that contributes one component
   (`acme.loyalty_progress_bar`). The exemplar declares a Zod
   schema, an example, and `capabilityGates: ["acme:read"]`.
1. The host reconciler mounts the contributed component when its <!-- oc:id=item_al -->
   id appears in an active Loom session tree. The component is
   behind a feature flag (`loom.v2.acmeComponents`).
1. Tests: <!-- oc:id=item_am -->
   - `apps/desktop/src/shared/firefly-plugin/renderer-projection.test.ts`
     (extend coverage) — `projectComponentsFromCatalog` produces
     the expected rows.
   - `apps/desktop/src/main/firefly-plugin/catalog.test.ts` — the
     built-in manifests validate; the exemplar validates.
   - A smoke test that mounts the `acme.loyalty_progress_bar`
     component in a Loom session tree.

## Must NOT do <!-- oc:id=sec_ah -->

- No new transport.
- No new components other than the existing `dag-sparkline` +
  `decision_card` (built-ins) and the `acme.loyalty_progress_bar`
  (exemplar).
- No FFI to OpenCode fork; the SessionStart hook is a separate
  task in the OpenCode fork repo, not palot.
- Do not break the existing `palot-bridge-manifest.ts`'s
  `palotSidePanelTabSchema`. It is wave 0's contract; this wave
  adds `contributes.components` alongside it, not in place of it.

## Proof criteria <!-- oc:id=sec_ai -->

1. `bun run check-types` clean. <!-- oc:id=item_an -->
1. `bun run lint` clean. <!-- oc:id=item_ao -->
1. The V2 manifest `BUILT_IN_MANIFESTS` accepts the <!-- oc:id=item_ap -->
   `palot-bridge-manifest` (with the new `components` family) and
   the `acme-components-exemplar`.
1. The renderer mounts the contributed `acme.loyalty_progress_bar` <!-- oc:id=item_aq -->
   when the feature flag is on and a Loom session tree references
   its id.
1. The `palot_components_list` tool (from wave 1) now returns the <!-- oc:id=item_ar -->
   union of built-in + contributed components.
1. The existing fence path still works. `dag-sparkline` rendered <!-- oc:id=item_as -->
   via a chat fence still appears.
1. The cross-project contract is documented in <!-- oc:id=item_at -->
   `apps/desktop/src/shared/firefly-plugin/COMPONENT_CONTRACT.md`
   (NEW). The Firefly/ELF and OpenCode-fork teams can consume this
   doc.

## Risk <!-- oc:id=sec_aj -->

- Medium. The V2 manifest is the contract surface for
  cross-project work. Mitigations:
  - The `contributes.components` family is additive; existing
    `panels`, `widgets`, `commands`, `themes`, `tools` families are
    unchanged.
  - The exemplar is gated by a feature flag; the default is off.
  - Tests cover the existing manifest's continued validity.
- Failure mode: a third-party manifest's `props` Zod schema rejects
  valid fences. The host reconciler surfaces a structured error on
  the runtime, not a crash.

## Out of scope (for later waves / projects) <!-- oc:id=sec_ak -->

- Wave 7: tool-renderer consolidation (deferred).
- Multi-human CRDT (v2, post-Loom).
- Firefly/ELF conformance: separate repo work; the
  `COMPONENT_CONTRACT.md` is the contract.
- OpenCode fork SessionStart hook: separate repo work.

## Definition of done <!-- oc:id=sec_al -->

- All proof criteria pass.
- `.sisyphus/plans/loom-progress.md` is updated with `Wave 6: complete (date)`.
- A changeset (`bun changeset`) is added.
- A PR is opened; description cites this prompt + the plan section.
- Manual dogfood: a real OpenCode session renders a
  `acme.loyalty_progress_bar` end-to-end. If green, the wave
  ships behind the feature flag.
- A follow-up note in `.sisyphus/plans/loom-progress.md` flags the
  Firefly/ELF and OpenCode-fork work as ready to dispatch.