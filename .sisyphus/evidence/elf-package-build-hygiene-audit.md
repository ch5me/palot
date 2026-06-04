# Elf package/build hygiene audit <!-- oc:id=sec_aa -->

## Verified commands <!-- oc:id=sec_ab -->
- `bun run lint` passes from repo root.
- `bun run check-types` passes from repo root via Turbo.
- `cd apps/desktop && bun run dev` is the documented desktop dev entrypoint.
- `cd apps/server && bun run build:types` is the documented type-regeneration step when server routes change.

## Evidence <!-- oc:id=sec_ac -->
- Root scripts in `package.json` define `lint`, `check-types`, `dev:desktop`, and package flows.
- Desktop scripts in `apps/desktop/package.json` define `dev`, `build`, `package`, and per-platform packaging.
- Server scripts in `apps/server/package.json` define `dev`, `build`, `build:types`, and `check-types`.
- Current local proof: root lint and typecheck were executed successfully on 2026-06-02.

## Blockers <!-- oc:id=sec_ad -->
- No blocker found for root lint or typecheck.
- `cd apps/desktop && bun run dev` currently fails immediately because `electron-vite` is not on PATH in the script environment (`code 127: electron-vite: command not found`).
- This is a real Task 5 blocker for local dev boot proof until desktop dependencies or the script environment are repaired.

## Footguns <!-- oc:id=sec_ae -->
- `apps/desktop` still depends on workspace-linked packages like `@ch5me/firefly-design`, `@ch5me/workspace`, and `@ch5me/elf-ui`; cross-repo provider dist staleness is a known risk per `AGENTS.md`.
- Browser-mode route changes require `cd apps/server && bun run build:types` or frontend route typings drift.
- Local mac packaging without a cert requires the documented env override in `AGENTS.md`.

## Verdict <!-- oc:id=sec_af -->
- Task 5 acceptance is satisfied for audit scope: blocker list documented, verification commands locked, and cross-repo/package footguns called out.
- Current remaining blocker is explicit: desktop dev boot is blocked by missing `electron-vite` resolution in the current environment.
