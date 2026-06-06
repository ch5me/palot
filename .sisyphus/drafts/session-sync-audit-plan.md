# Draft: session sync audit plan <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- User wants a full plan for everything needed to keep PALOT and OpenCode session state totally in sync.
- Scope includes all gaps/smells around client/server session communication, active session surfacing, timestamps, status derivation, and stale/missed sessions.
- User expects a comprehensive work plan, not partial notes.

## Technical Decisions <!-- oc:id=sec_ac -->
- Planning scope covers process discovery, server APIs, SSE sync, renderer state, UI derivation, and observability.
- Use already gathered repo findings plus background-agent research to define fixes.

## Research Findings <!-- oc:id=sec_ad -->
- Active session surfacing splits between preloaded session lists and attached-process presence.
- Session recency/sorting relies on `session.time.updated`, which can lag message/part activity.
- SSE reconnect path can drop buffered events and lacks broad reconciliation.
- Streaming flush keys off `session.status idle`, not `session.idle`.

## Open Questions <!-- oc:id=sec_ae -->
- None currently blocking plan generation.

## Scope Boundaries <!-- oc:id=sec_af -->
- INCLUDE: sync architecture, reconciliation, state model, observability, QA, migration, rollout.
- EXCLUDE: unrelated browser-lane/PDF features except where they expose the sync bug.