# Draft: Firefly Plugin System <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- Build a full implementation plan for a plugin-first architecture where all first-party and AI-authored features are plugins.
- Scope is Palette only, but spans Palette in conjunction with the Palette OpenCode plugin bridge/runtime.
- Host must not self-mutate; AI should author plugins, not patch host source.
- Main process stays host-only; plugin logic runs isolated in worker/utility processes.
- Renderer stays host UI only; plugins do not touch host DOM directly.
- Privileged operations must go through a capability broker with manifest-declared permissions.
- UI default path is a host component kit via custom reconciler; escape hatch is sandboxed iframe/webview.
- Need strong author-facing API for both plugin UI placement and runtime interaction schema between plugin and running OpenCode agent.
- Plan must examine current side panels and refactor app toward plugin-based UI contribution points from beginning.
- Every side panel / major extension surface should become broadly plugin-based, with built-in unremovable plugins for core features.
- Need a VS Code-like broad map of all UI contribution spots where plugins can add UI, even if some ship later.
- Plan should map all current UI insertion points, then stage them by rollout order/phases.
- Hot reload should be fast and reliable; esbuild watch is preferred.
- Manifest contract should use Zod and drive validation, types, and permission declarations.
- Marketplace should use R2 + D1 + Worker with signed bundles and permission consent.
- Firefly relevance is limited to billing, agents, and auth integration; this is not a general Firefly app-platform plan.
- Automated test stance: tests after implementation, not TDD.

## Technical Decisions <!-- oc:id=sec_ac -->
- Keystone decision: everything is a plugin, including first-party features.
- One worker per plugin for crash isolation and clean hot reload.
- No ambient authority in plugin workers.
- React should be unified via externals or reconciler kit to avoid duplicate React/hook failures.
- State should live in host storage capability, not worker memory.
- Two trust tiers: first-party/local vs marketplace/third-party.
- Verification strategy should assume tests-after implementation, not TDD-first sequencing.

## Research Findings <!-- oc:id=sec_ad -->
- None yet.

## Open Questions <!-- oc:id=sec_ae -->
- What existing plugin/runtime surfaces already exist in Palot/OpenCode bridge layers that this plan must integrate with?
- Which current contribution surfaces exist today (sidebar/panel/commands/etc.)?
- What current build/runtime/package patterns can be reused for SDK, workers, and marketplace plumbing?
- What test infrastructure exists for this repo and what verification approach should the plan assume?
- Which UI extension points should be phase-1 mandatory vs later escape hatches?
- How much plugin-to-agent runtime schema should be manifest-level vs SDK-level vs dynamic tool registration?

## Scope Boundaries <!-- oc:id=sec_af -->
- INCLUDE: architecture, runtime model, manifest/schema, SDK, dev loop, marketplace, trust model, rollout plan.
- EXCLUDE: direct implementation of the system itself in this session.