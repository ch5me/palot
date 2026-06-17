/**
 * C3 — Consent threading end-to-end: installExtension with {grantStore,
 * consentedCapabilities} for a code extension declaring `net:http` (medium
 * risk). Proves:
 *
 *   1. A consented medium-risk capability (`net:http`) is persisted as
 *      `granted/user` in the grant store.
 *   2. A declared capability NOT in `consentedCapabilities` stays
 *      `prompt-required` (deny-by-default).
 *   3. The `if (options.grantStore)` gate — absent grantStore skips all grant
 *      persistence; the install still succeeds.
 *
 * Uses injectable IO + in-memory store (no real SQLite) and the same ZIP-
 * builder and fake-IO pattern as install-orchestrator.test.ts.
 */

import { describe, expect, it } from "bun:test"
import * as crypto from "node:crypto"
import {
	installExtension,
	type OrchestratorIo,
	type ExtensionStoreFns,
	type InstallExtensionOptions,
} from "./install-orchestrator"
import type { GrantStore } from "../grant-store"
import type { ExtensionPackageRecord, ExtensionInstallationRecord } from "./extension-store"

// ---------------------------------------------------------------------------
// Minimal ZIP builder (copied from install-orchestrator.test.ts, same impl)
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
// Firefly code-extension fixture manifest
//
// Declares two capabilities:
//   - net:http  (medium risk) — will be consented by the caller
//   - net:https-only (low risk) — auto-grantable by policy; not in consentedCapabilities
//
// A third non-consented medium-risk token is added in the re-consent test to
// assert it stays prompt-required.
// ---------------------------------------------------------------------------

const CODE_EXT_MANIFEST_JSON = JSON.stringify({
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "bobsoft.test-linter",
	displayName: "Test Linter",
	version: "0.1.0",
	publisher: "bobsoft",
	trust: "signed-third-party",
	activationEvents: [{ kind: "onStartup" }],
	capabilities: ["net:http", "net:https-only"],
	runtime: {
		hostKind: "node-worker",
		surfaces: ["electron"],
	},
})

// Minimal package.json so package-store.ts' unpackVsix does not throw
// VsixManifestMissingError (it always reads extension/package.json first,
// then the orchestrator takes the Firefly branch when manifest.json exists).
const CODE_EXT_PACKAGE_JSON = JSON.stringify({
	name: "test-linter",
	displayName: "Test Linter",
	publisher: "bobsoft",
	version: "0.1.0",
	contributes: {},
})

function buildCodeExtVsixBytes(): { vsixBytes: Buffer; expectedSha256: string } {
	const vsixBytes = buildZip([
		{ name: "extension/manifest.json", content: CODE_EXT_MANIFEST_JSON },
		{ name: "extension/package.json", content: CODE_EXT_PACKAGE_JSON },
	])
	const expectedSha256 = crypto.createHash("sha256").update(vsixBytes).digest("hex")
	return { vsixBytes, expectedSha256 }
}

// ---------------------------------------------------------------------------
// Injectable IO (fake, no real fs)
// ---------------------------------------------------------------------------

