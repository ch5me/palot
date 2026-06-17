/**
 * Firefly Plugin Marketplace — VS Code theme install orchestrator (§8)
 *
 * Given an Open VSX (namespace, name, version?) or a local .vsix path:
 *   1. Download VSIX (open-vsx-client) or read local file
 *   2. Verify checksum + unpack (package-store)
 *   3. Detect contributes.themes in package.json
 *   4. Convert each theme (vscode-theme-import)
 *   5. Write ExtensionPackage + ExtensionInstallation rows (extension-store)
 *   6. Return converted themes so the caller can apply / project them
 *
 * Architecture:
 *   - Fail-loud on integrity mismatch (§10, CH5 fail-fast rule).
 *   - This is Phase 1: themes only. Other contribution types are detected
 *     but not converted — the installer logs a warning and continues.
 *   - IO is injectable (fs + fetch) for test isolation.
 *   - The orchestrator does NOT activate the theme — install ≠ activate (§8).
 */

import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { createLogger } from "../../logger"
import {
	unpackVsix,
	sha256Hex,
	type UnpackedVsixResult,
	type PackageStoreIo,
} from "./package-store"
import {
	convertVscodeThemePackage,
	type ImportedThemeContribution,
	type VscodeThemeDeclaration,
} from "../../../shared/firefly-plugin/vscode-theme-import"
import {
	upsertExtensionPackage,
	createExtensionInstallation,
	type ExtensionPackageRecord,
	type ExtensionInstallationRecord,
} from "./extension-store"
import {
	createOpenVsxClient,
	type RegistryVersionMetadata,
	type FetchFn,
} from "../registry/open-vsx-client"
import { parseJsonPluginManifest } from "../../../shared/firefly-plugin/json-manifest"
import { derivePluginDescriptor, type PluginDescriptor } from "../../../shared/firefly-plugin/descriptor"
import {
	resolveDetachedSignature,
	type ResolvedSignatureProvenance,
	type SignatureSourceKind,
} from "./detached-signature"
import { computeInstallConsentPlan, consentPlanToGrantRecords } from "../install-consent"
import type { GrantStore, GrantScope } from "../grant-store"
import type { TrustTier } from "../../../shared/firefly-plugin/manifest"
import {
	createDefaultTrustAnchorRegistry,
	type TrustAnchorRegistry,
} from "../../../shared/firefly-plugin/trust-anchor-registry"
import type { ServedSignatureMetadata } from "../../../shared/firefly-plugin/registry-signature-contract"

const log = createLogger("firefly-plugin/install-orchestrator")

/**
 * Thrown when a signing-authority install resolves NO signature and the source
 * is not explicitly `allow-unsigned-with-consent` (A2c). Fail-fast (CH5 #9): an
 * absent signature on a marketplace source is BLOCKED, never silently installed
 * as unsigned-third-party.
 */
export class UnsignedInstallBlockedError extends Error {
	constructor(
		public readonly sourceKind: SignatureSourceKind,
		message: string,
	) {
		super(message)
		this.name = "UnsignedInstallBlockedError"
	}
}

/**
 * Whether a source kind is a CH5 signing-authority registry whose installs MUST
 * carry a verifiable signature (unless explicitly allow-unsigned-with-consent).
 * `open-vsx` serves no CH5 signature and is permanently unsigned-third-party, so
 * it is NOT a signing-authority source and is not blocked here.
 */
function isSigningAuthoritySource(kind: SignatureSourceKind): boolean {
	return kind === "firefly"
}

/**
 * Map the orchestrator's internal `registrySource` to the signature source kind
 * used by `resolveDetachedSignature`. Open VSX downloads carry no CH5 signature;
 * a manual local VSIX install resolves its sidecar via the `local-vsix` path.
 */
function signatureSourceKind(
	registrySource: "open-vsx" | "manual-vsix",
): SignatureSourceKind {
	return registrySource === "open-vsx" ? "open-vsx" : "local-vsix"
}

/**
 * Persist install-time capability grants (P3d/§10): auto-grant low-risk by trust
 * tier, leave medium/high/critical as `prompt-required` until the user consents.
 * No-op when the extension declares no capabilities (e.g. data-only themes).
 * Idempotent on the grant id. Returns the records written.
 */
