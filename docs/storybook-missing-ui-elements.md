# Missing Storybook Coverage

Generated from `ch5 coverage elf --json` on 2026-06-13T23:24:15.908Z.

## Current Coverage

- Visual UI components: 134
- Covered by Storybook/route coverage: 13
- Missing Storybook representation: 121
- Story files: 14
- Story screenshot proof missing in CH5 formal coverage: 26 viewport captures
- Batch 01 local render proof: `.sisyphus/evidence/storybook-coverage/batch-01/render-proof.json`
- Reusable render proof helper: `bun run verify:storybook-render -- --out <proof-dir> <story-id> [...]`
- CH5 gap source scope: local `packages/ui/src/components/**` files only.
- Imported components from other packages/libraries are out of scope here. Trust their upstream stories/tests.
- Thin local wrappers around imported components need Palot stories only when they add local behavior, styling, composition, or app-specific states. Pure pass-through wrappers can become documented exceptions.

Covered components today:

- [x] button (packages/storybook/src/stories/foundations/button.stories.tsx)
- [x] discrete-tabs (packages/storybook/src/stories/foundations/discrete-tabs.stories.tsx)
- [x] sidebar (packages/storybook/src/stories/foundations/sidebar.stories.tsx)
- [x] alert (packages/storybook/src/stories/foundations/alert.stories.tsx)
- [x] avatar (packages/storybook/src/stories/foundations/avatar.stories.tsx)
- [x] badge (packages/storybook/src/stories/foundations/badge.stories.tsx)
- [x] card (packages/storybook/src/stories/foundations/card.stories.tsx)
- [x] empty (packages/storybook/src/stories/foundations/empty.stories.tsx)
- [x] kbd (packages/storybook/src/stories/foundations/kbd.stories.tsx)
- [x] progress (packages/storybook/src/stories/foundations/progress.stories.tsx)
- [x] separator (packages/storybook/src/stories/foundations/separator.stories.tsx)
- [x] skeleton (packages/storybook/src/stories/foundations/skeleton.stories.tsx)
- [x] spinner (packages/storybook/src/stories/foundations/spinner.stories.tsx)

## Missing Stories

Add one or more useful Storybook stories for each unchecked local component. Check items only after CH5 coverage sees representation and Storybook renders cleanly. If a component is only an imported-library pass-through, replace its checkbox with a checked documented exception and note the upstream package.

### UI Primitives (56)