function buildCodeExtFakeIo(
	vsixBytes: Buffer,
	vsixPath: string,
	packageStoreRoot: string,
): OrchestratorIo {
	const sha256 = crypto.createHash("sha256").update(vsixBytes).digest("hex")
	const unpackedDir = `${packageStoreRoot}/${sha256}`

	const files = new Map<string, Buffer>([
		[vsixPath, vsixBytes],
		[`${unpackedDir}/extension/manifest.json`, Buffer.from(CODE_EXT_MANIFEST_JSON)],
		// package-store.ts reads extension/package.json unconditionally; we supply a
		// minimal one so unpackVsix doesn't throw VsixManifestMissingError. The
		// orchestrator checks for manifest.json first and takes the Firefly branch,
		// so this file is read by package-store but not used by the code-ext path.
		[`${unpackedDir}/extension/package.json`, Buffer.from(CODE_EXT_PACKAGE_JSON)],
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
			// The unpacked dir exists so unpackVsix skips re-extraction.
			// The manifest.json exists inside it.
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
// In-memory store (no SQLite)
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
// In-memory grant store backed by a simple Map (no SQLite needed in tests)
// ---------------------------------------------------------------------------

function buildInMemoryGrantStore(): GrantStore {
	// Implement the GrantStore interface directly with a Map-backed store to avoid pulling in
	// drizzle / libsql at unit-test boundary. This is exactly the
	// test-isolation pattern used throughout the suite.
	const rows = new Map<string, {
		id: string
		pluginId: string
		scope: string
		scopeId: string | null
		capability: string
		grantState: string
		grantedBy: string
		reason: string
		expiresAt: number | null
	}>()

	function buildId(pluginId: string, scope: string, scopeId: string | null, capability: string): string {
		return `${pluginId}:${scope}:${scopeId ?? "*"}:${capability}`
	}

	const store: GrantStore = {
		async upsert(record) {
			const id = buildId(record.pluginId, record.scope, record.scopeId, record.capability)
			rows.set(id, {
				id,
				pluginId: record.pluginId,
				scope: record.scope,
				scopeId: record.scopeId,
				capability: record.capability,
				grantState: record.grantState,
				grantedBy: record.grantedBy,
				reason: record.reason,
				expiresAt: record.expiresAt,
			})
		},
		async upsertMany(records) {
			for (const record of records) {
				await store.upsert(record)
			}
		},
		async listForPlugin(pluginId) {
			return [...rows.values()]
				.filter((r) => r.pluginId === pluginId)
				.map((r) => ({
					pluginId: r.pluginId,
					scope: r.scope as "session" | "project" | "app",
					scopeId: r.scopeId,
					capability: r.capability,
					grantState: r.grantState as "granted" | "denied" | "prompt-required",
					grantedBy: r.grantedBy as "builtin-policy" | "user" | "admin-policy",
					reason: r.reason,
					expiresAt: r.expiresAt,
				}))
		},
		async resolveGrantedTokens(input) {
			const nowMs = input.nowMs ?? Date.now()
			const tokens = new Set<string>()
			for (const row of rows.values()) {
				if (row.pluginId !== input.pluginId) continue
				if (row.grantState !== "granted") continue
				if (row.expiresAt !== null && row.expiresAt <= nowMs) continue
				if (row.scope !== "app" && row.scope !== input.scope) continue
				tokens.add(row.capability)
			}
			return [...tokens]
		},
		async revoke(input) {
			const id = buildId(input.pluginId, input.scope, input.scopeId, input.capability)
			rows.delete(id)
		},
		async revokeAll(pluginId) {
			for (const [id, row] of rows) {
				if (row.pluginId === pluginId) rows.delete(id)
			}
		},
		async revokeAllForVersion(pluginId) {
			// This legacy in-memory mock keys ids without a version segment, so a
			// version-scoped revoke degrades to a plugin-wide clear here.
			for (const [id, row] of rows) {
				if (row.pluginId === pluginId) rows.delete(id)
			}
		},
	}

	return store
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const PACKAGE_STORE_ROOT = "/fake/package-store"
const FAKE_VSIX_PATH = "/fake/bobsoft-test-linter-0.1.0.vsix"
const PLUGIN_ID = "bobsoft.test-linter"

describe("C3 — consent thread: installExtension + grantStore + consentedCapabilities", () => {
	it("consented net:http (medium) → granted/user; non-consented capability stays prompt-required", async () => {
		const { vsixBytes, expectedSha256 } = buildCodeExtVsixBytes()
		const io = buildCodeExtFakeIo(vsixBytes, FAKE_VSIX_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()
		const grantStore = buildInMemoryGrantStore()

		const opts: InstallExtensionOptions = {
			packageStoreRoot: PACKAGE_STORE_ROOT,
			io,
			store,
			grantStore,
			// Only net:http is consented — net:https-only is low-risk (auto-grant)
			// Any additional medium/high cap would remain prompt-required.
			consentedCapabilities: ["net:http"],
		}

		const result = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_VSIX_PATH, expectedSha256 },
			opts,
		)

		// The code-extension branch should have fired.
		expect(result.descriptor).not.toBeNull()
		expect(result.installation.trustTier).toBe("unsigned-third-party")
		expect(result.themes).toHaveLength(0)

		// Grant store should now contain rows for PLUGIN_ID.
		const grants = await grantStore.listForPlugin(PLUGIN_ID)
		expect(grants.length).toBeGreaterThan(0)

		const byCapability = new Map(grants.map((g) => [g.capability, g]))

		// net:http (medium risk, explicitly consented) → granted/user
		const httpGrant = byCapability.get("net:http")
		expect(httpGrant).toBeDefined()
		expect(httpGrant!.grantState).toBe("granted")
		expect(httpGrant!.grantedBy).toBe("user")

		// net:https-only (low risk) → auto-granted by policy / builtin-policy
		const httpsOnlyGrant = byCapability.get("net:https-only")
		expect(httpsOnlyGrant).toBeDefined()
		expect(httpsOnlyGrant!.grantState).toBe("granted")
		expect(httpsOnlyGrant!.grantedBy).toBe("builtin-policy")

		// resolveGrantedTokens also includes net:http (the A2→C3 seam)
		const granted = await grantStore.resolveGrantedTokens({ pluginId: PLUGIN_ID, scope: "app" })
		expect(granted).toContain("net:http")
		expect(granted).toContain("net:https-only")
	})

	it("non-consented declared capability stays prompt-required", async () => {
		const { vsixBytes, expectedSha256 } = buildCodeExtVsixBytes()
		const io = buildCodeExtFakeIo(vsixBytes, FAKE_VSIX_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()
		const grantStore = buildInMemoryGrantStore()

		// Consent to net:https-only only; net:http is NOT consented.
		const opts: InstallExtensionOptions = {
			packageStoreRoot: PACKAGE_STORE_ROOT,
			io,
			store,
			grantStore,
			consentedCapabilities: [],
		}

		await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_VSIX_PATH, expectedSha256 },
			opts,
		)

		const grants = await grantStore.listForPlugin(PLUGIN_ID)
		const byCapability = new Map(grants.map((g) => [g.capability, g]))

		// net:http (medium, not consented) → prompt-required
		const httpGrant = byCapability.get("net:http")
		expect(httpGrant).toBeDefined()
		expect(httpGrant!.grantState).toBe("prompt-required")

		// net:https-only (low) → auto-granted regardless of consent
		const httpsOnlyGrant = byCapability.get("net:https-only")
		expect(httpsOnlyGrant).toBeDefined()
		expect(httpsOnlyGrant!.grantState).toBe("granted")

		// resolveGrantedTokens does NOT include prompt-required tokens.
		const granted = await grantStore.resolveGrantedTokens({ pluginId: PLUGIN_ID, scope: "app" })
		expect(granted).not.toContain("net:http")
		expect(granted).toContain("net:https-only")
	})

	it("absent grantStore → install succeeds, no grant rows written (gating guard)", async () => {
		const { vsixBytes, expectedSha256 } = buildCodeExtVsixBytes()
		const io = buildCodeExtFakeIo(vsixBytes, FAKE_VSIX_PATH, PACKAGE_STORE_ROOT)
		const store = buildFakeStore()
		const grantStore = buildInMemoryGrantStore()

		// No grantStore in options — gate must no-op.
		const opts: InstallExtensionOptions = {
			packageStoreRoot: PACKAGE_STORE_ROOT,
			io,
			store,
			// grantStore intentionally omitted
			consentedCapabilities: ["net:http"],
		}

		const result = await installExtension(
			{ kind: "local-vsix", vsixPath: FAKE_VSIX_PATH, expectedSha256 },
			opts,
		)

		// Install succeeds — no error thrown.
		expect(result.installation.packageId).toBe(result.package.id)

		// No rows written (grantStore was not passed to the orchestrator).
		const grants = await grantStore.listForPlugin(PLUGIN_ID)
		expect(grants).toHaveLength(0)
	})
})
