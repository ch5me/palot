# MCP Connections UI and MCPorter Control Plane <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

> **Quick Summary**: Add a first-class `Connections` product surface to Palot/Elf that discovers MCP servers from the official MCP Registry plus curated recommendations, installs/configures them into OpenCode via MCPorter-aware flows, guides OAuth/setup, and exposes only a tiny lazy runtime tool surface (`mcp.search`, `mcp.describe`, `mcp.call`, `mcp.status`) instead of dumping full MCP schemas into agent context.
>
> **Deliverables**:
> - New settings-level Connections UX for discovery, install, auth, health, and testing
> - MCP catalog ingestion/cache layer backed by official registry + curated metadata
> - OpenCode/MCPorter integration layer for config registration, auth state, test calls, and hot refresh
> - Dual-mode credential architecture covering both cloud-hosted and laptop-local OpenCode/MCPorter
> - Runtime catalog/executor contract for selective MCP tool hydration and approval-aware execution
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 4 implementation waves + final verification wave
> **Critical Path**: Architecture contract -> catalog/config backend -> connection UX -> auth/credential flows -> runtime tool wrapper -> verification

---

## Context

### Original Request
Plan a full product/system for making MCP setup dead simple in Palot/Elf: users open Settings, go to a connections area, click plus, browse popular/recommended MCPs and registry results, click connect, complete OAuth or required setup, get an animated success state, and have the tool become active immediately without refresh. The plan must incorporate MCPorter as the MCP discovery/execution control plane and avoid stuffing every MCP tool schema into agent context.

### Interview Summary
**Key Discussions**:
- Existing provider connection UX in Elf is strong and should be reused as the base pattern for MCP connections.
- MCP setup must feel catalog-first and one-click where possible.
- MCPorter should be the control plane, with a small wrapper surface around it instead of direct injection of every tool.
- Token/context efficiency matters: tools should be injected lazily and selectively.
- Need support for both cloud-hosted OpenCode and laptop-local OpenCode.
- Local mode must work even if no gateway exists.
- Cloud mode may still store credentials near runtime if needed, but architecture must account for portability and safety.

**Research Findings**:
- Provider settings UI already exists with searchable catalog, connect dialogs, API key entry, OAuth launch/polling, and hot refresh via `client.global.dispose()`.
- Current MCP UI is read-only posture/visibility only; no install/configure wizard exists.
- Official upstream registry exists at `https://registry.modelcontextprotocol.io` and is explicitly designed for downstream marketplaces/subregistries.
- MCPorter company policy already prefers a compact catalog/executor pattern (`mcp.search`, `mcp.describe`, `mcp.call`, optional `mcp.status`) over full schema dumps or generated clients.
- OpenCode docs support local and remote MCP config plus OAuth for remote MCPs.
- MCPorter docs indicate durable local config at `config/mcporter.json` / `~/.mcporter/mcporter.json`, shared credential vault at `~/.mcporter/credentials.json` (or XDG path), config add/login/logout flows, `tokenCacheDir`, `vault set`, and support for both `oauth` and `refreshable_bearer` auth modes.

### Metis Review
**Identified Gaps** (addressed in this plan):
- Need explicit guardrail between provider-model UX and MCP-server UX so plan does not accidentally overfit to provider-specific assumptions.
- Need explicit dual-mode credential strategy for cloud and local, including refresh rotation hazards and unsupported live token sync.
- Need explicit marketplace ranking policy: upstream registry is source of truth; curated recommendations are downstream metadata, not hardcoded truth.
- Need acceptance criteria around immediate availability, auth recovery states, and approval-aware runtime hydration.
- Need edge-case coverage for multi-step env setup, non-DCR providers, degraded/offline servers, and simultaneous local/cloud ownership.

---

## Work Objectives <!-- oc:id=sec_ac -->

### Core Objective <!-- oc:id=sec_ad -->
Design and land a full-stack Connections system that turns MCP setup into a guided product experience while preserving MCPorter as the durable execution/auth control plane and keeping agent context lean through catalog-first selective hydration.

### Concrete Deliverables <!-- oc:id=sec_ae -->
- New settings tab and route for `Connections`
- Connection discovery dialog with curated top picks + registry search + pagination
- Backend catalog ingestion/caching service for official MCP Registry
- MCP config registration/mutation flow for OpenCode and MCPorter-backed setups
- Auth/status model supporting OAuth, device/manual flows, env-required flows, and degraded states
- Runtime `mcp.search` / `mcp.describe` / `mcp.call` / `mcp.status` contract and integration design
- Dual-mode credential storage and portability design for cloud + laptop-local
- Verification/evidence plan for UX, auth flows, runtime tool availability, and failure recovery

### Definition of Done <!-- oc:id=sec_af -->
- [ ] User can open a dedicated Connections surface and browse curated + registry MCP entries.
- [ ] User can register at least one safe remote MCP and one local/stdio MCP through guided flows.
- [ ] Auth/setup states are modeled explicitly: connected, needs auth, missing env, degraded, offline.
- [ ] A successful connect flow updates runtime posture without requiring app restart or manual refresh.
- [ ] Runtime agent contract uses compact MCP meta-tools instead of globally injecting all server schemas.
- [ ] Plan includes explicit architecture for both gateway/cloud and laptop-local runtime modes.
- [ ] Plan includes explicit non-goals and risks around token sync/refresh rotation.

### Must Have <!-- oc:id=sec_ag -->
- Catalog-first UX
- Official MCP Registry as upstream discovery source
- Curated recommendation layer on top of upstream data
- MCPorter as durable control plane
- Lazy tool hydration policy
- Dual-mode credential strategy
- Approval metadata for mutating tools

### Must NOT Have (Guardrails) <!-- oc:id=sec_ah -->
- No global dump of every connected MCP tool/schema into initial agent context.
- No plan that assumes cloud-only or gateway-required operation.
- No plan that relies on unsafe live bidirectional refresh-token sync between local and cloud surfaces.
- No hardcoding of recommendation popularity as the only ranking source; recommendations are downstream metadata.
- No product promise that every MCP can be one-click OAuth; env/manual/device-code flows must remain first-class.
- No dependency on generated per-server TS clients as the default runtime path.

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — all acceptance criteria must be agent-executable. UI checks use browser tooling/screenshots, backend checks use API/CLI calls, runtime checks use MCPorter/OpenCode proof commands.

### Test Decision
- **Infrastructure exists**: PARTIAL
- **Automated tests**: Tests-after for touched logic; no large existing UI test suite assumed
- **Framework**: Existing repo uses Bun tests mainly in `packages/configconv`; new focused tests should follow existing local package patterns where applicable
- **Agent-Executed QA**: mandatory for every task

### QA Policy
Every task below includes concrete scenarios with evidence paths under `.sisyphus/evidence/`.

