# Draft: Browser localhost tunneling <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- Browser side panel must make `localhost` feel local to the session powering the browser.
- Full auto tunneling required: typed navigation plus in-page fetch/XHR/WebSocket/subresources must work.
- Session scoping matters: future architecture may have different OpenCode sessions on different boxes; localhost must bind per session.
- User preference: this should "just work properly" for web dev workflows.

## Technical Decisions <!-- oc:id=sec_ac -->
- Preferred direction: per-session localhost tunnel mapping, not one global tunnel.
- Scope includes full browser semantics, not only address-bar navigation.

## Research Findings <!-- oc:id=sec_ad -->
- Browser panel is an iframe over a remote Chromium lane stream, not a native local browser. File: `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx`.
- Navigation currently goes through CDP only; no localhost rewrite/tunnel exists. Files: `apps/desktop/src/main/browser-lane-manager.ts`, `apps/server/src/services/browser-lane-cdp.ts`.
- Existing browser proxy only proxies the lane stream/viewer surface at `/browser/:laneId/*`. File: `apps/server/src/routes/browser-lanes.ts`.
- Session binding already maps OpenCode session -> browser lane and is the likely authority seam. Files: `apps/desktop/src/preload/api.d.ts`, `apps/desktop/src/main/palot-browser-dispatcher.ts`, `apps/desktop/src/main/palot-browser-ipc.ts`.
- Electron protocol glue already special-cases local lane stream transport and loopback auth, but not destination browsing to localhost. File: `apps/desktop/src/main/browser-lane-protocol.ts`.

## Scope Boundaries <!-- oc:id=sec_ae -->
- INCLUDE: per-session localhost authority, browser-side automatic access to host-local services, support for page subresources and websocket traffic.
- EXCLUDE: implementation-only single global host tunnel as final design.

## Open Questions <!-- oc:id=sec_af -->
- Which localhost authorities must be supported in v1: `localhost`, `127.0.0.1`, `[::1]`, arbitrary loopback aliases?
- Should non-loopback private LAN hosts also map through the same session-local authority, or localhost-only for now?
- What authority should be canonical inside the remote browser: synthetic hostname, synthetic domain+port, or proxy-origin path scheme?