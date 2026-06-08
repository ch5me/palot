# firefly-client ↔ Firefly Cloud auth + connection seam <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

Add the first cloud-aware identity + box-connection seam to **palot** (the firefly-client,
codebase `elf`, rename pending). The seam has five client-side deliverables:
(1) a sign-in route consuming the cloud's device-auth flow with secure token storage in
Electron `safeStorage`; (2) a typed cloud-API client that threads `@ch5me/elf-auth-client`'s
`ElfTokenStore` through `@ch5me/client`'s `FireflyRequestOptions`; (3) a dual-mode box
connection layer (`managed-relay` default, `BYOK-direct` opt-in) that retires Basic Auth
in favor of RS256 delegated tokens verified via JWKS; (4) a "where is my box" discovery
flow that asks the cloud for the user's provisioned boxes and lets the dashboard enumerate
them; (5) read-only entitlement awareness sourced from the access-token claim.

Topological reality today (verified): palot is **fully standalone on the cloud axis** — no
login route, no auth/billing routes, no Firefly token, no cloud-API client import. The
only auth scheme is Basic Auth against an OpenCode server URL
(`apps/desktop/src/main/ipc-handlers.ts:957`,
`apps/desktop/src/renderer/services/opencode.ts:187`,
`apps/desktop/src/renderer/services/connection-manager.ts:58-187`). The
`@ch5me/elf-auth-client` package lives in `ch5-packages` (canonical) and provides
`createElfVerifier`, `ElfAuthProvider`, `useElfAuth`, `createElfTokenStore`, and
`createElfAuthMiddleware` (`ch5-packages/packages/auth/elf-auth-client/src/{index,browser,react,hono,types}.ts`).
The firefly-cloud local duplicate at `firefly-cloud/packages/elf-auth-client/elves-auth-client/`
is deprecated (`docs/elf-auth-topology.md:97-100`); palot must import from the
`@ch5me/elf-auth-client` package, **not** the firefly-cloud copy. The cloud's typed runtime
client is `@ch5me/client` in `firefly-cloud/packages/client/src/api.ts:1-1213`, which already
centralises auth, errors, runtime provisioning, and relay chat behind a single
`FireflyRequestOptions` envelope — that's the surface to extend with a `mode: 'managed-relay' | 'byok-direct'`
enum and `ElfTokenStore` plumbing.

The cloud already exposes everything we need: device-auth
(`apps/web/src/app/api/device-auth/codes/route.ts:1-25`,
`apps/web/src/lib/device-auth/device-auth.ts:16-71,152-208`),
`/sign-in-to-editor` handoff (`apps/web/src/app/sign-in-to-editor/page.tsx:1-58`),
delegated RS256 mint (`apps/web/src/lib/tokens.ts:115-152,229-247`,
`apps/web/src/app/api/firefly-auth/token/route.ts:1-43`),
JWKS (`services/auth/src/jwks.handler.ts:1-70`),
portable runtime provisioning
(`services/firefly-runtime/src/routes/platform.ts:1182-1620`),
runtime register/heartbeat
(`apps/firefly-api/src/index.ts:3145-3234`),
and relay chat via `deriveAgentGatewayToken`
(`apps/firefly-api/src/runtime-secrets.ts:25-32`).
The only **client-facing** gap is that `apps/firefly-api` exposes no
first-class "locate-my-box" endpoint — locate-my-box today is a tRPC procedure on
`apps/web/routers/cloud-agent-next-router.ts` (see `Cloud-Side Dependency Gaps` below).
This plan enumerates those gaps so a separate `firefly-cloud` lane can ship them in parallel.

## Work Objectives <!-- oc:id=sec_ac -->

### W1 — Sign-in route + secure token storage <!-- oc:id=sec_ad -->
- [ ] Add a `/login` (or equivalent) route in palot's renderer that drives the cloud's
      **device-auth** flow (`POST /api/device-auth/codes` → poll
      `GET /api/device-auth/codes/:code` → show `user_code` + `verification_uri_complete`,
      `shell.openExternal()` from main process).
- [ ] Mirror the `/sign-in-to-editor` URL-handoff as an **alternative** entry path
      (deep-link `firefly-client://auth/callback?token=…&refresh=…&state=…`); both paths
      mint the same `ElfTokenStore` shape.
- [ ] Store Firefly user access token, refresh token, and `elfUserId` in Electron
      `safeStorage` (async API; **never** in renderer localStorage / `safeStorage` sync
      variant), in main process; expose only function-shaped IPC to the renderer
      (`auth.getState()`, `auth.signOut()`, `auth.onChange(cb)`).
- [ ] Persist the stored `ElfAuthState` across app restarts; on first launch after sign-in,
      silent-refresh the access token if `now > exp - 60s` and surface a re-prompt only
      on `expired_token` / `access_denied` / `invalid_grant` (RFC 8628 §3.5 / RFC 9700).
- [ ] Sign-out calls the cloud revocation endpoint if one exists, clears `safeStorage`,
      and notifies all renderers via IPC.