- **Frontend/UI**: use browser automation / screenshot capture against browser-mode dev surface
- **Desktop/Electron IPC**: use bounded commands + logs + renderer-visible behavior
- **Backend/runtime**: use MCPorter/OpenCode commands and API queries
- **Catalog/ranking**: use saved JSON samples and deterministic assertions

---

## Execution Strategy <!-- oc:id=sec_ai -->

### Parallel Execution Waves <!-- oc:id=sec_aj -->

```
Wave 1 (Foundation contracts — start immediately):
├── Task 1: Product architecture + state model
├── Task 2: MCPorter control-plane contract
├── Task 3: Credential-mode and OAuth architecture
├── Task 4: Registry ingestion + curated metadata contract
├── Task 5: Settings/navigation surface changes
└── Task 6: Existing code seam inventory + proof helpers

Wave 2 (Backend/data plane — after Wave 1):
├── Task 7: Connections catalog service + cache
├── Task 8: OpenCode/MCP config mutation backend
├── Task 9: MCPorter registration/auth adapter
├── Task 10: Connection health/status normalization
├── Task 11: Recommendation/ranking policy
└── Task 12: Local/cloud ownership and portability workflow

Wave 3 (Primary UX — after Wave 2):
├── Task 13: Settings Connections tab/page
├── Task 14: Connections catalog dialog + pagination/search
├── Task 15: Connection detail drawer/card states
├── Task 16: Install/auth/setup wizard flows
├── Task 17: Success/hot-refresh/activation UX
└── Task 18: Safe test-call UX + evidence capture

Wave 4 (Runtime + integration — after Wave 3):
├── Task 19: Compact MCP runtime meta-tools design
├── Task 20: Tool hydration + schema describe path
├── Task 21: Approval-aware call execution and mutability metadata
├── Task 22: Plugins/panel/runtime posture integration
├── Task 23: Migration/import interplay with configconv/onboarding
└── Task 24: Documentation/runbooks/ops policy alignment

Wave FINAL (After all implementation tasks):
├── F1: Plan compliance audit
├── F2: Code quality + type/lint/test review
├── F3: Real UX/runtime QA across happy/failure paths
└── F4: Scope fidelity and anti-slop audit
```

### Dependency Matrix <!-- oc:id=sec_ak -->
- **1**: — -> 7, 8, 10, 13, 19
- **2**: — -> 8, 9, 19, 20, 21, 22
- **3**: — -> 9, 12, 16, 24
- **4**: — -> 7, 11, 14, 15
- **5**: — -> 13
- **6**: — -> 18, 24
- **7**: 1, 4 -> 14, 15, 18
- **8**: 1, 2 -> 16, 17, 22, 23
- **9**: 2, 3 -> 16, 17, 18, 21
- **10**: 1, 2 -> 15, 17, 22
- **11**: 4 -> 14
- **12**: 3 -> 16, 24
- **13**: 5, 7 -> 14, 15, 16
- **14**: 7, 11, 13 -> 15, 16
- **15**: 7, 10, 14 -> 16, 17
- **16**: 8, 9, 12, 14, 15 -> 17, 18
- **17**: 8, 9, 10, 15, 16 -> 22
- **18**: 7, 9, 16 -> 22, F3
- **19**: 1, 2 -> 20, 21, 22
- **20**: 2, 19 -> 21, 22
- **21**: 2, 9, 19, 20 -> 22, F3
- **22**: 8, 10, 17, 18, 19, 20, 21 -> F1, F3, F4
- **23**: 8 -> F1, F4
- **24**: 3, 6, 12 -> F1, F4

### Agent Dispatch Summary <!-- oc:id=sec_al -->
- **Wave 1**: 6 tasks — deep/unspecified-high/writing split by concern
- **Wave 2**: 6 tasks — backend-heavy plus policy/ranking
- **Wave 3**: 6 tasks — visual-engineering dominant with backend assist
- **Wave 4**: 6 tasks — deep/runtime/integration focus
- **Final**: 4 parallel review tasks

---

## TODOs

- [ ] 1. Define end-to-end product architecture and connection state model

  **What to do**:
  - Define the canonical domain model for MCP connections: source, transport, auth mode, install state, runtime state, ownership mode, and test state.
  - Separate provider-model concepts from MCP-server concepts so UI/data layers stay clean.
  - Define stable IDs and where user-curated metadata lives versus upstream registry metadata.

  **Must NOT do**:
  - Do not overload existing provider types with MCP-only semantics.
  - Do not couple UI state directly to raw registry payloads.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: cross-cutting architecture and domain modeling.
  - **Skills**: [`software-design-principles`, `mcp-worker-bindings`]
    - `software-design-principles`: clean boundaries and reusable domain model.
    - `mcp-worker-bindings`: policy contract for MCP exposure and runtime shape.
  - **Skills Evaluated but Omitted**:
    - `hassoncs-developer-soul`: optional taste, not core requirement.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 8, 10, 13, 19
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/components/settings/provider-settings.tsx:117` - existing connection-like list structure and connection state presentation.
  - `apps/desktop/src/renderer/components/settings/connect-provider-dialog.tsx:242` - existing multi-step connect wizard baseline.
  - `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx:50` - current MCP posture surface showing what exists today.
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:14` - company policy for MCP control plane and lazy hydration.

  **Acceptance Criteria**:
  - [ ] Canonical state model documented in implementation surfaces.
  - [ ] UI, registry, MCPorter, and runtime concepts separated cleanly.

  **QA Scenarios**:
  ```
  Scenario: Domain model covers all required user-visible states
    Tool: Bash (grep/read proof) + file inspection
    Preconditions: architecture artifact implemented
    Steps:
      1. Read the new connection model source/doc.
      2. Assert it includes at least: connected, needs_auth, missing_env, degraded, offline, testing, installing.
      3. Assert ownership mode includes local/cloud or equivalent.
    Expected Result: All expected states present and named consistently.
    Failure Indicators: missing auth/runtime states, provider-only terms reused for MCP concepts.
    Evidence: .sisyphus/evidence/task-1-connection-state-model.md

  Scenario: Existing provider types remain decoupled from MCP connection model
    Tool: Grep
    Preconditions: implementation complete
    Steps:
      1. Search for MCP-specific fields added into provider-only types.
      2. Verify separation or explicit adapter layer.
    Expected Result: no accidental type pollution.
    Evidence: .sisyphus/evidence/task-1-type-separation.txt
  ```

  **Commit**: NO

