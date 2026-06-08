# Loom Build Prompts — Index <!-- oc:id=sec_aa -->

> **Companion to:** `.sisyphus/plans/loom-implementation-plan.md` (the *what* and *why*)
> and `.sisyphus/plans/loom-progress.md` (the *status*). This directory is the *how*.

One prompt per implementation wave. Each prompt is self-contained: it
includes the context the worker needs, the open decisions to resolve,
the touched files, the proof criteria, the risks, and the definition of
done. A PM can dispatch any prompt as-is to a `quick` or `ultrabrain`
workstream.

| Wave | Prompt | Status | Loom sections |
|---|---|---|---|
| **0** | [wave-00-mirror-lists.md](wave-00-mirror-lists.md) | **ready** | n/a (prerequisite) |
| **1** | [wave-01-typed-registry.md](wave-01-typed-registry.md) | **ready** | §6 (typed registry, smallest-schema-first) |
| **2** | [wave-02-loom-wire.md](wave-02-loom-wire.md) | blocked on D1, D3, D4 | §5.1, §4 (render/patch/poll/session/rev) |
| **3** | [wave-03-dual-bindings.md](wave-03-dual-bindings.md) | blocked on Wave 2 | §7, §8 (signal/state + dirty-field) |
| **4** | [wave-04-durable-append.md](wave-04-durable-append.md) | blocked on Wave 3 | §4, §12.5 (durable id + append) |
| **5** | [wave-05-v2-components.md](wave-05-v2-components.md) | blocked on Wave 4 | §3, §6 (plugin manifest = component contract) |
| **6** | [wave-06-tool-renderers.md](wave-06-tool-renderers.md) | **deferred** (post-Loom) | n/a (refactor) |

## Recommended first dispatch <!-- oc:id=sec_ab -->

**Wave 1.** Smallest Loom-shaped win. No transport change. Reversible.

1. Dispatch Wave 0 first if the mirror lists are still in place. <!-- oc:id=item_aa -->
1. Then dispatch Wave 1. <!-- oc:id=item_ab -->
1. After Wave 1 lands, gate on a real-agent dry run: spawn a real OpenCode <!-- oc:id=item_ac -->
   session, ask the model to render a `dag-sparkline` via the new
   `palot components describe` path, confirm the model picks the right
   tool, confirm the fence flow still works.
1. If green, resolve D1/D3/D4 (transport, patch addressing, batching <!-- oc:id=item_ad -->
   window) and dispatch Wave 2.

## Prompt conventions <!-- oc:id=sec_ac -->

Every prompt follows the same shape:

1. **Status** — ready, blocked, deferred. <!-- oc:id=item_ae -->
1. **Context** — the worker reads this first. <!-- oc:id=item_af -->
1. **Why this is the right next wave** — the rationale for ordering. <!-- oc:id=item_ag -->
1. **Open decisions to resolve BEFORE writing code** — call out blockers. <!-- oc:id=item_ah -->
1. **Touched files (NEW + CHANGED)** — concrete paths. <!-- oc:id=item_ai -->
1. **Required tools** — `edit`, `write`, `read`, `bun run check-types`, etc. <!-- oc:id=item_aj -->
1. **Must do** — the work. <!-- oc:id=item_ak -->
1. **Must NOT do** — the boundaries. <!-- oc:id=item_al -->
1. **Proof criteria** — what "done" means. <!-- oc:id=item_am -->
1. **Risk** — failure modes and mitigations. <!-- oc:id=item_an -->
1. **Out of scope (for later waves)** — explicit. <!-- oc:id=item_ao -->
1. **Definition of done** — PR + changeset + progress doc update. <!-- oc:id=item_ap -->

## Notes for the PM <!-- oc:id=sec_ad -->

- The prompts assume the worker is a `quick` or `ultrabrain` workstream
  dispatched via `task()`. They are not for `prometheus` planning.
- Each prompt cites the relevant section of `.sisyphus/plans/loom-implementation-plan.md`
  and `.sisyphus/plans/loom-alignment-assessment.md`. The worker should load those
  docs as context.
- The "Definition of done" includes a `.sisyphus/plans/loom-progress.md` update.
  This is the single source of truth for status across sessions.
- The prompts are deliberately explicit about **what is not in scope**.
  Workers should not pull in adjacent work; if a wave proves too big,
  split it (the prompts are the seams).
- All prompts respect the AGENTS.md conventions: Biome formatting, Zod
  for typed contracts, Bun test for tests, pathspec commits.