/**
 * Tests for the VSIX package store.
 *
 * All tests use an injectable PackageStoreIo to avoid real filesystem
 * operations or zip extraction. The tests cover:
 *   - sha256 computation
 *   - integrity check (pass + fail)
 *   - content-addressed cache hit (no re-extraction)
 *   - package.json parse
 *   - VsixManifestMissingError when package.json absent
 */

import { describe, expect, test } from "bun:test"
import * as crypto from "node:crypto"
import * as path from "node:path"

import {
	contentAddressedPath,
	sha256Hex,
	unpackVsix,
	VsixIntegrityError,
	VsixManifestMissingError,
	type PackageStoreIo,
} from "./package-store"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBytes(content: string): Buffer {
	return Buffer.from(content, "utf8")
}

function computeSha256(content: string): string {
	return crypto.createHash("sha256").update(content).digest("hex")
}

const FAKE_PACKAGE_JSON = {
	name: "test-theme",
	displayName: "Test Theme",
	publisher: "test-publisher",
	version: "1.0.0",
	contributes: {
		themes: [{ label: "Test Theme", uiTheme: "vs-dark", path: "./themes/theme.json" }],
	},
}

const FAKE_PACKAGE_JSON_STR = JSON.stringify(FAKE_PACKAGE_JSON)

/**
 * Build a fake PackageStoreIo that simulates a VSIX with a given package.json.
 */
function buildFakeIo(
	options: {
		vsixContent?: string
		packageJsonContent?: string | null
		alreadyUnpacked?: boolean
		unzipError?: Error | null
	},
	storeRoot: string = "/store",
): PackageStoreIo & { unpackedDirs: string[]; get unzipCalled(): boolean } {
	const vsixContent = options.vsixContent ?? "fake-vsix-bytes"
	const packageJsonContent =
		options.packageJsonContent !== undefined ? options.packageJsonContent : FAKE_PACKAGE_JSON_STR
	const alreadyUnpacked = options.alreadyUnpacked ?? false
	let _unzipCalled = false
	const unpackedDirs: string[] = []

	return {
		unpackedDirs,
		get unzipCalled() {
			return _unzipCalled
		},
		readFileSync(filePath: string): Buffer {
			// The VSIX file itself
			if (filePath.endsWith(".vsix")) {
				return makeBytes(vsixContent)
			}
			// extension/package.json inside the unpacked dir
			if (filePath.endsWith("package.json") && packageJsonContent !== null) {
				return makeBytes(packageJsonContent)
			}
			throw new Error(`Fake io: unexpected readFileSync path: ${filePath}`)
		},
		existsSync(pathToCheck: string): boolean {
			// Check for extension/package.json FIRST (most specific).
			if (pathToCheck.endsWith("package.json")) return packageJsonContent !== null
			// The unpacked dir itself exists if alreadyUnpacked or mkdirSync was called.
			if (alreadyUnpacked && pathToCheck.startsWith(storeRoot + "/")) return true
			if (unpackedDirs.includes(pathToCheck)) return true
			return false
		},
		mkdirSync(dirPath: string): void {
			unpackedDirs.push(dirPath)
		},
		async unzip(_zipPath: string, _destDir: string): Promise<void> {
			_unzipCalled = true
			if (options.unzipError) throw options.unzipError
			// Simulate extraction: nothing to do in fake io
		},
	}
}

// ---------------------------------------------------------------------------
// sha256Hex
// ---------------------------------------------------------------------------

describe("sha256Hex", () => {
	test("produces 64-char lowercase hex", () => {
		const result = sha256Hex(Buffer.from("hello"))
		expect(result).toHaveLength(64)
		expect(result).toMatch(/^[0-9a-f]{64}$/)
	})

	test("is deterministic", () => {
		const a = sha256Hex(Buffer.from("test"))
		const b = sha256Hex(Buffer.from("test"))
		expect(a).toBe(b)
	})

	test("differs for different content", () => {
		expect(sha256Hex(Buffer.from("a"))).not.toBe(sha256Hex(Buffer.from("b")))
	})

	test("matches Node crypto output", () => {
		const data = Buffer.from("hello world")
		const expected = crypto.createHash("sha256").update(data).digest("hex")
		expect(sha256Hex(data)).toBe(expected)
	})
})

// ---------------------------------------------------------------------------
// contentAddressedPath
// ---------------------------------------------------------------------------

describe("contentAddressedPath", () => {
	test("joins storeRoot and sha256", () => {
		const result = contentAddressedPath("/store", "abc123")
		expect(result).toBe(path.join("/store", "abc123"))
	})
})

// ---------------------------------------------------------------------------
// unpackVsix — happy path
// ---------------------------------------------------------------------------

