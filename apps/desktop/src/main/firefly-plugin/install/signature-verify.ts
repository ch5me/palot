/**
 * Firefly Plugin Marketplace — Publisher-key signature verification (§10)
 *
 * This module implements the publisher signature layer on top of the
 * SHA-256 content-hash check that lives in package-store.ts.
 *
 * Design (§10):
 *   - Verify before extract.  Repository signature gates install; publisher
 *     signature drives the verified badge.
 *   - Integrity mismatch on load → quarantine + named reason; never run
 *     unverified bytes.
 *   - trustTier is derived from verification at install (not self-declared):
 *       verified + publisher  → signed-third-party
 *       unsigned marketplace  → unsigned-third-party
 *       dev folder            → local-dev
 *       compiled              → built-in
 *
 * A present-but-invalid signature is a HARD FAIL — we never silently
 * downgrade to "unsigned" when a signature exists but does not verify.
 *
 * Uses only Node's built-in `node:crypto` — no new dependencies.
 */

import * as crypto from "node:crypto"

// Wire types are shared (no node:crypto) — import from the contract module.
// Re-export them here for back-compat so existing importers of this file
// do not need to change their import paths.
export type {
	SignatureAlgorithm,
	SignatureState,
	DetachedSignature,
} from "../../../shared/firefly-plugin/registry-signature-contract"
import type {
	SignatureState,
	DetachedSignature,
} from "../../../shared/firefly-plugin/registry-signature-contract"

// ---------------------------------------------------------------------------
// Public error type
// ---------------------------------------------------------------------------

/**
 * Thrown when a publisher signature is present but fails to verify.
 * `code` is a machine-readable enum so callers can quarantine with a named
 * reason.
 */
export class SignatureVerificationError extends Error {
	constructor(
		public readonly code: "integrity_mismatch" | "key_parse_error",
		message: string,
	) {
		super(message)
		this.name = "SignatureVerificationError"
	}
}

// ---------------------------------------------------------------------------
// Public types (main-process only)
// ---------------------------------------------------------------------------

export interface SignatureVerifyInput {
	data: Buffer
	signature: DetachedSignature
	/** PEM-encoded public key (SPKI or PKCS#8 format). */
	publicKeyPem: string
}

/** Matches `extension_installations.trustTier` column values. */
export type TrustTier = "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"

// ---------------------------------------------------------------------------
// Core: verifyDetachedSignature
// ---------------------------------------------------------------------------

/**
 * Verify a detached publisher signature against `data`.
 *
 * Returns `{ verified: true, reason: "ok" }` on success, or
 * `{ verified: false, reason: "<detail>" }` on any failure (bad key, bad
 * signature, algorithm mismatch).  Never throws — callers that need hard
 * failure should use `derivePackageTrust`.
 */
export function verifyDetachedSignature(input: SignatureVerifyInput): {
	verified: boolean
	reason: string
} {
	const { data, signature, publicKeyPem } = input

	// Parse the PEM.  A bad key is a soft false here — derivePackageTrust turns
	// it into a hard throw.
	let publicKey: crypto.KeyObject
	try {
		publicKey = crypto.createPublicKey(publicKeyPem)
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		return { verified: false, reason: `failed to parse public key PEM: ${msg}` }
	}

	// Decode the base64 signature bytes.
	const signatureBuffer = Buffer.from(signature.signatureB64, "base64")

	try {
		let verified: boolean

		if (signature.algorithm === "ed25519") {
			// ed25519 uses no hash algorithm param — pass null.
			verified = crypto.verify(null, data, publicKey, signatureBuffer)
		} else {
			// rsa-sha256
			verified = crypto.verify("sha256", data, publicKey, signatureBuffer)
		}

		if (verified) {
			return { verified: true, reason: "ok" }
		}
		return { verified: false, reason: "signature did not match" }
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err)
		return { verified: false, reason: `verification error: ${msg}` }
	}
}

// ---------------------------------------------------------------------------
// Core: derivePackageTrust
// ---------------------------------------------------------------------------

/**
 * Derive the `signatureState` and `trustTier` for a package at install time.
 *
 * Rules (§10):
 *
 *  source "builtin"    → built-in  / unsigned  (host-owned, no external sig needed)
 *  source "dev-folder" → local-dev / unsigned
 *
 *  signature present + publicKeyPem present:
 *    - signature verifies  → signed-third-party / verified
 *    - signature fails     → THROW SignatureVerificationError("integrity_mismatch")
 *      (never silently downgrade — CH5 fail-fast policy)
 *
 *  signature present + NO publicKeyPem (unknown publisher key):
 *    → unsigned-third-party / unverified  (cannot verify; treat conservatively)
 *
 *  no signature:
 *    → unsigned-third-party / unsigned
 *
 * @throws `SignatureVerificationError` with code `"integrity_mismatch"` when a
 *   signature is present, a key is known, but verification fails.
 */
export function derivePackageTrust(input: {
	source: "open-vsx" | "manual-vsix" | "dev-folder" | "builtin"
	signature: DetachedSignature | null
	publicKeyPem: string | null
	data: Buffer
}): { signatureState: SignatureState; trustTier: TrustTier; reason: string } {
	const { source, signature, publicKeyPem, data } = input

	// Host-owned built-ins never need an external publisher signature.
	if (source === "builtin") {
		return {
			signatureState: "unsigned",
			trustTier: "built-in",
			reason: "host-owned built-in; no publisher signature required",
		}
	}

	// Developer folder installs are always local-dev regardless of sigs.
	if (source === "dev-folder") {
		return {
			signatureState: "unsigned",
			trustTier: "local-dev",
			reason: "dev-folder install; treated as local-dev",
		}
	}

	// From here: open-vsx or manual-vsix.

	if (signature !== null && publicKeyPem !== null) {
		// We have both a signature and a known public key — must verify.
		const result = verifyDetachedSignature({ data, signature, publicKeyPem })
		if (result.verified) {
			return {
				signatureState: "verified",
				trustTier: "signed-third-party",
				reason: "publisher signature verified",
			}
		}
		// A present-but-invalid signature is a hard fail (§10 / CH5 fail-fast).
		throw new SignatureVerificationError(
			"integrity_mismatch",
			`publisher signature did not verify: ${result.reason}`,
		)
	}

	if (signature !== null && publicKeyPem === null) {
		// Signature present but the publisher key is not known to this host.
		// Cannot verify — treat conservatively as unsigned-third-party.
		return {
			signatureState: "unverified",
			trustTier: "unsigned-third-party",
			reason: "publisher key not known to host",
		}
	}

	// No signature at all.
	return {
		signatureState: "unsigned",
		trustTier: "unsigned-third-party",
		reason: "no publisher signature present",
	}
}
