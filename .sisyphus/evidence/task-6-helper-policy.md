# Task 6 Helper Policy <!-- oc:id=sec_aa -->

## Repeated proof-helper expectations <!-- oc:id=sec_ab -->

- Use compact evidence artifacts under `.sisyphus/evidence/` per task.
- Prefer generic proof helpers that verify catalog fetch, auth state, config mutation, and safe test probes.
- Keep helpers composable: one helper for registry/cache proof, one for runtime posture, one for migration import, one for safe probe.

## Anti-sprawl guardrails <!-- oc:id=sec_ac -->

- Do not encode vendor-specific browser macros into repo helpers.
- Do not bake full OAuth/provider walkthroughs into scripts.
- Keep browser work at primitive level: open, poll, snapshot, extract, approve.

## Implementation policy <!-- oc:id=sec_ad -->

- Renderer should call typed backend helpers, not raw file writes or ad hoc fetches.
- Main process should expose bounded IPC for catalog/auth/config work.
- Migration proofs should reuse configconv fixtures instead of inventing one-off end-to-end flows.