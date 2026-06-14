# UI Component Unification Audit

Date: 2026-06-14  
Repos compared:

- Palot local UI: `/Users/hassoncs/src/ch5/palot/packages/ui/src/components`
- Palot app renderer components: `/Users/hassoncs/src/ch5/palot/apps/desktop/src/renderer/components`
- Generic CH5 web UI: `/Users/hassoncs/src/ch5/ch5-packages/packages/web/ch5-ui-web/src`

## Source Of Truth Used

- `ch5 scan palot --json`: 141 component nodes, 166 story nodes, 6 test nodes, 0 scanner errors.
- `ch5 scan ch5-packages --json`: 366 component nodes, 566 story nodes, 0 scanner errors after the CH5 CLI nested-package scanner fix.
- AST/text inventory over TS/TSX source filled the component/export/prop comparison below.

## ✅ MIGRATION COMPLETE (2026-06-14)

The plan landed. `@ch5me/elf-ui` is now a thin compatibility layer: every reusable
primitive re-exports from `@ch5me/ch5-ui-web`, and the initial agent/chat surfaces
re-export from the new `@ch5me/agent-ui-web`. Both repos are green at every gate
(`bun run check-types` across ui/storybook/desktop; ch5-ui-web typecheck + tests +
boundary + build), and all work is committed + pushed.

**Final elf-ui shape (`packages/ui/src/components/`):** 55 of 58 component files are
one-line compat shims (`export * from "@ch5me/ch5-ui-web"`). The 3 still-local are
genuinely app-bound (Palot data/routing/cmdk), not regressions: `chart`, `command`,
`direction`.

The P1 generic composites are now also genericized into ch5-ui-web and shimmed:
`combobox` (base-ui), `searchable-list-popover`, and the brandless `nav-sidebar-shell`
shell (incl. `AppShellChrome` + `AppSidebarShellFrame`) — each a verbatim port with
local imports, ported proof stories, and export-presence tests.

**ai-elements (`packages/ui/src/components/ai-elements/`):** 12 of 50 files shim to
`@ch5me/agent-ui-web` (the agreed initial set: PromptInput, Message, Conversation,
Reasoning, Tool, Task, CodeBlock, FileChanges, Diff, Terminal, InlineCitation,
Sources). The remaining 38 are out of the initial agent-ui-web scope.

**What was migrated into ch5-ui-web (all base-ui, CH5 semantic tokens, ch5 semantic
motion preserved):** button, badge, avatar, card (+size), switch, radio-group,
checkbox, slider, breadcrumb, progress (+Track/Indicator/Label/Value), input-group,
popover, dialog, sheet, select, accordion, alert-dialog (+Overlay/Portal/Media),
tabs, sidebar (asChild→useRender on 5 subparts, +embedded/dir), field (composition
kit; old all-in-one row → `FieldRow`). Plus the already-aligned shims: separator,
label, input, form. `react-hook-form` moved to a peerDependency and deduped via
cross-repo tsconfig `paths` (alongside lucide-react/react/react-dom).

**Scan-count note:** post-migration `ch5 scan palot` reports MORE component nodes
(261), not fewer. This is expected and not a regression: barrel re-export shims
(`export * from "@ch5me/ch5-ui-web"`) make the scanner attribute ch5-ui-web's
re-exported symbols to Palot. The meaningful outcome — Palot no longer forks the
reusable primitives; CH5 owns them — is achieved regardless of the raw node count.

**Outstanding (human-gated / future scope):**
- Palette app visual smoke (sidebar, command palette, chat composer, message
  rendering, settings, onboarding, side-panel route) needs a running app + human
  sign-off. Automated gates all pass; ports were verbatim from Palot so the CH5
  proof stories are the parity reference.
- Optional cleanup: prune Palot-local stories now duplicated by ch5-ui-web stories.
- P1 composites (combobox / searchable-list-popover / nav-sidebar-shell): DONE —
  genericized into ch5-ui-web with stories + tests, shimmed in elf-ui.

## Executive Read

- Palot still owns a large local UI package: 134 component files, 521 exported symbols.
- Generic CH5 web UI is larger and already has most primitives/effects: 294 source files, 710 exported symbols in inventory.
- 57 Palot UI files have same-name generic equivalents and no local-only export gaps.
- 8 Palot UI files have generic equivalents but missing/local-only exports, so they need upstreaming or adapters.
- 11 Palot UI files already pass through or consume `@ch5me/ch5-ui-web`.
- 58 Palot UI files have no generic equivalent by basename/export scan; most are AI/chat-specific.
- Desktop renderer components are mostly product surfaces. Archive/migration pressure should start in `packages/ui`, not app routes/panels.

## Current Package Shape

| Package | Role | Current limitation |
| --- | --- | --- |
| `@ch5me/elf-ui` | Palot-local UI library, imported by app and Storybook | Mixes local Base UI/shadcn-style primitives, AI elements, app shell, and pass-through generic components. It keeps Palot as a UI fork. |
| `@ch5me/ch5-ui-web` | Generic CH5 web primitive/effects library | Broader library with Radix/shared semantic motion tokens. Missing several Palot-specific AI/chat surfaces and some local convenience exports. |
| `apps/desktop/src/renderer/components` | Product/app components | Tied to Jotai atoms, IPC/backend services, session state, onboarding, settings, PM dashboards, and plugin panels. Mostly not generic UI library candidates. |

## Migration Buckets

| Bucket | Count | Meaning | Default action |
| --- | --- | --- | --- |
| already shim/imports generic | 11 | Local file already imports or re-exports generic CH5 component. | Move consumers to generic import; delete local wrapper when no references remain. |
| candidate direct replace | 57 | Same-name generic file/export exists; no local-only export gaps detected. | Swap one family at a time; verify Storybook + app visual path because styling/primitive engine often differs. |
| candidate with API gaps | 8 | Generic equivalent exists but local API is broader/different. | Upstream missing exports or keep temporary adapter. No blind delete. |
| no generic match | 58 | No generic equivalent found. | Keep local or promote to ch5-ui-web only if reusable across CH5 products. |

## Highest-Value Replacement Order

1. Pass-through wrappers: marketing files and `animate/smooth-dropdown.tsx`. These are already generic; remove local path churn first.
2. Exact-ish low-risk primitives: `aspect-ratio`, `calendar`, `resizable`, `spinner`, `toggle-group`, `animate/expandable-gallery`.
3. Base primitives with same exports but style/engine deltas: `button`, `badge`, `input`, `select`, `dialog`, `dropdown-menu`, `tooltip`, `sidebar`.
4. API-gap primitives: `avatar`, `card`, `popover`, `progress`, `tabs`, `alert`, AI `file-tree`, AI `terminal`.
5. AI elements: treat as a separate upstream decision. They are generic in concept but currently Palot-owned and large.

## Recommendations

My recommendation: do not bulk-replace Palot primitives with the current generic CH5 versions yet. Use Palot's desktop density, sizing, radius, icon scale, and compact command-surface feel as the parity target, then backport missing capabilities into `@ch5me/ch5-ui-web` before switching consumers.

### Recommended North Star

- `@ch5me/ch5-ui-web` should own generic primitives, motion/effects, reusable app-shell parts, and reusable agent/chat UI.
- `@ch5me/elf-ui` should shrink into a temporary compatibility layer plus any truly Palot-only surfaces.
- Palot app components should import generic primitives, but keep product data binding, routes, IPC, Jotai state, onboarding logic, settings logic, and PM/session panels local.
- A replacement is ready only when side-by-side Storybook stories match size, shape, spacing, interaction states, and visual weight closely enough that Palot does not feel like it changed product language.

### Backport First

These are missing or stronger in Palot and should move into CH5 UI before app replacement work:

| Priority | Backport target | Why |
| --- | --- | --- |
| P0 | `Button` size/variant parity: `xs`, `icon-xs`, `icon-lg`, compact padding, current icon sizing | Too many Palot surfaces assume dense controls. Replacing without this changes app feel everywhere. |
| P0 | `InputGroup`, `ButtonGroup`, `Item`, `Empty`, `Kbd`, `NativeSelect` | Generic primitives with no current CH5 equivalent; good shared library candidates. |
| P0 | API-gap compound exports: `CardAction`, `AlertAction`, `AvatarGroup`, `AvatarBadge`, `AvatarGroupCount`, `PopoverHeader/Title/Description`, `ProgressTrack/Label/Value/Indicator`, `tabsListVariants` | Small upstream additions unblock many thin re-export migrations. |
| P1 | `Combobox` and `SearchableListPopover` | Useful command/search primitives; likely reusable across agent apps, settings, and admin tools. |
| P1 | `nav-sidebar-shell` as brandless shell pieces: `AppShellChrome`, `AppSidebarShellFrame`, sidebar layout frame | Structure is reusable; Palot labels, data model, wordmark, session grouping stay local. |
| P1 | Agent/chat core: `PromptInput`, `Message`, `Conversation`, `Reasoning`, `Tool`, `Task`, `CodeBlock`, `FileChanges`, `Diff`, `Terminal`, `InlineCitation`, `Sources` | These are product-domain generic for CH5 agent apps, not Palot-only. Move as an `ai-elements` or `agent-ui` namespace. |
| P2 | `Chart` | Useful, but only after token/theming contract is clear around Recharts. |
| P2 | Model/voice/mic selectors | Generic if CH5 standardizes provider/model/voice data shapes; otherwise keep adapters local. |

### Replace Now

- Pass-through marketing wrappers: delete local wrappers after import moves.
- `animate/smooth-dropdown.tsx`: already generic; direct consumer migration is low risk.
- Exact-ish primitives can become compatibility re-exports after side-by-side proof: `aspect-ratio`, `calendar`, `resizable`, `spinner`, `toggle-group`, `animate/expandable-gallery`.

### Replace After Upstream Parity

- `button`, `badge`, `input`, `textarea`, `select`, `dialog`, `dropdown-menu`, `tooltip`, `sidebar`, `sheet`, `tabs`, `progress`.
- These must be judged by screenshots, not just export matching. Current generic versions often differ in primitive engine, transition tokens, padding, border treatment, and compact sizing.
- If generic looks less dense or less desktop-native, fix `ch5-ui-web` first. Do not preserve a Palot-only fork to keep the app looking right.

### Keep Local For Now

- Product pages/panels: settings, onboarding, PM dashboards, session panels, browser panels, app routes.
- Data-bound shells: Palot sidebar session grouping, command palette actions, project/session state, automation state.
- GenUI registry/rendering glue until CH5 has a cross-product GenUI contract.
- Any component whose props include Palot/OpenCode/Firefly runtime concepts rather than plain UI concerns.

### Genericization Rule

Genericize when at least one is true:

- Component is a primitive shape with no product nouns.
- Component appears in two CH5 products or clearly will.
- Component can be configured with data props, not runtime/service imports.
- Component can be demonstrated in Storybook without Palot atoms, IPC, router state, or backend calls.

Keep local when any is true:

- Component owns Palot routing, session lifecycle, OpenCode state, PM state, or Firefly auth/runtime behavior.
- Component copy, grouping, or visual hierarchy is product-specific.
- Genericizing would require exporting Palot data models into CH5 UI.
- Only benefit is deleting a file, not creating a reusable CH5 primitive.

### Parity Gate

Every replacement/backport should produce one Storybook comparison story before app migration:

- Local Palot component and generic CH5 candidate rendered side by side.
- Dense desktop state, empty state, loading state, error/invalid state, keyboard/focus state, and disabled state covered when relevant.
- Pixel-level judgment is manual for now: same height, icon size, radius, border contrast, text weight, spacing, hover/active timing, and dark/light token behavior.
- App migration only after the generic version passes the comparison story.

## Known Compatibility Risks

- Primitive engine mismatch: Palot local files frequently use `@base-ui/react`; generic `ch5-ui-web` frequently uses Radix primitives and semantic motion helpers.
- Variant mismatch: local `Button` has `xs`, `icon-xs`, `icon-lg`; generic `Button` has `primary`, `md`, no `xs` or `icon-lg`.
- Compound export mismatch: local `Progress` exports track/label/value/indicator; generic only exports `Progress` with `indicatorClassName`.
- Token mismatch: local styles use Palot/Elf token assumptions; generic styles use CH5 design/semantic motion tokens.
- Import topology: Palot app imports `@ch5me/elf-ui/components/*` subpaths heavily. Replacing source is easier than changing every app import first.

## Palot UI Package Audit

