# Task 6 Evidence — Preload Bounds <!-- oc:id=sec_aa -->

Bootstrap does not load every project.

Bounded preload model:
- keep focused-project cap (`FOCUSED_PROJECT_LIMIT`, `PRELOADED_PROJECT_LIMIT`)
- add only projects whose directories are explicitly present in `bootstrapDirectories`
- `bootstrapDirectories` populated from active presence or direct/manual project load

Result:
- visibility improves for active sessions outside top focused projects
- preload still targets bounded, explicit directories instead of hydrating entire backlog