- [ ] 2. Define MCPorter control-plane contract and wrapper surface

  **What to do**:
  - Define how Palot talks to MCPorter: register/list/get/login/logout/test/call/status.
  - Lock in tiny runtime meta-tool surface: `mcp.search`, `mcp.describe`, `mcp.call`, optional `mcp.status`.
  - Define CLI fallback versus long-lived runtime/daemon path.

  **Must NOT do**:
  - Do not plan full global schema injection.
  - Do not make generated TS clients the default runtime contract.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`mcp-worker-bindings`, `mcp2cli`]
    - `mcp-worker-bindings`: canonical control-plane policy.
    - `mcp2cli`: contrast/fallback patterns and durability expectations.
  - **Skills Evaluated but Omitted**:
    - `quo-mcp`: too vendor-specific.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 8, 9, 19, 20, 21, 22
  - **Blocked By**: None

  **References**:
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:21` - exact tiny meta-tool surface.
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:60` - control-plane runtime plan.
  - `/Users/hassoncs/.config/skillshare/skills/mcp2cli/SKILL.md:1` - fallback durable MCP-to-CLI patterns.

  **Acceptance Criteria**:
  - [ ] Runtime contract names exact APIs and responsibilities.
  - [ ] Validation and mutability metadata are explicit.
  - [ ] CLI fallback and preferred runtime path are both documented.

  **QA Scenarios**:
  ```
  Scenario: Runtime contract exposes only compact MCP meta-tools
    Tool: Read/Grep
    Preconditions: runtime contract artifact implemented
    Steps:
      1. Inspect contract surface.
      2. Assert presence of `mcp.search`, `mcp.describe`, `mcp.call` and optional `mcp.status`.
      3. Assert absence of full per-tool schema injection at boot.
    Expected Result: compact surface only.
    Evidence: .sisyphus/evidence/task-2-runtime-contract.md

  Scenario: Mutating tool metadata is preserved in contract
    Tool: Read
    Preconditions: contract implemented
    Steps:
      1. Inspect call/describe contract for approval or mutability markers.
      2. Verify write/destructive tools are flagged.
    Expected Result: approval metadata exists and is not optional hand-waving.
    Evidence: .sisyphus/evidence/task-2-mutability-metadata.md
  ```

  **Commit**: NO

