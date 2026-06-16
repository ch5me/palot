# Firefly Plugin Marketplace — Signed Third-Party MVP Plan

## 1. Goal & Definition of Done

**Customer story (definition of done):** A real customer downloads a real **signed + keyed third-party CODE extension** (not just a theme), and it **just works** — trusted (`trustTier=signed-third-party`), capabilities consented (deny-by-default grants persisted), and it **ACTUALLY EXECUTES** (its `activate()` runs and a tool/command it registered returns real data) — on **BOTH** the Electron build and the Web build, across the published plugin architecture.

**"Done" = the E2E proof on both builds:**
- **Electron:** install → `derivePackageTrust` yields `signed-third-party` → consent dialog result persists `granted/user` rows → enable → worker spawns, receives `activate`, posts `activated` → `invokePluginTool` routes across the worker boundary → extension code runs and returns data. Proven by a single-process integration test (real `worker_threads`, no GUI).
- **Web:** the same fixture resolves to `cloud-host`, installs/invokes via the §16 RPC contract against `firefly-cloud`. Contract-level proof lands in-repo (faked `fetchFn`); the live-server leg is gated on the firefly-cloud stream (D).

The **Electron customer story closes entirely in-repo** (streams A + B + C + E). **Web** adds the cross-repo `firefly-cloud` server (stream D).

---

## 2. Locked Decisions

**CH5 holds the marketplace/registry signing authority — the "Microsoft role."** This is the VS Code marketplace **repository-signing** model, faithfully reproduced:

- **Two-tier signature. The REGISTRY (repository) signature is load-bearing.** `firefly-cloud` signs every served package with the CH5 marketplace key; palot bakes the **public** key as a committed trust anchor, so a downloaded package derives `trustTier=signed-third-party`. Per-publisher "verified publisher" badges = the **same** detached-signature mechanism with more `keyId`s — **POST-MVP**.
- **Algorithm = ed25519.** First-class path in `signature-verify.ts` via `crypto.verify(null, data, key, sig)` (no pre-hash; ed25519 hashes internally).
- **Key identity = a MAP.** Client holds `keyId → public PEM`. Sign with the **newest** keyId; old keyIds stay valid until **explicitly revoked**. A **revoked-set** is honored everywhere (revocation beats presence).
- **Private signer → repo-local Hush** (`FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY`); **public → committed trust anchor** (non-secret). Dev/staging signer + stage-split Hush files (`dev`/`staging`/`prod`) is a **tracked hardening task** — today only the prod signer exists.
- **No silent fallbacks anywhere (CH5 fail-fast).** A present-but-invalid signature is a hard `integrity_mismatch` — **never** downgraded to a lower trust tier.

**Already minted this session (real, in the repo):**

