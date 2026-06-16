/**
 * End-to-end test for the VS Code theme install orchestrator.
 *
 * Proves the full flow: input → installed record → convertible theme.
 *
 * Uses:
 *   - A synthetic in-memory VSIX (minimal valid ZIP with package.json + theme JSON).
 *   - Injectable IO to avoid real fs operations.
 *   - Injectable store functions to avoid a real SQLite DB.
 *
 * What this test proves:
 *   1. A local .vsix → installExtension() resolves without error.
 *   2. The returned `themes` array contains the converted ImportedThemeContribution.
 *   3. The returned `package.id` equals the sha256 of the VSIX bytes.
 *   4. The returned `installation.packageId` matches `package.id`.
 *   5. Re-running with the same bytes returns a new installation record but
 *      reuses the existing package record (idempotent content-addressed package).
 *   6. sha256 mismatch → throws "integrity check failed".
 */

import { describe, expect, it } from "bun:test"
import * as crypto from "node:crypto"
import { installExtension, type OrchestratorIo, type ExtensionStoreFns } from "./install-orchestrator"
import type { ExtensionPackageRecord, ExtensionInstallationRecord } from "./extension-store"

// ---------------------------------------------------------------------------
// Minimal ZIP builder (hand-rolled, no deps)
// ---------------------------------------------------------------------------

function crc32(buf: Buffer): number {
	let crc = 0xffffffff
	for (let i = 0; i < buf.length; i++) {
		crc ^= buf[i]!
		for (let j = 0; j < 8; j++) {
			crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
		}
	}
	return (crc ^ 0xffffffff) >>> 0
}

function buildZip(entries: { name: string; content: string }[]): Buffer {
	const localParts: Buffer[] = []
	const cdParts: Buffer[] = []
	let offset = 0

	for (const entry of entries) {
		const nameBytes = Buffer.from(entry.name, "utf8")
		const data = Buffer.from(entry.content, "utf8")
		const crc = crc32(data)

		// Local file record
		const local = Buffer.alloc(30 + nameBytes.length)
		local.writeUInt32LE(0x04034b50, 0)
		local.writeUInt16LE(20, 4)
		local.writeUInt16LE(0, 6)
		local.writeUInt16LE(0, 8)
		local.writeUInt16LE(0, 10)
		local.writeUInt16LE(0, 12)
		local.writeUInt32LE(crc, 14)
		local.writeUInt32LE(data.length, 18)
		local.writeUInt32LE(data.length, 22)
		local.writeUInt16LE(nameBytes.length, 26)
		local.writeUInt16LE(0, 28)
		nameBytes.copy(local, 30)
		const localRecord = Buffer.concat([local, data])

		// Central directory record
		const cd = Buffer.alloc(46 + nameBytes.length)
		cd.writeUInt32LE(0x02014b50, 0)
		cd.writeUInt16LE(20, 4)
		cd.writeUInt16LE(20, 6)
		cd.writeUInt16LE(0, 8)
		cd.writeUInt16LE(0, 10)
		cd.writeUInt16LE(0, 12)
		cd.writeUInt16LE(0, 14)
		cd.writeUInt32LE(crc, 16)
		cd.writeUInt32LE(data.length, 20)
		cd.writeUInt32LE(data.length, 24)
		cd.writeUInt16LE(nameBytes.length, 28)
		cd.writeUInt16LE(0, 30)
		cd.writeUInt16LE(0, 32)
		cd.writeUInt16LE(0, 34)
		cd.writeUInt16LE(0, 36)
		cd.writeUInt32LE(0, 38)
		cd.writeUInt32LE(offset, 42)
		nameBytes.copy(cd, 46)

		localParts.push(localRecord)
		cdParts.push(cd)
		offset += localRecord.length
	}

	const centralDir = Buffer.concat(cdParts)
	const eocd = Buffer.alloc(22)
	eocd.writeUInt32LE(0x06054b50, 0)
	eocd.writeUInt16LE(0, 4)
	eocd.writeUInt16LE(0, 6)
	eocd.writeUInt16LE(entries.length, 8)
	eocd.writeUInt16LE(entries.length, 10)
	eocd.writeUInt32LE(centralDir.length, 12)
	eocd.writeUInt32LE(offset, 16)
	eocd.writeUInt16LE(0, 20)

	return Buffer.concat([...localParts, centralDir, eocd])
}