| Local file | Area | Status | Exports / components | Props / requirements | Generic match | Risk | Recommended action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| packages/ui/src/components/accordion.tsx | foundations | candidate direct replace | Accordion<br>AccordionContent<br>AccordionItem<br>AccordionTrigger |  | packages/web/ch5-ui-web/src/accordion.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/ai-elements/agent.tsx | ai-elements | no generic match | Agent<br>AgentContent<br>AgentHeader<br>AgentInstructions<br>AgentOutput<br>AgentTool<br>AgentTools | AgentContentProps<br>AgentHeaderProps<br>AgentInstructionsProps<br>AgentOutputProps<br>AgentProps<br>AgentToolProps<br>AgentToolsProps |  | Unknown generic fit; deps: ai, lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/artifact.tsx | ai-elements | no generic match | Artifact<br>ArtifactAction<br>ArtifactActions<br>ArtifactClose<br>ArtifactContent<br>ArtifactDescription<br>ArtifactHeader<br>ArtifactTitle | ArtifactActionProps<br>ArtifactActionsProps<br>ArtifactCloseProps<br>ArtifactContentProps<br>ArtifactDescriptionProps<br>ArtifactHeaderProps<br>ArtifactProps<br>ArtifactTitleProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/attachments.tsx | ai-elements | no generic match | Attachment<br>AttachmentEmpty<br>AttachmentHoverCard<br>AttachmentHoverCardContent<br>AttachmentHoverCardTrigger<br>AttachmentInfo<br>AttachmentPreview<br>AttachmentRemove<br>Attachments | AttachmentEmptyProps<br>AttachmentHoverCardContentProps<br>AttachmentHoverCardProps<br>AttachmentHoverCardTriggerProps<br>AttachmentInfoProps<br>AttachmentPreviewProps<br>AttachmentProps<br>AttachmentRemoveProps<br>AttachmentsProps |  | Unknown generic fit; deps: ai, lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/audio-player.tsx | ai-elements | no generic match | AudioPlayer<br>AudioPlayerControlBar<br>AudioPlayerDurationDisplay<br>AudioPlayerElement<br>AudioPlayerMuteButton<br>AudioPlayerPlayButton<br>AudioPlayerSeekBackwardButton<br>AudioPlayerSeekForwardButton<br>AudioPlayerTimeDisplay<br>AudioPlayerTimeRange<br>AudioPlayerVolumeRange | AudioPlayerControlBarProps<br>AudioPlayerDurationDisplayProps<br>AudioPlayerElementProps<br>AudioPlayerMuteButtonProps<br>AudioPlayerPlayButtonProps<br>AudioPlayerProps<br>AudioPlayerSeekBackwardButtonProps<br>AudioPlayerSeekForwardButtonProps<br>AudioPlayerTimeDisplayProps<br>AudioPlayerTimeRangeProps<br>AudioPlayerVolumeRangeProps |  | Unknown generic fit; deps: ai, media-chrome/react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/canvas.tsx | ai-elements | no generic match | Canvas |  |  | Unknown generic fit; deps: @xyflow/react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/chain-of-thought.tsx | ai-elements | no generic match | ChainOfThought<br>ChainOfThoughtContent<br>ChainOfThoughtHeader<br>ChainOfThoughtImage<br>ChainOfThoughtSearchResult<br>ChainOfThoughtSearchResults<br>ChainOfThoughtStep | ChainOfThoughtContentProps<br>ChainOfThoughtHeaderProps<br>ChainOfThoughtImageProps<br>ChainOfThoughtProps<br>ChainOfThoughtSearchResultProps<br>ChainOfThoughtSearchResultsProps<br>ChainOfThoughtStepProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/checkpoint.tsx | ai-elements | no generic match | Checkpoint<br>CheckpointIcon<br>CheckpointTrigger | CheckpointIconProps<br>CheckpointProps<br>CheckpointTriggerProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/code-block.tsx | ai-elements | no generic match | CodeBlock<br>CodeBlockActions<br>CodeBlockContainer<br>CodeBlockContent<br>CodeBlockCopyButton<br>CodeBlockFilename<br>CodeBlockHeader<br>CodeBlockLanguageSelector<br>CodeBlockLanguageSelectorContent<br>CodeBlockLanguageSelectorItem<br>CodeBlockLanguageSelectorTrigger<br>CodeBlockLanguageSelectorValue<br>CodeBlockTitle | CodeBlockCopyButtonProps<br>CodeBlockLanguageSelectorContentProps<br>CodeBlockLanguageSelectorItemProps<br>CodeBlockLanguageSelectorProps<br>CodeBlockLanguageSelectorTriggerProps<br>CodeBlockLanguageSelectorValueProps |  | Unknown generic fit; deps: lucide-react, react, shiki | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/commit.tsx | ai-elements | no generic match | Commit<br>CommitActions<br>CommitAuthor<br>CommitAuthorAvatar<br>CommitContent<br>CommitCopyButton<br>CommitFile<br>CommitFileAdditions<br>CommitFileChanges<br>CommitFileDeletions<br>CommitFileIcon<br>CommitFileInfo<br>CommitFilePath<br>CommitFileStatus<br>CommitFiles<br>CommitHash<br>CommitHeader<br>CommitInfo<br>CommitMessage<br>CommitMetadata<br>CommitSeparator<br>CommitTimestamp | CommitActionsProps<br>CommitAuthorAvatarProps<br>CommitAuthorProps<br>CommitContentProps<br>CommitCopyButtonProps<br>CommitFileAdditionsProps<br>CommitFileChangesProps<br>CommitFileDeletionsProps<br>CommitFileIconProps<br>CommitFileInfoProps<br>CommitFilePathProps<br>CommitFileProps<br>CommitFileStatusProps<br>CommitFilesProps<br>CommitHashProps<br>CommitHeaderProps<br>CommitInfoProps<br>CommitMessageProps<br>CommitMetadataProps<br>CommitProps<br>CommitSeparatorProps<br>CommitTimestampProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/confirmation.tsx | ai-elements | no generic match | Confirmation<br>ConfirmationAccepted<br>ConfirmationAction<br>ConfirmationActions<br>ConfirmationRejected<br>ConfirmationRequest<br>ConfirmationTitle | ConfirmationAcceptedProps<br>ConfirmationActionProps<br>ConfirmationActionsProps<br>ConfirmationProps<br>ConfirmationRejectedProps<br>ConfirmationRequestProps<br>ConfirmationTitleProps |  | Unknown generic fit; deps: ai, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/connection.tsx | ai-elements | no generic match | Connection |  |  | Unknown generic fit; deps: @xyflow/react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/context.tsx | ai-elements | no generic match | Context<br>ContextCacheUsage<br>ContextContent<br>ContextContentBody<br>ContextContentFooter<br>ContextContentHeader<br>ContextInputUsage<br>ContextOutputUsage<br>ContextReasoningUsage<br>ContextTrigger | ContextCacheUsageProps<br>ContextContentBodyProps<br>ContextContentFooterProps<br>ContextContentHeaderProps<br>ContextContentProps<br>ContextInputUsageProps<br>ContextOutputUsageProps<br>ContextProps<br>ContextReasoningUsageProps<br>ContextTriggerProps |  | Unknown generic fit; deps: ai, react, tokenlens | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/controls.tsx | ai-elements | no generic match | Controls | ControlsProps |  | Unknown generic fit; deps: @xyflow/react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/conversation.tsx | ai-elements | no generic match | Conversation<br>ConversationContent<br>ConversationDownload<br>ConversationEmptyState<br>ConversationScrollButton<br>useStickToBottomContext | ConversationContentProps<br>ConversationDownloadProps<br>ConversationEmptyStateProps<br>ConversationProps<br>ConversationScrollButtonProps |  | Unknown generic fit; deps: lucide-react, react, use-stick-to-bottom | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/diff.tsx | ai-elements | no generic match | Diff<br>DiffActions<br>DiffContent<br>DiffCopyButton<br>DiffHeader<br>DiffStats<br>DiffTitle | DiffActionsProps<br>DiffContentProps<br>DiffCopyButtonProps<br>DiffHeaderProps<br>DiffProps<br>DiffStatsProps<br>DiffTitleProps |  | Unknown generic fit; deps: @pierre/diffs/react, lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/edge.tsx | ai-elements | no generic match | Edge |  |  | Unknown generic fit; deps: @xyflow/react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/environment-variables.tsx | ai-elements | no generic match | EnvironmentVariable<br>EnvironmentVariableCopyButton<br>EnvironmentVariableGroup<br>EnvironmentVariableName<br>EnvironmentVariableRequired<br>EnvironmentVariableValue<br>EnvironmentVariables<br>EnvironmentVariablesContent<br>EnvironmentVariablesHeader<br>EnvironmentVariablesTitle<br>EnvironmentVariablesToggle | EnvironmentVariableCopyButtonProps<br>EnvironmentVariableGroupProps<br>EnvironmentVariableNameProps<br>EnvironmentVariableProps<br>EnvironmentVariableRequiredProps<br>EnvironmentVariableValueProps<br>EnvironmentVariablesContentProps<br>EnvironmentVariablesHeaderProps<br>EnvironmentVariablesProps<br>EnvironmentVariablesTitleProps<br>EnvironmentVariablesToggleProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/file-changes.tsx | ai-elements | no generic match | FileChanges<br>FileChangesAcceptButton<br>FileChangesActions<br>FileChangesContent<br>FileChangesCopyButton<br>FileChangesExpandButton<br>FileChangesHeader<br>FileChangesIcon<br>FileChangesMoreButton<br>FileChangesRejectButton<br>FileChangesStats<br>FileChangesTitle | FileChangesAcceptButtonProps<br>FileChangesActionsProps<br>FileChangesContentProps<br>FileChangesCopyButtonProps<br>FileChangesExpandButtonProps<br>FileChangesHeaderProps<br>FileChangesIconProps<br>FileChangesMoreButtonProps<br>FileChangesProps<br>FileChangesRejectButtonProps<br>FileChangesStatsProps<br>FileChangesTitleProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/file-tree.tsx | ai-elements | candidate with API gaps | FileTree<br>FileTreeActions<br>FileTreeFile<br>FileTreeFolder<br>FileTreeIcon<br>FileTreeName | FileTreeActionsProps<br>FileTreeFileProps<br>FileTreeFolderProps<br>FileTreeIconProps<br>FileTreeNameProps<br>FileTreeProps | packages/web/ch5-ui-web/src/magicui/file-tree.tsx | High: local export surface is broader or semantically different. | Do not direct delete. Either upstream missing local exports into ch5-ui-web or keep a thin adapter until consumers migrate. |
| packages/ui/src/components/ai-elements/image.tsx | ai-elements | no generic match | Image | ImageProps |  | Unknown generic fit; deps: ai | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/inline-citation.tsx | ai-elements | no generic match | InlineCitation<br>InlineCitationCard<br>InlineCitationCardBody<br>InlineCitationCardTrigger<br>InlineCitationCarousel<br>InlineCitationCarouselContent<br>InlineCitationCarouselHeader<br>InlineCitationCarouselIndex<br>InlineCitationCarouselItem<br>InlineCitationCarouselNext<br>InlineCitationCarouselPrev<br>InlineCitationQuote<br>InlineCitationSource<br>InlineCitationText | InlineCitationCardBodyProps<br>InlineCitationCardProps<br>InlineCitationCardTriggerProps<br>InlineCitationCarouselContentProps<br>InlineCitationCarouselHeaderProps<br>InlineCitationCarouselIndexProps<br>InlineCitationCarouselItemProps<br>InlineCitationCarouselNextProps<br>InlineCitationCarouselPrevProps<br>InlineCitationCarouselProps<br>InlineCitationProps<br>InlineCitationQuoteProps<br>InlineCitationSourceProps<br>InlineCitationTextProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/jsx-preview.tsx | ai-elements | no generic match | JSXPreview<br>JSXPreviewContent<br>JSXPreviewError | JSXPreviewContentProps<br>JSXPreviewErrorProps<br>JSXPreviewProps |  | Unknown generic fit; deps: lucide-react, react, react-jsx-parser | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/message.tsx | ai-elements | no generic match | Message<br>MessageAction<br>MessageActions<br>MessageBranch<br>MessageBranchContent<br>MessageBranchNext<br>MessageBranchPage<br>MessageBranchPrevious<br>MessageBranchSelector<br>MessageContent<br>MessageResponse<br>MessageToolbar | MessageActionProps<br>MessageActionsProps<br>MessageBranchContentProps<br>MessageBranchNextProps<br>MessageBranchPageProps<br>MessageBranchPreviousProps<br>MessageBranchProps<br>MessageBranchSelectorProps<br>MessageContentProps<br>MessageProps<br>MessageResponseProps<br>MessageToolbarProps |  | Unknown generic fit; deps: @streamdown/cjk, @streamdown/math, @streamdown/mermaid, ai | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/mic-selector.tsx | ai-elements | no generic match | MicSelector<br>MicSelectorContent<br>MicSelectorEmpty<br>MicSelectorInput<br>MicSelectorItem<br>MicSelectorLabel<br>MicSelectorList<br>MicSelectorTrigger<br>MicSelectorValue | MicSelectorContentProps<br>MicSelectorEmptyProps<br>MicSelectorInputProps<br>MicSelectorItemProps<br>MicSelectorLabelProps<br>MicSelectorListProps<br>MicSelectorProps<br>MicSelectorTriggerProps<br>MicSelectorValueProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/model-selector.tsx | ai-elements | no generic match | ModelSelector<br>ModelSelectorContent<br>ModelSelectorDialog<br>ModelSelectorEmpty<br>ModelSelectorGroup<br>ModelSelectorInput<br>ModelSelectorItem<br>ModelSelectorList<br>ModelSelectorLogo<br>ModelSelectorLogoGroup<br>ModelSelectorName<br>ModelSelectorSeparator<br>ModelSelectorShortcut<br>ModelSelectorTrigger | ModelSelectorContentProps<br>ModelSelectorDialogProps<br>ModelSelectorEmptyProps<br>ModelSelectorGroupProps<br>ModelSelectorInputProps<br>ModelSelectorItemProps<br>ModelSelectorListProps<br>ModelSelectorLogoGroupProps<br>ModelSelectorLogoProps<br>ModelSelectorNameProps<br>ModelSelectorProps<br>ModelSelectorSeparatorProps<br>ModelSelectorShortcutProps<br>ModelSelectorTriggerProps |  | Unknown generic fit; deps: react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/node.tsx | ai-elements | no generic match | Node<br>NodeAction<br>NodeContent<br>NodeDescription<br>NodeFooter<br>NodeHeader<br>NodeTitle | NodeActionProps<br>NodeContentProps<br>NodeDescriptionProps<br>NodeFooterProps<br>NodeHeaderProps<br>NodeProps<br>NodeTitleProps |  | Unknown generic fit; deps: @xyflow/react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/open-in-chat.tsx | ai-elements | no generic match | OpenIn<br>OpenInChatGPT<br>OpenInClaude<br>OpenInContent<br>OpenInCursor<br>OpenInItem<br>OpenInLabel<br>OpenInScira<br>OpenInSeparator<br>OpenInT3<br>OpenInTrigger<br>OpenInv0 | OpenInChatGPTProps<br>OpenInClaudeProps<br>OpenInContentProps<br>OpenInCursorProps<br>OpenInItemProps<br>OpenInLabelProps<br>OpenInProps<br>OpenInSciraProps<br>OpenInSeparatorProps<br>OpenInT3Props<br>OpenInTriggerProps<br>OpenInv0Props |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/package-info.tsx | ai-elements | no generic match | PackageInfo<br>PackageInfoChangeType<br>PackageInfoContent<br>PackageInfoDependencies<br>PackageInfoDependency<br>PackageInfoDescription<br>PackageInfoHeader<br>PackageInfoName<br>PackageInfoVersion | PackageInfoChangeTypeProps<br>PackageInfoContentProps<br>PackageInfoDependenciesProps<br>PackageInfoDependencyProps<br>PackageInfoDescriptionProps<br>PackageInfoHeaderProps<br>PackageInfoNameProps<br>PackageInfoProps<br>PackageInfoVersionProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/panel.tsx | ai-elements | no generic match | Panel |  |  | Unknown generic fit; deps: @xyflow/react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/persona.tsx | ai-elements | no generic match | Persona |  |  | Unknown generic fit; deps: @rive-app/react-webgl2, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/plan.tsx | ai-elements | no generic match | Plan<br>PlanAction<br>PlanContent<br>PlanDescription<br>PlanFooter<br>PlanHeader<br>PlanTitle<br>PlanTrigger | PlanActionProps<br>PlanContentProps<br>PlanDescriptionProps<br>PlanFooterProps<br>PlanHeaderProps<br>PlanProps<br>PlanTitleProps<br>PlanTriggerProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/prompt-input.tsx | ai-elements | no generic match | LocalReferencedSourcesContext<br>PromptInput<br>PromptInputActionAddAttachments<br>PromptInputActionMenu<br>PromptInputActionMenuContent<br>PromptInputActionMenuItem<br>PromptInputActionMenuTrigger<br>PromptInputBody<br>PromptInputButton<br>PromptInputCommand<br>PromptInputCommandEmpty<br>PromptInputCommandGroup<br>PromptInputCommandInput<br>PromptInputCommandItem<br>PromptInputCommandList<br>PromptInputCommandSeparator<br>PromptInputFooter<br>PromptInputHeader<br>PromptInputHoverCard<br>PromptInputHoverCardContent<br>PromptInputHoverCardTrigger<br>PromptInputProvider<br>PromptInputSelect<br>PromptInputSelectContent<br>PromptInputSelectItem<br>PromptInputSelectTrigger<br>PromptInputSelectValue<br>PromptInputSubmit<br>PromptInputTab<br>PromptInputTabBody<br>PromptInputTabItem<br>PromptInputTabLabel<br>PromptInputTabsList<br>PromptInputTextarea<br>PromptInputTools | PromptInputActionAddAttachmentsProps<br>PromptInputActionMenuContentProps<br>PromptInputActionMenuItemProps<br>PromptInputActionMenuProps<br>PromptInputActionMenuTriggerProps<br>PromptInputBodyProps<br>PromptInputButtonProps<br>PromptInputCommandEmptyProps<br>PromptInputCommandGroupProps<br>PromptInputCommandInputProps<br>PromptInputCommandItemProps<br>PromptInputCommandListProps<br>PromptInputCommandProps<br>PromptInputCommandSeparatorProps<br>PromptInputControllerProps<br>PromptInputFooterProps<br>PromptInputHeaderProps<br>PromptInputHoverCardContentProps<br>PromptInputHoverCardProps<br>PromptInputHoverCardTriggerProps<br>PromptInputProps<br>PromptInputProviderProps<br>PromptInputSelectContentProps<br>PromptInputSelectItemProps<br>PromptInputSelectProps<br>PromptInputSelectTriggerProps<br>PromptInputSelectValueProps<br>PromptInputSubmitProps<br>PromptInputTabBodyProps<br>PromptInputTabItemProps<br>PromptInputTabLabelProps<br>PromptInputTabProps<br>PromptInputTabsListProps<br>PromptInputTextareaProps<br>PromptInputToolsProps |  | Unknown generic fit; deps: ai, lucide-react, nanoid, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/queue.tsx | ai-elements | no generic match | Queue<br>QueueItem<br>QueueItemAction<br>QueueItemActions<br>QueueItemAttachment<br>QueueItemContent<br>QueueItemDescription<br>QueueItemFile<br>QueueItemImage<br>QueueItemIndicator<br>QueueList<br>QueueSection<br>QueueSectionContent<br>QueueSectionLabel<br>QueueSectionTrigger | QueueItemActionProps<br>QueueItemActionsProps<br>QueueItemAttachmentProps<br>QueueItemContentProps<br>QueueItemDescriptionProps<br>QueueItemFileProps<br>QueueItemImageProps<br>QueueItemIndicatorProps<br>QueueItemProps<br>QueueListProps<br>QueueProps<br>QueueSectionContentProps<br>QueueSectionLabelProps<br>QueueSectionProps<br>QueueSectionTriggerProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/reasoning.tsx | ai-elements | no generic match | Reasoning<br>ReasoningContent<br>ReasoningText<br>ReasoningTrigger | ReasoningContentProps<br>ReasoningProps<br>ReasoningTriggerProps |  | Unknown generic fit; deps: @streamdown/cjk, @streamdown/math, @streamdown/mermaid, lucide-react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/sandbox.tsx | ai-elements | no generic match | Sandbox<br>SandboxContent<br>SandboxHeader<br>SandboxTabContent<br>SandboxTabs<br>SandboxTabsBar<br>SandboxTabsList<br>SandboxTabsTrigger | SandboxContentProps<br>SandboxHeaderProps<br>SandboxRootProps<br>SandboxTabContentProps<br>SandboxTabsBarProps<br>SandboxTabsListProps<br>SandboxTabsProps<br>SandboxTabsTriggerProps |  | Unknown generic fit; deps: ai, lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/schema-display.tsx | ai-elements | no generic match | SchemaDisplay<br>SchemaDisplayBody<br>SchemaDisplayContent<br>SchemaDisplayDescription<br>SchemaDisplayExample<br>SchemaDisplayHeader<br>SchemaDisplayMethod<br>SchemaDisplayParameter<br>SchemaDisplayParameters<br>SchemaDisplayPath<br>SchemaDisplayProperty<br>SchemaDisplayRequest<br>SchemaDisplayResponse | SchemaDisplayBodyProps<br>SchemaDisplayContentProps<br>SchemaDisplayDescriptionProps<br>SchemaDisplayExampleProps<br>SchemaDisplayHeaderProps<br>SchemaDisplayMethodProps<br>SchemaDisplayParameterProps<br>SchemaDisplayParametersProps<br>SchemaDisplayPathProps<br>SchemaDisplayPropertyProps<br>SchemaDisplayProps<br>SchemaDisplayRequestProps<br>SchemaDisplayResponseProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/shimmer.tsx | ai-elements | no generic match | Shimmer | TextShimmerProps |  | Unknown generic fit; deps: motion/react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/snippet.tsx | ai-elements | no generic match | Snippet<br>SnippetAddon<br>SnippetCopyButton<br>SnippetInput<br>SnippetText | SnippetAddonProps<br>SnippetCopyButtonProps<br>SnippetInputProps<br>SnippetProps<br>SnippetTextProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/sources.tsx | ai-elements | no generic match | Source<br>Sources<br>SourcesContent<br>SourcesTrigger | SourceProps<br>SourcesContentProps<br>SourcesProps<br>SourcesTriggerProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/speech-input.tsx | ai-elements | no generic match | SpeechInput | SpeechInputProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/stack-trace.tsx | ai-elements | no generic match | StackTrace<br>StackTraceActions<br>StackTraceContent<br>StackTraceCopyButton<br>StackTraceError<br>StackTraceErrorMessage<br>StackTraceErrorType<br>StackTraceExpandButton<br>StackTraceFrames<br>StackTraceHeader | StackTraceActionsProps<br>StackTraceContentProps<br>StackTraceCopyButtonProps<br>StackTraceErrorMessageProps<br>StackTraceErrorProps<br>StackTraceErrorTypeProps<br>StackTraceExpandButtonProps<br>StackTraceFramesProps<br>StackTraceHeaderProps<br>StackTraceProps |  | Unknown generic fit; deps: ErrorType: message, lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/suggestion.tsx | ai-elements | no generic match | Suggestion<br>Suggestions | SuggestionProps<br>SuggestionsProps |  | Unknown generic fit; deps: react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/task.tsx | ai-elements | no generic match | Task<br>TaskContent<br>TaskItem<br>TaskItemFile<br>TaskTrigger | TaskContentProps<br>TaskItemFileProps<br>TaskItemProps<br>TaskProps<br>TaskTriggerProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/terminal.tsx | ai-elements | candidate with API gaps | Terminal<br>TerminalActions<br>TerminalClearButton<br>TerminalContent<br>TerminalCopyButton<br>TerminalHeader<br>TerminalStatus<br>TerminalTitle | TerminalActionsProps<br>TerminalClearButtonProps<br>TerminalContentProps<br>TerminalCopyButtonProps<br>TerminalHeaderProps<br>TerminalProps<br>TerminalStatusProps<br>TerminalTitleProps | packages/web/ch5-ui-web/src/magicui/terminal.tsx | High: local export surface is broader or semantically different. | Do not direct delete. Either upstream missing local exports into ch5-ui-web or keep a thin adapter until consumers migrate. |
| packages/ui/src/components/ai-elements/test-results.tsx | ai-elements | no generic match | Test<br>TestDuration<br>TestError<br>TestErrorMessage<br>TestErrorStack<br>TestName<br>TestResults<br>TestResultsContent<br>TestResultsDuration<br>TestResultsHeader<br>TestResultsProgress<br>TestResultsSummary<br>TestStatus<br>TestSuite<br>TestSuiteContent<br>TestSuiteName<br>TestSuiteStats | TestDurationProps<br>TestErrorMessageProps<br>TestErrorProps<br>TestErrorStackProps<br>TestNameProps<br>TestProps<br>TestResultsContentProps<br>TestResultsDurationProps<br>TestResultsHeaderProps<br>TestResultsProgressProps<br>TestResultsProps<br>TestResultsSummaryProps<br>TestStatusProps<br>TestSuiteContentProps<br>TestSuiteNameProps<br>TestSuiteProps<br>TestSuiteStatsProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/tool.tsx | ai-elements | no generic match | Tool<br>ToolContent<br>ToolHeader<br>ToolInput<br>ToolOutput | ToolContentProps<br>ToolHeaderProps<br>ToolInputProps<br>ToolOutputProps<br>ToolProps |  | Unknown generic fit; deps: ai, lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/toolbar.tsx | ai-elements | no generic match | Toolbar |  |  | Unknown generic fit; deps: @xyflow/react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/transcription.tsx | ai-elements | no generic match | Transcription<br>TranscriptionSegment | TranscriptionProps<br>TranscriptionSegmentProps |  | Unknown generic fit; deps: ai, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/voice-selector.tsx | ai-elements | no generic match | VoiceSelector<br>VoiceSelectorAccent<br>VoiceSelectorAge<br>VoiceSelectorAttributes<br>VoiceSelectorBullet<br>VoiceSelectorContent<br>VoiceSelectorDescription<br>VoiceSelectorDialog<br>VoiceSelectorEmpty<br>VoiceSelectorGender<br>VoiceSelectorGroup<br>VoiceSelectorInput<br>VoiceSelectorItem<br>VoiceSelectorList<br>VoiceSelectorName<br>VoiceSelectorPreview<br>VoiceSelectorSeparator<br>VoiceSelectorShortcut<br>VoiceSelectorTrigger | VoiceSelectorAccentProps<br>VoiceSelectorAgeProps<br>VoiceSelectorAttributesProps<br>VoiceSelectorBulletProps<br>VoiceSelectorContentProps<br>VoiceSelectorDescriptionProps<br>VoiceSelectorDialogProps<br>VoiceSelectorEmptyProps<br>VoiceSelectorGenderProps<br>VoiceSelectorGroupProps<br>VoiceSelectorInputProps<br>VoiceSelectorItemProps<br>VoiceSelectorListProps<br>VoiceSelectorNameProps<br>VoiceSelectorPreviewProps<br>VoiceSelectorProps<br>VoiceSelectorSeparatorProps<br>VoiceSelectorShortcutProps<br>VoiceSelectorTriggerProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/ai-elements/web-preview.tsx | ai-elements | no generic match | WebPreview<br>WebPreviewBody<br>WebPreviewConsole<br>WebPreviewNavigation<br>WebPreviewNavigationButton<br>WebPreviewUrl | WebPreviewBodyProps<br>WebPreviewConsoleProps<br>WebPreviewNavigationButtonProps<br>WebPreviewNavigationProps<br>WebPreviewProps<br>WebPreviewUrlProps |  | Unknown generic fit; deps: lucide-react, react | Likely upstream candidate if used beyond Palot; otherwise keep local AI-specific package surface. |
| packages/ui/src/components/alert-dialog.tsx | foundations | candidate direct replace | AlertDialog<br>AlertDialogAction<br>AlertDialogCancel<br>AlertDialogContent<br>AlertDialogDescription<br>AlertDialogFooter<br>AlertDialogHeader<br>AlertDialogMedia<br>AlertDialogOverlay<br>AlertDialogPortal<br>AlertDialogTitle<br>AlertDialogTrigger |  | packages/web/ch5-ui-web/src/alert-dialog.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/alert.tsx | foundations | candidate with API gaps | Alert<br>AlertAction<br>AlertDescription<br>AlertTitle |  | packages/web/ch5-ui-web/src/alert.tsx | High: local export surface is broader or semantically different. | Do not direct delete. Either upstream missing local exports into ch5-ui-web or keep a thin adapter until consumers migrate. |
| packages/ui/src/components/animate/animated-collection.tsx | animate | candidate direct replace | AnimatedCollection<br>AnimatedCollectionCaption<br>AnimatedCollectionContext<br>AnimatedCollectionItem<br>AnimatedCollectionItemContent<br>AnimatedCollectionItemMedia<br>AnimatedCollectionList<br>AnimatedCollectionViewToggle |  | packages/web/ch5-ui-web/src/animate/animated-collection.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/bottom-menu.tsx | animate | candidate direct replace | BottomMenu<br>BottomMenuOptionGroup<br>BottomMenuRow | BottomMenuOptionGroupProps<br>BottomMenuProps<br>BottomMenuRowProps | packages/web/ch5-ui-web/src/animate/bottom-menu.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/day-picker.tsx | animate | candidate direct replace | DayPicker | DayPickerProps | packages/web/ch5-ui-web/src/animate/day-picker.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/delete-button.tsx | animate | candidate direct replace | DeleteButton |  | packages/web/ch5-ui-web/src/animate/delete-button.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/discrete-tabs.tsx | animate | candidate direct replace | DiscreteTab<br>DiscreteTabs<br>discreteTabVariants<br>discreteTabsVariants |  | packages/web/ch5-ui-web/src/animate/discrete-tabs.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/dynamic-toolbar.tsx | animate | candidate direct replace | DynamicToolbar<br>DynamicToolbarButton<br>DynamicToolbarContext<br>DynamicToolbarPanelContext<br>DynamicToolbarPrimary<br>DynamicToolbarSecondary<br>DynamicToolbarTrigger |  | packages/web/ch5-ui-web/src/animate/dynamic-toolbar.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/expandable-gallery.tsx | animate | candidate direct replace | ExpandableGallery |  | packages/web/ch5-ui-web/src/animate/expandable-gallery.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/fluid-expanding-grid.tsx | animate | candidate direct replace | FluidExpandingGrid |  | packages/web/ch5-ui-web/src/animate/fluid-expanding-grid.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/inline-edit.tsx | animate | candidate direct replace | InlineEdit | InlineEditProps | packages/web/ch5-ui-web/src/animate/inline-edit.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/list-item.tsx | animate | candidate direct replace | AnimatedList<br>AnimatedListItem<br>AnimatedListItemIndicator | AnimatedListItemIndicatorProps<br>AnimatedListItemProps<br>AnimatedListProps | packages/web/ch5-ui-web/src/animate/list-item.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/morphing-input.tsx | animate | candidate direct replace | AnimatedPlaceholder<br>MorphingInput |  | packages/web/ch5-ui-web/src/animate/morphing-input.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/multi-step-form.tsx | animate | candidate direct replace | MultiStepForm |  | packages/web/ch5-ui-web/src/animate/multi-step-form.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/pricing-card.tsx | animate | candidate direct replace | PricingCard | PricingCardProps | packages/web/ch5-ui-web/src/animate/pricing-card.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/smooth-dropdown.tsx | animate | already shim/imports generic |  |  | packages/web/ch5-ui-web/src/animate/smooth-dropdown.tsx | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Replace imports with @ch5me/ch5-ui-web and delete local pass-through wrapper when consumer imports are moved. |
| packages/ui/src/components/animate/stacked-list.tsx | animate | candidate direct replace | STAGGER_CLOSE_SECONDS<br>STAGGER_DELAY_SECONDS<br>STAGGER_OPEN_SECONDS<br>StackedList<br>StackedListBody<br>StackedListContext<br>StackedListGroup<br>StackedListItem<br>StackedListOverlay<br>StackedListOverlayBar<br>StackedListOverlayClose<br>StackedListOverlayContent<br>StackedListOverlayReveal<br>StackedListSearchInput<br>StackedListStatusDot<br>StackedListTag | StackedListBodyProps<br>StackedListGroupProps<br>StackedListItemProps<br>StackedListOverlayBarProps<br>StackedListOverlayCloseProps<br>StackedListOverlayContentProps<br>StackedListOverlayProps<br>StackedListOverlayRevealProps<br>StackedListProps<br>StackedListSearchInputProps<br>StackedListStatusDotProps<br>StackedListTagProps | packages/web/ch5-ui-web/src/animate/stacked-list.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/status-button.tsx | animate | candidate direct replace | StatusButton | StatusButtonProps | packages/web/ch5-ui-web/src/animate/status-button.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/animate/vertical-tabs.tsx | animate | candidate direct replace | VerticalTabs<br>verticalTabsTriggerVariants |  | packages/web/ch5-ui-web/src/animate/vertical-tabs.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/aspect-ratio.tsx | foundations | candidate direct replace | AspectRatio |  | packages/web/ch5-ui-web/src/aspect-ratio.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/avatar.tsx | foundations | candidate with API gaps | Avatar<br>AvatarBadge<br>AvatarFallback<br>AvatarGroup<br>AvatarGroupCount<br>AvatarImage |  | packages/web/ch5-ui-web/src/avatar.tsx | High: local export surface is broader or semantically different. | Do not direct delete. Either upstream missing local exports into ch5-ui-web or keep a thin adapter until consumers migrate. |
| packages/ui/src/components/badge.tsx | foundations | candidate direct replace | Badge<br>badgeVariants |  | packages/web/ch5-ui-web/src/badge.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/breadcrumb.tsx | foundations | candidate direct replace | Breadcrumb<br>BreadcrumbEllipsis<br>BreadcrumbItem<br>BreadcrumbLink<br>BreadcrumbList<br>BreadcrumbPage<br>BreadcrumbSeparator |  | packages/web/ch5-ui-web/src/breadcrumb.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/button-group.tsx | foundations | no generic match | ButtonGroup<br>ButtonGroupSeparator<br>ButtonGroupText<br>buttonGroupVariants |  |  | Unknown generic fit; deps: @base-ui/react/merge-props, @base-ui/react/use-render, class-variance-authority | Keep local until generic need exists, or upstream if two CH5 apps need same primitive. |
| packages/ui/src/components/button.tsx | foundations | candidate direct replace | Button<br>buttonVariants |  | packages/web/ch5-ui-web/src/button.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/calendar.tsx | foundations | candidate direct replace | Calendar<br>CalendarDayButton |  | packages/web/ch5-ui-web/src/calendar.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/card.tsx | foundations | candidate with API gaps | Card<br>CardAction<br>CardContent<br>CardDescription<br>CardFooter<br>CardHeader<br>CardTitle |  | packages/web/ch5-ui-web/src/card.tsx | High: local export surface is broader or semantically different. | Do not direct delete. Either upstream missing local exports into ch5-ui-web or keep a thin adapter until consumers migrate. |
| packages/ui/src/components/carousel.tsx | foundations | candidate direct replace | Carousel<br>CarouselContent<br>CarouselContext<br>CarouselItem<br>CarouselNext<br>CarouselPrevious |  | packages/web/ch5-ui-web/src/carousel.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/chart.tsx | foundations | no generic match | ChartContainer<br>ChartContext<br>ChartLegend<br>ChartLegendContent<br>ChartStyle<br>ChartTooltip<br>ChartTooltipContent<br>THEMES |  |  | Unknown generic fit; deps: react, recharts | Keep local until generic need exists, or upstream if two CH5 apps need same primitive. |
| packages/ui/src/components/checkbox.tsx | foundations | candidate direct replace | Checkbox |  | packages/web/ch5-ui-web/src/checkbox.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/collapsible.tsx | foundations | candidate direct replace | Collapsible<br>CollapsibleContent<br>CollapsibleTrigger |  | packages/web/ch5-ui-web/src/collapsible.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/combobox.tsx | foundations | no generic match | Combobox<br>ComboboxChip<br>ComboboxChips<br>ComboboxChipsInput<br>ComboboxClear<br>ComboboxCollection<br>ComboboxContent<br>ComboboxEmpty<br>ComboboxGroup<br>ComboboxInput<br>ComboboxItem<br>ComboboxLabel<br>ComboboxList<br>ComboboxSeparator<br>ComboboxTrigger<br>ComboboxValue |  |  | Unknown generic fit; deps: @base-ui/react, lucide-react, react | Keep local until generic need exists, or upstream if two CH5 apps need same primitive. |
| packages/ui/src/components/command.tsx | foundations | candidate direct replace | Command<br>CommandDialog<br>CommandEmpty<br>CommandGroup<br>CommandInput<br>CommandItem<br>CommandList<br>CommandSeparator<br>CommandShortcut |  | packages/web/ch5-ui-web/src/command.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/context-menu.tsx | foundations | candidate direct replace | ContextMenu<br>ContextMenuCheckboxItem<br>ContextMenuContent<br>ContextMenuGroup<br>ContextMenuItem<br>ContextMenuLabel<br>ContextMenuPortal<br>ContextMenuRadioGroup<br>ContextMenuRadioItem<br>ContextMenuSeparator<br>ContextMenuShortcut<br>ContextMenuSub<br>ContextMenuSubContent<br>ContextMenuSubTrigger<br>ContextMenuTrigger |  | packages/web/ch5-ui-web/src/context-menu.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/dialog.tsx | foundations | candidate direct replace | Dialog<br>DialogClose<br>DialogContent<br>DialogDescription<br>DialogFooter<br>DialogHeader<br>DialogOverlay<br>DialogPortal<br>DialogTitle<br>DialogTrigger |  | packages/web/ch5-ui-web/src/dialog.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/direction.tsx | foundations | no generic match |  |  |  | Unknown generic fit; deps: @base-ui/react/direction-provider | Keep local until generic need exists, or upstream if two CH5 apps need same primitive. |
| packages/ui/src/components/drawer.tsx | foundations | candidate direct replace | Drawer<br>DrawerClose<br>DrawerContent<br>DrawerDescription<br>DrawerFooter<br>DrawerHeader<br>DrawerOverlay<br>DrawerPortal<br>DrawerTitle<br>DrawerTrigger |  | packages/web/ch5-ui-web/src/drawer.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/dropdown-menu.tsx | foundations | candidate direct replace | DropdownMenu<br>DropdownMenuCheckboxItem<br>DropdownMenuContent<br>DropdownMenuGroup<br>DropdownMenuItem<br>DropdownMenuLabel<br>DropdownMenuPortal<br>DropdownMenuRadioGroup<br>DropdownMenuRadioItem<br>DropdownMenuSeparator<br>DropdownMenuShortcut<br>DropdownMenuSub<br>DropdownMenuSubContent<br>DropdownMenuSubTrigger<br>DropdownMenuTrigger |  | packages/web/ch5-ui-web/src/dropdown-menu.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/empty.tsx | foundations | no generic match | Empty<br>EmptyContent<br>EmptyDescription<br>EmptyHeader<br>EmptyMedia<br>EmptyTitle |  |  | Unknown generic fit; deps: class-variance-authority | Keep local until generic need exists, or upstream if two CH5 apps need same primitive. |
| packages/ui/src/components/field.tsx | foundations | candidate direct replace | Field<br>FieldContent<br>FieldDescription<br>FieldError<br>FieldGroup<br>FieldLabel<br>FieldLegend<br>FieldSeparator<br>FieldSet<br>FieldTitle |  | packages/web/ch5-ui-web/src/field.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/form.tsx | foundations | candidate direct replace | Form<br>FormControl<br>FormDescription<br>FormField<br>FormFieldContext<br>FormItem<br>FormItemContext<br>FormLabel<br>FormMessage |  | packages/web/ch5-ui-web/src/form.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/hover-card.tsx | foundations | candidate direct replace | HoverCard<br>HoverCardContent<br>HoverCardTrigger |  | packages/web/ch5-ui-web/src/hover-card.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/input-group.tsx | foundations | no generic match | InputGroup<br>InputGroupAddon<br>InputGroupButton<br>InputGroupInput<br>InputGroupText<br>InputGroupTextarea |  |  | Unknown generic fit; deps: class-variance-authority, react | Keep local until generic need exists, or upstream if two CH5 apps need same primitive. |
| packages/ui/src/components/input-otp.tsx | foundations | candidate direct replace | InputOTP<br>InputOTPGroup<br>InputOTPSeparator<br>InputOTPSlot |  | packages/web/ch5-ui-web/src/input-otp.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/input.tsx | foundations | candidate direct replace | Input |  | packages/web/ch5-ui-web/src/input.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/item.tsx | foundations | no generic match | Item<br>ItemActions<br>ItemContent<br>ItemDescription<br>ItemFooter<br>ItemGroup<br>ItemHeader<br>ItemMedia<br>ItemSeparator<br>ItemTitle |  |  | Unknown generic fit; deps: @base-ui/react/merge-props, @base-ui/react/use-render, class-variance-authority, react | Keep local until generic need exists, or upstream if two CH5 apps need same primitive. |
| packages/ui/src/components/kbd.tsx | foundations | no generic match | Kbd<br>KbdGroup |  |  | No generic match found by basename/export scan. | Keep local until generic need exists, or upstream if two CH5 apps need same primitive. |
| packages/ui/src/components/label.tsx | foundations | candidate direct replace | Label |  | packages/web/ch5-ui-web/src/label.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/marketing/3d-book.tsx | marketing | already shim/imports generic |  |  | packages/web/ch5-ui-web/src/marketing/3d-book.tsx | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Replace imports with @ch5me/ch5-ui-web and delete local pass-through wrapper when consumer imports are moved. |
| packages/ui/src/components/marketing/bento-card.tsx | marketing | already shim/imports generic |  |  | packages/web/ch5-ui-web/src/marketing/bento-card.tsx | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Replace imports with @ch5me/ch5-ui-web and delete local pass-through wrapper when consumer imports are moved. |
| packages/ui/src/components/marketing/bucket.tsx | marketing | already shim/imports generic |  |  | packages/web/ch5-ui-web/src/marketing/bucket.tsx | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Replace imports with @ch5me/ch5-ui-web and delete local pass-through wrapper when consumer imports are moved. |
| packages/ui/src/components/marketing/discover-button.tsx | marketing | already shim/imports generic |  |  | packages/web/ch5-ui-web/src/marketing/discover-button.tsx | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Replace imports with @ch5me/ch5-ui-web and delete local pass-through wrapper when consumer imports are moved. |
| packages/ui/src/components/marketing/empty-testimonial.tsx | marketing | already shim/imports generic |  |  | packages/web/ch5-ui-web/src/marketing/empty-testimonial.tsx | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Replace imports with @ch5me/ch5-ui-web and delete local pass-through wrapper when consumer imports are moved. |
| packages/ui/src/components/marketing/feature-carousel.tsx | marketing | already shim/imports generic |  |  | packages/web/ch5-ui-web/src/marketing/feature-carousel.tsx | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Replace imports with @ch5me/ch5-ui-web and delete local pass-through wrapper when consumer imports are moved. |
| packages/ui/src/components/marketing/folder-interaction.tsx | marketing | already shim/imports generic |  |  | packages/web/ch5-ui-web/src/marketing/folder-interaction.tsx | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Replace imports with @ch5me/ch5-ui-web and delete local pass-through wrapper when consumer imports are moved. |
| packages/ui/src/components/marketing/magnified-bento.tsx | marketing | already shim/imports generic |  |  | packages/web/ch5-ui-web/src/marketing/magnified-bento.tsx | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Replace imports with @ch5me/ch5-ui-web and delete local pass-through wrapper when consumer imports are moved. |
| packages/ui/src/components/marketing/shake-testimonial-card.tsx | marketing | already shim/imports generic |  |  | packages/web/ch5-ui-web/src/marketing/shake-testimonial-card.tsx | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Replace imports with @ch5me/ch5-ui-web and delete local pass-through wrapper when consumer imports are moved. |
| packages/ui/src/components/menubar.tsx | foundations | candidate direct replace | Menubar<br>MenubarCheckboxItem<br>MenubarContent<br>MenubarGroup<br>MenubarItem<br>MenubarLabel<br>MenubarMenu<br>MenubarPortal<br>MenubarRadioGroup<br>MenubarRadioItem<br>MenubarSeparator<br>MenubarShortcut<br>MenubarSub<br>MenubarSubContent<br>MenubarSubTrigger<br>MenubarTrigger |  | packages/web/ch5-ui-web/src/menubar.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/native-select.tsx | foundations | no generic match | NativeSelect<br>NativeSelectOptGroup<br>NativeSelectOption |  |  | Unknown generic fit; deps: lucide-react, react | Keep local until generic need exists, or upstream if two CH5 apps need same primitive. |
| packages/ui/src/components/nav-sidebar-shell.tsx | foundations | already shim/imports generic | AppShellChrome<br>AppSidebarShellFrame | AppShellChromeProps<br>AppSidebarShellFrameProps<br>NavSidebarShellProps |  | Low: path/API churn only, unless consumer relies on @ch5me/elf-ui subpath. | Keep local shell for now; extract generic shell to ch5-ui-web later. It already consumes generic DiscreteTabs. |
| packages/ui/src/components/navigation-menu.tsx | foundations | candidate direct replace | NavigationMenu<br>NavigationMenuContent<br>NavigationMenuIndicator<br>NavigationMenuItem<br>NavigationMenuLink<br>NavigationMenuList<br>NavigationMenuPositioner<br>NavigationMenuTrigger |  | packages/web/ch5-ui-web/src/navigation-menu.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/pagination.tsx | foundations | candidate direct replace | Pagination<br>PaginationContent<br>PaginationEllipsis<br>PaginationItem<br>PaginationLink<br>PaginationNext<br>PaginationPrevious |  | packages/web/ch5-ui-web/src/pagination.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/popover.tsx | foundations | candidate with API gaps | Popover<br>PopoverContent<br>PopoverDescription<br>PopoverHeader<br>PopoverTitle<br>PopoverTrigger |  | packages/web/ch5-ui-web/src/popover.tsx | High: local export surface is broader or semantically different. | Do not direct delete. Either upstream missing local exports into ch5-ui-web or keep a thin adapter until consumers migrate. |
| packages/ui/src/components/progress.tsx | foundations | candidate with API gaps | Progress<br>ProgressIndicator<br>ProgressLabel<br>ProgressTrack<br>ProgressValue |  | packages/web/ch5-ui-web/src/progress.tsx | High: local export surface is broader or semantically different. | Do not direct delete. Either upstream missing local exports into ch5-ui-web or keep a thin adapter until consumers migrate. |
| packages/ui/src/components/radio-group.tsx | foundations | candidate direct replace | RadioGroup<br>RadioGroupItem |  | packages/web/ch5-ui-web/src/radio-group.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/resizable.tsx | foundations | candidate direct replace | ResizableHandle<br>ResizablePanel<br>ResizablePanelGroup |  | packages/web/ch5-ui-web/src/resizable.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/scroll-area.tsx | foundations | candidate direct replace | ScrollArea<br>ScrollBar |  | packages/web/ch5-ui-web/src/scroll-area.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/searchable-list-popover.tsx | foundations | no generic match | SearchableListPopover<br>SearchableListPopoverContent<br>SearchableListPopoverContext<br>SearchableListPopoverEmpty<br>SearchableListPopoverGroup<br>SearchableListPopoverItem<br>SearchableListPopoverList<br>SearchableListPopoverSearch<br>SearchableListPopoverTrigger |  |  | Unknown generic fit; deps: @base-ui/react/popover, react | Keep local until generic need exists, or upstream if two CH5 apps need same primitive. |
| packages/ui/src/components/select.tsx | foundations | candidate direct replace | Select<br>SelectContent<br>SelectGroup<br>SelectItem<br>SelectLabel<br>SelectScrollDownButton<br>SelectScrollUpButton<br>SelectSeparator<br>SelectTrigger<br>SelectValue |  | packages/web/ch5-ui-web/src/select.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/separator.tsx | foundations | candidate direct replace | Separator |  | packages/web/ch5-ui-web/src/separator.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/sheet.tsx | foundations | candidate direct replace | Sheet<br>SheetClose<br>SheetContent<br>SheetDescription<br>SheetFooter<br>SheetHeader<br>SheetOverlay<br>SheetPortal<br>SheetTitle<br>SheetTrigger |  | packages/web/ch5-ui-web/src/sheet.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/sidebar.tsx | foundations | candidate direct replace | SIDEBAR_COOKIE_MAX_AGE<br>SIDEBAR_COOKIE_NAME<br>SIDEBAR_KEYBOARD_SHORTCUT<br>SIDEBAR_WIDTH<br>SIDEBAR_WIDTH_ICON<br>SIDEBAR_WIDTH_MOBILE<br>Sidebar<br>SidebarContent<br>SidebarContext<br>SidebarFooter<br>SidebarGroup<br>SidebarGroupAction<br>SidebarGroupContent<br>SidebarGroupLabel<br>SidebarHeader<br>SidebarInput<br>SidebarInset<br>SidebarMenu<br>SidebarMenuAction<br>SidebarMenuBadge<br>SidebarMenuButton<br>SidebarMenuItem<br>SidebarMenuSkeleton<br>SidebarMenuSub<br>SidebarMenuSubButton<br>SidebarMenuSubItem<br>SidebarProvider<br>SidebarRail<br>SidebarSeparator<br>SidebarTrigger |  | packages/web/ch5-ui-web/src/sidebar.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/skeleton.tsx | foundations | candidate direct replace | Skeleton |  | packages/web/ch5-ui-web/src/skeleton.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/slider.tsx | foundations | candidate direct replace | Slider |  | packages/web/ch5-ui-web/src/slider.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/sonner.tsx | foundations | candidate direct replace | Toaster |  | packages/web/ch5-ui-web/src/sonner.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/spinner.tsx | foundations | candidate direct replace | Spinner |  | packages/web/ch5-ui-web/src/spinner.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/switch.tsx | foundations | candidate direct replace | Switch |  | packages/web/ch5-ui-web/src/switch.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/table.tsx | foundations | candidate direct replace | Table<br>TableBody<br>TableCaption<br>TableCell<br>TableFooter<br>TableHead<br>TableHeader<br>TableRow |  | packages/web/ch5-ui-web/src/table.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/tabs.tsx | foundations | candidate with API gaps | Tabs<br>TabsContent<br>TabsList<br>TabsTrigger<br>tabsListVariants |  | packages/web/ch5-ui-web/src/tabs.tsx | High: local export surface is broader or semantically different. | Do not direct delete. Either upstream missing local exports into ch5-ui-web or keep a thin adapter until consumers migrate. |
| packages/ui/src/components/textarea.tsx | foundations | candidate direct replace | Textarea |  | packages/web/ch5-ui-web/src/textarea.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/toggle-group.tsx | foundations | candidate direct replace | ToggleGroup<br>ToggleGroupItem |  | packages/web/ch5-ui-web/src/toggle-group.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/toggle.tsx | foundations | candidate direct replace | Toggle<br>toggleVariants |  | packages/web/ch5-ui-web/src/toggle.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |
| packages/ui/src/components/tooltip.tsx | foundations | candidate direct replace | Tooltip<br>TooltipContent<br>TooltipProvider<br>TooltipTrigger |  | packages/web/ch5-ui-web/src/tooltip.tsx | Low/medium: export name matches but styling may differ. | Try direct import swap or compatibility re-export; verify visual/story coverage. Watch variant/token differences. |

