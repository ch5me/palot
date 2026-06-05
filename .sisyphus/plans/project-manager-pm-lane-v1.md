# Project Manager PM Lane V1 <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Build a first real Project Manager flow inside Elf that turns bottom-composer input into fresh PM sessions, shows optimistic limbo-to-assigned card state on the same page, and links those cards to real OpenCode sessions plus CH5PM-backed ticket data.
>
> **Deliverables**:
> - Project Manager page read model with pending intake cards + live PM cards
> - Dedicated PM prompt file and launcher flow
> - Lightweight ticket/session cards with links to real OpenCode sessions
> - Route-aware sidebar subsection for PM sessions
> - CH5PM snapshot wiring for first ticket data source
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Prompt contract -> launcher seam -> optimistic card state -> CH5PM card hydration

---

## Context

### Original Request
Build a real Project Manager surface in Elf. User types into the bottom box, hits enter, sees the message enter a limbo state, then sees it assign into a real session-backed card on the same page. Cards should be cute, sparse, linked to real OpenCode sessions, and eventually reflect Plane ticket state and PM routing behavior.

### Interview Summary
**Key Discussions**:
- PM requests should create one fresh visible PM session per submit.
- Under the hood, future warm-pool or round-robin reuse is desirable, but hidden behind a launcher seam.
- The page remains a top-level page with middle visualization and bottom composer.
- Sidebar remains source of truth for real OpenCode sessions; PM page cards link into it.
- CH5PM snapshot/ticket data is the preferred first source for cards.
- PM needs narrow session-inspection affordances first, not full uncontrolled context dumping.
- A PM-specific prompt must live on disk and be editable/versioned.

**Research Findings**:
- Existing session lifecycle primitives already exist in `apps/desktop/src/renderer/hooks/use-server.ts`.
- Existing CH5PM dashboard client, fixture, and typed payload contract already exist in `apps/desktop/src/renderer/ch5pm-dashboard/*`.
- `ProjectManager` page already exists as a copied `NewChat` shell, but its submit path is only a placeholder.
- Existing sidebar/session architecture already handles real session navigation; PM should reuse that instead of inventing a second truth source.

### Gap Review
**Identified Gaps** (resolved in plan):
- No explicit join model between optimistic pending prompts and later real session/ticket data.
- No dedicated PM launcher seam yet.
- No dedicated PM prompt file yet.
- No route-aware PM session subsection in sidebar yet.
- No slim card component/view-model layer for CH5PM-backed tickets and sessions yet.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Ship a first end-to-end Project Manager workflow where user input from the Project Manager composer becomes a real PM session, immediately appears as a pending item, upgrades into a session-linked PM card, and begins reflecting CH5PM ticket/session data on the same page.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- `ProjectManager` page refactored into a thin page container plus PM-specific subcomponents/hooks.
- Dedicated PM prompt file stored in repo and consumed by launcher flow.
- Fresh-session-per-submit PM launcher with future-proof execution seam.
- Optimistic pending submission model that upgrades into live PM cards.
- Small PM card components for pending intake, linked session, and ticket-backed display.
- Sidebar `PM Sessions` subsection linking into real OpenCode sessions.
- Initial CH5PM snapshot integration for active/queued/blocked ticket hydration.

### Definition of Done <!-- oc:id=sec_af -->
- [ ] Typing into Project Manager and submitting creates a new PM session and navigates to it.
- [ ] The Project Manager page immediately shows a local pending intake state before assignment completes.
- [ ] After session creation, that intake item upgrades into a live session-linked card.
- [ ] Ticket/session cards render from existing CH5PM-shaped data.
- [ ] Clicking a session-linked card navigates to the real OpenCode session route.
- [ ] Lint and typecheck pass.

### Must Have <!-- oc:id=sec_ag -->
- Fresh visible PM session per submit.
- Prompt file on disk, not inline-only prompt glue.
- Sidebar remains source of truth for real sessions.
- Card copy remains sparse, cute, and not information-dense.
- Session/ticket hydration uses just-enough context and narrow affordances.

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- No broad, uncontrolled session transcript dumping by default.
- No warm-pool logic embedded in UI components.
- No duplicate session state source competing with sidebar/store truth.
- No giant dashboard cram into first PM page; keep slim cards first.
- No human-only verification steps in acceptance criteria.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION**. All verification agent-executed.

