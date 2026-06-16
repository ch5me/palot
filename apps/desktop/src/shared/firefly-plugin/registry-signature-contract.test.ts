/**
 * Tests for registry-signature-contract.ts
 *
 * Verifies:
 *  - `canonicalManifestBytes` is deterministic (same object → identical bytes)
 *  - Output is key-order independent (object properties in different order → same bytes)
 *  - Round-trips through JSON (decode → parse → encode → same bytes)
 *  - Types compile (SignatureState, DetachedSignature, CanonicalSignedManifest, etc.)
 */

import { describe, expect, it } from "bun:test"
import {
	canonicalManifestBytes,
	type CanonicalSignedManifest,
	type DetachedSignature,
	type PackageYankEntry,
	type ServedSignatureMetadata,
	type SignatureAlgorithm,
	type SignatureState,
	type YankList,
} from "./registry-signature-contract"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MANIFEST: CanonicalSignedManifest = {
	namespace: "bobsoft",
	name: "linter",
	version: "1.0.0",
	contentSha256: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
	algorithm: "ed25519",
	signedAt: "2026-06-16T12:00:00.000Z",
	publisherKeyId: "firefly-registry-root-2026",
}

// ---------------------------------------------------------------------------
// canonicalManifestBytes — determinism
// ---------------------------------------------------------------------------

describe("canonicalManifestBytes — determinism", () => {
	it("produces identical bytes for the same input", () => {
		const a = canonicalManifestBytes(MANIFEST)
		const b = canonicalManifestBytes(MANIFEST)
		expect(a).toEqual(b)
	})

	it("produces identical bytes regardless of object construction order", () => {
		// Build a manifest with fields in a different property order.
		// TypeScript compiles this because the shape matches; JS objects carry
		// insertion order, but our serializer MUST ignore it.
		const reordered: CanonicalSignedManifest = {
			publisherKeyId: MANIFEST.publisherKeyId,
			signedAt: MANIFEST.signedAt,
			algorithm: MANIFEST.algorithm,
			contentSha256: MANIFEST.contentSha256,
			version: MANIFEST.version,
			name: MANIFEST.name,
			namespace: MANIFEST.namespace,
		}
		expect(canonicalManifestBytes(reordered)).toEqual(canonicalManifestBytes(MANIFEST))
	})

	it("produces different bytes when any field differs", () => {
		const modified: CanonicalSignedManifest = { ...MANIFEST, version: "2.0.0" }
		const a = canonicalManifestBytes(MANIFEST)
		const b = canonicalManifestBytes(modified)
		expect(a).not.toEqual(b)
	})
})

// ---------------------------------------------------------------------------
// canonicalManifestBytes — JSON round-trip
// ---------------------------------------------------------------------------

describe("canonicalManifestBytes — JSON round-trip", () => {
	it("decodes to valid JSON that round-trips back to identical bytes", () => {
		const bytes = canonicalManifestBytes(MANIFEST)
		const json = new TextDecoder().decode(bytes)
		const parsed = JSON.parse(json) as CanonicalSignedManifest
		const roundtripped = canonicalManifestBytes(parsed)
		expect(roundtripped).toEqual(bytes)
	})

	it("serialized JSON contains all manifest fields with correct values", () => {
		const bytes = canonicalManifestBytes(MANIFEST)
		const json = new TextDecoder().decode(bytes)
		const parsed = JSON.parse(json) as Record<string, string>

		expect(parsed["namespace"]).toBe(MANIFEST.namespace)
		expect(parsed["name"]).toBe(MANIFEST.name)
		expect(parsed["version"]).toBe(MANIFEST.version)
		expect(parsed["contentSha256"]).toBe(MANIFEST.contentSha256)
		expect(parsed["algorithm"]).toBe(MANIFEST.algorithm)
		expect(parsed["signedAt"]).toBe(MANIFEST.signedAt)
		expect(parsed["publisherKeyId"]).toBe(MANIFEST.publisherKeyId)
	})

	it("serialized JSON has keys in canonical order", () => {
		const bytes = canonicalManifestBytes(MANIFEST)
		const json = new TextDecoder().decode(bytes)
		const keys = Object.keys(JSON.parse(json) as object)
		expect(keys).toEqual([
			"namespace",
			"name",
			"version",
			"contentSha256",
			"algorithm",
			"signedAt",
			"publisherKeyId",
		])
	})
})

// ---------------------------------------------------------------------------
// Type compile checks (these would fail tsc/tsgo if types are wrong)
// ---------------------------------------------------------------------------

describe("type compile checks", () => {
	it("SignatureState covers the three canonical values", () => {
		const a: SignatureState = "unsigned"
		const b: SignatureState = "verified"
		const c: SignatureState = "unverified"
		expect([a, b, c]).toEqual(["unsigned", "verified", "unverified"])
	})

	it("SignatureAlgorithm covers ed25519 and rsa-sha256", () => {
		const a: SignatureAlgorithm = "ed25519"
		const b: SignatureAlgorithm = "rsa-sha256"
		expect([a, b]).toEqual(["ed25519", "rsa-sha256"])
	})

	it("DetachedSignature shape compiles", () => {
		const sig: DetachedSignature = {
			algorithm: "ed25519",
			signatureB64: "AAAA",
			publisherKeyId: "firefly-registry-root-2026",
		}
		expect(sig.algorithm).toBe("ed25519")
	})

	it("ServedSignatureMetadata shape compiles", () => {
		const served: ServedSignatureMetadata = {
			manifest: MANIFEST,
			signatureB64: "base64sighere",
		}
		expect(served.manifest.namespace).toBe("bobsoft")
	})

	it("YankList and PackageYankEntry compile", () => {
		const entry: PackageYankEntry = {
			namespace: "bobsoft",
			name: "linter",
			version: "0.9.0",
			reason: "security vulnerability",
		}
		const yanks: YankList = [entry]
		expect(yanks).toHaveLength(1)
	})
})
