# Continuation Notes <!-- oc:id=sec_aa -->

## 2026-06-06 <!-- oc:id=sec_ab -->

- T0 complete. Evidence: `.sisyphus/evidence/task-0-bridge-decision.md`.
- T1 complete. Evidence: `.sisyphus/evidence/task-1-binding-model.md`.
- Main-owned binding store landed in `apps/desktop/src/main/palot-session-binding.ts`.
- Main-only secret cache landed in `apps/desktop/src/main/palot-secret-cache.ts`.
- Shared binding types landed in `apps/desktop/src/preload/api.d.ts`.
- Next active task: T2 browser action event schema.
- Important constraint: browser-mode dev stays UI-only; plugin/tools no-op there.
- Important constraint: no localhost sidecar; resolver and dispatch stay main-owned.
- T2 complete. Evidence: `.sisyphus/evidence/task-2-action-schema.md`.
- T3 scaffold landed in `apps/desktop/.opencode/plugins/palot-bridge.js` and `apps/desktop/src/main/palot-opencode-plugin-shim.ts`.
- Verification blocker: repo desktop typecheck currently fails on unrelated pre-existing `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:473` (`asChild` prop mismatch). Lint still clean. Plugin shim test should be run separately until that repo-level type error is fixed.
- T4 landed lightweight IPC/preload contract in `apps/desktop/src/main/palot-browser-ipc.ts`, `apps/desktop/src/preload/index.ts`, and `apps/desktop/src/preload/api.d.ts`.
- `window.elf.palot` now exposes snapshot, publish action, binding get/set/release, and browser-action subscription.
- T4 is intentionally minimal: recent action buffer + push channel now, richer snapshot semantics later in T7/T10.
- T5 landed pure geometry math in `apps/desktop/src/shared/browser-geometry.ts` with fixtures/tests.
- Geometry fallback ladder is now explicit in code: page rect -> stream transform -> last good cursor.
- Perf targets are encoded as constants, not prose only.
- T6 lifecycle/store adapter landed in `apps/desktop/src/main/palot-session-binding-store.ts`.
- Restart recovery logic currently lives as explicit reconciliation against active session ids; live event-stream hookup still needs integration into a main-owned OpenCode feed.
- T7 expanded `BrowserStateSnapshot` to carry lane/session ids, viewer URL hint, health, viewport summary, and last 8 actions.
- Snapshot cache is currently lane-keyed and main-owned in `palot-browser-ipc.ts`; future runtime hooks only need to keep it fed.
- T8 plugin hook now injects compact browser context from resolver output and re-calls resolver on `session.idle` without caching lane/session state inside the plugin.
- T9 strict named browser tools landed in `apps/desktop/.opencode/plugins/palot-bridge.js`; they currently return queued/error JSON and are ready for T16 dispatcher wiring.
- T10 expanded `palot-browser-ipc.ts` into the typed event bus: monotonic per-session sequence, duplicate collision guard, capped buffer, and takeover rejection.
- T11 made the browser panel session-aware: it now prefers a per-session bound lane and falls back to the legacy global lane atom.
- T12 added the renderer-side browser action stream atoms and hook; dedupe uses `(id, laneId)` and the queue is capped in renderer memory.
- T13 now renders a session-scoped cursor overlay over the browser iframe with best-effort and human-control badges, but smooth animation/ripple/drift work still belongs to T14/T15.
- T14 expanded the overlay into concrete primitives: click ripple, type label, scroll label, hover ring, drift badge, and action log.
- T15 added panel geometry capture plus drift badge logic and session-mismatch overlay suppression.
- T16a landed the main-owned resolver seam in `apps/desktop/src/main/palot-resolver.ts`; plugin-side per-call resolution can now point at one place.
- T16b now dispatches real navigate/open/tab actions through `apps/desktop/src/main/palot-browser-dispatcher.ts` and emits request/result bus events.
- T17 landed deterministic Magic Browser binding bootstrap semantics: stable `magicBrowserSessionId` persisted, viewer URL + auth token remain main-only derived state.
- T18 now has explicit pause/resume takeover helpers and bus-level rejection while human control is active.
- T19a added a reusable overlay capture helper in `scripts/browser-overlay-capture.ts`; current proof is static HTML/assertion, not a real screenshot image yet.
- T19 full local managed verification is still blocked. I recorded the blocker set in `.sisyphus/evidence/final-qa/local-managed-verification.md`: plugin auto-load path not wired in managed runtime, no real agent-driven harness, and dispatcher still partial for click/type/scroll.
- T20 remote verification is also blocked. Evidence in `.sisyphus/evidence/final-qa/remote-managed-verification.md`: no remote lane fixture/runtime, no real Magic Browser runtime integration, no full remote harness.
