# Active Session Presence Handoff

Date: 2026-06-08
Repo: `/Users/hassoncs/src/ch5/palot`

## Goal

Palette must show every active OpenCode client/session as it appears, without per-tab 1s polling. Current browser dev target is `http://localhost:20883/`, Palette backend is `http://127.0.0.1:30206`, OpenCode is `http://127.0.0.1:4096`.

## Current State

- Browser mode now uses SSE from `/api/servers/opencode/active-sessions/events`.
- Backend route now subscribes to a singleton presence service per OpenCode server URL instead of starting one poll loop per EventSource client.
- Adaptive scan cadence is:
  - 1s after startup or detected change
  - 2s after one stable scan
  - 5s after continued stability
  - errors back off exponentially from 1s to 30s
- SSE reconnect retry is 5s.
- Renderer fallback HTTP poll is 30s.
- Plain `opencode /path` inference now has:
  - 2.5s timeout around `session.list`
  - 45s positive cache for complete inferred mappings
  - no cache for misses
- Electron main path has equivalent adaptive timer/cache logic, but browser and Electron still duplicate collector code.
- Future native OpenCode presence seam exists as `trySubscribeNativeOpenCodePresence(...)`, but it is only a stub until OpenCode exposes client lifecycle presence.

## Files Changed

- `apps/server/src/services/active-session-presence-service.ts`
  - singleton fanout service
  - adaptive cadence helpers
  - optional native presence seam
- `apps/server/src/routes/servers.ts`
  - HTTP active-sessions endpoint now reads cached singleton snapshot when fresh
  - SSE endpoint now subscribes to singleton and only owns heartbeat/lifecycle
- `apps/server/src/services/opencode-active-sessions.ts`
  - testable collector factory
  - `session.list` timeout
  - inferred mapping cache
  - exported snapshot key helper
- `apps/desktop/src/main/opencode-manager.ts`
  - Electron duplicate path updated to adaptive timer/cache/timeout
- `apps/desktop/src/renderer/hooks/use-discovery.ts`
  - fallback poll moved from 10s to 30s
- `docs/session-sync-reconciliation.md`
  - performance model documented
- `docs/session-debugging.md`
  - active presence references updated
- New tests:
  - `apps/server/src/services/active-session-presence-service.test.ts`
  - `apps/server/src/services/opencode-active-sessions.test.ts`

## Verification Already Run

```bash
cd apps/server && bun run check-types
cd apps/desktop && bun run check-types
bun test apps/server/src/services/active-session-presence-service.test.ts apps/server/src/services/opencode-active-sessions.test.ts
bun test apps/desktop/src/renderer/atoms/session-sync-regressions.test.ts
bun run svc:status
curl -sS http://127.0.0.1:30206/api/servers/opencode/active-sessions
curl -N -sS --max-time 3 http://127.0.0.1:30206/api/servers/opencode/active-sessions/events
```

Proof:
- Backend snapshot returned `clientCount=11`, `sessionCount=11`.
- Headless Chrome CDP proof showed UI `Active Now (11)` with both `attached` and `inferred live`.
- `server` and `web` were running under devmux.

Known lint caveat:

```bash
bun run lint
```

failed only on pre-existing formatter issues outside this work:
- `apps/server/src/routes/ch5pm.ts`
- `apps/server/src/services/mcp-connections.ts`

## Missing Pieces

### 1. OpenCode Native Presence Is Still Missing

This is the real long-term scale fix. Palette still uses local `ps` scans because OpenCode does not expose live client presence.

Needed on OpenCode server side:
- Track client lifecycle in server memory.
- Assign stable client IDs.
- Emit global lifecycle events:
  - `client.connected`
  - `client.disconnected`
  - `client.heartbeat`
  - `client.session.selected`
  - `client.session.created`
- Include:
  - `clientId`
  - `sessionId`
  - `directory`
  - `pid` when local client can report it
  - command/client kind when available
  - `connectedAt`
  - `lastSeenAt`
  - `source`
- Add a global endpoint or event stream, preferably integrated with `/global/event`, so one long-lived stream covers all projects.
- Maintain TTL cleanup for dead clients if disconnect event is missed.
- Support plain `opencode /path` clients after session selection changes, not only `opencode attach`.

