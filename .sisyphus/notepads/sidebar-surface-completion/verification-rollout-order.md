# Verification And Rollout Order Notes <!-- oc:id=sec_aa -->

## Current findings <!-- oc:id=sec_ab -->
- Task 11 completed.
- Canonical local proof commands already exist:
  - root: `bun run lint`, `bun run check-types`
  - browser-mode stack: `bun run dev` / `bun run svc:status`
  - desktop-specific: `cd apps/desktop && bun run dev:electron-local`
- Browser, Claude, and Memory each now have explicit architecture + UI + seam plans, so rollout can be staged instead of shipped as one combined bet.
- Browser is the earliest runtime-sensitive dependency because it has separate Electron and browser-mode ownership paths.
- Claude depends on backend seam repair/preflight and should be verified in Electron runtime only for phase 1.
- Memory depends on Browser/Claude less directly, but should still follow after shared shell/runtime policy changes so its save/reopen proof lands on a stable sidebar surface.
- Locked rollout order: shell/policy cleanup -> Browser -> Claude -> Memory -> default flips -> final audit.

## Open questions <!-- oc:id=sec_ac -->
- Should rollout require manual human proof after each milestone before enabling the next default flip, or is local engineering proof enough until later CI coverage grows?
- Do we want one combined release after all three surfaces, or staged shipping after each milestone once its proof gate passes?
