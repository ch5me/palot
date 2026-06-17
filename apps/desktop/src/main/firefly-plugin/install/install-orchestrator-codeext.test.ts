/**
 * F1 — Code-extension install branch in `installExtension`.
 *
 * Proves:
 *   1. A Firefly code-extension FPK (has `extension/manifest.json`) installs
 *      without throwing — the theme-only throw is GONE.
 *   2. The returned `descriptor` carries the correct pluginId, tools, commands,
 *      runtimeResolution (`electron-utility`), and requiredCapabilities.
 *   3. `package.pluginManifestJson` round-trips to the parsed manifest.
 *   4. `package.requiredCapabilitiesJson` serialises the declared capabilities.
 *   5. `installation.lifecycleState === "installed"` and `trustTier` matches
 *      the trust derived by A2.
 *   6. A VS Code theme package (has `extension/package.json` with
 *      `contributes.themes`, no `manifest.json`) still installs via the theme
 *      path (no throw, `descriptor === null`, `themes.length > 0`).
 *   7. A package with neither a Firefly manifest nor any theme declarations
 *      throws loud.
 *
 * Fixture: synthetic `bobsoft-linter` manifest — non-reserved namespace,
 * `trust:"signed-third-party"`, one command + one tool (medium+ capability),
 * `runtime: { hostKind:"node-worker", … }`.
 *
 * Uses injectable IO + store (no real fs, no real SQLite).
 */

import { describe, expect, it } from "bun:test"
import * as crypto from "node:crypto"
import {
	installExtension,
	type OrchestratorIo,
	type ExtensionStoreFns,
} from "./install-orchestrator"
import type { ExtensionPackageRecord, ExtensionInstallationRecord } from "./extension-store"

// ---------------------------------------------------------------------------
// Minimal ZIP builder (identical to the one in install-orchestrator.test.ts)
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
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Synthetic `bobsoft-linter` Firefly manifest. Non-reserved namespace
 * ("bobsoft"), trust:"signed-third-party", one command + one tool that
 * requires a medium+ capability, runtime: node-worker on electron.
 *
 * Args are JSON-Schema object fragments (as required by parseJsonPluginManifest).
 */
const BOBSOFT_LINTER_MANIFEST = JSON.stringify({
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "bobsoft.linter",
	displayName: "BobSoft Linter",
	version: "0.1.0",
	publisher: "BobSoft",
	description: "A synthetic linter plugin for testing the F1 install branch.",
	trust: "signed-third-party",
	activationEvents: [
		{ kind: "onStartup" },
	],
	contributes: {
		commands: [
			{
				id: "greet",
				title: "Greet",
				description: "Say hello",
				requires: [],
			},
		],
		tools: [
			{
				id: "plugin.bobsoft.linter.read-config",
				title: "Read linter config",
				description: "Reads the linter configuration for the current project.",
				scope: "session",
				requires: ["fs:read"],
				args: {
					type: "object",
					properties: {
						projectPath: { type: "string", description: "Absolute path to the project root." },
					},
					required: ["projectPath"],
				},
			},
		],
	},
	capabilities: ["fs:read"],
	runtime: {
		hostKind: "node-worker",
		surfaces: ["electron"],
		webStrategy: "cloud-host",
	},
})

/**
 * Synthetic VS Code theme package (package.json only, no manifest.json).
 */
