# Missing Storybook Coverage

Generated from `ch5 coverage elf --json` on 2026-06-14T01:09:46.010Z.

## Current Coverage

- Visual UI components: 134
- Covered by Storybook/route coverage: 92
- Missing Storybook representation: 42
- Actionable missing local stories after documented exceptions: 31
- Story files: 93
- Story screenshot proof missing in CH5 formal coverage: 184 viewport targets
- Documented exceptions: 11
- Batch 01 local render proof: `.sisyphus/evidence/storybook-coverage/batch-01/render-proof.json`
- Batch 02 local render proof: `.sisyphus/evidence/storybook-coverage/batch-02/render-proof.json`
- Batch 02 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-02/ch5-coverage.json`
- Batch 03 local render proof: `.sisyphus/evidence/storybook-coverage/batch-03/render-proof.json`
- Batch 03 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-03/ch5-coverage.json`
- Batch 04 local render proof: `.sisyphus/evidence/storybook-coverage/batch-04/render-proof.json`
- Batch 04 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-04/ch5-coverage.json`
- Batch 05 local render proof: `.sisyphus/evidence/storybook-coverage/batch-05/render-proof.json`
- Batch 05 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-05/ch5-coverage.json`
- Batch 06 local render proof: `.sisyphus/evidence/storybook-coverage/batch-06/render-proof.json`
- Batch 06 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-06/ch5-coverage.json`
- Batch 07 local render proof: `.sisyphus/evidence/storybook-coverage/batch-07/render-proof.json`
- Batch 07 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-07/ch5-coverage.json`
- Batch 08 local render proof: `.sisyphus/evidence/storybook-coverage/batch-08/render-proof.json`
- Batch 08 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-08/ch5-coverage.json`
- Batch 09 local render proof: `.sisyphus/evidence/storybook-coverage/batch-09/render-proof.json`
- Batch 09 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-09/ch5-coverage.json`
- Batch 10 local render proof: `.sisyphus/evidence/storybook-coverage/batch-10/render-proof.json`
- Batch 10 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-10/ch5-coverage.json`
- Batch 11 local render proof: `.sisyphus/evidence/storybook-coverage/batch-11/render-proof.json`
- Batch 11 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-11/ch5-coverage.json`
- Batch 12 local render proof: `.sisyphus/evidence/storybook-coverage/batch-12/render-proof.json`
- Batch 12 CH5 coverage proof: `.sisyphus/evidence/storybook-coverage/batch-12/ch5-coverage.json`
- Reusable render proof helper: `bun run verify:storybook-render -- --out <proof-dir> <story-id> [...]`
- CH5 gap source scope: local `packages/ui/src/components/**` files only.
- Imported components from other packages/libraries are out of scope here. Trust their upstream stories/tests.
- Thin local wrappers around imported components need Palot stories only when they add local behavior, styling, composition, or app-specific states. Pure pass-through wrappers can become documented exceptions.

Covered components today:

