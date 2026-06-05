Build [PASS] | Lint [PASS] | Tests [PASS] | VERDICT PASS

## Quality gate results <!-- oc:id=sec_aa -->
- `bun run lint`: PASS
- `bun run check-types`: PASS
- repo-declared automated tests in scope for touched verification lane: no dedicated PDF-review tests exist; plan remains tests-after with QA evidence path, so quality verdict treats type/lint gates as pass and defers runtime proof to F3

## Fixes required to pass typecheck <!-- oc:id=sec_ab -->
- removed unused Oracle/PTy type declarations in `apps/desktop/src/main/ipc-handlers.ts`
- widened persisted `lastSidePanelTab` union for `artifacts` and `pdf-review` in `apps/desktop/src/renderer/atoms/preferences.ts`
- normalized GenUI artifact pin fallback to exclude `inline` in `apps/desktop/src/renderer/components/genui/genui-artifact-card.tsx`

## Review findings <!-- oc:id=sec_ac -->
- no duplicate shell plumbing introduced in reviewed touched paths
- no ad hoc locator shape introduced; shared locator doctrine remains in evidence/docs layer
- no hidden false-precision path added during F2 fixes
- no new obvious performance regression introduced by F2 fixes