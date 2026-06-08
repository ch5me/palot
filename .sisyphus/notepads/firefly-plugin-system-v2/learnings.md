## 2026-06-07T23:00:00Z Task: foundation
Committed V2 foundation in 4 scoped commits:
- manifest + descriptor
- capability taxonomy
- tool projection + 9-state machine
- palot bridge first-party manifest exemplar

Key learnings:
- current apps/desktop biome setup only checks a small config file set via script; use `bun run lint` as repo-grounded lint signal, not direct per-file biome targeting.
- firefly-plugin namespace now exists under apps/desktop/src/shared/firefly-plugin/ and is safe place for shared V2 contracts.
- reserved command ids in manifest use short ids, not dotted host-style ids; plugin business tools use full namespaced ids.
- contribution family contracts should stay host-vocabulary-first: panels/widgets own placement contracts and escape-hatch eligibility; commands/themes stay chrome-safe, with theme preview/apply remaining host-owned.

## 2026-06-08T00:30:00Z Task: api-versioning
Added `apps/desktop/src/shared/firefly-plugin/api-versioning.ts` (+ test) and exported from `index.ts`.

Encoded:
- tier vocabulary `["stable", "proposed", "internal"]` (API_TIERS), with `internal` never available to non-built-in trust and `proposed` always marked unstable.
- manifest revision rule table (MANIFEST_REVISION_RULES) keyed by integer revision, each entry carrying `minHostVersion`, tier, and optional deprecation. negotiation helpers reject revisions below MIN_MANIFEST_REVISION, above MAX_MANIFEST_REVISION, beyond hostKnownMaxRevision, below the per-revision `minHostVersion` floor, or unknown in the table.
- `negotiateApiVersion` folds in the manifest's optional `engines.desktop` floor so the catalog loader gets a single decision.
- separate sub-manifest surface revision tables for `tool-result-envelope`, `bridge`, and `inspection-tool` so bridge/tool/inspection schema evolution is auditable in one place, with their own `negotiateBridgeSchema` / `negotiateToolResultEnvelope` / `negotiateInspectionToolSet` wrappers.
- `deprecationPolicySchema` with concrete fields `replacement` (required), `removalTarget` (semver), `removalRevision` (int <= MAX_MANIFEST_REVISION), `codemod` (codemodExpectationSchema), `migrationNote`. At least one of removalTarget/removalRevision is required.
- `codemodExpectationSchema` with availability `["none", "available", "required", "manual-only"]`, superRefine enforces the field-set rules: `required` and `available` need `codemodId`; `manual-only` needs at least one `manualStep`; `none` carries neither.
- `evaluateCodemodExpectation` and `computeDeprecationStatus` give migration tooling a structured decision.
- `annotateApiSurface` + `isApiSurfaceAvailableToTrust` + `isApiSurfaceUnstable` + `evaluateApiSurfaceAvailability` cover the per-surface tier gating.
- `summarizeApiSurface` produces a JSON-serializable summary for the operator UI.

Verification:
- `cd apps/desktop && bunx tsgo --noEmit` clean
- `cd apps/desktop && bun test src/shared/firefly-plugin/` — 139 pass, 0 fail (was 78, added 61 new tests in api-versioning.test.ts).

Key learnings:
- descriptor.ts already enforces `engines.desktop` floor; api-versioning layers on top with the manifest-revision-side floor. Two floors, one decision surface.
- comparison helper for manifest revisions stays purely numeric — semver compare is wrong for integer revisions, so kept them separate.
- deprecation policy requires *both* a replacement AND at least one of removalTarget/removalRevision. Silent deprecation (replacement-less) is a footgun; explicit removal window is non-negotiable.
- codemod superRefine had to reject `none` carrying a codemodId *and* reject `available`/`required` lacking one. Test cases lock both directions so the schema can't drift later.