- [x] button (packages/storybook/src/stories/foundations/button.stories.tsx)
- [x] discrete-tabs (packages/storybook/src/stories/foundations/discrete-tabs.stories.tsx)
- [x] sidebar (packages/storybook/src/stories/foundations/sidebar.stories.tsx)
- [x] accordion (packages/storybook/src/stories/foundations/accordion.stories.tsx)
- [x] alert (packages/storybook/src/stories/foundations/alert.stories.tsx)
- [x] alert-dialog (packages/storybook/src/stories/foundations/alert-dialog.stories.tsx)
- [x] aspect-ratio (packages/storybook/src/stories/foundations/aspect-ratio.stories.tsx)
- [x] avatar (packages/storybook/src/stories/foundations/avatar.stories.tsx)
- [x] badge (packages/storybook/src/stories/foundations/badge.stories.tsx)
- [x] breadcrumb (packages/storybook/src/stories/foundations/breadcrumb.stories.tsx)
- [x] button-group (packages/storybook/src/stories/foundations/button-group.stories.tsx)
- [x] calendar (packages/storybook/src/stories/foundations/calendar.stories.tsx)
- [x] card (packages/storybook/src/stories/foundations/card.stories.tsx)
- [x] carousel (packages/storybook/src/stories/foundations/carousel.stories.tsx)
- [x] chart (packages/storybook/src/stories/foundations/chart.stories.tsx)
- [x] checkbox (packages/storybook/src/stories/foundations/checkbox.stories.tsx)
- [x] collapsible (packages/storybook/src/stories/foundations/collapsible.stories.tsx)
- [x] combobox (packages/storybook/src/stories/foundations/combobox.stories.tsx)
- [x] command (packages/storybook/src/stories/foundations/command.stories.tsx)
- [x] context-menu (packages/storybook/src/stories/foundations/context-menu.stories.tsx)
- [x] dialog (packages/storybook/src/stories/foundations/dialog.stories.tsx)
- [x] drawer (packages/storybook/src/stories/foundations/drawer.stories.tsx)
- [x] dropdown-menu (packages/storybook/src/stories/foundations/dropdown-menu.stories.tsx)
- [x] empty (packages/storybook/src/stories/foundations/empty.stories.tsx)
- [x] field (packages/storybook/src/stories/foundations/field.stories.tsx)
- [x] form (packages/storybook/src/stories/foundations/form.stories.tsx)
- [x] hover-card (packages/storybook/src/stories/foundations/hover-card.stories.tsx)
- [x] input (packages/storybook/src/stories/foundations/input.stories.tsx)
- [x] input-group (packages/storybook/src/stories/foundations/input-group.stories.tsx)
- [x] input-otp (packages/storybook/src/stories/foundations/input-otp.stories.tsx)
- [x] item (packages/storybook/src/stories/foundations/item.stories.tsx)
- [x] kbd (packages/storybook/src/stories/foundations/kbd.stories.tsx)
- [x] label (packages/storybook/src/stories/foundations/label.stories.tsx)
- [x] menubar (packages/storybook/src/stories/foundations/menubar.stories.tsx)
- [x] native-select (packages/storybook/src/stories/foundations/native-select.stories.tsx)
- [x] navigation-menu (packages/storybook/src/stories/foundations/navigation-menu.stories.tsx)
- [x] pagination (packages/storybook/src/stories/foundations/pagination.stories.tsx)
- [x] popover (packages/storybook/src/stories/foundations/popover.stories.tsx)
- [x] progress (packages/storybook/src/stories/foundations/progress.stories.tsx)
- [x] radio-group (packages/storybook/src/stories/foundations/radio-group.stories.tsx)
- [x] resizable (packages/storybook/src/stories/foundations/resizable.stories.tsx)
- [x] scroll-area (packages/storybook/src/stories/foundations/scroll-area.stories.tsx)
- [x] searchable-list-popover (packages/storybook/src/stories/foundations/searchable-list-popover.stories.tsx)
- [x] select (packages/storybook/src/stories/foundations/select.stories.tsx)
- [x] separator (packages/storybook/src/stories/foundations/separator.stories.tsx)
- [x] sheet (packages/storybook/src/stories/foundations/sheet.stories.tsx)
- [x] skeleton (packages/storybook/src/stories/foundations/skeleton.stories.tsx)
- [x] slider (packages/storybook/src/stories/foundations/slider.stories.tsx)
- [x] sonner (packages/storybook/src/stories/foundations/sonner.stories.tsx)
- [x] spinner (packages/storybook/src/stories/foundations/spinner.stories.tsx)
- [x] switch (packages/storybook/src/stories/foundations/switch.stories.tsx)
- [x] table (packages/storybook/src/stories/foundations/table.stories.tsx)
- [x] tabs (packages/storybook/src/stories/foundations/tabs.stories.tsx)
- [x] textarea (packages/storybook/src/stories/foundations/textarea.stories.tsx)
- [x] toggle (packages/storybook/src/stories/foundations/toggle.stories.tsx)
- [x] toggle-group (packages/storybook/src/stories/foundations/toggle-group.stories.tsx)
- [x] tooltip (packages/storybook/src/stories/foundations/tooltip.stories.tsx)
- [x] confirmation (packages/storybook/src/stories/ai-elements/confirmation.stories.tsx)
- [x] image (packages/storybook/src/stories/ai-elements/image.stories.tsx)
- [x] package-info (packages/storybook/src/stories/ai-elements/package-info.stories.tsx)
- [x] schema-display (packages/storybook/src/stories/ai-elements/schema-display.stories.tsx)
- [x] sources (packages/storybook/src/stories/ai-elements/sources.stories.tsx)
- [x] suggestion (packages/storybook/src/stories/ai-elements/suggestion.stories.tsx)
- [x] code-block (packages/storybook/src/stories/ai-elements/code-block.stories.tsx)
- [x] environment-variables (packages/storybook/src/stories/ai-elements/environment-variables.stories.tsx)
- [x] file-tree (packages/storybook/src/stories/ai-elements/file-tree.stories.tsx)
- [x] shimmer (packages/storybook/src/stories/ai-elements/shimmer.stories.tsx)
- [x] snippet (packages/storybook/src/stories/ai-elements/snippet.stories.tsx)
- [x] stack-trace (packages/storybook/src/stories/ai-elements/stack-trace.stories.tsx)
- [x] terminal (packages/storybook/src/stories/ai-elements/terminal.stories.tsx)
- [x] test-results (packages/storybook/src/stories/ai-elements/test-results.stories.tsx)
- [x] agent (packages/storybook/src/stories/ai-elements/agent.stories.tsx)
- [x] artifact (packages/storybook/src/stories/ai-elements/artifact.stories.tsx)
- [x] attachments (packages/storybook/src/stories/ai-elements/attachments.stories.tsx)
- [x] canvas (packages/storybook/src/stories/ai-elements/canvas.stories.tsx)
- [x] chain-of-thought (packages/storybook/src/stories/ai-elements/chain-of-thought.stories.tsx)
- [x] checkpoint (packages/storybook/src/stories/ai-elements/checkpoint.stories.tsx)
- [x] commit (packages/storybook/src/stories/ai-elements/commit.stories.tsx)
- [x] context (packages/storybook/src/stories/ai-elements/context.stories.tsx)
- [x] conversation (packages/storybook/src/stories/ai-elements/conversation.stories.tsx)
- [x] diff (packages/storybook/src/stories/ai-elements/diff.stories.tsx)
- [x] file-changes (packages/storybook/src/stories/ai-elements/file-changes.stories.tsx)
- [x] inline-citation (packages/storybook/src/stories/ai-elements/inline-citation.stories.tsx)
- [x] message (packages/storybook/src/stories/ai-elements/message.stories.tsx)
- [x] open-in-chat (packages/storybook/src/stories/ai-elements/open-in-chat.stories.tsx)
- [x] plan (packages/storybook/src/stories/ai-elements/plan.stories.tsx)
- [x] queue (packages/storybook/src/stories/ai-elements/queue.stories.tsx)
- [x] reasoning (packages/storybook/src/stories/ai-elements/reasoning.stories.tsx)
- [x] sandbox (packages/storybook/src/stories/ai-elements/sandbox.stories.tsx)
- [x] task (packages/storybook/src/stories/ai-elements/task.stories.tsx)
- [x] tool (packages/storybook/src/stories/ai-elements/tool.stories.tsx)
- [x] transcription (packages/storybook/src/stories/ai-elements/transcription.stories.tsx)

