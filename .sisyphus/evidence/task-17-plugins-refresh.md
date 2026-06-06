# Task 17 Plugins Refresh <!-- oc:id=sec_aa -->

Current proof scope:

- Connection wizard success now records `justConnectedId` on completion.
- Connections page renders an activation banner stating runtime surfaces can refresh without restarting Elf.
- Plugins panel remains the separate runtime posture surface and can be refreshed via its existing `Refresh` control.

This keeps hot-activation UX explicit while deeper runtime posture wiring remains for subsequent tasks.