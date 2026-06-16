/**
 * Firefly Plugin System V2 — VSIX package store (§8)
 *
 * Given a local .vsix path (OPC zip), this module:
 *   1. Reads the file bytes and verifies the SHA-256 checksum.
 *   2. Unpacks to a content-addressed directory under app userData.
 *   3. Reads and returns `extension/package.json`.
 *
 * Content-addressed layout:
 *   <packageStoreRoot>/<sha256>/
 *     extension/
 *       package.json
 *       ... (rest of unpacked VSIX)
 *
 * The root defaults to `<userData>/firefly-plugin-packages/` when no
 * override is supplied.
 *
 * Architecture:
 *   - Fails loud on integrity mismatch (CH5 fail-fast; no silent fallback).
 *   - Io is injectable for tests (no real fs required in unit tests).
 *   - Uses `extract-zip` (already present in the monorepo node_modules)
 *     for ZIP/OPC unpacking. extract-zip uses yauzl internally.
 *   - Node `crypto.createHash("sha256")` for checksum — no external deps.
 */

import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"

import { createLogger } from "../../logger"

const log = createLogger("firefly-plugin/package-store")

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Result of a successful VSIX unpack operation.
 */
export interface UnpackedVsixResult {
	/** SHA-256 hex of the VSIX file bytes. */
	contentSha256: string
	/** Absolute path to the unpacked directory (content-addressed). */
	unpackedPath: string
	/** Absolute path to `extension/package.json` inside the unpacked dir. */
	manifestPath: string
	/** Parsed contents of `extension/package.json`. */
	packageJson: unknown
	/** Source VSIX path that was unpacked. */
	vsixPath: string
}

/**
 * Error thrown when a VSIX file's SHA-256 does not match the expected
 * digest. The install pipeline must treat this as a hard abort — never
 * continue with unverified bytes.
 */
export class VsixIntegrityError extends Error {
	constructor(
		public readonly vsixPath: string,
		public readonly expected: string,
		public readonly actual: string,
	) {
		super(
			`VSIX integrity check failed for ${vsixPath}: expected sha256=${expected}, got sha256=${actual}`,
		)
		this.name = "VsixIntegrityError"
	}
}

/**
 * Error thrown when the VSIX does not contain `extension/package.json`.
 */
export class VsixManifestMissingError extends Error {
	constructor(public readonly unpackedPath: string) {
		super(`VSIX unpack succeeded but extension/package.json is missing in ${unpackedPath}`)
		this.name = "VsixManifestMissingError"
	}
}

// ---------------------------------------------------------------------------
// Injectable IO interface (for tests)
// ---------------------------------------------------------------------------

/**
 * IO interface for the package store. Production uses the real Node fs +
 * extract-zip; tests inject fakes to avoid real filesystem operations.
 */
export interface PackageStoreIo {
	/**
	 * Return the raw bytes of a file synchronously, or throw on error.
	 */
	readFileSync(filePath: string): Buffer
	/**
	 * Return true when a path exists (directory or file).
	 */
	existsSync(pathToCheck: string): boolean
	/**
	 * Create a directory (and parents) synchronously. Must be idempotent.
	 */
	mkdirSync(dirPath: string): void
	/**
	 * Unpack a ZIP file at `zipPath` into `destDir`. Returns a Promise
	 * that resolves when all files are extracted.
	 */
	unzip(zipPath: string, destDir: string): Promise<void>
}

/**
 * Production IO implementation using `extract-zip` + Node `fs`.
 */
export function createNodePackageStoreIo(): PackageStoreIo {
	return {
		readFileSync(filePath: string): Buffer {
			return fs.readFileSync(filePath)
		},
		existsSync(pathToCheck: string): boolean {
			return fs.existsSync(pathToCheck)
		},
		mkdirSync(dirPath: string): void {
			fs.mkdirSync(dirPath, { recursive: true })
		},
		async unzip(zipPath: string, destDir: string): Promise<void> {
			// extract-zip is already installed in the monorepo (electron-builder dep).
			// We require it lazily so it never runs in unit tests that inject a fake io.
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const extractZip = require("extract-zip") as (zipPath: string, opts: { dir: string }) => Promise<void>
			await extractZip(zipPath, { dir: destDir })
		},
	}
}

// ---------------------------------------------------------------------------
// Core implementation
// ---------------------------------------------------------------------------

/**
 * Options for `unpackVsix`.
 */
export interface UnpackVsixOptions {
	/**
	 * Root directory under which content-addressed package dirs live.
	 * Defaults to `<userData>/firefly-plugin-packages/` when not supplied.
	 * Must be an absolute path when provided.
	 */
	packageStoreRoot?: string
	/**
	 * If provided, verify the VSIX's SHA-256 digest before unpacking.
	 * Pass the hex digest string (64 lowercase hex chars).
	 * Throws `VsixIntegrityError` on mismatch.
	 */
	expectedSha256?: string
	/**
	 * Injectable IO; defaults to the real Node fs implementation.
	 */
	io?: PackageStoreIo
}