export async function persistInstallGrants(deps: {
	grantStore: GrantStore
	pluginId: string
	capabilities: readonly string[]
	trust: TrustTier
	scope?: GrantScope
	scopeId?: string | null
	consentedCapabilities?: readonly string[]
}): Promise<ReturnType<typeof consentPlanToGrantRecords>> {
	if (deps.capabilities.length === 0) return []
	const plan = computeInstallConsentPlan({ capabilities: deps.capabilities, trust: deps.trust })
	const records = consentPlanToGrantRecords({
		plan,
		pluginId: deps.pluginId,
		scope: deps.scope ?? "app",
		scopeId: deps.scopeId ?? null,
		consentedCapabilities: deps.consentedCapabilities,
	})
	await deps.grantStore.upsertMany(records)
	return records
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Input: install from Open VSX by namespace + name (+ optional version).
 */
export interface InstallFromOpenVsxInput {
	kind: "open-vsx"
	namespace: string
	name: string
	/** If omitted, the latest version is fetched. */
	version?: string
}

/**
 * Input: install from a local .vsix file path.
 */
export interface InstallFromLocalVsixInput {
	kind: "local-vsix"
	vsixPath: string
	/** Optional expected SHA-256 to verify before unpack. */
	expectedSha256?: string
}

export type InstallInput = InstallFromOpenVsxInput | InstallFromLocalVsixInput

/**
 * Result of a successful install.
 */
export interface InstallResult {
	/** The immutable package record (content-addressed, idempotent). */
	package: ExtensionPackageRecord
	/** The mutable installation record. */
	installation: ExtensionInstallationRecord
	/** Converted theme contributions from this package (non-empty for VS Code theme packages). */
	themes: ImportedThemeContribution[]
	/** Whether the package was already installed (idempotent re-install). */
	alreadyInstalled: boolean
	/**
	 * F1 — Firefly code-extension: the derived `PluginDescriptor` for a code
	 * extension (manifest carries `runtime` / `contributes.tools|commands`).
	 * `null` for VS Code theme packages (no Firefly manifest).
	 */
	descriptor: PluginDescriptor | null
}

// ---------------------------------------------------------------------------
// Injectable IO (for tests)
// ---------------------------------------------------------------------------

export interface OrchestratorIo {
	/** Write raw bytes to a temp file path. Returns the path. */
	writeTemp(data: Buffer, suffix: string): string
	/** Read raw bytes from a file. */
	readFileSync(filePath: string): Buffer
	/** Check if a path exists. */
	existsSync(pathToCheck: string): boolean
	/** Create directories recursively. */
	mkdirSync(dirPath: string): void
	/** Unzip a file into a directory. */
	unzip(zipPath: string, destDir: string): Promise<void>
	/** Delete a file. */
	unlinkSync(filePath: string): void
	/** HTTP fetch. */
	fetch: FetchFn
}

export function createNodeOrchestratorIo(): OrchestratorIo {
	return {
		writeTemp(data: Buffer, suffix: string): string {
			const tmp = path.join(os.tmpdir(), `firefly-vsix-${Date.now()}${suffix}`)
			fs.writeFileSync(tmp, data)
			return tmp
		},
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
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const extractZip = require("extract-zip") as (
				zipPath: string,
				opts: { dir: string },
			) => Promise<void>
			await extractZip(zipPath, { dir: destDir })
		},
		unlinkSync(filePath: string): void {
			try {
				fs.unlinkSync(filePath)
			} catch {
				// Best-effort cleanup
			}
		},
		fetch: (url: string, init?: { signal?: AbortSignal }) => fetch(url, init),
	}
}

// ---------------------------------------------------------------------------
// Install orchestrator
// ---------------------------------------------------------------------------

/**
 * Injectable store functions for test isolation.
 * Production code uses the real extension-store; tests pass fakes.
 */
export interface ExtensionStoreFns {
	upsertExtensionPackage: typeof upsertExtensionPackage
	createExtensionInstallation: typeof createExtensionInstallation
}

function defaultStoreFns(): ExtensionStoreFns {
	return { upsertExtensionPackage, createExtensionInstallation }
}

/**
 * Options for `installExtension`.
 */