| Item | Value |
|---|---|
| keyId | `firefly-registry-root-2026` |
| algorithm | ed25519 |
| fingerprint | `sha256:88603741da3fc2bed2de2be603024c64a81de023a1ac1e01d17b427f6559ab5d` |
| private key | repo-local Hush secret `FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY` (PKCS#8 PEM, 118 chars, confirmed) |
| public anchor | committed at `apps/desktop/src/shared/firefly-plugin/trust-anchors/firefly-registry-root-2026.pub.pem` (SPKI ed25519) |
| mint/rotate helper | `scripts/mint-plugin-signing-key.mjs` (writes `<keyId>.pub.pem`, stores private in Hush, prints fingerprint) |

---

## 3. Work-Streams

> Conventions: paths under `apps/desktop/src/...` unless noted. firefly-cloud paths are in the separate repo `/Users/hassoncs/src/ch5/firefly-cloud`. Each task is a discrete, independently-committable unit: **files**, **contract/signature**, **unit test**, **what it unblocks**.

### Stream A — Signing / PKI / Trust

**Ground truth (verified):** `verifyDetachedSignature` / `derivePackageTrust` are real and fail-fast (`signature-verify.ts:84-122`, `:150-211`) — they just need real `signature`, `publicKeyPem`, and `data` fed in. The break is `install-orchestrator.ts:343-348` (`signature:null, publicKeyPem:null, data:Buffer.alloc(0)` → always `unsigned-third-party`). The VSIX content hash already exists (`package-store.ts:196` `contentSha256 = sha256Hex(vsixBytes)`). Schema has `extension_packages.signature_state` (`schema.ts:58`) and `extension_installations.trust_tier` (`schema.ts:87`) but **no** columns for keyId/sig/algo/digest. The minted anchor is confirmed on disk.

**A6 (pre-req) — Resolve the `SignatureState` union drift.** Code union is `"unsigned" | "verified" | "unverified"` (`signature-verify.ts:67`); design §7.1 (`design:353`) uses `"verified" | "missing" | "failed" | "not-applicable"`. Pick ONE union, update `signature-verify.ts`, `schema.ts`, `extension-store.ts`. **Lands before A2** (or A2 absorbs it). Touches `signature-verify.ts` + `schema.ts` + `extension-store.ts`.

**A1 — Client trust-anchor registry + loader.** New: `shared/firefly-plugin/trust-anchor-registry.ts` (+ `.test.ts`), plus `trust-anchors/index.ts` (build-time-baked literal/generated `Record<keyId, pem>` — **no runtime `fs`**, renderer/web have none).
- Contract: `TrustAnchor { keyId; publicKeyPem; algorithm:"ed25519"; fingerprintSha256; devOnly }`; `TrustAnchorRegistry { resolve(keyId): string|null; get(keyId): TrustAnchor|null; isRevoked(keyId): boolean; trustedKeyIds(): readonly string[] }`; `createTrustAnchorRegistry(opts)` + `createDefaultTrustAnchorRegistry({ packaged? })`. `resolve()` precedence (fail-fast): revoked → `null`; `packaged && devOnly` → `null`; unknown → `null`; else PEM. Fingerprint via `createPublicKey(pem).export({type:"spki",format:"der"})` → sha256 hex.
- Test: resolves committed key + fingerprint `sha256:8860374…9ab5d`; unknown → null; revoked excluded; `devOnly` suppressed when `packaged:true`; malformed PEM throws at construction.
- Unblocks: A2 key resolution, revocation enforcement, future multi-keyId "verified publisher."

**A2 — Install wiring: feed real signature + key + bytes into `derivePackageTrust`.** Touch: `install-orchestrator.ts:225-409`, `extension-store.ts:32-127` (+ types), new Drizzle migration + `schema.ts:36-68`. New sibling helper `install/detached-signature.ts` (so A1/A2 don't fight over orchestrator hunks).
- A2a — Signed bytes: **prefer the orchestrator-local download Buffer at `:267`** (avoids changing `package-store.ts`); local-vsix reads via `io.readFileSync(vsixPath)`.
- A2b — Replace `:343-348`: `resolveDetachedSignature({ registryMeta, unpackedPath, io })` → open-vsx reads served signing metadata; local reads a `<vsix>.sig.json` / `extension/.signature` sidecar; absent → `null`. `registry.resolve(detached.publisherKeyId)` → PEM. `derivePackageTrust({ source, signature, publicKeyPem, data: signedBytes })`. Add `trustAnchorRegistry?` to `InstallExtensionOptions` (`:198-212`) for test injection.
- A2c — Persist provenance. Migration adds `publisher_key_id`, `signature_algorithm`, `signature_b64`, `signed_digest` to `extension_packages`. Behavior table: sig+known+valid → `verified`/`signed-third-party` + persist; **present-but-invalid → throws `integrity_mismatch`, nothing written, install aborts**; unknown/revoked key → `unverified`/`unsigned-third-party`; no sig → `unsigned`/`unsigned-third-party`.
- Test (extend `install-orchestrator.test.ts`): signed+known+valid → `verified`/`signed-third-party`, keyId persisted; tampered → rejects `integrity_mismatch`, store fn **not called**; unknown key → `unverified`, no throw; unsigned → `unsigned`.
- Unblocks: trust derivation for the customer story; feeds C (consent reads `trust.trustTier`) and E2.
- **Depends on A1 + A3 contract + A4 fixtures.**

**A3 — Publish-side signing contract.** New shared types `shared/firefly-plugin/registry-signature-contract.ts` + design `§16.x`. **DECISION: sign the raw VSIX/FPK file bytes** (the same bytes whose sha256 is `contentSha256`). One canonical artifact; client already holds the exact Buffer.
- `ServedSignatureMetadata { publisherKeyId; algorithm:"ed25519"; signatureB64; signedContentSha256 }`; maps 1:1 to client `DetachedSignature { algorithm, signatureB64, publisherKeyId }` (`signature-verify.ts:51-57`). Client cross-checks `signedContentSha256 === sha256Hex(vsixBytes)` before verify (mismatch → hard fail).
- Server routine: `priv = createPrivateKey(hush get FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY)` → `crypto.sign(null, vsixBytes, priv)` → base64; `publisherKeyId = ACTIVE_KEY_ID` (newest non-revoked).
- **Hard invariant (both repos):** `sign(vsixBytes)` server-side, `verify(vsixBytes)` client-side — byte-identical Buffers. Never sign a digest string while verifying raw bytes. Encode as a one-line comment in `signature-verify.ts` and the cloud signer.
- Unblocks: A2b field reads, A4 CLI, D-C3 publish.

**A4 — Signing CLI/helper for fixtures + E2E.** New `scripts/sign-plugin-package.mjs` + committed `apps/desktop/src/main/firefly-plugin/install/__fixtures__/signed/`.
- CLI: `--in <pkg>`, `--out`, `--key-id`, `--hush-key FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY`, `--ephemeral` (throwaway ed25519, emit pubkey via `--anchor-out` for CI — no prod secret in CI). Default: prod signer from Hush, never prints private key. Same `crypto.sign(null, bytes, priv)` as A3.
- Fixtures: `theme-pkg.vsix` + `.sig.json` + `.ephemeral.pub.pem`; a **tampered** pair (`theme-pkg.tampered.vsix` + same sig) driving A2 test #2. Smoke test: `verifyDetachedSignature` → `verified:true` for clean, `false` for tampered.
- Unblocks: A2 unit tests, the E2E signed-fixture, manual prod publish.

**A5 — Rotation + revocation runbook.** New `trust-anchors/README.md` (or `.llm/wiki/firefly-plugin-signing.md`). Specifies: multi-keyId map model; rotation via `mint-plugin-signing-key.mjs --key-id firefly-registry-root-<year>` → regen `trust-anchors/index.ts` → flip server `ACTIVE_KEY_ID` (old keyId stays trusted = zero-downtime); revocation = add to `revokedKeyIds`/`revoked-keys.json` (config, **not** file deletion — keep for forensics), re-sign affected packages; dev/staging/prod signer split with `devOnly` anchors; fingerprint cross-check (record `sha256:…` per keyId).

> **Note:** E2 (stream E) independently specifies a `trust-anchors.ts` loader and `install-orchestrator.ts:343-348` rewire. **This is the SAME work as A1 + A2** — they are unified in the swarm plan as the single A1/A2 owner. Do not implement twice.

**Stream A build order:** A6 → (A1 ∥ A3 ∥ A4 ∥ A5) → A2.

---

### Stream B — Electron live execution (activation, worker SDK, dispatch routing, bundle)

**Audit:** `worker-supervisor.ts` `spawn()` (`:281-373`) wires `onMessage`/`onExit`/`onError` but **never posts `activate`** — the `activate` arm exists (`extension-host-protocol.ts:96-101`) with no producer. Fixtures self-post `ready`, masking the gap. `dispatch.ts` `invokePluginCommand` (`:143-206`) / `invokePluginTool` (`:247-334`) only call in-process handlers (built-ins), no worker routing. `worker-request-handler.ts` (storage/capability RPC) already landed and is reachable via `onWorkerRequest`. `build-plugins.ts:136-144` already emits `worker.mjs` but no extension ships one and no SDK wraps raw `parentPort`.

**B1 — Activation handshake + lifecycle send path.** Touch `worker-supervisor.ts` `spawn()` (`:281-373`); append to `extension-host-protocol.ts` (additive only).
- Append `workerToHostMessageSchema` arm: `{ type:"activated", pluginId, registeredCommands:[], registeredTools:[] }`. Keep `ready` as transport-up; **`activated` flips lifecycle to `active`** and seeds the dispatch routing table. Post `activate` after `entry.worker = worker` (~`:302`): `worker.postMessage({ type:"activate", pluginId, grantedCapabilities, sessionScope })`. Add `resolveActivation?` to `PluginWorkerSupervisorOptions` (`:107`); wire from `grant-store.ts` `resolveGrantedTokens({pluginId, scope:"session"})` in `supervisor-boot.ts`.
- `onMessage` (`:316-331`): `case "activated":` → `activationSucceeded` + stash registered ids for B3; `case "ready":` → no-op/log (do **not** flip active on bare `ready`). No-`activated`-within-`hangTimeoutMs` → existing `scanForHangs` (`:417-429`) → `failed`+backoff restart ("reload-required"); crash → `activationFailed`. No new states.
- Test (`worker-supervisor.test.ts`): exactly one `activate` posted on spawn with grants/scope; lifecycle stays `activating` until fake replies `activated`; a fake that only replies `ready` is driven to `failed` by `scanForHangs()`.
- **Lands first (interface commit)** so B3 compiles against the new supervisor surface.

**B2 — Worker-side runtime + extension SDK** (all NEW, **no `electron`/`worker_threads` imports** — reused by web/cloud-host).
- `main/firefly-plugin/extension-worker-runtime.ts`: `runExtensionWorker({ port, importMain })`. On `{type:"activate"}` → `await importMain()` → build `ExtensionContext` → `await mod.activate(ctx)` → collect registered ids → post `{type:"activated",…}`. `activate()` throw → `{type:"fatal"}` (fail-loud, no silent ready). `{type:"invoke-command"|"invoke-tool"}` → run handler → `{type:"invoke-result", requestId, ok, data}` (unknown id → `ok:false, errorCode:"handler_not_found"`). `deactivate` → `mod.deactivate?.()` then exit.
- `shared/firefly-plugin/sdk/index.ts`: VS Code-modeled `ExtensionContext { pluginId; grantedCapabilities; sessionScope; registerCommand; registerTool; storage{get/set/delete/list}; capabilities{request} }`; `CommandHandler`/`ToolHandler`; `ExtensionModule { activate; deactivate? }`.
- `shared/firefly-plugin/sdk/host-bridge.ts`: promise-correlated RPC over `parentPort` — `requestId = crypto.randomUUID()`, post `storage-request`/`capability-request`, resolve on matching `…-response`. Worker-side mirror of the landed host `worker-request-handler.ts`.
- Test (`extension-worker-runtime.test.ts`): fake port + `importMain` whose `activate` calls `registerCommand("c1")` → `activated` with `registeredCommands:["c1"]`; `invoke-command` → `invoke-result ok:true`; throwing `activate` → `fatal`, no `activated`; `storage.get` posts `storage-request` and resolves on response.

**B3 — Dispatch routing to the live worker.** Touch `dispatch.ts` (`invokePluginCommand` `:175-184`, `invokePluginTool` `:305-314` — the "no host handler" branch); new `main/firefly-plugin/worker-invoke-router.ts`.
- `WorkerInvokeRouter { isWorkerBacked(pluginId); invoke({pluginId, kind, targetId, args, sessionId, timeoutMs?}): Promise<{ok:true;data}|{ok:false;errorCode;errorMessage}> }`; `setWorkerInvokeRouter` / `getWorkerInvokeRouter`. Live router checks B1's supervisor (`runtimeResolution.location === "electron-utility"` **and** summary `state === "active"`), generates `requestId`, calls B1's `sendInvoke`, resolves on the supervisor's `invoke-result` arm, rejects `worker_invoke_timeout` after `timeoutMs`.
- **Dispatch edit (deny-by-default preserved):** insert **after** the `decideCapabilityAll` broker check (`:159-174`/`:276-291`) and **before** in-process `handlers.get`. Built-ins (non-`electron-utility`) fall through unchanged.
- Test (`dispatch.test.ts`): fake router → worker-backed invocation calls `router.invoke` (not in-process), `{ok:true}`→`completed`, `{ok:false}`→`failed`; **denied capability still returns `denied`, router never called** (broker first); built-in still hits in-process handler.

**B4 — Real worker bundle for a third-party CODE extension.** Touch `scripts/build-plugins.ts` (`:136-144`, add SDK alias); new `apps/desktop/plugins/<example-code-ext>/` (`manifest.json` non-built-in, `runtime.hostKind:"node-worker"`, `runtime.webStrategy:"cloud-host"`) + `worker/index.ts`.
- `worker/index.ts` is a thin entry: `import { runExtensionWorker } from "<bundled runtime>"; import * as ext from "./extension"; runExtensionWorker({ port: parentPort, importMain: async () => ext })`. Bundle runtime + SDK **into** `worker.mjs` (first-party → leave `external:[]`). Result: self-contained `out/plugins/<id>/worker.mjs` discovered at `<resources>/plugins/<id>/worker.mjs`.
- Test: build the example into a temp out-root; assert `worker.mjs` exists, is valid ESM, and (via B2's `runExtensionWorker` + fake port) completes `activate`→`activated` and answers one `invoke-command`.

> **Web note (out of B scope, flagged for stream D):** `runtime-location.ts:144-145` resolves `node-worker` on web → `cloud-host`. B2/B3 are transport-agnostic; the **same** runtime/SDK/router serve the firefly-cloud remote host. Keep B2/B3 free of `electron`/`worker_threads`.

> **Unification note:** Stream E (E1.2/E1.3/E2.1/E2.2/E2.3) describes the same worker-SDK + activation + dispatch-routing work using slightly different names (`worker-sdk.ts`, `defineExtension`, `ready` vs `activated`). **B is canonical for the runtime/protocol shape.** The one substantive design choice to lock before impl: **`activated` (B1) vs bare `ready` (E) as the lifecycle-active trigger** — adopt B1's `activated` (richer: carries the registered-id table dispatch needs). E's `acme.disk-example` fixture (§E1) is the concrete extension that B4 generalizes; build ONE fixture, not two.

---

### Stream C — Consent threading + grant persistence

**Audit:** Renderer dialog is wired but its result is dropped — `marketplace-panel.tsx:509-517` discards `approved` (L513-515 TODO); mutation input (`:271`) has no `consentedCapabilities`. Preload forwards `input` verbatim (`preload/index.ts:270-271`) → adding the field to the type threads through with **zero preload-logic change**. IPC `installArgsSchema` (`ipc.ts:161-173`) strips unknown keys. `host-authority.ts:267-300` `installExtension` calls the orchestrator with **no `options`** → `grantStore` undefined. Orchestrator persistence is gated on `options.grantStore` (`install-orchestrator.ts:381-389`), which is never passed; the boot resolver's resolved `GrantStore` is **discarded** at `index.ts:337`. `persistInstallGrants` **already accepts** `consentedCapabilities` (`install-orchestrator.ts:66,75`) and `consentPlanToGrantRecords` honors it (`install-consent.ts:94,112-126`) — only the wiring is missing. Deny-by-default in dispatch already holds (`dispatch.ts` `defaultGrantResolver` `:48-54`).

**C1 — Add `consentedCapabilities` to the install contract.** Touch `shared/firefly-plugin/host-authority-types.ts` (`MarketplaceInstallInput` `:169-178`), `preload/api.d.ts` (`:906-913`), `ipc.ts` (`installArgsSchema` `:161-173`).
- Both `MarketplaceInstallInput` gain `consentedCapabilities?: readonly string[]`. In `ipc.ts`, add `consentedCapabilities: z.array(z.string().min(1).max(200)).max(200).optional()` to **both** union members (preserve discriminated-union narrowing). **Extract+export `installArgsSchema`** so it's unit-testable. No preload edit.
- Test (`ipc-install-args.test.ts`): open-vsx input with `["fs:write"]` parses + retains; absent → `undefined`; non-string rejected.

**C2 — Inject the host grantStore.** Touch `grant-store.ts`, `index.ts:337`, `host-authority.ts:267-300`.
- `grant-store.ts`: add lazily-cached `getHostGrantStore(): Promise<GrantStore>` (mirrors `getPluginStorageService`); refactor `installPluginGrantResolver` (`:85-90`) to resolve via it → **one** store instance shared by boot resolver + install path.
- `host-authority.ts` `ElectronHostAuthority.installExtension` (`:290`): `const grantStore = await getHostGrantStore(); installExtension(installInput, { grantStore, consentedCapabilities: input.consentedCapabilities })`.
- Test (`grant-store-host-singleton.test.ts`): `getHostGrantStore()` referentially stable across calls (in-memory libsql, `freshGrantStore` pattern).

**C3 — Thread the approved set: dialog → IPC → host-authority → orchestrator → `persistInstallGrants`.** Touch `install-orchestrator.ts` (`InstallExtensionOptions` `:198-212`, grant block `:381-389`), `host-authority.ts` (covered by C2), `marketplace-panel.tsx` (`:271`, `:289-296`, `:509-517`).
- Orchestrator: add `consentedCapabilities?: readonly string[]` to options; pass into `persistInstallGrants({ … consentedCapabilities: options.consentedCapabilities })` (keep the `if (options.grantStore)` gate).
- Renderer: widen mutation input to `{ namespace; name; version; consentedCapabilities? }`; pass into `getMarketplaceBridge().install({ kind:"open-vsx", …, consentedCapabilities })`; **resolve the L513-515 TODO** — `onResolve` passes `consentedCapabilities: approved`. No-capability fast path leaves it `undefined`.
- Test (`install-orchestrator-consent-thread.test.ts`): `installExtension(localVsixInput, { grantStore, consentedCapabilities:["fs:write"], io, store })` with a fabricated VSIX declaring `contributes.capabilities:["fs:write"]` → `resolveGrantedTokens` includes `fs:write` (`granted/user`); a non-consented declared capability stays `prompt-required`.

**C4 — Consent↔dispatch invariant (TEST ONLY — no `dispatch.ts` edit).** New `grant-consent-dispatch.test.ts`.
- Fresh in-memory grant store → `persistInstallGrants` for a `signed-third-party` plugin declaring `["fs:write","net:http"]` with `consentedCapabilities:["fs:write"]` → build resolver via `createDbGrantResolver(store)` → assert `fs:write` present, `net:http` absent. Optionally feed both into `decideCapabilityAll` (`trust:"signed-third-party"`) → `granted:true` for `["fs:write"]`, `false` for `["net:http"]`.
- Unblocks: the "consented executes, non-consented denied" half of done.

> **C↔B `dispatch.ts` collision:** Stream C must **NOT edit `dispatch.ts`** — it reads the stable seams (`setGrantResolver`/`createDbGrantResolver`/`GrantResolver`, `decideCapabilityAll`). **B is the sole writer of `dispatch.ts`.** > **C↔A `install-orchestrator.ts`:** A2 owns the signature block + `InstallExtensionOptions` signature additions; C owns the `:381-389` grant block + the `consentedCapabilities` option. These are adjacent — **serialize: A2 lands `InstallExtensionOptions` shape first, C rebases onto it** (see §5). > **C↔D `host-authority.ts`:** C edits **only** `ElectronHostAuthority.installExtension`; D edits **only** `CloudHostAuthority`. Disjoint methods, same file — sequence/flag.

---

### Stream D — firefly-cloud server + palot web projection cache

**Repo located:** `firefly-cloud` EXISTS at `/Users/hassoncs/src/ch5/firefly-cloud` (`firefly-monorepo`, pnpm@9.15.9, node 24). **No scaffold needed.** Shape: `apps/firefly-api/` = Hono on Cloudflare Workers (D1 `c.env.DB`, Durable Objects `WS_GATEWAY`/`WsGatewayDO`, Drizzle, Zod); entry `apps/firefly-api/src/index.ts` mounts routes on one `Hono<AppEnv>` with global auth middleware (where `POST /firefly-plugin/rpc` lands). `packages/plugin/` is a stub — natural home for the shared host module + types mirror. Auth already supports Bearer (`authorization`, `x-runtime-secret`, `ALPHA_API_KEY`) + better-auth JWT. Hush wired (`@chriscode/hush`, stage-split files). D1 (SQLite) + R2 for bytes.

#### Palot-side (this repo)

**D-P1 — Web projection cache for `CloudHostAuthority` sync reads.** Problem: `host-authority.ts:380-425` — every sync read throws `CloudHostNotConfiguredError` forever. New `main/firefly-plugin/cloud-projection-cache.ts` (+ `.test.ts`); touch `host-authority.ts` (`CloudHostAuthority` only, `:373-480`).
- `CatalogProjectionSnapshot { revision; fetchedAt; catalog; tools; panels; navSidebars; widgets; commands; themes; describeByPluginId; stateByPluginId }`; `CloudProjectionCache { hydrated; revision; hydrate(snapshot); catalog(); describe(id); state(id); listTools(); … }`; `ProjectionCacheNotHydratedError`. Each sync read delegates to the cache (throws-until-hydrated, **never** a fabricated empty projection). `CloudHostAuthority` takes optional `cache?` ctor arg; on construction/first-read kick `fetchProjectionSnapshot()` → `hydrate`, subscribe for push-on-change.
- Test: unhydrated → each reader throws named error; post-`hydrate` returns slices; higher `revision` replaces, lower/equal ignored (no stale regression). `bun:test`.
- Add `CatalogProjectionSnapshot` to `host-authority-types.ts` — **D-P1 owns that one additive block.**

**D-P2 — RPC client projection channel (prereq for D-P1).** Touch `cloud-host-rpc-client.ts` (+ test). The 7 §16 methods already match exactly (`invoke`/`invokeTool`/`gallerySearch`/`installExtension`/`listInstalledExtensions`/`uninstallExtension`/`applyTheme`, `host-authority.ts:432-478`) — **no change.** Add `fetchProjectionSnapshot(sinceRevision?): Promise<CatalogProjectionSnapshot>` (= `call("projectionSnapshot",{sinceRevision})`) + `subscribeProjection(onSnapshot): () => void`. Keep fail-fast (`CloudHostNotConfiguredError` when unconfigured).

#### firefly-cloud-side (separate repo — buildable spec)

> House style: Hono route modules `apps/firefly-api/src/routes/*`, Zod params, D1 via `c.env.DB`, Drizzle `apps/firefly-api/src/db/schema.ts`, R2 for bytes, Hush for secrets, vitest tests. Shared host module in `packages/plugin/`.

**D-C0 — Shared type mirror + signing format (do first).** New `packages/plugin/src/host-authority-types.ts` (mirror palot shapes + `CatalogProjectionSnapshot`) + `packages/plugin/src/signature-format.ts`. Export §16 result types + `DetachedSignature`; `signPackageBytes(data, privateKeyPem, keyId): DetachedSignature` via `crypto.sign(null, data, key)`. **THE cross-repo guard test:** sign known bytes with the dev key, assert the `signatureB64` verifies under the committed `palot/.../trust-anchors/firefly-registry-root-2026.pub.pem` (vendor the PEM as a fixture). If this fails, the marketplace is broken end-to-end.

**D-C1 — `POST /firefly-plugin/rpc`.** New `routes/firefly-plugin-rpc.ts`; mount in `index.ts` (`app.route('/firefly-plugin', …)` near `:52-53`). Auth: `FIREFLY_CLOUD_TOKEN` bearer (new env slot, validated like `ALPHA_API_KEY` at `:1389-1397`) OR better-auth JWT. Body `{ method, params }` (Zod discriminated union) → server `HostAuthority` → JSON result; error → non-2xx (palot raises `CloudHostRpcError`). Methods: the 7 + `projectionSnapshot` (D-C5). **Method names + param keys + result shapes are a HARD MATCH** to palot.

**D-C2 — Gallery (index / search / byte serving).** New `routes/firefly-plugin-gallery.ts` + Drizzle `marketplace_extensions` / `marketplace_versions` (incl. `signatureB64`, `publisherKeyId`, `fpkR2Key`); bytes in **R2**. `gallerySearch(options) → MarketplaceSearchResult`; `GET /firefly-plugin/gallery/:ns/:name/:version/package` serves bytes + `DetachedSignature` (header or sidecar). Search shape = palot `MarketplaceSearchResult`.

**D-C3 — Publish + server-side signing (ties to A).** New `routes/firefly-plugin-publish.ts` + D-C0 signer. `POST /firefly-plugin/publish` (dedicated publish bearer from Hush) → validate manifest → sha256 → **sign raw bytes with `FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY` (ed25519 PKCS#8 from Hush, stage-split) producing `DetachedSignature{publisherKeyId:"firefly-registry-root-2026"}`** → R2 + `marketplace_versions` row. Sign-with-newest, keep old keyIds, support revoked-set. Missing key → fail-fast typed 503 (no unsigned publish). Inject via `wrangler secret`/env from the Hush target at deploy — never `.env`.

**D-C4 — Remote extension host (cloud-host) — reuse stream B runtime.** New `apps/firefly-api/src/firefly-plugin/cloud-host.ts` (or a Durable Object per workspace mirroring `WsGatewayDO` for server-side quarantine). Implements `invoke`/`invokeTool` by running the plugin's `node-worker` server-side over the **same** stream B protocol (`hostToWorkerMessageSchema`/`workerToHostMessageSchema`) → map to `HostToolDispatchEnvelope`. **Server-side broker + signature re-verify (§10) before activation — never trust the client.** Service `storage-request` against D1/R2 per workspace using palot's storage-scope contract. Bundle the protocol schema from `packages/plugin` (ONE definition) — do not re-encode.

**D-C5 — `CatalogProjection` snapshot fetch + push-on-change.** The `projectionSnapshot` RPC method (in D-C1's router) + a push channel reusing `WsGatewayDO`. `projectionSnapshot(sinceRevision?) → CatalogProjectionSnapshot`; on any catalog mutation (install/uninstall/setEnabled/applyTheme/refresh) broadcast a new snapshot with incremented `revision`. Snapshot assembled the same way `ElectronHostAuthority.catalog()/listTools()/…` assemble theirs. Each slice = palot `HostPlugin*Result` so D-P1's cache serves sync reads verbatim.

---

### Stream E — Signed sample CODE extension + E2E (both builds) + test strategy

> E's per-task SDK/activation/dispatch/trust-anchor items are **the same work as B + A**, surfaced from the E2E angle. They are unified into B/A ownership in §5. What is **unique to E** is: the concrete `acme.disk-example` fixture, the installed-worker discovery gap, and the two end-to-end integration tests.

**E1 — The signed sample CODE extension fixture (`acme.disk-example`).** Owned as one directory: `apps/desktop/plugins/acme-disk-example/**` + sign step. (This is the concrete instance of B4's example.)
- E1.1 manifest: `runtime { hostKind:"node-worker", surfaces:["electron","web"], webStrategy:"cloud-host" }`; one command `acme.disk-example.greet`; one tool `plugin.acme.disk-example.read-config` (`requires` a **medium+** capability so consent fires — verify risk in `capabilities.ts`/`risk-register.ts`); `trust:"signed-third-party"`. Test: parse + assert resolution → `electron-utility` (electron) / `cloud-host` (web).
- E1.2 `worker/index.ts`: real `activate()` consuming the B2 SDK; `read-config` does a storage round-trip and returns data. This is the artifact that **actually executes**.
- E1.3 = **B2's SDK** (same file). Build once.
- E1.4 build+sign = **A4 + B4** (build `out/plugins/acme.disk-example/`, emit `signature.json` = `DetachedSignature`). Test: `verifyDetachedSignature` against committed anchor → `verified:true`; flip a byte → `false`.

**E2 — Electron E2E proof.** (E2.1 activation = B1; E2.2 routing = B3; E2.4 trust-anchors = A1/A2 — unified.) **Unique:**
- E2.3 — **Register installed (content-addressed) workers.** Touch `supervisor-boot.ts` (`discoverPluginWorkerEntries`) or add `registerInstalledExtensionWorker(installation)`. Marketplace installs land at the content-addressed `unpackedPath` (`install-orchestrator.ts:364`) the supervisor never scans — add that path to discovery; fail-loud if a `node-worker` install has no `worker.mjs`. **This is the gap that makes a *downloaded* (vs bundled) extension run.** Test: installed record → boot registers+activates.
- E2.5 — **The Electron E2E integration test** `e2e/signed-extension-electron.e2e.test.ts` (`bun:test`, real `worker_threads` against the built `out/plugins/acme.disk-example/worker.mjs`). Asserts in order: (1) trust → `signed-third-party`/`verified`, corrupted byte → `integrity_mismatch`; (2) `persistInstallGrants` with the consented medium token → `granted/user` row, rest `prompt-required`; (3) boot supervisor, `enable` → `active` (spawn → `activate` → `activated`); (4) `invokePluginTool` → `completed` with **worker-produced** data; (5) revoke/deny → broker `permission_denied`, no silent run.

**E3 — Web E2E proof.** `e2e/signed-extension-web.e2e.test.ts`. Inject a `fetchFn` into `createCloudHostRpcClient` emulating the §16 contract → `CloudHostAuthority.invokeTool` → `completed`; `runtime-location` resolves fixture → `cloud-host` on `{build:"web"}`; missing `FIREFLY_CLOUD_URL` → `CloudHostNotConfiguredError`. **Live-server leg is blocked-on-D** (server-side verify + broker + remote runtime + projection snapshot). Until D lands, web proof is **contract-level (faked fetch)**.

**E4 — Verification commands.** Typecheck (`tsgo --noEmit` / `pnpm --filter @palot/desktop typecheck`) must **EXIT 0 captured directly**. Build fixture first: `bun scripts/build-plugins.ts && node scripts/sign-plugin-package.mjs --plugin acme.disk-example`. Unit/integration: `bun test apps/desktop/src/shared/firefly-plugin apps/desktop/src/main/firefly-plugin`. Lint: `bun run lint`.

---

## 4. Sequencing DAG

```
                         ┌──────────────────────────────────────────────┐
                         │  CONTRACT FREEZE (§6) — lock before A2/B*/D   │
                         │  §16 wire · DetachedSignature · worker proto  │
                         └───────────────┬──────────────────────────────┘
                                         │
   WAVE 1 (fully parallel, disjoint files, no cross-deps):
   ┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
   │ A6      │ A1      │ A3      │ A4      │ B1      │ B2      │ C1      │ D-P2    │
   │ union   │ anchor  │ sign    │ sign    │ activate│ worker  │ consent │ proj    │
   │ drift   │ registry│ contract│ CLI+fix │ handshk │ runtime │ IPC type│ rpc chan│
   └────┬────┴────┬────┴────┬────┴────┬────┴────┬────┴────┬────┴────┬────┴────┬────┘
        │         │         │         │         │         │         │         │
        └─→ A2 ←──┴─────────┴─────────┘         ├─→ B3 ───┤         │         └─→ D-P1
   (A6+A1+A3+A4)  signature wiring              │ dispatch│         │            proj cache
        │                                       │ routing │         │
        │                                       └────┬────┘         │
   C2 (host grantStore) ─────────────────────────────┐             │
        │                                             │             │
        └─→ C3 (thread approved set) ──────┐          │  B4 (bundle, needs B2)
                                           │          │     │
                          C4 (consent↔dispatch test)  │  E1 (fixture = B4 instance)
                                                       │     │
   D-C0 (shared types+signer) ─→ D-C1/D-C2/D-C3/D-C4/D-C5 (firefly-cloud)
                                                       │     │
   ═══════════════════════════════════════════════════╪═════╪═══════════════════
   E2.3 (installed-worker discovery) ──────────────────┤     │
                                                        ▼     ▼
                    E2.5  ELECTRON E2E  (needs A2 + B1+B3+B4 + C2+C3 + E1 + E2.3)
                    ─── closes the Electron customer story ENTIRELY IN-REPO ───
                                              │
                    E3   WEB E2E  contract-level now ; live after D-C0..D-C5
```

**Critical path (Electron customer story, all in-repo):**
`CONTRACT FREEZE → {A6→A1→A2} ∥ {B1→B3, B2→B4} ∥ {C1→C2→C3} → E1 + E2.3 → E2.5`.

**Critical path (Web):** adds `D-P2→D-P1` (palot) and `D-C0→D-C1/…/D-C5` (firefly-cloud) → upgrade E3 from contract-level to live.

**Wave-1 fully-parallel set (8 agents, zero shared files):** A6, A1, A3, A4, B1, B2, C1, D-P2. (B2/A1/A3/A4/C1/D-P2 have no inbound deps; A6 is a tiny pre-req for A2; B1 lands the supervisor interface B3 needs.)

**Electron closes in-repo (A+B+C+E); Web (D) is the only cross-repo addition.**

---

## 5. Swarm Execution Plan

**Rule (memory: "swarm subagents: no git mutation"):** impl subagents **do NOT commit/push**. Each agent edits only its **disjoint** file set and returns a diff/summary. The **orchestrator integrates, re-runs typecheck + the full `bun test` glob on the merged tree, then commits coherent slices and pushes.** Re-verify the merged tree, not the per-agent trees.

### Wave 1 — disjoint-file agents (run all in parallel)

| Agent | Owns (exclusive files) | Notes |
|---|---|---|
| **W1-A6** | `signature-verify.ts` (union), `schema.ts` (state enum), `extension-store.ts` (state type) | tiny pre-req; **must merge before A2 + C/A touch these** |
| **W1-A1** | `shared/firefly-plugin/trust-anchor-registry.ts` (+test), `trust-anchors/index.ts` | fully isolated |
| **W1-A3** | `shared/firefly-plugin/registry-signature-contract.ts`, design `§16.x` | contract only |
| **W1-A4** | `scripts/sign-plugin-package.mjs`, `install/__fixtures__/signed/**` | isolated |
| **W1-A5** | `trust-anchors/README.md` | docs only |
| **W1-B1** | `worker-supervisor.ts`, `extension-host-protocol.ts` (append-only) | lands supervisor surface B3 needs |
| **W1-B2** | `extension-worker-runtime.ts`, `sdk/index.ts`, `sdk/host-bridge.ts` | NO electron/worker_threads imports |
| **W1-C1** | `host-authority-types.ts` (`MarketplaceInstallInput` only), `preload/api.d.ts` (same), `ipc.ts` (`installArgsSchema` only) | extract+export schema |
| **W1-D-P2** | `cloud-host-rpc-client.ts` (+test) | palot |
| **W1-DC0** | firefly-cloud `packages/plugin/src/{host-authority-types,signature-format}.ts` | separate repo |

### Wave 2 — depends on Wave 1 merges

| Agent | Owns | Depends on |
|---|---|---|
| **W2-A2** | `install-orchestrator.ts` (sig block `:343-348` + `InstallExtensionOptions` **shape**), `extension-store.ts` (record types+upsert), new Drizzle migration, `install/detached-signature.ts` | A6, A1, A3, A4 |
| **W2-B3** | `dispatch.ts`, `worker-invoke-router.ts` | B1 |
| **W2-C2** | `grant-store.ts` (`getHostGrantStore`), `index.ts` (`:337`), `host-authority.ts` (**`ElectronHostAuthority.installExtension` only**) | C1 |
| **W2-B4/E1** | `apps/desktop/plugins/acme-disk-example/**`, `build-plugins.ts` | B2, A4 |
| **W2-DP1** | `cloud-projection-cache.ts` (+test), `host-authority.ts` (**`CloudHostAuthority` only**), `host-authority-types.ts` (`CatalogProjectionSnapshot` block only) | D-P2 |
| **W2-DC1..DC5** | firefly-cloud routes/DO/schema (own `index.ts` mount, split `db/schema.ts`) | DC0 |

### Wave 3 — final wiring + proofs (mostly serial)

| Agent | Owns | Depends on |
|---|---|---|
| **W3-C3** | `install-orchestrator.ts` (grant block `:381-389` + `consentedCapabilities` option), `marketplace-panel.tsx` | A2 (orchestrator shape), C2 |
| **W3-E2.3** | `supervisor-boot.ts` (installed-worker discovery) | B1, A2 |
| **W3-C4** | `grant-consent-dispatch.test.ts` (test-only) | C2/C3 |
| **W3-E2.5** | `e2e/signed-extension-electron.e2e.test.ts` | A2, B1, B3, B4/E1, C2/C3, E2.3 |
| **W3-E3** | `e2e/signed-extension-web.e2e.test.ts` | D-P1/D-P2 (contract); D-C* (live) |

### Shared-file collision controls (load-bearing)

- **`dispatch.ts` — B3 is the SOLE writer.** C reads it via stable seams (`createDbGrantResolver`/`setGrantResolver`/`decideCapabilityAll`) and edits **zero** lines of it. C4 is a test file. **Do not assign `dispatch.ts` to any C or E agent.**
- **`install-orchestrator.ts` — A2 vs C3.** Partition by region: **A2 owns the signature block (`:343-348`) and the `InstallExtensionOptions` type addition; C3 owns the grant block (`:381-389`) and the `consentedCapabilities` option field.** **Serialize: A2 merges first, C3 rebases onto the A2 tip** (both add to the same `InstallExtensionOptions` interface — orchestrator must integrate the union of fields). Never run A2 and C3 concurrently against this file.
- **`host-authority.ts` — three disjoint regions, three different waves.** C2 edits **only** `ElectronHostAuthority.installExtension` (`:267-300`); D-P1 edits **only** `CloudHostAuthority` (`:373-480`). Same file → **sequence them** (C2 then D-P1, or vice versa) and have the orchestrator merge; do not run both concurrently.
- **`host-authority-types.ts` — additive-block ownership.** C1 owns the `MarketplaceInstallInput` field; D-P1 owns the `CatalogProjectionSnapshot` block. Disjoint blocks, but same file → **sequence or hand both blocks to one integrator pass.**
- **`extension-host-protocol.ts` — append-only.** B1 appends the `activated` arm; everyone else imports types. No edits beyond B1.
- **`extension-store.ts` / `schema.ts` — A6 first.** A6's union change touches both; A2's columns touch both. A6 merges before A2.
- **firefly-cloud `index.ts` — D-C1 is the sole `index.ts` writer** (mount + auth-gate bearer slots); D-C3 hands D-C1 its route factory. **`db/schema.ts` — split additive blocks** (D-C2 gallery, D-C4 storage) or sequence D-C2 before D-C4.
- **`build-plugins.ts` — single owner** (the B4/E1 fixture agent); no other agent edits it.

---

## 6. Cross-Repo Contract Freeze

**Lock these exact shapes before stream D (and before A2/B3 land their consumers). Any drift = silent end-to-end breakage.**

1. **§16 RPC wire.** `POST {FIREFLY_CLOUD_URL}/firefly-plugin/rpc`, `content-type: application/json`, optional `authorization: Bearer {FIREFLY_CLOUD_TOKEN}`, body `{ method: string, params: object }`, result = the method's JSON result, non-2xx → palot `CloudHostRpcError`. SSOT: `palot .../cloud-host-rpc-client.ts:84-92`. Methods + param keys (HARD MATCH to `host-authority.ts:432-478`): `invoke{pluginId,commandId,args}`, `invokeTool{pluginId,toolId,args,sessionId}`, `gallerySearch{options}`, `installExtension{input}`, `listInstalledExtensions{}`, `uninstallExtension{installationId}`, `applyTheme{installationId,themeId}`, **`projectionSnapshot{sinceRevision?}`**.

2. **Signature format (server signs, palot verifies).** `DetachedSignature = { algorithm:"ed25519", signatureB64: string /* raw sig bytes, base64 */, publisherKeyId: string }` over the **raw package bytes**; verify via `crypto.verify(null, data, publicKey, sig)`. SSOT: `palot .../signature-verify.ts:51-57,84-122`. keyId `firefly-registry-root-2026`, fingerprint `sha256:88603741…ab5d`. **Invariant: server `sign(vsixBytes)`, client `verify(vsixBytes)` — byte-identical.** Optional sidecar field `signedContentSha256` for a pre-verify tamper cross-check (A3).

3. **Result shapes.** The exact types in `palot .../host-authority-types.ts`: `HostToolDispatchEnvelope` (status enum `:133-140`), `MarketplaceSearchResult`/`MarketplaceSearchEntry` (`:163-167`), `MarketplaceInstallResult`, `MarketplaceInstalledEntry`, `HostPlugin*Result`, and **`CatalogProjectionSnapshot`** (each slice = the corresponding `HostPlugin*Result`).

4. **Worker protocol (Electron worker AND cloud-host remote host).** The Zod schemas in `palot .../extension-host-protocol.ts`: `hostToWorkerMessageSchema` (incl. the new `activated` arm from B1), `workerToHostMessageSchema`, `RuntimeTransport`, `storageRequestSchema`. **One definition, published via firefly-cloud `packages/plugin`** — do not re-encode in the server.

> **Freeze mechanism:** land A3 (`registry-signature-contract.ts`) + the `host-authority-types.ts` shapes + the protocol file in Wave 1; D-C0 mirrors them via `packages/plugin` with the round-trip guard test as the tripwire.

---

## 7. Risks / Open Decisions / Known Gotchas

- **Drizzle is journal-less.** `apps/desktop/drizzle/2026*_extension-packages/` and `_p3-grants-and-storage/` are hand-authored `migration.sql` + `snapshot.json`, **no `_journal`**. A2's new columns follow that exact pattern by hand. The grants table already exists → the Electron story needs **no new table**, only wiring.
- **`SignatureState` union drift (A6).** Code (`signature-verify.ts:67`) ≠ design §7.1 (`design:353`). **Decide the canonical union before A2.** Recommended: keep the code union (`unsigned|verified|unverified`) and update the design doc, since persistence + schema already key off it — but this is an explicit open decision for the lead.
- **`activated` vs bare `ready` lifecycle trigger (B vs E).** Adopt **B1's `activated`** (richer: carries the registered-id table dispatch needs). Resolve before B/E impl so the fixture worker posts the right message.
- **Installed (downloaded) workers are not discovered (E2.3).** The supervisor scans `resolvePluginRoots()`, not the content-addressed `unpackedPath`. The bundled fixture proves execution; **a truly *downloaded* extension running requires E2.3.** Flag as load-bearing for the literal customer story, not optional polish.
- **GUI-only verification limits.** The headless E2E exercises the same `installExtension`/`invokePluginTool`/grant-store seams the GUI calls — **logic is proven, pixels are not.** The marketplace panel rendering the install button, the `CapabilityConsentDialog` visibly appearing, and the widget visually rendering are a **manual/Playwright follow-up** (prior session could not drive GUI in-env).
- **Phantom IDE diagnostics.** Trust the captured `tsgo --noEmit` / `bun test` exit codes, **not** editor squiggles — stale TS-server diagnostics have misled prior sessions. Verification = captured exit 0, not eyeballed.
- **HQ-registry auth for `bun add`.** Per repo policy, `@ch5me`/`@chriscode` packages resolve from the HQ registry (npm.ch5.me), not GitHub Packages. If D's `packages/plugin` publish or any cross-repo `bun add` hits `ENEEDAUTH`/`401`, the fix is HQ-registry auth (see `ch5me-npm-packages` / `ch5-hq-infrastructure`), **not** a registry fallback.
- **No silent fallbacks (CH5 fail-fast), enforced end-to-end:** present-but-invalid signature → `integrity_mismatch` (never downgrade); unconfigured cloud host → `CloudHostNotConfiguredError` (never empty projection); missing signing key at publish → typed 503 (never unsigned publish); worker that posts `ready` but never `activated` → hang-timeout `failed` (never silently active).
- **Dev/staging signer split is a tracked hardening task** (carried in A5 + D-C3), not MVP-blocking: today only the prod signer exists in Hush.

---

## 8. Task Checklist (drives the swarm)

### Contract freeze (do before Wave 2 consumers)
- [ ] Lock §16 RPC wire (methods, param keys, result types) — §6.1
- [ ] Lock `DetachedSignature` + raw-bytes signing invariant — §6.2
- [ ] Lock `HostToolDispatchEnvelope` / `MarketplaceSearchResult` / `CatalogProjectionSnapshot` shapes — §6.3
- [ ] Lock worker protocol incl. new `activated` arm — §6.4

### Stream A — Signing / PKI (Wave 1: A6,A1,A3,A4,A5 · Wave 2: A2)
- [ ] **A6** Resolve `SignatureState` union drift across `signature-verify.ts` / `schema.ts` / `extension-store.ts`
- [ ] **A1** `trust-anchor-registry.ts` + `trust-anchors/index.ts` + test
- [ ] **A3** `registry-signature-contract.ts` + design §16.x
- [ ] **A4** `scripts/sign-plugin-package.mjs` + `__fixtures__/signed/**` (clean + tampered) + smoke test
- [ ] **A5** rotation/revocation runbook
- [ ] **A2** wire real `{signature, publicKeyPem, data}` into `derivePackageTrust`; migration (keyId/algo/sigB64/digest); persist provenance; tests (valid/tampered/unknown/unsigned)

### Stream B — Electron exec (Wave 1: B1,B2 · Wave 2: B3,B4)
- [ ] **B1** Supervisor posts `activate`; append `activated` arm; lifecycle to `active` on `activated`; hang-timeout on `ready`-only; test
- [ ] **B2** `extension-worker-runtime.ts` + `sdk/index.ts` + `sdk/host-bridge.ts` (transport-agnostic); test
- [ ] **B3** `worker-invoke-router.ts` + route in `dispatch.ts` after broker, before in-process; test (worker-backed / denied / built-in)
- [ ] **B4** Bundle `worker.mjs` (runtime+SDK inlined); build test (activate→activated→invoke)

### Stream C — Consent (Wave 1: C1 · Wave 2: C2 · Wave 3: C3,C4)
- [ ] **C1** `consentedCapabilities` on both `MarketplaceInstallInput` + `installArgsSchema` (extract+export); test
- [ ] **C2** `getHostGrantStore` singleton; refactor `installPluginGrantResolver`; inject store in `ElectronHostAuthority.installExtension`; test
- [ ] **C3** Thread approved set orchestrator→`persistInstallGrants`; resolve `marketplace-panel.tsx` L513-515 TODO; test
- [ ] **C4** consent↔dispatch invariant test (no `dispatch.ts` edit)

### Stream D — firefly-cloud + web cache (palot Wave 1/2; cloud separate repo)
- [ ] **D-P2** `fetchProjectionSnapshot`/`subscribeProjection` on `cloud-host-rpc-client.ts`; test
- [ ] **D-P1** `cloud-projection-cache.ts` + delegate `CloudHostAuthority` sync reads; `CatalogProjectionSnapshot` type; test
- [ ] **D-C0** `packages/plugin` shared types + `signature-format.ts` + cross-repo round-trip guard test
- [ ] **D-C1** `POST /firefly-plugin/rpc` (8 methods) + mount + auth gate; test
- [ ] **D-C2** gallery routes + `marketplace_extensions`/`marketplace_versions` + R2 byte serving; test
- [ ] **D-C3** publish route + server-side ed25519 signing from Hush (fail-fast on missing key); test
- [ ] **D-C4** cloud-host remote runtime (reuse B protocol) + server-side broker + sig re-verify + per-workspace storage; test
- [ ] **D-C5** `projectionSnapshot` method + push-on-change over `WsGatewayDO`; test

### Stream E — Fixture + E2E (Wave 2: E1 · Wave 3: E2.3, E2.5, E3)
- [ ] **E1** `acme.disk-example` real worker extension (manifest + `worker/index.ts` + sign step); manifest + worker tests
- [ ] **E2.3** Register installed (content-addressed) workers in supervisor discovery; fail-loud on missing `worker.mjs`; test
- [ ] **E2.5** Electron E2E: install→trust→consent→enable→activate→invoke→worker-data; negative cases (tamper, deny)
- [ ] **E3** Web E2E: faked `fetchFn` §16 contract proof now; live-server leg after D-C0..D-C5

### Orchestrator (not a subagent task)
- [ ] Integrate disjoint agent diffs per wave; **re-run `tsgo --noEmit` + full `bun test` glob on the merged tree** (captured exit 0)
- [ ] Build+sign fixture (`bun scripts/build-plugins.ts && node scripts/sign-plugin-package.mjs --plugin acme.disk-example`) before E2E
- [ ] Commit coherent slices + push (subagents never commit/push)
- [ ] Electron customer story signed off in-repo (A+B+C+E); Web upgraded from contract-level to live once D lands
