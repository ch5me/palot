# Task 1 — Session binding domain model <!-- oc:id=sec_aa -->

Date: 2026-06-06

## Landed <!-- oc:id=sec_ab -->

- Added shared binding types to `apps/desktop/src/preload/api.d.ts`:
  - `SessionBindingStatus`
  - `SessionBindingAuthority`
  - `SessionBinding`
  - `SessionBindingRecord`
  - `SessionBindingSecretRecord`
  - `SessionBindingStoreFile`
- Added main-owned binding store in `apps/desktop/src/main/palot-session-binding.ts`.
- Added main-only secret cache in `apps/desktop/src/main/palot-secret-cache.ts`.
- Added tests:
  - `apps/desktop/src/main/palot-session-binding.test.ts`
  - `apps/desktop/src/main/palot-secret-cache.test.ts`

## Authority contract <!-- oc:id=sec_ac -->

- OpenCode session id = agent authority.
- Magic Browser session id = browser authority.
- Browser lane id = transport attachment; may change over time.
- Overlay event stream = visualization only.
- Viewer URL, lane health, and current URL are derived on read and are not persisted in the binding record.

## Persistence <!-- oc:id=sec_ad -->

- Binding store path: `~/.config/elf/opencode/session-bindings.json`
- Record content is intentionally small and stable:
  - binding id
  - OpenCode session id
  - browser lane id
  - Magic Browser session id
  - lifecycle status
  - created/updated/released timestamps
- No viewer URL, auth token, or live health fields in persisted JSON.

## Secret handling <!-- oc:id=sec_ae -->

- Viewer auth token stays in a main-only in-memory cache keyed by binding id.
- Secret cache is separate from the binding store.
- Renderer and future plugin context must never receive raw auth tokens.

## Canonical lookup <!-- oc:id=sec_af -->

- `getSessionBindingByOpenCodeSession(sessionId)` is the canonical read path.
- `upsertSessionBinding(binding)` is the canonical write path.
- `releaseSessionBinding(sessionId)` marks lifecycle release without deleting history.

## Verification target <!-- oc:id=sec_ag -->

- Unit tests cover create/load/release semantics and in-memory secret cache behavior.
- Full repo verification still pending with later slices.