- [ ] 3. Define dual-mode credential and OAuth architecture for cloud + local

  **What to do**:
  - Define supported credential modes: laptop-local, cloud-hosted, hybrid handoff.
  - Model callback ownership, device-code/OOB fallback, token storage, refresh rotation risks, and safe portability.
  - Decide allowed and forbidden sync/vending patterns.

  **Must NOT do**:
  - Do not allow live bidirectional refresh-token sync.
  - Do not assume gateway is always present.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`mcp-worker-bindings`, `hush-secrets`]
    - `mcp-worker-bindings`: MCP control-plane implications.
    - `hush-secrets`: secret-targeting and environment-split policy.
  - **Skills Evaluated but Omitted**:
    - `ch5-auth`: useful later if deploying auth infra, not core planner requirement.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 9, 12, 16, 24
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/main/credential-store.ts:1` - existing secure local credential storage pattern in app for remote server passwords.
  - `README.md:105` - current product claim around secure credential storage.
  - MCPorter config/help research in planning notes - shared vault, `tokenCacheDir`, `vault set`, `config login`, `auth` flows.

  **Acceptance Criteria**:
  - [ ] Plan explicitly supports both no-gateway local mode and cloud mode.
  - [ ] Plan explicitly forbids unsafe live refresh-token sync.
  - [ ] Plan includes callback alternatives for vendors without simple localhost/cloud parity.

  **QA Scenarios**:
  ```
  Scenario: Credential architecture covers local and cloud ownership modes
    Tool: Read
    Preconditions: architecture artifact implemented
    Steps:
      1. Inspect credential architecture section.
      2. Verify local-only mode, cloud-hosted mode, and handoff/portability flow are all covered.
    Expected Result: all runtime ownership modes documented.
    Evidence: .sisyphus/evidence/task-3-credential-modes.md

  Scenario: Unsafe live token sync is explicitly rejected
    Tool: Grep
    Preconditions: credential design complete
    Steps:
      1. Search plan/docs for refresh rotation and sync policy.
      2. Verify live bidirectional refresh-token sync is called out as unsupported/forbidden.
    Expected Result: clear anti-footgun policy exists.
    Evidence: .sisyphus/evidence/task-3-refresh-rotation-policy.txt
  ```

  **Commit**: NO

- [ ] 4. Define upstream registry ingestion and downstream curated metadata contract

  **What to do**:
  - Define official MCP Registry ingestion shape, pagination, cache strategy, refresh cadence, and failure fallback.
  - Define downstream metadata layer for curated recommendations, categories, popularity, security notes, and onboarding copy.
  - Preserve upstream/downstream separation in storage and UI.

  **Must NOT do**:
  - Do not make recommendation order depend only on hardcoded array.
  - Do not rely on registry uptime for core product responsiveness.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`mcp-worker-bindings`]
    - `mcp-worker-bindings`: catalog-first connection UI policy.
  - **Skills Evaluated but Omitted**:
    - `deep-research`: already enough source grounding for plan phase.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 7, 11, 14, 15
  - **Blocked By**: None

  **References**:
  - Official MCP Registry docs/research: `https://registry.modelcontextprotocol.io` and `modelcontextprotocol/registry` API docs.
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:49` - catalog-first UI expectations.

  **Acceptance Criteria**:
  - [ ] Upstream registry fields and local cache strategy documented.
  - [ ] Curated metadata layer documented separately from upstream payload.
  - [ ] Failure mode for stale/offline registry documented.

  **QA Scenarios**:
  ```
  Scenario: Registry ingestion supports pagination and local cache fallback
    Tool: Read
    Preconditions: catalog contract implemented
    Steps:
      1. Inspect ingestion design.
      2. Verify cursor pagination and cache TTL/refresh approach are defined.
      3. Verify stale-cache fallback is documented.
    Expected Result: no dependency on live fetch for every dialog open.
    Evidence: .sisyphus/evidence/task-4-registry-contract.md

  Scenario: Curated metadata is separate from upstream registry data
    Tool: Read
    Preconditions: metadata design complete
    Steps:
      1. Inspect storage/model plan.
      2. Verify recommended ranking/tags/copy live in downstream metadata layer.
    Expected Result: clean source-of-truth separation.
    Evidence: .sisyphus/evidence/task-4-curation-separation.md
  ```

  **Commit**: NO

- [ ] 5. Add settings/navigation plan for first-class Connections surface

  **What to do**:
  - Add a new settings-level tab/route for `Connections` and define how it coexists with `Providers`, `Servers`, and plugin posture surfaces.
  - Define whether MCP connections stay in Settings only or also get quick entrypoints elsewhere.

  **Must NOT do**:
  - Do not bury MCP setup under `Plugins` if that panel remains read-only posture.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-best-practices`]
    - `react-best-practices`: project-local renderer component patterns.
  - **Skills Evaluated but Omitted**:
    - `visual-tdd`: useful later for pixel verification, not required for planning artifact itself.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 13
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/renderer/components/settings/settings-page.tsx:28` - current settings tabs and insertion point.
  - `apps/desktop/src/renderer/components/settings/provider-settings.tsx:117` - adjacent setup surface to compare against.
  - `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx:103` - current plugin posture surface that should not become full setup UI accidentally.

  **Acceptance Criteria**:
  - [ ] New top-level surface placement decided and documented.
  - [ ] Coexistence with Providers/Plugins documented.

  **QA Scenarios**:
  ```
  Scenario: New Connections tab fits existing settings IA
    Tool: Read
    Preconditions: route/tab plan defined
    Steps:
      1. Inspect navigation update plan.
      2. Verify tab placement and rationale among General/Servers/Providers/etc.
    Expected Result: clear IA decision with no ambiguity.
    Evidence: .sisyphus/evidence/task-5-settings-ia.md

  Scenario: Plugins panel remains posture-oriented
    Tool: Read
    Preconditions: surface split documented
    Steps:
      1. Inspect plan for Plugins vs Connections responsibilities.
      2. Verify Plugins is not overloaded as primary setup flow.
    Expected Result: surface responsibility split is explicit.
    Evidence: .sisyphus/evidence/task-5-surface-split.md
  ```

  **Commit**: NO

- [ ] 6. Build seam inventory and proof helpers for MCP planning work

  **What to do**:
  - Inventory exact repo seams that future implementation touches: settings routes, provider dialogs, plugin panel, onboarding/migration, configconv, backend services, preload/IPC, and any config mutation paths.
  - Create/update lightweight proof-helper expectations in plan docs for repeated checks.

  **Must NOT do**:
  - Do not turn helpers into implementation macros for vendor-specific browser flows.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`mcp-worker-bindings`]
    - `mcp-worker-bindings`: ensures helper expectations align with runtime policy.
  - **Skills Evaluated but Omitted**:
    - `agent-browser`: overkill at planning stage.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 18, 24
  - **Blocked By**: None

  **References**:
  - `apps/desktop/src/preload/index.ts:381` - settings bridge seam.
  - `apps/desktop/src/main/ipc-handlers.ts:256` - main-process IPC registration surface.
  - `packages/configconv/src/converter/mcp.ts:1` - migration-side MCP conversion seam.

  **Acceptance Criteria**:
  - [ ] Seam inventory includes all likely implementation touchpoints.
  - [ ] Proof helper expectations documented for repeated QA.

  **QA Scenarios**:
  ```
  Scenario: Seam inventory covers renderer, preload, main, and config conversion paths
    Tool: Read
    Preconditions: inventory complete
    Steps:
      1. Inspect seam inventory.
      2. Verify at least one path is listed from renderer, preload, main, and configconv.
    Expected Result: implementation map is exhaustive enough for dispatch.
    Evidence: .sisyphus/evidence/task-6-seam-inventory.md

  Scenario: Proof helper expectations avoid vendor-specific automation sprawl
    Tool: Read
    Preconditions: helper guidance documented
    Steps:
      1. Inspect helper/proof section.
      2. Verify helpers are generic, composable, and not hardcoded end-to-end macros.
    Expected Result: helper policy aligns with repo/browser doctrine.
    Evidence: .sisyphus/evidence/task-6-helper-policy.md
  ```

  **Commit**: NO

---

- [ ] 7. Design and implement catalog ingestion/cache backend

  **What to do**:
  - Build local service/store that fetches official MCP Registry pages, normalizes entries, caches them, and exposes query/search primitives to renderer.
  - Support stale cache fallback and curated metadata enrichment joins.

  **Must NOT do**:
  - Do not fetch registry directly from renderer every dialog open.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`software-design-principles`]
  - **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 14, 15, 18
  - **Blocked By**: 1, 4

  **References**:
  - Official MCP Registry API research.
  - `apps/desktop/src/renderer/hooks/use-opencode-data.ts:474` - current TanStack Query pattern for remote catalog loading.

  **Acceptance Criteria**:
  - [ ] Service exposes paginated browse + search.
  - [ ] Cache and fallback behavior deterministic.

  **QA Scenarios**:
  ```
  Scenario: Cached catalog serves when registry fetch is unavailable
    Tool: Bash/API proof
    Preconditions: service implemented, seed cache populated
    Steps:
      1. Prime catalog cache.
      2. Simulate registry failure/unreachable state.
      3. Query browse/search endpoint.
    Expected Result: stale cached results returned with explicit freshness metadata.
    Evidence: .sisyphus/evidence/task-7-stale-cache-proof.txt

  Scenario: Pagination/search returns deterministic normalized entries
    Tool: Bash/API proof
    Preconditions: service implemented
    Steps:
      1. Query first page with fixed limit.
      2. Query next page cursor.
      3. Search for `notion` or `github`.
    Expected Result: normalized ids/titles/tags present; cursor works.
    Evidence: .sisyphus/evidence/task-7-catalog-pagination.json
  ```

  **Commit**: NO

- [ ] 8. Build backend config-mutation path for MCP registration in OpenCode

  **What to do**:
  - Define and implement backend operations that write/update/remove MCP entries in the right OpenCode config scope.
  - Support remote vs local MCP transport definitions, enable/disable, and per-entry metadata needed for runtime.
  - Trigger runtime refresh/dispose so new connections surface without manual restart.

  **Must NOT do**:
  - Do not rely on manual JSON editing.
  - Do not make renderer write config files directly.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`software-design-principles`, `mcp-worker-bindings`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 16, 17, 22, 23
  - **Blocked By**: 1, 2

  **References**:
  - `apps/desktop/src/preload/index.ts:381` - existing settings IPC bridge pattern.
  - `apps/desktop/src/main/ipc-handlers.ts:256` - main-process handler registration surface.
  - `packages/configconv/src/converter/from-canonical/to-opencode.ts:121` - OpenCode MCP config shape.
  - `packages/configconv/src/converter/mcp.ts:101` - remote/local conversion semantics.

  **Acceptance Criteria**:
  - [ ] MCP config entries can be created/updated/removed through backend API.
  - [ ] Runtime refresh path is explicit and tested.

  **QA Scenarios**:
  ```
  Scenario: Add remote MCP entry and see it in runtime posture without restart
    Tool: Bash/API + renderer query
    Preconditions: backend mutation path implemented
    Steps:
      1. Create a remote MCP config entry through the new backend path.
      2. Trigger runtime refresh/dispose logic.
      3. Query current MCP posture.
    Expected Result: new entry visible immediately as enabled/disabled per payload.
    Evidence: .sisyphus/evidence/task-8-runtime-refresh.txt

  Scenario: Remove MCP entry and confirm config cleanup
    Tool: Bash/API
    Preconditions: an MCP entry exists
    Steps:
      1. Delete entry via backend path.
      2. Read resulting config surface.
    Expected Result: entry absent; no orphaned partial state.
    Evidence: .sisyphus/evidence/task-8-config-cleanup.txt
  ```

  **Commit**: NO

- [ ] 9. Build MCPorter registration/auth adapter layer

  **What to do**:
  - Translate UI install intents into MCPorter config add/login/logout/test flows.
  - Support local/project/home scopes where appropriate.
  - Support seeding auth from known credential bundles when explicitly allowed.

  **Must NOT do**:
  - Do not hand-write MCPorter internal vault/credential schema.
  - Do not bypass official MCPorter add/login/vault entry points when avoidable.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`mcp-worker-bindings`, `mcp2cli`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 16, 17, 18, 21
  - **Blocked By**: 2, 3

  **References**:
  - MCPorter docs/research for `config add`, `config login`, `auth`, `logout`, `vault set`, `tokenCacheDir`.
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:76` - probe script and default runtime proof lane.

  **Acceptance Criteria**:
  - [ ] Adapter maps install/auth/test flows to official MCPorter surfaces.
  - [ ] Unsupported or unsafe token-import paths are gated and documented.

  **QA Scenarios**:
  ```
  Scenario: UI intent maps to MCPorter add + login flow
    Tool: Bash wrapper/log proof
    Preconditions: adapter implemented
    Steps:
      1. Trigger remote OAuth MCP registration intent.
      2. Capture emitted MCPorter operations.
      3. Verify config-add then login/auth sequence is used.
    Expected Result: official MCPorter entry points used; no handcrafted vault writes.
    Evidence: .sisyphus/evidence/task-9-mcporter-adapter.txt

  Scenario: Unsafe token-import path is rejected or explicitly gated
    Tool: API/Bash
    Preconditions: adapter implemented
    Steps:
      1. Attempt unsupported live sync or malformed token import.
      2. Inspect response.
    Expected Result: operation blocked with clear error/policy message.
    Evidence: .sisyphus/evidence/task-9-unsafe-import-block.txt
  ```

  **Commit**: NO

