# Session Debugging <!-- oc:id=sec_aa -->

Use this when Palette/OpenCode sessions look stuck, still moving, or disagree between UI and persisted state.

## Quick commands <!-- oc:id=sec_ab -->

```bash
bun run debug:sessions -- <session-id> [session-id...]
OPENCODE_SERVER_URL=http://127.0.0.1:4096 bun run debug:sessions -- <session-id>
PALETTE_SERVER_URL=http://127.0.0.1:30206 bun run debug:sessions -- <session-id>
bun run svc:status
```

`bun run debug:sessions` reads the local OpenCode SQLite database at `~/.local/share/opencode/opencode.db` and also probes the live OpenCode server for active-session presence and `session.status()` truth when possible. It prints:

- root session metadata
- live status snapshot for the session directory
- active-session presence source (`attach` or `inferred`)
- canonical activity vs stale `session.time.updated` drift
- latest assistant/user messages
- zero-token assistant stubs
- recent step/tool parts
- child session tree

## What to look for <!-- oc:id=sec_ac -->

- `ZERO_TOKEN_STUB` on latest assistant message: assistant turn created, but no completion yet. Could be normal if still actively streaming, suspicious if old and no new parts arrive.
- latest message has `completed` timestamp and `finish=stop`: turn completed cleanly.
- latest part shows `step-start` with no matching later `step-finish`: likely in-flight turn.
- child sessions under a root: task/sub-agent fan-out. Check each child independently.
- `sync status=` line: authoritative runtime status from `session.status()` for that directory when available.
- `activePresence=` line: local-running proof from presence snapshot. `attach` = direct attach client found. `inferred` = runtime correlated from non-attach process + recent root sessions.
- `drift stale-recency`: DB/session row timestamp lags fresher message or part activity. UI recency should follow canonical activity, not `session.time.updated` alone.
- `drift attached-but-unhydrated`: live presence points at a different directory or session-hydration gap than the persisted row. Investigate discovery/bootstrap mismatch.
- UI status mismatch can come from live SSE-derived state vs DB history. Session status in UI is hydrated from `/global/event` and `session.status()` calls, not from SQLite history alone.

## Relevant code <!-- oc:id=sec_ad -->

- DB schema notes: `packages/configconv/src/writer/history.ts`
- SSE subscription: `apps/desktop/src/renderer/services/opencode.ts`
- session event reducer: `apps/desktop/src/renderer/atoms/actions/event-processor.ts`
- UI session store: `apps/desktop/src/renderer/atoms/sessions.ts`
- derived running/waiting state: `apps/desktop/src/renderer/atoms/derived/agents.ts`
- child request bubbling: `apps/desktop/src/renderer/atoms/derived/session-requests.ts`
- active local-session presence from `opencode attach` and inferred plain clients: `apps/desktop/src/main/opencode-manager.ts`, `apps/server/src/services/active-session-presence-service.ts`

## Audit flows <!-- oc:id=sec_ae -->

### Hidden active session

1. Run `bun run debug:sessions -- <session-id>`.
1. If `activePresence` is present but session is missing from UI, treat as `invisible-running` or `attached-but-unhydrated`.
1. Compare persisted `directory` with presence `directory` and inspect discovery bootstrap in `apps/desktop/src/renderer/hooks/use-discovery.ts` and presence hydration in `apps/desktop/src/renderer/services/connection-manager.ts`.

### Stale recency

1. Run `bun run debug:sessions -- <session-id>`.
1. If `drift stale-recency` appears, compare canonical activity against UI ordering in sidebar/tray/command palette.
1. Inspect `apps/desktop/src/renderer/atoms/derived/agents.ts` and `apps/desktop/src/main/tray.ts` for raw `session.time.updated` reliance.

### Reconnect drift

1. Confirm server health with `bun run svc:status`.
1. Compare live `sync status=` output against persisted message/part history.
1. If state differs after reconnect or server switch, inspect `apps/desktop/src/renderer/services/connection-manager.ts` reconnect path and reconciliation coverage.

### Child divergence

1. Run `bun run debug:sessions -- <root-session-id>`.
1. Walk child sessions printed under the root and compare child activity to parent task-card state.
1. If child remains active while parent appears timed out/failed, inspect `apps/desktop/src/renderer/components/chat/sub-agent-card.tsx` and `apps/desktop/src/renderer/atoms/derived/session-requests.ts`.

## Typical interpretation <!-- oc:id=sec_af -->

1. DB says session exists and latest assistant message is completed: persisted turn finished. <!-- oc:id=item_aa -->
1. DB latest assistant message is zero-token stub: likely mid-turn or wedged before parts streamed. <!-- oc:id=item_ab -->
1. Child sessions still updating while root has no new completed assistant turn: root may be waiting on sub-agents. <!-- oc:id=item_ac -->
1. Session appears in DB but not hierarchy tools: investigate session tree/index tooling mismatch separately. <!-- oc:id=item_ad -->
1. `activePresence` exists but UI still hides session: hydration or visibility-rule bug, not absence of local runtime. <!-- oc:id=item_ae -->
1. `drift stale-recency` appears: canonical activity is newer than session row, so ordering bug likely exists in derived UI state. <!-- oc:id=item_af -->
