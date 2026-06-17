/**
 * Firefly Plugin Marketplace — Extension store (DB CRUD, §7.1)
 *
 * Thin CRUD wrapper over the two extension tables introduced by the
 * `20260616000000_extension-packages` Drizzle migration:
 *
 *   extensionPackages     — immutable, content-addressed VSIX record
 *   extensionInstallations — mutable lifecycle state per package
 *
 * All operations go through the shared `ensureDb()` from the automation
 * database module — same SQLite file, same LibSQL connection.
 *
 * Architecture:
 *   - No logic here — just typed CRUD.  Install orchestration lives in
 *     `install-orchestrator.ts`.
 *   - IDs: extensionPackage.id = sha256 hex (content-addressed).
 *           extensionInstallation.id = `<sha256>-<timestamp>`.
 *   - Fail-loud: every function throws on DB error; no silent fallbacks.
 */

import { eq, desc } from "drizzle-orm"
import { ensureDb } from "../../automation/database"
import { extensionPackages, extensionInstallations } from "../../automation/schema"
import { createLogger } from "../../logger"
import type { SignatureState } from "../../../shared/firefly-plugin/registry-signature-contract"

const log = createLogger("firefly-plugin/extension-store")

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExtensionPackageRecord {
	id: string
	externalId: string
	publisher: string | null
	name: string
	version: string
	displayName: string | null
	registrySource: string
	vsixPath: string | null
	unpackedPath: string
	signatureState: SignatureState
	scanState: string
	themesJson: string | null
	/** Publisher key id that signed the canonical manifest (A2 provenance). */
	publisherKeyId: string | null
	/** Signature algorithm (e.g. "ed25519"). */
	signatureAlgorithm: string | null
	/** Base64-encoded detached signature bytes. */
	signatureB64: string | null
	/** Verified canonical signed-manifest JSON. */
	signedManifestJson: string | null
	/**
	 * F1 — Firefly code-extension: the raw `manifest.json` content for this
	 * package (JSON text). Null for VS Code theme packages. Used by the F2
	 * catalog bridge to reconstruct the descriptor without re-parsing the disk.
	 */
	pluginManifestJson: string | null
	/**
	 * F1 — Firefly code-extension: JSON-encoded `readonly string[]` of the
	 * plugin's declared `capabilities` from the manifest. Null for theme packages.
	 * Surfaced on the install record so the F2 bridge + consent gate can read
	 * required capabilities without re-parsing the full manifest.
	 */
	requiredCapabilitiesJson: string | null
	createdAt: number
}

export interface ExtensionInstallationRecord {
	id: string
	packageId: string
	lifecycleState: string
	trustTier: string
	scope: string
	appliedThemeId: string | null
	installedAt: number
	updatedAt: number
}

export interface CreateExtensionPackageInput {
	id: string
	externalId: string
	publisher: string | null
	name: string
	version: string
	displayName?: string | null
	registrySource: "open-vsx" | "manual-vsix"
	vsixPath?: string | null
	unpackedPath: string
	signatureState?: SignatureState
	scanState?: "pending" | "clean" | "quarantined"
	themesJson?: string | null
	/** Publisher key id that signed the canonical manifest (A2 provenance). */
	publisherKeyId?: string | null
	/** Signature algorithm (e.g. "ed25519"). */
	signatureAlgorithm?: string | null
	/** Base64-encoded detached signature bytes. */
	signatureB64?: string | null
	/** Verified canonical signed-manifest JSON. */
	signedManifestJson?: string | null
	/**
	 * F1 — Firefly code-extension: the raw `manifest.json` content for this
	 * package (JSON text). Null for VS Code theme packages.
	 */
	pluginManifestJson?: string | null
	/**
	 * F1 — Firefly code-extension: JSON-encoded `readonly string[]` of the
	 * plugin's declared capabilities. Null for theme packages.
	 */
	requiredCapabilitiesJson?: string | null
}

export interface CreateExtensionInstallationInput {
	packageId: string
	lifecycleState?: "installed" | "disabled" | "removed"
	trustTier?: "local-dev" | "signed-third-party" | "unsigned-third-party"
	scope?: "app" | "profile" | "workspace"
	appliedThemeId?: string | null
}

// ---------------------------------------------------------------------------
// ExtensionPackage CRUD
// ---------------------------------------------------------------------------

/**
 * Insert an ExtensionPackage row. Idempotent: if the sha256 already exists,
 * returns the existing record without error.
 */
export async function upsertExtensionPackage(
	input: CreateExtensionPackageInput,
): Promise<ExtensionPackageRecord> {
	const db = await ensureDb()
	const now = Date.now()

	// Check for existing record first (content-addressed = same sha256 = same bytes)
	const existing = await db
		.select()
		.from(extensionPackages)
		.where(eq(extensionPackages.id, input.id))
		.limit(1)

	if (existing.length > 0) {
		log.info("ExtensionPackage already exists (idempotent)", { id: input.id })
		return existing[0] as ExtensionPackageRecord
	}

	const row = {
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
		createdAt: now,
	}

	await db.insert(extensionPackages).values(row)
	log.info("ExtensionPackage inserted", { id: input.id, externalId: input.externalId })
	return row as ExtensionPackageRecord
}

