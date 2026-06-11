# Draft: PM Side Agents Panel <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- Build a full work plan for palot / Firefly-client PM UI work.
- Scope centers on inventory of CH5PM side/accessory agents, responsibilities, prompt management, and UI hook points.
- New UI should consume daemon HTTP surface, especially `GET http://127.0.0.1:43130/pm/babysitter`.
- Canonical side-agent index is `~/src/ch5/ch5-company/docs/ch5pm/ch5pm-daemon-subsystem-catalog.md`.
- Existing PM page already reads `~/.local/state/ch5pm/pm-state.json`.
- Desired UI model: Boxes -> Lanes -> Side agents -> Attention queue -> Merge queue.

## Technical Decisions <!-- oc:id=sec_ac -->
- Treat `pm-state.json` as existing/local source and daemon `:43130` endpoints as durable v2 source.
- Design against typed contracts exposed by `packages/ch5pm-daemon/src/babysitter/types.ts` and daemon endpoint docs.
- Use the subsystem catalog as the render spine for the side-agents panel.
- Plan should target palot code changes only; no daemon changes unless strictly needed for type parity or field gaps discovered during implementation.

## Research Findings <!-- oc:id=sec_ad -->
- `GET /pm/babysitter` is live and returns `hubBoxId`, `boxes[]`, `attention[]`, `babysitterLoop`, `degradedReasons`, `dataAges`.
- Distributed babysitter recovery endpoints are `POST /babysitter/resume`, `/babysitter/unwedge`, `/babysitter/park`.
- Tick babysitter prompts are versioned in `packages/ch5pm-babysitter/prompts/*.md` with presets: `confusion`, `context-exhaustion`, `brief-compliance`, `decision-extraction`, `drift`.
- Prompt management gap: MergeQueue / Frontier Curator charters are spawn-brief only, not durable docs.
- `pm-state.json` exposes `boxes[]`, `sessions[]`, `lanes[]`, `backgroundAgents[]`, `planeSummary.readyFrontier[]`, `needsChris[]`, `degradedReasons[]`, `lastTick`.

## Scope Boundaries <!-- oc:id=sec_ae -->
- INCLUDE: palot PM page data model, typed contracts, fetch/poll layer, side-agents panel UI, attention integration, merge-queue surfacing, docs/handoff needed for execution.
- EXCLUDE: implementing daemon-side new endpoints, changing CH5PM control-plane behavior, redesigning unrelated PM page sections beyond what side-agents integration requires.

## Open Questions <!-- oc:id=sec_af -->
- None currently blocking plan generation; defaults can be applied for visual/layout choices within existing PM page language.
- Need exact palot file map for PM page components/types/data flow during plan generation.