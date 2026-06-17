/**
 * Smoke tests for the signing CLI fixtures + the verify path.
 *
 * Loads the committed ephemeral fixtures and confirms:
 *   clean  fixture → signature verifies + sha cross-check passes
 *   tampered fixture → signature verifies but sha cross-check FAILS
 *   absent signature → no sig.json → treated as absent (undefined)
 *
 * Uses only `node:crypto` (main-process is fine) — no spawning.
 */

import { createHash, createPublicKey, verify as cryptoVerify } from "node:crypto"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, it, expect } from "bun:test"

import {
	canonicalManifestBytes,
	type ServedSignatureMetadata,
} from "../../../shared/firefly-plugin/registry-signature-contract"

// ---------------------------------------------------------------------------
// Fixture paths
// ---------------------------------------------------------------------------

const fixturesDir = join(
	dirname(fileURLToPath(import.meta.url)),
	"__fixtures__",
	"signed",
)

function fixturePath(name: string): string {
	return join(fixturesDir, name)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256Hex(buf: Buffer): string {
	return createHash("sha256").update(buf).digest("hex")
}

function loadSig(pkgName: string): ServedSignatureMetadata {
	const raw = readFileSync(fixturePath(`${pkgName}.sig.json`), "utf8")
	return JSON.parse(raw) as ServedSignatureMetadata
}

function loadPub(): string {
	return readFileSync(fixturePath("ephemeral.pub.pem"), "utf8")
}

function verifySig(sigMeta: ServedSignatureMetadata, pubPem: string): boolean {
	const pub = createPublicKey(pubPem)
	const sigBuf = Buffer.from(sigMeta.signatureB64, "base64")
	const manifestBuf = Buffer.from(canonicalManifestBytes(sigMeta.manifest))
	return cryptoVerify(null, manifestBuf, pub, sigBuf)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sign-plugin-package fixtures", () => {
	const CLEAN_PKG = "bobsoft-linter-0.1.0.fpk"
	const TAMPERED_PKG = "bobsoft-linter-0.1.0-tampered.fpk"

	it("clean fixture: canonical-manifest signature verifies", () => {
		const sigMeta = loadSig(CLEAN_PKG)
		const pubPem = loadPub()

		expect(verifySig(sigMeta, pubPem)).toBe(true)
	})

	it("clean fixture: contentSha256 matches package bytes", () => {
		const sigMeta = loadSig(CLEAN_PKG)
		const pkgBytes = readFileSync(fixturePath(CLEAN_PKG))

		expect(sha256Hex(pkgBytes)).toBe(sigMeta.manifest.contentSha256)
	})

	it("tampered fixture: canonical-manifest signature still verifies (sig was not forged)", () => {
		// The .sig.json is the CLEAN package's sig — so the manifest was signed correctly.
		// The tampered check comes from the sha cross-check, not the manifest sig itself.
		const sigMeta = loadSig(TAMPERED_PKG)
		const pubPem = loadPub()

		expect(verifySig(sigMeta, pubPem)).toBe(true)
	})

	it("tampered fixture: contentSha256 does NOT match tampered package bytes (integrity mismatch)", () => {
		const sigMeta = loadSig(TAMPERED_PKG)
		const tamperedBytes = readFileSync(fixturePath(TAMPERED_PKG))

		// sha256(tampered bytes) !== manifest.contentSha256 → integrity mismatch
		expect(sha256Hex(tamperedBytes)).not.toBe(sigMeta.manifest.contentSha256)
	})

	it("absent-signature case: no .sig.json → sig is absent", () => {
		// The absent case is modeled as: trying to read a sig.json that doesn't exist
		// throws — the caller must treat an absent sig.json as absent (no sig, not a parse error).
		// Here we assert the clean package's .sig.json DOES NOT exist for the unsigned variant.
		let parsed: ServedSignatureMetadata | undefined
		try {
			parsed = loadSig("bobsoft-linter-0.1.0-unsigned.fpk")
		} catch {
			parsed = undefined
		}
		// Absent = no sig metadata could be loaded.
		expect(parsed).toBeUndefined()
	})

	it("manifest has the expected fields and algorithm", () => {
		const { manifest } = loadSig(CLEAN_PKG)

		expect(manifest.namespace).toBe("bobsoft")
		expect(manifest.name).toBe("linter")
		expect(manifest.version).toBe("0.1.0")
		expect(manifest.algorithm).toBe("ed25519")
		expect(manifest.publisherKeyId).toBe("ephemeral-test-key")
		expect(manifest.signedAt).toBe("2026-06-16T00:00:00.000Z")
		expect(typeof manifest.contentSha256).toBe("string")
		expect(manifest.contentSha256).toHaveLength(64) // sha256 hex
	})

	it("canonicalManifestBytes is deterministic regardless of input object key order", () => {
		const { manifest } = loadSig(CLEAN_PKG)

		// Shuffle key order by building a new object with reversed key insertion order.
		const shuffled = {
			publisherKeyId: manifest.publisherKeyId,
			signedAt: manifest.signedAt,
			algorithm: manifest.algorithm,
			contentSha256: manifest.contentSha256,
			version: manifest.version,
			name: manifest.name,
			namespace: manifest.namespace,
		}

		const a = Buffer.from(canonicalManifestBytes(manifest))
		const b = Buffer.from(canonicalManifestBytes(shuffled as typeof manifest))

		expect(a.equals(b)).toBe(true)
	})
})
