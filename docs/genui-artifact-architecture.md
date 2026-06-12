# GenUI Artifact Architecture <!-- oc:id=sec_aa -->

This page is the durable architecture reference for Palot's GenUI system and the first-pass artifact layer built on top of it.

Use this doc before changing any of these areas:
- `apps/desktop/src/renderer/genui/registry.ts`
- `apps/desktop/src/renderer/genui/genui-renderer.tsx`
- `apps/desktop/src/renderer/atoms/genui-artifacts.ts`
- `apps/desktop/src/renderer/atoms/chat.ts`
- `apps/desktop/src/renderer/atoms/session-widgets.ts`
- `apps/desktop/src/renderer/session-widget-registry.tsx`
- `apps/desktop/src/renderer/firefly-surface-registry.tsx`
- `apps/desktop/src/renderer/components/genui/*`
- `apps/desktop/src/renderer/components/side-panel/artifacts-panel.tsx`

## Goal <!-- oc:id=sec_ab -->

GenUI starts as inline model-rendered UI inside chat replies. The artifact layer turns those one-off inline blocks into addressable session objects with stable IDs, source linkage, pinning, prompt-context references, and small local prop edits.

The current design is intentionally conservative:
- renderer-first
- session-scoped
- fence-first
- no server protocol change required
- no arbitrary code execution

## Mental Model <!-- oc:id=sec_ac -->

Think in three layers:

1. Registry layer <!-- oc:id=item_aa -->
- defines which GenUI components exist
- validates model-supplied props
- generates the model-facing catalog text

1. Render/capture layer <!-- oc:id=item_ab -->
- parses ` ```genui ` and legacy ` ```dag ` fences from assistant text
- renders validated components inline in chat
- captures rendered blocks as artifact records with system-generated IDs

1. Artifact surface layer <!-- oc:id=item_ac -->
- stores artifact records in session-scoped Jotai state
- exposes pinned artifacts in session widget and side-panel surfaces
- injects lightweight artifact references back into outbound prompts

## Current State <!-- oc:id=sec_ad -->

### Registered GenUI kinds <!-- oc:id=sec_ae -->

Current built-in GenUI components:
- `dag-sparkline`
- `decision_card`
- `status_thinking_card`

Defined in:
- `apps/desktop/src/renderer/genui/components/dag-sparkline.tsx`
- `apps/desktop/src/renderer/genui/components/decision-card.tsx`
- `apps/desktop/src/renderer/genui/components/status-thinking-card.tsx`

Canonical aliases:
- `dag`
- `dag spark`
- `dag sparkline`
- `graph`
- `flow graph`
- `dependency graph`

`decision_card` covers an inline decision artifact with notes and submit event metadata.
`status_thinking_card` is a beta inline status card sourced from the Storybook/Remotion
experience family, wrapped as schema-safe host-rendered GenUI.

Each registry entry now declares:
- `presentation`: `inline-artifact`, `chat-widget`, `side-panel`, `main-pane`, or `webview`
- `scope`: `generic`, `ch5-internal`, or `lab`
- `maturity`: `stable`, `beta`, `alpha`, or `internal`
- `defaultPlacement` plus `allowedPlacements`
- optional source package, Storybook path, and docs path

This is important: the architecture is generic, and current components are still
allowlisted host-rendered entries. Storybook can suggest candidates, but registry
entries remain the runtime source of truth.

### Legacy compatibility <!-- oc:id=sec_af -->

Two fence forms are supported:
- ` ```genui ` with JSON body `{ "component": "...", "props": { ... } }`
- legacy ` ```dag ` with raw DAG JSON body