### Test Decision
- **Infrastructure exists**: YES, for lint/typecheck; minimal direct renderer tests today
- **Automated tests**: Tests-after
- **Framework**: existing repo lint + typecheck, optional focused component/contract tests

### QA Policy
Every task includes executable QA scenarios:
- **UI**: local browser lane if needed, otherwise route/state assertions via app behavior + screenshots
- **Type/contract**: `bun run check-types`
- **Lint/style**: `bun run lint`
- **Evidence**: save screenshots/logs under `.sisyphus/evidence/` when UI proof is captured

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Parallel Execution Waves <!-- oc:id=sec_aj -->

Wave 1 (foundation):
- Task 1: Define PM prompt contract + on-disk prompt file
- Task 2: Define PM page view-model types and optimistic intake state model
- Task 3: Define CH5PM-to-card mapping layer
- Task 4: Define PM launcher seam API for fresh-session submission

Wave 2 (core UI + flow):
- Task 5: Refactor `ProjectManager` page into page container + PM subcomponents
- Task 6: Implement optimistic pending-intake limbo state
- Task 7: Implement PM launcher using fresh session create/send/navigate flow
- Task 8: Implement cute PM card component variants (pending, assigned, ticket-backed)

Wave 3 (data + navigation):
- Task 9: Hydrate PM cards from CH5PM fixture/live snapshot source
- Task 10: Add session links from cards to real session routes
- Task 11: Add route-aware `PM Sessions` sidebar subsection
- Task 12: Add small overview stats and middle-page composition polish

Wave 4 (quality + future seam):
- Task 13: Add PM-specific tests or contract checks where practical
- Task 14: Add comments/docs for launcher seam and future warm-pool swap
- Task 15: Capture first known follow-up seams for round-robin/warm-pool and richer Plane CRUD

Wave FINAL:
- Task F1: Plan compliance audit
- Task F2: Code quality review
- Task F3: Real PM page QA walkthrough
- Task F4: Scope fidelity check

Critical Path: 1 -> 4 -> 7 -> 6 -> 8 -> 9 -> 10 -> FINAL
Parallel Speedup: ~55% faster than sequential
Max Concurrent: 4

### Dependency Matrix <!-- oc:id=sec_ak -->
- **1**: none -> 7, 14
- **2**: none -> 5, 6, 8
- **3**: none -> 8, 9, 12
- **4**: none -> 7, 14, 15
- **5**: 2 -> 6, 8, 12
- **6**: 2, 5, 7 -> 12, 13
- **7**: 1, 4 -> 6, 10, 13
- **8**: 2, 3, 5 -> 9, 12, 13
- **9**: 3, 8 -> 12, 13
- **10**: 7 -> 13, F3
- **11**: 7 -> 13, F3
- **12**: 5, 6, 8, 9 -> 13, F3
- **13**: 6, 7, 8, 9, 10, 11, 12 -> FINAL
- **14**: 1, 4 -> FINAL
- **15**: 4 -> FINAL

### Agent Dispatch Summary <!-- oc:id=sec_al -->
- **Wave 1**: 4 tasks, mostly `quick` / `writing`
- **Wave 2**: 4 tasks, `deep` + `visual-engineering`
- **Wave 3**: 4 tasks, `deep` + `quick`
- **Wave 4**: 3 tasks, `writing` + `quick`
- **FINAL**: 4 review tasks

---

## TODOs