- [ ] 10. Normalize connection health and auth/setup state model

  **What to do**:
  - Create unified runtime status mapping: installed, configured, authenticated, reachable, healthy, degraded, offline, action-required.
  - Aggregate OpenCode config presence, MCPorter config presence, and test-call results into user-facing status.

  **Must NOT do**:
  - Do not reduce state to enabled/disabled only.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`software-design-principles`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 15, 17, 22
  - **Blocked By**: 1, 2

  **References**:
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:49` - required setup states.
  - `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx:66` - current simplistic status extraction to replace/extend.

  **Acceptance Criteria**:
  - [ ] Status model can distinguish auth-needed vs missing-env vs offline vs degraded.

  **QA Scenarios**:
  ```
  Scenario: Status model distinguishes missing env from auth required
    Tool: API/unit proof
    Preconditions: normalization layer implemented
    Steps:
      1. Feed one env-missing fixture and one auth-required fixture.
      2. Compare normalized statuses.
    Expected Result: distinct user-facing states.
    Evidence: .sisyphus/evidence/task-10-status-fixtures.txt

  Scenario: Degraded/offline mapping surfaces actionable labels
    Tool: Read/API
    Preconditions: state mapping implemented
    Steps:
      1. Inspect degraded and offline fixtures.
      2. Verify actions and labels differ.
    Expected Result: user gets correct remediation prompts.
    Evidence: .sisyphus/evidence/task-10-remediation-labels.md
  ```

  **Commit**: NO

- [ ] 11. Build recommendation and ranking policy for top MCP picks

  **What to do**:
  - Define curated top list and ranking logic independent of raw registry order.
  - Include rationale fields, category tags, beginner-safe ordering, and future telemetry hooks.
  - Initial recommended top 10 should include practical mainstream picks such as GitHub, Notion, Google Drive/Workspace, Slack, Linear, Sentry, Context7, Postgres, Supabase, Stripe unless evidence during implementation changes exact list.

  **Must NOT do**:
  - Do not present speculative popularity as factual registry metadata.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: [`mcp-worker-bindings`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 14
  - **Blocked By**: 4

  **References**:
  - User request for top recommendations.
  - Registry/marketplace research gathered during planning.

  **Acceptance Criteria**:
  - [ ] Recommendation list is versioned/curated, not entangled with registry source.
  - [ ] Each recommendation has rationale/tags.

  **QA Scenarios**:
  ```
  Scenario: Curated top list renders independent of registry ordering
    Tool: Fixture/read proof
    Preconditions: ranking policy implemented
    Steps:
      1. Feed registry fixtures with shuffled order.
      2. Read produced recommendation section.
    Expected Result: curated ordering remains stable.
    Evidence: .sisyphus/evidence/task-11-curated-order.txt

  Scenario: Each recommended MCP has rationale and tags
    Tool: Read
    Preconditions: policy implemented
    Steps:
      1. Inspect top 10 metadata entries.
      2. Verify each includes category/tags/rationale.
    Expected Result: downstream recommendation layer is rich enough for UI.
    Evidence: .sisyphus/evidence/task-11-recommendation-metadata.md
  ```

  **Commit**: NO

- [ ] 12. Design local/cloud ownership and credential portability workflow

  **What to do**:
  - Specify exact workflows for: local-only auth, cloud-only auth, one-shot local-to-cloud handoff, and no-gateway mode.
  - Define how Hush targets, MCPorter vault seeding, and callback methods interact.

  **Must NOT do**:
  - Do not imply simultaneous dual ownership of one refresh chain.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`hush-secrets`, `mcp-worker-bindings`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 16, 24
  - **Blocked By**: 3

  **References**:
  - Draft research notes on local credential mode and refresh rotation.

  **Acceptance Criteria**:
  - [ ] Portability workflows are explicit and safe.
  - [ ] Unsupported live sync pattern explicitly rejected.

  **QA Scenarios**:
  ```
  Scenario: Local-to-cloud handoff workflow is one-shot and explicit
    Tool: Read
    Preconditions: workflow documented
    Steps:
      1. Inspect portability workflow.
      2. Verify one-shot import/handoff is supported and ongoing sync is not.
    Expected Result: safe portability path documented.
    Evidence: .sisyphus/evidence/task-12-portability-flow.md

  Scenario: No-gateway local mode is fully supported
    Tool: Read
    Preconditions: workflow documented
    Steps:
      1. Inspect local-only path.
      2. Verify it does not depend on gateway services.
    Expected Result: laptop-local path stands alone.
    Evidence: .sisyphus/evidence/task-12-local-only-proof.md
  ```

  **Commit**: NO

---

- [ ] 13. Implement Connections settings page and list surface

  **What to do**:
  - Add new Settings route/tab and initial list surface showing connected, recommended, and actionable setup states.
  - Reuse visual structure from provider settings where appropriate, while adapting for MCP-specific status richness.

  **Must NOT do**:
  - Do not copy provider wording that talks about “models” instead of servers/tools.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-best-practices`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 14, 15, 16
  - **Blocked By**: 5, 7

  **References**:
  - `apps/desktop/src/renderer/components/settings/settings-page.tsx:38`
  - `apps/desktop/src/renderer/components/settings/provider-settings.tsx:175`

  **Acceptance Criteria**:
  - [ ] Settings shows a first-class Connections entry and route.
  - [ ] List surface shows connected + recommended sections with MCP-specific language.

  **QA Scenarios**:
  ```
  Scenario: Connections tab appears in settings sidebar and route resolves
    Tool: Browser automation
    Preconditions: dev surface running
    Steps:
      1. Open settings sidebar.
      2. Click `Connections`.
      3. Assert URL/path and page title update.
    Expected Result: route resolves and page renders.
    Evidence: .sisyphus/evidence/task-13-connections-route.png

  Scenario: Page language is MCP-specific, not provider-model-specific
    Tool: Screenshot/read proof
    Preconditions: page implemented
    Steps:
      1. Inspect headings/body copy.
      2. Assert terms like server/tools/connection used instead of model/provider-only copy.
    Expected Result: MCP-centric copy across surface.
    Evidence: .sisyphus/evidence/task-13-copy-audit.md
  ```

  **Commit**: NO