Compatibility rules:
- ` ```dag ` maps to `dag-sparkline`
- alias lookup still routes through the registry
- inline rendering must keep working even while artifact features expand

## Registry Layer <!-- oc:id=sec_ag -->

### Source of truth <!-- oc:id=sec_ah -->

File:
- `apps/desktop/src/renderer/genui/registry.ts`

Key concepts:
- `GenUiEntry<P>` defines a single allowlisted component
- `parseProps(raw)` validates/coerces model JSON into trusted render props
- `resolveGenUiEntry(name)` resolves canonical names and aliases
- `buildGenUiCatalog()` generates the prompt text describing available inline UI

Why it matters:
- prompt contract and renderer contract derive from the same table
- components are allowlisted and typed
- no ad hoc model-defined UI surface exists outside the registry

### Adding a new GenUI kind <!-- oc:id=sec_ai -->

The intended path is:
1. create a new component entry under `apps/desktop/src/renderer/genui/components/` <!-- oc:id=item_ad -->
1. validate its props locally with `parseProps` <!-- oc:id=item_ae -->
1. add it to `ENTRIES` in `apps/desktop/src/renderer/genui/registry.ts` <!-- oc:id=item_af -->
1. let prompt catalog generation pick it up automatically <!-- oc:id=item_ag -->

This keeps the system DRY.

## Render and Capture Layer <!-- oc:id=sec_aj -->

### Inline parser and renderer <!-- oc:id=sec_ak -->

File:
- `apps/desktop/src/renderer/genui/genui-renderer.tsx`

Responsibilities:
- parse fences into `GenUiSegment[]`
- support `text`, `genui`, `genui-error`, and `genui-pending`
- render pending skeletons while streaming
- route validated component props through `GenUiBlock`

Important functions/components:
- `splitGenUiFences()`
- `GenUiBlock`
- `GenUiPendingBlock`
- `TextWithGenUi`

### Artifact capture seam <!-- oc:id=sec_al -->

The artifact system captures GenUI blocks at render time.

Current seam:
- `GenUiArtifactCapture` in `apps/desktop/src/renderer/genui/genui-renderer.tsx`

Capture behavior:
- only captures when `sessionId` and `messageId` are available
- creates or updates a stable artifact record
- stores source linkage
- keeps the artifact ID system-owned

### Chat integration <!-- oc:id=sec_am -->

Files:
- `apps/desktop/src/renderer/components/chat/chat-turn.tsx`
- `apps/desktop/src/renderer/components/chat/chat-tool-call.tsx`

Current paths:
- assistant text uses `TextWithGenUi`
- DAG tool output still routes through GenUI rendering rather than a separate artifact-only renderer
- captured artifacts are linked back to session/message origin from the chat render path

## Artifact Data Model <!-- oc:id=sec_an -->

### Source of truth <!-- oc:id=sec_ao -->

Files:
- `apps/desktop/src/renderer/lib/types.ts`
- `apps/desktop/src/renderer/atoms/genui-artifacts.ts`

Core types:
- `GenUiArtifactScope`
- `GenUiArtifactPlacement`
- `GenUiArtifactSource`
- `GenUiArtifactPinState`
- `GenUiArtifactRecord`
- `GenUiArtifactDescriptor`

### What an artifact record stores <!-- oc:id=sec_ap -->

Minimum fields:
- `id`
- `scope`
- `title`
- `component`
- `props`
- `source { sessionId, messageId, partId?, component, rawFence }`
- `createdAt`
- `updatedAt`
- `lastRenderedAt`
- `pin { pinned, placement, pinnedAt }`

### Scope rules <!-- oc:id=sec_aq -->

V1 scope is intentionally narrow:
- `session`

That means:
- source of truth lives in renderer state
- no main-process persistence requirement for the first slice
- no cross-session assumptions
- future project/global persistence can be added later without changing the conceptual model

### ID rules <!-- oc:id=sec_ar -->

Artifact IDs are generated by the system, never trusted from model output.

Current behavior:
- generated in `apps/desktop/src/renderer/atoms/genui-artifacts.ts`
- prefixed like `artifact_...`

Why:
- stable reference handle for prompt context
- avoids trusting model-supplied identity
- allows future persistence and mutations without changing the agent contract

## Artifact Store Layer <!-- oc:id=sec_as -->

### Store location <!-- oc:id=sec_at -->

File:
- `apps/desktop/src/renderer/atoms/genui-artifacts.ts`

### Current store shape <!-- oc:id=sec_au -->

Session-scoped state:
- `SessionGenUiArtifactsState`
  - `order: string[]`
  - `records: Record<string, GenUiArtifactRecord>`

### Main atoms and selectors <!-- oc:id=sec_av -->

Storage/state:
- `sessionGenUiArtifactsStorageAtom`
- `sessionGenUiArtifactsFamily(sessionId)`

Selectors:
- `sessionGenUiArtifactListFamily(sessionId)`
- `pinnedGenUiArtifactListFamily(sessionId)`
- `genUiArtifactByIdFamily({ sessionId, artifactId })`

Write actions:
- `upsertGenUiArtifactAtom`
- `pinGenUiArtifactAtom`
- `patchGenUiArtifactPropsAtom`
- `unpinAllGenUiArtifactsForPlacementAtom`

### Why Jotai here <!-- oc:id=sec_aw -->

This matches the rest of the renderer architecture:
- session messages and parts already use families
- widget layout already uses Jotai + storage
- prompt injection can read from `appStore`

This is the right v1 substrate.

## Artifact Surfaces <!-- oc:id=sec_ax -->

There are two current artifact surfaces.

### V1 primary surface: session widget <!-- oc:id=sec_ay -->

Files:
- `apps/desktop/src/renderer/atoms/session-widgets.ts`
- `apps/desktop/src/renderer/session-widget-registry.tsx`
- `apps/desktop/src/renderer/components/genui/genui-artifact-widget.tsx`

Current placement decision:
- primary pinned surface is `chat-inline-right`

Why this is v1:
- stays near the live chat timeline
- keeps artifacts session-scoped
- avoids inventing a new layout system
- does not break chat ordering

### V2 secondary surface: side panel <!-- oc:id=sec_az -->

Files:
- `apps/desktop/src/renderer/firefly-surface-registry.tsx`
- `apps/desktop/src/renderer/components/side-panel/artifacts-panel.tsx`

Current role:
- inventory / browsing / follow-up surface
- not the primary live placement surface

Why this exists:
- gives a durable place to inspect all session artifacts
- scales better than the inline-right zone for browsing
- matches the rest of Firefly side-panel architecture

### Surface components <!-- oc:id=sec_ba -->

Files:
- `apps/desktop/src/renderer/components/genui/genui-artifact-card.tsx`
- `apps/desktop/src/renderer/components/genui/genui-artifact-inline-actions.tsx`
- `apps/desktop/src/renderer/components/genui/genui-artifact-prop-actions.tsx`

These provide:
- card framing around artifacts
- pin/unpin controls
- a first prop-patch action for DAG artifacts

## Prompt / Agent Contract <!-- oc:id=sec_bb -->

### Prompt injection seam <!-- oc:id=sec_bc -->

Files:
- `apps/desktop/src/renderer/atoms/chat.ts`
- `apps/desktop/src/renderer/components/chat/chat-view.tsx`

Prompt behavior:
- GenUI catalog is injected once per session for the model
- artifact context is appended to outbound text when artifacts exist

Artifact context shape today:
- includes up to 8 recent artifacts
- each line includes:
  - stable artifact ID
  - component name
  - optional pin placement
  - title

Purpose:
- let future prompts refer back to prior artifacts explicitly
- bias the model toward stable `artifact_...` references instead of ambiguous prose only

### Current v1 operations <!-- oc:id=sec_bd -->

Implemented or implied:
- list -> prompt-context driven
- pin -> UI action
- unpin -> UI action
- update -> local prop patch seam exists
- remove -> not yet built

### Important constraint <!-- oc:id=sec_be -->

V1 is prompt-context-driven, not tool-driven.

That means:
- no dedicated server tool contract yet
- no protocol change required to get value
- future toolization remains open

## Prop Patch Flow <!-- oc:id=sec_bf -->

### Current implementation <!-- oc:id=sec_bg -->

File:
- `apps/desktop/src/renderer/atoms/genui-artifacts.ts`

Action:
- `patchGenUiArtifactPropsAtom`

Visible trigger:
- `apps/desktop/src/renderer/components/genui/genui-artifact-prop-actions.tsx`

Current shipped behavior:
- DAG artifacts expose a `Tweak` action
- action applies a local prop patch
- patch currently drives:
  - `showLabels: true`
  - `animate: "flow"`

Why this matters:
- proves the architecture does not require full regeneration for a small update
- establishes the optimistic local update path
- keeps future richer edit affordances aligned with the same atom-level contract

## Safety Model <!-- oc:id=sec_bh -->

This system is intentionally narrow.

Guardrails:
- model can only reference allowlisted components from the registry
- props are validated before render
- IDs are system-generated
- source linkage is preserved
- no arbitrary React execution
- no arbitrary HTML execution
- no server protocol dependence for v1
- no silent persistence outside session scope

This is the main conceptual contract powering the current GenUI system.

## Relationship to Other App Layers <!-- oc:id=sec_bi -->

### Renderer vs main vs preload <!-- oc:id=sec_bj -->

GenUI/artifacts are currently renderer-first.

Renderer owns:
- registry
- fence parsing
- capture
- artifact state
- widget rendering
- side-panel rendering
- prompt context injection

Main/preload do not currently own artifact persistence.

That is deliberate. If future work needs durable saved artifacts, the likely next step is:
- main-process storage modeled after the automation subsystem or file routes
- narrow preload bridge methods
- optional browser-mode server mirror if needed

### Existing durable patterns to imitate later <!-- oc:id=sec_bk -->

If persistence is added later, study:
- `apps/desktop/src/main/automation/paths.ts`
- `apps/desktop/src/main/automation/schema.ts`
- `apps/server/src/routes/files.ts`

Those already show the preferred XDG, schema, and atomic-write patterns.

## Known Gaps <!-- oc:id=sec_bl -->

This page documents the current shape, not a claim that the system is fully finished.

Known gaps:
- only a small safe set of GenUI kinds is registered today (`dag-sparkline`, `decision_card`, `status_thinking_card`)
- prop patching is minimal and local-only
- no remove/archive workflow yet
- no main-process durable artifact persistence yet

## How to Extend Safely <!-- oc:id=sec_bm -->

If you work on this next, keep these rules:

1. Do not bypass the registry. <!-- oc:id=item_ah -->
1. Do not trust model-generated IDs. <!-- oc:id=item_ai -->
1. Do not add persistence scope implicitly. <!-- oc:id=item_aj -->
1. Keep source linkage mandatory. <!-- oc:id=item_ak -->
1. Prefer extending the generic artifact record shape over adding DAG-specific side channels. <!-- oc:id=item_al -->
1. Reuse session-widget and side-panel registries instead of adding a third layout system. <!-- oc:id=item_am -->
1. Prefer prop patches for small edits before introducing regeneration-only UX. <!-- oc:id=item_an -->
1. If you add server routes, regenerate browser-mode server types. <!-- oc:id=item_ao -->

## Fast File Map <!-- oc:id=sec_bn -->

Core architecture files:
- `apps/desktop/src/renderer/genui/registry.ts`
- `apps/desktop/src/renderer/genui/components/dag-sparkline.tsx`
- `apps/desktop/src/renderer/genui/genui-renderer.tsx`
- `apps/desktop/src/renderer/lib/types.ts`
- `apps/desktop/src/renderer/atoms/genui-artifacts.ts`
- `apps/desktop/src/renderer/atoms/chat.ts`
- `apps/desktop/src/renderer/atoms/session-widgets.ts`
- `apps/desktop/src/renderer/session-widget-registry.tsx`
- `apps/desktop/src/renderer/firefly-surface-registry.tsx`
- `apps/desktop/src/renderer/components/genui/genui-artifact-card.tsx`
- `apps/desktop/src/renderer/components/genui/genui-artifact-inline-actions.tsx`
- `apps/desktop/src/renderer/components/genui/genui-artifact-prop-actions.tsx`
- `apps/desktop/src/renderer/components/genui/genui-artifact-widget.tsx`
- `apps/desktop/src/renderer/components/side-panel/artifacts-panel.tsx`
- `apps/desktop/src/renderer/components/chat/chat-turn.tsx`
- `apps/desktop/src/renderer/components/chat/chat-view.tsx`

Companion notes created during implementation:
- `.sisyphus/notepads/genui-artifact-system/domain-model.md`
- `.sisyphus/notepads/genui-artifact-system/placement-surfaces.md`
- `.sisyphus/notepads/genui-artifact-system/agent-contract.md`
- `.sisyphus/notepads/genui-artifact-system/compatibility.md`
- `.sisyphus/notepads/genui-artifact-system/final-audit.md`
- `.sisyphus/notepads/genui-artifact-system/remaining-blockers.md`

## Short Summary <!-- oc:id=sec_bo -->

The current GenUI architecture in Palot is:
- registry-driven
- prompt-catalog-backed
- fence-rendered inline in chat
- captured into session-scoped artifact records
- pinnable into a chat-inline-right widget
- browseable in a side-panel tab
- referencable in later prompts by stable artifact IDs
- editable through small local prop patches without requiring full regeneration
