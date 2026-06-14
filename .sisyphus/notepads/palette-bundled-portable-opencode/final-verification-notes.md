# Palette Bundled Portable OpenCode - Final Verification Notes

## State

- Planning deliverable is decision-complete for bundled runtime contract, env isolation, onboarding, migration, advanced mode boundary, and packaged proof gating.
- F2, F3, and F4 rechecks approved after tightening.
- F1 approved after final wording fixes around dedicated `portable-opencode` `extraResources` language and future packaged proof outputs.

## Key fixes that unblocked final reviews

- Split stale historical evidence from current authority by marking older F1/F3/final-wave files as unrelated historical traces.
- Added committed metadata instance at `apps/desktop/resources/portable-opencode/artifact-metadata.json`.
- Added missing negative audit artifact `task-6-runtime-refactor-error.txt`.
- Tightened doc to separate contract authority from implementation-plan authority.
- Tightened packaged onboarding ownership, active-environment pointer ownership, and startup-overlay vs onboarding failure ownership.
- Clarified that platform-specific packaged proof outputs are future implementation/release artifacts, not planning-pass artifacts.

## Remaining non-work item

- Plan file explicitly says F1-F4 must stay unchecked until user gives explicit `okay` on plan acceptance.
- This is governance only, not missing engineering work.
