# Draft: Browser side panel mode split — direct iframe vs streamed CDP lane

## Goal
The browser side panel must run in two explicit modes:

1. **`direct-iframe` (local)** — plain iframe pointed at an arbitrary HTTP origin (typically a localhost dev server). No container, no Selkies, no CDP, no health gating beyond reachability.
2. **`selkies-stream` (streaming CDP)** — current behavior: containerized Chromium (`lscr.io/linuxserver/chromium`), Selkies stream proxied same-origin into the panel iframe, CDP exposed separately for automation/navigation.

## Code inventory (as of 2026-06-09)

### Renderer (panel UI)
- `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx` — the side panel. URL bar, lane dropdown, create-remote-lane form, health-gated iframe (`panelState.showFrame` requires `health.stream.state === "ready"`), auto-start for `local`+`docker-chromium` lanes, clipboard postMessage bridge.
- `apps/desktop/src/renderer/atoms/browser.ts` — persisted URL/lane atoms, `buildNavigableUrl`, `buildBrowserLaneDisplayUrl` (Electron → `http://elf-browser-lane.local/browser/<id>/`, web → `<backend>/browser/<id>/`).
- `apps/desktop/src/renderer/services/backend.ts` + `services/elf-server.ts` — IPC (Electron) vs HTTP (web) split for all lane ops.
- `browser-cursor-overlay.tsx`, `browser-geometry-reconciliation.test.tsx` — stream-mode cursor overlay.

### Desktop main (local container runtime)
- `apps/desktop/src/main/browser-lane-manager.ts` — lane lifecycle/registry authority.
- `apps/desktop/src/main/browser-lane-runtime.ts` — docker-compose generator: Selkies env, stream port→3000, CDP port→9222, chromium flags, socat CDP relay, profile volume.
- `apps/desktop/src/main/browser-lane-process.ts` — docker compose exec.
- `apps/desktop/src/main/browser-lane-cdp.ts` — CDP client (desktop side).
- `apps/desktop/src/main/browser-lane-protocol.ts` — Electron protocol handler: serves `http://elf-browser-lane.local/browser/<id>/` by proxying to the lane's `streamBackendUrl`, injects `Basic abc:abc`; also injects that auth header onto loopback requests matching registered local-lane origins.
- `apps/desktop/src/main/browser-lane-capabilities.ts` — docker/compose detection.

### Server (web mode + shared registry)
- `apps/server/src/routes/browser-lanes.ts` — Hono routes: lane registry (`~/.config/elf/browser-lanes/lanes.json`), `create-remote`, per-lane proxy `/browser/:laneId/*` (injects Selkies UI-hiding page shim into ALL text/html responses), `/health` probe (stream HEAD + CDP `/json/version`), CDP tab CRUD/navigate.
- `apps/server/src/services/browser-lane-cdp.ts` — CDP tab operations.
- Server listens on `PORT || 30206`; Electron protocol handler reads the registry via `http://127.0.0.1:30206/browser`.

### Shared contract + scripts
- `apps/desktop/src/shared/browser-lanes.ts` — `BrowserLaneMode = local|remote`, `BrowserLaneRuntime = docker-chromium|remote-attached`, health model (stream + cdp endpoints), storage paths.
- `scripts/browser-lane/*` — install-runtime, start/stop-lane, healthcheck, cdp-smoke, proof captures.
- Plans/drafts: `.sisyphus/plans/palot-browser-lane-virtual-stream.md` (original build), `.sisyphus/drafts/browser-localhost-tunneling.md` (localhost-inside-stream tunneling, adjacent but separate).

## Verified today (proof)
- Palot server live on :30206. Arbitrary local host (`python3 -m http.server` on `127.0.0.1:8077`; PHP not installed — seam is host-agnostic) registered as remote lane `iframe-host-test` via `POST /browser create-remote`.
- `GET http://127.0.0.1:30206/browser/iframe-host-test/` returns the page — the exact iframe src the panel uses in web mode (`http://elf-browser-lane.local/browser/iframe-host-test/` in Electron). Health: `stream ready` → panel `showFrame` gate passes, so the page renders in the panel today.
- Two defects this surfaced, both fixed by the split:
  1. **Shim over-injection**: the Selkies UI-hiding shim was injected into the arbitrary page. Its heuristics (`.nav`, `.sidebar`, toolbar selectors) would mangle real dev apps. Shim must be conditional on the lane actually being a Selkies surface.
  2. **Wrong health semantics**: lane reported `degraded / CDP endpoint unreachable`. A direct iframe source has no CDP by design; "degraded" is a false alarm.

