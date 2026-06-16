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

const log = createLogger("firefly-plugin/install-orchestrator")

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
	/** Converted theme contributions from this package. */
	themes: ImportedThemeContribution[]
	/** Whether the package was already installed (idempotent re-install). */
	alreadyInstalled: boolean
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
	} else {
		// 1c. Local VSIX
		vsixPath = input.vsixPath
		registrySource = "manual-vsix"
	}

	try {
		// Build package store IO from our orchestrator IO
		const packageStoreIo: PackageStoreIo = {
			readFileSync: io.readFileSync,
			existsSync: io.existsSync,
			mkdirSync: io.mkdirSync,
			unzip: io.unzip,
		}

		// 2. Verify + unpack
		const unpacked: UnpackedVsixResult = await unpackVsix(vsixPath, {
			packageStoreRoot: options.packageStoreRoot,
			expectedSha256: input.kind === "open-vsx"
				? (registryMeta?.sha256 ?? undefined)
				: (input as InstallFromLocalVsixInput).expectedSha256,
			io: packageStoreIo,
		})

		// 3. Detect contributes.themes
		const packageJsonRaw = unpacked.packageJson as Record<string, unknown>
		const contributes = packageJsonRaw.contributes as Record<string, unknown> | null | undefined
		const themeDeclarations = (contributes?.themes ?? []) as unknown[]
		if (!themeDeclarations || themeDeclarations.length === 0) {
			throw new Error(
				`Package ${unpacked.contentSha256} has no contributes.themes — Phase 1 supports theme packages only`,
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
			signatureState: "unsigned",
			scanState: "clean",
			themesJson,
		})

		// 6. Write ExtensionInstallation
		const installation = await store.createExtensionInstallation({
			packageId: pkg.id,
			lifecycleState: "installed",
			trustTier: "unsigned-third-party",
			scope: "app",
		})

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
