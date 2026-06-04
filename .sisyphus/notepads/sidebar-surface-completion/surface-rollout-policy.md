# Surface Rollout Policy Notes <!-- oc:id=sec_aa -->

## Current findings <!-- oc:id=sec_ab -->
- Task 7 completed.
- Current feature defaults:
  - on: review, notes, files, terminal, editor, plugins, bridges, crm, studio, voice, oracle, claude
  - off: browser, pulse, memory, ch5pm
- Current registry availability model still makes CRM, Pulse, and CH5PM discoverable through normal feature toggles if their flags are enabled.
- Current command palette "Features" section exposes toggle affordances for Browser, Pulse, Memory, CRM, Claude, and CH5PM as peer features.
- Locked rollout policy:
  - CRM hidden/off
  - Pulse deferred/off and removed from generic peer-feature discoverability
  - CH5PM deferred/off and sidebar-hidden; optional breadcrumb only if intentionally retained
  - Claude keeps same tab id and gets live body replacement in place
  - Browser defaults on only after same-origin publisher proof
  - Memory defaults on only after open/edit/save/reopen proof

## Open questions <!-- oc:id=sec_ac -->
- Should deferred surfaces keep any operator-only discoverability in the palette, or should task 12 narrow CH5PM to the only optional breadcrumb and remove CRM/Pulse entirely?
- Do we want Browser and Memory default flips to happen automatically with a release once proof exists, or only after one manual release gate review?
