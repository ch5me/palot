# Draft: palot Loom alignment <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- Task type: planning/spec only. No implementation migration work.
- Deliverables: `docs/loom-alignment-assessment.md`, `docs/loom-implementation-plan.md`, `docs/loom-build-prompts/`, `docs/loom-progress.md`.
- Git hygiene: `git pull --rebase` first, then commit each doc slice and push each.
- Source of truth docs: `~/src/ch5/ch5-company/docs/loom-protocol-spec.md`, `~/src/ch5/ch5-company/docs/agent-ui-direction-axi-loom.md`, `https://axi.md/`, `~/.claude/skills/axi-loom/SKILL.md`.
- Must tie palot work to Firefly/ELF plugin surface and OpenCode fork built-in SessionStart hook path.
- Must call out smallest safe first step and recommended first implementation wave.

## Technical Decisions <!-- oc:id=sec_ac -->
- Planning mode only. Docs/specs/prompts are final deliverable.
- Use delegated exploration for palot architecture and doctrine comparisons before writing docs.
- Treat current dirty worktree as parallel-agent background unless direct conflict with new docs.

## Research Findings <!-- oc:id=sec_ad -->
- Loom doctrine: asymmetric transport, typed component registry, dual signal/state bindings, render/poll/patch loop, agent-authoritative reconciliation.
- Company direction explicitly marks palot as reference build-out and Firefly/OpenCode fork as downstream alignment targets.
- Existing palot docs already document conservative renderer-first GenUI artifact system and bridge plugin seam.

## Scope Boundaries <!-- oc:id=sec_ae -->
- INCLUDE: assessment, phased migration plan, implementation prompts, progress tracker, file-anchored evidence.
- EXCLUDE: runtime code changes, registry migration, protocol implementation, transport implementation.

## Open Questions <!-- oc:id=sec_af -->
- Need repo pull strategy because `git pull --rebase` blocked on existing unstaged changes unrelated to this work.
- Need delegated architecture maps to finish file-anchored assessment and touched-file plan.