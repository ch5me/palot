# Session Sync Reconciliation <!-- oc:id=sec_aa -->

## Goal <!-- oc:id=sec_ab -->

Make PALOT session state converge on one trustworthy session graph built from OpenCode server truth, live global SSE, local runtime presence, and persisted transcript activity.

## Scope boundaries <!-- oc:id=sec_ac -->

In scope:
- startup hydration
- reconnect and server-switch reconciliation
- active/recent session surfacing
- canonical activity timestamps
- child-session liveness and waiting propagation
- Electron/browser-mode parity for active-session discovery
- operator diagnostics, debug tooling, and regression proof

Out of scope:
- unrelated sidebar redesign
- browser-lane product changes unrelated to session visibility
- PDF/genui/firefly feature work not required for session sync
- cosmetic-only fixes without state-model repair

## Canonical session sync invariants <!-- oc:id=sec_ad -->

1. Session existence invariant <!-- oc:id=item_aa -->
- Any in-scope session seen from authoritative server APIs, live global events, or trusted local presence must materialize in PALOT store.
- Unknown live events never disappear because session row was not pre-hydrated.
- Source precedence for existence: `session.created|updated` event or `session.get/list` API > local presence snapshot > debug-only DB evidence.

1. Visibility invariant <!-- oc:id=item_ab -->
- Root sessions in scope must either be visible on intended surfaces or carry explicit exclusion reason.
- Exclusion must be structured, not implicit. Examples: `noise-project`, `child-session`, `pm-tagged`, `outside-surface-scope`.
- Source precedence for visibility: canonical renderer session graph > per-surface filters > debug explanation.

1. Freshness invariant <!-- oc:id=item_ac -->
- `session.time.updated` alone never decides recency when fresher message/part activity exists.
- Every surfaced session has canonical `lastActivityAt`, provenance, and optional degraded reason.
- Source precedence for activity ordering: message completion > part update/delta timestamp > session update > session create > local presence heartbeat for liveness only.

1. Local presence invariant <!-- oc:id=item_ad -->
- Local activity cannot depend on `opencode attach` process detection only.
- Electron and browser/server modes must emit same active-session snapshot semantics: same session IDs, same `source`, same confidence class.
- Source precedence for presence: explicit attach session match > inferred runtime/session correlation > debug-only process/DB clues.

1. Status invariant <!-- oc:id=item_ae -->
- Session status derives from authoritative `session.status()` bootstrap plus live `session.status` events plus tree-scoped permission/question state.
- Parent waiting/running state must reflect descendant interactive blocks when they exist.
- Raw status and PALOT-derived UI status stay separate and inspectable.

1. Reconciliation invariant <!-- oc:id=item_af -->
- Startup, SSE connect, reconnect, HMR client recreation, and server switch each run deterministic reconciliation.
- Reconciliation refreshes authoritative global/project/session truth and cannot rely on lucky future events.
- Stale server state must be cleared before applying new-server truth.

1. Flush invariant <!-- oc:id=item_ag -->
- `session.idle` and `session.status { type: "idle" }` converge renderer state identically.
- Buffered part content is either flushed or deterministically recovered by reconciliation. Silent loss forbidden.
- Flush boundaries are per-session-safe; one session cannot finalize another session's buffered state incorrectly.

1. Child-session invariant <!-- oc:id=item_ah -->
- Parent task-card state and child-session liveness cannot drift silently.
- If parent task times out while child remains live, PALOT surfaces degraded/divergent state, not false final failure.
- Child permission/question waiting bubbles to parent with child attribution.

1. Sandbox/worktree invariant <!-- oc:id=item_ai -->
- Session grouping under parent project remains correct after startup, reconnect, HMR, and server switch.
- Sandbox mappings refresh during reconciliation, not only initial discovery.

1. Diagnostics invariant <!-- oc:id=item_aj -->
- Every hidden, stale, divergent, or orphaned session state must map to structured drift class with source evidence and recommended next checks.
- Diagnostics are machine-consumable and UI-consumable; free-form logs alone are insufficient.

## In-scope session definition <!-- oc:id=sec_ae -->

PALOT should surface these session classes:
- root sessions from focused projects loaded by discovery
- root sessions from active local presence, even if project not in focused preload
- root sessions directly navigated/opened by user
- root sessions implied by live events received on `/global/event`
- child sessions for direct navigation, parent-state derivation, and diagnostics

PALOT may exclude from normal top-level surfaces:
- child sessions from sidebar/recent lists unless explicitly debug-viewed
- noise/test/tmp projects filtered by discovery rules
- PM-tagged sessions from normal active/recent buckets when PM surface owns them

Excluded sessions still need store presence plus explicit reason when seen from authoritative signals.

## Failure-state vocabulary <!-- oc:id=sec_af -->

