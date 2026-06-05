# Draft: GenUI Artifact System <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- Current GenUI inline loading UX works well; next step is broadening GenUI from one-off inline renders into reusable artifacts.
- Audit all currently renderable GenUI components and plan to support many more over time.
- Every generated GenUI element should get an ID assigned by the system.
- Agent should be able to refer back to prior GenUI artifacts by ID.
- User should be able to pin/save artifacts and surface them somewhere persistent in the session UI.
- Candidate pin surfaces: side panel, or a desktop-only floating / inline-right area with enough space.
- Agent should be able to tweak an existing artifact (example: recolor a DAG) without regenerating the whole artifact from scratch.
- Need data model, affordances, and tool model for pin/unpin/list/update/edit flows.
- User asked to plan it out, not implement.

## Technical Decisions <!-- oc:id=sec_ac -->
- Planning scope only; no implementation in this step.
- Use one consolidated plan file for the whole GenUI artifact system.
- Initial audit indicates current GenUI renderer is registry-based and scalable, but only one component is registered today.

## Research Findings <!-- oc:id=sec_ad -->
- `apps/desktop/src/renderer/genui/registry.ts` is single source of truth for registered GenUI components and model-facing catalog.
- `apps/desktop/src/renderer/genui/components/dag-sparkline.tsx` is the only registered component today, with multiple aliases.
- `apps/desktop/src/renderer/genui/genui-renderer.tsx` already centralizes fence parsing and inline component dispatch.
- `apps/desktop/src/renderer/components/chat/chat-turn.tsx` routes assistant text through `TextWithGenUi`, so artifact capture can hook close to resolved GenUI render points.
- `apps/desktop/src/renderer/atoms/session-widgets.ts` and `apps/desktop/src/renderer/session-widget-registry.tsx` already provide above-chat and inline-right session widget zones.
- `apps/desktop/src/renderer/firefly-surface-registry.tsx` provides side-panel-tab surface registration patterns.
- `apps/desktop/src/renderer/components/review/review-panel.tsx` already contains a conceptually similar pinned-item UX pattern.
- `apps/desktop/src/renderer/atoms/preferences.ts` includes pinned facts storage patterns that may inform persistent artifact pin state.

## Scope Boundaries <!-- oc:id=sec_ae -->
- INCLUDE: GenUI capability audit, artifact identity model, pin/unpin affordances, placement surfaces, agent/tool contract, incremental edit flow, phased rollout.
- EXCLUDE: Immediate implementation of all artifact mechanics in this planning step.

## Open Questions <!-- oc:id=sec_af -->
- Persistence scope default: session-only first, or project-wide from day one?
- Should artifact IDs be globally unique across repo or scoped per session/project?
- Which surface is v1 default: side panel, above-chat widget, inline-right widget, or dual-surface?
- Should artifact editing be modeled as tool calls only, or can updated fences also patch existing artifact IDs?