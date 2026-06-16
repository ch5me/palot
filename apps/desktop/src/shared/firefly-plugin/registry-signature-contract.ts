/**
 * Firefly Plugin Marketplace — Registry signature wire contract (§10, A3)
 *
 * This module is SHARED (no node:crypto, no node-only imports).
 * It is safe to import from the renderer, web build, and firefly-cloud.
 *
 * Verification logic and TrustTier live in the main-only `signature-verify.ts`.
 * Only wire types and the canonical serialization helper live here.
 */

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

/** Signing algorithms supported by the CH5 marketplace registry. */
export type SignatureAlgorithm = "ed25519" | "rsa-sha256"

/**
 * Canonical `extension_packages.signatureState` column values.
 *
 * "unsigned"   — no signature present (or not a signing-authority source)
 * "verified"   — signature present and successfully verified
 * "unverified" — signature present but could not be verified (unknown key, etc.)
 */
export type SignatureState = "unsigned" | "verified" | "unverified"

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

/**
 * A detached signature referencing a publisher key by id.
 * Carried from the registry alongside the package bytes.
 */
export interface DetachedSignature {
	algorithm: SignatureAlgorithm
	/** Base64-encoded raw signature bytes. */
	signatureB64: string
	/** Opaque key identifier referencing a publisher public key. */
	publisherKeyId: string
}

/**
 * The payload that is signed (and verified) by the CH5 marketplace registry.
 *
 * INVARIANT (cross-repo): the server (firefly-cloud) signs
 *   `canonicalManifestBytes(manifest)` and the client (palot) verifies
 *   `canonicalManifestBytes(manifest)`.  Both sides MUST produce the exact
 *   same byte sequence for the signature to validate.  See `canonicalManifestBytes`.
 *
 * `contentSha256` binds the actual package bytes (anti-substitution).
 * `version` inside the manifest provides anti-rollback protection.
 */
export interface CanonicalSignedManifest {
	namespace: string
	name: string
	version: string
	/** Hex SHA-256 of the raw package bytes (.fpk / .vsix). */
	contentSha256: string
	algorithm: "ed25519"
	/** ISO-8601 UTC timestamp of signing. */
	signedAt: string
	publisherKeyId: string
}

/**
 * The payload served by the gallery byte+signature endpoint (D-C2).
 * `manifest` is verified first; then `manifest.contentSha256` is cross-checked
 * against the actual downloaded bytes.
 */
export interface ServedSignatureMetadata {
	manifest: CanonicalSignedManifest
	signatureB64: string
}

// ---------------------------------------------------------------------------
// Yank / revocation list types
// ---------------------------------------------------------------------------

/** A single yanked (revoked) package version. */
export interface PackageYankEntry {
	namespace: string
	name: string
	version: string
	reason: string
}

/** Immutable list of yanked package versions. */
export type YankList = readonly PackageYankEntry[]

// ---------------------------------------------------------------------------
// Canonical serialization
// ---------------------------------------------------------------------------

/**
 * Produce the deterministic byte sequence that is signed by the server and
 * verified by the client.
 *
 * INVARIANT: this function MUST produce byte-identical output on both the
 * signing side (firefly-cloud) and the verifying side (palot desktop / web).
 * Key order is fixed — namespace, name, version, contentSha256, algorithm,
 * signedAt, publisherKeyId — regardless of the input object's own key order.
 * This prevents any JSON-serialization variance from breaking the signature.
 *
 * @param m The canonical signed manifest to serialize.
 * @returns UTF-8 encoded bytes of the deterministic JSON representation.
 */
export function canonicalManifestBytes(m: CanonicalSignedManifest): Uint8Array {
	// Stable key order matching the CanonicalSignedManifest field declaration order.
	const ordered: Record<string, string> = {
		namespace: m.namespace,
		name: m.name,
		version: m.version,
		contentSha256: m.contentSha256,
		algorithm: m.algorithm,
		signedAt: m.signedAt,
		publisherKeyId: m.publisherKeyId,
	}
	const json = JSON.stringify(ordered)
	return new TextEncoder().encode(json)
}
