# F2 — Source-Reference / Repo-Reality Audit <!-- oc:id=sec_aa -->

## Valid references <!-- oc:id=sec_ab -->

All plan and evidence references were checked against the current repo. The following are valid and grounded:

- `apps/desktop/src/renderer/firefly-surface-registry.tsx`
- `apps/desktop/src/renderer/session-widget-registry.tsx`
- `apps/desktop/src/renderer/atoms/session-widgets.ts`
- `apps/desktop/src/renderer/components/command-palette.tsx`
- `apps/desktop/src/renderer/lib/themes.ts`
- `apps/desktop/src/renderer/hooks/use-theme.ts`
- `apps/desktop/src/preload/index.ts`
- `apps/desktop/src/preload/api.d.ts`
- `apps/desktop/src/main/palot-opencode-plugin-shim.ts`
- `apps/desktop/.opencode/plugins/palot-bridge.js`
- `apps/desktop/src/shared/palot-bridge-schemas.ts`
- `docs/palot-opencode-plugin-bridge.md`
- `docs/genui-artifact-architecture.md`
- `packages/ui/src/styles/globals.css`
- `apps/desktop/src/main/automation/registry.ts`
- `apps/desktop/electron.vite.config.ts`
- `README.md`

All Wave 1–4 evidence file paths under `.sisyphus/evidence/` referenced by the plan are present on disk.

## Weak refs <!-- oc:id=sec_ac -->

0 weak refs. No repo path or evidence path cited in the V2 plan or the Wave 1–4 evidence is absent or implausible. The plan's proposed packages are clearly marked as new modules rather than claimed as already existing files.

## Proposed-new-paths list with justification <!-- oc:id=sec_ad -->

The following are not present today, but the plan and evidence mark them as **new** package/module work, which is acceptable:

| Proposed path | Justification |
|---|---|
| `packages/firefly-client-sdk/` | hold Zod manifest schema, capability enum, tool envelope, projection input/output types |
| `packages/firefly-client-host/` | host runtime supervisor, catalog, broker, lifecycle, storage, hot reload |
| `packages/firefly-client-bridge/` | OpenCode bridge adapter that wraps the current `palot-bridge` pattern into the new host-owned bridge package |
| `packages/firefly-client-renderer/` | projection-stream consumer, Jotai atoms, derivation shims, operator UI |
| `apps/desktop/plugins/built-in/` | built-in plugins and the first vertical slice (`palot.review-panel`) |
| `apps/desktop/plugins/local-dev/` | local-dev plugin packages and a template |
| `packages/firefly-client-sdk/src/manifest.ts` and siblings | enumerated in Task 26 evidence as new files |
| `packages/firefly-client-host/src/*` | enumerated in Task 26 evidence as new files |
| `packages/firefly-client-bridge/src/*` | enumerated in Task 26 evidence as new files |
| `packages/firefly-client-renderer/src/*` | enumerated in Task 26 evidence as new files |

These are not weak references because they are explicitly proposed as new modules with a clear owning package and role.

## Verdict <!-- oc:id=sec_ae -->

References [17/17 valid] | Weak refs [0] | VERDICT: APPROVE