/**
 * Wave 4a — install-orchestrator `kind:"firefly"` install branch tests.
 *
 * Proves:
 *   1. A valid `kind:"firefly"` install (fake gallery fetch serving bytes +
 *      ServedSignatureMetadata, ephemeral trust anchor) →
 *        - trustTier = signed-third-party
 *        - signatureState = verified
 *        - registrySource = "firefly"
 *        - provenance fields persisted on the package row
 *
 *   2. Absent served signature on a `kind:"firefly"` source (gallery returns
 *      null signature) → `UnsignedInstallBlockedError` thrown, nothing persisted.
 *
 *   3. Tampered bytes (contentSha256 mismatch in the signed manifest) →
 *      `SignatureVerificationError("integrity_mismatch")` thrown, nothing
 *      persisted (verify-before-extract holds).
 *
 * Mirror of the E2.5 pattern: ephemeral trust-anchor registry built from the
 * committed `ephemeral.pub.pem`, fake IO, fake store — no real fs, no real DB.
 */

import * as crypto from "node:crypto"
import * as fs from "node:fs"
import * as path from "node:path"
import { describe, expect, it } from "bun:test"
import {
	installExtension,
	UnsignedInstallBlockedError,
	type OrchestratorIo,
	type ExtensionStoreFns,
} from "./install-orchestrator"
import type { ExtensionPackageRecord, ExtensionInstallationRecord } from "./extension-store"
import { SignatureVerificationError } from "./signature-verify"
import { createTrustAnchorRegistry } from "../../../shared/firefly-plugin/trust-anchor-registry"
import type { ServedSignatureMetadata } from "../../../shared/firefly-plugin/registry-signature-contract"
import type { FetchFn } from "../registry/open-vsx-client"

// ---------------------------------------------------------------------------
// Fixture paths (same signed artifacts as E2.5)
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.resolve(import.meta.dir, "__fixtures__/signed")
const CLEAN_FPK = path.join(FIXTURES_DIR, "bobsoft-linter-0.1.0.fpk")
const CLEAN_SIG = path.join(FIXTURES_DIR, "bobsoft-linter-0.1.0.fpk.sig.json")
const TAMPERED_FPK = path.join(FIXTURES_DIR, "bobsoft-linter-0.1.0-tampered.fpk")
const EPHEMERAL_PUB_PEM = path.join(FIXTURES_DIR, "ephemeral.pub.pem")

const FIREFLY_BASE_URL = "https://gallery.ch5-test.internal"
const PACKAGE_STORE_ROOT = "/fake/package-store"

// ---------------------------------------------------------------------------
// Ephemeral trust-anchor registry (same pattern as E2.5 and signed-electron e2e)
// ---------------------------------------------------------------------------

function buildEphemeralTrustAnchorRegistry() {
	const pubPem = fs.readFileSync(EPHEMERAL_PUB_PEM, "utf8")
	const der = crypto.createPublicKey(pubPem).export({ type: "spki", format: "der" }) as Buffer
	const fingerprintSha256 = crypto.createHash("sha256").update(der).digest("hex")

	return createTrustAnchorRegistry({
		anchors: {
			"ephemeral-test-key": {
				publicKeyPem: pubPem,
				fingerprintSha256,
				devOnly: false,
			},
		},
		packaged: false,
	})
}

// ---------------------------------------------------------------------------
// Fake store
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
			const id = `${input.packageId}-${now}`
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
// Fake IO for the firefly install path
//
// The `fetch` function on the IO must:
//   - Return the gallery metadata JSON for the metadata endpoint.
//   - Return the raw package bytes for the downloadUrl.
//
// Everything else is the same fake-fs pattern from the E2.5 tests.
// ---------------------------------------------------------------------------

/** Gallery response shape served by D-C2 */
function buildGalleryResponse(
	fpkBytes: Buffer,
	sigJson: ServedSignatureMetadata | null,
): Record<string, unknown> {
	const sha256 = crypto.createHash("sha256").update(fpkBytes).digest("hex")
	return {
		namespace: "bobsoft",
		name: "linter",
		version: "0.1.0",
		displayName: "BobSoft Linter",
		description: "A test linter plugin",
		timestamp: "2026-06-16T00:00:00.000Z",
		engines: {},
		categories: [],
		tags: [],
		license: "MIT",
		homepage: null,
		repository: null,
		bugs: null,
		downloadUrl: `${FIREFLY_BASE_URL}/download/bobsoft/linter/0.1.0.fpk`,
		sha256,
		iconUrl: null,
		signature: sigJson,
	}
}

