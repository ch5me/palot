# Wave 5 — Durable artifact identity + streaming `append` (Loom §4, §12.5) <!-- oc:id=sec_aa -->

> **Status:** ready to dispatch (after wave 4 ships + dogfood).
> **Plan section:** `docs/loom-implementation-plan.md` §3 Phase 5.
> **Assessment anchor:** `docs/loom-alignment-assessment.md` Gap 4
> (durable artifact identity), Gap 1.6 (cross-session pin).
> **Goal:** artifacts survive across sessions. The agent can stream a
> node's content token-by-token via the `append` frame. Artifact
> identity is a schema-versioned `ArtifactId` (ULID), backed by
> main-process sqlite at `~/.local/share/elf/loom/`.

## Context <!-- oc:id=sec_ab -->

Wave 4 gave us conflict protection. The next invariants are
**durable artifact identity** (Loom §4) and the **streaming `append`
frame** (Loom §12.5). Today, artifact IDs are session-scoped
localStorage entries (see `apps/desktop/src/renderer/atoms/genui-artifacts.ts:20–23`).
They do not survive session restarts. They are not referenceable by
the agent across sessions. The `append` frame is the missing piece
that lets the agent stream a node's content without a full re-render.

This wave is the last big infrastructure piece. After it lands, the
agent can drive an artifact from open to close with no restarts and
no full re-renders.

## Touched files <!-- oc:id=sec_ac -->

### New <!-- oc:id=sec_ad -->

- `apps/desktop/src/main/palot-runtime/artifact-store.ts` — sqlite
  + JSONL store at `~/.local/share/elf/loom/artifacts.sqlite`.
  Mirrors the XDG pattern in `apps/desktop/src/main/automation/paths.ts`
  (per `AGENTS.md:210–212`).
- `apps/desktop/src/main/palot-runtime/migrate-localstorage.ts` —
  one-shot import from `elf:genui-artifacts` on first boot.
- `apps/desktop/src/main/palot-runtime/persistence.ts` — snapshot
  per-session `rev` to disk; replay on session open.
- `apps/desktop/src/main/palot-runtime/__tests__/artifact-store.test.ts` —
  Bun.
- `apps/desktop/src/main/palot-runtime/__tests__/migrate-localstorage.test.ts` —
  Bun.
- `apps/desktop/src/shared/loom/artifact-id.ts` — ULID minting +
  validation. `art_<ulid>` format.
- `apps/desktop/src/main/palot-runtime/ipc.ts` — IPC channel
  `palot-artifact:{get, list, patch}` between renderer and main.

### Changed <!-- oc:id=sec_ae -->

- `apps/desktop/src/renderer/atoms/genui-artifacts.ts:20–23` — switch
  ID minting to `art_<ulid>`. Renderer reads from the new IPC
  channel.
- `apps/desktop/src/renderer/lib/types.ts` — `GenUiArtifactRecord`
  gains `version: number`, `dirty: string[]`,
  `lastAgentPatchAt: number`, `lastHumanEditAt: number`,
  `schemaVersion: 1`.
- `apps/desktop/src/main/palot-runtime/session-store.ts` — persist
  tree snapshots to sqlite; replay on session open.
- `apps/desktop/src/main/palot-runtime/commands.ts` — add the
  `append` verb: `palot_patch --append --node <id> --chunk <text.toon>`.
- `apps/desktop/src/main/loom-bridge.ts` — surface channel supports
  `append` frames.
- `apps/desktop/src/renderer/loom/use-loom-session.ts` — apply
  `append` frames incrementally.
- `apps/desktop/src/shared/palot-bridge-schemas.ts` — Zod schemas
  for the `append` verb and the durable artifact record.

## Required tools <!-- oc:id=sec_af -->

- All standard.
- `bun test`.

## Must do <!-- oc:id=sec_ag -->

1. Add `ArtifactId = "art_<ulid>"` in <!-- oc:id=item_aa -->
   `apps/desktop/src/shared/loom/artifact-id.ts`. Use a known ULID
   implementation (e.g. `ulid` npm package; verify the dep is
   acceptable before adding).
1. Add the new sqlite store at <!-- oc:id=item_ab -->
   `~/.local/share/elf/loom/artifacts.sqlite`. Schema:
   - `artifacts(id PK, schemaVersion, component, props JSON,
     source JSON, pin JSON, createdAt, updatedAt,
     lastRenderedAt, dirty JSON)`.
