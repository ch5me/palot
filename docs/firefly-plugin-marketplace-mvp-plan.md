# Firefly Plugin Marketplace — Signed Third-Party MVP Plan

## 0. Revision Log (what changed vs the prior version)

This revision folds in a 4-lens adversarial critique (completeness / correctness / security / swarm-exec). Summary of material changes, grouped by area:

- **NEW Stream F — Code-extension install path + catalog bridge + live lifecycle (the biggest miss).** The prior plan assumed `installExtension` already worked for code extensions. It does NOT: `install-orchestrator.ts` HARD-THROWS on non-theme packages (`Phase 1 supports theme packages only`), and the running catalog (`authority.ts buildCatalogWithDiskPlugins → discoverDiskManifests(resolvePluginRoots())`) NEVER reads `extension_installations`/`extension_packages`. Stream F adds: (a) a code-extension install branch parsing a Firefly `manifest.json` via `parseJsonPluginManifest`; (b) an install→catalog bridge (`discoverInstalledManifests`); (c) LIVE post-boot worker registration (`registerInstalledExtensionWorker`) on the already-booted supervisor singleton. *(Closes completeness-CRITICAL #1, correctness-MEDIUM E2.3-singleton.)*
- **NEW `kind:'firefly'` gallery install source end-to-end.** Open VSX serves NO CH5 registry signature, so `kind:'open-vsx'` is **permanently `unsigned-third-party`** and cannot satisfy the medium-risk-capability story. Added a firefly RegistryClient adapter + orchestrator branch + the explicit statement that the customer-story proof installs from the **firefly** source (or a faithful local mirror that serves the CH5 signature the same way), not a hand-attached `local-vsix` sidecar. *(Closes completeness-CRITICAL #2, security-HIGH consent-gallery.)*
- **SECURITY: trust gate moved to the SPAWN boundary, not just install.** Worker spawn currently activates purely on `enabled && !quarantined` and never re-reads `trustTier`/`signatureState`; workers are bare unsandboxed Node. Register/activate of a `node-worker` now refuses unless the install is `verified`/`signed-third-party` (or explicit allow-unsigned-with-consent + local-dev). *(Closes security-CRITICAL spawn-TOCTOU.)*
- **SECURITY: block unsigned / downgrade-to-unsigned.** A stripped/absent signature previously took the unsigned path and STILL installed. Added a policy gate: a marketplace (firefly / open-vsx-as-signing-authority) install whose resolved signature is **absent** is BLOCKED unless the source is explicitly allow-unsigned-with-consent. Added a downgrade test. *(Closes security-CRITICAL unsigned-blocking.)*
- **SECURITY: signing payload anti-rollback.** A3 + §6.2 changed from raw-bytes signing to signing a **canonical manifest** `{namespace,name,version,contentSha256,algorithm,signedAt,publisherKeyId}` (binds identity+version), client verifies the manifest then checks `contentSha256 === sha256(bytes)`. Added a per-PACKAGE yank/revocation list. The minted ed25519 key is UNCHANGED — only WHAT it signs changed. *(Closes security-HIGH replay/downgrade.)*
- **SECURITY: verify BEFORE extract.** Registry signature is now verified over raw bytes BEFORE unpack; rejected bytes never reach a discoverable content-addressed dir. *(Closes security-MEDIUM extract-before-verify.)*
- **SECURITY: dev-anchor inertness proven.** `packaged` is pinned to one authoritative build-baked source (`app.isPackaged` baked into `trust-anchors/index.ts`), fail-closed (default `packaged:true`) when absent. *(Closes security-MEDIUM dev-anchor.)*
- **SECURITY: grant re-inheritance + re-consent on update.** Grants are now bound to version (or a manifest-capability-set hash); update forces newly-declared/changed medium+ caps back to prompt-required; uninstall/disable revokes/tombstones. *(Closes security-HIGH grant-reinheritance, completeness-HIGH update-reconsent.)*
- **SECURITY: web trust is fully delegated → cloud endpoint authenticity is in the TCB.** Documented; `FIREFLY_CLOUD_URL`/token pinned; D-C4 server-side verify made a hard separately-proven gate; E3-live is now REQUIRED for web-DoD, not optional. *(Closes security-HIGH web-blind-trust.)*
- **UI: gallery consent gate fixed.** `MarketplaceSearchEntry` gains `requiredCapabilities` (+ trust/runtime hints) populated by the gallery adapter; theme-only hardcoding removed; OR a two-phase download→parse→consent→activate flow. E2E asserts a medium+ cap ext opens the dialog before grants are written. *(Closes completeness-HIGH UI-gap, security-HIGH pre-install-consent.)*
- **LIFECYCLE: full uninstall/disable/update.** Uninstall stops the worker + revokes/tombstones grants + drops projections; disable tears the worker down; an UPDATE path re-downloads+re-verifies the pinned version, restarts via hot-reload, re-consents on capability changes. All wired into the hot-reload executor, not just the dev watcher. *(Closes completeness-HIGH lifecycle.)*
- **CORRECTNESS: B1 owns its full blast radius.** B1 now owns `worker-supervisor.test.ts`, `supervisor-boot.test.ts`, and all 4 `worker-fixtures/*.mjs`, and explicitly edits the stale comment at `extension-host-protocol.ts:94/95` and the `case "ready"` active-flip at `worker-supervisor.ts:317` (protocol file is NOT purely append-only). *(Closes correctness-CRITICAL B1-blast-radius, correctness-LOW protocol-comment.)*
- **CORRECTNESS: Drizzle migration invariant rewritten.** `snapshot.json`/`prevIds` is INERT at runtime; the only load-bearing artifacts are (1) a new dir `<YYYYMMDDHHMMSS>_<slug>` with timestamp strictly > `20260616213300` and parseable, (2) `migration.sql` with `--> statement-breakpoint` separators. Added an `ensureDb()` fresh-in-memory column-existence test. *(Closes correctness-HIGH drizzle.)*
- **Citation/command/path fixes:** §6.1 RPC SSOT → `host-authority.ts:432-478` (CloudHostAuthority), not `cloud-host-rpc-client.ts`; firefly-cloud mount → `app.route(...)` cluster ~`:5063` in a 6397-line file (not `:52-53`); `signature-verify.ts` is at `apps/desktop/src/main/firefly-plugin/install/` (main-process), wire types move to `shared/firefly-plugin`; schema file is `apps/desktop/src/main/automation/schema.ts` (co-hosts automations tables); `MarketplaceInstallInput` is a SINGLE flat interface (also duplicated at `preload/api.d.ts:906`), `kind:'open-vsx'|'local-vsix'|'firefly'`; verify commands → `bunx tsgo --noEmit` + `bun test …` + `bun run lint` (package is `@ch5me/elf-desktop`, repo uses bun, script is `check-types`, no `test` script). *(Closes correctness/swarm citation findings.)*
- **SEQUENCING: contract freeze is now a real Wave-0 gate.** B1 MERGES (protocol final incl `activated` arm) BEFORE D-C0 mirrors the worker protocol. D-C0 split: signature/type mirror runs early (byte-stable); protocol mirror depends on B1. Stream F live-registration sequenced after B1. `supervisor-boot.ts` added to §5 collision controls. DC4 cloud-host is its own heavy agent. *(Closes swarm-HIGH freeze-gate, swarm-HIGH supervisor-boot-collision, swarm-LOW DC sizing.)*

---

## 1. Goal & Definition of Done

**Customer story (definition of done):** A real customer **browses the firefly gallery, downloads a real signed + keyed third-party CODE extension** (not just a theme) **from the signing-authority registry**, and it **just works** — trusted (`trustTier=signed-third-party`), capabilities consented (deny-by-default grants persisted from a consent dialog that actually fired), and it **ACTUALLY EXECUTES** (its `activate()` runs and a tool/command it registered returns real data) — on **BOTH** the Electron build and the Web build, across the published plugin architecture, **through the real `installExtension`→catalog→projection→supervisor→dispatch path** (not a pre-built plugin-roots fixture).

**"Done" = the E2E proof on both builds:**
- **Electron:** browse firefly gallery (capabilities surfaced on the search entry) → consent dialog fires for the medium+ capability **before** grants are written → `installExtension({kind:"firefly", …})` downloads bytes + served signature → **registry signature verified over raw bytes BEFORE extract** → canonical-manifest verify + `contentSha256` cross-check → `derivePackageTrust` yields `signed-third-party` → manifest parsed via `parseJsonPluginManifest`, descriptor + projections persisted → **install→catalog bridge** exposes the code ext to the host → consent result persists `granted/user` rows → enable → **`registerInstalledExtensionWorker` registers+activates on the already-booted supervisor** (spawn refused unless `verified`/`signed-third-party`) → worker receives `activate`, posts `activated` → `invokePluginTool` routes across the worker boundary → extension code runs and returns real data. Proven by a single-process integration test (real `worker_threads`, no GUI) that drives the **real** `installExtension`.
- **Web:** the same fixture resolves to `cloud-host`, installs/invokes via the §16 RPC contract against `firefly-cloud`. Contract-level proof lands in-repo (faked `fetchFn`); **the live-server leg is REQUIRED for web-DoD** — web trust is wholly delegated to firefly-cloud, so the server-side verify/broker (D-C4) is a hard, separately-proven gate.

The **Electron customer story closes entirely in-repo** (streams A + B + C + F + E). **Web** adds the cross-repo `firefly-cloud` server (stream D) **and its live proof is part of DoD**.

---

## 2. Locked Decisions

**CH5 holds the marketplace/registry signing authority — the "Microsoft role."** This is the VS Code marketplace **repository-signing** model, faithfully reproduced:

- **Two-tier signature. The REGISTRY (repository) signature is load-bearing.** `firefly-cloud` signs every served package with the CH5 marketplace key; palot bakes the **public** key as a committed trust anchor, so a downloaded package derives `trustTier=signed-third-party`. Per-publisher "verified publisher" badges = the **same** detached-signature mechanism with more `keyId`s — **POST-MVP**.
- **Algorithm = ed25519.** First-class path in `signature-verify.ts` via `crypto.verify(null, data, key, sig)` (no pre-hash; ed25519 hashes internally).
- **Key identity = a MAP.** Client holds `keyId → public PEM`. Sign with the **newest** keyId; old keyIds stay valid until **explicitly revoked**. A **revoked-set** is honored everywhere (revocation beats presence).
- **Private signer → repo-local Hush** (`FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY`); **public → committed trust anchor** (non-secret). Dev/staging signer + stage-split Hush files (`dev`/`staging`/`prod`) is a **tracked hardening task** — today only the prod signer exists.
- **No silent fallbacks anywhere (CH5 fail-fast).** A present-but-invalid signature is a hard `integrity_mismatch` — **never** downgraded to a lower trust tier. An **absent** signature on a signing-authority registry source is **blocked**, never silently installed as unsigned.
- **NEW — signed payload is a canonical manifest, not raw bytes.** The signature attests `{namespace,name,version,contentSha256,algorithm,signedAt,publisherKeyId}` so identity + version are bound (anti-rollback). The client verifies the canonical manifest, then checks `contentSha256 === sha256(downloaded bytes)`. Revocation is **per-package (yank list)** in addition to per-key. **The minted key is UNCHANGED — only the signed payload changed.**

**Already minted this session (real, in the repo — UNCHANGED by this revision):**

| Item | Value |
|---|---|
| keyId | `firefly-registry-root-2026` |
| algorithm | ed25519 |
| fingerprint | `sha256:88603741da3fc2bed2de2be603024c64a81de023a1ac1e01d17b427f6559ab5d` |
| private key | repo-local Hush secret `FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY` (PKCS#8 PEM, 118 chars, confirmed) |
| public anchor | committed at `apps/desktop/src/shared/firefly-plugin/trust-anchors/firefly-registry-root-2026.pub.pem` (SPKI ed25519) |
| mint/rotate helper | `scripts/mint-plugin-signing-key.mjs` (writes `<keyId>.pub.pem`, stores private in Hush, prints fingerprint) |

> **Path note (load-bearing):** `signature-verify.ts` lives at `apps/desktop/src/main/firefly-plugin/install/signature-verify.ts` — a **MAIN-process** module (imports `node:crypto`). The **wire types** (`DetachedSignature`, `SignatureState`, the canonical signed-manifest shape) live in `apps/desktop/src/shared/firefly-plugin/registry-signature-contract.ts` (A3) so the web build + firefly-cloud import the contract WITHOUT pulling a `node:crypto` main-only module. **Verification logic stays main-only; only wire types are shared.**
> **Schema note (load-bearing):** the Drizzle schema is `apps/desktop/src/main/automation/schema.ts` — it co-hosts the unrelated `automations`/`automationRuns` tables alongside `extensionPackages`/`extensionInstallations`/`extensionCapabilityGrants`/`pluginStorageEntries`. Use the **full path** everywhere; it may have **non-swarm concurrent editors** (automation-feature work). The orchestrator integrates on a clean base.

---

## 3. Work-Streams

> Conventions: paths under `apps/desktop/src/...` unless noted. firefly-cloud paths are in the separate repo `/Users/hassoncs/src/ch5/firefly-cloud`. Each task is a discrete, independently-committable unit: **files**, **contract/signature**, **unit test**, **what it unblocks**.

### Stream A — Signing / PKI / Trust

**Ground truth (verified):** `verifyDetachedSignature` / `derivePackageTrust` are real and fail-fast (`apps/desktop/src/main/firefly-plugin/install/signature-verify.ts:84-122`, `:150-211`) — they just need real `signature`, `publicKeyPem`, and `data` fed in. The break is `install-orchestrator.ts:343-348` (`signature:null, publicKeyPem:null, data:Buffer.alloc(0)` → always `unsigned-third-party`). The VSIX/FPK content hash already exists (`package-store.ts:196` `contentSha256 = sha256Hex(vsixBytes)`). Schema has `extension_packages.signature_state` and `extension_installations.trust_tier` (`apps/desktop/src/main/automation/schema.ts`) but **no** columns for keyId/sig/algo/digest/canonical-manifest. The minted anchor is confirmed on disk.

**A6 (pre-req) — Resolve the `SignatureState` union drift.** Code union is `"unsigned" | "verified" | "unverified"` (`signature-verify.ts:67`); design §7.1 uses `"verified" | "missing" | "failed" | "not-applicable"`. Pick ONE union, update `signature-verify.ts`, `apps/desktop/src/main/automation/schema.ts`, `extension-store.ts`. **Lands before A2** (or A2 absorbs it). **The `SignatureState` wire type itself moves to A3's `registry-signature-contract.ts`** (shared, no `node:crypto`); A6 re-points imports.

**A1 — Client trust-anchor registry + loader.** New: `shared/firefly-plugin/trust-anchor-registry.ts` (+ `.test.ts`), plus `trust-anchors/index.ts` (build-time-baked literal/generated `Record<keyId, pem>` — **no runtime `fs`**, renderer/web have none).
- Contract: `TrustAnchor { keyId; publicKeyPem; algorithm:"ed25519"; fingerprintSha256; devOnly }`; `TrustAnchorRegistry { resolve(keyId): string|null; get(keyId): TrustAnchor|null; isRevoked(keyId): boolean; trustedKeyIds(): readonly string[] }`; `createTrustAnchorRegistry(opts)` + `createDefaultTrustAnchorRegistry()`. `resolve()` precedence (fail-fast): revoked → `null`; `packaged && devOnly` → `null`; unknown → `null`; else PEM. Fingerprint via `createPublicKey(pem).export({type:"spki",format:"der"})` → sha256 hex.
- **`packaged` is BUILD-BAKED, not a runtime arg (security fix).** `trust-anchors/index.ts` bakes `export const PACKAGED = app.isPackaged` (or the build-time constant the bundler injects) as the single authoritative, non-spoofable source. `createDefaultTrustAnchorRegistry()` reads that baked constant; **default `packaged:true` (fail-closed)** when the signal is absent/ambiguous. Callers do not pass `packaged`.
- Test: resolves committed key + fingerprint `sha256:8860374…9ab5d`; unknown → null; revoked excluded; `devOnly` suppressed when baked `packaged:true`; **unset/ambiguous `packaged` ALSO suppresses devOnly anchors (fail-closed)**; malformed PEM throws at construction.
- Unblocks: A2 key resolution, revocation enforcement, future multi-keyId "verified publisher."

**A2 — Install wiring: verify-before-extract + feed real signature + key + bytes into `derivePackageTrust`.** Touch: `install-orchestrator.ts:225-409`, `extension-store.ts:32-127` (+ types), new Drizzle migration + `apps/desktop/src/main/automation/schema.ts`. New sibling helper `install/detached-signature.ts` (so A1/A2 don't fight over orchestrator hunks).
- **A2a — Verify BEFORE extract (security fix).** The registry signature is verified over the **raw downloaded bytes** (orchestrator-local Buffer at `:267`; local-vsix via `io.readFileSync(vsixPath)`) **before** `package-store` unpacks to the content-addressed `unpackedPath`. On failure: **never** create the content-addressed dir (or clean it up); throw `integrity_mismatch`. This removes the extracted-rejected-bytes TOCTOU surface the disk-scanning supervisor would otherwise see.
- **A2b — Resolve + verify the canonical signed manifest.** `resolveDetachedSignature({ source, registryMeta, unpackedPath, io })`:
  - `kind:"firefly"` → reads the served `ServedSignatureMetadata` (canonical manifest + `signatureB64` + `publisherKeyId`) from the D-C2 gallery byte+signature endpoint.
  - `kind:"local-vsix"` (dev/test) → reads a `<vsix>.sig.json` sidecar carrying the same canonical-manifest shape.
  - `kind:"open-vsx"` → **always returns `null`** (Open VSX serves NO CH5 signature; permanently unsigned — see policy gate below).
  - absent → `null`.
  - `registry.resolve(signed.publisherKeyId)` → PEM. Verify the **canonical manifest** signature via `crypto.verify`, then check `signed.manifest.contentSha256 === sha256Hex(rawBytes)` (mismatch → hard fail). `derivePackageTrust({ source, signature, publicKeyPem, data: canonicalManifestBytes, contentSha256 })`. Add `trustAnchorRegistry?` to `InstallExtensionOptions` (`:198-212`) for test injection.
- **A2c — Unsigned/downgrade policy gate (security fix).** A marketplace install (`kind:"firefly"`, or any source designated a signing-authority registry) whose **resolved signature is ABSENT** is **BLOCKED** (typed `unsigned_install_blocked`) unless the source is explicitly `allow-unsigned-with-consent` (MVP-minimal: a per-source flag; full `RegistrySource.trustPolicy` from design §10 is the post-MVP shape). **Present-but-invalid → throws `integrity_mismatch`, nothing written, install aborts.** Unknown/revoked key OR per-package yank → reject. `local-vsix` in local-dev may take the allow-unsigned path for fixtures.
- **A2d — Persist provenance + canonical manifest.** Migration adds `publisher_key_id`, `signature_algorithm`, `signature_b64`, `signed_manifest_json` (the canonical `{namespace,name,version,contentSha256,algorithm,signedAt,publisherKeyId}`), `signed_digest` to `extension_packages`. Behavior table: sig+known+valid+sha-match → `verified`/`signed-third-party` + persist; present-but-invalid → `integrity_mismatch`; absent on signing-authority source → `unsigned_install_blocked`; unknown/revoked key or yanked package → reject.
  - **Migration invariant (CORRECTED — load-bearing):** the runtime migrator (`drizzle-orm` `migrate()` → journal-less branch) reads ONLY the directory-name timestamp (`YYYYMMDDHHMMSS` via `formatToMillis`) + `migration.sql`. `snapshot.json`/`prevIds` is **INERT at runtime** (the in-repo `prevIds` chain is already broken yet applies fine). The only load-bearing artifacts are: (1) a new dir `<YYYYMMDDHHMMSS>_<slug>` whose timestamp is **strictly greater than `20260616213300`** and parseable by `formatToMillis`; (2) `migration.sql` with `ALTER TABLE extension_packages ADD COLUMN …` statements separated by `--> statement-breakpoint`. `snapshot.json` may be copied/updated for `drizzle-kit` dev-time parity but is NOT required at runtime — **do not burn effort hand-crafting `prevIds`.**
- Test (extend `install-orchestrator.test.ts` + new `migration-columns.test.ts`): signed+known+valid → `verified`/`signed-third-party`, keyId+canonical manifest persisted; tampered bytes (sha mismatch) → rejects `integrity_mismatch`, store fn **not called**; **absent signature on firefly source → rejects `unsigned_install_blocked`** (downgrade test); unknown/revoked key → reject; yanked package → reject; **`ensureDb()` on a fresh in-memory libsql asserts the new columns exist** (catches a malformed migration dir name).
- Unblocks: trust derivation for the customer story; feeds C (consent reads `trust.trustTier`), F (descriptor persistence), the spawn gate (B1/F), and E2.
- **Depends on A1 + A3 contract + A4 fixtures.** **Producer/consumer seam:** A2's derived `trust.trustTier` is the SAME local C3 consumes at `persistInstallGrants` (`:387`) — `signed-third-party` from A2 must reach `computeInstallConsentPlan` so auto-grant-by-trust behaves correctly.

**A3 — Publish-side signing contract (CHANGED: canonical manifest, not raw bytes).** New shared types `shared/firefly-plugin/registry-signature-contract.ts` + design `§16.x`. **DECISION: sign a canonical signed-manifest, not raw bytes.**
- `CanonicalSignedManifest { namespace; name; version; contentSha256; algorithm:"ed25519"; signedAt; publisherKeyId }` — the bytes signed are the deterministic JSON serialization of this object.
- `ServedSignatureMetadata { manifest: CanonicalSignedManifest; signatureB64 }`; maps 1:1 to client `DetachedSignature { algorithm, signatureB64, publisherKeyId }` + the verified manifest. Client verifies the manifest signature, then cross-checks `manifest.contentSha256 === sha256Hex(rawBytes)` (mismatch → hard fail) **before** trusting.
- `SignatureState` and `DetachedSignature` wire types live HERE (shared, no `node:crypto`).
- Server routine: `priv = createPrivateKey(hush get FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY)`; build `CanonicalSignedManifest`; `crypto.sign(null, canonicalBytes, priv)` → base64; `publisherKeyId = ACTIVE_KEY_ID` (newest non-revoked).
- **Hard invariant (both repos):** `sign(canonicalManifestBytes)` server-side, `verify(canonicalManifestBytes)` client-side — byte-identical canonical serialization. `contentSha256` inside the manifest binds the actual package bytes; anti-rollback comes from `version` being inside the signed manifest. Encode as a one-line comment in `signature-verify.ts` and the cloud signer. **Add a per-package yank/revocation list** (`yanked-packages.json` / config) honored at install: `{namespace,name,version}` in the yank set → reject even if the signature verifies.
- Unblocks: A2b field reads, A4 CLI, D-C3 publish.

**A4 — Signing CLI/helper for fixtures + E2E.** New `scripts/sign-plugin-package.mjs` + committed `apps/desktop/src/main/firefly-plugin/install/__fixtures__/signed/`.
- CLI: `--in <pkg>`, `--out`, `--key-id`, `--namespace`, `--name`, `--version`, `--hush-key FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY`, `--ephemeral` (throwaway ed25519, emit pubkey via `--anchor-out` for CI — no prod secret in CI). Builds the `CanonicalSignedManifest` (sha256 of the package bytes + identity + version + signedAt), signs the **canonical bytes**, emits `<pkg>.sig.json` = `ServedSignatureMetadata`. Default: prod signer from Hush, never prints private key.
- Fixtures: a **code-extension** `bobsoft-linter.fpk` (non-reserved namespace, see E1) + `.sig.json` + `.ephemeral.pub.pem`; a **tampered** pair (bytes mutated so `contentSha256` no longer matches the signed manifest) driving the A2 mismatch test; an **absent-signature** fixture (package with no `.sig.json`) driving the downgrade test. Smoke test: `verifyDetachedSignature` + sha cross-check → pass for clean, fail for tampered, absent for the unsigned fixture.
- Unblocks: A2 unit tests, the E2E signed-fixture, the local firefly-mirror, manual prod publish.

**A5 — Rotation + revocation runbook.** New `trust-anchors/README.md` (or `.llm/wiki/firefly-plugin-signing.md`). Specifies: multi-keyId map model; rotation via `mint-plugin-signing-key.mjs --key-id firefly-registry-root-<year>` → regen `trust-anchors/index.ts` → flip server `ACTIVE_KEY_ID` (old keyId stays trusted = zero-downtime); **two-level revocation** — per-key (`revokedKeyIds`/`revoked-keys.json`, config not file-deletion, kept for forensics) AND per-package yank (`yanked-packages.json` keyed `{namespace,name,version}`, so one bad version is retired without nuking every package signed by that key); re-sign affected packages on rotation; dev/staging/prod signer split with `devOnly` anchors; fingerprint cross-check (record `sha256:…` per keyId); the `packaged` build-bake source for dev-anchor inertness.

> **Note:** E2 (stream E) independently specifies a `trust-anchors.ts` loader and `install-orchestrator.ts:343-348` rewire. **This is the SAME work as A1 + A2** — unified in the swarm plan as the single A1/A2 owner. Do not implement twice.

**Stream A build order:** A6 → (A1 ∥ A3 ∥ A4 ∥ A5) → A2.

---

### Stream B — Electron live execution (activation, worker SDK, dispatch routing, bundle)

**Audit:** `worker-supervisor.ts` `spawn()` (`:281-373`) wires `onMessage`/`onExit`/`onError` but **never posts `activate`** — the `activate` arm exists (`extension-host-protocol.ts:96-101`) with no producer. Fixtures self-post `ready`, masking the gap. `dispatch.ts` `invokePluginCommand` (`:143-206`) / `invokePluginTool` (`:247-334`) only call in-process handlers (built-ins), no worker routing. `worker-request-handler.ts` (storage/capability RPC) already landed and is reachable via `onWorkerRequest`. `build-plugins.ts:136-144` already emits `worker.mjs` but no extension ships one and no SDK wraps raw `parentPort`. **Workers are bare unsandboxed Node** (`worker-thread-spawner.ts:30` is a plain `new Worker(entryPath)` with only a heap `resourceLimit`; no `--permission`, no fs/net sandbox) — so the broker only gates host-mediated RPC, NOT raw `require('fs')` inside the worker. **Trust MUST gate the spawn, not just the install** (see B1 + Stream F).

**B1 — Activation handshake + lifecycle send path + lifecycle migration (OWNS ITS FULL BLAST RADIUS).** Touch `worker-supervisor.ts` `spawn()` (`:281-373`) **and `:317` `case "ready"` active-flip**; edit `extension-host-protocol.ts` (append the `activated` arm **and** fix the stale comment at `:94/95` — NOT purely append-only); **and update every existing test/fixture that drives `ready`→`active`:** `worker-supervisor.test.ts`, `supervisor-boot.test.ts` (+ its inline worker string at `:96-97`), and all 4 `worker-fixtures/*.mjs` (healthy / crashing / hanging / init-crash).
- **Lifecycle migration decision (explicit):** keep `ready` as **transport-up** AND add `activated` as the **active-trigger**. `activated` flips lifecycle to `active` and seeds the dispatch routing table; bare `ready` is **transport-up only** (no longer flips active). Append `workerToHostMessageSchema` arm: `{ type:"activated", pluginId, registeredCommands:[], registeredTools:[] }`. Post `activate` after `entry.worker = worker` (~`:302`): `worker.postMessage({ type:"activate", pluginId, grantedCapabilities, sessionScope })`. Add `resolveActivation?` to `PluginWorkerSupervisorOptions` (`:107`); wire from `grant-store.ts` `resolveGrantedTokens({pluginId, scope:"session"})` (the **stable seam C2 preserves**, NOT the `installPluginGrantResolver` C2 refactors) in `supervisor-boot.ts`.
- **Update ALL fixtures + tests to the new contract:** the 4 `worker-fixtures/*.mjs` post `activated` after `ready` (and tolerate receiving the new host→worker `activate` message); `worker-supervisor.test.ts` asserts `activating` until `activated`, and a `ready`-only fake is driven to `failed` by `scanForHangs()`; `supervisor-boot.test.ts` inline fixture posts `activated`. **Fix the stale `:94/95` comment** ("worker replies with ready") to state the worker replies `activated`.
- **Spawn-gate prep (security):** `spawn()`/`register()` accept the install's `trustTier`/`signatureState`; **Stream F + B1 jointly enforce refusal of node-worker activation unless `verified`/`signed-third-party`** (or `allow-unsigned-with-consent` + local-dev). The gate is read at register/activate, not only at install.
- `onMessage` (`:316-331`): `case "activated":` → `activationSucceeded` + stash registered ids for B3; `case "ready":` → no-op/log. No-`activated`-within-`hangTimeoutMs` → existing `scanForHangs` (`:417-429`) → `failed`+backoff restart ("reload-required"); crash → `activationFailed`. No new states.
- Test (`worker-supervisor.test.ts`, rewritten by B1): exactly one `activate` posted on spawn with grants/scope; lifecycle stays `activating` until fake replies `activated`; a fake that only replies `ready` is driven to `failed` by `scanForHangs()`; **a node-worker whose install is not `verified` is registered-but-never-activated** (spawn gate).
- **Lands first (interface commit) and MUST MERGE before D-C0 mirrors the protocol** (Wave-0 freeze gate). B3, Stream F, and D-C0's protocol mirror all compile/mirror against the merged surface.

**B2 — Worker-side runtime + extension SDK** (all NEW, **no `electron`/`worker_threads` imports** — reused by web/cloud-host).
- `main/firefly-plugin/extension-worker-runtime.ts`: `runExtensionWorker({ port, importMain })`. On `{type:"activate"}` → `await importMain()` → build `ExtensionContext` → `await mod.activate(ctx)` → collect registered ids → post `{type:"activated",…}`. `activate()` throw → `{type:"fatal"}` (fail-loud, no silent ready). `{type:"invoke-command"|"invoke-tool"}` → run handler → `{type:"invoke-result", requestId, ok, data}` (unknown id → `ok:false, errorCode:"handler_not_found"`). `deactivate` → `mod.deactivate?.()` then exit.
- `shared/firefly-plugin/sdk/index.ts`: VS Code-modeled `ExtensionContext { pluginId; grantedCapabilities; sessionScope; registerCommand; registerTool; storage{get/set/delete/list}; capabilities{request} }`; `CommandHandler`/`ToolHandler`; `ExtensionModule { activate; deactivate? }`.
- `shared/firefly-plugin/sdk/host-bridge.ts`: promise-correlated RPC over `parentPort` — `requestId = crypto.randomUUID()`, post `storage-request`/`capability-request`, resolve on matching `…-response`. Worker-side mirror of the landed host `worker-request-handler.ts`.
- Test (`extension-worker-runtime.test.ts`): fake port + `importMain` whose `activate` calls `registerCommand("c1")` → `activated` with `registeredCommands:["c1"]`; `invoke-command` → `invoke-result ok:true`; throwing `activate` → `fatal`, no `activated`; `storage.get` posts `storage-request` and resolves on response.

**B3 — Dispatch routing to the live worker.** Touch `dispatch.ts` (`invokePluginCommand` `:175-184`, `invokePluginTool` `:305-314` — the "no host handler" branch); new `main/firefly-plugin/worker-invoke-router.ts`.
- `WorkerInvokeRouter { isWorkerBacked(pluginId); invoke({pluginId, kind, targetId, args, sessionId, timeoutMs?}): Promise<{ok:true;data}|{ok:false;errorCode;errorMessage}> }`; `setWorkerInvokeRouter` / `getWorkerInvokeRouter`. Live router checks B1's supervisor (`runtimeResolution.location === "electron-utility"` **and** summary `state === "active"`), generates `requestId`, calls B1's `sendInvoke`, resolves on the supervisor's `invoke-result` arm, rejects `worker_invoke_timeout` after `timeoutMs`.
- **Dispatch edit (deny-by-default preserved):** insert **after** the `decideCapabilityAll` broker check (`:159-174`/`:276-291`) and **before** in-process `handlers.get`. Built-ins (non-`electron-utility`) fall through unchanged.
- Test (`dispatch.test.ts`): fake router → worker-backed invocation calls `router.invoke` (not in-process), `{ok:true}`→`completed`, `{ok:false}`→`failed`; **denied capability still returns `denied`, router never called** (broker first); built-in still hits in-process handler.
- **B3 is the SOLE writer of `dispatch.ts`.**

**B4 — Real worker bundle for a third-party CODE extension.** Touch `scripts/build-plugins.ts` (`:136-144`, add SDK alias); the example code-ext directory is owned jointly with E1 (`bobsoft-linter`, see E1).
- `worker/index.ts` is a thin entry: `import { runExtensionWorker } from "<bundled runtime>"; import * as ext from "./extension"; runExtensionWorker({ port: parentPort, importMain: async () => ext })`. Bundle runtime + SDK **into** `worker.mjs` (first-party → leave `external:[]`). Result: self-contained `out/plugins/<id>/worker.mjs` discovered at the content-addressed `unpackedPath` for an installed ext (Stream F) and at `<resources>/plugins/<id>/worker.mjs` for a bundled one.
- Test: build the example into a temp out-root; assert `worker.mjs` exists, is valid ESM, and (via B2's `runExtensionWorker` + fake port) completes `activate`→`activated` and answers one `invoke-command`.

> **Web note (out of B scope, flagged for stream D):** `runtime-location.ts:144-145` resolves `node-worker` on web → `cloud-host`. B2/B3 are transport-agnostic; the **same** runtime/SDK/router serve the firefly-cloud remote host. Keep B2/B3 free of `electron`/`worker_threads`.

> **Unification note:** Stream E (E1.2/E1.3/E2.1/E2.2/E2.3) describes the same worker-SDK + activation + dispatch-routing work using slightly different names. **B is canonical for the runtime/protocol shape.** Lifecycle-active trigger = B1's `activated` (richer: carries the registered-id table). E's fixture is the concrete extension B4 generalizes; build ONE fixture (`bobsoft-linter`), not two.

---

### Stream C — Consent threading + grant persistence (incl. update re-consent + revocation)

**Audit:** Renderer dialog is wired but its result is dropped — `marketplace-panel.tsx:509-517` discards `approved` (L513-515 TODO); mutation input (`:271`) has no `consentedCapabilities`. **Gallery search hardcodes `category:'Themes'` (`:63`) and theme-only copy.** Preload forwards `input` verbatim (`preload/index.ts:270-271`). IPC `installArgsSchema` (`ipc.ts:161-173`) strips unknown keys. `host-authority.ts:267-300` `installExtension` calls the orchestrator with **no `options`** → `grantStore` undefined; the boot resolver's resolved `GrantStore` is **discarded** at `index.ts:337`. `persistInstallGrants` **already accepts** `consentedCapabilities` (`install-orchestrator.ts:66,75`) and `consentPlanToGrantRecords` honors it (`install-consent.ts:94,112-126`). Deny-by-default in dispatch already holds (`dispatch.ts` `defaultGrantResolver` `:48-54`). **The pre-install consent dialog is driven by `ext.requiredCapabilities` (`marketplace-panel.tsx:290`), but `MarketplaceSearchEntry` (`host-authority-types.ts:153-161`) has NO `requiredCapabilities` field** — it exists only on the installed-list `HostPluginListResult.plugins`. So consent **never fires** from a real gallery install today. **Grant rows are keyed `pluginId:scope:scopeId:capability` with NO version** (`grant-store.ts:38-45`) → an update silently re-inherits old grants. `grant-store.ts:62 revoke` exists but is never called.

**C1 — Add `consentedCapabilities` to the install contract + capability metadata to the gallery entry.** Touch `shared/firefly-plugin/host-authority-types.ts` (`MarketplaceInstallInput` `:169`, `MarketplaceSearchEntry` `:153-161`), `preload/api.d.ts` (`:906`), `ipc.ts` (`installArgsSchema` `:161-173`).
- **`MarketplaceInstallInput` is a SINGLE FLAT interface** (`kind:"open-vsx"|"local-vsix"|"firefly"`), defined **TWICE** (also `preload/api.d.ts:906`). Add `consentedCapabilities?: readonly string[]` to the single interface in BOTH hand-maintained copies (one add each, not "both members"). In `ipc.ts`, the **`z.union`** `installArgsSchema` IS two members — add `consentedCapabilities: z.array(z.string().min(1).max(200)).max(200).optional()` to **both union members** (this is where "preserve narrowing" applies). **Extract+export `installArgsSchema`** so it's unit-testable. No preload-logic edit.
- **Add `requiredCapabilities?: readonly string[]` (+ `trustHint?`, `runtimeHint?`) to `MarketplaceSearchEntry`** so the gallery adapter can surface declared caps pre-install and the consent dialog can fire. (Two-phase fallback documented in C3 if a source cannot serve declared caps pre-install.)
- Test (`ipc-install-args.test.ts`): firefly input with `["fs:write"]` parses + retains; absent → `undefined`; non-string rejected. `MarketplaceSearchEntry` round-trips `requiredCapabilities`.

**C2 — Inject the host grantStore.** Touch `grant-store.ts`, `index.ts:337`, `host-authority.ts:267-300`.
- `grant-store.ts`: add lazily-cached `getHostGrantStore(): Promise<GrantStore>` (mirrors `getPluginStorageService`); refactor `installPluginGrantResolver` (`:85-90`) to resolve via it → **one** store instance shared by boot resolver + install path. **Preserve the stable `GrantStore.resolveGrantedTokens` seam B1 depends on** (do not change its signature).
- `host-authority.ts` `ElectronHostAuthority.installExtension` (`:290`): `const grantStore = await getHostGrantStore(); installExtension(installInput, { grantStore, consentedCapabilities: input.consentedCapabilities })`. **C2 edits ONLY `ElectronHostAuthority`.**
- Test (`grant-store-host-singleton.test.ts`): `getHostGrantStore()` referentially stable across calls (in-memory libsql, `freshGrantStore` pattern).

**C3 — Thread the approved set + fix the gallery consent gate.** Touch `install-orchestrator.ts` (`InstallExtensionOptions` `:198-212`, grant block `:381-389`), `host-authority.ts` (covered by C2), `marketplace-panel.tsx` (`:57-69`, `:271`, `:286-296`, `:509-517`).
- Orchestrator: add `consentedCapabilities?: readonly string[]` to options; pass into `persistInstallGrants({ … consentedCapabilities: options.consentedCapabilities })` (keep the `if (options.grantStore)` gate). **`trust.trustTier` from A2 (`signed-third-party`) flows into `computeInstallConsentPlan` here — the A2→C3 producer/consumer seam.**
- Renderer: **remove hardcoded `category:'Themes'` + theme-only copy; add a code-extension / firefly-gallery browse surface.** Drive the consent dialog off the gallery entry's NEW `requiredCapabilities` (C1) so it fires for a medium+ code ext; widen mutation input to `{ kind; namespace; name; version; consentedCapabilities? }`; pass into `getMarketplaceBridge().install({ kind:"firefly", …, consentedCapabilities })`; **resolve the L513-515 TODO** — `onResolve` passes `consentedCapabilities: approved`. No-capability fast path leaves it `undefined`.
- **Two-phase fallback (documented):** if a registry cannot serve declared caps on the search entry, install becomes download+parse-manifest → present consent from the REAL manifest → persist grants → activate. MVP prefers the served-caps path (C1) for the firefly gallery; the two-phase path is the safety net so consent can never be skipped.
- Test (`install-orchestrator-consent-thread.test.ts`): `installExtension(fireflyInput, { grantStore, consentedCapabilities:["fs:write"], io, store })` for a code-ext declaring `contributes.capabilities:["fs:write"]` → `resolveGrantedTokens` includes `fs:write` (`granted/user`); a non-consented declared capability stays `prompt-required`.

**C4 — Consent↔dispatch invariant (TEST ONLY — no `dispatch.ts` edit).** New `grant-consent-dispatch.test.ts`.
- Fresh in-memory grant store → `persistInstallGrants` for a `signed-third-party` plugin declaring `["fs:write","net:http"]` with `consentedCapabilities:["fs:write"]` → build resolver via `createDbGrantResolver(store)` → assert `fs:write` present, `net:http` absent. Feed both into `decideCapabilityAll` (`trust:"signed-third-party"`) → `granted:true` for `["fs:write"]`, `false` for `["net:http"]`.

**C5 — Grant versioning + re-consent on update + revoke on uninstall/disable (security).** Touch `grant-store.ts` (`buildGrantId` `:38-45`, `revoke` `:62`, `resolveGrantedTokens` `:157-172`), `install-consent.ts` (`:89-129`).
- **Bind grants to version (or a manifest-capability-set hash).** `buildGrantId` includes a version/cap-set-hash component so a v1 grant does NOT auto-satisfy v2.
- **On update:** recompute the consent plan against the NEW capability set; any newly-declared or materially-changed **medium+** capability is forced back to `prompt-required` and re-prompted before the new version activates. Unchanged cap-sets may carry forward.
- **On uninstall/disable:** call `grantStore.revoke` to revoke/tombstone the plugin's grant rows so a later re-install re-consents.
- **Trust-tier change (e.g. `signed-third-party`→`unsigned` on re-source):** existing `granted/user` rows are invalidated; the install is re-evaluated under the new tier (an unsigned re-source is blocked per A2c regardless).
- Test (`grant-update-reconsent.test.ts`): install v1 consenting `fs:write` → install v2 redeclaring `fs:write` → grant is **NOT auto-inherited** without re-consent; uninstall revokes rows; re-install re-consents.

> **C↔B `dispatch.ts` collision:** Stream C must **NOT edit `dispatch.ts`** — it reads stable seams (`setGrantResolver`/`createDbGrantResolver`/`GrantResolver`, `decideCapabilityAll`). **B is the sole writer of `dispatch.ts`.**
> **C↔A `install-orchestrator.ts`:** A2 owns the verify/signature block + `InstallExtensionOptions` signature additions; C3 owns the `:381-389` grant block + the `consentedCapabilities` option. Adjacent + **semantically coupled** (A2's `trust.trustTier` is the same local C3 passes to `persistInstallGrants` `:387`). **Serialize: A2 lands first, C3 rebases onto it** (see §5).
> **C↔D `host-authority.ts`:** C2 edits **only** `ElectronHostAuthority.installExtension`; D edits **only** `CloudHostAuthority`. Disjoint methods, same file — sequence/flag.

---

### Stream F — Code-extension install path + catalog bridge + live lifecycle (NEW — the biggest miss)

**Audit (verified):** `installExtension` (`install-orchestrator.ts:296-368`) is a VS-Code-**THEME** importer, not a code-extension installer. It HARD-FAILS on any non-theme package: `:300-304` `if (!themeDeclarations || themeDeclarations.length === 0) throw new Error('Phase 1 supports theme packages only')`. It reads VS Code `package.json` (`:297-298`), converts only `contributes.themes` (`:309 convertVscodeThemePackage`), persists `themesJson` + `conversionResult.externalId` as identity, and **never calls `parseJsonPluginManifest`** on a Firefly `manifest.json` with a `runtime` block / `contributes.tools`. The running catalog (`authority.ts:104-109 buildCatalogWithDiskPlugins → discoverDiskManifests(resolvePluginRoots())`) is built ONLY from built-in + plugin-root disk manifests; it **never reads `extension_installations`/`extension_packages`** — so even if a code ext installed, its descriptor / command-tool projections / `runtimeResolution` / `requiredCapabilities` would never exist in the host, and the supervisor can't register it, dispatch can't route to it, the renderer can't project it. `bootPluginWorkerSupervisor` is a hard boot-once singleton (`supervisor-boot.ts:129 if (booted) return booted`, called once at `index.ts:333`) — a marketplace install happens AFTER boot, so boot-time discovery alone never sees a freshly downloaded extension. `uninstallExtension` (`:419-423`) only flips the install row to `removed`. There is NO update path.

**F1 — Code-extension install branch in `installExtension`.** Touch `install-orchestrator.ts:296-368`, `extension-store.ts` (descriptor persistence).
- **Remove the theme-only `throw` (`:300-304`)**; branch on package shape: a Firefly `manifest.json` (with `runtime` / `contributes.tools|commands|panels|widgets`) → `parseJsonPluginManifest` → build + persist the plugin manifest/descriptor (commands, tools, `runtimeResolution`, `requiredCapabilities`) keyed by the manifest's `pluginId`/namespace. VS Code theme `package.json` → existing `convertVscodeThemePackage` path (unchanged). FPK/Firefly path is the customer-story path.
- **Order vs A2:** A2's verify-before-extract + trust derivation runs first; F1 consumes the verified, unpacked content. F1 owns the **manifest-parse + descriptor-persist** region; A2 owns the **trust/signature** region; same file → sequence A2→F1 (or co-integrate) — see §5.
- Test: a signed code-ext `manifest.json` → parsed → descriptor row persisted with commands/tools/`requiredCapabilities`/`runtimeResolution`; theme package still imports via the legacy path.

**F2 — Install→catalog bridge (`discoverInstalledManifests`).** Touch `authority.ts` (`buildCatalogWithDiskPlugins`), new `main/firefly-plugin/discover-installed-manifests.ts`.
- Add `discoverInstalledManifests(packageStore)` as a manifest **source alongside `discoverDiskManifests`**, reading `extension_installations` joined to `extension_packages` (enabled, not removed/quarantined) and yielding the persisted descriptors so `getPluginCatalog()` includes installed code extensions. Projections (command/tool/panel/widget), `runtimeResolution`, and `requiredCapabilities` flow into the host catalog → supervisor can register, dispatch can route, renderer can project.
- Test: an installed enabled code-ext record → appears in `buildCatalogWithDiskPlugins()` output with its tool/command projections; a `removed`/`quarantined` record is excluded.

**F3 — LIVE post-boot worker registration (`registerInstalledExtensionWorker`).** Touch `supervisor-boot.ts` (the discovery + new live-register API), hook from install completion in `host-authority.ts`/`install-orchestrator.ts`.
- `registerInstalledExtensionWorker(installation)`: resolves the content-addressed `unpackedPath/worker.mjs`, **reads the install's `trustTier`/`signatureState` and REFUSES to register/activate a `node-worker` unless `verified`/`signed-third-party`** (or `allow-unsigned-with-consent` + local-dev — security gate, jointly with B1), then calls `supervisor.register(...)` + (if enabled) `supervisor.activate(...)` on the **ALREADY-BOOTED singleton** (NOT just boot-time discovery). Invoked from install completion so a downloaded extension runs **without an app restart**. Fail-loud if a `node-worker` install has no `worker.mjs`.
- Boot-time discovery extension (adding `unpackedPath` to `discoverPluginWorkerEntries`) is **secondary** (covers app-restart-after-install only). **F3 owns the discovery+live-registration region of `supervisor-boot.ts`; B1 owns the activation-wiring region; sequence B1→F3** (see §5).
- Test: an installed `signed-third-party` record → `registerInstalledExtensionWorker` registers+activates on the booted supervisor (spawn→activate→activated); an installed record with `signatureState!='verified'` → **registered-but-never-activated** (or rejected), proving the spawn gate; a `node-worker` install missing `worker.mjs` → fails loud.

**F4 — Uninstall / disable / update lifecycle (design §8).** Touch `install-orchestrator.ts` (`uninstallExtension` `:419-423`, new update path), `host-authority.ts` (`setEnabled` `:209-224`), the hot-reload executor.
- **Uninstall:** `supervisor.stop` the worker + `grantStore.revoke`/tombstone the plugin's grant rows (C5) + drop the install's projections from the catalog bridge (F2) + flip the row to `removed`. (Package-byte GC of unreferenced content-addressed bytes + design §8 step-6 "preserve user state behind explicit remove-data" are **explicitly scoped: GC tracked post-MVP; remove-data is a documented follow-up** — not silently dropped.)
- **Disable:** tear the worker down (`supervisor.stop`); the installed extension stays catalog-visible-but-inactive and is **live re-registerable** (F3) on re-enable without restart.
- **Update:** re-download + re-verify the **pinned** version (A2/A3 canonical-manifest + yank check), restart the host group via the existing hot-reload `restart` cycle, and **re-consent on capability changes (C5)** before the new version activates.
- **Wire marketplace install/update/uninstall into the hot-reload executor, not just the dev file-watcher** (`dev-watcher-boot.ts`).
- Test: uninstall stops the worker + revokes grants + removes projections; disable tears down + re-enable re-registers live; update re-verifies + re-consents on a changed cap-set.

> **Stream F build order:** A2 (verify+trust) → F1 (manifest parse/persist) → F2 (catalog bridge) → F3 (live register, after B1) → F4 (lifecycle). E2.5 drives the **real** `installExtension({kind:"firefly"})` through F1→F2→F3.

---

### Stream D — firefly-cloud server + palot web projection cache

**Repo located:** `firefly-cloud` EXISTS at `/Users/hassoncs/src/ch5/firefly-cloud` (`firefly-monorepo`, pnpm@9.15.9, node 24). **No scaffold needed.** Shape: `apps/firefly-api/` = Hono on Cloudflare Workers (D1 `c.env.DB`, Durable Objects `WS_GATEWAY`/`WsGatewayDO`, Drizzle, Zod); entry `apps/firefly-api/src/index.ts` is a **6397-line monolith** — the **first `app.route(...)` mount is at `:5063`** (NOT `:52-53`, which is the import block); routes are mounted near the bottom alongside the other `app.route(...)` calls. Global auth middleware supports Bearer (`authorization`, `x-runtime-secret`, `ALPHA_API_KEY` — pattern at `:1389`) + better-auth JWT. Hush wired (`@chriscode/hush`, stage-split files). D1 (SQLite) + R2 for bytes. **`packages/plugin/` has NO `src/` yet** (only `index.d.ts`/`index.js`/`package.json`, name `@firefly/plugin`) — **D-C0 scaffolds `packages/plugin/src/` from scratch.** This is a hot monolith file every route touches; concurrent unrelated firefly-cloud work raises merge-conflict odds.

#### Palot-side (this repo)

**D-P1 — Web projection cache for `CloudHostAuthority` sync reads.** Problem: `host-authority.ts:380-425` — every sync read throws `CloudHostNotConfiguredError` forever. New `main/firefly-plugin/cloud-projection-cache.ts` (+ `.test.ts`); touch `host-authority.ts` (`CloudHostAuthority` only, `:373-480`).
- `CatalogProjectionSnapshot { revision; fetchedAt; catalog; tools; panels; navSidebars; widgets; commands; themes; describeByPluginId; stateByPluginId }`; `CloudProjectionCache { hydrated; revision; hydrate(snapshot); catalog(); describe(id); state(id); listTools(); … }`; `ProjectionCacheNotHydratedError`. Each sync read delegates to the cache (throws-until-hydrated, **never** a fabricated empty projection). `CloudHostAuthority` takes optional `cache?` ctor arg; on construction/first-read kick `fetchProjectionSnapshot()` → `hydrate`, subscribe for push-on-change.
- Test: unhydrated → each reader throws named error; post-`hydrate` returns slices; higher `revision` replaces, lower/equal ignored (no stale regression). `bun:test`.
- Add `CatalogProjectionSnapshot` to `host-authority-types.ts` — **D-P1 owns that one additive block.**

**D-P2 — RPC client projection channel (prereq for D-P1).** Touch `cloud-host-rpc-client.ts` (+ test). **`cloud-host-rpc-client.ts` is a GENERIC transport** — `call<T>(method, params)` (`:75-93`), NO named methods. **The 7 §16 method names + param keys are authored in `host-authority.ts:432-478` (`CloudHostAuthority`)** and already match the contract — **no change there.** Add `fetchProjectionSnapshot(sinceRevision?): Promise<CatalogProjectionSnapshot>` (= `call("projectionSnapshot",{sinceRevision})`) + `subscribeProjection(onSnapshot): () => void` to the client. Keep fail-fast (`CloudHostNotConfiguredError` when unconfigured).

#### firefly-cloud-side (separate repo — buildable spec)

> House style: Hono route modules `apps/firefly-api/src/routes/*`, Zod params, D1 via `c.env.DB`, Drizzle `apps/firefly-api/src/db/schema.ts`, R2 for bytes, Hush for secrets, vitest tests. Shared host module in `packages/plugin/src/` (scaffolded by D-C0).

**D-C0 — Shared type mirror + signing format (SPLIT for the freeze gate).** New `packages/plugin/src/host-authority-types.ts` (mirror palot shapes + `CatalogProjectionSnapshot`) + `packages/plugin/src/signature-format.ts` + `packages/plugin/src/worker-protocol.ts`.
- **D-C0a (early — Wave 1, depends only on byte-stable `signature-verify.ts` + A3 contract):** `signature-format.ts` exporting the `CanonicalSignedManifest` + `DetachedSignature` shapes and `signPackageManifest(manifest, privateKeyPem, keyId): DetachedSignature` via `crypto.sign(null, canonicalBytes, key)`. **THE cross-repo guard test:** sign a known `CanonicalSignedManifest` with the dev key, assert `signatureB64` verifies under the committed `palot/.../trust-anchors/firefly-registry-root-2026.pub.pem` (vendor the PEM as a fixture) AND `contentSha256` round-trips. If this fails, the marketplace is broken end-to-end.
- **D-C0b (gated — depends on B1's MERGE):** `worker-protocol.ts` mirroring `palot/.../extension-host-protocol.ts` **incl. the final `activated` arm**. **Must NOT start until B1 merges** (otherwise it mirrors a pre-`activated` shape and D-C4 drifts).

**D-C1 — `POST /firefly-plugin/rpc`.** New `routes/firefly-plugin-rpc.ts`; mount in `index.ts` **at the existing `app.route(...)` cluster (~`:5063`), NOT `:52-53`**. Auth: `FIREFLY_CLOUD_TOKEN` bearer (new env slot, validated like `ALPHA_API_KEY` at `:1389`) OR better-auth JWT. Body `{ method, params }` (Zod discriminated union) → server `HostAuthority` → JSON result; error → non-2xx (palot raises `CloudHostRpcError`). Methods: the 7 + `projectionSnapshot` (D-C5). **Method names + param keys + result shapes are a HARD MATCH** to palot `host-authority.ts:432-478`.

**D-C2 — Gallery (index / search / byte serving + served signature).** New `routes/firefly-plugin-gallery.ts` + Drizzle `marketplace_extensions` / `marketplace_versions` (incl. `signatureB64`, `publisherKeyId`, `signedManifestJson`, `fpkR2Key`); bytes in **R2**. `gallerySearch(options) → MarketplaceSearchResult` **incl. `requiredCapabilities` on each entry** (so palot's pre-install consent dialog fires); `GET /firefly-plugin/gallery/:ns/:name/:version/package` serves bytes + the `ServedSignatureMetadata` (canonical manifest + signature; header or sidecar). Search shape = palot `MarketplaceSearchResult`/`MarketplaceSearchEntry`. **This is the byte+signature endpoint the `kind:'firefly'` adapter consumes.**

**D-C3 — Publish + server-side signing (ties to A; canonical manifest).** New `routes/firefly-plugin-publish.ts` + D-C0a signer. `POST /firefly-plugin/publish` (dedicated publish bearer from Hush) → validate manifest → sha256 → build `CanonicalSignedManifest{namespace,name,version,contentSha256,algorithm,signedAt,publisherKeyId:"firefly-registry-root-2026"}` → **sign the canonical bytes with `FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY` (ed25519 PKCS#8 from Hush, stage-split)** → R2 + `marketplace_versions` row (with `signedManifestJson`). Sign-with-newest, keep old keyIds, support revoked-set + per-package yank. Missing key → fail-fast typed 503 (no unsigned publish). Inject via `wrangler secret`/env from the Hush target at deploy — never `.env`.

**D-C4 — Remote extension host (cloud-host) — reuse stream B runtime + hard server-side verify (SECURITY, own heavy agent).** New `apps/firefly-api/src/firefly-plugin/cloud-host.ts` (or a Durable Object per workspace mirroring `WsGatewayDO` for server-side quarantine). Implements `invoke`/`invokeTool` by running the plugin's `node-worker` server-side over the **same** stream B protocol (`hostToWorkerMessageSchema`/`workerToHostMessageSchema` from `packages/plugin` D-C0b) → map to `HostToolDispatchEnvelope`. **Server-side broker + canonical-manifest signature re-verify (§10) BEFORE activation — never trust the client.** Service `storage-request` against D1/R2 per workspace using palot's storage-scope contract. Bundle the protocol schema from `packages/plugin` (ONE definition).
- **Web-trust TCB note (security):** the web build's `CloudHostAuthority` is a pure pass-through with ZERO client-side verification — the entire web trust model is "firefly-cloud verified server-side." Therefore `FIREFLY_CLOUD_URL`/token authenticity is **part of the TCB** (pin/verify the endpoint; TLS-pin or signed response). **D-C4's server-side verify is a HARD, separately-proven gate.** Add a server-side test: **an unsigned/tampered package is REJECTED at the cloud host BEFORE activation.** E3-live is **required for web-DoD**, not optional.

**D-C5 — `CatalogProjection` snapshot fetch + push-on-change.** The `projectionSnapshot` RPC method (in D-C1's router) + a push channel reusing `WsGatewayDO`. `projectionSnapshot(sinceRevision?) → CatalogProjectionSnapshot`; on any catalog mutation (install/uninstall/setEnabled/applyTheme/refresh) broadcast a new snapshot with incremented `revision`. Snapshot assembled the same way `ElectronHostAuthority.catalog()/listTools()/…` assemble theirs. Each slice = palot `HostPlugin*Result` so D-P1's cache serves sync reads verbatim.

---

### Stream E — Signed sample CODE extension + E2E (both builds) + test strategy

> E's per-task SDK/activation/dispatch/trust-anchor items are **the same work as B + A + F**, surfaced from the E2E angle. They are unified into B/A/F ownership in §5. What is **unique to E** is: the concrete `bobsoft.linter` fixture (non-reserved namespace), and the two end-to-end integration tests that drive the **real** install path.

**E1 — The signed sample CODE extension fixture (`bobsoft.linter`).** Owned as one directory: `apps/desktop/plugins/bobsoft-linter/**` + sign step. (This is the concrete instance of B4's example.) **Uses a NON-reserved namespace** (`acme` is a hard-coded reserved exemplar at `manifest.ts:43,676` — a real third-party customer uses a non-reserved namespace + `trust:"signed-third-party"`, the code path the customer story actually exercises).
- E1.1 manifest: `runtime { hostKind:"node-worker", surfaces:["electron","web"], webStrategy:"cloud-host" }`; one command `bobsoft.linter.greet`; one tool `plugin.bobsoft.linter.read-config` (`requires` a **medium+** capability so consent fires — verify risk in `capabilities.ts`/`risk-register.ts`); **at least one panel OR widget contribution** to prove contribution-family projection-through-worker for an installed code ext (OR explicitly scope panels/widgets out of MVP in writing — do not silently narrow design §6); `trust:"signed-third-party"`; non-reserved namespace. Test: parse + assert resolution → `electron-utility` (electron) / `cloud-host` (web).
- E1.2 `worker/index.ts`: real `activate()` consuming the B2 SDK; `read-config` does a storage round-trip and returns data. This is the artifact that **actually executes**.
- E1.3 = **B2's SDK** (same file). Build once.
- E1.4 build+sign = **A4 + B4** (build `out/plugins/bobsoft.linter/`, emit `<pkg>.sig.json` = `ServedSignatureMetadata` with canonical manifest). Test: `verifyDetachedSignature` + sha cross-check against committed anchor → pass; flip a byte → sha mismatch → fail.

**E2 — Electron E2E proof (drives the REAL install path).** (E2.1 activation = B1; E2.2 routing = B3; E2.4 trust-anchors = A1/A2; install branch+bridge+live-register = F1/F2/F3 — unified.) **Unique:**
- **E2.5 — The Electron E2E integration test** `e2e/signed-extension-electron.e2e.test.ts` (`bun:test`, real `worker_threads`). **Drives the REAL `installExtension({kind:"firefly", …})` against a faithful local firefly-mirror** (serves the CH5 `ServedSignatureMetadata` the same way D-C2 does — NOT a hand-attached `local-vsix` sidecar, NOT a pre-built plugin-roots fixture). Asserts in order:
  1. gallery search surfaces `requiredCapabilities` → **consent dialog fires for the medium+ cap BEFORE grants are written** (assert grants not yet present at dialog time);
  2. install: **verify-before-extract** (rejected bytes never create the content-addressed dir), canonical-manifest verify + sha cross-check → trust `signed-third-party`/`verified`; corrupted byte → `integrity_mismatch`; **absent signature → `unsigned_install_blocked`** (downgrade);
  3. F1 parses `manifest.json` → descriptor persisted; F2 bridge → catalog includes the code ext with its tool/command projections;
  4. `persistInstallGrants` with the consented medium token → `granted/user` row, rest `prompt-required` (the A2→C3 seam: signed trust + consented cap);
  5. boot supervisor, `enable` → **F3 `registerInstalledExtensionWorker` registers+activates on the booted singleton → `active`** (spawn→`activate`→`activated`); a not-`verified` install is **registered-but-never-activated** (spawn gate);
  6. `invokePluginTool` → `completed` with **worker-produced** data;
  7. revoke/deny → broker `permission_denied`, no silent run;
  8. **lifecycle:** disable tears the worker down; uninstall stops the worker + revokes grant rows; **update v1→v2 redeclaring the medium cap re-prompts (no silent inherit)**.

**E3 — Web E2E proof (live leg REQUIRED for web-DoD).** `e2e/signed-extension-web.e2e.test.ts`. Inject a `fetchFn` into `createCloudHostRpcClient` emulating the §16 contract → `CloudHostAuthority.invokeTool` → `completed`; `runtime-location` resolves fixture → `cloud-host` on `{build:"web"}`; missing `FIREFLY_CLOUD_URL` → `CloudHostNotConfiguredError`. **The live-server leg (against D-C1/D-C2/D-C4/D-C5) is REQUIRED for web-DoD** (web trust is wholly delegated → D-C4 server-side verify must be separately proven: an unsigned/tampered package is rejected at the cloud host before activation). Until D lands, the in-repo proof is **contract-level (faked fetch)** AND the web-DoD remains open.

**E4 — Verification commands (CORRECTED — package is `@ch5me/elf-desktop`, repo uses bun, script is `check-types`, no `test` script).** Build fixture first: `bun scripts/build-plugins.ts && node scripts/sign-plugin-package.mjs --plugin bobsoft.linter --namespace bobsoft --name linter --version <v>`. Typecheck (must **EXIT 0 captured directly**, ~3min): `cd apps/desktop && bunx tsgo --noEmit` (or `bun run check-types`). Unit/integration: `bun test apps/desktop/src/shared/firefly-plugin apps/desktop/src/main/firefly-plugin`. Lint: `bun run lint`. **No `pnpm`, no `@palot/desktop`, no `typecheck` script, no `bun test` of a package `test` script — target globs directly.**

---

## 4. Sequencing DAG

```
              ┌──────────────────────────────────────────────────────────────┐
              │  WAVE 0 — CONTRACT FREEZE GATE (real gate, must MERGE first)  │
              │  §16 RPC wire · DetachedSignature+CanonicalSignedManifest     │
              │  · worker proto incl. `activated` arm  →  B1 MERGES here      │
              └───────────────────────────────┬──────────────────────────────┘
                                              │
   WAVE 1 (parallel, disjoint files):
   ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬───────────┐
   │ A6  │ A1  │ A3  │ A4  │ B1* │ B2  │ C1  │ D-P2│ D-C0a     │
   │union│anchr│sign │sign │activ│workr│cons.│proj │sig mirror │
   │drift│reg  │ctrct│CLI  │+life│runtm│+caps│rpc  │+guard test│
   └──┬──┴──┬──┴──┬──┴──┬──┴──┬──┴──┬──┴──┬──┴──┬──┴─────┬─────┘
      │     │     │     │     │(MERGE before D-C0b + F3)  │
      └─→A2←┴─────┴─────┘     ├─→ B3 (dispatch routing)   └─→ D-P1 (proj cache)
   (A6+A1+A3+A4) verify+trust │
      │                       │
      ├─→ F1 (code-ext parse/persist) ─→ F2 (catalog bridge)
      │                       │
   C2 (host grantStore)       │   B4 (bundle, needs B2)
      │                       │      │
      └─→ C3 (thread+gate) ─┐ │   E1 (bobsoft.linter fixture = B4 instance)
                            │ │      │
                C5 (grant version/re-consent/revoke)
                            │ │      │
   D-C0b (proto mirror, after B1) → D-C1/D-C2/D-C3 / D-C4(heavy,own) / D-C5
                            │ │      │
   F3 (live register, after B1) ─────┤
   F4 (uninstall/disable/update) ────┤
   ══════════════════════════════════╪══════════════════════════════════════
                                      ▼
       E2.5  ELECTRON E2E (REAL install): A2+B1+B3+B4+C2+C3+C5 + F1+F2+F3+F4 + E1
       ─── closes the Electron customer story ENTIRELY IN-REPO ───
                                      │
       E3  WEB E2E: contract-level now ; LIVE (required for web-DoD) after D-C*
```

**Critical path (Electron customer story, all in-repo):**
`FREEZE/B1-merge → {A6→A1→A2} → F1→F2 ∥ {B3, B2→B4} ∥ {C1→C2→C3→C5} → F3→F4 → E1 → E2.5`.

**Critical path (Web):** adds `D-P2→D-P1` (palot) and `D-C0a→D-C0b(after B1)→D-C1/D-C2/D-C3/D-C4/D-C5` (firefly-cloud) → upgrade E3 from contract-level to **live (web-DoD)**.

**Wave-1 fully-parallel set (9 agents, zero shared files):** A6, A1, A3, A4, B1, B2, C1, D-P2, D-C0a. (B1 must MERGE before D-C0b and F3; A6 is a tiny pre-req for A2.)

**Electron closes in-repo (A+B+C+F+E); Web (D) is the cross-repo addition AND its live leg is part of DoD.**

---

## 5. Swarm Execution Plan

**Rule (memory: "swarm subagents: no git mutation"):** impl subagents **do NOT commit/push**. Each agent edits only its **disjoint** file set and returns a diff/summary. The **orchestrator integrates, re-runs typecheck + the full `bun test` glob on the merged tree, then commits coherent slices and pushes.** Re-verify the merged tree, not the per-agent trees. The orchestrator integrates on a **clean base** (the tree may be dirty with unrelated renderer/dock work — `ui.ts`, `agent-detail.tsx`, `dock-shell.tsx`, untracked `side-zone-toolbar.tsx`).

### Wave 0 — Freeze gate

- **B1 MUST MERGE** (worker protocol final incl. the `activated` arm; `extension-host-protocol.ts` comment fixed) before D-C0b mirrors the protocol and before F3 registers workers. Signature/type half of the freeze (A3 contract + `signature-verify.ts` byte-stable shapes) can be locked in parallel.

### Wave 1 — disjoint-file agents (run all in parallel)

| Agent | Owns (exclusive files) | Notes |
|---|---|---|
| **W1-A6** | `signature-verify.ts` (union→import from A3 contract), `apps/desktop/src/main/automation/schema.ts` (state enum), `extension-store.ts` (state type) | tiny pre-req; **must merge before A2 + C/A/F touch these** |
| **W1-A1** | `shared/firefly-plugin/trust-anchor-registry.ts` (+test), `trust-anchors/index.ts` (build-baked `PACKAGED`) | fully isolated |
| **W1-A3** | `shared/firefly-plugin/registry-signature-contract.ts` (`CanonicalSignedManifest`, `DetachedSignature`, `SignatureState`), design `§16.x`, yank-list shape | contract only |
| **W1-A4** | `scripts/sign-plugin-package.mjs`, `install/__fixtures__/signed/**` (clean + tampered + absent) | isolated |
| **W1-A5** | `trust-anchors/README.md` | docs only |
| **W1-B1** | `worker-supervisor.ts` (incl. `:317`), `extension-host-protocol.ts` (append `activated` + fix `:94/95` comment), **`worker-supervisor.test.ts`, `supervisor-boot.test.ts` (+ inline fixture `:96-97`), all 4 `worker-fixtures/*.mjs`** | single integrator pass over supervisor + protocol + ALL its tests/fixtures; **MERGE before D-C0b + F3** |
| **W1-B2** | `extension-worker-runtime.ts`, `sdk/index.ts`, `sdk/host-bridge.ts` | NO electron/worker_threads imports |
| **W1-C1** | `host-authority-types.ts` (`MarketplaceInstallInput` + `MarketplaceSearchEntry.requiredCapabilities` only), `preload/api.d.ts` (`MarketplaceInstallInput` dup `:906`), `ipc.ts` (`installArgsSchema` `z.union` only) | single flat interface (×2 copies hand-synced) + both union members; extract+export schema |
| **W1-D-P2** | `cloud-host-rpc-client.ts` (+test) | palot; client is generic transport |
| **W1-DC0a** | firefly-cloud `packages/plugin/src/{host-authority-types,signature-format}.ts` (scaffold `src/`) + cross-repo round-trip guard test | separate repo; signature half only (byte-stable) |

### Wave 2 — depends on Wave 1 merges

| Agent | Owns | Depends on |
|---|---|---|
| **W2-A2** (heavy) | `install-orchestrator.ts` (verify-before-extract + sig block `:343-348` + `InstallExtensionOptions` **shape**), `extension-store.ts` (record types+upsert + provenance cols), new Drizzle migration (dir `>20260616213300_…` + `migration.sql` `--> statement-breakpoint`; `snapshot.json` inert), `install/detached-signature.ts`, A2 tests + `migration-columns.test.ts` | A6, A1, A3, A4 |
| **W2-B3** | `dispatch.ts`, `worker-invoke-router.ts` | B1 |
| **W2-C2** | `grant-store.ts` (`getHostGrantStore`, preserve `resolveGrantedTokens` seam), `index.ts` (`:337`), `host-authority.ts` (**`ElectronHostAuthority.installExtension` only**) | C1 |
| **W2-F1** | `install-orchestrator.ts` (code-ext **manifest-parse/persist** region — remove theme-only throw), `extension-store.ts` (descriptor persist) | A2 (trust/verify region), C1 |
| **W2-F2** | `authority.ts` (`buildCatalogWithDiskPlugins`), `discover-installed-manifests.ts` | F1 |
| **W2-B4/E1** | `apps/desktop/plugins/bobsoft-linter/**`, `build-plugins.ts` | B2, A4 |
| **W2-DP1** | `cloud-projection-cache.ts` (+test), `host-authority.ts` (**`CloudHostAuthority` only**), `host-authority-types.ts` (`CatalogProjectionSnapshot` block only) | D-P2 |
| **W2-DC0b** | firefly-cloud `packages/plugin/src/worker-protocol.ts` (protocol mirror) | **B1 MERGE** |
| **W2-DC1** | firefly-cloud `routes/firefly-plugin-rpc.ts` + mount `index.ts` (~`:5063`) + auth gate | DC0a |
| **W2-DC2** | firefly-cloud `routes/firefly-plugin-gallery.ts` + `db/schema.ts` (gallery block) + R2 byte+signature serving (+`requiredCapabilities`) | DC0a |
| **W2-DC3** | firefly-cloud `routes/firefly-plugin-publish.ts` + canonical-manifest signing | DC0a |
| **W2-DC4** (heavy, own agent) | firefly-cloud `firefly-plugin/cloud-host.ts` (+DO) + server-side verify/broker + per-workspace storage | DC0b, DC2 |
| **W2-DC5** | firefly-cloud `projectionSnapshot` method + push over `WsGatewayDO` | DC1 |

### Wave 3 — final wiring + proofs (mostly serial)

| Agent | Owns | Depends on |
|---|---|---|
| **W3-C3** | `install-orchestrator.ts` (grant block `:381-389` + `consentedCapabilities` option), `marketplace-panel.tsx` (remove theme-only, fire consent off `requiredCapabilities`) | A2+F1 (orchestrator shape), C2 |
| **W3-C5** | `grant-store.ts` (version-keyed grants + revoke wiring), `install-consent.ts` (re-consent on update) | C2, C3 |
| **W3-F3** | `supervisor-boot.ts` (live `registerInstalledExtensionWorker` + spawn gate + discovery region) | **B1 MERGE**, A2, F2 |
| **W3-F4** | `install-orchestrator.ts` (`uninstallExtension` + update path), `host-authority.ts` (`setEnabled` teardown), hot-reload executor wiring | F3, C5 |
| **W3-C4** | `grant-consent-dispatch.test.ts` (test-only) | C2/C3 |
| **W3-E2.5** | `e2e/signed-extension-electron.e2e.test.ts` (drives REAL `installExtension({kind:"firefly"})` via local mirror) | A2, B1, B3, B4/E1, C2/C3/C5, F1/F2/F3/F4 |
| **W3-E3** | `e2e/signed-extension-web.e2e.test.ts` | D-P1/D-P2 (contract); **D-C* (live, web-DoD)** |

### Shared-file collision controls (load-bearing)

- **`dispatch.ts` — B3 is the SOLE writer.** C reads it via stable seams (`createDbGrantResolver`/`setGrantResolver`/`decideCapabilityAll`) and edits **zero** lines of it. C4 is a test file. **Do not assign `dispatch.ts` to any C/E/F agent.**
- **`install-orchestrator.ts` — A2 vs F1 vs C3/F4.** Partition by region: **A2 owns verify-before-extract + signature block (`:343-348`) + `InstallExtensionOptions` type; F1 owns the code-ext manifest-parse/persist region (removing the theme-only throw `:300-304`); C3 owns the grant block (`:381-389`) + `consentedCapabilities` option; F4 owns `uninstallExtension` (`:419-423`) + the new update path.** **Serialize: A2 merges first → F1 → C3 → F4**, each rebasing onto the prior tip (all touch shared `InstallExtensionOptions`/`trust` locals — A2's derived `trust.trustTier` is the SAME local C3 passes to `persistInstallGrants` `:387`). Never run these concurrently against this file.
- **`host-authority.ts` — disjoint classes, multiple waves.** C2 edits **only** `ElectronHostAuthority.installExtension` (`:267-300`); F3/F4 edit **only** `ElectronHostAuthority.setEnabled`/install-completion hooks (`:209-224`); D-P1 edits **only** `CloudHostAuthority` (`:373-480`). Same file → **sequence** (C2 → F3/F4 → D-P1) and have the orchestrator merge; do not run concurrently.
- **`host-authority-types.ts` — additive-block ownership.** C1 owns `MarketplaceInstallInput.consentedCapabilities` + `MarketplaceSearchEntry.requiredCapabilities`; D-P1 owns the `CatalogProjectionSnapshot` block. Disjoint blocks, same file → **sequence or hand both blocks to one integrator pass.** Note `MarketplaceInstallInput` is **duplicated** at `preload/api.d.ts:906` — hand-sync both copies.
- **`extension-host-protocol.ts` — B1 owns it (append `activated` + fix the `:94/95` stale comment).** NOT purely append-only. Everyone else imports types. No edits beyond B1.
- **`supervisor-boot.ts` — B1 then F3.** **B1 owns the activation-wiring region** (wires `resolveActivation` from the stable `grant-store.ts resolveGrantedTokens` seam); **F3 owns the discovery + live-registration region** (`registerInstalledExtensionWorker` + spawn gate). Different waves → **sequence B1→F3**; never concurrent. B1 must use the stable `GrantStore.resolveGrantedTokens` seam C2 preserves, not the `installPluginGrantResolver` C2 refactors.
- **`extension-store.ts` / `apps/desktop/src/main/automation/schema.ts` — A6 first, then A2, then F1.** A6's union change touches both; A2's provenance columns touch both; F1's descriptor persist touches `extension-store.ts`. Serialize A6→A2→F1. **The schema file co-hosts `automations` tables and may have non-swarm concurrent editors** — orchestrator integrates on a clean base.
- **`grant-store.ts` — C2 then C5, B1 reads the stable seam.** C2 adds `getHostGrantStore` (preserve `resolveGrantedTokens` signature); C5 version-keys grants + wires `revoke`. Sequence C2→C5; B1 only reads `resolveGrantedTokens`.
- **`authority.ts` — F2 sole writer** (catalog bridge); no other agent edits it.
- **firefly-cloud `index.ts` — D-C1 is the sole `index.ts` writer** (mount at the `app.route(...)` cluster ~`:5063` + auth-gate bearer slots). It is a 6397-line hot monolith — expect concurrent unrelated firefly-cloud edits; integrate carefully. **`db/schema.ts` — split additive blocks** (D-C2 gallery, D-C4 storage) or sequence D-C2 before D-C4.
- **firefly-cloud `packages/plugin/src/` — D-C0a scaffolds it** (no existing `src/`); D-C0a owns `signature-format.ts`/`host-authority-types.ts`, **D-C0b owns `worker-protocol.ts` (after B1 merge).**
- **`build-plugins.ts` — single owner** (the B4/E1 fixture agent); no other agent edits it.

---

## 6. Cross-Repo Contract Freeze

**Lock these exact shapes before stream D (and before A2/B3/F land their consumers). Any drift = silent end-to-end breakage. The freeze is a real Wave-0 gate: B1 MERGES the worker protocol before D-C0b mirrors it.**

1. **§16 RPC wire.** `POST {FIREFLY_CLOUD_URL}/firefly-plugin/rpc`, `content-type: application/json`, optional `authorization: Bearer {FIREFLY_CLOUD_TOKEN}`, body `{ method: string, params: object }`, result = the method's JSON result, non-2xx → palot `CloudHostRpcError`. **SSOT for method names + param keys = `palot .../host-authority.ts:432-478` (`CloudHostAuthority`)** — `cloud-host-rpc-client.ts` is the **generic transport** (`call(method,params)` → POST). Methods + param keys (HARD MATCH): `invoke{pluginId,commandId,args}`, `invokeTool{pluginId,toolId,args,sessionId}`, `gallerySearch{options}`, `installExtension{input}`, `listInstalledExtensions{}`, `uninstallExtension{installationId}`, `applyTheme{installationId,themeId}`, **`projectionSnapshot{sinceRevision?}`**.

2. **Signature format (server signs a canonical manifest, palot verifies — CHANGED).** `CanonicalSignedManifest = { namespace, name, version, contentSha256, algorithm:"ed25519", signedAt, publisherKeyId }`; the signed bytes are its deterministic JSON. `DetachedSignature = { algorithm:"ed25519", signatureB64: string /* raw sig bytes, base64 */, publisherKeyId: string }`; `ServedSignatureMetadata = { manifest: CanonicalSignedManifest, signatureB64 }`. Verify via `crypto.verify(null, canonicalManifestBytes, publicKey, sig)`, **then** check `manifest.contentSha256 === sha256Hex(downloadedBytes)`. **SSOT for verification = `palot .../apps/desktop/src/main/firefly-plugin/install/signature-verify.ts:84-122` (main-only); SSOT for wire types = `palot .../shared/firefly-plugin/registry-signature-contract.ts`.** keyId `firefly-registry-root-2026`, fingerprint `sha256:88603741…ab5d`. **Invariant: server `sign(canonicalManifestBytes)`, client `verify(canonicalManifestBytes)` — byte-identical canonical serialization. Anti-rollback: `version` is INSIDE the signed manifest. Per-package yank list honored at install.**

3. **Result shapes.** The exact types in `palot .../host-authority-types.ts`: `HostToolDispatchEnvelope` (status enum `:133-140`), `MarketplaceSearchResult`/`MarketplaceSearchEntry` (**incl. NEW `requiredCapabilities`**), `MarketplaceInstallResult`, `MarketplaceInstalledEntry`, `HostPlugin*Result`, and **`CatalogProjectionSnapshot`** (each slice = the corresponding `HostPlugin*Result`).

4. **Worker protocol (Electron worker AND cloud-host remote host).** The Zod schemas in `palot .../extension-host-protocol.ts`: `hostToWorkerMessageSchema` (incl. the `activate` arm), `workerToHostMessageSchema` (**incl. the new `activated` arm from B1; bare `ready` is transport-up only**), `RuntimeTransport`, `storageRequestSchema`. **One definition, published via firefly-cloud `packages/plugin/src/worker-protocol.ts` (D-C0b) — do not re-encode in the server. D-C0b depends on B1's MERGE.**

> **Freeze mechanism:** B1 lands + MERGES the protocol (incl. `activated`) and fixes the `:94/95` comment in Wave 1; A3 (`registry-signature-contract.ts` canonical-manifest shapes) + the `host-authority-types.ts` shapes land in Wave 1. D-C0a mirrors the **signature** half early (byte-stable) with the round-trip guard test as the tripwire; D-C0b mirrors the **protocol** half only AFTER B1's merge.

---

## 7. Risks / Open Decisions / Known Gotchas

- **Drizzle is journal-less AND `snapshot.json` is INERT at runtime (CORRECTED).** The runtime migrator reads ONLY the directory-name `YYYYMMDDHHMMSS` (via `formatToMillis`) + `migration.sql`; the in-repo `prevIds` chain is already broken yet applies fine. A2's only load-bearing artifacts: a new dir `<YYYYMMDDHHMMSS>_<slug>` with timestamp **strictly > `20260616213300`** and parseable, plus `migration.sql` with `--> statement-breakpoint` separators. Do NOT hand-craft `prevIds`. Prove with the `ensureDb()` fresh-in-memory column test. The grants table already exists → the Electron story needs **no new table**, only the provenance columns + wiring.
- **Open VSX is permanently `unsigned-third-party`.** It serves NO CH5 registry signature; `kind:'open-vsx'` can never satisfy the medium-risk-capability story (the broker denies non-low caps for unsigned). The signed source is the **firefly gallery** (`kind:'firefly'`). The customer-story proof installs from the firefly source (or a faithful local mirror), never a hand-attached sidecar.
- **Trust must gate the SPAWN, not just install.** Workers are bare unsandboxed Node (`new Worker(entryPath)`, full fs/net) — the broker only gates host-mediated RPC, not raw `require('fs')`. F3 + B1 refuse to activate a `node-worker` unless `verified`/`signed-third-party` (or explicit allow-unsigned-with-consent + local-dev).
- **`bootPluginWorkerSupervisor` is a boot-once singleton.** Install-after-boot needs `registerInstalledExtensionWorker` (F3) on the already-booted supervisor; boot-time discovery only covers app-restart-after-install.
- **B1 lifecycle migration has a wide blast radius.** Changing bare `ready`→transport-up and adding `activated`→active breaks every existing supervisor test/fixture. B1 owns + updates `worker-supervisor.test.ts`, `supervisor-boot.test.ts` (+ inline fixture), and all 4 `worker-fixtures/*.mjs`, and fixes the stale `extension-host-protocol.ts:94/95` comment + the `worker-supervisor.ts:317` `case "ready"` flip.
- **Grant re-inheritance across updates.** Grants are keyed without a version → a v2 update would silently inherit v1's dangerous-cap grants. C5 binds grants to version/cap-set-hash and forces re-consent on changed medium+ caps; uninstall/disable revokes/tombstones.
- **Web trust is wholly delegated to firefly-cloud.** `FIREFLY_CLOUD_URL`/token authenticity is part of the TCB — pin/verify the endpoint. D-C4's server-side verify is a hard, separately-proven gate; **E3-live is required for web-DoD**, not optional.
- **`SignatureState` union drift (A6).** Code (`signature-verify.ts:67`) ≠ design §7.1. Recommended: keep the code union and update the design doc; **the wire type moves to A3's shared contract.**
- **GUI-only verification limits.** The headless E2E exercises the same `installExtension`/`invokePluginTool`/grant-store seams the GUI calls — **logic is proven, pixels are not.** The marketplace panel rendering, the visible `CapabilityConsentDialog`, and the widget visually rendering are a **manual/Playwright follow-up**.
- **Phantom IDE diagnostics.** Trust the captured `bunx tsgo --noEmit` / `bun test` exit codes, **not** editor squiggles. Verification = captured exit 0.
- **Verify commands (CORRECTED).** Package is `@ch5me/elf-desktop`; repo uses **bun** (no pnpm); typecheck script is `check-types` (`bunx tsgo --noEmit`, ~3min); there is **no `test` script** → `bun test <glob>` targets globs directly. Drop all `pnpm`/`@palot/desktop`/`typecheck` references.
- **firefly-cloud `index.ts` is a 6397-line monolith;** mount at the `app.route(...)` cluster ~`:5063` (NOT `:52-53`). `packages/plugin/` has no `src/` (D-C0a scaffolds it). `ALPHA_API_KEY` auth pattern at `:1389` is correct.
- **HQ-registry auth for `bun add`.** `@ch5me`/`@chriscode` packages resolve from npm.ch5.me, not GitHub Packages. `ENEEDAUTH`/`401` → fix HQ-registry auth (`ch5me-npm-packages` / `ch5-hq-infrastructure`), **not** a registry fallback.
- **No silent fallbacks (CH5 fail-fast), enforced end-to-end:** present-but-invalid signature → `integrity_mismatch`; **absent signature on signing-authority source → `unsigned_install_blocked`**; unknown/revoked key or yanked package → reject; unconfigured cloud host → `CloudHostNotConfiguredError`; missing signing key at publish → typed 503; worker that posts `ready` but never `activated` → hang-timeout `failed`; **node-worker not `verified` → registered-but-never-activated (spawn gate).**
- **Scoped-out (explicitly, not silently dropped):** package-byte GC of unreferenced content-addressed bytes (tracked post-MVP); design §8 step-6 "preserve user state behind explicit remove-data" (documented follow-up); panel/widget contribution families beyond the single E1 proof (E1 proves at least one; remainder scoped in writing if not built); per-publisher "verified publisher" multi-keyId badges (post-MVP); full `RegistrySource.trustPolicy` shape (MVP uses a minimal per-source `allow-unsigned-with-consent` flag).
- **Dev/staging signer split is a tracked hardening task** (A5 + D-C3), not MVP-blocking: today only the prod signer exists in Hush.

---

## 8. Task Checklist (drives the swarm)

### Wave 0 — Contract freeze gate (must MERGE before Wave 2 consumers)
- [ ] Lock §16 RPC wire (methods, param keys, result types) — SSOT `host-authority.ts:432-478` — §6.1
- [ ] Lock `DetachedSignature` + `CanonicalSignedManifest` (canonical-manifest signing, anti-rollback, per-package yank) — §6.2
- [ ] Lock `HostToolDispatchEnvelope` / `MarketplaceSearchResult`(+`requiredCapabilities`) / `CatalogProjectionSnapshot` shapes — §6.3
- [ ] **B1 MERGES** worker protocol incl. new `activated` arm + fixed `:94/95` comment — §6.4 (gate for D-C0b + F3)

### Stream A — Signing / PKI (Wave 1: A6,A1,A3,A4,A5 · Wave 2: A2)
- [ ] **A6** Resolve `SignatureState` union drift; re-point to A3 shared contract (`signature-verify.ts` / `automation/schema.ts` / `extension-store.ts`)
- [ ] **A1** `trust-anchor-registry.ts` + `trust-anchors/index.ts` (build-baked `PACKAGED`, fail-closed) + test (incl. ambiguous-packaged suppresses devOnly)
- [ ] **A3** `registry-signature-contract.ts` (`CanonicalSignedManifest`, `DetachedSignature`, `SignatureState`, yank list) + design §16.x
- [ ] **A4** `scripts/sign-plugin-package.mjs` (canonical-manifest signing) + `__fixtures__/signed/**` (clean + tampered + absent) + smoke test
- [ ] **A5** rotation/revocation runbook (per-key + per-package yank; dev-anchor build-bake)
- [ ] **A2** verify-before-extract; wire real `{signature, publicKeyPem, canonicalManifestBytes, contentSha256}` into `derivePackageTrust`; **unsigned/downgrade block**; migration (provenance cols, dir `>20260616213300`, `--> statement-breakpoint`); tests (valid/tampered/absent-blocked/unknown/yanked/`ensureDb` columns)

### Stream B — Electron exec (Wave 0/1: B1 · Wave 1: B2 · Wave 2: B3,B4)
- [ ] **B1** Supervisor posts `activate`; append `activated`; lifecycle to `active` on `activated` (bare `ready` = transport-up); hang-timeout on `ready`-only; spawn-gate prep; **own+update all supervisor tests + 4 fixtures + boot test**; fix `:94/95` comment + `:317` flip; test
- [ ] **B2** `extension-worker-runtime.ts` + `sdk/index.ts` + `sdk/host-bridge.ts` (transport-agnostic); test
- [ ] **B3** `worker-invoke-router.ts` + route in `dispatch.ts` after broker, before in-process; test (worker-backed / denied / built-in)
- [ ] **B4** Bundle `worker.mjs` (runtime+SDK inlined); build test (activate→activated→invoke)

### Stream C — Consent (Wave 1: C1 · Wave 2: C2 · Wave 3: C3,C4,C5)
- [ ] **C1** `consentedCapabilities` on `MarketplaceInstallInput` (×2 copies) + both `installArgsSchema` union members (extract+export); **`requiredCapabilities` on `MarketplaceSearchEntry`**; test
- [ ] **C2** `getHostGrantStore` singleton (preserve `resolveGrantedTokens` seam); refactor `installPluginGrantResolver`; inject store in `ElectronHostAuthority.installExtension`; test
- [ ] **C3** Thread approved set orchestrator→`persistInstallGrants`; **remove theme-only copy, fire consent off `requiredCapabilities`**; resolve `marketplace-panel.tsx` L513-515 TODO; test
- [ ] **C4** consent↔dispatch invariant test (no `dispatch.ts` edit)
- [ ] **C5** version-keyed grants + re-consent on update (changed medium+ caps) + revoke/tombstone on uninstall/disable + trust-tier-change handling; test (v1→v2 no auto-inherit)

### Stream F — Code-ext install path + catalog bridge + live lifecycle (Wave 2: F1,F2 · Wave 3: F3,F4)
- [ ] **F1** Code-ext install branch in `installExtension` (remove theme-only throw; `parseJsonPluginManifest`; persist descriptor); test
- [ ] **F2** `discoverInstalledManifests` install→catalog bridge in `buildCatalogWithDiskPlugins`; test (installed code-ext projects; removed/quarantined excluded)
- [ ] **F3** `registerInstalledExtensionWorker` live register+activate on booted singleton + **spawn trust gate** + fail-loud on missing `worker.mjs`; test (verified activates; not-verified registered-but-never-activated)
- [ ] **F4** Uninstall (stop worker + revoke grants + drop projections); disable (teardown + live re-enable); update (re-download+re-verify+restart+re-consent); wire into hot-reload executor; test

### Stream D — firefly-cloud + web cache (palot Wave 1/2; cloud separate repo)
- [ ] **D-P2** `fetchProjectionSnapshot`/`subscribeProjection` on generic `cloud-host-rpc-client.ts`; test
- [ ] **D-P1** `cloud-projection-cache.ts` + delegate `CloudHostAuthority` sync reads; `CatalogProjectionSnapshot` type; test
- [ ] **D-C0a** `packages/plugin/src/{signature-format,host-authority-types}.ts` (scaffold `src/`) + cross-repo round-trip guard test (canonical manifest verifies under committed anchor)
- [ ] **D-C0b** `packages/plugin/src/worker-protocol.ts` protocol mirror — **AFTER B1 merge**
- [ ] **D-C1** `POST /firefly-plugin/rpc` (8 methods) + mount `index.ts` (~`:5063`) + auth gate; test
- [ ] **D-C2** gallery routes + `marketplace_extensions`/`marketplace_versions` + R2 byte+signature serving + `requiredCapabilities`; test
- [ ] **D-C3** publish route + server-side **canonical-manifest** ed25519 signing from Hush (fail-fast on missing key); test
- [ ] **D-C4** cloud-host remote runtime (reuse B protocol via `packages/plugin`) + **server-side broker + canonical-manifest re-verify before activation** + per-workspace storage; server-side test (unsigned/tampered rejected before activation) — **own heavy agent**
- [ ] **D-C5** `projectionSnapshot` method + push-on-change over `WsGatewayDO`; test

### Stream E — Fixture + E2E (Wave 2: E1 · Wave 3: E2.5, E3)
- [ ] **E1** `bobsoft.linter` real worker extension, **non-reserved namespace**, `trust:"signed-third-party"`, medium+ cap, ≥1 panel/widget (or scope in writing) (manifest + `worker/index.ts` + sign step); manifest + worker tests
- [ ] **E2.5** Electron E2E driving **real `installExtension({kind:"firefly"})` via local mirror**: consent-before-grants → verify-before-extract → trust → bridge → enable → F3 register/activate → invoke→worker-data → spawn-gate/deny/downgrade negatives → disable/uninstall/update lifecycle
- [ ] **E3** Web E2E: faked `fetchFn` §16 contract proof now; **live-server leg required for web-DoD** after D-C0..D-C5 (server-side verify separately proven)

### Orchestrator (not a subagent task)
- [ ] Integrate disjoint agent diffs per wave on a clean base; **re-run `cd apps/desktop && bunx tsgo --noEmit` + `bun test apps/desktop/src/shared/firefly-plugin apps/desktop/src/main/firefly-plugin` on the merged tree** (captured exit 0; tsgo ~3min) + `bun run lint`
- [ ] Build+sign fixture (`bun scripts/build-plugins.ts && node scripts/sign-plugin-package.mjs --plugin bobsoft.linter …`) before E2E
- [ ] Enforce wave order on shared files (A6→A2→F1→C3→F4; C2→F3→D-P1; B1-merge→D-C0b/F3); commit coherent slices + push (subagents never commit/push)
- [ ] Electron customer story signed off in-repo (A+B+C+F+E); **Web upgraded from contract-level to live (web-DoD)** once D lands