describe("unpackVsix", () => {
	test("returns correct sha256, unpackedPath, manifestPath, packageJson", async () => {
		const vsixContent = "fake-vsix-content"
		const expectedSha = computeSha256(vsixContent)
		const io = buildFakeIo({ vsixContent })

		const result = await unpackVsix("/path/to/theme.vsix", {
			packageStoreRoot: "/store",
			io,
		})

		expect(result.contentSha256).toBe(expectedSha)
		expect(result.unpackedPath).toBe(path.join("/store", expectedSha))
		expect(result.manifestPath).toBe(path.join("/store", expectedSha, "extension", "package.json"))
		expect(result.packageJson).toMatchObject({ name: "test-theme" })
		expect(result.vsixPath).toBe("/path/to/theme.vsix")
	})

	test("extracts ZIP when dir not present", async () => {
		const io = buildFakeIo({})
		await unpackVsix("/fake.vsix", { packageStoreRoot: "/store", io })
		expect(io.unzipCalled).toBe(true)
	})

	test("skips extraction when content-addressed dir already exists", async () => {
		const io = buildFakeIo({ alreadyUnpacked: true })
		await unpackVsix("/fake.vsix", { packageStoreRoot: "/store", io })
		expect(io.unzipCalled).toBe(false)
	})

	test("passes sha256 verification when expectedSha256 matches", async () => {
		const vsixContent = "correct-content"
		const expectedSha = computeSha256(vsixContent)
		const io = buildFakeIo({ vsixContent })

		// Should not throw
		const result = await unpackVsix("/fake.vsix", {
			packageStoreRoot: "/store",
			expectedSha256: expectedSha,
			io,
		})
		expect(result.contentSha256).toBe(expectedSha)
	})
})

// ---------------------------------------------------------------------------
// unpackVsix — integrity failure
// ---------------------------------------------------------------------------

describe("unpackVsix — integrity failure", () => {
	test("throws VsixIntegrityError when sha256 does not match", async () => {
		const io = buildFakeIo({ vsixContent: "actual-content" })
		const wrongSha = "0".repeat(64)

		await expect(
			unpackVsix("/fake.vsix", {
				packageStoreRoot: "/store",
				expectedSha256: wrongSha,
				io,
			}),
		).rejects.toThrow(VsixIntegrityError)
	})

	test("VsixIntegrityError carries expected and actual sha256", async () => {
		const vsixContent = "some-bytes"
		const io = buildFakeIo({ vsixContent })
		const wrongSha = "f".repeat(64)
		const actualSha = computeSha256(vsixContent)

		let caught: VsixIntegrityError | null = null
		try {
			await unpackVsix("/fake.vsix", {
				packageStoreRoot: "/store",
				expectedSha256: wrongSha,
				io,
			})
		} catch (err) {
			caught = err as VsixIntegrityError
		}

		expect(caught).not.toBeNull()
		expect(caught?.expected).toBe(wrongSha)
		expect(caught?.actual).toBe(actualSha)
		expect(caught?.vsixPath).toBe("/fake.vsix")
	})

	test("does not extract when integrity check fails (fail-loud, no partial state)", async () => {
		const io = buildFakeIo({ vsixContent: "bytes" })
		const wrongSha = "a".repeat(64)

		try {
			await unpackVsix("/fake.vsix", {
				packageStoreRoot: "/store",
				expectedSha256: wrongSha,
				io,
			})
		} catch {
			// Expected
		}

		// unzip must never have been called
		expect(io.unzipCalled).toBe(false)
	})
})

// ---------------------------------------------------------------------------
// unpackVsix — missing extension/package.json
// ---------------------------------------------------------------------------

describe("unpackVsix — missing package.json", () => {
	test("throws VsixManifestMissingError when extension/package.json absent", async () => {
		const io = buildFakeIo({ packageJsonContent: null })

		await expect(
			unpackVsix("/fake.vsix", { packageStoreRoot: "/store", io }),
		).rejects.toThrow(VsixManifestMissingError)
	})

	test("VsixManifestMissingError carries the unpackedPath", async () => {
		const vsixContent = "bytes"
		const expectedSha = computeSha256(vsixContent)
		const io = buildFakeIo({ vsixContent, packageJsonContent: null })

		let caught: VsixManifestMissingError | null = null
		try {
			await unpackVsix("/fake.vsix", { packageStoreRoot: "/store", io })
		} catch (err) {
			caught = err as VsixManifestMissingError
		}

		expect(caught).not.toBeNull()
		expect(caught?.unpackedPath).toBe(path.join("/store", expectedSha))
	})
})

// ---------------------------------------------------------------------------
// unpackVsix — corrupt package.json
// ---------------------------------------------------------------------------

describe("unpackVsix — corrupt package.json", () => {
	test("throws on invalid JSON in package.json", async () => {
		const io = buildFakeIo({ packageJsonContent: "{ not valid json }" })

		await expect(
			unpackVsix("/fake.vsix", { packageStoreRoot: "/store", io }),
		).rejects.toThrow()
	})
})

// ---------------------------------------------------------------------------
// unpackVsix — unzip error propagates
// ---------------------------------------------------------------------------

describe("unpackVsix — unzip error", () => {
	test("propagates errors from io.unzip", async () => {
		const io = buildFakeIo({ unzipError: new Error("bad zip file") })

		await expect(
			unpackVsix("/fake.vsix", { packageStoreRoot: "/store", io }),
		).rejects.toThrow("bad zip file")
	})
})