const BOBSOFT_MANIFEST = JSON.stringify({
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "bobsoft.linter",
	displayName: "BobSoft Linter",
	version: "1.0.0",
	publisher: "BobSoft Inc.",
	description: "Third-party signed linter extension",
	license: "MIT",
	trust: "signed-third-party",
	manifestRevision: 1,
	engines: {},
	lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
	runtime: {
		hostKind: "node-worker",
		surfaces: ["electron", "web"],
		webStrategy: "cloud-host",
	},
	activationEvents: [{ kind: "onStartup" }],
	contributes: {
		panels: [],
		navSidebars: [],
		widgets: [],
		commands: [],
		themes: [],
		tools: [],
		components: [],
		snippets: [],
		languages: [],
		grammars: [],
		iconThemes: [],
	},
	capabilities: ["net:http"],
	tags: ["linter"],
})

const BOBSOFT_PACKAGE_JSON = JSON.stringify({
	name: "bobsoft-linter",
	displayName: "BobSoft Linter",
	publisher: "BobSoft Inc.",
	version: "1.0.0",
	contributes: {},
})

function buildFakeIoForFireflyInstall(
	fpkBytes: Buffer,
	galleryResponse: Record<string, unknown>,
): OrchestratorIo {
	const sha256 = crypto.createHash("sha256").update(fpkBytes).digest("hex")
	const unpackedDir = `${PACKAGE_STORE_ROOT}/${sha256}`
	const downloadUrl = `${FIREFLY_BASE_URL}/download/bobsoft/linter/0.1.0.fpk`
	const metaUrlLatest = `${FIREFLY_BASE_URL}/firefly-plugin/gallery/bobsoft/linter/latest`
	const metaUrlVersion = `${FIREFLY_BASE_URL}/firefly-plugin/gallery/bobsoft/linter/0.1.0`

	const tempFpkPath = "/fake/tmp/fpk.fpk"
	const files = new Map<string, Buffer>([
		[`${unpackedDir}/extension/package.json`, Buffer.from(BOBSOFT_PACKAGE_JSON)],
		[`${unpackedDir}/extension/manifest.json`, Buffer.from(BOBSOFT_MANIFEST)],
	])

	const fetch: FetchFn = async (url: string) => {
		// Gallery metadata endpoints
		if (url === metaUrlLatest || url === metaUrlVersion) {
			return {
				ok: true,
				status: 200,
				json: async () => galleryResponse,
				text: async () => JSON.stringify(galleryResponse),
			}
		}
		// Package bytes download
		if (url === downloadUrl) {
			return {
				ok: true,
				status: 200,
				// The real Response.arrayBuffer() is mocked via the `as unknown as Response` cast
				arrayBuffer: async () => fpkBytes.buffer,
				json: async () => { throw new Error("not JSON") },
				text: async () => "",
			} as unknown as Awaited<ReturnType<FetchFn>>
		}
		throw new Error(`FakeIO: unexpected fetch: ${url}`)
	}

	return {
		writeTemp(data: Buffer, suffix: string): string {
			files.set(tempFpkPath + suffix, data)
			return tempFpkPath + suffix
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
		fetch,
	}
}

// ---------------------------------------------------------------------------
// Suite 1 — Happy path: valid firefly install → signed-third-party
// ---------------------------------------------------------------------------

describe("Wave 4a — kind:firefly install → signed-third-party", () => {
	it("clean FPK + gallery serves valid ServedSignatureMetadata → trust=signed-third-party, registrySource=firefly", async () => {
		const fpkBytes = fs.readFileSync(CLEAN_FPK)
		const sigJson = JSON.parse(fs.readFileSync(CLEAN_SIG, "utf8")) as ServedSignatureMetadata

		const galleryResp = buildGalleryResponse(fpkBytes, sigJson)
		const trustAnchorRegistry = buildEphemeralTrustAnchorRegistry()
		const io = buildFakeIoForFireflyInstall(fpkBytes, galleryResp)
		const store = buildFakeStore()

		const result = await installExtension(
			{ kind: "firefly", namespace: "bobsoft", name: "linter" },
			{
				packageStoreRoot: PACKAGE_STORE_ROOT,
				io,
				store,
				trustAnchorRegistry,
				fireflyBaseUrl: FIREFLY_BASE_URL,
			},
		)

		// Trust derived via real crypto
		expect(result.package.signatureState).toBe("verified")
		expect(result.installation.trustTier).toBe("signed-third-party")
		expect(result.package.registrySource).toBe("firefly")
		expect(result.package.publisherKeyId).toBe("ephemeral-test-key")
		expect(result.package.signatureB64).toBe(sigJson.signatureB64)
		expect(result.package.signedManifestJson).not.toBeNull()
		// descriptor from the manifest.json
		expect(result.descriptor).not.toBeNull()
		expect(result.descriptor!.normalizedId).toBe("bobsoft.linter")
	})

	it("pinned version install → uses getVersion endpoint", async () => {
		const fpkBytes = fs.readFileSync(CLEAN_FPK)
		const sigJson = JSON.parse(fs.readFileSync(CLEAN_SIG, "utf8")) as ServedSignatureMetadata

		const galleryResp = buildGalleryResponse(fpkBytes, sigJson)
		const trustAnchorRegistry = buildEphemeralTrustAnchorRegistry()
		const io = buildFakeIoForFireflyInstall(fpkBytes, galleryResp)
		const store = buildFakeStore()

		const result = await installExtension(
			{ kind: "firefly", namespace: "bobsoft", name: "linter", version: "0.1.0" },
			{
				packageStoreRoot: PACKAGE_STORE_ROOT,
				io,
				store,
				trustAnchorRegistry,
				fireflyBaseUrl: FIREFLY_BASE_URL,
			},
		)

		expect(result.package.registrySource).toBe("firefly")
		expect(result.package.signatureState).toBe("verified")
	})

	it("options.registrySignature overrides the gallery signature (test-injection seam)", async () => {
		const fpkBytes = fs.readFileSync(CLEAN_FPK)
		const sigJson = JSON.parse(fs.readFileSync(CLEAN_SIG, "utf8")) as ServedSignatureMetadata

		// Gallery serves no signature, but options.registrySignature provides it
		const galleryRespNoSig = buildGalleryResponse(fpkBytes, null)
		const trustAnchorRegistry = buildEphemeralTrustAnchorRegistry()
		const io = buildFakeIoForFireflyInstall(fpkBytes, galleryRespNoSig)
		const store = buildFakeStore()

		const result = await installExtension(
			{ kind: "firefly", namespace: "bobsoft", name: "linter" },
			{
				packageStoreRoot: PACKAGE_STORE_ROOT,
				io,
				store,
				trustAnchorRegistry,
				fireflyBaseUrl: FIREFLY_BASE_URL,
				registrySignature: sigJson, // override
			},
		)

		expect(result.package.signatureState).toBe("verified")
		expect(result.package.registrySource).toBe("firefly")
	})
})

// ---------------------------------------------------------------------------
// Suite 2 — Absent signature on firefly source → UnsignedInstallBlockedError
// ---------------------------------------------------------------------------

describe("Wave 4a — kind:firefly absent signature → UnsignedInstallBlockedError", () => {
	it("gallery serves null signature → throws UnsignedInstallBlockedError, nothing persisted", async () => {
		const fpkBytes = fs.readFileSync(CLEAN_FPK)

		// Gallery explicitly returns null for signature
		const galleryRespNoSig = buildGalleryResponse(fpkBytes, null)
		const trustAnchorRegistry = buildEphemeralTrustAnchorRegistry()
		const io = buildFakeIoForFireflyInstall(fpkBytes, galleryRespNoSig)
		const store = buildFakeStore()

		await expect(
			installExtension(
				{ kind: "firefly", namespace: "bobsoft", name: "linter" },
				{
					packageStoreRoot: PACKAGE_STORE_ROOT,
					io,
					store,
					trustAnchorRegistry,
					fireflyBaseUrl: FIREFLY_BASE_URL,
					// No registrySignature override → absent sig is blocked
				},
			),
		).rejects.toThrow(UnsignedInstallBlockedError)

		// Verify-before-extract: nothing was persisted
		expect(store.packages.size).toBe(0)
		expect(store.installations.size).toBe(0)
	})

	it("UnsignedInstallBlockedError.sourceKind is 'firefly'", async () => {
		const fpkBytes = fs.readFileSync(CLEAN_FPK)
		const galleryRespNoSig = buildGalleryResponse(fpkBytes, null)
		const trustAnchorRegistry = buildEphemeralTrustAnchorRegistry()
		const io = buildFakeIoForFireflyInstall(fpkBytes, galleryRespNoSig)
		const store = buildFakeStore()

		const err = await installExtension(
			{ kind: "firefly", namespace: "bobsoft", name: "linter" },
			{
				packageStoreRoot: PACKAGE_STORE_ROOT,
				io,
				store,
				trustAnchorRegistry,
				fireflyBaseUrl: FIREFLY_BASE_URL,
			},
		).catch((e: unknown) => e)

		expect(err).toBeInstanceOf(UnsignedInstallBlockedError)
		expect((err as UnsignedInstallBlockedError).sourceKind).toBe("firefly")
	})

	it("allowUnsignedWithConsent=true bypasses the absent-signature block", async () => {
		const fpkBytes = fs.readFileSync(CLEAN_FPK)
		const galleryRespNoSig = buildGalleryResponse(fpkBytes, null)
		const trustAnchorRegistry = buildEphemeralTrustAnchorRegistry()
		const io = buildFakeIoForFireflyInstall(fpkBytes, galleryRespNoSig)
		const store = buildFakeStore()

		// Should NOT throw; installs as unsigned-third-party
		const result = await installExtension(
			{ kind: "firefly", namespace: "bobsoft", name: "linter" },
			{
				packageStoreRoot: PACKAGE_STORE_ROOT,
				io,
				store,
				trustAnchorRegistry,
				fireflyBaseUrl: FIREFLY_BASE_URL,
				allowUnsignedWithConsent: true,
			},
		)

		expect(result.package.registrySource).toBe("firefly")
		expect(result.package.signatureState).toBe("unsigned")
		expect(result.installation.trustTier).toBe("unsigned-third-party")
	})
})

// ---------------------------------------------------------------------------
// Suite 3 — Tampered bytes → integrity_mismatch
// ---------------------------------------------------------------------------

describe("Wave 4a — kind:firefly tampered bytes → integrity_mismatch", () => {
	it("gallery serves valid sig but bytes are tampered → throws SignatureVerificationError, nothing persisted", async () => {
		const tamperedBytes = fs.readFileSync(TAMPERED_FPK)
		// The CLEAN sig.json has contentSha256 of the CLEAN bytes; tampered bytes will mismatch
		const sigJson = JSON.parse(fs.readFileSync(CLEAN_SIG, "utf8")) as ServedSignatureMetadata

		// Build gallery response with tampered bytes' sha256 BUT the clean sig
		// (contentSha256 in sig will mismatch sha256 of tampered bytes)
		const galleryResp = buildGalleryResponse(tamperedBytes, sigJson)
		// Override downloadUrl to serve tampered bytes
		const trustAnchorRegistry = buildEphemeralTrustAnchorRegistry()
		const io = buildFakeIoForFireflyInstall(tamperedBytes, galleryResp)
		const store = buildFakeStore()

		await expect(
			installExtension(
				{ kind: "firefly", namespace: "bobsoft", name: "linter" },
				{
					packageStoreRoot: PACKAGE_STORE_ROOT,
					io,
					store,
					trustAnchorRegistry,
					fireflyBaseUrl: FIREFLY_BASE_URL,
					// Use the clean sig directly to ensure the manifest has clean sha256
					registrySignature: sigJson,
				},
			),
		).rejects.toThrow(SignatureVerificationError)

		// Verify-before-extract: nothing persisted
		expect(store.packages.size).toBe(0)
		expect(store.installations.size).toBe(0)
	})
})

// ---------------------------------------------------------------------------
// Suite 4 — registrySource="firefly" is persisted on the package row
// ---------------------------------------------------------------------------

describe("Wave 4a — registrySource='firefly' persisted", () => {
	it("the upserted package row has registrySource='firefly'", async () => {
		const fpkBytes = fs.readFileSync(CLEAN_FPK)
		const sigJson = JSON.parse(fs.readFileSync(CLEAN_SIG, "utf8")) as ServedSignatureMetadata
		const galleryResp = buildGalleryResponse(fpkBytes, sigJson)
		const trustAnchorRegistry = buildEphemeralTrustAnchorRegistry()
		const io = buildFakeIoForFireflyInstall(fpkBytes, galleryResp)
		const store = buildFakeStore()

		await installExtension(
			{ kind: "firefly", namespace: "bobsoft", name: "linter" },
			{
				packageStoreRoot: PACKAGE_STORE_ROOT,
				io,
				store,
				trustAnchorRegistry,
				fireflyBaseUrl: FIREFLY_BASE_URL,
			},
		)

		// The package row was upserted with registrySource="firefly"
		const [pkg] = [...store.packages.values()]
		expect(pkg).toBeDefined()
		expect(pkg!.registrySource).toBe("firefly")
		// vsixPath is null for remote gallery installs (only set for local-vsix)
		expect(pkg!.vsixPath).toBeNull()
	})
})
