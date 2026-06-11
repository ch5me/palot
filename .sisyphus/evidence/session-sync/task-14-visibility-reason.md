# Task 14 Evidence — Visibility Reason Indicator <!-- oc:id=sec_aa -->

Renderer debug gating:
- indicators only render when `import.meta.env.DEV` is true
- labels are built from canonical `visibilityReason` plus `driftFlags`

Surfaces covered:
- sidebar session rows
- sub-agent child-session cards

Result:
- hidden/excluded/degraded session reasons are now visible in debug mode
- normal product flow stays uncluttered in non-dev builds