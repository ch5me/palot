# Current Goal

## Goal As Stated

Work through `docs/storybook-missing-ui-elements.md`. For each unchecked local component, create a focused Storybook service order: inspect component API, skip imported-library pass-throughs with a documented exception, add representative stories under `packages/storybook/src/stories` for Palot-owned behavior/states, verify Storybook render locally, run CH5 coverage, then check the item only when coverage/proof passes. Batch related components when safe, keep stories realistic, and stop only when every missing local UI element is covered or documented as an intentional exception. Preserve existing repo patterns and do not weaken verification.

## Interpreted Goal

Close Storybook coverage for all local Palot UI components tracked in `docs/storybook-missing-ui-elements.md`, using CH5 coverage as the source of truth.

## Success Criteria

- Every unchecked local component in `docs/storybook-missing-ui-elements.md` has either a representative Storybook story or a checked documented exception.
- Imported-library pass-throughs are not duplicated; exceptions name the upstream package/source.
- `ch5 coverage elf --json` reports no unaccounted local visual component gaps, or remaining gaps are documented exceptions.
- Storybook renders new stories locally without runtime/console errors.
- Mobile and desktop screenshot proof exists for covered Storybook targets where required by CH5 coverage.
- Changes are committed in coherent slices without sweeping unrelated worktree changes.

## Constraints

- Preserve existing Storybook conventions under `packages/storybook/src/stories`.
- Use realistic component states, not placeholder-only demos.
- Do not weaken CH5 coverage, Storybook verification, lint, typecheck, or local proof.
- Respect dirty worktree and concurrent edits; touch only Storybook coverage files, tracker docs, and this goal doc unless a component fix is required for a story to render.
- Imported components from external or shared packages are trusted to have upstream tests/stories; only local wrappers with Palot-owned behavior/styling/composition need Palot stories.

## Non-Goals

- No redesign of the component library.
- No duplicate stories for pure imported-library pass-throughs.
- No broad refactors unrelated to Storybook coverage.

## Current State

- Tracker exists at `docs/storybook-missing-ui-elements.md`.
- Current CH5 coverage after batch 01 from 2026-06-13T23:24:15.908Z: 134 visual components, 13 covered, 121 visual component gaps.
- Existing covered components: `button`, `discrete-tabs`, `sidebar`, `alert`, `avatar`, `badge`, `card`, `empty`, `kbd`, `progress`, `separator`, `skeleton`, `spinner`.
- Batch 01 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped all 10 new stories, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-01/`.
- Current worktree has unrelated browser-lane changes; do not sweep them into Storybook commits.

## Plan

1. Batch simple UI primitives first: static display, input, feedback, and layout stories.
2. Verify each batch with Storybook build/render checks plus `ch5 coverage elf --json`.
3. Update tracker checkboxes only for components proved covered or documented exceptions.
4. Commit each coherent batch with the goal doc and tracker updates.
5. Continue through AI elements, animated components, and marketing components.

## Next Update Triggers

- Coverage count changes.
- A component becomes a documented exception.
- Verification command changes or blocks.
- Each committed Storybook coverage batch.
