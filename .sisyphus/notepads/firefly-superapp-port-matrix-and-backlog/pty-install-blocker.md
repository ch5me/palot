# PTY Install Blocker <!-- oc:id=sec_aa -->

## Current blocker <!-- oc:id=sec_ab -->

Real PTY runtime is blocked on adding a new native dependency (`node-pty`).

## Why this is a blocker <!-- oc:id=sec_ac -->

- The repo does not currently include `node-pty`.
- PTY integration in Electron requires dependency install plus native rebuild considerations.
- Installing the dependency is a meaningful repo/dependency change, not a no-risk follow-up to the proof shell.

## Decision for continuation <!-- oc:id=sec_ad -->

Record PTY runtime as blocked on dependency adoption and move to the next major surface instead of stalling here.

## Next reopen step <!-- oc:id=sec_ae -->

When ready to do PTY for real:
1. add `node-pty` <!-- oc:id=item_aa -->
1. wire main-process terminal session manager <!-- oc:id=item_ab -->
1. expose preload terminal bridge <!-- oc:id=item_ac -->
1. swap the proof shell from `/bash` prompting to live stream-backed terminal session <!-- oc:id=item_ad -->