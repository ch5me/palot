# Firefly Plugin Marketplace — Signing PKI

## Authority model

CH5 holds the marketplace/registry signing authority — the "Microsoft role" in the VS Code
marketplace model. Every package served by `firefly-cloud` is signed with the CH5 registry
private key before delivery. `palot` bakes the corresponding **public** key as a committed
trust anchor here; a successfully verified package derives `trustTier = signed-third-party`.

## Algorithm

**ed25519.** `crypto.verify(null, data, key, sig)` — no pre-hash; ed25519 hashes internally.
This is the first-class path in `signature-verify.ts`.

## What is signed

The signature attests a **`CanonicalSignedManifest`**, not raw package bytes:

```
{
  namespace:      string,
  name:           string,
  version:        string,
  contentSha256:  string,   // hex SHA-256 of the raw package bytes
  algorithm:      "ed25519",
  signedAt:       string,   // ISO-8601
  publisherKeyId: string    // keyId used to sign
}
```

**Verification flow (client):**
1. Verify `signature(canonicalManifestBytes)` against the anchor for `publisherKeyId`.
2. Assert `manifest.contentSha256 === sha256Hex(rawPackageBytes)`.
3. Both must pass — a mismatch at either step is a hard `integrity_mismatch`; the install aborts.

Anti-rollback: `version` is inside the signed manifest, so a downgrade replay produces a
different canonical payload and does not verify against a newer signature.

## Trust-anchor map

The client holds a `keyId → publicKeyPem` map (see `trust-anchors/index.ts`). Signing always
uses the **newest** active keyId; old keyIds remain trusted until **explicitly revoked**.

### Active anchors

| keyId | algorithm | fingerprint (sha256 of SPKI DER) | status |
|---|---|---|---|
| `firefly-registry-root-2026` | ed25519 | `sha256:88603741da3fc2bed2de2be603024c64a81de023a1ac1e01d17b427f6559ab5d` | **active** |

### Security invariants

- A present-but-invalid signature → hard `integrity_mismatch`, install blocked, nothing written.
- An absent signature on a `kind:"firefly"` source → `unsigned_install_blocked`, never silently
  downgraded to unsigned.
- An unknown or revoked keyId → install rejected.
- A yanked `{namespace, name, version}` → install rejected even if the signature is valid.

## Key storage

| Half | Location |
|---|---|
| Private (PKCS#8 PEM) | Repo-local Hush secret `FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY` — **never committed, never printed** |
| Public (SPKI PEM) | `trust-anchors/<keyId>.pub.pem` — committed here, non-secret |

## Rotation (zero-downtime)

1. **Mint** a new keypair with a new annual keyId:

   ```sh
   node scripts/mint-plugin-signing-key.mjs --key-id firefly-registry-root-<year>
   ```

   This writes `trust-anchors/firefly-registry-root-<year>.pub.pem` and stores the private
   key in repo-local Hush under `FIREFLY_PLUGIN_REGISTRY_SIGNING_KEY` (overwriting the old
   value — keep the old private key in a separate Hush secret or secure backup if you need
   to re-sign historical packages).

2. **Add the new anchor** to `trust-anchors/index.ts` — add an entry to the `TRUST_ANCHORS`
   map with the new keyId, its PEM, algorithm, fingerprint, and `devOnly: false`.

3. **Flip `ACTIVE_KEY_ID`** in `firefly-cloud` to the new keyId so new packages are signed
   with the new key.

4. **Commit and deploy** both repos. Old packages signed with the previous keyId continue
   to verify — the old anchor stays in the map and is NOT revoked.

5. **Re-sign** any packages you want to migrate to the new key via the signing CLI
   (`scripts/sign-plugin-package.mjs`). This is optional unless the old key is being revoked.

## Revocation

Revocation operates at two levels. **Config-based, never file deletion** — keep old anchors
on disk for forensic audit.

### Per-key revocation

Add the keyId to `revokedKeyIds` in `trust-anchors/index.ts`:

```ts
export const REVOKED_KEY_IDS: readonly string[] = [
  "firefly-registry-root-2026",  // example: key compromised 2027-01-15
];
```

Effect: `TrustAnchorRegistry.isRevoked(keyId)` returns `true`; `resolve(keyId)` returns `null`;
**every package signed with that key is rejected**, regardless of whether the signature itself
is valid. Re-sign all affected packages with the new active key before revoking the old one
(or accept a deployment window where those packages cannot be installed).

### Per-package revocation (yank)

Add a `{namespace, name, version}` entry to `yanked-packages.json` (checked at install time):

```json
[
  { "namespace": "bobsoft", "name": "linter", "version": "0.2.0" }
]
```

Effect: that specific version is rejected at install even if the signature verifies and the key
is not revoked. Use this to retire a bad release without invalidating the signing key or all
other packages it signed.

After adding a yank entry, **re-sign and republish** a patched version with the next semver.

## Dev / staging / prod split (tracked hardening task)

Today a single signer (`firefly-registry-root-2026`) is used across all environments.
The planned hardening (tracked, not yet implemented):

- Separate `dev`, `staging`, and `prod` signing keys minted independently.
- `devOnly: true` anchors in `trust-anchors/index.ts` are suppressed at runtime when
  `PACKAGED === true` (the build-baked flag in `trust-anchors/index.ts`).
- Dev/staging Hush targets hold their own private keys; production private key lives in
  the `prod` Hush target with least-privilege access.
- `trust-anchors/index.ts` is the **single authoritative source** for the `packaged` flag —
  baked at build time from `app.isPackaged` (or the equivalent bundler constant). Default
  is `packaged: true` (fail-closed) when the signal is absent or ambiguous, so dev-only
  anchors are never active in an unknown build context.

## Fingerprint verification

To verify a public anchor file matches the recorded fingerprint:

```sh
node -e "
const {createPublicKey,createHash}=require('crypto');
const pem=require('fs').readFileSync('apps/desktop/src/shared/firefly-plugin/trust-anchors/firefly-registry-root-2026.pub.pem','utf8');
const der=createPublicKey(pem).export({type:'spki',format:'der'});
console.log('sha256:'+createHash('sha256').update(der).digest('hex'));
"
```

Expected: `sha256:88603741da3fc2bed2de2be603024c64a81de023a1ac1e01d17b427f6559ab5d`
