/**
 * Firefly Plugin System — build-baked trust anchor map.
 *
 * This module is importable by the Electron main process, the renderer, and
 * the web build. It carries NO runtime `fs` reads and NO Electron imports —
 * every anchor is inlined as a string constant, baked at bundle time.
 *
 * PACKAGED — the single authoritative, non-spoofable "are we in a production
 * build?" signal, fail-closed: defaults to `true` when the signal is
 * absent or ambiguous so that devOnly anchors are always suppressed unless we
 * are explicitly in a development runtime.
 *
 * Security invariant: a devOnly anchor is NEVER resolvable when
 * `PACKAGED === true`. `createDefaultTrustAnchorRegistry()` reads this
 * constant; callers do not pass `packaged`.
 */

// ---------------------------------------------------------------------------
// Build-baked packaged flag — FAIL CLOSED (default true)
// ---------------------------------------------------------------------------

/**
 * True when running in a production (packaged) build.
 *
 * Resolution order:
 *   1. `process.env.NODE_ENV === "production"` — injected by bundlers / vite /
 *      webpack / esbuild when building for release.
 *   2. Absent / unrecognised → `true` (fail-closed: devOnly anchors suppressed
 *      by default so a misconfigured build never silently trusts dev keys).
 *
 * The Electron main process mirrors this signal: `app.isPackaged` is true in
 * exactly the same builds where NODE_ENV is "production". This file is shared
 * (main + renderer + web), so we cannot import `electron` here directly.
 */
export const PACKAGED: boolean =
	typeof process !== "undefined" && process.env.NODE_ENV === "production"
		? true
		: typeof process !== "undefined" && process.env.NODE_ENV === "development"
			? false
			: true // fail-closed: unknown/absent signal → treat as packaged

// ---------------------------------------------------------------------------
// Committed public key PEM — firefly-registry-root-2026
// ---------------------------------------------------------------------------
// Inline the content of trust-anchors/firefly-registry-root-2026.pub.pem.
// This is NOT a secret; the private key lives in Hush only.
// Fingerprint: sha256:9e19923d7cfe0be270cce00ba74f35f72c9142fca48865fb8de4fcae939495da

const FIREFLY_REGISTRY_ROOT_2026_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAJTrrP7y+OMn40W7VCL1hAyZ9aPzSbYBiZEUv0RSA1Kc=
-----END PUBLIC KEY-----
`

// ---------------------------------------------------------------------------
// Anchor record shape
// ---------------------------------------------------------------------------

export interface PackagedAnchorRecord {
	readonly publicKeyPem: string
	/** sha256 hex fingerprint of the SPKI DER form of the key */
	readonly fingerprintSha256: string
	/** When true, this anchor is suppressed in packaged (production) builds */
	readonly devOnly: boolean
}

// ---------------------------------------------------------------------------
// Build-baked anchor map: keyId → record
// ---------------------------------------------------------------------------

export const ANCHORS: Readonly<Record<string, PackagedAnchorRecord>> = {
	"firefly-registry-root-2026": {
		publicKeyPem: FIREFLY_REGISTRY_ROOT_2026_PEM,
		fingerprintSha256:
			"9e19923d7cfe0be270cce00ba74f35f72c9142fca48865fb8de4fcae939495da",
		devOnly: false,
	},
} as const

// ---------------------------------------------------------------------------
// Revoked key IDs — honored everywhere; revocation beats presence
// ---------------------------------------------------------------------------

export const revokedKeyIds: readonly string[] = []