Documented exceptions today:

- [x] direction - `packages/ui/src/components/direction.tsx` is a pure `@base-ui/react/direction-provider` re-export with no Palot-owned styling, behavior, composition, or app state.
- [x] smooth-dropdown - `packages/ui/src/components/animate/smooth-dropdown.tsx` is a pure `@ch5me/ch5-ui-web` re-export.
- [x] 3d-book - `packages/ui/src/components/marketing/3d-book.tsx` is a pure `@ch5me/ch5-ui-web` re-export.
- [x] bento-card - `packages/ui/src/components/marketing/bento-card.tsx` is a pure `@ch5me/ch5-ui-web` re-export.
- [x] bucket - `packages/ui/src/components/marketing/bucket.tsx` is a pure `@ch5me/ch5-ui-web` re-export.
- [x] discover-button - `packages/ui/src/components/marketing/discover-button.tsx` is a pure `@ch5me/ch5-ui-web` re-export.
- [x] empty-testimonial - `packages/ui/src/components/marketing/empty-testimonial.tsx` is a pure `@ch5me/ch5-ui-web` re-export.
- [x] feature-carousel - `packages/ui/src/components/marketing/feature-carousel.tsx` is a pure `@ch5me/ch5-ui-web` re-export.
- [x] folder-interaction - `packages/ui/src/components/marketing/folder-interaction.tsx` is a pure `@ch5me/ch5-ui-web` re-export.
- [x] magnified-bento - `packages/ui/src/components/marketing/magnified-bento.tsx` is a pure `@ch5me/ch5-ui-web` re-export.
- [x] shake-testimonial-card - `packages/ui/src/components/marketing/shake-testimonial-card.tsx` is a pure `@ch5me/ch5-ui-web` re-export.

