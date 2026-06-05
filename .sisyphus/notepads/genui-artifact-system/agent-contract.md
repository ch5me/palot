# Agent artifact contract <!-- oc:id=sec_aa -->

## v1 prompt contract <!-- oc:id=sec_ab -->
- append lightweight artifact context to outbound prompt text
- include up to 8 recent artifacts
- line shape:
  - `artifact_id | component:<name> pinned:<placement>? | title:<title>`
- instruction line should tell the agent to prefer stable `artifact_...` ids for follow-up references

## v1 operations <!-- oc:id=sec_ac -->
- list: prompt-context only
- pin: UI action first; agent can reference artifact ids in natural language but no dedicated tool yet
- unpin: UI action first
- update: patch existing artifact props in local store; do not require full regeneration for small tweaks
- remove: later

## rollout note <!-- oc:id=sec_ad -->
- v1 can stay renderer-only and prompt-context-driven
- later explicit tool path can move to main/server once artifact persistence and command surfaces exist