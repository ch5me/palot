# Task 2 Evidence — Freshness Map <!-- oc:id=sec_aa -->

Artifact: `docs/session-sync-reconciliation.md`

Freshness signals classified separately:
- `message.time.completed` — authoritative content completion
- `message.part.updated` — authoritative finalized part activity
- `message.part.delta` observation time — authoritative in-flight content activity fallback
- `session.time.updated` — advisory fallback
- `session.time.created` — fallback baseline
- `lastPresenceAt` / local presence heartbeat — liveness-only unless no content timestamps exist

Authority classification:
- API/session payload timestamps: authoritative/advisory depending on field
- presence heartbeat: advisory for liveness, not primary recency sort
- SQLite helper: debug-only

Result:
- Freshness ambiguity removed.
- Presence and content recency clearly separated.