## Generic CH5 Matches Used In This Audit

| Generic file | Area | Exports | Props | Lines |
| --- | --- | --- | --- | --- |
| packages/web/ch5-ui-web/src/accordion.tsx | root | Accordion<br>AccordionContent<br>AccordionItem<br>AccordionTrigger |  | 75 |
| packages/web/ch5-ui-web/src/alert-dialog.tsx | root |  |  | 72 |
| packages/web/ch5-ui-web/src/alert.tsx | root | Alert<br>AlertDescription<br>AlertTitle |  | 63 |
| packages/web/ch5-ui-web/src/animate/animated-collection.tsx | animate |  |  | 415 |
| packages/web/ch5-ui-web/src/animate/bottom-menu.tsx | animate | BottomMenu<br>BottomMenuOptionGroup<br>BottomMenuRow | BottomMenuOptionGroupProps<br>BottomMenuProps<br>BottomMenuRowProps | 305 |
| packages/web/ch5-ui-web/src/animate/day-picker.tsx | animate | DayPicker | DayPickerProps | 259 |
| packages/web/ch5-ui-web/src/animate/delete-button.tsx | animate | DeleteButton |  | 259 |
| packages/web/ch5-ui-web/src/animate/discrete-tabs.tsx | animate | DiscreteTab<br>DiscreteTabs<br>discreteTabVariants<br>discreteTabsVariants |  | 224 |
| packages/web/ch5-ui-web/src/animate/dynamic-toolbar.tsx | animate |  |  | 292 |
| packages/web/ch5-ui-web/src/animate/expandable-gallery.tsx | animate | ExpandableGallery |  | 247 |
| packages/web/ch5-ui-web/src/animate/fluid-expanding-grid.tsx | animate | FluidExpandingGrid |  | 208 |
| packages/web/ch5-ui-web/src/animate/inline-edit.tsx | animate | InlineEdit | InlineEditProps | 154 |
| packages/web/ch5-ui-web/src/animate/list-item.tsx | animate | AnimatedList<br>AnimatedListItem<br>AnimatedListItemIndicator | AnimatedListItemIndicatorProps<br>AnimatedListItemProps<br>AnimatedListProps | 167 |
| packages/web/ch5-ui-web/src/animate/morphing-input.tsx | animate | AnimatedPlaceholder<br>MorphingInput |  | 194 |
| packages/web/ch5-ui-web/src/animate/multi-step-form.tsx | animate | MultiStepForm |  | 201 |
| packages/web/ch5-ui-web/src/animate/pricing-card.tsx | animate | PricingCard | PricingCardProps | 322 |
| packages/web/ch5-ui-web/src/animate/smooth-dropdown.tsx | animate | SmoothDropdown | SmoothDropdownProps | 410 |
| packages/web/ch5-ui-web/src/animate/stacked-list.tsx | animate |  | StackedListBodyProps<br>StackedListGroupProps<br>StackedListItemProps<br>StackedListOverlayBarProps<br>StackedListOverlayCloseProps<br>StackedListOverlayContentProps<br>StackedListOverlayProps<br>StackedListOverlayRevealProps<br>StackedListProps<br>StackedListSearchInputProps<br>StackedListStatusDotProps<br>StackedListTagProps | 492 |
| packages/web/ch5-ui-web/src/animate/status-button.tsx | animate | StatusButton | StatusButtonProps | 155 |
| packages/web/ch5-ui-web/src/animate/vertical-tabs.tsx | animate | VerticalTabs<br>verticalTabsTriggerVariants |  | 373 |
| packages/web/ch5-ui-web/src/aspect-ratio.tsx | root | AspectRatio |  | 23 |
| packages/web/ch5-ui-web/src/avatar.tsx | root | Avatar<br>AvatarFallback<br>AvatarImage |  | 48 |
| packages/web/ch5-ui-web/src/badge.tsx | root | Badge<br>badgeVariants | BadgeProps | 43 |
| packages/web/ch5-ui-web/src/breadcrumb.tsx | root |  |  | 102 |
| packages/web/ch5-ui-web/src/button.tsx | root | Button<br>buttonVariants | ButtonProps | 60 |
| packages/web/ch5-ui-web/src/calendar.tsx | root | Calendar<br>CalendarDayButton |  | 185 |
| packages/web/ch5-ui-web/src/card.tsx | root | Card<br>CardContent<br>CardDescription<br>CardFooter<br>CardHeader<br>CardTitle |  | 51 |
| packages/web/ch5-ui-web/src/carousel.tsx | root |  |  | 231 |
| packages/web/ch5-ui-web/src/checkbox.tsx | root | Checkbox |  | 53 |
| packages/web/ch5-ui-web/src/collapsible.tsx | root | Collapsible<br>CollapsibleContent<br>CollapsibleTrigger |  | 10 |
| packages/web/ch5-ui-web/src/command.tsx | root |  |  | 144 |
| packages/web/ch5-ui-web/src/context-menu.tsx | root |  |  | 300 |
| packages/web/ch5-ui-web/src/dialog.tsx | root | Dialog<br>DialogClose<br>DialogContent<br>DialogDescription<br>DialogFooter<br>DialogHeader<br>DialogOverlay<br>DialogPortal<br>DialogTitle<br>DialogTrigger |  | 131 |
| packages/web/ch5-ui-web/src/drawer.tsx | root |  |  | 148 |
| packages/web/ch5-ui-web/src/dropdown-menu.tsx | root | DropdownMenu<br>DropdownMenuCheckboxItem<br>DropdownMenuContent<br>DropdownMenuGroup<br>DropdownMenuItem<br>DropdownMenuLabel<br>DropdownMenuPortal<br>DropdownMenuRadioGroup<br>DropdownMenuRadioItem<br>DropdownMenuSeparator<br>DropdownMenuShortcut<br>DropdownMenuSub<br>DropdownMenuSubContent<br>DropdownMenuSubTrigger<br>DropdownMenuTrigger |  | 227 |
| packages/web/ch5-ui-web/src/field.tsx | root | Field | FieldProps | 52 |
| packages/web/ch5-ui-web/src/form.tsx | root |  |  | 157 |
| packages/web/ch5-ui-web/src/hover-card.tsx | root | HoverCard<br>HoverCardContent<br>HoverCardTrigger |  | 32 |
| packages/web/ch5-ui-web/src/index.ts | root | Accordion<br>AccordionContent<br>AccordionItem<br>AccordionTrigger<br>AspectRatio<br>Avatar<br>AvatarFallback<br>AvatarImage<br>Badge<br>Button<br>Calendar<br>CalendarDayButton<br>Card<br>CardContent<br>CardDescription<br>CardFooter<br>CardHeader<br>CardTitle<br>Checkbox<br>Collapsible<br>CollapsibleContent<br>CollapsibleTrigger<br>Field<br>HoverCard<br>HoverCardContent<br>HoverCardTrigger<br>Input<br>Label<br>Popover<br>PopoverAnchor<br>PopoverContent<br>PopoverTrigger<br>Progress<br>RadioGroup<br>RadioGroupItem<br>... +22 |  | 366 |
| packages/web/ch5-ui-web/src/input-otp.tsx | root | InputOTP<br>InputOTPGroup<br>InputOTPSeparator<br>InputOTPSlot |  | 102 |
| packages/web/ch5-ui-web/src/input.tsx | root | Input |  | 20 |
| packages/web/ch5-ui-web/src/label.tsx | root | Label |  | 18 |
| packages/web/ch5-ui-web/src/magicui/file-tree.tsx | magicui | CollapseButton<br>File<br>Folder<br>Tree<br>TreeViewElement |  | 504 |
| packages/web/ch5-ui-web/src/magicui/index.ts | magicui | Android<br>AnimatedBeam<br>AnimatedCircularProgressBar<br>AnimatedGradientText<br>AnimatedGridPattern<br>AnimatedList<br>AnimatedListItem<br>AnimatedShinyText<br>AnimatedSpan<br>AnimatedSubscribeButton<br>AnimatedThemeToggler<br>AuroraText<br>AvatarCircles<br>Backlight<br>BentoCard<br>BentoGrid<br>BlurFade<br>BorderBeam<br>ClientTweetCard<br>CodeComparison<br>CollapseButton<br>ComicText<br>Confetti<br>ConfettiButton<br>CoolMode<br>DiaTextReveal<br>Dock<br>DockIcon<br>DotPattern<br>DottedMap<br>File<br>FlickeringGrid<br>Folder<br>GlareHover<br>Globe<br>... +62 |  | 78 |
| packages/web/ch5-ui-web/src/magicui/magicui.catalog.tsx | magicui | Android<br>AnimatedBeam<br>AnimatedCircularProgressBar<br>AnimatedGradientText<br>AnimatedGridPattern<br>AnimatedList<br>AnimatedShinyText<br>AnimatedSubscribeButton<br>AnimatedThemeToggler<br>AuroraText<br>AvatarCircles<br>Backlight<br>BentoGrid<br>BlurFade<br>BorderBeam<br>ClientTweetCard<br>CodeComparison<br>ComicText<br>Confetti<br>CoolMode<br>DiaTextReveal<br>Dock<br>DotPattern<br>DottedMap<br>FileTree<br>FlickeringGrid<br>GlareHover<br>Globe<br>GridPattern<br>HeroVideoDialog<br>HexagonPattern<br>Highlighter<br>HyperText<br>IconCloud<br>InteractiveGridPattern<br>... +42 |  | 217 |
| packages/web/ch5-ui-web/src/magicui/terminal.tsx | magicui | AnimatedSpan<br>Terminal<br>TypingAnimation |  | 301 |
| packages/web/ch5-ui-web/src/marketing/3d-book.tsx | marketing | Book3D |  | 206 |
| packages/web/ch5-ui-web/src/marketing/bento-card.tsx | marketing | BentoCard<br>BentoCardPreview<br>BentoCardWorkspace |  | 368 |
| packages/web/ch5-ui-web/src/marketing/bucket.tsx | marketing | Bucket<br>defaultChips |  | 608 |
| packages/web/ch5-ui-web/src/marketing/discover-button.tsx | marketing | DiscoverButton |  | 282 |
| packages/web/ch5-ui-web/src/marketing/empty-testimonial.tsx | marketing | EmptyTestimonial |  | 279 |
| packages/web/ch5-ui-web/src/marketing/feature-carousel.tsx | marketing | FeatureCarousel |  | 321 |
| packages/web/ch5-ui-web/src/marketing/folder-interaction.tsx | marketing | FolderInteraction |  | 296 |
| packages/web/ch5-ui-web/src/marketing/magnified-bento.tsx | marketing | MagnifiedBento<br>MagnifyingLens |  | 334 |
| packages/web/ch5-ui-web/src/marketing/shake-testimonial-card.tsx | marketing | ShakeTestimonialCard<br>shakeTestimonialNoteVariants | ShakeTestimonialCardProps | 311 |
| packages/web/ch5-ui-web/src/menubar.tsx | root |  |  | 296 |
| packages/web/ch5-ui-web/src/motion-primitives/accordion.tsx | motion-primitives | Accordion<br>AccordionContent<br>AccordionItem<br>AccordionTrigger | AccordionContentProps<br>AccordionItemProps<br>AccordionProps<br>AccordionProviderProps<br>AccordionTriggerProps | 198 |
| packages/web/ch5-ui-web/src/motion-primitives/carousel.tsx | motion-primitives |  | CarouselContentProps<br>CarouselIndicatorProps<br>CarouselItemProps<br>CarouselNavigationProps<br>CarouselProps<br>CarouselProviderProps | 352 |
| packages/web/ch5-ui-web/src/motion-primitives/dialog.tsx | motion-primitives |  | DialogCloseProps<br>DialogContentProps<br>DialogDescriptionProps<br>DialogHeaderProps<br>DialogPortalProps<br>DialogProps<br>DialogTitleProps<br>DialogTriggerProps | 336 |
| packages/web/ch5-ui-web/src/navigation-menu.tsx | root |  |  | 274 |
| packages/web/ch5-ui-web/src/pagination.tsx | root |  |  | 113 |
| packages/web/ch5-ui-web/src/popover.tsx | root | Popover<br>PopoverAnchor<br>PopoverContent<br>PopoverTrigger |  | 34 |
| packages/web/ch5-ui-web/src/progress.tsx | root | Progress |  | 37 |
| packages/web/ch5-ui-web/src/radio-group.tsx | root | RadioGroup<br>RadioGroupItem |  | 39 |
| packages/web/ch5-ui-web/src/resizable.tsx | root | ResizableHandle<br>ResizablePanel<br>ResizablePanelGroup |  | 42 |
| packages/web/ch5-ui-web/src/scroll-area.tsx | root | ScrollArea<br>ScrollBar |  | 68 |
| packages/web/ch5-ui-web/src/select.tsx | root |  |  | 184 |
| packages/web/ch5-ui-web/src/separator.tsx | root | Separator |  | 26 |
| packages/web/ch5-ui-web/src/sheet.tsx | root |  |  | 133 |
| packages/web/ch5-ui-web/src/sidebar.tsx | root | Sidebar<br>SidebarContent<br>SidebarFooter<br>SidebarGroup<br>SidebarGroupAction<br>SidebarGroupContent<br>SidebarGroupLabel<br>SidebarHeader<br>SidebarInput<br>SidebarInset<br>SidebarMenu<br>SidebarMenuAction<br>SidebarMenuBadge<br>SidebarMenuButton<br>SidebarMenuItem<br>SidebarMenuSkeleton<br>SidebarMenuSub<br>SidebarMenuSubButton<br>SidebarMenuSubItem<br>SidebarProvider<br>SidebarRail<br>SidebarSeparator<br>SidebarTrigger | SidebarProps | 797 |
| packages/web/ch5-ui-web/src/skeleton.tsx | root | Skeleton |  | 14 |
| packages/web/ch5-ui-web/src/slider.tsx | root | Slider | SliderProps | 59 |
| packages/web/ch5-ui-web/src/sonner.tsx | root | Toaster |  | 22 |
| packages/web/ch5-ui-web/src/spinner.tsx | root | Spinner |  | 16 |
| packages/web/ch5-ui-web/src/switch.tsx | root | Switch |  | 37 |
| packages/web/ch5-ui-web/src/table.tsx | root | Table<br>TableBody<br>TableCaption<br>TableCell<br>TableFooter<br>TableHead<br>TableHeader<br>TableRow |  | 50 |
| packages/web/ch5-ui-web/src/tabs.tsx | root | Tabs<br>TabsContent<br>TabsList<br>TabsTrigger |  | 66 |
| packages/web/ch5-ui-web/src/textarea.tsx | root | Textarea | TextareaProps | 22 |
| packages/web/ch5-ui-web/src/toggle-group.tsx | root | ToggleGroup<br>ToggleGroupItem |  | 87 |
| packages/web/ch5-ui-web/src/toggle.tsx | root | Toggle<br>toggleVariants |  | 51 |
| packages/web/ch5-ui-web/src/tooltip.tsx | root | Tooltip<br>TooltipContent<br>TooltipProvider<br>TooltipTrigger |  | 58 |

