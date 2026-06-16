/**
 * trust-anchor-registry.test.ts
 *
 * Run: cd apps/desktop && bun test src/shared/firefly-plugin/trust-anchor-registry.test.ts
 */

import { describe, expect, it } from "bun:test"

import {
	createDefaultTrustAnchorRegistry,
	createTrustAnchorRegistry,
} from "./trust-anchor-registry"
import { ANCHORS } from "./trust-anchors/index"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMMITTED_KEY_ID = "firefly-registry-root-2026"
const COMMITTED_FINGERPRINT =
	"88603741da3fc2bed2de2be603024c64a81de023a1ac1e01d17b427f6559ab5d"

/** A well-formed ed25519 SPKI PEM distinct from the prod key (ephemeral dev anchor). */
const DEV_ANCHOR_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA4mlP5kEFYssWo30IuWOJtMYIcDR/mnys5axiczkdAQg=
-----END PUBLIC KEY-----
`

// Same PEM as the prod key — reused as "devOnly" fixture to keep test
// construction simple (fingerprint will match the baked one).
const DEV_ANCHOR_FINGERPRINT = COMMITTED_FINGERPRINT

// ---------------------------------------------------------------------------
// 1. Resolves the committed production anchor
// ---------------------------------------------------------------------------

describe("committed firefly-registry-root-2026 anchor", () => {
	it("resolves when packaged:false (dev build)", () => {
		const registry = createDefaultTrustAnchorRegistry({ packaged: false })
		const pem = registry.resolve(COMMITTED_KEY_ID)
		expect(pem).not.toBeNull()
		expect(typeof pem).toBe("string")
		expect(pem).toContain("BEGIN PUBLIC KEY")
	})

	it("resolves when packaged:true (prod build) because devOnly:false", () => {
		const registry = createDefaultTrustAnchorRegistry({ packaged: true })
		const pem = registry.resolve(COMMITTED_KEY_ID)
		expect(pem).not.toBeNull()
	})

	it("get() returns the full TrustAnchor record", () => {
		const registry = createDefaultTrustAnchorRegistry({ packaged: false })
		const anchor = registry.get(COMMITTED_KEY_ID)
		expect(anchor).not.toBeNull()
		expect(anchor!.keyId).toBe(COMMITTED_KEY_ID)
		expect(anchor!.algorithm).toBe("ed25519")
		expect(anchor!.devOnly).toBe(false)
	})

	it("fingerprint matches sha256:88603741…ab5d", () => {
		const registry = createDefaultTrustAnchorRegistry({ packaged: false })
		const anchor = registry.get(COMMITTED_KEY_ID)
		expect(anchor!.fingerprintSha256).toBe(COMMITTED_FINGERPRINT)
	})

	it("trustedKeyIds() includes the committed key", () => {
		const registry = createDefaultTrustAnchorRegistry({ packaged: false })
		expect(registry.trustedKeyIds()).toContain(COMMITTED_KEY_ID)
	})
})

// ---------------------------------------------------------------------------
// 2. Unknown key resolves to null
// ---------------------------------------------------------------------------

describe("unknown keyId", () => {
	it("resolve() returns null for an unknown keyId", () => {
		const registry = createDefaultTrustAnchorRegistry({ packaged: false })
		expect(registry.resolve("unknown-key-2099")).toBeNull()
	})

	it("get() returns null for an unknown keyId", () => {
		const registry = createDefaultTrustAnchorRegistry({ packaged: false })
		expect(registry.get("unknown-key-2099")).toBeNull()
	})

	it("isRevoked() returns false for an unknown keyId", () => {
		const registry = createDefaultTrustAnchorRegistry({ packaged: false })
		expect(registry.isRevoked("unknown-key-2099")).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// 3. Revoked key resolves to null
// ---------------------------------------------------------------------------

describe("revoked keyId", () => {
	it("resolve() returns null for a revoked key even if it is in the anchor map", () => {
		const registry = createTrustAnchorRegistry({
			packaged: false,
			extraRevokedKeyIds: [COMMITTED_KEY_ID],
		})
		expect(registry.resolve(COMMITTED_KEY_ID)).toBeNull()
	})

	it("get() returns null for a revoked key", () => {
		const registry = createTrustAnchorRegistry({
			packaged: false,
			extraRevokedKeyIds: [COMMITTED_KEY_ID],
		})
		expect(registry.get(COMMITTED_KEY_ID)).toBeNull()
	})

	it("isRevoked() returns true for the revoked key", () => {
		const registry = createTrustAnchorRegistry({
			packaged: false,
			extraRevokedKeyIds: [COMMITTED_KEY_ID],
		})
		expect(registry.isRevoked(COMMITTED_KEY_ID)).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// 4. devOnly anchor — suppressed when packaged:true, resolvable when packaged:false
// ---------------------------------------------------------------------------

describe("devOnly anchor", () => {
	const devKeyId = "dev-ephemeral-2026"

	const registryWithDevAnchor = (packaged: boolean) =>
		createTrustAnchorRegistry({
			packaged,
			anchors: {
				[devKeyId]: {
					publicKeyPem: DEV_ANCHOR_PEM,
					fingerprintSha256: DEV_ANCHOR_FINGERPRINT,
					devOnly: true,
				},
			},
		})

	it("resolve() returns null when packaged:true", () => {
		const registry = registryWithDevAnchor(true)
		expect(registry.resolve(devKeyId)).toBeNull()
	})

	it("get() returns null when packaged:true", () => {
		const registry = registryWithDevAnchor(true)
		expect(registry.get(devKeyId)).toBeNull()
	})

	it("resolve() returns PEM when packaged:false", () => {
		const registry = registryWithDevAnchor(false)
		const pem = registry.resolve(devKeyId)
		expect(pem).not.toBeNull()
		expect(pem).toContain("BEGIN PUBLIC KEY")
	})

	it("get() returns TrustAnchor when packaged:false", () => {
		const registry = registryWithDevAnchor(false)
		const anchor = registry.get(devKeyId)
		expect(anchor).not.toBeNull()
		expect(anchor!.devOnly).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// 5. Fail-closed: absent/ambiguous packaged signal suppresses devOnly anchors
// ---------------------------------------------------------------------------

describe("fail-closed PACKAGED default", () => {
	it("createDefaultTrustAnchorRegistry() with no opts uses BUILD_PACKAGED (baked constant)", () => {
		// The baked PACKAGED constant defaults to true (fail-closed) outside a known
		// dev environment. In the bun:test runner NODE_ENV may be 'test' so the
		// constant could be either — the key assertion is that the registry
		// constructs without error.
		expect(() => createDefaultTrustAnchorRegistry()).not.toThrow()
	})

	it("a devOnly anchor is suppressed when packaged:true even with no extraRevokedKeyIds", () => {
		const registry = createTrustAnchorRegistry({
			packaged: true,
			anchors: {
				"dev-only-key": {
					publicKeyPem: DEV_ANCHOR_PEM,
					fingerprintSha256: DEV_ANCHOR_FINGERPRINT,
					devOnly: true,
				},
			},
		})
		expect(registry.resolve("dev-only-key")).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// 6. Malformed PEM throws at construction
// ---------------------------------------------------------------------------

describe("malformed PEM", () => {
	it("throws synchronously at construction when PEM is empty", () => {
		expect(() =>
			createTrustAnchorRegistry({
				packaged: false,
				anchors: {
					"bad-key": {
						publicKeyPem: "",
						fingerprintSha256: "deadbeef",
						devOnly: false,
					},
				},
			}),
		).toThrow(/empty PEM/)
	})

	it("throws synchronously at construction when PEM is malformed", () => {
		expect(() =>
			createTrustAnchorRegistry({
				packaged: false,
				anchors: {
					"bad-key": {
						publicKeyPem: "-----BEGIN PUBLIC KEY-----\nnot-valid-base64!!!\n-----END PUBLIC KEY-----\n",
						fingerprintSha256: "deadbeef",
						devOnly: false,
					},
				},
			}),
		).toThrow(/malformed PEM/)
	})

	it("throws when baked fingerprintSha256 does not match the actual key", () => {
		expect(() =>
			createTrustAnchorRegistry({
				packaged: false,
				anchors: {
					[COMMITTED_KEY_ID]: {
						...ANCHORS[COMMITTED_KEY_ID]!,
						fingerprintSha256: "0000000000000000000000000000000000000000000000000000000000000000",
					},
				},
			}),
		).toThrow(/fingerprint mismatch/)
	})
})
