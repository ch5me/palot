# Terminal Composer Affordances <!-- oc:id=sec_aa -->

## What landed <!-- oc:id=sec_ab -->

A minimal composer now fits in the proof shell without PTY:
- text input inside the Terminal surface
- submits `/bash <command>` through the active agent session
- keeps the attach command available as the fallback real terminal path

## What remains blocked without PTY <!-- oc:id=sec_ac -->

True terminal-composer parity still needs PTY runtime for:
- interactive stdin beyond single command submission
- arrow-key history / shell state
- long-running command lifecycle independent of chat turn timing
- resize-aware terminal behavior

## Decision <!-- oc:id=sec_ad -->

Count the proof-shell composer affordance as the useful thin slice.
Reopen richer composer behavior only after PTY support lands.