export interface InstallExtensionOptions {
	/** Root for content-addressed package store. Defaults to userData/firefly-plugin-packages. */
	packageStoreRoot?: string
	/** Injectable IO; defaults to real Node fs + fetch. */
	io?: OrchestratorIo
	/** Open VSX base URL override (for tests). */
	openVsxBaseUrl?: string
	/** Injectable store functions (for tests). Defaults to real extension-store. */
	store?: ExtensionStoreFns
	/**
	 * Grant store for persisting install-time capability grants (P3d). When
	 * omitted, grant persistence is skipped (data-only theme installs need none).
	 */
	grantStore?: GrantStore
	/**
	 * Trust-anchor registry resolving `publisherKeyId → public PEM` for registry
	 * signature verification (A2). Defaults to the build-baked default registry
	 * (`createDefaultTrustAnchorRegistry()`). Override only for test injection.
	 */
	trustAnchorRegistry?: TrustAnchorRegistry
	/**
	 * Served registry signature metadata (canonical manifest + signatureB64),
	 * supplied by the gallery byte+signature endpoint for a signed install. When
	 * omitted, the signature is resolved per source kind (local sidecar / none).
	 */
	registrySignature?: ServedSignatureMetadata | null
	/**
	 * Per-source escape hatch: permit an install whose signature is ABSENT to
	 * proceed as unsigned-third-party WITH consent (A2c). Default false →
	 * absent-signature on a signing-authority source is blocked. `local-vsix`
	 * fixtures in local-dev may opt in.
	 */
	allowUnsignedWithConsent?: boolean
	/**
	 * C3 — Capability tokens explicitly consented by the user in the pre-install
	 * consent dialog. Passed through to `persistInstallGrants` so those tokens are
	 * written as `granted/user` rather than `prompt-required`. Tokens not in this
	 * list remain `prompt-required` until the user re-consents.
	 */
	consentedCapabilities?: readonly string[]
}

/**
 * Install a VS Code theme package from Open VSX or a local VSIX.
 *
 * This is the Phase 1 entry point: themes only. Other contribution types
 * are detected but not converted (logged and skipped).
 *
 * @throws `VsixIntegrityError`       — sha256 mismatch.
 * @throws `VsixManifestMissingError` — no extension/package.json.
 * @throws `Error`                    — no themes found in package.
 * @throws `OpenVsxApiError`          — registry API error.
 */