## Palot UI Files With No Generic Match

### AI / Chat Elements

- `packages/ui/src/components/ai-elements/agent.tsx`
- `packages/ui/src/components/ai-elements/artifact.tsx`
- `packages/ui/src/components/ai-elements/attachments.tsx`
- `packages/ui/src/components/ai-elements/audio-player.tsx`
- `packages/ui/src/components/ai-elements/canvas.tsx`
- `packages/ui/src/components/ai-elements/chain-of-thought.tsx`
- `packages/ui/src/components/ai-elements/checkpoint.tsx`
- `packages/ui/src/components/ai-elements/code-block.tsx`
- `packages/ui/src/components/ai-elements/commit.tsx`
- `packages/ui/src/components/ai-elements/confirmation.tsx`
- `packages/ui/src/components/ai-elements/connection.tsx`
- `packages/ui/src/components/ai-elements/context.tsx`
- `packages/ui/src/components/ai-elements/controls.tsx`
- `packages/ui/src/components/ai-elements/conversation.tsx`
- `packages/ui/src/components/ai-elements/diff.tsx`
- `packages/ui/src/components/ai-elements/edge.tsx`
- `packages/ui/src/components/ai-elements/environment-variables.tsx`
- `packages/ui/src/components/ai-elements/file-changes.tsx`
- `packages/ui/src/components/ai-elements/image.tsx`
- `packages/ui/src/components/ai-elements/inline-citation.tsx`
- `packages/ui/src/components/ai-elements/jsx-preview.tsx`
- `packages/ui/src/components/ai-elements/message.tsx`
- `packages/ui/src/components/ai-elements/mic-selector.tsx`
- `packages/ui/src/components/ai-elements/model-selector.tsx`
- `packages/ui/src/components/ai-elements/node.tsx`
- `packages/ui/src/components/ai-elements/open-in-chat.tsx`
- `packages/ui/src/components/ai-elements/package-info.tsx`
- `packages/ui/src/components/ai-elements/panel.tsx`
- `packages/ui/src/components/ai-elements/persona.tsx`
- `packages/ui/src/components/ai-elements/plan.tsx`
- `packages/ui/src/components/ai-elements/prompt-input.tsx`
- `packages/ui/src/components/ai-elements/queue.tsx`
- `packages/ui/src/components/ai-elements/reasoning.tsx`
- `packages/ui/src/components/ai-elements/sandbox.tsx`
- `packages/ui/src/components/ai-elements/schema-display.tsx`
- `packages/ui/src/components/ai-elements/shimmer.tsx`
- `packages/ui/src/components/ai-elements/snippet.tsx`
- `packages/ui/src/components/ai-elements/sources.tsx`
- `packages/ui/src/components/ai-elements/speech-input.tsx`
- `packages/ui/src/components/ai-elements/stack-trace.tsx`
- `packages/ui/src/components/ai-elements/suggestion.tsx`
- `packages/ui/src/components/ai-elements/task.tsx`
- `packages/ui/src/components/ai-elements/test-results.tsx`
- `packages/ui/src/components/ai-elements/tool.tsx`
- `packages/ui/src/components/ai-elements/toolbar.tsx`
- `packages/ui/src/components/ai-elements/transcription.tsx`
- `packages/ui/src/components/ai-elements/voice-selector.tsx`
- `packages/ui/src/components/ai-elements/web-preview.tsx`

