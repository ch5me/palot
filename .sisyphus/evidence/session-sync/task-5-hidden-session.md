# Task 5 Evidence — Hidden Session Explanation <!-- oc:id=sec_aa -->

Updated helper: `scripts/debug-sessions.ts`
Updated runbook: `docs/session-debugging.md`

Expected operator flow:
1. Run `bun run debug:sessions -- <session-id>`. <!-- oc:id=item_aa -->
1. Inspect `activePresence=` and `sync status=` lines. <!-- oc:id=item_ab -->
1. If active presence exists but UI hides the session, classify as `invisible-running` or `attached-but-unhydrated`. <!-- oc:id=item_ac -->
1. Follow runbook pointers into discovery bootstrap or connection-manager hydration. <!-- oc:id=item_ad -->

Result:
- Helper now explains local-running proof without SQL-only reasoning.
- Runbook names hidden-session audit path explicitly.