export async function installExtension(
	input: InstallInput,
	options: InstallExtensionOptions = {},
): Promise<InstallResult> {
	const io = options.io ?? createNodeOrchestratorIo()
	const store = options.store ?? defaultStoreFns()

	let vsixPath: string
	let tempVsixPath: string | null = null
	let registrySource: "open-vsx" | "manual-vsix"
	let registryMeta: RegistryVersionMetadata | null = null
	/**
	 * Raw downloaded package bytes, captured pre-extract so the registry
	 * signature can be verified over them BEFORE the content-addressed dir is
	 * ever created (A2a verify-before-extract).
	 */
	let rawBytes: Buffer

	if (input.kind === "open-vsx") {
		// 1a. Resolve version metadata from Open VSX
		log.info("Resolving Open VSX version", { namespace: input.namespace, name: input.name, version: input.version })
		const client = createOpenVsxClient({
			baseUrl: options.openVsxBaseUrl,
			fetch: io.fetch,
		})
		registryMeta = input.version
			? await client.getVersion(input.namespace, input.name, input.version)
			: await client.getLatest(input.namespace, input.name)

		if (!registryMeta.downloadUrl) {
			throw new Error(
				`Open VSX: no download URL for ${input.namespace}.${input.name}@${registryMeta.version}`,
			)
		}

		// 1b. Download the VSIX
		log.info("Downloading VSIX", { url: registryMeta.downloadUrl })
		const response = await io.fetch(registryMeta.downloadUrl)
		if (!response.ok) {
			throw new Error(
				`VSIX download failed: HTTP ${response.status} from ${registryMeta.downloadUrl}`,
			)
		}

		// response.json returns unknown — we need raw bytes here
		// Use the Response body as ArrayBuffer
		const rawResp = response as unknown as Response
		const arrayBuffer = await rawResp.arrayBuffer()
		const data = Buffer.from(arrayBuffer)

		tempVsixPath = io.writeTemp(data, ".vsix")
		vsixPath = tempVsixPath
		registrySource = "open-vsx"
		rawBytes = data
	} else {
		// 1c. Local VSIX
		vsixPath = input.vsixPath
		registrySource = "manual-vsix"
		// Read the raw bytes once, up-front, so the registry signature is verified
		// over them BEFORE any extraction (A2a).
		rawBytes = io.readFileSync(vsixPath)
	}

	// ---------------------------------------------------------------------
	// A2a/A2b/A2c — Verify the registry signature over the RAW bytes BEFORE
	// extract. On failure we never reach `unpackVsix`, so a rejected package
	// never creates a discoverable content-addressed dir.
	// ---------------------------------------------------------------------
	const sourceKind = signatureSourceKind(registrySource)
	const trustAnchorRegistry: TrustAnchorRegistry =
		options.trustAnchorRegistry ?? createDefaultTrustAnchorRegistry()

	// resolveDetachedSignature throws integrity_mismatch on a present-but-invalid
	// signature or a contentSha256 mismatch; returns null when no signature is
	// resolvable for the source (policy gate below decides if that is permitted).
	const provenance: ResolvedSignatureProvenance | null = resolveDetachedSignature({
		source: sourceKind,
		registryMeta: options.registrySignature ?? null,
		rawBytes,
		localPackagePath: input.kind === "local-vsix" ? vsixPath : undefined,
		trustAnchorRegistry,
		io: {
			readFileSync: io.readFileSync,
			existsSync: io.existsSync,
		},
		downloadUrl: registryMeta?.downloadUrl ?? null,
	})

	// A2c policy gate: a signing-authority install with NO resolvable signature is
	// blocked unless explicitly allow-unsigned-with-consent (CH5 fail-fast).
	if (provenance === null && isSigningAuthoritySource(sourceKind) && !options.allowUnsignedWithConsent) {
		// Clean up the downloaded temp before aborting — nothing was extracted.
		if (tempVsixPath) io.unlinkSync(tempVsixPath)
		throw new UnsignedInstallBlockedError(
			sourceKind,
			`Install blocked: ${sourceKind} source served no registry signature and the source is not allow-unsigned-with-consent`,
		)
	}

	// Derive the trust tier + signature state for persistence. A resolved
	// provenance carries the verified tier (signed-third-party / unverified);
	// an absent signature on a permitted source is unsigned-third-party.
	const trust = provenance
		? { signatureState: provenance.signatureState, trustTier: provenance.trustTier }
		: { signatureState: "unsigned" as const, trustTier: "unsigned-third-party" as const }
	if (trust.trustTier === "built-in") {
		throw new Error(`derivePackageTrust returned built-in trust for marketplace source ${registrySource}`)
	}

	try {
		// Build package store IO from our orchestrator IO
		const packageStoreIo: PackageStoreIo = {
			readFileSync: io.readFileSync,
			existsSync: io.existsSync,
			mkdirSync: io.mkdirSync,
			unzip: io.unzip,
		}

		// 2. Verify + unpack (signature already verified over rawBytes above)
		const unpacked: UnpackedVsixResult = await unpackVsix(vsixPath, {
			packageStoreRoot: options.packageStoreRoot,
			expectedSha256: input.kind === "open-vsx"
				? (registryMeta?.sha256 ?? undefined)
				: (input as InstallFromLocalVsixInput).expectedSha256,
			io: packageStoreIo,
		})

		// 3. Detect package shape: Firefly code extension (manifest.json) vs VS Code theme (package.json)
		//
		// A Firefly FPK ships a `manifest.json` at `extension/manifest.json` inside the
		// package ZIP. A VS Code theme package ships only `package.json` with a
		// `contributes.themes` block. We detect the Firefly path first so existing theme
		// packages continue to work unmodified.
		const fireflyManifestPath = path.join(unpacked.unpackedPath, "extension", "manifest.json")
		const hasFireflyManifest = io.existsSync(fireflyManifestPath)

		if (hasFireflyManifest) {
			// ---------------------------------------------------------------------------
			// F1 — Firefly code-extension install branch
			// ---------------------------------------------------------------------------
			log.info("Firefly manifest.json detected — code-extension branch", { sha256: unpacked.contentSha256 })

			// 3a. Read + parse the Firefly manifest via the JSON profile path.
			const manifestBytes = io.readFileSync(fireflyManifestPath)
			let manifestRaw: unknown
			try {
				manifestRaw = JSON.parse(manifestBytes.toString("utf8"))
			} catch (err) {
				throw new Error(
					`Failed to parse extension/manifest.json in ${unpacked.unpackedPath}: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
			const pluginManifest = parseJsonPluginManifest(manifestRaw)

			// 3b. Derive the descriptor (validates panel slots, widget zones, engine range).
			const descriptor = derivePluginDescriptor(pluginManifest, {
				appVersion: "0.0.0", // placeholder — host re-derives at catalog load time
				currentBuild: "electron",
			})

			log.info("Firefly descriptor derived", {
				pluginId: pluginManifest.id,
				tools: pluginManifest.contributes.tools.length,
				commands: pluginManifest.contributes.commands.length,
				capabilities: pluginManifest.capabilities.length,
			})

			// 3c. Persist the package row. `pluginManifestJson` enables the F2 catalog
			// bridge to reconstruct the descriptor from the install record without
			// re-reading the disk. `requiredCapabilitiesJson` surfaces declared
			// capabilities for the consent gate and catalog projection.
			const pkg = await store.upsertExtensionPackage({
				id: unpacked.contentSha256,
				externalId: pluginManifest.id,
				publisher: pluginManifest.publisher ?? null,
				name: pluginManifest.id,
				version: pluginManifest.version,
				displayName: pluginManifest.displayName ?? null,
				registrySource,
				vsixPath: input.kind === "local-vsix" ? vsixPath : null,
				unpackedPath: unpacked.unpackedPath,
				signatureState: trust.signatureState,
				scanState: "clean",
				themesJson: null,
				publisherKeyId: provenance?.publisherKeyId ?? null,
				signatureAlgorithm: provenance?.signature.algorithm ?? null,
				signatureB64: provenance?.signature.signatureB64 ?? null,
				signedManifestJson: provenance ? JSON.stringify(provenance.signedManifest) : null,
				pluginManifestJson: JSON.stringify(manifestRaw),
				requiredCapabilitiesJson: pluginManifest.capabilities.length > 0
					? JSON.stringify(pluginManifest.capabilities)
					: null,
			})

			// 3d. Write ExtensionInstallation.
			const installation = await store.createExtensionInstallation({
				packageId: pkg.id,
				lifecycleState: "installed",
				trustTier: trust.trustTier,
				scope: "app",
			})

			// 3e. Persist install-time capability grants (P3d / §10). Auto-grant
			// low-risk by trust tier; leave medium/high/critical as prompt-required.
			if (options.grantStore) {
				await persistInstallGrants({
					grantStore: options.grantStore,
					pluginId: pluginManifest.id,
					capabilities: pluginManifest.capabilities,
					trust: trust.trustTier,
					consentedCapabilities: options.consentedCapabilities,
				})
			}

			log.info("Firefly code extension installed", {
				packageId: pkg.id,
				pluginId: pluginManifest.id,
				installationId: installation.id,
			})

			return {
				package: pkg,
				installation,
				themes: [],
				alreadyInstalled: pkg.createdAt < Date.now() - 5000,
				descriptor,
			}
		}

		// ---------------------------------------------------------------------------
		// VS Code theme package branch (original path — unchanged)
		// ---------------------------------------------------------------------------

		// 3. Detect contributes.themes
		const packageJsonRaw = unpacked.packageJson as Record<string, unknown>
		const contributes = packageJsonRaw.contributes as Record<string, unknown> | null | undefined
		const themeDeclarations = (contributes?.themes ?? []) as unknown[]
		if (!themeDeclarations || themeDeclarations.length === 0) {
			throw new Error(
				`Package ${unpacked.contentSha256} has no contributes.themes and no extension/manifest.json — cannot install`,
			)
		}

		log.info("Theme declarations found", { count: themeDeclarations.length, sha256: unpacked.contentSha256 })

		// 4. Convert themes — read theme JSON files from unpackedPath
		const conversionResult = convertVscodeThemePackage(
			packageJsonRaw,
			(declaration: VscodeThemeDeclaration) => {
				const themeFilePath = path.join(unpacked.unpackedPath, "extension", declaration.path)
				if (!io.existsSync(themeFilePath)) {
					throw new Error(`Theme file not found: ${themeFilePath}`)
				}
				const rawBytes = io.readFileSync(themeFilePath)
				return JSON.parse(rawBytes.toString("utf8")) as unknown
			},
			{ registry: registrySource },
		)

		log.info("Themes converted", {
			count: conversionResult.themes.length,
			externalId: conversionResult.externalId,
		})

		// 5. Write ExtensionPackage (idempotent)
		// Include appTokens so the renderer can inject CSS vars without re-converting.
		const themesJson = JSON.stringify(
			conversionResult.themes.map((t) => ({
				id: t.id,
				label: t.label,
				kind: t.kind,
				appTokens: t.appTokens,
			})),
		)

		// 5b. The trust tier + signature state were derived pre-extract (A2) from
		// the verified registry signature over the raw bytes. Persist the
		// provenance (publisher key id, algorithm, signature bytes, canonical
		// signed manifest) alongside the package row when a signature verified.
		const pkg = await store.upsertExtensionPackage({
			id: unpacked.contentSha256,
			externalId: conversionResult.externalId,
			publisher: conversionResult.publisher,
			name: (packageJsonRaw.name as string | undefined) ?? conversionResult.externalId,
			version: conversionResult.version,
			displayName: (packageJsonRaw.displayName as string | undefined) ?? null,
			registrySource,
			vsixPath: input.kind === "local-vsix" ? vsixPath : null,
			unpackedPath: unpacked.unpackedPath,
			signatureState: trust.signatureState,
			scanState: "clean",
			themesJson,
			publisherKeyId: provenance?.publisherKeyId ?? null,
			signatureAlgorithm: provenance?.signature.algorithm ?? null,
			signatureB64: provenance?.signature.signatureB64 ?? null,
			signedManifestJson: provenance ? JSON.stringify(provenance.signedManifest) : null,
		})

		// 6. Write ExtensionInstallation
		const installation = await store.createExtensionInstallation({
			packageId: pkg.id,
			lifecycleState: "installed",
			trustTier: trust.trustTier,
			scope: "app",
		})

		// 6b. Persist install-time capability grants (P3d). Themes declare no
		// capabilities → no-op; capability-bearing code extensions (future install
		// path) auto-grant low-risk + record medium/high as prompt-required.
		if (options.grantStore) {
			const capabilities = (contributes?.capabilities as string[] | undefined) ?? []
			await persistInstallGrants({
				grantStore: options.grantStore,
				pluginId: conversionResult.externalId,
				capabilities,
				trust: trust.trustTier,
			})
		}

		log.info("Extension installed", {
			packageId: pkg.id,
			installationId: installation.id,
			themes: conversionResult.themes.length,
		})

		return {
			package: pkg,
			installation,
			themes: conversionResult.themes,
			alreadyInstalled: pkg.createdAt < Date.now() - 5000,
			descriptor: null,
		}
	} finally {
		// Clean up temp VSIX download
		if (tempVsixPath) {
			io.unlinkSync(tempVsixPath)
		}
	}
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------

/**
 * Uninstall: mark the installation as "removed".
 * Does not delete the package bytes (they may be referenced by other installs).
 */
export async function uninstallExtension(installationId: string): Promise<void> {
	const { updateInstallationLifecycle } = await import("./extension-store")
	await updateInstallationLifecycle(installationId, "removed")
	log.info("Extension uninstalled", { installationId })
}

// ---------------------------------------------------------------------------
// Apply theme (Phase 1 stub: record the applied theme id on the installation)
// ---------------------------------------------------------------------------

/**
 * Record which theme short-id is "applied" for a given installation.
 * The actual rendering/CSS-var injection is handled by the renderer theme engine
 * (not in scope for the install orchestrator).
 */
export async function applyInstalledTheme(
	installationId: string,
	themeId: string,
): Promise<void> {
	const { updateAppliedTheme } = await import("./extension-store")
	await updateAppliedTheme(installationId, themeId)
	log.info("Applied theme recorded", { installationId, themeId })
}

// ---------------------------------------------------------------------------
// Re-export sha256Hex for convenience (tests, CLI)
// ---------------------------------------------------------------------------
export { sha256Hex }