- [ ] 14. Implement connections catalog dialog with curated picks, search, and pagination

  **What to do**:
  - Build plus-button/catalog dialog that shows curated recommendations first, registry search, and paginated browse results.
  - Include lightweight cards with transport/auth badges and recommendation metadata.

  **Must NOT do**:
  - Do not dump massive raw registry metadata into first paint.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-best-practices`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 15, 16
  - **Blocked By**: 7, 11, 13

  **References**:
  - `apps/desktop/src/renderer/components/settings/provider-settings.tsx:520` - existing searchable catalog dialog baseline.

  **Acceptance Criteria**:
  - [ ] Curated top recommendations visible immediately.
  - [ ] Search works across catalog.
  - [ ] Pagination/cursor browse works for long tail.

  **QA Scenarios**:
  ```
  Scenario: Curated picks appear before long-tail registry results
    Tool: Browser automation
    Preconditions: catalog dialog implemented with fixture/live data
    Steps:
      1. Open dialog from Connections page.
      2. Inspect top viewport without search.
    Expected Result: recommended MCP cards visible first.
    Evidence: .sisyphus/evidence/task-14-curated-first.png

  Scenario: Search narrows registry results and pagination advances
    Tool: Browser automation or API proof
    Preconditions: catalog service available
    Steps:
      1. Search `notion`.
      2. Assert filtered results contain notion-like entries.
      3. Clear search and advance next page.
    Expected Result: search and cursor paging both work.
    Evidence: .sisyphus/evidence/task-14-search-pagination.md
  ```

  **Commit**: NO

- [ ] 15. Implement connection detail cards/drawer with status, transport, tools, and trust metadata

  **What to do**:
  - Show server-level details: transport, auth type, tool counts, read/write counts, health, ownership mode, and recommendation/trust notes.
  - Support expanded detail from both recommended and connected entries.

  **Must NOT do**:
  - Do not show tool schemas inline by default if not needed.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-best-practices`, `mcp-worker-bindings`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 16, 17
  - **Blocked By**: 7, 10, 14

  **References**:
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:50` - server card contract.

  **Acceptance Criteria**:
  - [ ] Card/detail view shows enough information to decide whether to connect.
  - [ ] Mutability/read-write counts are visible.

  **QA Scenarios**:
  ```
  Scenario: Detail card shows actionable trust/setup metadata
    Tool: Browser automation
    Preconditions: detail surface implemented
    Steps:
      1. Open a recommended MCP detail view.
      2. Assert presence of transport, auth/health, tool count, read/write count.
    Expected Result: all key decision metadata visible.
    Evidence: .sisyphus/evidence/task-15-detail-card.png

  Scenario: Tool schemas are not over-expanded by default
    Tool: Screenshot/read proof
    Preconditions: detail surface implemented
    Steps:
      1. Open detail card.
      2. Verify full schemas are hidden behind explicit action, not dumped into initial view.
    Expected Result: compact detail by default.
    Evidence: .sisyphus/evidence/task-15-schema-restraint.md
  ```

  **Commit**: NO

- [ ] 16. Implement install/auth/setup wizard flows across OAuth, device/manual, env, and stdio modes

  **What to do**:
  - Build multi-step connection wizard reusing provider-dialog patterns for MCP installs.
  - Support remote OAuth, device/manual code flow, env-required/manual setup, and local stdio command/config setup.
  - Handle local/cloud ownership mode choices when relevant.

  **Must NOT do**:
  - Do not assume all servers support same auth mechanism.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-best-practices`, `mcp-worker-bindings`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 17, 18
  - **Blocked By**: 8, 9, 12, 14, 15

  **References**:
  - `apps/desktop/src/renderer/components/settings/connect-provider-dialog.tsx:249` - step machine and success/error handling baseline.
  - `apps/desktop/src/renderer/components/settings/connect-provider-dialog.tsx:796` - OAuth flow UI baseline.
  - `apps/desktop/src/renderer/components/settings/connect-provider-dialog.tsx:468` - env setup baseline.

  **Acceptance Criteria**:
  - [ ] Wizard supports at least four setup patterns: OAuth, device/manual code, env-required, stdio/local.
  - [ ] Ownership mode choice is surfaced where needed.

  **QA Scenarios**:
  ```
  Scenario: OAuth-capable MCP launches auth flow and returns to success state
    Tool: Browser automation with mocked backend or safe live target
    Preconditions: wizard implemented
    Steps:
      1. Choose OAuth-backed MCP.
      2. Start connect flow.
      3. Complete mocked/safe auth callback.
    Expected Result: success state reached with no restart prompt.
    Evidence: .sisyphus/evidence/task-16-oauth-success.png

  Scenario: Env-required MCP shows explicit manual setup guidance
    Tool: Browser automation
    Preconditions: env-required target available
    Steps:
      1. Choose env-required MCP.
      2. Open wizard.
      3. Inspect setup guidance.
    Expected Result: exact required env/config steps shown, not broken OAuth flow.
    Evidence: .sisyphus/evidence/task-16-env-guidance.png
  ```

  **Commit**: NO

