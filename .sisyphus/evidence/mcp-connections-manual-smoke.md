# MCP Connections Manual Smoke <!-- oc:id=sec_aa -->

1. Start browser-mode app surface with `bun run dev` and confirm services healthy with `bun run svc:status`. <!-- oc:id=item_aa -->
1. Open Settings -> Connections. <!-- oc:id=item_ab -->
1. Pick a curated remote MCP, choose `Restore in cloud`, finish wizard, and confirm connected row shows cloud ownership plus gateway canonical store. <!-- oc:id=item_ac -->
1. Run `Test connection` and confirm safe probe success/failure toast updates without app restart. <!-- oc:id=item_ad -->
1. Open side-panel Plugins for the same project and confirm MCP row shows posture, hydration, ownership mode, and canonical store. <!-- oc:id=item_ae -->
1. Pick a local stdio MCP, register it, and confirm it stays `local-only` + `local`. <!-- oc:id=item_af -->
1. Re-open Settings -> Connections and verify live rows persist ownership/canonical/restore posture. <!-- oc:id=item_ag -->
1. Negative check: if auth expires, row should move to degraded/needs-auth, not connected. <!-- oc:id=item_ah -->