- `invisible-running`: trusted presence or live status says session active, but session excluded or absent from intended surface
- `attached-but-unhydrated`: presence snapshot knows session ID, renderer lacks hydrated session row
- `unknown-session-event`: event arrived before session row existed; placeholder/backfill path required
- `stale-recency`: canonical activity differs materially from `session.time.updated`-derived ordering
- `dropped-reconnect`: reconnect completed without reconciliation to current server truth
- `stale-worktree-mapping`: session/project grouping still reflects old sandbox mapping
- `missing-child`: parent expects child linkage but child session unavailable or stale
- `pending-tool-vs-dead-child`: parent tool/task looks pending while child session is no longer live
- `timed-out-parent-live-child`: parent timeout/failure conflicts with continuing child activity
- `detached`: session known historically but no current authoritative server or trusted presence support
- `orphaned`: child session exists without resolvable parent context
- `retrying`: authoritative status says retry with attempt metadata
- `waiting`: permission/question block exists in session tree

## State source map <!-- oc:id=sec_ag -->

| Source | Owner | Cadence | Authority | Current consumers | Blind spots / risks |
|---|---|---:|---|---|---|
| `client.project.list()` | renderer `loadAllProjects()` | startup/manual refresh | advisory for project catalog | `discoveryAtom`, project slug/sandbox mapping | focused preload drops active sessions outside top-N projects |
| `client.session.list({ roots })` | renderer `loadProjectSessions()` | startup partial, sidebar expand, pagination | authoritative for known project session catalog | `setSessionsAtom`, tray discovery cache | only loaded for preloaded/expanded projects |
| `client.session.get(id)` | renderer `hydrateAttachedSession()` / `fetchSessionById()` | targeted fallback | authoritative per session | active presence hydration, direct nav fallback | only used reactively after miss |
| `client.session.status()` | renderer `bootstrapAttachedSessionStatuses()` / project loads | startup partial | authoritative status snapshot | `setSessionStatusAtom`, derived agents | one-shot bootstrap today, no reconnect resync |
| `/global/event` | renderer `startEventLoop()` | live SSE | authoritative live event stream | `processEvent`, streaming buffer | reconnect gap, unknown-session events currently under-materialized |
| active presence snapshot (`opencode:active-sessions` / HTTP route) | main or server service | SSE fanout; singleton adaptive poll 1s -> 2s -> 5s; 30s renderer fallback | advisory-to-strong local liveness | attached IDs, session hydration | waits on native OpenCode client-presence events for zero-scan path |
| process scan (`ps`) | main/server active-session service | once per server URL adaptive tick | advisory raw signal | active-session snapshot builder | command heuristics, false positives/negatives |
| inferred runtime/session correlation | main/server active-session service | adaptive tick with 45s positive inference cache | advisory promoted to trusted presence | active presence hydration | cache only complete inferred mappings; misses re-query |
| SQLite helper (`scripts/debug-sessions.ts`) | operator script | on demand | debug-only | manual audits | persisted history can lag or outlive runtime truth |
| sandbox/worktree map from project payload | derived agents | startup + project updates | advisory for grouping | sidebar project/session grouping | stale after reconnect without full refresh |
| child linkage via `session.parentID` | session payload + derived tree | on session upsert | authoritative relationship field | `session-requests`, sub-agent card | child rows may be missing when event order unfavorable |

## Surface map <!-- oc:id=sec_ah -->

| Surface | Files | Current backing signals | Required canonical inputs |
|---|---|---|---|
| Sidebar Active/Recent/PM | `apps/desktop/src/renderer/components/sidebar.tsx`, `apps/desktop/src/renderer/atoms/derived/agents.ts` | `Agent.status`, `createdAt`, `lastActiveAt`, PM tags | `lastActivityAt`, visibility reason, presence state, exclusion reason |
| Command palette | `apps/desktop/src/renderer/components/command-palette.tsx` | `Agent.status`, `isAttached` | same canonical activity + visibility contract as sidebar |
| Tray | `apps/desktop/src/main/tray.ts` | `liveSessions`, discovery cache `session.time.updated` | canonical activity ordering, shared active-membership rules |
| Session view | `apps/desktop/src/renderer/components/session-view.tsx` | direct `agentFamily`, `fetchSessionById` fallback | placeholder/backfill, canonical diagnostics |
| Sub-agent cards | `apps/desktop/src/renderer/components/chat/sub-agent-card.tsx` | task part metadata + child session entry + tree waits | parent/child divergence state, child freshness |
| Debug script/runbook | `scripts/debug-sessions.ts`, `docs/session-debugging.md` | SQLite transcript only today | renderer/API/presence comparison plus drift classes |

## Active Presence Performance Model <!-- oc:id=sec_ak -->

- Browser mode uses one backend `EventSource` stream per renderer tab, but collection is singleton per OpenCode server URL. Extra tabs subscribe to cached fanout; they do not create extra `ps` or `session.list` loops.
- Backend cadence is adaptive: first/startup and changed snapshots schedule the next check at 1s, one stable check backs off to 2s, then stable checks run at 5s. Collection errors use exponential backoff from 1s to 30s.
- Renderer fallback polling is 30s and only exists to recover from broken SSE or missed reconnects.
- Plain `opencode /path` clients need `session.list` correlation. Complete inferred mappings are cached for 45s by process signature and claimed attach IDs. Missing mappings are not cached, so newly spawned clients can still resolve quickly.
- Best future model is native OpenCode client presence over a long-lived global stream: `client.connected`, `client.disconnected`, and `client.session.selected`. Palot already has a `trySubscribeNativeOpenCodePresence` seam so that path can replace local scans when OpenCode exposes it.