- [ ] accordion - `packages/ui/src/components/accordion.tsx`
- [x] alert - `packages/ui/src/components/alert.tsx`
- [ ] alert-dialog - `packages/ui/src/components/alert-dialog.tsx`
- [ ] aspect-ratio - `packages/ui/src/components/aspect-ratio.tsx`
- [x] avatar - `packages/ui/src/components/avatar.tsx`
- [x] badge - `packages/ui/src/components/badge.tsx`
- [ ] breadcrumb - `packages/ui/src/components/breadcrumb.tsx`
- [ ] button-group - `packages/ui/src/components/button-group.tsx`
- [ ] calendar - `packages/ui/src/components/calendar.tsx`
- [x] card - `packages/ui/src/components/card.tsx`
- [ ] carousel - `packages/ui/src/components/carousel.tsx`
- [ ] chart - `packages/ui/src/components/chart.tsx`
- [ ] checkbox - `packages/ui/src/components/checkbox.tsx`
- [ ] collapsible - `packages/ui/src/components/collapsible.tsx`
- [ ] combobox - `packages/ui/src/components/combobox.tsx`
- [ ] command - `packages/ui/src/components/command.tsx`
- [ ] context-menu - `packages/ui/src/components/context-menu.tsx`
- [ ] dialog - `packages/ui/src/components/dialog.tsx`
- [ ] direction - `packages/ui/src/components/direction.tsx`
- [ ] drawer - `packages/ui/src/components/drawer.tsx`
- [ ] dropdown-menu - `packages/ui/src/components/dropdown-menu.tsx`
- [x] empty - `packages/ui/src/components/empty.tsx`
- [ ] field - `packages/ui/src/components/field.tsx`
- [ ] form - `packages/ui/src/components/form.tsx`
- [ ] hover-card - `packages/ui/src/components/hover-card.tsx`
- [ ] input - `packages/ui/src/components/input.tsx`
- [ ] input-group - `packages/ui/src/components/input-group.tsx`
- [ ] input-otp - `packages/ui/src/components/input-otp.tsx`
- [ ] item - `packages/ui/src/components/item.tsx`
- [x] kbd - `packages/ui/src/components/kbd.tsx`
- [ ] label - `packages/ui/src/components/label.tsx`
- [ ] menubar - `packages/ui/src/components/menubar.tsx`
- [ ] native-select - `packages/ui/src/components/native-select.tsx`
- [ ] nav-sidebar-shell - `packages/ui/src/components/nav-sidebar-shell.tsx`
- [ ] navigation-menu - `packages/ui/src/components/navigation-menu.tsx`
- [ ] pagination - `packages/ui/src/components/pagination.tsx`
- [ ] popover - `packages/ui/src/components/popover.tsx`
- [x] progress - `packages/ui/src/components/progress.tsx`
- [ ] radio-group - `packages/ui/src/components/radio-group.tsx`
- [ ] resizable - `packages/ui/src/components/resizable.tsx`
- [ ] scroll-area - `packages/ui/src/components/scroll-area.tsx`
- [ ] searchable-list-popover - `packages/ui/src/components/searchable-list-popover.tsx`
- [ ] select - `packages/ui/src/components/select.tsx`
- [x] separator - `packages/ui/src/components/separator.tsx`
- [ ] sheet - `packages/ui/src/components/sheet.tsx`
- [x] skeleton - `packages/ui/src/components/skeleton.tsx`
- [ ] slider - `packages/ui/src/components/slider.tsx`
- [ ] sonner - `packages/ui/src/components/sonner.tsx`
- [x] spinner - `packages/ui/src/components/spinner.tsx`
- [ ] switch - `packages/ui/src/components/switch.tsx`
- [ ] table - `packages/ui/src/components/table.tsx`
- [ ] tabs - `packages/ui/src/components/tabs.tsx`
- [ ] textarea - `packages/ui/src/components/textarea.tsx`
- [ ] toggle - `packages/ui/src/components/toggle.tsx`
- [ ] toggle-group - `packages/ui/src/components/toggle-group.tsx`
- [ ] tooltip - `packages/ui/src/components/tooltip.tsx`

### AI Elements (50)