## Missing Stories

Add one or more useful Storybook stories for each unchecked local component. Check items only after CH5 coverage sees representation and Storybook renders cleanly. If a component is only an imported-library pass-through, replace its checkbox with a checked documented exception and note the upstream package.

### UI Primitives (56)

- [x] accordion - `packages/ui/src/components/accordion.tsx`
- [x] alert - `packages/ui/src/components/alert.tsx`
- [x] alert-dialog - `packages/ui/src/components/alert-dialog.tsx`
- [x] aspect-ratio - `packages/ui/src/components/aspect-ratio.tsx`
- [x] avatar - `packages/ui/src/components/avatar.tsx`
- [x] badge - `packages/ui/src/components/badge.tsx`
- [x] breadcrumb - `packages/ui/src/components/breadcrumb.tsx`
- [x] button-group - `packages/ui/src/components/button-group.tsx`
- [x] calendar - `packages/ui/src/components/calendar.tsx`
- [x] card - `packages/ui/src/components/card.tsx`
- [x] carousel - `packages/ui/src/components/carousel.tsx`
- [x] chart - `packages/ui/src/components/chart.tsx`
- [x] checkbox - `packages/ui/src/components/checkbox.tsx`
- [x] collapsible - `packages/ui/src/components/collapsible.tsx`
- [x] combobox - `packages/ui/src/components/combobox.tsx`
- [x] command - `packages/ui/src/components/command.tsx`
- [x] context-menu - `packages/ui/src/components/context-menu.tsx`
- [x] dialog - `packages/ui/src/components/dialog.tsx`
- [x] direction - `packages/ui/src/components/direction.tsx` (documented exception: pure `@base-ui/react/direction-provider` re-export)
- [x] drawer - `packages/ui/src/components/drawer.tsx`
- [x] dropdown-menu - `packages/ui/src/components/dropdown-menu.tsx`
- [x] empty - `packages/ui/src/components/empty.tsx`
- [x] field - `packages/ui/src/components/field.tsx`
- [x] form - `packages/ui/src/components/form.tsx`
- [x] hover-card - `packages/ui/src/components/hover-card.tsx`
- [x] input - `packages/ui/src/components/input.tsx`
- [x] input-group - `packages/ui/src/components/input-group.tsx`
- [x] input-otp - `packages/ui/src/components/input-otp.tsx`
- [x] item - `packages/ui/src/components/item.tsx`
- [x] kbd - `packages/ui/src/components/kbd.tsx`
- [x] label - `packages/ui/src/components/label.tsx`
- [x] menubar - `packages/ui/src/components/menubar.tsx`
- [x] native-select - `packages/ui/src/components/native-select.tsx`
- [ ] nav-sidebar-shell - `packages/ui/src/components/nav-sidebar-shell.tsx`
- [x] navigation-menu - `packages/ui/src/components/navigation-menu.tsx`
- [x] pagination - `packages/ui/src/components/pagination.tsx`
- [x] popover - `packages/ui/src/components/popover.tsx`
- [x] progress - `packages/ui/src/components/progress.tsx`
- [x] radio-group - `packages/ui/src/components/radio-group.tsx`
- [x] resizable - `packages/ui/src/components/resizable.tsx`
- [x] scroll-area - `packages/ui/src/components/scroll-area.tsx`
- [x] searchable-list-popover - `packages/ui/src/components/searchable-list-popover.tsx`
- [x] select - `packages/ui/src/components/select.tsx`
- [x] separator - `packages/ui/src/components/separator.tsx`
- [x] sheet - `packages/ui/src/components/sheet.tsx`
- [x] skeleton - `packages/ui/src/components/skeleton.tsx`
- [x] slider - `packages/ui/src/components/slider.tsx`
- [x] sonner - `packages/ui/src/components/sonner.tsx`
- [x] spinner - `packages/ui/src/components/spinner.tsx`
- [x] switch - `packages/ui/src/components/switch.tsx`
- [x] table - `packages/ui/src/components/table.tsx`
- [x] tabs - `packages/ui/src/components/tabs.tsx`
- [x] textarea - `packages/ui/src/components/textarea.tsx`
- [x] toggle - `packages/ui/src/components/toggle.tsx`
- [x] toggle-group - `packages/ui/src/components/toggle-group.tsx`
- [x] tooltip - `packages/ui/src/components/tooltip.tsx`