### W2 — Cloud API client (`@ch5me/client` dual-mode + `ElfTokenStore` plumbing) <!-- oc:id=sec_ae -->
- [ ] Extend `firefly-cloud/packages/client/src/api.ts:7-21` `FireflyRequestOptions` with
      `mode: 'managed-relay' | 'byok-direct'` (default `managed-relay`) and a discriminated
      `byok?: { baseUrl: string; apiKey: string }` payload; `buildHeaders` (`api.ts:255-274`)
      branches on `mode` rather than only inspecting `alphaApiKey` env fallback.
- [ ] Replace the loose `authToken?: string` in `FireflyRequestOptions` /
      `createFireflyTrpcClient` (`trpc.ts:1-73`) with a `tokenStore?: ElfTokenStore` field;
      read `Authorization: Bearer <elfUserToken>` via `tokenStore.getAuthHeader()`.
- [ ] Centralise `apiUrl` resolution (`api.ts:234-253`, `trpc.ts:12-49`) into a single
      `resolveApiUrl({ mode, tokenStore, byok, env })` helper — managed-relay resolves from
      `ElfTokenStore` token claims (issuer/audience), BYOK resolves from per-user `baseUrl`.
- [ ] Create a palot-local service `apps/desktop/src/main/services/firefly-client/index.ts`
      that owns the singleton `@ch5me/client` instance, holds the `ElfTokenStore`, and
      exposes typed methods for: `provisionStatus`, `listenProvisioningStatus`, `listBoxes`
      (once the cloud ships the gap, see below), `signInStatus`, `signOut`, `getEntitlements`.
- [ ] Validate env at boot via `@t3-oss/env-core` + Zod: per-mode base URLs
      (`VITE_FIREFLY_API_URL` for renderer, main-process `FIREFLY_API_URL`/`FIREFLY_RELAY_URL`
      from Hush injection — **not** `.env` in repo); reject empty strings via
      `emptyStringAsUndefined: true`.

### W3 — Box connection in the dual-mode model <!-- oc:id=sec_af -->
- [ ] Extend `apps/desktop/src/renderer/services/opencode.ts:1-245` `connectToServer` with
      a `mode: 'opencode-direct' | 'firefly-relay'` field. The direct path keeps the
      current `LocalServerConfig | RemoteServerConfig` union but **retires Basic Auth** in
      favor of a short-lived RS256 delegated token fetched from
      `POST /api/firefly-auth/token?subApp=portable-opencode`
      (`apps/web/src/app/api/firefly-auth/token/route.ts:1-43`), cached in memory, refreshed
      at `exp - 60s`. The box verifies via JWKS
      (`services/auth/src/jwks.handler.ts:1-70`,
      `docs/elf-auth-topology.md:99`).
- [ ] Implement the **relay path** in a new
      `apps/desktop/src/main/services/firefly-relay-manager.ts` that mirrors
      `opencode-manager.ts:50-139`'s `ensureX/getXStatus` shape, but talks to the
      `@ch5me/client` `listenRuntimeProvisioningStatusChecked`
      (`api.ts:758-831`) instead of probing `127.0.0.1:4096`; lockfile by `runtimeId` not
      port. Subscribe to relay state changes; on `desiredState !== 'active'`, fall back to
      `getRuntimeProvisioningStatusChecked` (`api.ts:721-736`) and surface a "starting"
      surface in the renderer.
- [ ] Plumb two new atoms `relayModeAtom` and `relayTokenStoreAtom` next to
      `authHeaderAtom` in `apps/desktop/src/renderer/atoms/connection.ts`. **Do not**
      overload `authHeaderAtom` — it is Basic-Auth-shaped and must stay unchanged for the
      direct-mode code path during migration.
- [ ] On the **BYOK-direct** path, the user pastes a provider API key (Anthropic / OpenAI /
      Google); the key goes through `safeStorage`, and the box is configured at provision
      time with that key as `RUNTIME_BACKEND_KEY` (per the runtimeKind-persistence contract
      `docs/runtime-kind-persistence-contract.md:1-217`). No Firefly gateway in this path.
- [ ] Renderer never holds a token. All token reads go through preload `contextBridge`
      function calls; the only atom that holds a "logged-in" boolean is `relayTokenStoreAtom`'s
      `hasToken` derived state.

### W4 — "Where is my box" discovery + dashboard enumeration <!-- oc:id=sec_ag -->
- [ ] Renderer asks the cloud for the user's provisioned box(s) on session resume
      (`@ch5me/client.listBoxes()` — implemented as part of W2; consumes the cloud-side
      gap, see below). Display URL, `runtimeId`, `runtimeKind`, `lastHeartbeatAt`,
      `observedState`, `desiredState`, `capabilities`, `imageDigest`.
- [ ] Dashboard surfaces a list view of the account's boxes (personal desktop + cloud
      sprites); each entry shows last-seen, region, and a primary action (`Open`, `Restart`,
      `View logs`). For dead or unregistered boxes, show a "Set up a box" CTA that kicks
      the device-auth / portable runtime provision flow.