// ---------------------------------------------------------------------------
// Synthetic VSIX fixture
// ---------------------------------------------------------------------------

const PACKAGE_JSON = JSON.stringify({
	name: "test-theme",
	displayName: "Test Theme",
	publisher: "test-publisher",
	version: "1.0.0",
	contributes: {
		themes: [
			{
				label: "Test Dark Theme",
				uiTheme: "vs-dark",
				path: "./themes/dark.json",
			},
		],
	},
})

const THEME_JSON = JSON.stringify({
	name: "Test Dark Theme",
	type: "dark",
	colors: {
		"editor.background": "#1e1e1e",
		"editor.foreground": "#d4d4d4",
		"sideBar.background": "#252526",
	},
	tokenColors: [],
	semanticTokenColors: {},
})

function buildMinimalVsixBytes(): { vsixBytes: Buffer; expectedSha256: string } {
	const vsixBytes = buildZip([
		{ name: "extension/package.json", content: PACKAGE_JSON },
		{ name: "extension/themes/dark.json", content: THEME_JSON },
	])
	const expectedSha256 = crypto.createHash("sha256").update(vsixBytes).digest("hex")
	return { vsixBytes, expectedSha256 }
}

// ---------------------------------------------------------------------------
// Injectable IO (fake, no real fs)
// ---------------------------------------------------------------------------

function buildFakeIo(vsixBytes: Buffer, vsixPath: string, packageStoreRoot: string): OrchestratorIo {
	const sha256 = crypto.createHash("sha256").update(vsixBytes).digest("hex")
	const unpackedDir = `${packageStoreRoot}/${sha256}`

	// Pre-populate the files that extract-zip would normally create
	const files = new Map<string, Buffer>([
		[vsixPath, vsixBytes],
		[`${unpackedDir}/extension/package.json`, Buffer.from(PACKAGE_JSON)],
		[`${unpackedDir}/extension/themes/dark.json`, Buffer.from(THEME_JSON)],
	])

	return {
		writeTemp(data: Buffer, suffix: string): string {
			const p = `/fake/tmp/vsix${suffix}`
			files.set(p, data)
			return p
		},
		readFileSync(filePath: string): Buffer {
			const d = files.get(filePath)
			if (!d) throw new Error(`FakeIO: file not found: ${filePath}`)
			return d
		},
		existsSync(p: string): boolean {
			if (p === unpackedDir) return true
			return files.has(p)
		},
		mkdirSync(_p: string): void {},
		async unzip(_zip: string, _dest: string): Promise<void> {},
		unlinkSync(p: string): void {
			files.delete(p)
		},
		fetch: (_url: string) => {
			throw new Error("FakeIO: unexpected network call")
		},
	}
}

// ---------------------------------------------------------------------------
// Injectable store (in-memory, no SQLite)
// ---------------------------------------------------------------------------

