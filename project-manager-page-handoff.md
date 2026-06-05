# Project Manager Page Handoff <!-- oc:id=sec_aa -->

## Current state <!-- oc:id=sec_ab -->

The in-progress Project Manager page lives at `apps/desktop/src/renderer/components/project-manager.tsx`.
It is no longer a placeholder shell. It now:

- uses the bottom composer to create a fresh PM session per submit
- creates an optimistic local pending item immediately
- upgrades that item into an assigned session-backed card after session creation
- hydrates extra ticket cards from CH5PM snapshot data
- links cards into real OpenCode session routes
- exposes PM sessions in the sidebar

The repo-local PM prompt file exists and is loaded at runtime.

## Files touched <!-- oc:id=sec_ac -->

### Main page <!-- oc:id=sec_ad -->
- `apps/desktop/src/renderer/components/project-manager.tsx`
  - main PM page container
  - owns page-local state for pending submissions and assigned session cards
  - reads CH5PM snapshot data via `useQuery`
  - renders overview stats, suggestion buttons, cards, composer, and status bar
  - uses `launchProjectManagerSession()` as the single submit seam
  - currently imports and uses `ElfHero`; earlier versions used `ElfWordmark`

### Launcher seam <!-- oc:id=sec_ae -->
- `apps/desktop/src/renderer/project-manager-launcher.ts`
  - owns PM prompt loading
  - owns fresh session creation + prompt send flow
  - owns prompt composition via `composePmPrompt()`
  - exports `markPendingAssignment()` and `markPendingFailure()` helpers
  - important fix: prompt path now resolves with
    `new URL("./project-manager-prompt.md", import.meta.url).pathname`
    instead of a repo-relative string, because browser-mode file reads were resolving relative to `apps/server`

### Prompt contract <!-- oc:id=sec_af -->
- `apps/desktop/src/renderer/project-manager-prompt.md`
  - disk-backed PM lane prompt
  - contains role, primary affordances, required behavior, guardrails, output contract
  - meant to be editable without touching launcher logic

### Page view-models <!-- oc:id=sec_ag -->
- `apps/desktop/src/renderer/project-manager-types.ts`
  - defines `PmPendingSubmission`
  - defines `PmAssignment`
  - defines `PmPendingCard`, `PmSessionCard`, `PmTicketCard`, and `PmCard`
  - defines `PmSnapshotBundle` and `PmOverviewStats`
  - exports `createPendingSubmission()`, `toPendingCard()`, `toSessionCard()`

### CH5PM mapping layer <!-- oc:id=sec_ah -->
- `apps/desktop/src/renderer/project-manager-cards.ts`
  - maps CH5PM snapshot payload pieces into sparse PM cards
  - `getPmSnapshotBundle()` pulls `activeTickets`, `queueTickets`, `blockedTickets`
  - `mapSnapshotBundleToCards()` converts those into PM ticket cards
  - intentionally avoids importing the heavy dashboard panel UI

### Sidebar integration <!-- oc:id=sec_ai -->
- `apps/desktop/src/renderer/components/sidebar.tsx`
  - added `pmSessions` derived section
  - currently detects PM sessions by `agent.name.toLowerCase().includes("project manager")`
  - renders a `PM Sessions` subsection above the Projects list
  - this is functional but brittle; better tagging is still a follow-up seam

### Test/runtime support <!-- oc:id=sec_aj -->
- `apps/desktop/src/renderer/project-manager.test.ts`
  - focused tests for prompt composition, pending state transitions, and CH5PM card mapping
- `apps/desktop/src/renderer/atoms/preferences.ts`
  - added guards around legacy `localStorage` migration helpers so renderer unit tests can run in CLI/Bun test environments

### Notes / planning artifacts <!-- oc:id=sec_ak -->
- `.sisyphus/notepads/project-manager-pm-lane-v1/learnings.md`
- `.sisyphus/plans/project-manager-pm-lane-v1.md`
- `.sisyphus/evidence/*.txt`