/**
 * Fetch an ExtensionPackage by sha256 id. Returns null when not found.
 */
export async function getExtensionPackage(id: string): Promise<ExtensionPackageRecord | null> {
	const db = await ensureDb()
	const rows = await db
		.select()
		.from(extensionPackages)
		.where(eq(extensionPackages.id, id))
		.limit(1)
	return (rows[0] as ExtensionPackageRecord | undefined) ?? null
}

/**
 * List all ExtensionPackage rows, most recent first.
 */
export async function listExtensionPackages(): Promise<ExtensionPackageRecord[]> {
	const db = await ensureDb()
	const rows = await db
		.select()
		.from(extensionPackages)
		.orderBy(desc(extensionPackages.createdAt))
	return rows as ExtensionPackageRecord[]
}

// ---------------------------------------------------------------------------
// ExtensionInstallation CRUD
// ---------------------------------------------------------------------------

/**
 * Create an ExtensionInstallation row (always inserts a new row;
 * multiple installs of the same package are legal).
 */
export async function createExtensionInstallation(
	input: CreateExtensionInstallationInput,
): Promise<ExtensionInstallationRecord> {
	const db = await ensureDb()
	const now = Date.now()
	const id = `${input.packageId}-${now}`

	const row = {
		id,
		packageId: input.packageId,
		lifecycleState: input.lifecycleState ?? "installed",
		trustTier: input.trustTier ?? "unsigned-third-party",
		scope: input.scope ?? "app",
		appliedThemeId: input.appliedThemeId ?? null,
		installedAt: now,
		updatedAt: now,
	}

	await db.insert(extensionInstallations).values(row)
	log.info("ExtensionInstallation created", { id, packageId: input.packageId })
	return row as ExtensionInstallationRecord
}

/**
 * Fetch a single ExtensionInstallation by its id. Returns null when not found.
 */
export async function getInstallationById(
	id: string,
): Promise<ExtensionInstallationRecord | null> {
	const db = await ensureDb()
	const rows = await db
		.select()
		.from(extensionInstallations)
		.where(eq(extensionInstallations.id, id))
		.limit(1)
	return (rows[0] as ExtensionInstallationRecord | undefined) ?? null
}

/**
 * Find the active (most recent non-removed) installation for a package.
 */
export async function getActiveInstallation(
	packageId: string,
): Promise<ExtensionInstallationRecord | null> {
	const db = await ensureDb()
	const rows = await db
		.select()
		.from(extensionInstallations)
		.where(eq(extensionInstallations.packageId, packageId))
		.orderBy(desc(extensionInstallations.installedAt))
		.limit(10)

	// Return the most recent non-removed installation
	const active = (rows as ExtensionInstallationRecord[]).find(
		(r) => r.lifecycleState !== "removed",
	)
	return active ?? null
}

/**
 * List all active (non-removed) installations with their package records.
 */
export async function listInstalledExtensions(): Promise<
	{ package: ExtensionPackageRecord; installation: ExtensionInstallationRecord }[]
> {
	const db = await ensureDb()

	// Fetch all non-removed installations
	const installs = await db
		.select()
		.from(extensionInstallations)
		.where(eq(extensionInstallations.lifecycleState, "installed"))
		.orderBy(desc(extensionInstallations.installedAt))

	const result: { package: ExtensionPackageRecord; installation: ExtensionInstallationRecord }[] =
		[]

	for (const install of installs as ExtensionInstallationRecord[]) {
		const pkg = await getExtensionPackage(install.packageId)
		if (pkg) {
			result.push({ package: pkg, installation: install })
		}
	}

	return result
}

/**
 * Update the lifecycle state of an installation.
 */
export async function updateInstallationLifecycle(
	installationId: string,
	lifecycleState: "installed" | "disabled" | "removed",
): Promise<void> {
	const db = await ensureDb()
	await db
		.update(extensionInstallations)
		.set({ lifecycleState, updatedAt: Date.now() })
		.where(eq(extensionInstallations.id, installationId))
	log.info("ExtensionInstallation lifecycle updated", { installationId, lifecycleState })
}

/**
 * Update the applied theme id on an installation.
 */
export async function updateAppliedTheme(
	installationId: string,
	appliedThemeId: string | null,
): Promise<void> {
	const db = await ensureDb()
	await db
		.update(extensionInstallations)
		.set({ appliedThemeId, updatedAt: Date.now() })
		.where(eq(extensionInstallations.id, installationId))
	log.info("ExtensionInstallation appliedTheme updated", { installationId, appliedThemeId })
}
