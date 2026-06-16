/**
 * Firefly Plugin System — client trust-anchor registry.
 *
 * Importable by both the Electron main process and the renderer (no
 * `electron` imports, no side-effects). Fingerprint verification uses
 * `node:crypto` — this module is reachable from the main process where
 * Node is available. In renderer/web contexts that lack `node:crypto` the
 * fingerprint is pre-baked into the anchor record and validated at
 * construction time (so the registry is still usable without live crypto).
 *
 * Fail-fast, no silent fallbacks (CH5 principle #9):
 *  - revoked key         → resolve() returns null
 *  - packaged + devOnly  → resolve() returns null
 *  - unknown keyId       → resolve() returns null
 *  - malformed PEM       → throws at construction
 *
 * Security invariant: `PACKAGED` is read from the build-baked
 * `trust-anchors/index.ts` constant; callers cannot override it via
 * `createDefaultTrustAnchorRegistry()`.
 */

import { createHash, createPublicKey } from "node:crypto"

import {
	ANCHORS,
	PACKAGED as BUILD_PACKAGED,
	revokedKeyIds,
	type PackagedAnchorRecord,
} from "./trust-anchors/index"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TrustAnchor {
	readonly keyId: string
	readonly publicKeyPem: string
	readonly algorithm: "ed25519"
	readonly fingerprintSha256: string
	readonly devOnly: boolean
}

export interface TrustAnchorRegistry {
	/**
	 * Resolve a public-key PEM for the given keyId.
	 *
	 * Precedence (fail-fast, all conditions fail to null):
	 *   1. revoked  → null
	 *   2. packaged && devOnly → null
	 *   3. unknown  → null
	 *   4. else     → PEM string
	 */
	resolve(keyId: string): string | null
	/** Full anchor record including fingerprint, or null if not resolvable. */
	get(keyId: string): TrustAnchor | null
	isRevoked(keyId: string): boolean
	trustedKeyIds(): readonly string[]
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface TrustAnchorRegistryOptions {
	/**
	 * Override the anchor map (keyed by keyId). Each value must be a valid
	 * SPKI PEM for an ed25519 public key — malformed PEMs throw at
	 * construction.
	 *
	 * Defaults to the build-baked `ANCHORS` map from `trust-anchors/index.ts`.
	 */
	anchors?: Record<
		string,
		Pick<PackagedAnchorRecord, "publicKeyPem" | "fingerprintSha256" | "devOnly">
	>
	/**
	 * Treat this build as packaged (production). devOnly anchors are suppressed
	 * when true.
	 *
	 * Defaults to the build-baked `PACKAGED` constant (fail-closed: true when
	 * signal is absent/ambiguous). Only override in unit tests.
	 */
	packaged?: boolean
	/**
	 * Additional revoked key IDs beyond the baked `revokedKeyIds` list.
	 */
	extraRevokedKeyIds?: readonly string[]
}

// ---------------------------------------------------------------------------
// Fingerprint helper
// ---------------------------------------------------------------------------

/**
 * Compute the sha256 fingerprint of a PEM-encoded public key.
 *
 * Throws a descriptive error when the PEM is missing, empty, or cannot be
 * parsed as a valid public key — this is the construction-time PEM guard.
 */
function computeFingerprintSha256(pem: string, keyId: string): string {
	const trimmed = pem.trim()
	if (!trimmed) {
		throw new Error(
			`[TrustAnchorRegistry] anchor "${keyId}" has an empty PEM string`,
		)
	}
	try {
		const der = createPublicKey(trimmed).export({ type: "spki", format: "der" }) as Buffer
		return createHash("sha256").update(der).digest("hex")
	} catch (err) {
		throw new Error(
			`[TrustAnchorRegistry] anchor "${keyId}" has a malformed PEM: ${String(err)}`,
		)
	}
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a trust-anchor registry from an explicit options bag.
 *
 * Malformed PEMs in the anchor map throw synchronously so the error surfaces
 * at startup / import time, never silently at resolution time.
 */
export function createTrustAnchorRegistry(
	opts: TrustAnchorRegistryOptions = {},
): TrustAnchorRegistry {
	const anchorMap = opts.anchors ?? ANCHORS
	const packaged = opts.packaged ?? BUILD_PACKAGED
	const revoked = new Set<string>([
		...revokedKeyIds,
		...(opts.extraRevokedKeyIds ?? []),
	])

	// Validate every PEM at construction time — fail fast on bad anchors.
	const anchors = new Map<string, TrustAnchor>()
	for (const [keyId, record] of Object.entries(anchorMap)) {
		const computedFingerprint = computeFingerprintSha256(record.publicKeyPem, keyId)
		// Cross-check against the baked fingerprint so a stale/mismatched bake is caught.
		if (computedFingerprint !== record.fingerprintSha256) {
			throw new Error(
				`[TrustAnchorRegistry] anchor "${keyId}" fingerprint mismatch: ` +
					`baked=${record.fingerprintSha256} computed=${computedFingerprint}`,
			)
		}
		anchors.set(keyId, {
			keyId,
			publicKeyPem: record.publicKeyPem,
			algorithm: "ed25519",
			fingerprintSha256: record.fingerprintSha256,
			devOnly: record.devOnly,
		})
	}

	const trustedIds: readonly string[] = Object.keys(anchorMap)

	function resolve(keyId: string): string | null {
		if (revoked.has(keyId)) return null
		const anchor = anchors.get(keyId)
		if (!anchor) return null
		if (packaged && anchor.devOnly) return null
		return anchor.publicKeyPem
	}

	function get(keyId: string): TrustAnchor | null {
		if (revoked.has(keyId)) return null
		const anchor = anchors.get(keyId)
		if (!anchor) return null
		if (packaged && anchor.devOnly) return null
		return anchor
	}

	function isRevoked(keyId: string): boolean {
		return revoked.has(keyId)
	}

	function trustedKeyIds(): readonly string[] {
		return trustedIds
	}

	return { resolve, get, isRevoked, trustedKeyIds }
}

/**
 * Create the default trust-anchor registry backed by the committed build-baked
 * anchor map. The `packaged` flag comes from the build-baked `PACKAGED`
 * constant — callers cannot override it to avoid spoofing.
 *
 * Only accepts an optional `packaged` override for unit-test injection.
 */
export function createDefaultTrustAnchorRegistry(opts?: {
	packaged?: boolean
}): TrustAnchorRegistry {
	return createTrustAnchorRegistry({ packaged: opts?.packaged })
}
