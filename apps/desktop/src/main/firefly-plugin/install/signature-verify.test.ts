/**
 * Tests for signature-verify.ts
 *
 * All crypto operations use Node's built-in `node:crypto` — no external deps.
 * Keys are generated fresh per test suite so there are no committed key
 * fixtures to rotate.
 */

import { describe, it, expect } from "bun:test"
import crypto from "node:crypto"

import {
	verifyDetachedSignature,
	derivePackageTrust,
	SignatureVerificationError,
	type DetachedSignature,
	type SignatureVerifyInput,
} from "./signature-verify"

// ---------------------------------------------------------------------------
// Shared key fixtures (generated once per file load)
// ---------------------------------------------------------------------------

const ed25519Keys = crypto.generateKeyPairSync("ed25519")
const ed25519PublicKeyPem = ed25519Keys.publicKey.export({ type: "spki", format: "pem" }) as string
const ed25519PrivateKey = ed25519Keys.privateKey

const rsaKeys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })
const rsaPublicKeyPem = rsaKeys.publicKey.export({ type: "spki", format: "pem" }) as string
const rsaPrivateKey = rsaKeys.privateKey

// Unrelated key pairs for "wrong key" tests
const otherEd25519Keys = crypto.generateKeyPairSync("ed25519")
const otherEd25519PublicKeyPem = otherEd25519Keys.publicKey.export({
	type: "spki",
	format: "pem",
}) as string

const otherRsaKeys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })
const otherRsaPublicKeyPem = otherRsaKeys.publicKey.export({
	type: "spki",
	format: "pem",
}) as string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signEd25519(data: Buffer): DetachedSignature {
	const rawSig = crypto.sign(null, data, ed25519PrivateKey)
	return {
		algorithm: "ed25519",
		signatureB64: rawSig.toString("base64"),
		publisherKeyId: "test-ed25519-key-1",
	}
}

function signRsa(data: Buffer): DetachedSignature {
	const rawSig = crypto.sign("sha256", data, rsaPrivateKey)
	return {
		algorithm: "rsa-sha256",
		signatureB64: rawSig.toString("base64"),
		publisherKeyId: "test-rsa-key-1",
	}
}

const SAMPLE_DATA = Buffer.from("hello firefly marketplace", "utf8")
const TAMPERED_DATA = Buffer.from("hello firefly marketplac!", "utf8")

// ---------------------------------------------------------------------------
// verifyDetachedSignature — ed25519
// ---------------------------------------------------------------------------

describe("verifyDetachedSignature — ed25519", () => {
	it("returns verified:true for a correct signature", () => {
		const sig = signEd25519(SAMPLE_DATA)
		const input: SignatureVerifyInput = {
			data: SAMPLE_DATA,
			signature: sig,
			publicKeyPem: ed25519PublicKeyPem,
		}
		const result = verifyDetachedSignature(input)
		expect(result.verified).toBe(true)
		expect(result.reason).toBe("ok")
	})

	it("returns verified:false for tampered data", () => {
		const sig = signEd25519(SAMPLE_DATA)
		const result = verifyDetachedSignature({
			data: TAMPERED_DATA,
			signature: sig,
			publicKeyPem: ed25519PublicKeyPem,
		})
		expect(result.verified).toBe(false)
		expect(result.reason).not.toBe("ok")
	})

	it("returns verified:false when verified against the wrong public key", () => {
		const sig = signEd25519(SAMPLE_DATA)
		const result = verifyDetachedSignature({
			data: SAMPLE_DATA,
			signature: sig,
			publicKeyPem: otherEd25519PublicKeyPem,
		})
		expect(result.verified).toBe(false)
	})

	it("returns verified:false (no throw) for a malformed PEM", () => {
		const sig = signEd25519(SAMPLE_DATA)
		const result = verifyDetachedSignature({
			data: SAMPLE_DATA,
			signature: sig,
			publicKeyPem: "not-a-pem",
		})
		expect(result.verified).toBe(false)
		expect(result.reason).toMatch(/failed to parse public key PEM/)
	})

	it("does not throw for a malformed PEM — returns false with reason", () => {
		const sig = signEd25519(SAMPLE_DATA)
		expect(() =>
			verifyDetachedSignature({
				data: SAMPLE_DATA,
				signature: sig,
				publicKeyPem: "-----BEGIN PUBLIC KEY-----\nnot-valid-base64===\n-----END PUBLIC KEY-----",
			}),
		).not.toThrow()
	})
})

// ---------------------------------------------------------------------------
// verifyDetachedSignature — rsa-sha256
// ---------------------------------------------------------------------------

describe("verifyDetachedSignature — rsa-sha256", () => {
	it("returns verified:true for a correct RSA-SHA256 signature", () => {
		const sig = signRsa(SAMPLE_DATA)
		const result = verifyDetachedSignature({
			data: SAMPLE_DATA,
			signature: sig,
			publicKeyPem: rsaPublicKeyPem,
		})
		expect(result.verified).toBe(true)
		expect(result.reason).toBe("ok")
	})

	it("returns verified:false for tampered data (RSA)", () => {
		const sig = signRsa(SAMPLE_DATA)
		const result = verifyDetachedSignature({
			data: TAMPERED_DATA,
			signature: sig,
			publicKeyPem: rsaPublicKeyPem,
		})
		expect(result.verified).toBe(false)
	})

	it("returns verified:false when verified against the wrong RSA public key", () => {
		const sig = signRsa(SAMPLE_DATA)
		const result = verifyDetachedSignature({
			data: SAMPLE_DATA,
			signature: sig,
			publicKeyPem: otherRsaPublicKeyPem,
		})
		expect(result.verified).toBe(false)
	})

	it("returns verified:false (no throw) for malformed PEM (RSA path)", () => {
		const sig = signRsa(SAMPLE_DATA)
		const result = verifyDetachedSignature({
			data: SAMPLE_DATA,
			signature: sig,
			publicKeyPem: "garbage",
		})
		expect(result.verified).toBe(false)
		expect(result.reason).toMatch(/failed to parse public key PEM/)
	})
})

