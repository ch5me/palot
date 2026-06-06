# Task 3 Evidence — Timestamp Precedence <!-- oc:id=sec_aa -->

Artifact: `docs/session-sync-reconciliation.md`

Canonical precedence recorded:
1. `message.time.completed` <!-- oc:id=item_aa -->
1. finalized `message.part.updated` <!-- oc:id=item_ab -->
1. in-flight `message.part.delta` observation timestamp <!-- oc:id=item_ac -->
1. `session.time.updated` <!-- oc:id=item_ad -->
1. `session.time.created` <!-- oc:id=item_ae -->
1. `lastPresenceAt` only when nothing else exists <!-- oc:id=item_af -->

Stale session-row case covered:
- document explicitly says `session.time.updated` alone cannot dominate recency when message/part activity is fresher

Result:
- Canonical `lastActivityAt` model defined and testable.