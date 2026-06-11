# PM Side Agents Panel: Final Handoff & Blocker Attribution <!-- oc:id=sec_aa -->

## State Summary <!-- oc:id=sec_ab -->
- **Dense Console**: Live, uses shared mapper, accurate provenance badges.
- **Side Agents Panel**: Implemented, replaces placeholder. Wired to `/api/ch5pm/babysitter` and `/api/ch5pm/queue` with explicit loop health, box digests, and queue groupings.
- **Tests**: Passing. `bun test apps/desktop/src/renderer/pm-side-agents` yields 46 pass, 0 fail.

## Live Contract Proof <!-- oc:id=sec_ac -->
- `/api/ch5pm/state`: Returns `boxes` (3), `sessions` (59), `needsChris` (2), `degradedReasons` (stale-heartbeat). Verified at `2026-06-11T10:21:48.500Z`.
- `/api/ch5pm/queue`: Validates schema. Payload is envelope with `rows` object containing `jobs` and `claims` arrays, not flat top-level arrays. Degraded reason `terminal-jobs-need-reconcile:38` accurately reflected.

## Typecheck Blocker Attribution <!-- oc:id=sec_ad -->
`bun run check-types` fails, but the blocking error is **outside the PM dashboard/component/composition logic**.
- **Exact Failure**: `@ch5me/elf-server:check-types` fails with:
  > `../../packages/mcp-runtime-shared/src/index.ts(6,8): error TS6307: File '/Users/hassoncs/src/ch5/palot/apps/desktop/src/shared/mcp-connections-shared.ts' is not listed within the file list of project '/Users/hassoncs/src/ch5/palot/apps/server/tsconfig.json'.`
- **Impact**: pre-existing server/shared MCP inclusion error. It is not caused by `pm-dockview.tsx`, `pm-live-dashboard.tsx`, `pm-side-agents-panel.tsx`, or `apps/desktop/src/renderer/pm-side-agents/*`.
- **Verification**: targeted diagnostics and tests are clean for PM slice files; blocker belongs to server/shared type-inclusion plumbing, not PM dashboard behavior.

## Git Scope Fidelity <!-- oc:id=sec_ae -->
**PM Intended Changes (Committed/Staged)**:
- `apps/desktop/src/renderer/components/pm-dockview.tsx`
- `apps/desktop/src/renderer/components/pm-live-dashboard.tsx`
- `apps/desktop/src/renderer/components/pm-side-agents-panel.tsx`
- `apps/desktop/src/renderer/pm-side-agents/composition.ts`
- `apps/desktop/src/renderer/pm-side-agents/composition.test.ts`
- `apps/desktop/src/renderer/pm-side-agents/registry.ts`
- `apps/desktop/src/renderer/pm-side-agents/registry.test.ts`
- `apps/desktop/src/renderer/services/backend.ts` (PM side-agent fetch seam)
- `apps/desktop/src/renderer/services/elf-server.ts` (PM side-agent fetch seam)

**Unrelated Dirty State (Excluded from PM slice)**:
- `bun.lock`
- Various `.sisyphus/drafts/*`, `.sisyphus/evidence/task-*`, session-sync artifacts, and untracked build artifacts (`.map`, `.js`).
*PM delivery intentionally includes the service-layer fetch seam files above. Other unrelated dirty files were not claimed as part of this PM delivery.*

## Next Steps <!-- oc:id=sec_af -->
1. **Typecheck Fix**: Resolve the `elf-server` `TS6307` inclusion error for `mcp-connections-shared.ts` in a separate, targeted PR. <!-- oc:id=item_aa -->
1. **Commit**: PM slice is ready for coherent commit: `fix(pm): complete side agents project manager panel`. (Pending user explicit OK or auto-commit policy execution). <!-- oc:id=item_ab -->
1. **Browser Proof**: Verified at `http://localhost:20883/#/project-manager`. Dense Console and Side Agents tabs render live daemon state without fallback masking. <!-- oc:id=item_ac -->

---
*Generated: 2026-06-11*
*Mission: Rescue PM Side Agents Seam*