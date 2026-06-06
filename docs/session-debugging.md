# Session Debugging <!-- oc:id=sec_aa -->

Use this when Palette/OpenCode sessions look stuck, still moving, or disagree between UI and persisted state.

## Quick commands <!-- oc:id=sec_ab -->

```bash
bun run debug:sessions -- <session-id> [session-id...]
bun run svc:status
```

`bun run debug:sessions` reads the local OpenCode SQLite database at `~/.local/share/opencode/opencode.db` and prints:

- root session metadata
- latest assistant/user messages
- zero-token assistant stubs
- recent step/tool parts
- child session tree

## What to look for <!-- oc:id=sec_ac -->

- `ZERO_TOKEN_STUB` on latest assistant message: assistant turn created, but no completion yet. Could be normal if still actively streaming, suspicious if old and no new parts arrive.
- latest message has `completed` timestamp and `finish=stop`: turn completed cleanly.
- latest part shows `step-start` with no matching later `step-finish`: likely in-flight turn.
- child sessions under a root: task/sub-agent fan-out. Check each child independently.
- UI status mismatch can come from live SSE-derived state vs DB history. Session status in UI is hydrated from `/global/event` and `session.status()` calls, not from SQLite history alone.

## Relevant code <!-- oc:id=sec_ad -->

- DB schema notes: `packages/configconv/src/writer/history.ts`
- SSE subscription: `apps/desktop/src/renderer/services/opencode.ts`
- session event reducer: `apps/desktop/src/renderer/atoms/actions/event-processor.ts`
- UI session store: `apps/desktop/src/renderer/atoms/sessions.ts`
- derived running/waiting state: `apps/desktop/src/renderer/atoms/derived/agents.ts`
- child request bubbling: `apps/desktop/src/renderer/atoms/derived/session-requests.ts`
- active attached-session presence from running `opencode attach` clients: `apps/desktop/src/main/opencode-manager.ts`

## Typical interpretation <!-- oc:id=sec_ae -->

1. DB says session exists and latest assistant message is completed: persisted turn finished. <!-- oc:id=item_aa -->
1. DB latest assistant message is zero-token stub: likely mid-turn or wedged before parts streamed. <!-- oc:id=item_ab -->
1. Child sessions still updating while root has no new completed assistant turn: root may be waiting on sub-agents. <!-- oc:id=item_ac -->
1. Session appears in DB but not hierarchy tools: investigate session tree/index tooling mismatch separately. <!-- oc:id=item_ad -->