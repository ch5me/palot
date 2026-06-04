# GenUI / Inline Artifact Architecture — Archived Notes <!-- oc:id=sec_aa -->

> **Why archived (2026-06-03):** active plan is now `aios-superapp-to-palot-full-migration.md`. GenUI/artifact work is parked. This file is the durable record so a future session can pick it up without losing the analysis.
>
> **Status when parked:** architecture only. Phase 1 DAG design file-by-file. No code changes were made.

---

## 1. Problem statement (verbatim from original request)

Design the right architecture for a true inline GenUI / artifact system in chat: agent intentionally emits a tool call (`render_genui`) that renders a self-contained interactive UI artifact inline at the exact point in the conversation timeline. Treat DAG as the first concrete artifact type; design so DAG is only one registry entry among many.

---

## 2. Recommendation <!-- oc:id=sec_ab -->

**Option C, riding the existing ToolPart seam (Option A's mechanics).**

Use `render_genui` as a synthetic tool name, fronted by an `ArtifactRegistry` that maps a `kind` discriminator → fixed React renderer with a validated JSON payload. Same primitive `task` → `SubAgentCard` already uses. Generalize that pattern from "one tool with a custom card" to "N tools/inputs with N custom cards, dispatched through one entry point."

Why this beats alternatives:
- **vs. Option A (plain tool, ad-hoc renderer):** works alone, but bakes "DAG is special" into the dispatcher. A registry turns DAG into one entry among many.
- **vs. Option B (synthetic part type):** requires OpenCode server change. Out of scope. Renderer re-exports `Part` union; we cannot add a variant.
- **vs. Option D (sidecar channel):** loses free ordering, free undo/fork, free SSE plumbing.

---

## 3. Where the artifact lives

- A `ToolPart` with `tool: "render_genui"`. `state.input` = JSON descriptor. Server echoes as `state.output`. No server change.
- New component `ArtifactToolCall` short-circuits in `ChatToolCall` exactly like `SubAgentCard` does (chat-tool-call.tsx:1193).
- Default `ToolCard` shell is bypassed.
- Existing `tool: "dag"` path and `dag` text-fence path stay wired through the new `DagToolContent` → registry → `DagSparkBlock` (no regression; they become legacy shortcuts that map to `Artifact<{ kind: "dag" }>`).

---

## 4. Payload shape (safety-first) <!-- oc:id=sec_ac -->

- Discriminated union on `kind`: `ArtifactDescriptor = { kind: "dag", payload: DagPayload } | { kind: "card", payload: CardPayload } | …`.
- Per-kind hand-rolled validator returning `{ ok: true, payload } | { ok: false, error }`. Renderer never trusts the payload.
- Cap raw `state.input` at 64KB before parsing (mirrors existing `MAX_OUTPUT_LENGTH = 5000` precedent in chat-tool-call.tsx:58).
- All fields JSON-serializable. No functions, no React elements, no class instances. Security boundary.
- Fallback for unknown/failed kinds: `_raw_fallback` JSON tree, no crash.

---

## 5. Renderer registration

- Module-scoped `Map<kind, ArtifactRendererEntry>` keyed by `kind`.
- Entry = `{ validate(input), render(payload, ctx), fallback?, options? }`.
- Static import side-effect from `artifacts/index.ts` that imports each `renderers/*.ts`. Tree-shakable. New kinds = new file + new import.
- Test seam: `_testOnlyRegistry` symbol. Repo has no renderer test runner today; this is a future hook.

---

## 6. Safest scope (the GenUI safety story) <!-- oc:id=sec_ad -->

- Model can ONLY pick from a hard-coded `kind` allowlist.
- Each kind maps to a fixed React component shipped in the bundle. Model supplies JSON data; renderer is code.
- **No `eval`, no `Function()`, no serialized React, no `dangerouslySetInnerHTML` with model strings.**
- Power grows by adding files + shipping, not by opening the door to arbitrary code.

---

## 7. File-by-file seams (Phase 1 minimum)

```
apps/desktop/src/renderer/components/chat/
  artifacts/
    types.ts                  NEW    ArtifactDescriptor, ArtifactKind, ArtifactContext
    registry.ts               NEW    Map, register/resolve, _testOnlyRegistry
    index.ts                  NEW    side-effect: imports each renderers/*.ts
    renderers/
      dag.ts                  NEW    validate({nodes,edges}); render = <DagSparkBlock>
      _raw_fallback.ts        NEW    unknown/failed-kind JSON tree
  artifact-tool-call.tsx      NEW    dispatch shell; handles streaming/error/duration
  chat-tool-call.tsx          EDIT   add render_genui short-circuit near task (~1193)
  chat-turn.tsx               EDIT   RenderablePart += { kind: "artifact" };
                                       tools excludes render_genui from grouping
  dag-spark-renderer.tsx      EDIT   re-used by renderers/dag.ts (no new fence parser)
```

No changes to `atoms/`, `services/`, `main/`, `preload/`. Artifact flows through existing tool pipeline. Zero new SSE events, zero new atoms, zero new IPC.

---

## 8. Five gotchas (most likely to bite) <!-- oc:id=sec_ae -->

1. **OpenCode server must accept `render_genui` tool name.** Stock OpenCode does not have this tool. Must register via custom tools config, plugin, or MCP server. Whole design pivots on this. Verify before Phase 1 ships. <!-- oc:id=item_aa -->
1. **`textAlreadyInline` recompute** (chat-turn.tsx:684). When adding `RenderablePart`'s `artifact` variant, response text will double-render unless this flag treats any inline content (text or artifact) as "content present." <!-- oc:id=item_ab -->
1. **Artifacts must NOT enter the `tools` array.** Otherwise `groupPartsForStream` groups them into "Show N steps" chips. Filter `render_genui` out of `tools` in `getPartsAndTools` (chat-turn.tsx:265). <!-- oc:id=item_ac -->
1. **Payload cap at 64KB raw** before parsing. Model could emit huge payloads. Truncate + render error state. Mirrors `MAX_OUTPUT_LENGTH` precedent. <!-- oc:id=item_ad -->
1. **`render_genui` bypasses permission card branch** (chat-tool-call.tsx:1230). Tools have inline permission prompts; artifacts don't. <!-- oc:id=item_ae -->

---

## 9. Streaming + ordering

- Free. `partsFamily` upserts in id order; `getPartsAndTools` iterates parts in order; `groupPartsForStream` preserves interleaving. Artifact appears at exactly the position the server emitted it.
- `state.status === "pending"`/`"running"` means partial JSON in `state.input`. Renderers must tolerate this. DAG already does via `tryParseDagInput`. New kinds: validate lazily — if parse fails while streaming, render a loading placeholder; on completion retry parse.

---

## 10. Re-render hygiene <!-- oc:id=sec_af -->

- Wrap each renderer in `memo()`.
- Gate on parsed payload (not raw string) to avoid jank during input deltas.

---

## 11. Backward compatibility

- Don't delete `DagToolContent` or `splitDagFences` until existing session history is audited for legacy `dag` fences and `tool: "dag"` calls. Route them through the new registry instead of removing.
- Keep `TextWithDag` as a parallel fallback for models not yet trained to call tools, but treat it as legacy, not primary.

---

## 12. Incremental rollout <!-- oc:id=sec_ag -->

**Phase 1 — DAG only.**
- New `render_genui` tool name; one registry entry.
- Route existing `tool: "dag"` and `dag` fence through it.
- Retarget plan mode system block (`atoms/chat.ts:71`) to instruct the model to emit a `render_genui` tool call with `{ kind: "dag" }` instead of a `dag` fence string.
- Verification: real chat where agent calls `render_genui` with `{ kind: "dag" }`. Renders at exact position. Both default + verbose display modes. Undo/fork preserves. Refresh restores. Error path: invalid payload → `_raw_fallback`, not crash.

**Phase 2 — Generic registry. 2-3 cheap kinds.**
- `card` (title, subtitle, body, optional `actions: { label, intent }[]` where intent is a discriminated string: `"copy" | "open" | "callback:<id>"`; "callback" requires a registered handler).
- `metric_grid` (title + `metrics: { label, value, delta? }[]`).
- `button_row` (action allowlist).
- Each ~50-80 lines. Dispatcher doesn't grow.

**Phase 3 — Richer interactivity.**
- `diff_inline` (subset of file diff), `chart` (static SVG; reuse `dag-sparkline` styles or hand-roll), `form` (multi-field form posting via `submit_artifact_response` tool), `tabs`, `accordion`, `table`.
- All data-driven, no React execution risk.
- Add a "Show raw payload" debug toggle behind a dev flag.

---

## 13. Risk + edge summary

- Backward compat with `tool: "dag"` + `dag` text fence.
- Streaming partials; per-renderer lazy validation.
- `hasSteps` / `textAlreadyInline` drift causing double-render.
- Display-mode default grouping must skip artifacts.
- Re-render thrash on heavy artifacts (memo + payload-keyed compare).
- Payload size cap (64KB).
- Sub-agent artifacts work automatically (`task` short-circuit doesn't interfere).
- Fork/undo survives via stable part id.
- Permission prompts skipped.
- Mock fixtures needed in `lib/mock-data.ts`.
- No renderer test runner; Phase 1 ships with manual smoke only.

---

## 14. One-line summary <!-- oc:id=sec_ah -->

Build a `render_genui` tool that emits a `ToolPart` with a `kind`-discriminated JSON payload; dispatch to a fixed React renderer via an allowlisted registry; short-circuit in `ChatToolCall` like `task` does; reuse the existing part ordering, streaming, undo, and fork machinery verbatim.