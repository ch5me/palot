# Task 26 — Repo Implementation Matrix and Package/Module Split <!-- oc:id=sec_aa -->

> Wave 5, Task 26 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## 1. New packages <!-- oc:id=sec_ab -->

A new SDK + runtime package set inside the existing monorepo (`apps/` + `packages/`):

| Package | Path | Purpose | Owns |
|---|---|---|---|
| `@ch5me/firefly-client-sdk` | `packages/firefly-client-sdk/` | SDK authored against by plugin authors and host consumers | Zod manifest schema, `PluginManifest` -> `PluginDescriptor` parser, capability enum, tool result envelope, projection input/output matrix types |
| `@ch5me/firefly-client-host` | `packages/firefly-client-host/` | Host-side runtime that supervises plugin workers | catalog, manifest validation, runtime supervision, capability broker, durable storage, OpenCode bridge adapter, lifecycle supervisor, quarantine, hot reload |
| `@ch5me/firefly-client-bridge` | `packages/firefly-client-bridge/` | OpenCode bridge adapter that maps OpenCode plugin events to firefly-client host events | server-mode matrix evaluation, request routing, context block generation, system-context generation |
| `@ch5me/firefly-client-renderer` | `packages/firefly-client-renderer/` | Renderer-side projection consumer | projection stream subscription, Jotai atoms, derivation shims over V1 registries, operator UI primitives, render factory registry |
| `@ch5me/firefly-client-plugins` | `apps/desktop/plugins/` | Built-in, local-dev, and exemplar plugin packages | first-party plugins (review, browser, etc.) and one local-dev plugin scaffold |

The existing `packages/ui` and `packages/configconv` continue as-is. The new packages are built and consumed inside the existing monorepo through Turborepo + Bun workspaces.

## 2. Existing files that move <!-- oc:id=sec_ac -->

- `apps/desktop/src/renderer/firefly-surface-registry.tsx` -> rewrites to a derivation shim that consumes `projectedPanelsAtom` (kept in `packages/firefly-client-renderer/`)
- `apps/desktop/src/renderer/session-widget-registry.tsx` -> rewrites to a derivation shim
- `apps/desktop/src/renderer/atoms/session-widgets.ts` -> widget placement state stays; reads from `projectedWidgetsAtom` and merges with the persisted placement
- `apps/desktop/src/renderer/components/command-palette.tsx` -> rewrites to a renderer over `projectedCommandsAtom` plus host-reserved built-ins
- `apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx` -> rewrites to the operator UI (Wave 4 Task 24)
- `apps/desktop/.opencode/plugins/palot-bridge.js` -> first cut moves to the built-in `palot-bridge` plugin in `apps/desktop/plugins/built-in/`
- `apps/desktop/src/main/palot-opencode-plugin-shim.ts` -> replaced by `@ch5me/firefly-client-host`'s `loadPalotPluginModule` API (or removed; see below)
- `apps/desktop/src/shared/palot-bridge-schemas.ts` -> remains as legacy compat shim; new schemas live in `packages/firefly-client-sdk/`

`palot-opencode-plugin-shim.ts` may or may not be deletable depending on whether anything outside the desktop app still imports it. The default plan is to keep it as a deprecation stub for one release and remove in v2.1.

## 3. New files per family <!-- oc:id=sec_ad -->

| File | Purpose |
|---|---|
| `packages/firefly-client-sdk/src/manifest.ts` | Zod manifest schema |
| `packages/firefly-client-sdk/src/descriptor.ts` | `PluginDescriptor` type |
| `packages/firefly-client-sdk/src/capabilities.ts` | Capability enum + validation |
| `packages/firefly-client-sdk/src/tool-envelope.ts` | Standard tool result envelope |
| `packages/firefly-client-sdk/src/projection.ts` | Projection input/output matrix types |
| `packages/firefly-client-host/src/catalog.ts` | Plugin catalog index |
| `packages/firefly-client-host/src/host-runtime.ts` | utilityProcess + per-plugin worker_thread supervisor |
| `packages/firefly-client-host/src/broker.ts` | Capability broker (deny-by-default) |
| `packages/firefly-client-host/src/lifecycle.ts` | 10-state lifecycle supervisor + quarantine |
| `packages/firefly-client-host/src/storage.ts` | XDG-rooted storage layer per scope |
| `packages/firefly-client-host/src/hot-reload.ts` | Edit -> rebuild -> restart -> reprojection pipeline |
| `packages/firefly-client-host/src/audit.ts` | Per-plugin NDJSON audit log |
| `packages/firefly-client-bridge/src/server-mode-matrix.ts` | 5-row server-mode matrix evaluator |
| `packages/firefly-client-bridge/src/context-block.ts` | System-context block generator |
| `packages/firefly-client-bridge/src/dispatcher.ts` | Tool-call dispatcher with 9-state machine |
| `packages/firefly-client-bridge/src/system-prompt-injection.ts` | Plugin context injection |
| `packages/firefly-client-renderer/src/projection-stream.ts` | Renderer subscription to host projection |
| `packages/firefly-client-renderer/src/atoms.ts` | Jotai projection atoms |
| `packages/firefly-client-renderer/src/derivation-shims/` | V1 -> V2 derivation shims per family |
| `packages/firefly-client-renderer/src/operator-ui.tsx` | Two-pane operator view |
| `packages/firefly-client-renderer/src/palot-bridge-as-builtin-migration.md` | Migration document |
| `apps/desktop/plugins/built-in/palot.review-panel/` | First vertical slice exemplar (Wave 4 Task 21) |
| `apps/desktop/plugins/built-in/_template/` | Template for future first-party plugins |
| `apps/desktop/plugins/local-dev/_template/` | Template for local-dev plugins |

## 4. Domain separation <!-- oc:id=sec_ae -->

Five domains. Each domain has a single owning package; cross-domain access is explicit and broker-mediated.

| Domain | Owning package | Talks to | Via |
|---|---|---|---|
| Manifest schema | `@ch5me/firefly-client-sdk` | nothing | pure types + Zod |
| Host runtime | `@ch5me/firefly-client-host` | OpenCode bridge, SDK | typed broker + SDK contract |
| OpenCode bridge | `@ch5me/firefly-client-bridge` | Host runtime, OpenCode | localhost HTTP + env-var transport per current pattern |
| Renderer | `@ch5me/firefly-client-renderer` | Host runtime | projection stream over `window.elf` |
| Plugins | `@ch5me/firefly-client-plugins` | SDK only | manifest + envelope contract |

Cross-domain rule: renderer does not import host runtime. Plugins do not import host runtime. Host runtime does not import plugins. OpenCode bridge is the only place that knows the OpenCode plugin interface.

## 5. Migration ownership <!-- oc:id=sec_af -->

| Migration | Owner | Tracked by |
|---|---|---|
| V1 surface registry -> projection shim | `@ch5me/firefly-client-renderer` | Wave 4 Task 19 evidence |
| V1 bridge -> generalized bridge | `@ch5me/firefly-client-bridge` | Wave 4 Task 20 evidence |
| First-party panels -> built-in plugins | `@ch5me/firefly-client-plugins` | Wave 4 Task 19 evidence |
| `plugins-panel.tsx` -> operator UI | `@ch5me/firefly-client-renderer` | Wave 4 Task 24 evidence |
| VS Code import | `@ch5me/firefly-client-bridge` (v2.1 deferred) | Wave 4 Task 23 evidence |