### AI Elements (50)

- [x] agent - `packages/ui/src/components/ai-elements/agent.tsx`
- [x] artifact - `packages/ui/src/components/ai-elements/artifact.tsx`
- [x] attachments - `packages/ui/src/components/ai-elements/attachments.tsx`
- [ ] audio-player - `packages/ui/src/components/ai-elements/audio-player.tsx`
- [x] canvas - `packages/ui/src/components/ai-elements/canvas.tsx`
- [x] chain-of-thought - `packages/ui/src/components/ai-elements/chain-of-thought.tsx`
- [x] checkpoint - `packages/ui/src/components/ai-elements/checkpoint.tsx`
- [x] code-block - `packages/ui/src/components/ai-elements/code-block.tsx`
- [x] commit - `packages/ui/src/components/ai-elements/commit.tsx`
- [x] confirmation - `packages/ui/src/components/ai-elements/confirmation.tsx`
- [ ] connection - `packages/ui/src/components/ai-elements/connection.tsx`
- [x] context - `packages/ui/src/components/ai-elements/context.tsx`
- [ ] controls - `packages/ui/src/components/ai-elements/controls.tsx`
- [x] conversation - `packages/ui/src/components/ai-elements/conversation.tsx`
- [x] diff - `packages/ui/src/components/ai-elements/diff.tsx`
- [ ] edge - `packages/ui/src/components/ai-elements/edge.tsx`
- [x] environment-variables - `packages/ui/src/components/ai-elements/environment-variables.tsx`
- [x] file-changes - `packages/ui/src/components/ai-elements/file-changes.tsx`
- [x] file-tree - `packages/ui/src/components/ai-elements/file-tree.tsx`
- [x] image - `packages/ui/src/components/ai-elements/image.tsx`
- [x] inline-citation - `packages/ui/src/components/ai-elements/inline-citation.tsx`
- [ ] jsx-preview - `packages/ui/src/components/ai-elements/jsx-preview.tsx`
- [x] message - `packages/ui/src/components/ai-elements/message.tsx`
- [ ] mic-selector - `packages/ui/src/components/ai-elements/mic-selector.tsx`
- [ ] model-selector - `packages/ui/src/components/ai-elements/model-selector.tsx`
- [ ] node - `packages/ui/src/components/ai-elements/node.tsx`
- [x] open-in-chat - `packages/ui/src/components/ai-elements/open-in-chat.tsx`
- [x] package-info - `packages/ui/src/components/ai-elements/package-info.tsx`
- [ ] panel - `packages/ui/src/components/ai-elements/panel.tsx`
- [ ] persona - `packages/ui/src/components/ai-elements/persona.tsx`
- [x] plan - `packages/ui/src/components/ai-elements/plan.tsx`
- [ ] prompt-input - `packages/ui/src/components/ai-elements/prompt-input.tsx`
- [x] queue - `packages/ui/src/components/ai-elements/queue.tsx`
- [x] reasoning - `packages/ui/src/components/ai-elements/reasoning.tsx`
- [x] sandbox - `packages/ui/src/components/ai-elements/sandbox.tsx`
- [x] schema-display - `packages/ui/src/components/ai-elements/schema-display.tsx`
- [x] shimmer - `packages/ui/src/components/ai-elements/shimmer.tsx`
- [x] snippet - `packages/ui/src/components/ai-elements/snippet.tsx`
- [x] sources - `packages/ui/src/components/ai-elements/sources.tsx`
- [ ] speech-input - `packages/ui/src/components/ai-elements/speech-input.tsx`
- [x] stack-trace - `packages/ui/src/components/ai-elements/stack-trace.tsx`
- [x] suggestion - `packages/ui/src/components/ai-elements/suggestion.tsx`
- [x] task - `packages/ui/src/components/ai-elements/task.tsx`
- [x] terminal - `packages/ui/src/components/ai-elements/terminal.tsx`
- [x] test-results - `packages/ui/src/components/ai-elements/test-results.tsx`
- [x] tool - `packages/ui/src/components/ai-elements/tool.tsx`
- [ ] toolbar - `packages/ui/src/components/ai-elements/toolbar.tsx`
- [x] transcription - `packages/ui/src/components/ai-elements/transcription.tsx`
- [ ] voice-selector - `packages/ui/src/components/ai-elements/voice-selector.tsx`
- [ ] web-preview - `packages/ui/src/components/ai-elements/web-preview.tsx`