## Main component structure <!-- oc:id=sec_al -->

Inside `apps/desktop/src/renderer/components/project-manager.tsx`:

- `MentionBridge`
  - bridges `PromptInput` controller access into local refs
- `MentionTrigger`
  - opens mention popover when `@` is typed
- `DraftSync`
  - syncs PM page draft content into the draft system
- `ProjectManager`
  - main route component
- `OverviewCard`
  - small stat block for sessions/tickets counts
- `PmCardTile`
  - sparse card renderer for pending/session/ticket cards

Core state in `ProjectManager`:

- `selectedDirectory`
- `launching`
- `error`
- `pendingSubmissions`
- `assignments`
- model / agent / variant picker state
- mention popover state

Derived data in `ProjectManager`:

- `pmSnapshotQuery`
- `snapshotCards`
- `sessionCards`
- `pendingCards`
- `cards`
- `overview`

## Data flow <!-- oc:id=sec_am -->

### Submit flow <!-- oc:id=sec_an -->
1. user submits prompt from PM composer <!-- oc:id=item_aa -->
1. `handleLaunch()` sets loading state and delegates to `handleProjectManagerLaunch()` <!-- oc:id=item_ab -->
1. `handleProjectManagerLaunch()` creates a local pending submission via `createPendingSubmission()` <!-- oc:id=item_ac -->
1. pending submission renders immediately as a limbo card <!-- oc:id=item_ad -->
1. `launchProjectManagerSession()` loads prompt markdown from disk <!-- oc:id=item_ae -->
1. launcher creates a fresh session with title `Project Manager` <!-- oc:id=item_af -->
1. launcher sends composed prompt to that new session <!-- oc:id=item_ag -->
1. page marks pending submission as assigned and stores assignment <!-- oc:id=item_ah -->
1. page navigates to `/project/$projectSlug/session/$sessionId` <!-- oc:id=item_ai -->
1. page also keeps local assignment state so assigned session card can render on the PM page <!-- oc:id=item_aj -->

### CH5PM hydration <!-- oc:id=sec_ao -->
1. page queries CH5PM dashboard data from `fetchCh5PmDashboard(CH5PM_BASE_URL)` <!-- oc:id=item_ak -->
1. `getPmSnapshotBundle()` extracts relevant ticket arrays <!-- oc:id=item_al -->
1. `mapSnapshotBundleToCards()` turns them into sparse cards <!-- oc:id=item_am -->
1. those cards are merged with pending and assigned cards into one `cards` array <!-- oc:id=item_an -->

## Known bugs / rough edges <!-- oc:id=sec_ap -->

### 1. Prompt path bug was fixed <!-- oc:id=sec_aq -->
Original bug:
- browser-mode PM prompt load tried to open
  `/Users/hassoncs/src/ch5/palot/apps/server/apps/desktop/src/renderer/project-manager-prompt.md`

Root cause:
- browser-mode file reads resolve relative paths from the server cwd
- old prompt path was a plain repo-relative string

Fix already applied:
- `apps/desktop/src/renderer/project-manager-launcher.ts`
- now uses `new URL(..., import.meta.url).pathname`

### 2. PM session sidebar detection is weak <!-- oc:id=sec_ar -->
Current behavior:
- `PM Sessions` are identified by checking whether the session name contains `project manager`

Why this is weak:
- depends on title text
- could miss renamed PM sessions
- could include unrelated sessions with similar names

Better future fix:
- add explicit session metadata/tagging for PM-launched sessions
- derive sidebar grouping from that tag instead of title matching

### 3. UI walkthrough proof was not real browser proof <!-- oc:id=sec_as -->
The plan checkbox for QA walkthrough got marked complete during the prior session, but the proof was mostly code/test/verification oriented rather than a true live manual/browser interaction trace.
If you need stricter product proof, rerun an actual UI walkthrough in Electron or browser-mode dev and capture screenshots/logs.

### 4. There may still be UX bugs in card persistence <!-- oc:id=sec_at -->
The page stores `pendingSubmissions` and `assignments` in page-local state only.
That was an intentional constraint to avoid new global atoms, but it means:

