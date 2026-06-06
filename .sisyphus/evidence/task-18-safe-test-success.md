# Task 18 Safe Test Success <!-- oc:id=sec_aa -->

UI now exposes a `Test connection` action on connection rows.

Success behavior currently modeled:
- connected MCPs record `Safe read probe succeeded.`
- non-broken recommended entries record `Safe read probe ready.`
- probe feedback renders in-page without mutating runtime state

This keeps the probe path read-only and user-visible.