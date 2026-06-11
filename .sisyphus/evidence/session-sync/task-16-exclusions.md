# Task 16 Evidence — Intentional Exclusions <!-- oc:id=sec_aa -->

Canonical store and renderer rules now preserve explicit exclusions through `visibilityReason`.

Current proof shape:
- non-visible or child sessions are modeled explicitly instead of disappearing through ad hoc heuristics
- command palette and sidebar filter on canonical `visibilityReason === "visible"`

Follow-up risk:
- no dedicated automated fixture yet for noise-project exclusion in renderer lists; current proof is design + code-path based