function buildFakeStore(): ExtensionStoreFns & {
	packages: Map<string, ExtensionPackageRecord>
	installations: Map<string, ExtensionInstallationRecord>
} {
	const packages = new Map<string, ExtensionPackageRecord>()
	const installations = new Map<string, ExtensionInstallationRecord>()

	const store: ExtensionStoreFns = {
		async upsertExtensionPackage(input): Promise<ExtensionPackageRecord> {
			const existing = packages.get(input.id)
			if (existing) return existing
			const row: ExtensionPackageRecord = {
				id: input.id,
				externalId: input.externalId,
				publisher: input.publisher ?? null,
				name: input.name,
				version: input.version,
				displayName: input.displayName ?? null,
				registrySource: input.registrySource,
				vsixPath: input.vsixPath ?? null,
				unpackedPath: input.unpackedPath,
				signatureState: input.signatureState ?? "unsigned",
				scanState: input.scanState ?? "pending",
				themesJson: input.themesJson ?? null,
				createdAt: Date.now(),
			}
			packages.set(input.id, row)
			return row
		},
		async createExtensionInstallation(input): Promise<ExtensionInstallationRecord> {
			const now = Date.now()
			const id = `${input.packageId}-${now}-${Math.random()}`
			const row: ExtensionInstallationRecord = {
				id,
				packageId: input.packageId,
				lifecycleState: input.lifecycleState ?? "installed",
				trustTier: input.trustTier ?? "unsigned-third-party",
				scope: input.scope ?? "app",
				appliedThemeId: input.appliedThemeId ?? null,
				installedAt: now,
				updatedAt: now,
			}
			installations.set(id, row)
			return row
		},
	}

	return Object.assign(store, { packages, installations })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("installExtension (end-to-end)", () => {
	const PACKAGE_STORE_ROOT = "/fake/package-store"
	const FAKE_VSIX_PATH = "/fake/test-theme-1.0.0.vsix"

	it("installs a local VSIX and returns converted themes", async () => {
		const { vsixBytes, expectedSha256 } = buildMinimalVsixBytes()
		const io = buildFakeIo(vsixBytes, FAKE_VSIX_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()

		const result = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_VSIX_PATH, expectedSha256 },
			{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
		)

		// Assert: package record matches sha256 (content-addressed)
		expect(result.package.id).toBe(expectedSha256)
		expect(result.package.externalId).toBe("test-publisher.test-theme")
		expect(result.package.name).toBe("test-theme")
		expect(result.package.version).toBe("1.0.0")
		expect(result.package.registrySource).toBe("manual-vsix")

		// Assert: installation record created and linked to package
		expect(result.installation.packageId).toBe(expectedSha256)
		expect(result.installation.lifecycleState).toBe("installed")

		// Assert: themes were converted
		expect(result.themes).toHaveLength(1)
		const theme = result.themes[0]!
		expect(theme.label).toBe("Test Dark Theme")
		expect(theme.kind).toBe("dark")
		// Color map assertions (real shadcn tokens — see VSCODE_COLOR_MAP)
		expect(theme.appTokens["--background"]).toBe("#1e1e1e")
		expect(theme.appTokens["--foreground"]).toBe("#d4d4d4")
		expect(theme.appTokens["--sidebar"]).toBe("#252526")

		// Assert: source provenance
		expect(theme.source.registry).toBe("manual-vsix")
		expect(theme.source.externalId).toBe("test-publisher.test-theme")
		expect(theme.source.version).toBe("1.0.0")

		// Assert: in-memory store received the writes
		expect(store.packages.size).toBe(1)
		expect(store.installations.size).toBe(1)
	})

	it("is idempotent: same VSIX bytes → reuses package, creates new installation", async () => {
		const { vsixBytes, expectedSha256 } = buildMinimalVsixBytes()
		const io = buildFakeIo(vsixBytes, FAKE_VSIX_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()

		const result1 = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_VSIX_PATH, expectedSha256 },
			{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
		)
		const result2 = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_VSIX_PATH, expectedSha256 },
			{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
		)

		// Same content-addressed package
		expect(result1.package.id).toBe(expectedSha256)
		expect(result2.package.id).toBe(expectedSha256)

		// Two different installation records
		expect(result1.installation.id).not.toBe(result2.installation.id)
		expect(store.packages.size).toBe(1) // package deduped
		expect(store.installations.size).toBe(2) // two install records
	})

	it("fails loud on sha256 mismatch (VsixIntegrityError)", async () => {
		const { vsixBytes } = buildMinimalVsixBytes()
		const io = buildFakeIo(vsixBytes, FAKE_VSIX_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()

		await expect(
			installExtension(
				{
					kind: "local-vsix",
					vsixPath: FAKE_VSIX_PATH,
					expectedSha256: "0".repeat(64),
				},
				{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
			),
		).rejects.toThrow("integrity check failed")

		// No records should have been written
		expect(store.packages.size).toBe(0)
		expect(store.installations.size).toBe(0)
	})
})