- [ ] Subscribe to box-state SSE / WS (relay-side) for live updates; debounce renderer
      updates to 1 Hz to avoid atom thrash.
- [ ] Cache the last-known list in main-process SQLite (or `electron-store` if SQLite
      is rejected) keyed by `elfUserId`; on `401` from the cloud, invalidate the cache and
      drop back to the sign-in route. Cache TTL = 5 min in foreground, 60 s in background.

### W5 — Entitlement awareness (read-only consume) <!-- oc:id=sec_ah -->
- [ ] Read `entitlements` claim from the latest RS256 token payload
      (`ch5-packages/packages/auth/elf-auth-client/src/types.ts:1-38`); do **not** call a
      separate entitlements endpoint. Plan/feature/limit changes are picked up at the next
      token refresh.
- [ ] Expose a typed `EntitlementsView` to the renderer: `plan`, `features[]`, `limits{}`,
      `gastownAccess`, `isAdmin`, `env`. UI surfaces a "Reconnect to verify" soft-fail
      on `expired_token` (don't cache entitlement decisions aggressively).
- [ ] Server is authoritative: never ship a "feature is enabled" boolean to the renderer
      that the renderer alone decides on. Treat 402/403 `entitlement_required` from the
      box as the upgrade signal and route the user to a `/upgrade` route on the cloud.

## Must Have <!-- oc:id=sec_ai -->

- Sign-in route + secure token storage in main-process `safeStorage` (W1)
- `@ch5me/elf-auth-client` consumed from `ch5-packages` (not the deprecated firefly-cloud
  duplicate) for all RS256 verification + `ElfAuthProvider` wiring in the renderer
- Dual-mode `FireflyRequestOptions` extension with `mode` + `byok` discriminated union
  and `ElfTokenStore` plumbing in both `api.ts` and `trpc.ts` (W2)
- Direct mode (formerly Basic Auth) retires Basic Auth → RS256 delegated token; relay
  mode ships with relay-state subscription (W3)
- "Where is my box" + dashboard enumeration (W4)
- Read-only entitlement awareness from token claims (W5)
- Comprehensive `Cloud-Side Dependency Gaps` list (so a firefly-cloud lane can pick it up)
- Full F1–F4 final verification wave run before the plan is closed

## Must NOT Have <!-- oc:id=sec_aj -->

- No client-side user-input API key UI in the v1 seam (BYOK-direct path is server-configured
  at provision time; UI for paste-your-key lands in a later plan)
- No new auth provider integration (Clerk / Auth0 / WorkOS / MSAL); the cloud already
  issues RS256 — we verify
- No edits to the deprecated `firefly-cloud/packages/elf-auth-client/elves-auth-client/`
  copy; all palot wiring imports from `@ch5me/elf-auth-client`
- No new public client APIs on `apps/firefly-api` from this lane (that's a cloud-side
  change — see `Cloud-Side Dependency Gaps`)
- No pre-existing `cloud-agent` / `cloud-agent-next` RS256 migration in scope
  (`docs/elf-auth-topology.md:104-106` — separate lane)
- No silent-fallback to `safeStorage` Linux `basic_text` backend: refuse to boot in
  production if `safeStorage.getSelectedStorageBackend() === 'basic_text'` for the
  `authToken` record; show a hard error in dev
- No token in the renderer process (NEVER store/transport raw token through `ipcRenderer`)

## Verification <!-- oc:id=sec_ak -->

| Layer | Check | Evidence |
|---|---|---|
| TS types | `bun run check-types` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| Unit | `bun test` (new + existing) | exit 0; new tests cover token rotation, JWKS refresh on unknown `kid`, mode dispatch, sandbox-id scheme sanity (reversible base64url vs irreversible hash) |
| Build | `bun run build` | exit 0 |
| E2E (manual) | Sign in via device code → connect via relay → call a box runtime endpoint → see box in dashboard → sign out | screenshots + log capture under `.sisyphus/evidence/firefly-cloud-seam/` |
| Smoke (manual) | Switch to BYOK-direct in dev config → connect to a locally-provisioned portable-opencode box → confirm token verify via JWKS, NOT Basic Auth | log capture |
| Regression | All existing connection modes still work (Local + Remote + mDNS) | existing `apps/desktop/src/main/opencode-manager.ts` and `connection-manager.ts` tests pass |

## Execution <!-- oc:id=sec_al -->

Six ordered lanes. Each lane's "QA" block must be green before the next lane starts.
Run a **single shared main process** for runtime, but keep lanes isolated at the file/PR
level so reviews are atomic.

### Lane A — sign-in route + secure token storage (W1) <!-- oc:id=sec_am -->
1. Audit current `safeStorage` usage in palot <!-- oc:id=item_aa -->
   (`apps/desktop/src/main/credential-store.ts`, `apps/desktop/src/main/ipc-handlers.ts:933-940`,
   `apps/desktop/src/main/settings-store.ts`).
1. Build `apps/desktop/src/main/services/auth/`: <!-- oc:id=item_ab -->
   - `vault.ts` — async `safeStorage.encryptStringAsync`/`decryptStringAsync` wrapper,
     refuses to start if `basic_text` on Linux in production builds.
   - `token-store.ts` — `ElfTokenStore` shape (parity with
     `ch5-packages/packages/auth/elf-auth-client/src/browser.ts:10-37`) backed by `vault`.
   - `device-auth-client.ts` — implements `requestDeviceCode`, `pollForApproval`,
     `deny` against `apps/web/src/app/api/device-auth/{codes,codes/:code,tokens}/route.ts`.
   - `sign-in-to-editor-handler.ts` — registers `firefly-client://` deep-link via
     `app.setAsDefaultProtocolClient`, parses callback, exchanges for the same store.
1. Wire preload: add `auth.getState`, `auth.signIn`, `auth.signOut`, `auth.onChange` to <!-- oc:id=item_ac -->
   `apps/desktop/src/preload/api.d.ts` and `apps/desktop/src/preload/index.ts`.
1. Build renderer route `apps/desktop/src/renderer/routes/login.tsx` with a polling UI <!-- oc:id=item_ad -->
   (`shell.openExternal` for the verification URL, QR code for `verification_uri_complete`,
   cancel button).
1. **QA**: `bun run check-types`, `bun test --filter auth`, manual sign-in via real cloud <!-- oc:id=item_ae -->
   staging, capture `.sisyphus/evidence/firefly-cloud-seam/w1-signin.png`.

### Lane B — `@ch5me/client` dual-mode + `ElfTokenStore` plumbing (W2) <!-- oc:id=sec_an -->
1. Open PRs against `firefly-cloud/packages/client`: <!-- oc:id=item_af -->
   - `src/api.ts:7-21` add `mode` + `byok` discriminated union.
   - `src/api.ts:234-274` route auth header resolution through `tokenStore.getAuthHeader()`.
   - `src/trpc.ts:1-73` thread same `tokenStore` parameter.
1. In palot: add `apps/desktop/src/main/services/firefly-client/index.ts` that owns the <!-- oc:id=item_ag -->
   singleton client, depends on `ElfTokenStore` from Lane A, exposes typed methods.
1. Add env validation (`@t3-oss/env-core` + Zod) at main-process boot. <!-- oc:id=item_ah -->
1. **QA**: existing `@ch5me/client` tests still pass; new tests for mode dispatch + BYOK <!-- oc:id=item_ai -->
   header buildout; `bun run check-types` in both repos.

### Lane C — box connection dual-mode (W3) <!-- oc:id=sec_ao -->
1. `apps/desktop/src/renderer/services/opencode.ts:1-245`: add `mode` field; retire Basic <!-- oc:id=item_aj -->
   Auth in relay/direct-RSA mode (keep as fallback for the SSH-stub path, gated behind a
   feature flag during migration).
1. New `apps/desktop/src/main/services/firefly-relay-manager.ts` mirroring <!-- oc:id=item_ak -->
   `opencode-manager.ts:50-139`'s shape; lockfile by `runtimeId`.
1. New atoms `relayModeAtom`, `relayTokenStoreAtom` in <!-- oc:id=item_al -->
   `apps/desktop/src/renderer/atoms/connection.ts`.
1. `apps/desktop/src/preload/api.d.ts:740-770` union stays for direct mode; new <!-- oc:id=item_am -->
   `RelayServerConfig` type added.
1. **QA**: existing `connection-manager.ts:58-187` tests still pass; new relay-mode test <!-- oc:id=item_an -->
   in `.sisyphus/evidence/firefly-cloud-seam/w3-relay.mjs` exercising a fake relay.

### Lane D — box discovery + dashboard (W4) <!-- oc:id=sec_ap -->
1. Consume the cloud-side `listBoxes` gap (see `Cloud-Side Dependency Gaps` below). <!-- oc:id=item_ao -->
   If the gap isn't shipped yet, stub the client method and document the cloud-side TODO.
1. New `apps/desktop/src/renderer/components/dashboard/boxes-view.tsx` rendering list of <!-- oc:id=item_ap -->
   boxes; subscribe to relay state SSE/WS; debounce to 1 Hz.
1. `apps/desktop/src/main/services/firefly-client/index.ts` adds `listBoxes`, <!-- oc:id=item_aq -->
   `subscribeBoxes` typed methods.
1. **QA**: dashboard renders mock + real boxes; box-state subscription behaves under <!-- oc:id=item_ar -->
   reconnection; cache invalidation on 401.

### Lane E — entitlement awareness (W5) <!-- oc:id=sec_aq -->
1. Read `entitlements` from `ElfTokenStore.getToken().payload` at app start and on <!-- oc:id=item_as -->
   token-refresh.
1. New atom `entitlementsAtom` in `apps/desktop/src/renderer/atoms/entitlements.ts`. <!-- oc:id=item_at -->
1. **QA**: entitlements surface updates on token refresh; 402/403 `entitlement_required` <!-- oc:id=item_au -->
   routes to `/upgrade`; no entitlement decisions cached across token expiry.

### Lane F — Final verification, commit, and close-out <!-- oc:id=sec_ar -->
1. F1 — Plan compliance: every Must Have item in the plan is implemented and traceable <!-- oc:id=item_av -->
   to a file:line.
1. F2 — Repo reality: every TODO checked here corresponds to a real file:line in the <!-- oc:id=item_aw -->
   resulting diff; no "should land" claims without code.
1. F3 — QA adequacy: full F1–F4 verification wave run, evidence captured under <!-- oc:id=item_ax -->
   `.sisyphus/evidence/firefly-cloud-seam/`.
1. F4 — Scope fidelity: nothing outside the plan landed; no edit to the deprecated <!-- oc:id=item_ay -->
   `elves-auth-client`; no new public `apps/firefly-api` endpoints introduced by this lane.

## TODOs <!-- oc:id=sec_as -->

> Ordered. Each item is atomic. **QA** lines are inline gates; the next item is blocked
> until the gate passes.

- [ ] **T01. Audit `safeStorage` usage + map existing credential store**
  - Read `apps/desktop/src/main/credential-store.ts`,
    `apps/desktop/src/main/ipc-handlers.ts:933-940`,
    `apps/desktop/src/main/settings-store.ts`,
    `apps/desktop/src/main/server-lockfile.ts`.
  - **QA**: written audit at `.sisyphus/evidence/firefly-cloud-seam/t01-credential-audit.md`.

- [ ] **T02. Implement `apps/desktop/src/main/services/auth/vault.ts`**
  - Async `safeStorage.encryptStringAsync`/`decryptStringAsync` wrapper.
  - Refuse boot on Linux `basic_text` in production build.
  - **QA**: unit test for backend detection + refuse path; `bun test --filter vault`.

- [ ] **T03. Implement `apps/desktop/src/main/services/auth/token-store.ts`**
  - `ElfTokenStore` shape mirroring
    `ch5-packages/packages/auth/elf-auth-client/src/browser.ts:10-37`,
    persisted via `vault.ts`.
  - **QA**: unit test for set/get/clearToken + getAuthHeader; `bun test --filter token-store`.

- [ ] **T04. Implement `apps/desktop/src/main/services/auth/device-auth-client.ts`**
  - `requestDeviceCode()` (POST `/api/device-auth/codes`),
    `pollForApproval(code)` (GET `/api/device-auth/codes/:code`, 3 s default, +5 s on
    `slow_down`, surface `access_denied`/`expired_token` to UI), `deny(code)`.
  - **QA**: unit test with mocked fetch + RFC 8628 §3.5 error sentinel mapping.

- [ ] **T05. Implement `apps/desktop/src/main/services/auth/sign-in-to-editor-handler.ts`**
  - Register `firefly-client://` via `app.setAsDefaultProtocolClient`.
  - Parse callback, exchange for `ElfTokenStore` shape, single-use.
  - **QA**: unit test for callback parse + token store handoff.

- [ ] **T06. Wire preload IPC for auth**
  - Add `auth.getState`, `auth.signIn`, `auth.signOut`, `auth.onChange` to
    `apps/desktop/src/preload/api.d.ts` and `apps/desktop/src/preload/index.ts`.
  - **QA**: `bun run check-types`; manual preload surface check.

- [ ] **T07. Build `/login` route + device-auth UI**
  - `apps/desktop/src/renderer/routes/login.tsx` with QR + `user_code` + cancel + error
    sentinel states; `shell.openExternal` for verification URL.
  - Mount on `firefly-client://auth/callback` deep-link auto-resume.
  - **QA**: render check; manual sign-in; capture
    `.sisyphus/evidence/firefly-cloud-seam/w1-signin.png`.

- [ ] **T08. Extend `FireflyRequestOptions` with `mode` + `byok` discriminated union**
  - `firefly-cloud/packages/client/src/api.ts:7-21` add fields; default `mode =
    'managed-relay'` to preserve current callers.
  - **QA**: `@ch5me/client` type-check + existing tests pass; new unit test for mode
    defaulting + discrimination.

- [ ] **T09. Replace `authToken?: string` with `tokenStore?: ElfTokenStore` in `api.ts` + `trpc.ts`**
  - `buildHeaders` (`api.ts:255-274`) reads `tokenStore.getAuthHeader()` when present;
    falls back to existing `x-alpha-key` for non-`@ch5me/client` callers.
  - `trpc.ts:1-73` constructor takes `tokenStore`; `httpBatchLink` Bearer header set.
  - **QA**: unit test for header construction; integration test against a stubbed
    `ElfTokenStore`.

- [ ] **T10. Centralise `apiUrl` resolution**
  - Extract `resolveApiUrl({ mode, tokenStore, byok, env })` in
    `firefly-cloud/packages/client/src/api.ts:234-253` + `trpc.ts:12-49`.
  - **QA**: unit test for both modes; env precedence rules documented.

- [ ] **T11. Palot local service `firefly-client/index.ts`**
  - Owns singleton `@ch5me/client` instance + `ElfTokenStore`.
  - Typed methods: `provisionStatus`, `listenProvisioningStatus`, `listBoxes`,
    `signInStatus`, `signOut`, `getEntitlements`.
  - **QA**: `bun run check-types`; unit test for method delegation.

- [ ] **T12. Env validation via `@t3-oss/env-core` + Zod**
  - Per-mode base URLs; main process from Hush injection; renderer `VITE_FIREFLY_API_URL`;
    `emptyStringAsUndefined: true`; `runtimeEnvStrict`.
  - **QA**: boot fails fast on missing required vars; tests cover schema.

- [ ] **T13. Retire Basic Auth in `opencode.ts` relay/direct-RSA mode**
  - `apps/desktop/src/renderer/services/opencode.ts:1-245` `connectToServer` gains
    `mode: 'opencode-direct' | 'firefly-relay'`. Direct path uses RS256 delegated token
    (fetched from `POST /api/firefly-auth/token?subApp=portable-opencode`), cached in
    memory, refreshed at `exp - 60s`. SSH-stub path keeps Basic Auth gated behind a
    feature flag during migration.
  - **QA**: type-check; existing connection tests still pass; new test for token refresh
    + 401 retry.

- [ ] **T14. Implement `firefly-relay-manager.ts`**
  - Mirrors `opencode-manager.ts:50-139` `ensureX/getXStatus` shape; lockfile by
    `runtimeId`. Consumes `listenRuntimeProvisioningStatusChecked` (`api.ts:758-831`),
    falls back to `getRuntimeProvisioningStatusChecked` (`api.ts:721-736`).
  - **QA**: unit test for relay state transitions; lockfile-by-`runtimeId` test.

- [ ] **T15. New atoms `relayModeAtom` + `relayTokenStoreAtom`**
  - `apps/desktop/src/renderer/atoms/connection.ts`. **Do not** overload
    `authHeaderAtom` (Basic-Auth-shaped, must stay unchanged for direct-mode migration).
  - **QA**: type-check; render-time check.

- [ ] **T16. Renderer-side "where is my box" discovery**
  - `apps/desktop/src/renderer/services/firefly-client.ts` wraps palot-local service.
  - On session resume, call `listBoxes`; render empty / loading / error / populated
    states.
  - **QA**: render with mock + real data; `.sisyphus/evidence/firefly-cloud-seam/w4-listboxes.png`.

- [ ] **T17. Dashboard `boxes-view.tsx`**
  - `apps/desktop/src/renderer/components/dashboard/boxes-view.tsx`; subscribe to
    `subscribeBoxes`; debounce renderer updates to 1 Hz. Per-box primary action:
    `Open`, `Restart`, `View logs`. "Set up a box" CTA for dead / unregistered.
  - **QA**: render with 0 / 1 / many boxes; reconnect under network drop.

- [ ] **T18. Main-process cache + invalidation**
  - SQLite (or `electron-store` fallback) keyed by `elfUserId`; 5 min TTL foreground, 60 s
    background; 401 → invalidate + drop to sign-in.
  - **QA**: unit test for cache TTL + 401 invalidation; manual check.

- [ ] **T19. Entitlement atom + claim-shape**
  - `apps/desktop/src/renderer/atoms/entitlements.ts`; refresh on token refresh; 402/403
    `entitlement_required` routes to `/upgrade`.
  - **QA**: entitlement values update on token refresh; "Reconnect to verify" soft-fail
    on `expired_token`.

- [ ] **T20. Cross-cutting: token never in renderer**
  - Preload surface = function calls only; no `auth:get-token` IPC; `authHeaderAtom`
    stays Basic-Auth-shaped for the SSH-stub fallback path only.
  - **QA**: grep for `ipcRenderer.invoke.*token` returns no renderer-side handlers;
    code-review sign-off.

- [ ] **T21. Linux `basic_text` policy**
  - Hard error on first launch if `safeStorage.getSelectedStorageBackend() === 'basic_text'`
    in production build; dev build shows explicit warning + opt-in.
  - **QA**: manual boot on a Linux VM with no keyring; manual boot on Linux with
    keyring.

- [ ] **T22. Documentation**
  - Update `docs/firefly-surface-playbook.md` to reference the seam.
  - Add `docs/firefly-cloud-auth-connection-seam.md` describing the
    signer-side / verifier-side / relay-side / BYOK-direct state machine.
  - **QA**: docs build; links resolve.

- [ ] **T23. End-to-end smoke**
  - Manual: sign in via device code → connect via relay → call a box runtime endpoint
    → see box in dashboard → sign out.
  - Manual: switch to BYOK-direct in dev config → connect to a locally-provisioned
    portable-opencode box → confirm token verify via JWKS, **not** Basic Auth.
  - **QA**: log capture + screenshot bundle in
    `.sisyphus/evidence/firefly-cloud-seam/`.

## Final Verification Wave F1–F4 <!-- oc:id=sec_at -->

- [ ] **F1. Plan compliance**
  - Every Must Have item in this plan has a file:line in the resulting diff.
  - No unchecked Must Have in the final state.
  - **Evidence**: `.sisyphus/evidence/firefly-cloud-seam/f1-plan-compliance.md`.

- [ ] **F2. Repo reality**
  - Every TODO T01–T23 is implemented in the resulting diff.
  - No "should land" claims without code.
  - **Evidence**: `.sisyphus/evidence/firefly-cloud-seam/f2-repo-reality.md`
    with file:line per TODO.

- [ ] **F3. QA adequacy**
  - `bun run lint`, `bun run check-types`, `bun test`, `bun run build` all green.
  - Manual smoke artifacts captured (sign-in screenshot, relay-state log, dashboard
    screenshot, BYOK-direct JWKS-verify log).
  - **Evidence**: `.sisyphus/evidence/firefly-cloud-seam/f3-qa-adequacy.md`.

- [ ] **F4. Scope fidelity**
  - No edits to the deprecated
    `firefly-cloud/packages/elf-auth-client/elves-auth-client/` copy.
  - No new public client APIs on `apps/firefly-api` from this lane.
  - No `cloud-agent` / `cloud-agent-next` RS256 migration in scope
    (`docs/elf-auth-topology.md:104-106` — separate lane).
  - No client-side user-input API key UI in v1.
  - **Evidence**: `.sisyphus/evidence/firefly-cloud-seam/f4-scope-fidelity.md`
    with diff-stat + grep proof.

## Commit Strategy <!-- oc:id=sec_au -->

- One commit per lane (A–F) for the palot side.
- Lane B (the `@ch5me/client` extension) ships as a separate PR against
  `firefly-cloud`, reviewed and merged **before** Lane C is opened.
- Lane F close-out commit includes the F1–F4 evidence files under
  `.sisyphus/evidence/firefly-cloud-seam/`.
- Commit messages follow `git-master` skill conventions
  (`docs(firefly-seam): …`, `feat(client): dual-mode api options`, etc.).
- No merge commits; rebase or squash.

## Success Criteria <!-- oc:id=sec_av -->

1. `/login` route renders; device-auth flow completes; token lives in main-process <!-- oc:id=item_az -->
   `safeStorage`; renderer never sees raw token.
1. `@ch5me/elf-auth-client` (from `ch5-packages`) is the **only** RS256 verifier in <!-- oc:id=item_ba -->
   palot's call paths; the deprecated `elves-auth-client` copy is untouched.
1. `@ch5me/client` accepts `mode: 'managed-relay' | 'byok-direct'` + `tokenStore?`; both <!-- oc:id=item_bb -->
   `api.ts` and `trpc.ts` thread the `ElfTokenStore` correctly.
1. Direct mode in `opencode.ts` no longer uses Basic Auth in the relay / direct-RSA <!-- oc:id=item_bc -->
   path; SSH-stub path remains Basic Auth behind a feature flag during migration.
1. Dashboard renders the account's boxes with live state subscription; 1 Hz debounce; <!-- oc:id=item_bd -->
   cache invalidates on 401.
1. `entitlementsAtom` reflects the latest token claim; UI soft-fails premium features <!-- oc:id=item_be -->
   on `expired_token`; 402/403 `entitlement_required` routes to `/upgrade`.
1. F1–F4 evidence files exist and are non-empty. <!-- oc:id=item_bf -->
1. Cloud-Side Dependency Gaps list is complete; a firefly-cloud lane can pick each item <!-- oc:id=item_bg -->
   up as an isolated, reviewable change.

---

## Cloud-Side Dependency Gaps

> These are the firefly-cloud work items this plan depends on. They are **not** part of
> the palot client seam; a separate `firefly-cloud` lane should pick them up so the
> client plan can close cleanly. Where applicable, file:line cites are from the
> completed cloud-endpoint audit and the ch5-company seam-audit docs.

### CG1. Client-facing "locate-my-box" / `listBoxes` API
- **Why**: palot's "where is my box" + dashboard enumeration (W4) needs a typed API;
  `apps/firefly-api` has no first-class user-facing endpoint that takes a userId and
  returns boxes. The canonical SQL-backed helpers live in
  `apps/web/src/lib/elf/instance-registry.ts` (`getActiveInstance`,
  `getInstanceById`) and are only exposed through tRPC + Next.js.
- **Suggested shape** (lane to confirm): new tRPC procedure on
  `apps/web/routers/cloud-agent-next-router.ts` that returns
  `{ runtimeId, runtimeKind, lastHeartbeatAt, observedState, desiredState, capabilities,
  imageDigest, region, runtimeAuthToken (caller-asserted) }`. **Do not** add to
  `apps/firefly-api` — it is internal-only per `auth/admin-rbac.ts` route policy.

### CG2. Box-gateway token verification (delegated RS256)
- **Why**: W3 BYOK-direct + relay-mode verification depends on the box accepting
  `Authorization: Bearer <rs256-delegated-token>` and verifying against
  `services/auth/src/jwks.handler.ts:1-70`. Today the box's auth middleware
  (`services/firefly-runtime/src/auth/middleware.ts:1-104`) only accepts its own
  JWT+pepper scheme; it does not consume `ElfTokenStore` claims.
- **Suggested work**: extend `services/firefly-runtime/src/auth/middleware.ts` to
  accept a `mode === 'delegated'` JWT verified via the existing JWKS endpoint, with
  the same pepper-revocation path.

### CG3. Pepper-revocation guarantee on RS256 tokens
- **Why**: the public verifier at
  `firefly-cloud/packages/elf-auth-client/elves-auth-client/index.js:28-32` already
  supports `getCurrentPepper` for revocation parity, but the **ch5-packages**
  `@ch5me/elf-auth-client` package needs the same hook shipped and documented. Without
  it, pepper rotation does not invalidate outstanding RS256 tokens.
- **Suggested work**: confirm `ch5-packages/packages/auth/elf-auth-client/src/index.ts:1-59`
  exposes `getCurrentPepper` and document its contract against
  `firefly_users.api_token_pepper` (same column
  `services/firefly-runtime/src/auth/middleware.ts:63-66` validates against).

### CG4. Resolve the `elfUserId` vs `fireflyUserId` schema drift
- **Why**: the audit caught a doc-vs-schema drift: `docs/elf-auth-topology.md:99` documents
  `payload.elfUserId`, but the actual zod schema in
  `packages/elf-auth-client/elves-auth-client/types.d.ts:1-56` uses
  `payload.fireflyUserId`. Palot's reader code (W2) must read `fireflyUserId` to match
  the wire shape.
- **Suggested work**: pick one canonical field name; rename in
  `ch5-packages/packages/auth/elf-auth-client/src/types.ts:1-38`; update the verifier,
  the React provider, and `services/session-ingest/src/middleware/firefly-jwt-auth.ts:2-98`
  consumer in lock-step.

### CG5. `cloud-agent` + `cloud-agent-next` RS256 migration
- **Why**: `docs/elf-auth-topology.md:104-106` documents migration debt:
  `services/cloud-agent` and `services/cloud-agent-next` still verify upstream-shaped
  HS256 and read `payload.fireflyUserId`. They are not the same audience as
  `@ch5me/elf-auth-client`, but they share the schema field.
- **Suggested work**: a separate lane to migrate both services to RS256 + JWKS. Not
  in this plan's scope, but flagged so the schema-rename in CG4 doesn't break them.

### CG6. Staging public API alias binding
- **Why**: `api.staging.elf.dance` is unresolved per `docs/elf-auth-topology.md:70` and
  `docs/portable-opencode-handoff.md:188`; live operator traffic still hits
  `https://firefly-api-staging.hassoncs.workers.dev`. Palot's staging smoke (Lane F) needs
  this resolved to validate the seam against real staging.
- **Suggested work**: bind the alias to the staging worker; document the
  `AUTH_HOST_MAP` (`packages/runtime-config/src/firefly-auth-host-map.js`) override.

### CG7. Short-lived editor-handoff token (optional, future)
- **Why**: today `/sign-in-to-editor` mints the long-lived 5-yr HS256
  (`apps/web/src/lib/tokens.ts:81-87`) and ships it in the URL query string. This is
  not a v1 blocker for the seam (Lane A consumes it as-is), but the production-grade
  path is a separate `generateShortLivedEditorToken` mint.
- **Suggested work**: separate plan, separate lane.

### CG8. `/internal/runtimes` RBAC gating
- **Why**: `apps/firefly-api/src/index.ts:3236-3243` exposes `GET /internal/runtimes`
  with no explicit auth; it relies on the elf runtime worker being the only caller.
  Palot must **not** call this from a user context. CG8 documents the cloud-side
  hardening work: gate this route with a worker identity (Cloudflare service binding
  or shared secret) so a future mistake doesn't leak cross-account data.
- **Suggested work**: add RBAC / service-binding gate; document the boundary.

### CG9. Portable-opencode staging smoke
- **Why**: the portable image is built behind a Firefly-owned
  `Dockerfile --target portable-compatible`
  (`docs/portable-opencode-runtime-target-contract.md:60-138`); palot's smoke needs a
  known-good staging image + provision path.
- **Suggested work**: stage the `FLY_PORTABLE_IMAGE` override
  (`services/firefly-runtime/wrangler.staging.jsonc:1-52`) and run the staging proof
  scripts (`scripts/verify-portable-staging-contract.mjs`,
  `scripts/staging-portable-proof.mjs`) end-to-end before Lane F closes.