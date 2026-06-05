# Project Manager PM Lane V1 Learnings <!-- oc:id=sec_aa -->

- Keep PM prompt on disk and load it through renderer backend file reads so prompt edits do not touch launcher logic.
- Local pending submission state is enough for limbo UI; no new global atoms needed.
- CH5PM dashboard fixture/state contracts can feed sparse PM cards without importing the full dashboard panel.
- Launcher seam should own `createSession` + `sendPrompt` + prompt composition so future warm-pool or round-robin swaps stay out of UI.
- Sidebar `PM Sessions` can derive from existing agent/session truth; avoid a second PM-only session store.
- Follow-up seams: better PM session tagging than title matching, warm-pool allocation strategy, Plane/CH5PM richer CRUD, and agent-session hydration proof via UI walkthrough.
- Bun renderer tests may import storage-backed atoms transitively; guard legacy migration helpers against missing `localStorage` so unit tests can run in CLI environments.
