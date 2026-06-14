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
- Storybook stories should omit `tags: ["autodocs"]`; keep default Storybook behavior unless explicit docs are needed.

## Non-Goals

- No redesign of the component library.
- No duplicate stories for pure imported-library pass-throughs.
- No broad refactors unrelated to Storybook coverage.

## Current State

- Tracker exists at `docs/storybook-missing-ui-elements.md`.
- Current CH5 coverage after batch 18 from 2026-06-14T02:01:22.969Z: 134 visual components, 123 covered, 11 visual component gaps, 11 documented exceptions, 0 actionable local story gaps.
- Existing covered components: `button`, `discrete-tabs`, `sidebar`, `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button-group`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `combobox`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `form`, `hover-card`, `input`, `input-group`, `input-otp`, `item`, `kbd`, `label`, `menubar`, `native-select`, `navigation-menu`, `pagination`, `popover`, `progress`, `radio-group`, `resizable`, `scroll-area`, `searchable-list-popover`, `select`, `separator`, `sheet`, `skeleton`, `slider`, `sonner`, `spinner`, `switch`, `table`, `tabs`, `textarea`, `toggle`, `toggle-group`, `tooltip`, `confirmation`, `image`, `package-info`, `schema-display`, `sources`, `suggestion`, `code-block`, `environment-variables`, `file-tree`, `shimmer`, `snippet`, `stack-trace`, `terminal`, `test-results`, `agent`, `chain-of-thought`, `checkpoint`, `commit`, `plan`, `queue`, `reasoning`, `task`, `artifact`, `conversation`, `inline-citation`, `message`, `tool`, `attachments`, `diff`, `file-changes`, `open-in-chat`, `sandbox`, `transcription`, `canvas`, `context`, `connection`, `controls`, `edge`, `node`, `panel`, `toolbar`, `audio-player`, `mic-selector`, `model-selector`, `speech-input`, `voice-selector`, `jsx-preview`, `persona`, `prompt-input`, `web-preview`, `day-picker`, `delete-button`, `inline-edit`, `morphing-input`, `status-button`, `bottom-menu`, `dynamic-toolbar`, `expandable-gallery`, `fluid-expanding-grid`, `list-item`, `nav-sidebar-shell`, `animated-collection`, `multi-step-form`, `pricing-card`, `stacked-list`, `vertical-tabs`.
- Documented exceptions: `direction` is a pure `@base-ui/react/direction-provider` re-export; `smooth-dropdown` and all nine marketing files are pure `@ch5me/ch5-ui-web` re-exports.
- Batch 01 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped all 10 new stories, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-01/`.
- Batch 02 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped 12 form/action/navigation primitives, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-02/`.
- Batch 03 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped 10 disclosure/layout/overlay primitives, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-03/`.
- Batch 04 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped 8 data/form/layout primitives, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-04/`.
- Batch 05 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped 11 advanced primitives, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-05/`.
- Batch 06 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped 3 navigation/form primitives, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-06/`.
- Batch 07 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped 6 AI elements, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-07/`.
- Batch 08 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped 8 AI elements, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-08/`. `StackTraceHeader` now marks its non-button trigger with `nativeButton={false}` so Base UI no longer emits an accessibility/runtime error when action buttons are inside the header.
- Batch 09 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped 8 AI workflow elements, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-09/`. `CommitHeader` and `TaskTrigger` now mark non-button triggers with `nativeButton={false}`, and `Reasoning` no longer wires the version-skewed optional Streamdown code plugin.
- Batch 10 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped 5 AI chat/tool elements, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-10/`. `MessageResponse` now mirrors `Reasoning` by avoiding the version-skewed optional Streamdown code plugin.
- Batch 11 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped 6 AI input/code/action/tool/voice elements, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-11/`. `FileChangesHeader` now marks its div-rendered trigger with `nativeButton={false}` so Base UI no longer emits a runtime accessibility warning.
- Batch 12 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped `canvas` and `context`, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-12/`.
- Batch 13 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped `connection`, `controls`, `edge`, `node`, `panel`, and `toolbar`, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-13/`. `tags: ["autodocs"]` was removed across Storybook stories so Storybook keeps default story behavior without automatic docs pages.
- Batch 14 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped `audio-player`, `mic-selector`, `model-selector`, `speech-input`, and `voice-selector`, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-14/`. `AudioPlayer` Media Chrome controls now opt out of Base UI native button behavior, and `VoiceSelectorGender` no longer imports Lucide icons missing from the installed package.
- Batch 15 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped `jsx-preview`, `persona`, `prompt-input`, and `web-preview`, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-15/`. First render attempt hit a transient Storybook dev-server 504 on a cached Storybook shim; service health and index were clean, and retry passed.
- Batch 16 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped `day-picker`, `delete-button`, `inline-edit`, `morphing-input`, and `status-button`, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-16/`.
- Batch 17 proof: Storybook typecheck passed, static Storybook build passed, CH5 coverage mapped `bottom-menu`, `dynamic-toolbar`, `expandable-gallery`, `fluid-expanding-grid`, and `list-item`, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-17/`.
- Batch 18 proof: Storybook typecheck passed, CH5 coverage mapped `nav-sidebar-shell`, `animated-collection`, `multi-step-form`, `pricing-card`, `stacked-list`, and `vertical-tabs`, and Chrome rendered desktop/mobile screenshots under `.sisyphus/evidence/storybook-coverage/batch-18/`. Remaining CH5 visual gaps are the 11 documented imported-library pass-through exceptions.
- Current worktree has unrelated browser-lane changes; do not sweep them into Storybook commits.

## Plan

1. Keep Storybook stories free of `tags: ["autodocs"]`.
2. If new local UI components land, add them to `docs/storybook-missing-ui-elements.md` and cover them with the same render plus CH5 proof loop.
3. Keep imported-library pass-throughs as documented exceptions unless Palot adds local behavior, styling, composition, or app-specific states.

## Next Update Triggers

- Coverage count changes.
- A component becomes a documented exception.
- Verification command changes or blocks.
- Each committed Storybook coverage batch.