- [ ] 17. Implement hot activation, success animation, and immediate runtime refresh behavior

  **What to do**:
  - On successful connect, show strong success feedback and refresh relevant runtime/config surfaces immediately.
  - Update connected lists, plugin/MCP posture, and any session-available runtime metadata.

  **Must NOT do**:
  - Do not require manual app refresh or OpenCode restart for normal successful flows.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-best-practices`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 22
  - **Blocked By**: 8, 9, 10, 15, 16

  **References**:
  - `apps/desktop/src/renderer/components/settings/connect-provider-dialog.tsx:1169` - current success view baseline.
  - `apps/desktop/src/renderer/components/settings/connect-provider-dialog.tsx:333` - current `client.global.dispose()` refresh trigger pattern.

  **Acceptance Criteria**:
  - [ ] Success state is animated/clear.
  - [ ] Connected/runtime posture updates immediately after success.

  **QA Scenarios**:
  ```
  Scenario: Successful connect updates Connections page without manual reload
    Tool: Browser automation
    Preconditions: connect flow completes successfully
    Steps:
      1. Complete install/auth wizard.
      2. Close success state.
      3. Inspect Connections list.
    Expected Result: server appears connected immediately.
    Evidence: .sisyphus/evidence/task-17-hot-activation.png

  Scenario: Plugin/MCP posture surface reflects new server after success
    Tool: Browser automation or API proof
    Preconditions: successful connection
    Steps:
      1. Open plugins/MCP posture surface.
      2. Verify new server is listed with expected status.
    Expected Result: runtime posture refreshed.
    Evidence: .sisyphus/evidence/task-17-plugins-refresh.md
  ```

  **Commit**: NO

- [ ] 18. Implement safe test-call UX and evidence capture for each connection

  **What to do**:
  - Add “Test connection” or equivalent that executes a safe read operation or MCPorter probe.
  - Capture minimal evidence of success/failure and show actionable diagnostics.

  **Must NOT do**:
  - Do not run mutating tools as test probes.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`mcp-worker-bindings`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 22, F3
  - **Blocked By**: 7, 9, 16

  **References**:
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:57` - safe test control expectation.

  **Acceptance Criteria**:
  - [ ] Every connected MCP can show last successful/failed probe.
  - [ ] Probe path avoids destructive actions.

  **QA Scenarios**:
  ```
  Scenario: Safe test probe succeeds for connected MCP
    Tool: Browser automation + backend proof
    Preconditions: connected safe-read MCP
    Steps:
      1. Click `Test connection`.
      2. Wait for completion.
      3. Inspect result state and captured evidence.
    Expected Result: probe succeeds and marks connection healthy.
    Evidence: .sisyphus/evidence/task-18-safe-test-success.md

  Scenario: Probe failure yields actionable diagnostics
    Tool: Browser automation + backend proof
    Preconditions: intentionally broken/offline MCP fixture
    Steps:
      1. Run test against broken target.
      2. Inspect result state.
    Expected Result: failure message distinguishes auth/network/config class.
    Evidence: .sisyphus/evidence/task-18-safe-test-failure.md
  ```

  **Commit**: NO

---

- [ ] 19. Implement compact MCP runtime meta-tools and catalog search path

  **What to do**:
  - Add runtime support for `mcp.search`, `mcp.describe`, `mcp.call`, optional `mcp.status`.
  - Back these with normalized catalog data and per-tool schema lookup.

  **Must NOT do**:
  - Do not expose every tool eagerly in initial prompt/tool set.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`mcp-worker-bindings`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 20, 21, 22
  - **Blocked By**: 1, 2

  **References**:
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:34`

  **Acceptance Criteria**:
  - [ ] Compact runtime surface exists and is used in place of full injection.

  **QA Scenarios**:
  ```
  Scenario: Agent boot/runtime surface includes compact MCP meta-tools only
    Tool: Read/runtime proof
    Preconditions: runtime integration complete
    Steps:
      1. Inspect runtime tool registration.
      2. Verify meta-tools present and per-tool explosion absent.
    Expected Result: compact tool surface only.
    Evidence: .sisyphus/evidence/task-19-meta-tools.md

  Scenario: Search returns compact relevant candidates from connected catalog
    Tool: API/probe
    Preconditions: catalog loaded
    Steps:
      1. Call `mcp.search` with `github` or `docs` query.
      2. Inspect result payload.
    Expected Result: concise candidate list with enough metadata to refine.
    Evidence: .sisyphus/evidence/task-19-search-results.json
  ```

  **Commit**: NO

- [ ] 20. Implement schema describe path and selective hydration flow

  **What to do**:
  - Ensure exact tool schemas only materialize when a specific server/tool is requested.
  - Cache/normalize schema lookups and connect them to runtime search results.

  **Must NOT do**:
  - Do not bloat prompt/runtime state with entire connected schema universe.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`mcp-worker-bindings`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 21, 22
  - **Blocked By**: 2, 19

  **References**:
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:23`

  **Acceptance Criteria**:
  - [ ] Describe path yields exact schema only on demand.

  **QA Scenarios**:
  ```
  Scenario: Describe returns exact schema for selected tool only
    Tool: API/probe
    Preconditions: runtime describe implemented
    Steps:
      1. Search for a server.
      2. Describe one specific tool.
      3. Inspect payload.
    Expected Result: exact schema for selected tool, not entire server universe unless asked.
    Evidence: .sisyphus/evidence/task-20-describe-schema.json

  Scenario: Unused tool schemas remain unloaded
    Tool: Read/log proof
    Preconditions: instrumentation available
    Steps:
      1. Perform browse/search without describe.
      2. Inspect schema hydration logs/metrics.
    Expected Result: no eager mass hydration.
    Evidence: .sisyphus/evidence/task-20-lazy-hydration.md
  ```

  **Commit**: NO