## The split

### 1. Contract (shared/browser-lanes.ts)
Add a surface-kind discriminator instead of overloading mode/runtime:

```ts
type BrowserSurfaceKind = "selkies-stream" | "direct-iframe"
```

- `selkies-stream`: stream + cdp endpoints both meaningful; health = both planes; shim allowed.
- `direct-iframe`: only a target URL; health = reachability only; `cdp` plane reported as `not-applicable` (new readiness value), never `failed/degraded`.
- Existing lanes infer `selkies-stream` (runtime `docker-chromium`) for back-compat; `remote-attached` lanes with no CDP and operator intent "just show this origin" become `direct-iframe`.

### 2. Server route changes (routes/browser-lanes.ts)
- Persist `surfaceKind` in `lanes.json` records; `create-remote` accepts it (default `selkies-stream` to preserve behavior, UI passes explicit kind).
- `injectBrowserLanePageShim` only when `surfaceKind === "selkies-stream"`.
- `/health`: skip CDP probe for `direct-iframe`; status = `running` when stream probe ok.
- Navigation endpoints reject CDP actions for `direct-iframe` with a typed error (fail fast, no silent fallback).
- Decide proxy-vs-direct per request: keep the proxy path even for direct-iframe (it solves Electron same-origin/auth uniformly and gives one URL shape), but with zero body rewriting.

### 3. Renderer split (browser-panel.tsx)
Decompose into:
- `BrowserPanelShell` — URL bar, lane selector, error surface, menus (shared chrome).
- `StreamLaneView` — current logic: health polling, auto-start docker lanes, Selkies iframe, cursor overlay, clipboard bridge.
- `DirectIframeView` — `<iframe src={url}>` straight at the target (Electron can hit localhost directly; web mode uses the proxy path). Navigation = set iframe src + history atoms; no CDP call, no health gating; `onError`/timeout → inline failure state. "Open external" always enabled.
- Mode selection driven by `activeLane.surfaceKind`; "New lane" form grows a kind toggle (Direct URL vs Streamed browser).

### 4. Desktop main
- `browser-lane-protocol.ts`: keep handling both kinds (it's already kind-agnostic proxying); ensure the loopback auth-header injection only applies to Selkies lanes (`abc:abc` must not be sprayed at arbitrary localhost dev servers — it already filters to registered local-lane origins, keep direct-iframe origins OUT of that set).
- `browser-lane-manager.ts`: lifecycle ops (start/stop/restart/reset-profile) are no-ops with typed errors for `direct-iframe`.

### 5. Out of scope (tracked separately)
- localhost tunneling INTO the streamed container (`.sisyphus/drafts/browser-localhost-tunneling.md`) — only matters for `selkies-stream` mode.
- Lane fleet orchestration / multiple simultaneous panels.

## Suggested task order
1. Contract: add `surfaceKind` + `not-applicable` CDP readiness; registry read/write back-compat (tests in `browser-lanes.test.ts`).
2. Server: conditional shim + kind-aware health + typed CDP rejections (tests in `routes/browser-lanes.test.ts`).
3. Renderer: extract `DirectIframeView` + shell split; kind toggle in create form; binding tests.
4. Desktop main: manager/protocol guards.
5. Proof: (a) direct-iframe lane against a local dev server renders unmangled in the panel; (b) existing default Selkies lane still streams + CDP navigates.

## Live demo state (from today's test)
- Lane `iframe-host-test` registered in `~/.config/elf/browser-lanes/lanes.json` (backup: `/tmp/elf-iframe-host/lanes.json.bak`); python host on `127.0.0.1:8077` serving `/tmp/elf-iframe-host/`. Select "Iframe host test" in the panel's lane dropdown to see it render.