### Other Local-Only UI Utilities

- `packages/ui/src/components/button-group.tsx`
- `packages/ui/src/components/chart.tsx`
- `packages/ui/src/components/combobox.tsx`
- `packages/ui/src/components/direction.tsx`
- `packages/ui/src/components/empty.tsx`
- `packages/ui/src/components/input-group.tsx`
- `packages/ui/src/components/item.tsx`
- `packages/ui/src/components/kbd.tsx`
- `packages/ui/src/components/native-select.tsx`
- `packages/ui/src/components/searchable-list-popover.tsx`

## Desktop Renderer Component Audit

These are app/product components, not UI-library primitives by default. Replace only their imported primitives unless a file is a generic shell that belongs in `ch5-ui-web`.

| App file | Classification | Exports / top-level components | Props | @ch5me/elf-ui imports | Generic match | Lines |
| --- | --- | --- | --- | --- | --- | --- |
| apps/desktop/src/renderer/components/add-project-dialog.tsx | product-specific app surface | AddProjectDialog |  | 4 |  | 141 |
| apps/desktop/src/renderer/components/agent-detail.tsx | generic-looking app component; inspect before migration | AgentDetail |  | 4 |  | 685 |
| apps/desktop/src/renderer/components/app-bar-context.tsx | generic-looking app component; inspect before migration | AppBarProvider |  |  |  | 39 |
| apps/desktop/src/renderer/components/app-bar.tsx | generic-looking app component; inspect before migration | APP_BAR_HEIGHT<br>AppBar |  | 3 |  | 103 |
| apps/desktop/src/renderer/components/automations/automation-detail.tsx | product-specific app surface | AutomationDetail |  | 3 |  | 290 |
| apps/desktop/src/renderer/components/automations/automation-row.tsx | product-specific app surface | AutomationRow |  | 2 |  | 127 |
| apps/desktop/src/renderer/components/automations/automation-run-detail.tsx | product-specific app surface | AutomationRunDetail |  | 1 |  | 149 |
| apps/desktop/src/renderer/components/automations/automations-page.tsx | product-specific app surface | AutomationsPage |  | 2 |  | 146 |
| apps/desktop/src/renderer/components/automations/create-automation-dialog.tsx | product-specific app surface | CreateAutomationDialog |  | 8 |  | 588 |
| apps/desktop/src/renderer/components/automations/inbox-empty-state.tsx | product-specific app surface | InboxEmptyState |  | 1 |  | 56 |
| apps/desktop/src/renderer/components/automations/inbox-run-list.tsx | product-specific app surface | InboxRunList |  |  |  | 219 |
| apps/desktop/src/renderer/components/automations/inbox-run-row.tsx | product-specific app surface | InboxRunRow |  | 1 |  | 145 |
| apps/desktop/src/renderer/components/automations/inbox-toolbar.tsx | product-specific app surface | InboxToolbar |  | 2 |  | 40 |
| apps/desktop/src/renderer/components/automations/schedule-picker.tsx | product-specific app surface | SchedulePicker |  | 5 |  | 395 |
| apps/desktop/src/renderer/components/branch-picker.tsx | generic-looking app component; inspect before migration | BranchPicker |  | 3 |  | 507 |
| apps/desktop/src/renderer/components/chat/chat-input.tsx | generic-looking app component; inspect before migration | ChatInput |  | 1 |  | 434 |
| apps/desktop/src/renderer/components/chat/chat-permission.tsx | generic-looking app component; inspect before migration | PermissionItem |  | 2 |  | 133 |
| apps/desktop/src/renderer/components/chat/chat-question.tsx | generic-looking app component; inspect before migration | ChatQuestionFlow |  | 1 |  | 508 |
| apps/desktop/src/renderer/components/chat/chat-tool-call.tsx | generic-looking app component; inspect before migration | ChatToolCall |  | 5 |  | 1319 |
| apps/desktop/src/renderer/components/chat/chat-turn.tsx | generic-looking app component; inspect before migration | ChatTurnComponent |  | 4 |  | 1079 |
| apps/desktop/src/renderer/components/chat/chat-view.tsx | generic-looking app component; inspect before migration | ChatView |  | 3 |  | 1644 |
| apps/desktop/src/renderer/components/chat/context-items.tsx | generic-looking app component; inspect before migration | ContextItems |  | 1 |  | 95 |
| apps/desktop/src/renderer/components/chat/mention-popover.tsx | generic-looking app component; inspect before migration | MentionPopover |  | 2 |  | 313 |
| apps/desktop/src/renderer/components/chat/prompt-attachments.tsx | generic-looking app component; inspect before migration | PromptAttachmentPreview |  | 1 |  | 86 |
| apps/desktop/src/renderer/components/chat/prompt-toolbar.tsx | generic-looking app component; inspect before migration | AgentSelector<br>ModelSelector<br>PromptToolbar<br>StatusBar<br>VariantSelector | PromptToolbarProps | 5 |  | 1011 |
| apps/desktop/src/renderer/components/chat/session-task-list.tsx | product-specific app surface | SessionTaskList |  | 1 |  | 191 |
| apps/desktop/src/renderer/components/chat/skill-picker-dialog.tsx | generic-looking app component; inspect before migration | SkillPickerDialog |  | 4 |  | 219 |
| apps/desktop/src/renderer/components/chat/slash-command-popover.tsx | generic-looking app component; inspect before migration | SlashCommandPopover |  | 2 |  | 335 |
| apps/desktop/src/renderer/components/chat/sub-agent-card.tsx | generic-looking app component; inspect before migration | SubAgentCard |  | 2 |  | 541 |
| apps/desktop/src/renderer/components/chat/tool-card.tsx | generic-looking app component; inspect before migration | TOOL_CATEGORY_COLORS<br>ToolCard |  | 3 |  | 210 |
| apps/desktop/src/renderer/components/chat/voice-button.tsx | generic-looking app component; inspect before migration | VoiceButton |  |  |  | 181 |
| apps/desktop/src/renderer/components/command-palette.tsx | generic-looking app component; inspect before migration | CommandPalette |  | 1 | packages/web/ch5-ui-web/src/overlays.stories.tsx | 813 |
| apps/desktop/src/renderer/components/elf-hero.tsx | generic-looking app component; inspect before migration | ElfHero |  |  |  | 31 |
| apps/desktop/src/renderer/components/elf-wordmark.tsx | generic-looking app component; inspect before migration | ElfWordmark |  |  |  | 23 |
| apps/desktop/src/renderer/components/error-page.tsx | generic-looking app component; inspect before migration | ErrorPage |  | 1 |  | 74 |
| apps/desktop/src/renderer/components/genui/genui-artifact-card.tsx | generic-looking app component; inspect before migration | GenUiArtifactCard |  | 2 |  | 95 |
| apps/desktop/src/renderer/components/genui/genui-artifact-inline-actions.tsx | generic-looking app component; inspect before migration | GenUiArtifactInlineActions |  |  |  | 35 |
| apps/desktop/src/renderer/components/genui/genui-artifact-prop-actions.tsx | generic-looking app component; inspect before migration | GenUiArtifactPropActions |  |  |  | 42 |
| apps/desktop/src/renderer/components/genui/genui-artifact-widget.tsx | generic-looking app component; inspect before migration | GenUiArtifactWidget |  |  |  | 58 |
| apps/desktop/src/renderer/components/login-page.tsx | generic-looking app component; inspect before migration | LoginPage |  | 2 |  | 216 |
| apps/desktop/src/renderer/components/loom/component-mount.tsx | generic-looking app component; inspect before migration | LoomComponentMount |  | 2 |  | 118 |
| apps/desktop/src/renderer/components/nav-sidebar-tabs.tsx | generic-looking app component; inspect before migration | NavSidebarTabs |  | 1 |  | 346 |
| apps/desktop/src/renderer/components/new-chat.tsx | generic-looking app component; inspect before migration | NewChat |  | 3 |  | 805 |
| apps/desktop/src/renderer/components/not-found-page.tsx | generic-looking app component; inspect before migration | NotFoundPage |  | 1 |  | 36 |
| apps/desktop/src/renderer/components/onboarding/onboarding-overlay.tsx | product-specific app surface | OnboardingOverlay |  |  |  | 300 |
| apps/desktop/src/renderer/components/onboarding/onboarding-progress.tsx | product-specific app surface | OnboardingProgress |  |  |  | 49 |
| apps/desktop/src/renderer/components/onboarding/steps/complete-step.tsx | product-specific app surface | CompleteStep |  | 3 |  | 258 |
| apps/desktop/src/renderer/components/onboarding/steps/environment-check-step.tsx | product-specific app surface | EnvironmentCheckStep |  | 4 |  | 608 |
| apps/desktop/src/renderer/components/onboarding/steps/migration-offer-step.tsx | product-specific app surface | MigrationOfferStep |  | 3 |  | 474 |
| apps/desktop/src/renderer/components/onboarding/steps/migration-preview-step.tsx | product-specific app surface | MigrationPreviewStep |  | 2 |  | 307 |
| apps/desktop/src/renderer/components/onboarding/steps/provider-setup-step.tsx | product-specific app surface | ProviderSetupStep |  | 2 |  | 276 |
| apps/desktop/src/renderer/components/onboarding/steps/welcome-step.tsx | product-specific app surface | WelcomeStep |  | 1 |  | 45 |
| apps/desktop/src/renderer/components/pm-attention-queue.tsx | generic-looking app component; inspect before migration | PmAttentionQueue |  | 1 |  | 302 |
| apps/desktop/src/renderer/components/pm-dockview.tsx | generic-looking app component; inspect before migration | PmDockviewShell |  |  |  | 65 |
| apps/desktop/src/renderer/components/pm-live-dashboard.tsx | generic-looking app component; inspect before migration | PmLiveDashboard |  | 1 |  | 637 |
| apps/desktop/src/renderer/components/pm-side-agents-panel.tsx | generic-looking app component; inspect before migration | PmSideAgentsPanel |  | 1 |  | 723 |
| apps/desktop/src/renderer/components/project-manager.tsx | product-specific app surface | ProjectManager |  |  |  | 10 |
| apps/desktop/src/renderer/components/review/review-comments.tsx | generic-looking app component; inspect before migration | DiffCommentButton<br>ReviewPanelComments |  |  |  | 272 |
| apps/desktop/src/renderer/components/review/review-panel.tsx | generic-looking app component; inspect before migration | ReviewPanel |  | 1 |  | 927 |
| apps/desktop/src/renderer/components/root-layout.tsx | generic-looking app component; inspect before migration | RootLayout |  | 1 |  | 206 |
| apps/desktop/src/renderer/components/server-indicator.tsx | generic-looking app component; inspect before migration | ServerIndicator |  | 2 |  | 283 |
| apps/desktop/src/renderer/components/session-metrics-bar.tsx | product-specific app surface | SessionMetricsBar |  | 2 |  | 294 |
| apps/desktop/src/renderer/components/session-route.tsx | product-specific app surface | SessionRoute |  |  |  | 27 |
| apps/desktop/src/renderer/components/session-view.tsx | product-specific app surface | SessionView |  |  |  | 312 |
| apps/desktop/src/renderer/components/session-widgets/session-widget-shell.tsx | product-specific app surface | SessionWidgetCard<br>SessionWidgetWorkspace<br>SessionWidgetZone |  | 2 |  | 276 |
| apps/desktop/src/renderer/components/settings/about-settings.tsx | product-specific app surface | AboutSettings |  | 1 |  | 148 |
| apps/desktop/src/renderer/components/settings/connect-provider-dialog.tsx | product-specific app surface | ConnectProviderDialog |  | 5 |  | 1235 |
| apps/desktop/src/renderer/components/settings/connections-settings.tsx | product-specific app surface | ConnectionsSettings |  | 7 |  | 1000 |
| apps/desktop/src/renderer/components/settings/general-settings.tsx | product-specific app surface | GeneralSettings |  | 2 |  | 174 |
| apps/desktop/src/renderer/components/settings/notification-settings.tsx | product-specific app surface | NotificationSettings |  | 2 |  | 91 |
| apps/desktop/src/renderer/components/settings/profile-settings.tsx | product-specific app surface | ProfileSettings |  | 3 |  | 167 |
| apps/desktop/src/renderer/components/settings/provider-avatar.tsx | product-specific app surface | ProviderAvatar |  |  |  | 57 |
| apps/desktop/src/renderer/components/settings/provider-icon.tsx | product-specific app surface | ProviderIcon |  |  |  | 98 |
| apps/desktop/src/renderer/components/settings/provider-settings.tsx | product-specific app surface | ProviderSettings |  | 7 |  | 701 |
| apps/desktop/src/renderer/components/settings/server-settings.tsx | product-specific app surface | ServerSettings |  | 5 |  | 715 |
| apps/desktop/src/renderer/components/settings/settings-page.tsx | product-specific app surface | SettingsPage |  | 1 |  | 123 |
| apps/desktop/src/renderer/components/settings/settings-row.tsx | product-specific app surface | SettingsRow |  |  |  | 31 |
| apps/desktop/src/renderer/components/settings/settings-section.tsx | product-specific app surface | SettingsSection |  |  |  | 26 |
| apps/desktop/src/renderer/components/settings/setup-settings.tsx | product-specific app surface | SetupSettings |  | 2 |  | 235 |
| apps/desktop/src/renderer/components/settings/worktree-settings.tsx | product-specific app surface | WorktreeSettings |  | 1 |  | 256 |
| apps/desktop/src/renderer/components/side-panel/artifacts-panel.tsx | generic-looking app component; inspect before migration | ArtifactsPanel |  |  |  | 57 |
| apps/desktop/src/renderer/components/side-panel/bridges-panel.tsx | generic-looking app component; inspect before migration | BridgesPanel |  | 2 |  | 294 |
| apps/desktop/src/renderer/components/side-panel/browser-cursor-overlay.test.tsx | product-specific app surface |  |  |  |  | 82 |
| apps/desktop/src/renderer/components/side-panel/browser-cursor-overlay.tsx | product-specific app surface | BrowserCursorOverlay |  |  |  | 114 |
| apps/desktop/src/renderer/components/side-panel/browser-geometry-reconciliation.test.tsx | product-specific app surface |  |  |  |  | 64 |
| apps/desktop/src/renderer/components/side-panel/browser-panel.binding.test.tsx | product-specific app surface |  |  |  |  | 13 |
| apps/desktop/src/renderer/components/side-panel/browser-panel.tsx | product-specific app surface | BrowserPanel |  | 3 |  | 822 |
| apps/desktop/src/renderer/components/side-panel/claude-panel.tsx | generic-looking app component; inspect before migration | ClaudePanel |  | 1 |  | 260 |
| apps/desktop/src/renderer/components/side-panel/crm-panel.tsx | generic-looking app component; inspect before migration | CrmPanel |  | 3 |  | 489 |
| apps/desktop/src/renderer/components/side-panel/editor-panel.tsx | generic-looking app component; inspect before migration | EditorPanel |  | 2 |  | 234 |
| apps/desktop/src/renderer/components/side-panel/files-panel.tsx | generic-looking app component; inspect before migration | FilesPanel |  | 3 |  | 426 |
| apps/desktop/src/renderer/components/side-panel/memory-panel.tsx | generic-looking app component; inspect before migration | MemoryPanel |  |  |  | 249 |
| apps/desktop/src/renderer/components/side-panel/oracle-panel.tsx | generic-looking app component; inspect before migration | OracleEmptyState<br>OraclePanel |  | 2 |  | 578 |
| apps/desktop/src/renderer/components/side-panel/pdf-review-panel.tsx | generic-looking app component; inspect before migration | PdfReviewPanel |  |  |  | 69 |
| apps/desktop/src/renderer/components/side-panel/plugin-panel-boundary.tsx | generic-looking app component; inspect before migration | PluginPanelBoundary |  |  |  | 83 |
| apps/desktop/src/renderer/components/side-panel/plugins-panel.test.tsx | generic-looking app component; inspect before migration |  |  |  |  | 30 |
| apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx | generic-looking app component; inspect before migration | PluginsPanel |  | 1 |  | 301 |
| apps/desktop/src/renderer/components/side-panel/pulse-panel.tsx | generic-looking app component; inspect before migration | PulsePanel |  |  |  | 142 |
| apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx | product-specific app surface | SessionSidePanel |  | 2 |  | 98 |
| apps/desktop/src/renderer/components/side-panel/side-panel-tabs.tsx | generic-looking app component; inspect before migration |  |  |  |  | 4 |
| apps/desktop/src/renderer/components/side-panel/studio-panel.tsx | generic-looking app component; inspect before migration | StudioPanel |  | 2 |  | 208 |
| apps/desktop/src/renderer/components/side-panel/terminal-panel.tsx | generic-looking app component; inspect before migration | TerminalPanel |  | 3 |  | 241 |
| apps/desktop/src/renderer/components/side-panel/v2-plugins-panel.tsx | generic-looking app component; inspect before migration | V2PluginsPanel |  | 1 |  | 289 |
| apps/desktop/src/renderer/components/side-panel/voice-panel.tsx | generic-looking app component; inspect before migration | VoicePanel |  | 1 |  | 69 |
| apps/desktop/src/renderer/components/sidebar-layout.tsx | generic-looking app component; inspect before migration | SidebarLayout |  | 1 |  | 192 |
| apps/desktop/src/renderer/components/sidebar-slot-context.tsx | generic-looking app component; inspect before migration | SidebarSlotProvider |  |  |  | 52 |
| apps/desktop/src/renderer/components/sidebar.tsx | replace candidate: local app sidebar overlaps generic Sidebar primitives | AppSidebarContent |  |  | packages/web/ch5-ui-web/src/sidebar.tsx | 19 |
| apps/desktop/src/renderer/components/startup-overlay.tsx | generic-looking app component; inspect before migration | StartupOverlay |  |  |  | 138 |
| apps/desktop/src/renderer/components/update-banner.tsx | generic-looking app component; inspect before migration | UpdateBanner |  |  |  | 157 |
| apps/desktop/src/renderer/components/worktree-actions.tsx | generic-looking app component; inspect before migration | WorktreeActions |  | 5 |  | 444 |
| apps/desktop/src/renderer/genui/components/dag-sparkline.tsx | generic-looking app component; inspect before migration | DagSparklineEntry | DagSparklineFenceProps | 1 |  | 92 |
| apps/desktop/src/renderer/genui/components/decision-card.tsx | generic-looking app component; inspect before migration | DecisionCardEntry | DecisionCardProps | 3 |  | 136 |
| apps/desktop/src/renderer/genui/components/status-thinking-card.tsx | generic-looking app component; inspect before migration | StatusThinkingCardEntry | StatusThinkingCardProps | 1 |  | 112 |
| apps/desktop/src/renderer/genui/genui-renderer.tsx | generic-looking app component; inspect before migration | GenUiBlock<br>GenUiErrorBlock<br>TextWithGenUi |  | 2 |  | 416 |

