# Placement surfaces <!-- oc:id=sec_aa -->

## Current reusable surfaces <!-- oc:id=sec_ab -->
- session widgets already support `above-chat` and `chat-inline-right`
- side panel already supports tab registration via `firefly-surface-registry.tsx`
- review panel already has pinned-header precedent for sticky focused content

## Chosen rollout <!-- oc:id=sec_ac -->
- v1 primary surface: `chat-inline-right` widget
  - keeps artifacts near chat timeline
  - does not disturb turn ordering
  - already session-scoped by design
- v2 secondary surface: dedicated side-panel `artifacts` tab
  - better for browsing all artifacts in a session
  - works as history/index surface, not primary live placement
- `above-chat` remains valid for future user-controlled pin placement, but not default

## Reuse strategy <!-- oc:id=sec_ad -->
- widget shell for persistent live pins during session work
- side-panel tab for larger inventory and follow-up editing/pinning controls
- avoid a new layout system