- [ ] agent - `packages/ui/src/components/ai-elements/agent.tsx`
- [ ] artifact - `packages/ui/src/components/ai-elements/artifact.tsx`
- [ ] attachments - `packages/ui/src/components/ai-elements/attachments.tsx`
- [ ] audio-player - `packages/ui/src/components/ai-elements/audio-player.tsx`
- [ ] canvas - `packages/ui/src/components/ai-elements/canvas.tsx`
- [ ] chain-of-thought - `packages/ui/src/components/ai-elements/chain-of-thought.tsx`
- [ ] checkpoint - `packages/ui/src/components/ai-elements/checkpoint.tsx`
- [ ] code-block - `packages/ui/src/components/ai-elements/code-block.tsx`
- [ ] commit - `packages/ui/src/components/ai-elements/commit.tsx`
- [ ] confirmation - `packages/ui/src/components/ai-elements/confirmation.tsx`
- [ ] connection - `packages/ui/src/components/ai-elements/connection.tsx`
- [ ] context - `packages/ui/src/components/ai-elements/context.tsx`
- [ ] controls - `packages/ui/src/components/ai-elements/controls.tsx`
- [ ] conversation - `packages/ui/src/components/ai-elements/conversation.tsx`
- [ ] diff - `packages/ui/src/components/ai-elements/diff.tsx`
- [ ] edge - `packages/ui/src/components/ai-elements/edge.tsx`
- [ ] environment-variables - `packages/ui/src/components/ai-elements/environment-variables.tsx`
- [ ] file-changes - `packages/ui/src/components/ai-elements/file-changes.tsx`
- [ ] file-tree - `packages/ui/src/components/ai-elements/file-tree.tsx`
- [ ] image - `packages/ui/src/components/ai-elements/image.tsx`
- [ ] inline-citation - `packages/ui/src/components/ai-elements/inline-citation.tsx`
- [ ] jsx-preview - `packages/ui/src/components/ai-elements/jsx-preview.tsx`
- [ ] message - `packages/ui/src/components/ai-elements/message.tsx`
- [ ] mic-selector - `packages/ui/src/components/ai-elements/mic-selector.tsx`
- [ ] model-selector - `packages/ui/src/components/ai-elements/model-selector.tsx`
- [ ] node - `packages/ui/src/components/ai-elements/node.tsx`
- [ ] open-in-chat - `packages/ui/src/components/ai-elements/open-in-chat.tsx`
- [ ] package-info - `packages/ui/src/components/ai-elements/package-info.tsx`
- [ ] panel - `packages/ui/src/components/ai-elements/panel.tsx`
- [ ] persona - `packages/ui/src/components/ai-elements/persona.tsx`
- [ ] plan - `packages/ui/src/components/ai-elements/plan.tsx`
- [ ] prompt-input - `packages/ui/src/components/ai-elements/prompt-input.tsx`
- [ ] queue - `packages/ui/src/components/ai-elements/queue.tsx`
- [ ] reasoning - `packages/ui/src/components/ai-elements/reasoning.tsx`
- [ ] sandbox - `packages/ui/src/components/ai-elements/sandbox.tsx`
- [ ] schema-display - `packages/ui/src/components/ai-elements/schema-display.tsx`
- [ ] shimmer - `packages/ui/src/components/ai-elements/shimmer.tsx`
- [ ] snippet - `packages/ui/src/components/ai-elements/snippet.tsx`
- [ ] sources - `packages/ui/src/components/ai-elements/sources.tsx`
- [ ] speech-input - `packages/ui/src/components/ai-elements/speech-input.tsx`
- [ ] stack-trace - `packages/ui/src/components/ai-elements/stack-trace.tsx`
- [ ] suggestion - `packages/ui/src/components/ai-elements/suggestion.tsx`
- [ ] task - `packages/ui/src/components/ai-elements/task.tsx`
- [ ] terminal - `packages/ui/src/components/ai-elements/terminal.tsx`
- [ ] test-results - `packages/ui/src/components/ai-elements/test-results.tsx`
- [ ] tool - `packages/ui/src/components/ai-elements/tool.tsx`
- [ ] toolbar - `packages/ui/src/components/ai-elements/toolbar.tsx`
- [ ] transcription - `packages/ui/src/components/ai-elements/transcription.tsx`
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
- [ ] smooth-dropdown - `packages/ui/src/components/animate/smooth-dropdown.tsx`
- [ ] stacked-list - `packages/ui/src/components/animate/stacked-list.tsx`
- [ ] status-button - `packages/ui/src/components/animate/status-button.tsx`
- [ ] vertical-tabs - `packages/ui/src/components/animate/vertical-tabs.tsx`

### Marketing Components (9)

- [ ] 3d-book - `packages/ui/src/components/marketing/3d-book.tsx`
- [ ] bento-card - `packages/ui/src/components/marketing/bento-card.tsx`
- [ ] bucket - `packages/ui/src/components/marketing/bucket.tsx`
- [ ] discover-button - `packages/ui/src/components/marketing/discover-button.tsx`
- [ ] empty-testimonial - `packages/ui/src/components/marketing/empty-testimonial.tsx`
- [ ] feature-carousel - `packages/ui/src/components/marketing/feature-carousel.tsx`
- [ ] folder-interaction - `packages/ui/src/components/marketing/folder-interaction.tsx`
- [ ] magnified-bento - `packages/ui/src/components/marketing/magnified-bento.tsx`
- [ ] shake-testimonial-card - `packages/ui/src/components/marketing/shake-testimonial-card.tsx`

## Completion Gate

- [ ] Every item above has a Storybook story or intentional documented exception.
- [ ] `ch5 coverage elf --json` reports `visualComponentGaps: 0`, or remaining gaps are documented exceptions.
- [ ] Storybook renders all new stories without console/runtime errors.
- [ ] Mobile and desktop screenshot proof exists for covered Storybook targets.

## Gold Prompt

```text
/gold Work through docs/storybook-missing-ui-elements.md. For each unchecked local component, create a focused Storybook service order: inspect component API, skip imported-library pass-throughs with a documented exception, add representative stories under packages/storybook/src/stories for Palot-owned behavior/states, verify Storybook render locally, run CH5 coverage, then check the item only when coverage/proof passes. Batch related components when safe, keep stories realistic, and stop only when every missing local UI element is covered or documented as an intentional exception. Preserve existing repo patterns and do not weaken verification.
```