## Generic CH5 Library Area Inventory

| Area | File count |
| --- | --- |
| animate | 18 |
| components | 2 |
| keyboard-shortcuts | 6 |
| magicui | 81 |
| marketing | 9 |
| motion-primitives | 37 |
| root | 61 |
| smoothui | 80 |

## Proposed Archive / Replace Plan

### Phase 1: Path Cleanup, Low Risk

- Move Storybook/app imports for pass-through marketing wrappers to `@ch5me/ch5-ui-web`.
- Delete local pass-through files after import migration.
- Keep `@ch5me/elf-ui` package alive for AI elements and compatibility while migration proceeds.

### Phase 2: Primitive Compatibility Layer

- For direct-replace primitives, replace local implementation with thin re-export from `@ch5me/ch5-ui-web` only when export names and variant props match app usage.
- Where variants differ, add generic support upstream first instead of preserving Palot-only variants forever.
- Verify each primitive family in Storybook before moving the next family.

### Phase 3: API-Gap Upstreaming

- Upstream missing compound exports if they are generally useful: `AvatarGroup`, `CardAction`, `PopoverHeader/Title/Description`, `ProgressTrack/Label/Value`, `tabsListVariants`.
- For AI `FileTree` and `Terminal`, decide whether CH5 generic should expose agent/chat-oriented variants or whether Palot keeps AI elements locally.

### Phase 4: AI Elements Decision

- If AI elements are shared CH5 product UI, move them as a namespace into `ch5-ui-web` or a new generic AI UI package.
- If they are Palot-specific, keep them in `@ch5me/elf-ui` and stop calling that package the unified primitive library.

### Phase 5: App Shell Extraction

- `nav-sidebar-shell.tsx` is currently product-branded but structurally reusable. Extract generic shell primitives to `ch5-ui-web`; keep Palot data binding and labels in app code.
- `apps/desktop/src/renderer/components/sidebar.tsx` should be reviewed after generic Sidebar replacement because it has overlap with CH5 sidebar primitives.

## Replacement Decision Checklist

- [ ] No local-only export used by app or stories.
- [ ] Variant names and sizes match or are added upstream in `ch5-ui-web`.
- [ ] Storybook story renders through generic import.
- [ ] App route using the component is visually checked.
- [ ] Local wrapper deleted or converted to temporary compatibility re-export.
- [ ] Archive note added if a Palot-specific component remains intentionally local.
