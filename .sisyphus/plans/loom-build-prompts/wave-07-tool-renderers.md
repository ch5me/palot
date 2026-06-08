# Wave 6 — Tool-renderer consolidation (post-Loom, deferred) <!-- oc:id=sec_aa -->

> **Status:** DEFERRED. Scheduled after Wave 5 ships. Not part of the Loom
> migration; included here so the prompt is ready when the team picks it up.
> **Plan section:** `.sisyphus/plans/loom-implementation-plan.md` §3 Phase 7.
> **Assessment anchor:** `.sisyphus/plans/loom-alignment-assessment.md` §4.2.
> **Goal:** collapse `apps/desktop/src/renderer/components/chat/chat-tool-call.tsx`'s
> 6 switch statements into a `ToolRendererContribution` table. Wire V2 plugin
> commands into the command palette automatically.

## Context (for the worker) <!-- oc:id=sec_ab -->

`apps/desktop/src/renderer/components/chat/chat-tool-call.tsx` is 1318 lines
of switch statements keyed on `part.tool: string`. The 6 switches are at
`getToolInfo` (`:166–200`), `getPendingLabel` (`:227–246`), `getToolSubtitle`
(two variants, around `:261–305`), `shouldDefaultOpen` (`:894–916`),
`hasExpandableContent` (`:921–947`), and `getToolContent` (`:952–989`).

The same registry discipline that Wave 1–5 brought to GenUI components applies
here. After Wave 5, the V2 manifest supports `contributes.tools` for tool
metadata. This wave adds `contributes.toolRenderers` for the React component
that renders a tool call's output.

## Why this is deferred (not part of Loom) <!-- oc:id=sec_ac -->

- It is a refactor, not a Loom feature. Tool-call renderers are a palot concern, not a Loom concern.
- The file is 1318 lines. Bundling the refactor with the Loom migration would inflate the review surface.
- The Loom migration is the priority. Once it is in production, the renderer-side refactor is a clean follow-up.

## Touched files (NEW) <!-- oc:id=sec_ad -->

- `apps/desktop/src/renderer/components/chat/tool-renderer-registry.ts` — `Record<ToolName, {icon, title, pendingLabel, defaultOpen, Content}>`.
- `apps/desktop/src/renderer/components/chat/tool-renderer-content/{bash,edit,write,patch,dag,read,search,webfetch,todo,generic}.tsx` — per-tool `*Content` files.

## Touched files (CHANGED) <!-- oc:id=sec_ae -->

- `apps/desktop/src/renderer/components/chat/chat-tool-call.tsx` — rewrite to consume the registry; collapse to ~200 LoC.
- `apps/desktop/src/renderer/components/command-palette.tsx:369–399, 460–648` — Features + Plugins groups iterate the V2 catalog.
- `apps/desktop/src/shared/firefly-plugin/manifest.ts:183–329` — add a `toolRenderers` family (or keep it renderer-internal; decide in the wave).

## Required tools <!-- oc:id=sec_af -->

- `edit`, `write`, `read`
- `bun run check-types`, `bun run lint`
- `bun test`

## Must do <!-- oc:id=sec_ag -->

1. Split each `case "x":` body in `chat-tool-call.tsx` into a per-tool `*Content` file. Keep behavior identical. <!-- oc:id=item_aa -->
1. Build a `tool-renderer-registry.ts` that maps `ToolName` to `{icon, title, pendingLabel, defaultOpen, Content}`. <!-- oc:id=item_ab -->
1. Rewrite the 6 switches as a single dispatch: `const renderer = toolRendererRegistry[part.tool] ?? toolRendererRegistry.generic;` and `renderer.<thing>(part)`. <!-- oc:id=item_ac -->
1. Wire the V2 `useFireflyPluginTools()` (existing) into the registry. Each `OpenCodeToolDefinition` registers a default `Content` (the existing `GenericContent`) unless a more specific one is contributed. <!-- oc:id=item_ad -->
1. Update the command palette's Plugins group to iterate the V2 catalog. <!-- oc:id=item_ae -->
1. No behavior change. Visual diff against the prior render. <!-- oc:id=item_af -->

## Must NOT do <!-- oc:id=sec_ah -->

- No new tools. No new transport. No new wire.
- No GenUI changes.
- No Loom changes.
- Do not bundle this wave with the Loom migration.

## Proof criteria <!-- oc:id=sec_ai -->

1. `chat-tool-call.tsx` shrinks from 1318 lines to under 300. <!-- oc:id=item_ag -->
1. All existing tool-call render behaviors still work (visual diff against the prior render). <!-- oc:id=item_ah -->
1. The command palette's Plugins group auto-discovers the two exemplar plugins. <!-- oc:id=item_ai -->
1. `bun run check-types` clean. <!-- oc:id=item_aj -->
1. `bun run lint` clean. <!-- oc:id=item_ak -->

## Risk <!-- oc:id=sec_aj -->

- **Low.** Pure refactor. No behavior change.
- Failure mode: a tool's behavior is lost in the split. Visual diff catches this; add a snapshot test for each tool's render output.

## Definition of done <!-- oc:id=sec_ak -->

- All proof criteria pass.
- `chat-tool-call.tsx` is under 300 lines.
- `.sisyphus/plans/loom-progress.md` is updated with `Wave 6: complete (date)`.
- A PR is opened; description cites this prompt + the plan section.