- state may reset on remount/navigation
- page may not preserve local PM card history across route changes or reloads
- assigned session cards depend partly on local assignment state and partly on session lookup from sidebar/store truth

If PM page should behave more like a durable dashboard, this local-only approach may need to evolve.

### 5. Ticket cards use selected project slug for navigation fallback <!-- oc:id=sec_au -->
For ticket cards with `sessionId`, the navigation path falls back to `selectedProject?.slug ?? "unknown"` when the card is not a session card.
That may be wrong if CH5PM ticket/session data references another repo/project than the currently selected PM page project.

## Important implementation details <!-- oc:id=sec_av -->

### Session launcher contract <!-- oc:id=sec_aw -->
`launchProjectManagerSession()` expects:
- project directory / name / slug
- prompt text
- pending id
- optional model / agent / variant / files
- injected `createSession()` and `sendPrompt()` callbacks
- `persistProjectModel()` callback

This is the clean seam for future warm-pool / round-robin reuse.
Do not re-inline create/send logic into the page component.

### Prompt composition contract <!-- oc:id=sec_ax -->
Prompt sent to the created PM session is:
- prompt markdown document
- followed by `## User Request`
- followed by the raw user prompt

That logic lives in `composePmPrompt()`.

### Browser-mode file reading constraint <!-- oc:id=sec_ay -->
Renderer `readTextFile()` in browser mode goes through:
- `apps/desktop/src/renderer/services/backend.ts`
- then `apps/desktop/src/renderer/services/elf-server.ts`
- then `apps/server/src/routes/files.ts`

That server route resolves paths via `path.resolve()` from server cwd / allowed roots.
Any future repo-file reads from renderer should prefer absolute/module-relative paths, not repo-relative strings.

## Tests and verification run previously <!-- oc:id=sec_az -->

The last session ran:
- `cd apps/desktop && bun test src/renderer/project-manager.test.ts`
- `bun run check-types`
- `bun run lint`

Focused tests currently cover:
- prompt composition
- pending -> assigned / failed transitions
- snapshot ticket mapping into sparse cards

## Evidence and notes <!-- oc:id=sec_ba -->

Useful breadcrumbs:
- `.sisyphus/evidence/task-1-prompt-file.txt`
- `.sisyphus/evidence/task-1-prompt-loader.txt`
- `.sisyphus/evidence/task-2-pending-model.txt`
- `.sisyphus/evidence/task-3-fixture-mapper.txt`
- `.sisyphus/evidence/task-4-launcher-seam.txt`
- `.sisyphus/evidence/task-13-tests.txt`
- `.sisyphus/evidence/final-compliance-audit.txt`
- `.sisyphus/notepads/project-manager-pm-lane-v1/learnings.md`

## Suggested next debugging starting points <!-- oc:id=sec_bb -->

If the next agent is continuing PM page work, likely next checks are:

1. Verify live UI behavior end-to-end in browser or Electron, not just tests. <!-- oc:id=item_ao -->
1. Check whether page-local `pendingSubmissions` and `assignments` are sufficient or need durable state. <!-- oc:id=item_ap -->
1. Replace title-matching sidebar grouping with explicit PM session tagging. <!-- oc:id=item_aq -->
1. Confirm ticket-card navigation uses the right project slug for cross-project session links. <!-- oc:id=item_ar -->
1. Look for any issues around `ElfHero` vs prior branding component changes inside `project-manager.tsx`. <!-- oc:id=item_as -->
1. Investigate any remaining bugs around card disappearance, duplicate cards, or navigation timing after submit. <!-- oc:id=item_at -->

## One-line summary <!-- oc:id=sec_bc -->

The Project Manager page is now a real PM intake surface with disk-backed prompt loading, a single launcher seam, optimistic pending cards, CH5PM-backed ticket cards, and sidebar PM session grouping — but it still likely has UX/state rough edges and needs stronger live-surface verification.