Needed in Palette after OpenCode ships native presence:
- Replace `trySubscribeNativeOpenCodePresence(...)` stub with real feature-detecting subscription.
- Prefer native presence. Fall back to adaptive scan only if native endpoint is absent.
- Decide type shape:
  - either keep `source: "attach" | "inferred"` and map native confidence into existing values
  - or add `source: "native"`, then update renderer copy/badges/tests.

### 2. Shared Collector Code Should Be Extracted

Browser backend and Electron main now have equivalent logic, but duplicated.

Implement one shared module/package:
- Best location: new internal package such as `packages/opencode-presence`.
- Shared exports:
  - process parser
  - active session collector
  - inference cache
  - snapshot key builder
  - adaptive cadence helpers
- Consumers:
  - `apps/server`
  - `apps/desktop/src/main`
- Add tests at shared package level, then thin integration tests in each consumer.

### 3. Startup Convergence Should Be Faster And Proved

Renderer subscribes to active presence only after `serverConnected && discoveryReady`. In headless proof, UI briefly showed `Active Now (1)` before converging to `11`.

Improve:
- Start active-presence subscription immediately after OpenCode connection succeeds, before full project discovery finishes.
- Let active presence hydrate placeholder sessions while project discovery continues.
- Keep final session enrichment/backfill as today.
- Add a regression test for startup: active presence snapshot arrives before project preload and still materializes all active rows.

### 4. Spawn-Time Proof Is Still Poll-Based

Current fallback detects new clients on next adaptive tick, usually <= 5s when stable. That is acceptable interim behavior, but not true push.

Until native OpenCode events exist:
- Add an integration test that launches a temporary local OpenCode client or mocked process/session list and proves new presence appears within bounded time.
- Add service metrics/logging for:
  - subscriber count
  - active source: native vs scan
  - current poll delay
  - scan duration
  - `session.list` calls per tick
  - cache hits/misses

### 5. Route-Level SSE Test Missing

Service tests prove fanout, but route test should prove two SSE clients do not create two collector loops.

Add a Hono route test with injected service or injectable collector:
- open two active-session event streams
- assert one collector call for both subscribers
- assert heartbeat does not call collector
- assert unsubscribe stops source when last client disconnects

### 6. Type Surface And Build Artifacts

No new server route was added, so generated server client types were not required for this patch. If follow-up changes route shape or adds metrics/native endpoints:

```bash
cd apps/server && bun run build:types
cd apps/desktop && bun run check-types
```

### 7. Commit Hygiene

Repo has large unrelated dirty state from parallel agents. Do not revert it. Stage only scoped files when committing this work:

```bash
git add \
  apps/server/src/services/active-session-presence-service.ts \
  apps/server/src/services/active-session-presence-service.test.ts \
  apps/server/src/services/opencode-active-sessions.ts \
  apps/server/src/services/opencode-active-sessions.test.ts \
  apps/server/src/routes/servers.ts \
  apps/desktop/src/main/opencode-manager.ts \
  apps/desktop/src/renderer/hooks/use-discovery.ts \
  docs/session-sync-reconciliation.md \
  docs/session-debugging.md \
  handoff-20260608-active-session-presence.md
```

Recommended commit message:

```text
fix: scale OpenCode active session presence
```

## Continuation Prompt

```text
Continue from /Users/hassoncs/src/ch5/palot/handoff-20260608-active-session-presence.md.

Do not spawn subagents. Do not revert unrelated dirty files. Use devmux only.

Goal: finish long-term OpenCode active-session presence.

First inspect current git diff and live devmux status. Then:
1. Extract shared active-presence collector/adaptive/cache logic so browser backend and Electron main stop duplicating it.
2. Move renderer active-presence subscription earlier so active rows hydrate before full project discovery completes.
3. Add route-level SSE fanout tests proving multiple EventSource clients share one collector.
4. Add metrics/debug visibility for subscriber count, active source, poll delay, scan duration, session.list calls, and cache hit/miss.
5. If OpenCode native client-presence endpoint exists in this checkout/environment, implement trySubscribeNativeOpenCodePresence and prefer it. If not, leave the seam documented and keep adaptive scan fallback.
6. Run targeted tests, type checks, devmux status, backend HTTP/SSE proof, and browser proof at http://localhost:20883/.
7. Stage only scoped files and commit if verification is green.
```