## Canonical timestamp model <!-- oc:id=sec_ai -->

Track these fields per session:
- `lastActivityAt`: best timestamp for ordering user-visible recency
- `lastActivitySource`: `message-completed | part-updated | part-delta | session-updated | session-created | presence-heartbeat`
- `lastContentActivityAt`: newest message/part-derived content activity only
- `lastPresenceAt`: newest trusted local presence heartbeat
- `statusObservedAt`: latest authoritative status observation

Precedence for `lastActivityAt`:
1. latest assistant/user `message.time.completed` when available <!-- oc:id=item_ak -->
1. latest `message.part.updated` timestamp for finalized part content <!-- oc:id=item_al -->
1. latest `message.part.delta` observation timestamp when stream in progress and no final part timestamp yet <!-- oc:id=item_am -->
1. `session.time.updated` <!-- oc:id=item_an -->
1. `session.time.created` <!-- oc:id=item_ao -->
1. `lastPresenceAt` only when nothing else exists, and mark as liveness-derived <!-- oc:id=item_ap -->

Rules:
- Presence heartbeat can prove session alive locally but should not outrank newer content activity if it would incorrectly reorder recent sessions.
- Running session UI can use `now` for live duration display, but ordering still anchored to canonical timestamp/provenance.
- Raw `session.time.updated` stays stored for debugging drift against canonical value.

## Reconciliation contract <!-- oc:id=sec_aj -->

Trigger reconciliation on:
- initial successful SSE open
- every SSE reconnect after disconnect/error
- server switch
- HMR/base-client/project-client recreation
- active presence snapshot revealing unknown session IDs

Reconciliation steps:
1. establish active server identity and clear stale-server scoped caches if server changed <!-- oc:id=item_aq -->
1. refresh active presence snapshot <!-- oc:id=item_ar -->
1. refresh focused project catalog and sandbox mappings <!-- oc:id=item_as -->
1. build bootstrap session target set from focused projects, active presence, attached sessions, open session route, and known waiting/degraded child sessions <!-- oc:id=item_at -->
1. hydrate missing target sessions via `session.get` and project-scoped `session.list` <!-- oc:id=item_au -->
1. refresh session statuses for targeted directories/sessions <!-- oc:id=item_av -->
1. flush or recover buffered streaming state <!-- oc:id=item_aw -->
1. emit diagnostics for any target still missing/excluded <!-- oc:id=item_ax -->

Unknown live event behavior:
- create placeholder store entry keyed by `sessionID` immediately with source `event-placeholder`
- queue targeted hydration/backfill
- replace placeholder when authoritative session payload arrives

## Child-session/task contract <!-- oc:id=sec_ak -->

- `session.parentID` is authoritative linkage.
- Parent waiting state derives from tree-scoped unanswered permission/question requests.
- Parent task status and child liveness compared using child canonical freshness + status + presence.
- Divergence conditions create degraded state instead of silent override.
- Parent must expose child attribution for waits and divergence in diagnostics/debug UI.

## Diagnostics schema <!-- oc:id=sec_al -->

```ts
interface SessionSyncDiagnostic {
  sessionId: string
  driftClass:
    | "invisible-running"
    | "attached-but-unhydrated"
    | "unknown-session-event"
    | "stale-recency"
    | "dropped-reconnect"
    | "stale-worktree-mapping"
    | "missing-child"
    | "pending-tool-vs-dead-child"
    | "timed-out-parent-live-child"
    | "detached"
    | "orphaned"
  severity: "info" | "warning" | "error"
  visibilityReason: string | null
  exclusionReason: string | null
  statusSource: "status-api" | "session-status-event" | "derived-tree-wait" | "unknown"
  presenceSource: "attach" | "inferred" | "none" | "mixed"
  presenceConfidence: "high" | "medium" | "low" | "none"
  observedAt: number
  canonicalActivityAt: number | null
  canonicalActivitySource: string | null
  rawSessionUpdatedAt: number | null
  expectedSurfaceMembership: string[]
  actualSurfaceMembership: string[]
  notes: string[]
  nextChecks: string[]
}
```

Diagnostics consumers:
- renderer debug surfaces
- `scripts/debug-sessions.ts` comparative output
- evidence fixtures under `.sisyphus/evidence/session-sync/`

## Rollout guardrails <!-- oc:id=sec_am -->

- ship diagnostics + helper improvements first
- gate canonical reconciliation/visibility changes behind internal feature flag if dual-read needed
- compare old vs new active/recent membership during rollout and log drift deltas
- if reconciliation fails, preserve last known good store plus emit explicit degraded diagnostics; never silently clear everything and pretend success
- rollback trigger: hidden active session, reconnect drift, or child divergence repro reappears in automated fixtures