const THEME_PACKAGE_JSON = JSON.stringify({
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal package.json present in every VSIX/FPK (the VSIX container requires it).
 * For a Firefly FPK this has NO contributes.themes so the code-ext branch is taken.
 */
const BOBSOFT_PACKAGE_JSON = JSON.stringify({
	name: "bobsoft-linter",
	displayName: "BobSoft Linter",
	publisher: "BobSoft",
	version: "0.1.0",
	description: "A synthetic linter plugin for testing the F1 install branch.",
	contributes: {},
})

function buildCodeExtFpkBytes(): { fpkBytes: Buffer; expectedSha256: string } {
	const fpkBytes = buildZip([
		// VSIX container requires extension/package.json
		{ name: "extension/package.json", content: BOBSOFT_PACKAGE_JSON },
		// Firefly-specific: extension/manifest.json triggers the code-ext branch
		{ name: "extension/manifest.json", content: BOBSOFT_LINTER_MANIFEST },
		// Worker entry (presence not required by F1 — F3 checks this at registration)
		{ name: "extension/worker.mjs", content: "export function activate() {}" },
	])
	const expectedSha256 = crypto.createHash("sha256").update(fpkBytes).digest("hex")
	return { fpkBytes, expectedSha256 }
}

function buildThemeVsixBytes(): { vsixBytes: Buffer; expectedSha256: string } {
	const vsixBytes = buildZip([
		{ name: "extension/package.json", content: THEME_PACKAGE_JSON },
		{ name: "extension/themes/dark.json", content: THEME_JSON },
	])
	const expectedSha256 = crypto.createHash("sha256").update(vsixBytes).digest("hex")
	return { vsixBytes, expectedSha256 }
}

function buildEmptyVsixBytes(): { vsixBytes: Buffer; expectedSha256: string } {
	const vsixBytes = buildZip([
		{
			name: "extension/package.json",
			content: JSON.stringify({ name: "nothing", version: "1.0.0", publisher: "x", contributes: {} }),
		},
	])
	const expectedSha256 = crypto.createHash("sha256").update(vsixBytes).digest("hex")
	return { vsixBytes, expectedSha256 }
}

function buildFakeIo(
	bytes: Buffer,
	vsixPath: string,
	packageStoreRoot: string,
	extraFiles?: Map<string, Buffer>,
): OrchestratorIo {
	const sha256 = crypto.createHash("sha256").update(bytes).digest("hex")
	const unpackedDir = `${packageStoreRoot}/${sha256}`

	// Parse what files are inside the ZIP so our fake IO can serve them.
	// We just pre-populate everything the orchestrator might read.
	const files = new Map<string, Buffer>([
		[vsixPath, bytes],
		...(extraFiles ?? []),
	])

	// Detect and pre-populate files the ZIP "contains" by iterating entries.
	// Simple approach: we built the ZIP from known entries, so we inline them.
	return {
		writeTemp(data: Buffer, suffix: string): string {
			const p = `/fake/tmp/fpk${suffix}`
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

/**
 * Build a fake IO that provides the unpacked manifest.json + package.json (Firefly FPK).
 */
function buildCodeExtFakeIo(
	fpkBytes: Buffer,
	vsixPath: string,
	packageStoreRoot: string,
): OrchestratorIo {
	const sha256 = crypto.createHash("sha256").update(fpkBytes).digest("hex")
	const unpackedDir = `${packageStoreRoot}/${sha256}`

	const extra = new Map<string, Buffer>([
		// package-store requires extension/package.json (VSIX container convention)
		[`${unpackedDir}/extension/package.json`, Buffer.from(BOBSOFT_PACKAGE_JSON)],
		// Firefly code-ext branch triggers on extension/manifest.json
		[`${unpackedDir}/extension/manifest.json`, Buffer.from(BOBSOFT_LINTER_MANIFEST)],
		[`${unpackedDir}/extension/worker.mjs`, Buffer.from("export function activate() {}")],
	])

	return buildFakeIo(fpkBytes, vsixPath, packageStoreRoot, extra)
}

/**
 * Build a fake IO for a theme VSIX.
 */
function buildThemeFakeIo(
	vsixBytes: Buffer,
	vsixPath: string,
	packageStoreRoot: string,
): OrchestratorIo {
	const sha256 = crypto.createHash("sha256").update(vsixBytes).digest("hex")
	const unpackedDir = `${packageStoreRoot}/${sha256}`

	const extra = new Map<string, Buffer>([
		[`${unpackedDir}/extension/package.json`, Buffer.from(THEME_PACKAGE_JSON)],
		[`${unpackedDir}/extension/themes/dark.json`, Buffer.from(THEME_JSON)],
	])

	return buildFakeIo(vsixBytes, vsixPath, packageStoreRoot, extra)
}

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
				publisherKeyId: input.publisherKeyId ?? null,
				signatureAlgorithm: input.signatureAlgorithm ?? null,
				signatureB64: input.signatureB64 ?? null,
				signedManifestJson: input.signedManifestJson ?? null,
				pluginManifestJson: input.pluginManifestJson ?? null,
				requiredCapabilitiesJson: input.requiredCapabilitiesJson ?? null,
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

const PACKAGE_STORE_ROOT = "/fake/package-store"
const FAKE_FPK_PATH = "/fake/bobsoft-linter-0.1.0.fpk"
const FAKE_VSIX_PATH = "/fake/test-theme-1.0.0.vsix"
const FAKE_EMPTY_PATH = "/fake/empty-1.0.0.vsix"

describe("installExtension — F1 code-extension branch", () => {
	it("installs a Firefly code extension (no throw), returns descriptor with correct pluginId + tools", async () => {
		const { fpkBytes, expectedSha256 } = buildCodeExtFpkBytes()
		const io = buildCodeExtFakeIo(fpkBytes, FAKE_FPK_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()

		const result = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_FPK_PATH, expectedSha256 },
			{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
		)

		// Descriptor is non-null for a code extension
		expect(result.descriptor).not.toBeNull()
		const desc = result.descriptor!

		// Plugin identity
		expect(desc.normalizedId).toBe("bobsoft.linter")
		expect(desc.manifest.version).toBe("0.1.0")
		expect(desc.manifest.publisher).toBe("BobSoft")
		expect(desc.trust).toBe("signed-third-party")

		// Contributions
		expect(desc.tools).toHaveLength(1)
		expect(desc.tools[0]!.id).toBe("plugin.bobsoft.linter.read-config")
		expect(desc.commands).toHaveLength(1)
		expect(desc.commands[0]!.id).toBe("greet")

		// Required capabilities
		expect(desc.capabilities).toEqual(["fs:read"])

		// Runtime resolution → electron-utility on electron build
		expect(desc.runtime.hostKind).toBe("node-worker")
		expect(desc.runtimeResolution.supported).toBe(true)
		if (desc.runtimeResolution.supported) {
			expect(desc.runtimeResolution.location).toBe("electron-utility")
		}

		// No themes (code extension)
		expect(result.themes).toHaveLength(0)
	})

	it("persists pluginManifestJson that round-trips to the parsed manifest", async () => {
		const { fpkBytes, expectedSha256 } = buildCodeExtFpkBytes()
		const io = buildCodeExtFakeIo(fpkBytes, FAKE_FPK_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()

		const result = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_FPK_PATH, expectedSha256 },
			{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
		)

		const pkgRecord = result.package
		expect(pkgRecord.pluginManifestJson).not.toBeNull()

		const roundTripped = JSON.parse(pkgRecord.pluginManifestJson!) as Record<string, unknown>
		expect(roundTripped.id).toBe("bobsoft.linter")
		expect(roundTripped.version).toBe("0.1.0")
		// Raw manifest JSON preserves the JSON-Schema args form (not converted Zod shapes)
		expect(
			(roundTripped as { contributes?: { tools?: { id: string }[] } }).contributes?.tools?.[0]?.id,
		).toBe("plugin.bobsoft.linter.read-config")
	})

	it("persists requiredCapabilitiesJson with the declared capabilities", async () => {
		const { fpkBytes, expectedSha256 } = buildCodeExtFpkBytes()
		const io = buildCodeExtFakeIo(fpkBytes, FAKE_FPK_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()

		const result = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_FPK_PATH, expectedSha256 },
			{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
		)

		expect(result.package.requiredCapabilitiesJson).not.toBeNull()
		const caps = JSON.parse(result.package.requiredCapabilitiesJson!) as string[]
		expect(caps).toEqual(["fs:read"])
	})

	it("installation row has lifecycleState:installed and correct trust tier", async () => {
		const { fpkBytes, expectedSha256 } = buildCodeExtFpkBytes()
		const io = buildCodeExtFakeIo(fpkBytes, FAKE_FPK_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()

		const result = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_FPK_PATH, expectedSha256 },
			{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
		)

		expect(result.installation.lifecycleState).toBe("installed")
		// No registry signature supplied → unsigned-third-party (default trust)
		expect(result.installation.trustTier).toBe("unsigned-third-party")
		expect(result.installation.packageId).toBe(result.package.id)
	})

	it("package.id is the sha256 of the FPK bytes (content-addressed)", async () => {
		const { fpkBytes, expectedSha256 } = buildCodeExtFpkBytes()
		const io = buildCodeExtFakeIo(fpkBytes, FAKE_FPK_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()

		const result = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_FPK_PATH, expectedSha256 },
			{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
		)

		expect(result.package.id).toBe(expectedSha256)
		expect(store.packages.size).toBe(1)
		expect(store.installations.size).toBe(1)
	})

	it("code-extension is idempotent: same bytes → reuses package, new installation", async () => {
		const { fpkBytes, expectedSha256 } = buildCodeExtFpkBytes()
		const io = buildCodeExtFakeIo(fpkBytes, FAKE_FPK_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()

		const opts = { packageStoreRoot: PACKAGE_STORE_ROOT, io, store }
		const input = { kind: "local-vsix" as const, vsixPath: FAKE_FPK_PATH, expectedSha256 }

		const r1 = await installExtension(input, opts)
		const r2 = await installExtension(input, opts)

		expect(r1.package.id).toBe(r2.package.id)
		expect(r1.installation.id).not.toBe(r2.installation.id)
		expect(store.packages.size).toBe(1)
		expect(store.installations.size).toBe(2)
	})
})

describe("installExtension — F1 theme package still works (theme path preserved)", () => {
	it("VS Code theme package (no manifest.json) installs via theme path → descriptor null, themes non-empty", async () => {
		const { vsixBytes, expectedSha256 } = buildThemeVsixBytes()
		const io = buildThemeFakeIo(vsixBytes, FAKE_VSIX_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()

		const result = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_VSIX_PATH, expectedSha256 },
			{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
		)

		// Theme path: descriptor is null
		expect(result.descriptor).toBeNull()

		// Theme was converted
		expect(result.themes).toHaveLength(1)
		expect(result.themes[0]!.label).toBe("Test Dark Theme")

		// Package record has themesJson, not pluginManifestJson
		expect(result.package.themesJson).not.toBeNull()
		expect(result.package.pluginManifestJson).toBeNull()
		expect(result.package.requiredCapabilitiesJson).toBeNull()

		// Canonical fields
		expect(result.installation.lifecycleState).toBe("installed")
		expect(store.packages.size).toBe(1)
		expect(store.installations.size).toBe(1)
	})
})

describe("installExtension — F1 neither-branch error", () => {
	it("package with no manifest.json and no contributes.themes → throws loud", async () => {
		const { vsixBytes, expectedSha256 } = buildEmptyVsixBytes()
		const sha256 = crypto.createHash("sha256").update(vsixBytes).digest("hex")
		const unpackedDir = `${PACKAGE_STORE_ROOT}/${sha256}`
		const extra = new Map<string, Buffer>([
			[
				`${unpackedDir}/extension/package.json`,
				Buffer.from(JSON.stringify({ name: "nothing", version: "1.0.0", publisher: "x", contributes: {} })),
			],
		])
		const io = buildFakeIo(vsixBytes, FAKE_EMPTY_PATH, PACKAGE_STORE_ROOT, extra)
		const store = buildFakeStore()

		await expect(
			installExtension(
				{ kind: "local-vsix", vsixPath: FAKE_EMPTY_PATH, expectedSha256 },
				{ packageStoreRoot: PACKAGE_STORE_ROOT, io, store },
			),
		).rejects.toThrow(/no contributes\.themes and no extension\/manifest\.json/)

		// Nothing written
		expect(store.packages.size).toBe(0)
		expect(store.installations.size).toBe(0)
	})
})