- [x] 1. Create PM prompt contract file

  **What to do**:
  - Add a repo-local PM prompt file with role, affordances, output contract, and guardrails.
  - Keep the prompt narrow: session list/read/summarize/send plus CH5PM snapshot usage.
  - Ensure the file is easy to iterate without touching launcher logic.

  **Must NOT do**:
  - Do not hardcode the full PM prompt inline inside UI submit handlers.
  - Do not overgrant raw transcript dumping by default.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: prompt contract quality and clarity matter more than code volume.
  - **Skills**: [`prompt-optimizer`]
    - `prompt-optimizer`: helps keep prompt scoped, sharp, and operational.
  - **Skills Evaluated but Omitted**:
    - `release-notes`: not relevant to internal prompt contract writing.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 14
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/components/project-manager.tsx:277` - current placeholder PM submit flow that needs prompt-driven behavior.
  - `apps/desktop/src/renderer/hooks/use-server.ts:49` - existing prompt transport semantics that the prompt file will feed.
  - `apps/desktop/src/renderer/ch5pm-dashboard/types.ts:168` - shows the PM-facing snapshot shape available to the lane.

  **Acceptance Criteria**:
  - [x] PM prompt file exists at chosen repo path and is loaded by launcher-facing code.
  - [x] Prompt text explicitly lists first-wave PM affordances and guardrails.

  **QA Scenarios**:
  ```text
  Scenario: Prompt file is present and readable
    Tool: Bash
    Preconditions: repo checked out
    Steps:
      1. Read the prompt file path chosen by implementation.
      2. Assert it contains PM role text and explicit guardrail section.
    Expected Result: file exists and includes role + affordances + guardrails.
    Failure Indicators: missing file, empty file, or missing core sections.
    Evidence: .sisyphus/evidence/task-1-prompt-file.txt

  Scenario: Prompt file is referenced by launcher code
    Tool: Grep
    Preconditions: implementation complete
    Steps:
      1. Search launcher/page code for the exact prompt file path or loader symbol.
      2. Assert at least one runtime path references it.
    Expected Result: prompt file is not orphaned.
    Evidence: .sisyphus/evidence/task-1-prompt-loader.txt
  ```

  **Commit**: NO

- [x] 2. Define PM page view-model and optimistic intake model

  **What to do**:
  - Introduce a small PM page view-model for pending submissions, session-linked cards, and ticket-linked cards.
  - Add explicit optimistic intake state so submits can appear immediately before session assignment.
  - Keep global state minimal; prefer page-local or narrow derived model.

  **Must NOT do**:
  - Do not leak raw CH5PM payloads throughout page component tree.
  - Do not create unnecessary global atoms for ephemeral optimistic state.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: narrow model extraction and local-state shape definition.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `software-design-principles`: useful, but likely overkill for a first local read model.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 5, 6, 8
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/ch5pm-dashboard/types.ts:1` - ticket/session row source data.
  - `apps/desktop/src/renderer/components/project-manager.tsx:125` - current page-local state concentration.

  **Acceptance Criteria**:
  - [x] PM page has a defined view-model layer with stable ids for pending -> assigned upgrades.
  - [x] Optimistic intake items can exist before session creation completes.

  **QA Scenarios**:
  ```text
  Scenario: Pending intake model supports immediate optimistic render
    Tool: Read
    Preconditions: implementation complete
    Steps:
      1. Inspect PM state/model code.
      2. Assert there is a distinct pending/intake state with stable local id.
    Expected Result: optimistic state exists independently from real session id.
    Evidence: .sisyphus/evidence/task-2-pending-model.txt

  Scenario: Typecheck validates PM view-model integration
    Tool: Bash
    Preconditions: implementation complete
    Steps:
      1. Run `bun run check-types`.
      2. Assert no PM model type errors.
    Expected Result: typecheck passes.
    Evidence: .sisyphus/evidence/task-2-typecheck.txt
  ```

  **Commit**: NO