1. Migrate existing `atomWithStorage` entries into sqlite on first <!-- oc:id=item_ac -->
   boot. The one-shot migration is behind a feature flag
   (`loom.persistence.migrate`).
1. Add `palot_patch --append --node <id> --chunk <text.toon>`. <!-- oc:id=item_ad -->
   Component declares `supports_append: boolean` in its manifest.
   The runtime appends to the node's `text` or `markdown` field.
   Surface channel emits an `append` frame; the renderer
   incrementally renders.
1. Per-session `rev` snapshots to disk. On session open, the <!-- oc:id=item_ae -->
   runtime replays the tree from the last snapshot.
1. Cross-session pin: a pinned artifact survives a renderer reload <!-- oc:id=item_af -->
   AND a session restart. The pin is stored in the same sqlite
   table.
1. AXI compliance for the new tools: TOON on stdout, `--help`, <!-- oc:id=item_ag -->
   structured errors, contextual `help[]`.
1. Tests: <!-- oc:id=item_ah -->
   - `artifact-store.test.ts`: round-trip create/read/update/pin
     across process restarts. Use a temp `XDG_DATA_HOME`.
   - `migrate-localstorage.test.ts`: populate `localStorage` with
     a known fixture, run the migration, assert the new store
     contains the same data.
1. The `genui-renderer.tsx` legacy fence path keeps working. The <!-- oc:id=item_ai -->
   new persistent identity is additive; the fence path's
   `artifact_*` IDs continue to be system-generated but are now
   also written through the new store.

## Must NOT do <!-- oc:id=sec_ah -->

- No CRDT. v0 is last-write-wins with dirty protection.
- No V2 `contributes.components` (wave 6).
- No tool-renderer consolidation (wave 7, deferred).
- Do not bundle the migration with cross-session pin. Pin is in
  this wave; cross-session is the proof criterion.
- Do not change the wire's binding model or conflict policy.

## Proof criteria <!-- oc:id=sec_ai -->

1. `bun run check-types` clean. <!-- oc:id=item_aj -->
1. `bun run lint` clean. <!-- oc:id=item_ak -->
1. `artifact-store.test.ts` + `migrate-localstorage.test.ts` pass. <!-- oc:id=item_al -->
1. End-to-end: a real OpenCode session opens a Loom session, the <!-- oc:id=item_am -->
   agent renders a `dag-sparkline`. The agent pins the artifact.
   The renderer is restarted. The pin survives.
1. The agent streams a long-form `markdown` node via <!-- oc:id=item_an -->
   `palot_patch --append`. The surface renders the chunks
   incrementally.
1. The first-boot migration: install the new build over an existing <!-- oc:id=item_ao -->
   one; existing pinned artifacts are migrated to sqlite; the
   localStorage key is removed after migration.
1. The legacy fence path still works; `dag-sparkline` rendered via <!-- oc:id=item_ap -->
   a chat fence still appears.

## Risk <!-- oc:id=sec_aj -->

- Medium-large. State migration + new IPC channel + persistence
  swap. Mitigations:
  - One-shot migration behind a feature flag. Reversible by
    restoring from `localStorage` if the migration fails.
  - Tests cover create/read/update/pin across process restarts.
  - The renderer's IPC channel degrades gracefully if main is
    unavailable (falls back to in-memory only).
- Failure mode: migration corrupts existing data. Test with a
  known fixture before merge.
- Failure mode: `append` frame misapplied to a non-text field.
  Runtime validates the field type before appending.

## Out of scope (for later waves) <!-- oc:id=sec_ak -->

- Wave 6: V2 `contributes.components`.
- Tool-renderer consolidation (wave 7, deferred).
- Multi-human CRDT (v2, post-Loom).
- Firefly/ELF cross-project work (after wave 6).

## Definition of done <!-- oc:id=sec_al -->

- All proof criteria pass.
- `docs/loom-progress.md` is updated with `Wave 5: complete (date)`.
- A changeset (`bun changeset`) is added.
- A PR is opened; description cites this prompt + the plan section.
- Manual dogfood: a real OpenCode session uses the `append` frame
  to stream a markdown node end-to-end. A real session's pinned
  artifacts survive a renderer restart. If both are green, the
  wave ships.