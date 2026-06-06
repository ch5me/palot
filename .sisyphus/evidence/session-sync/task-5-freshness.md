# Task 5 Evidence — Freshness Comparison <!-- oc:id=sec_aa -->

Updated helper: `scripts/debug-sessions.ts`

Expected operator flow:
1. Run `bun run debug:sessions -- <session-id>`. <!-- oc:id=item_aa -->
1. Compare `updated=` with `canonicalActivity=`. <!-- oc:id=item_ab -->
1. If helper prints `drift stale-recency`, the session row lags newer message/part activity. <!-- oc:id=item_ac -->
1. Follow runbook pointers into sidebar/tray/command-palette ordering code. <!-- oc:id=item_ad -->

Result:
- Timestamp drift is now explicit and actionable.
- Operator can compare persisted row time with canonical activity from transcript history plus live status context.