- [x] 3. Add CH5PM-to-card mapping layer

  **What to do**:
  - Create a thin mapper from CH5PM ticket/session rows into small PM page card data.
  - Support active, queued, blocked, and optionally session signal rows.
  - Keep the card shape sparse: title, status, link targets, tiny hierarchy metadata.

  **Must NOT do**:
  - Do not render full CH5PM dashboard density on PM page.
  - Do not duplicate daemon client logic in multiple components.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: transform layer, not large architecture.
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 8, 9, 12
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/ch5pm-dashboard/fixtures.ts:176` - first active/queued/blocked demo ticket payloads.
  - `apps/desktop/src/renderer/ch5pm-dashboard/panel.tsx:391` - current ticket rendering behavior to simplify.

  **Acceptance Criteria**:
  - [x] Mapping layer produces small card-friendly data from CH5PM rows.
  - [x] Cards can render from fixtures without daemon availability.

  **QA Scenarios**:
  ```text
  Scenario: Fixture-backed mapping produces cards
    Tool: Read
    Preconditions: implementation complete
    Steps:
      1. Inspect mapper and fixture wiring.
      2. Confirm active/queued/blocked rows map into card view-model objects.
    Expected Result: first ticket source works without live daemon.
    Evidence: .sisyphus/evidence/task-3-fixture-mapper.txt

  Scenario: Card mapping does not require full dashboard panel
    Tool: Grep
    Preconditions: implementation complete
    Steps:
      1. Search PM page code for direct imports of heavy dashboard panel component.
      2. Assert only lightweight types/client/fixtures are reused.
    Expected Result: PM page reuses data contracts, not full dashboard component.
    Evidence: .sisyphus/evidence/task-3-import-audit.txt
  ```

  **Commit**: NO

- [x] 4. Add PM launcher seam API

  **What to do**:
  - Create one PM launcher helper/hook that owns fresh PM session creation and future warm-pool swap point.
  - For v1, implementation should still always create a fresh visible PM session per submit.
  - Keep function signature flexible enough to later return pooled or fast-lane execution targets.

  **Must NOT do**:
  - Do not scatter `createSession` + `sendPrompt` logic across multiple PM UI components.
  - Do not encode warm-pool behavior directly into page rendering.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: seam design affects future warm-pool / round-robin behavior.
  - **Skills**: [`software-design-principles`]
    - `software-design-principles`: keeps the launcher boundary clean and extensible.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 14, 15
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/components/new-chat.tsx:423` - current create/send flow to reuse.
  - `apps/desktop/src/renderer/hooks/use-server.ts:159` - current session creation primitive.
  - `apps/desktop/src/renderer/hooks/use-server.ts:49` - current send prompt primitive.

  **Acceptance Criteria**:
  - [x] PM submit path calls a single launcher seam.
  - [x] Launcher currently creates fresh sessions but documents future reuse seam.

  **QA Scenarios**:
  ```text
  Scenario: PM submit path uses single launcher seam
    Tool: Grep
    Preconditions: implementation complete
    Steps:
      1. Search PM page code for direct `createSession(` and `sendPrompt(` usage.
      2. Assert page delegates to one PM launcher helper rather than multiple inline flows.
    Expected Result: launcher boundary exists.
    Evidence: .sisyphus/evidence/task-4-launcher-seam.txt

  Scenario: Launcher still creates fresh visible PM session
    Tool: Read
    Preconditions: implementation complete
    Steps:
      1. Inspect launcher implementation.
      2. Assert v1 path creates a session per submit and does not reuse visible session ids.
    Expected Result: matches agreed product behavior.
    Evidence: .sisyphus/evidence/task-4-fresh-session.txt
  ```

  **Commit**: NO

---

## Final Verification Wave <!-- oc:id=sec_am -->

- [x] F1. Plan compliance audit
  Verify all deliverables landed: prompt file, launcher seam, optimistic pending state, PM cards, sidebar subsection, CH5PM hydration.

- [x] F2. Code quality review
  Run `bun run lint` and `bun run check-types`. Check for duplicated PM flow logic and overgrown component files.

- [x] F3. Real PM page QA walkthrough
  Use the Project Manager page to submit a prompt, verify limbo state appears, session is created, card upgrades, and link navigates to session.

- [x] F4. Scope fidelity check
  Confirm work stayed within PM page, launcher seam, card layer, and sidebar session linking. No accidental control-plane explosion.

---

## Commit Strategy

- Keep implementation in coherent slices:
  - prompt contract + launcher seam
  - PM page/card state
  - sidebar/session integration
  - CH5PM data hydration + polish

---

## Success Criteria <!-- oc:id=sec_an -->

### Verification Commands <!-- oc:id=sec_ao -->
```bash
bun run lint
bun run check-types
```

### Final Checklist <!-- oc:id=sec_ap -->
- [x] Fresh PM session created per submit
- [x] Limbo-to-assigned card flow visible on same page
- [x] Session links navigate to real OpenCode sessions
- [x] PM prompt file exists and is wired
- [x] CH5PM ticket/session data hydrates cards
- [x] No dense dashboard overload on first PM page