- [ ] 21. Implement approval-aware MCP call execution with mutability metadata

  **What to do**:
  - Validate args against schema before execution.
  - Mark mutating/destructive tools for approval and preserve provenance/telemetry.

  **Must NOT do**:
  - Do not execute write/destructive tools as if they were safe reads.

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`mcp-worker-bindings`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: 22, F3
  - **Blocked By**: 2, 9, 19, 20

  **References**:
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:26`

  **Acceptance Criteria**:
  - [ ] Invalid args fail before remote execution.
  - [ ] Mutating tools carry approval metadata.

  **QA Scenarios**:
  ```
  Scenario: Invalid args are rejected before hitting MCP server
    Tool: API/probe
    Preconditions: schema validation implemented
    Steps:
      1. Call `mcp.call` with malformed args.
      2. Inspect response and server-side evidence.
    Expected Result: validation error returned locally; remote call not made.
    Evidence: .sisyphus/evidence/task-21-local-validation.txt

  Scenario: Mutating tool requires approval metadata
    Tool: API/read proof
    Preconditions: mutating tool fixture available
    Steps:
      1. Describe or prepare a write-capable tool.
      2. Inspect execution metadata.
    Expected Result: approval/mutability flag present before execution.
    Evidence: .sisyphus/evidence/task-21-approval-metadata.md
  ```

  **Commit**: NO

- [ ] 22. Integrate Connections with plugins/runtime posture and active session surfaces

  **What to do**:
  - Update side-panel/plugin posture or related surfaces so they reflect connected MCPs, active runtime readiness, and test status.
  - Add session-scoped visibility into which MCP connections are active/hydrated.

  **Must NOT do**:
  - Do not confuse “configured” with “active for current run”.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`react-best-practices`, `mcp-worker-bindings`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1, F3, F4
  - **Blocked By**: 8, 10, 17, 18, 19, 20, 21

  **References**:
  - `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx:76` - current posture panel.
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:55` - session controls expectation.

  **Acceptance Criteria**:
  - [ ] Runtime surfaces distinguish configured, connected, and active/hydrated states.

  **QA Scenarios**:
  ```
  Scenario: Plugins/runtime panel reflects active MCP posture
    Tool: Browser automation
    Preconditions: runtime integration complete
    Steps:
      1. Connect MCP.
      2. Open runtime/plugins surface.
      3. Inspect state labels.
    Expected Result: configured/active/tested states visible.
    Evidence: .sisyphus/evidence/task-22-runtime-posture.png

  Scenario: Session surface shows active hydrated tools separately from merely connected servers
    Tool: Browser automation or read proof
    Preconditions: session-level visibility implemented
    Steps:
      1. Start run with selected MCP usage.
      2. Inspect session surface.
    Expected Result: active hydrated subset visible separately from total connected set.
    Evidence: .sisyphus/evidence/task-22-hydrated-subset.md
  ```

  **Commit**: NO

- [ ] 23. Integrate Connections system with onboarding and config migration surfaces

  **What to do**:
  - Ensure imported/migrated MCP definitions from Cursor/Claude/OpenCode become visible and manageable in Connections.
  - Define provenance labels for imported versus locally added entries.

  **Must NOT do**:
  - Do not strand migrated MCPs in hidden config-only state.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`software-design-principles`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1, F4
  - **Blocked By**: 8

  **References**:
  - `README.md:87` - migration promise includes MCP servers.
  - `apps/desktop/src/main/onboarding.ts:36` - provider detection already counts MCP servers.
  - `packages/configconv/src/converter/mcp.ts:1` - conversion path for existing MCP config.

  **Acceptance Criteria**:
  - [ ] Imported MCPs appear in Connections with provenance labels.

  **QA Scenarios**:
  ```
  Scenario: Migrated MCP entries appear in Connections with import provenance
    Tool: Browser automation + fixture import
    Preconditions: migration path available
    Steps:
      1. Import sample config containing MCPs.
      2. Open Connections page.
    Expected Result: imported entries appear and are manageable.
    Evidence: .sisyphus/evidence/task-23-import-provenance.png

  Scenario: Connections can manage migrated entry without losing source context
    Tool: Browser/API proof
    Preconditions: migrated entry present
    Steps:
      1. Open migrated entry details.
      2. Inspect labels/actions.
    Expected Result: source/provenance still visible.
    Evidence: .sisyphus/evidence/task-23-provenance-details.md
  ```

  **Commit**: NO

- [ ] 24. Update docs, runbooks, and durable policy surfaces for MCP connections system

  **What to do**:
  - Update repo docs/wiki/AGENTS-adjacent durable surfaces with new Connections architecture, MCPorter policy, credential modes, and support/recovery workflows.
  - Add operator-facing runbook for registry outage, broken auth, local/cloud handoff, and safe reprobe.

  **Must NOT do**:
  - Do not leave critical architecture only in code comments.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: [`mcp-worker-bindings`, `hush-secrets`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: F1, F4
  - **Blocked By**: 3, 6, 12

  **References**:
  - `README.md:157` - current docs defer MCP setup to OpenCode docs; this will need refining once product adds first-class setup UX.
  - `/Users/hassoncs/.config/skillshare/skills/mcp-worker-bindings/SKILL.md:49`

  **Acceptance Criteria**:
  - [ ] Durable docs explain Connections architecture and operator recovery flows.

  **QA Scenarios**:
  ```
  Scenario: Recovery runbook covers auth failure, stale cache, and local/cloud handoff
    Tool: Read
    Preconditions: docs updated
    Steps:
      1. Inspect runbook.
      2. Verify sections for auth recovery, registry outage, and handoff exist.
    Expected Result: operator can recover common incidents without rediscovery.
    Evidence: .sisyphus/evidence/task-24-runbook-audit.md

  Scenario: User-facing docs no longer imply MCP setup is external-only
    Tool: Read
    Preconditions: docs updated
    Steps:
      1. Inspect README/settings docs.
      2. Verify first-class Connections UX is reflected.
    Expected Result: docs match shipped product direction.
    Evidence: .sisyphus/evidence/task-24-docs-alignment.md
  ```

  **Commit**: NO

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Verify every Must Have is represented in implementation surfaces; verify every Must NOT Have is absent. Confirm Connections exists as first-class UI, MCPorter remains control plane, lazy hydration contract exists, and dual-mode credential architecture is documented and enforced.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run repo lint/typecheck targets relevant to changed areas. Review changed files for type pollution, duplicated provider/MCP logic, unsafe token handling, handwritten vault schemas, dead UI branches, and AI-slop abstractions.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | VERDICT`

- [ ] F3. **Real UX and Runtime QA** — `unspecified-high`
  Execute full happy/failure paths: open Connections, browse catalog, search, connect safe MCP, test it, verify runtime visibility, verify failure states for auth/env/offline paths, and verify compact runtime MCP surface behavior.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  Compare final work to this plan and ensure no accidental scope creep into generic provider marketplace work, full generated-client architecture, or unsafe token-sync designs. Validate documentation and migration surfaces align.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy <!-- oc:id=sec_am -->

- Commit after each coherent wave or sub-wave when verified.
- Prefer slices aligned to architectural seams, for example:
  - `feat(connections): add settings route and catalog shell`
  - `feat(mcp): add registry cache and connection status model`
  - `feat(mcporter): add registration and auth adapter`
  - `feat(runtime): add compact mcp meta-tools and approval metadata`
  - `docs(connections): add mcporter control-plane and credential runbook`

---

## Success Criteria

### Verification Commands
```bash
bun run lint
bun run check-types
bun run svc:status
```

### Final Checklist
- [ ] First-class Connections UI exists and is reachable.
- [ ] Curated + registry catalog works with cache fallback.
- [ ] MCP registration/auth/test flows work for multiple setup modes.
- [ ] Successful connect updates runtime posture immediately.
- [ ] Compact MCP meta-tools replace full global schema injection.
- [ ] Mutating tools carry approval metadata.
- [ ] Local-only and cloud-hosted modes are both supported in architecture and UX.
- [ ] Imported/migrated MCP definitions are visible and manageable.
- [ ] Durable docs/runbooks cover recovery and ownership modes.