### Animated Components (16)

- [ ] animated-collection - `packages/ui/src/components/animate/animated-collection.tsx`
- [ ] bottom-menu - `packages/ui/src/components/animate/bottom-menu.tsx`
- [ ] day-picker - `packages/ui/src/components/animate/day-picker.tsx`
- [ ] delete-button - `packages/ui/src/components/animate/delete-button.tsx`
- [ ] dynamic-toolbar - `packages/ui/src/components/animate/dynamic-toolbar.tsx`
- [ ] expandable-gallery - `packages/ui/src/components/animate/expandable-gallery.tsx`
- [ ] fluid-expanding-grid - `packages/ui/src/components/animate/fluid-expanding-grid.tsx`
- [ ] inline-edit - `packages/ui/src/components/animate/inline-edit.tsx`
- [ ] list-item - `packages/ui/src/components/animate/list-item.tsx`
- [ ] morphing-input - `packages/ui/src/components/animate/morphing-input.tsx`
- [ ] multi-step-form - `packages/ui/src/components/animate/multi-step-form.tsx`
- [ ] pricing-card - `packages/ui/src/components/animate/pricing-card.tsx`
- [x] smooth-dropdown - `packages/ui/src/components/animate/smooth-dropdown.tsx` (documented exception: pure `@ch5me/ch5-ui-web` re-export)
- [ ] stacked-list - `packages/ui/src/components/animate/stacked-list.tsx`
- [ ] status-button - `packages/ui/src/components/animate/status-button.tsx`
- [ ] vertical-tabs - `packages/ui/src/components/animate/vertical-tabs.tsx`

### Marketing Components (9)

- [x] 3d-book - `packages/ui/src/components/marketing/3d-book.tsx` (documented exception: pure `@ch5me/ch5-ui-web` re-export)
- [x] bento-card - `packages/ui/src/components/marketing/bento-card.tsx` (documented exception: pure `@ch5me/ch5-ui-web` re-export)
- [x] bucket - `packages/ui/src/components/marketing/bucket.tsx` (documented exception: pure `@ch5me/ch5-ui-web` re-export)
- [x] discover-button - `packages/ui/src/components/marketing/discover-button.tsx` (documented exception: pure `@ch5me/ch5-ui-web` re-export)
- [x] empty-testimonial - `packages/ui/src/components/marketing/empty-testimonial.tsx` (documented exception: pure `@ch5me/ch5-ui-web` re-export)
- [x] feature-carousel - `packages/ui/src/components/marketing/feature-carousel.tsx` (documented exception: pure `@ch5me/ch5-ui-web` re-export)
- [x] folder-interaction - `packages/ui/src/components/marketing/folder-interaction.tsx` (documented exception: pure `@ch5me/ch5-ui-web` re-export)
- [x] magnified-bento - `packages/ui/src/components/marketing/magnified-bento.tsx` (documented exception: pure `@ch5me/ch5-ui-web` re-export)
- [x] shake-testimonial-card - `packages/ui/src/components/marketing/shake-testimonial-card.tsx` (documented exception: pure `@ch5me/ch5-ui-web` re-export)

## Completion Gate

- [ ] Every item above has a Storybook story or intentional documented exception.
- [ ] `ch5 coverage elf --json` reports `visualComponentGaps: 0`, or remaining gaps are documented exceptions.
- [ ] Storybook renders all new stories without console/runtime errors.
- [ ] Mobile and desktop screenshot proof exists for covered Storybook targets.

## Gold Prompt

```text
/gold Work through docs/storybook-missing-ui-elements.md. For each unchecked local component, create a focused Storybook service order: inspect component API, skip imported-library pass-throughs with a documented exception, add representative stories under packages/storybook/src/stories for Palot-owned behavior/states, verify Storybook render locally, run CH5 coverage, then check the item only when coverage/proof passes. Batch related components when safe, keep stories realistic, and stop only when every missing local UI element is covered or documented as an intentional exception. Preserve existing repo patterns and do not weaken verification.
```