// ---------------------------------------------------------------------------
// derivePackageTrust — source-based rules
// ---------------------------------------------------------------------------

describe("derivePackageTrust — builtin", () => {
	it("returns built-in / unsigned regardless of signature presence", () => {
		const result = derivePackageTrust({
			source: "builtin",
			signature: null,
			publicKeyPem: null,
			data: SAMPLE_DATA,
		})
		expect(result.trustTier).toBe("built-in")
		expect(result.signatureState).toBe("unsigned")
	})
})

describe("derivePackageTrust — dev-folder", () => {
	it("returns local-dev / unsigned", () => {
		const result = derivePackageTrust({
			source: "dev-folder",
			signature: null,
			publicKeyPem: null,
			data: SAMPLE_DATA,
		})
		expect(result.trustTier).toBe("local-dev")
		expect(result.signatureState).toBe("unsigned")
	})
})

describe("derivePackageTrust — no signature", () => {
	it("returns unsigned-third-party / unsigned for open-vsx with no sig", () => {
		const result = derivePackageTrust({
			source: "open-vsx",
			signature: null,
			publicKeyPem: null,
			data: SAMPLE_DATA,
		})
		expect(result.trustTier).toBe("unsigned-third-party")
		expect(result.signatureState).toBe("unsigned")
	})

	it("returns unsigned-third-party / unsigned for manual-vsix with no sig", () => {
		const result = derivePackageTrust({
			source: "manual-vsix",
			signature: null,
			publicKeyPem: null,
			data: SAMPLE_DATA,
		})
		expect(result.trustTier).toBe("unsigned-third-party")
		expect(result.signatureState).toBe("unsigned")
	})
})

describe("derivePackageTrust — unknown publisher key", () => {
	it("returns unsigned-third-party / unverified when key is not known", () => {
		const sig = signEd25519(SAMPLE_DATA)
		const result = derivePackageTrust({
			source: "open-vsx",
			signature: sig,
			publicKeyPem: null, // key registry has no entry for this publisher
			data: SAMPLE_DATA,
		})
		expect(result.trustTier).toBe("unsigned-third-party")
		expect(result.signatureState).toBe("unverified")
		expect(result.reason).toMatch(/publisher key not known/)
	})
})

describe("derivePackageTrust — verified signature", () => {
	it("returns signed-third-party / verified for a valid ed25519 sig", () => {
		const sig = signEd25519(SAMPLE_DATA)
		const result = derivePackageTrust({
			source: "open-vsx",
			signature: sig,
			publicKeyPem: ed25519PublicKeyPem,
			data: SAMPLE_DATA,
		})
		expect(result.trustTier).toBe("signed-third-party")
		expect(result.signatureState).toBe("verified")
	})

	it("returns signed-third-party / verified for a valid rsa-sha256 sig", () => {
		const sig = signRsa(SAMPLE_DATA)
		const result = derivePackageTrust({
			source: "open-vsx",
			signature: sig,
			publicKeyPem: rsaPublicKeyPem,
			data: SAMPLE_DATA,
		})
		expect(result.trustTier).toBe("signed-third-party")
		expect(result.signatureState).toBe("verified")
	})
})

describe("derivePackageTrust — invalid signature throws", () => {
	it("throws SignatureVerificationError('integrity_mismatch') for tampered data", () => {
		const sig = signEd25519(SAMPLE_DATA)
		expect(() =>
			derivePackageTrust({
				source: "open-vsx",
				signature: sig,
				publicKeyPem: ed25519PublicKeyPem,
				data: TAMPERED_DATA, // data was modified after signing
			}),
		).toThrow(SignatureVerificationError)
	})

	it("error.code is 'integrity_mismatch'", () => {
		const sig = signEd25519(SAMPLE_DATA)
		let caught: SignatureVerificationError | null = null
		try {
			derivePackageTrust({
				source: "open-vsx",
				signature: sig,
				publicKeyPem: ed25519PublicKeyPem,
				data: TAMPERED_DATA,
			})
		} catch (err) {
			caught = err as SignatureVerificationError
		}
		expect(caught).not.toBeNull()
		expect(caught?.code).toBe("integrity_mismatch")
	})

	it("does NOT silently downgrade to unsigned when sig is invalid (fail-fast)", () => {
		// Use the wrong key — sig exists but cannot be verified.
		const sig = signEd25519(SAMPLE_DATA)
		expect(() =>
			derivePackageTrust({
				source: "open-vsx",
				signature: sig,
				publicKeyPem: otherEd25519PublicKeyPem, // wrong key
				data: SAMPLE_DATA,
			}),
		).toThrow(SignatureVerificationError)
	})

	it("throws for invalid RSA sig with correct key and tampered data", () => {
		const sig = signRsa(SAMPLE_DATA)
		expect(() =>
			derivePackageTrust({
				source: "manual-vsix",
				signature: sig,
				publicKeyPem: rsaPublicKeyPem,
				data: TAMPERED_DATA,
			}),
		).toThrow(SignatureVerificationError)
	})
})