/**
 * Compute the SHA-256 hex digest of a Buffer.
 */
export function sha256Hex(data: Buffer): string {
	return crypto.createHash("sha256").update(data).digest("hex")
}

/**
 * Given a local `.vsix` path, verify (optional), unpack to a content-addressed
 * directory, and return the parsed `extension/package.json`.
 *
 * Steps:
 *   1. Read the VSIX bytes.
 *   2. Compute SHA-256.
 *   3. If `expectedSha256` supplied, reject on mismatch (fail-loud).
 *   4. If the content-addressed dir already exists, skip extraction
 *      (idempotent — the same bytes always produce the same dir).
 *   5. Extract the ZIP into `<packageStoreRoot>/<sha256>/`.
 *   6. Read + parse `extension/package.json`.
 *   7. Return `UnpackedVsixResult`.
 *
 * @throws `VsixIntegrityError`       on SHA-256 mismatch.
 * @throws `VsixManifestMissingError` when extension/package.json is absent.
 * @throws any error from `io.unzip`  on ZIP parse failure.
 */
export async function unpackVsix(
	vsixPath: string,
	options: UnpackVsixOptions = {},
): Promise<UnpackedVsixResult> {
	const io = options.io ?? createNodePackageStoreIo()

	// 1. Read the VSIX bytes.
	log.info("Reading VSIX file", { vsixPath })
	const vsixBytes = io.readFileSync(vsixPath)

	// 2. Compute SHA-256.
	const contentSha256 = sha256Hex(vsixBytes)
	log.info("VSIX SHA-256 computed", { vsixPath, contentSha256 })

	// 3. Integrity check (optional but recommended).
	if (options.expectedSha256 !== undefined) {
		if (options.expectedSha256 !== contentSha256) {
			log.error("VSIX integrity check failed", {
				vsixPath,
				expected: options.expectedSha256,
				actual: contentSha256,
			})
			throw new VsixIntegrityError(vsixPath, options.expectedSha256, contentSha256)
		}
		log.info("VSIX integrity check passed", { vsixPath })
	}

	// Resolve the package store root.
	let storeRoot = options.packageStoreRoot
	if (!storeRoot) {
		// Default: resolve via Electron app.getPath("userData") when available.
		storeRoot = resolveDefaultPackageStoreRoot()
	}

	const unpackedPath = path.join(storeRoot, contentSha256)

	// 4. Skip extraction if already present (content-addressed = idempotent).
	if (io.existsSync(unpackedPath)) {
		log.info("VSIX already unpacked (content-addressed cache hit)", { unpackedPath })
	} else {
		// 5. Extract.
		io.mkdirSync(unpackedPath)
		log.info("Unpacking VSIX", { vsixPath, unpackedPath })
		await io.unzip(vsixPath, unpackedPath)
		log.info("VSIX unpacked", { unpackedPath })
	}

	// 6. Read extension/package.json.
	const manifestPath = path.join(unpackedPath, "extension", "package.json")
	if (!io.existsSync(manifestPath)) {
		throw new VsixManifestMissingError(unpackedPath)
	}

	const manifestBytes = io.readFileSync(manifestPath)
	let packageJson: unknown
	try {
		packageJson = JSON.parse(manifestBytes.toString("utf8"))
	} catch (err) {
		throw new Error(
			`Failed to parse extension/package.json in ${unpackedPath}: ${err instanceof Error ? err.message : String(err)}`,
		)
	}

	log.info("VSIX package.json read", { manifestPath })

	return {
		contentSha256,
		unpackedPath,
		manifestPath,
		packageJson,
		vsixPath,
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the default package store root from the Electron userData path.
 * Falls back to a temp-dir path in non-Electron environments (tests).
 */
export function resolveDefaultPackageStoreRoot(): string {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const electron = require("electron") as typeof import("electron")
		if (electron?.app) {
			return path.join(electron.app.getPath("userData"), "firefly-plugin-packages")
		}
	} catch {
		// Not in Electron (e.g. bun test runner)
	}
	// Fallback for test environments: use a stable tmp path
	return path.join(
		process.env.TMPDIR ?? process.env.TMP ?? "/tmp",
		"firefly-plugin-packages-test",
	)
}

/**
 * Build the content-addressed path for a given sha256 under the store root.
 * This is the canonical path where a package's extracted files live.
 */
export function contentAddressedPath(storeRoot: string, contentSha256: string): string {
	return path.join(storeRoot, contentSha256)
}
