/**
 * Firefly Plugin System V2 — Install→catalog bridge (F2)
 *
 * Reads `extension_installations` joined to `extension_packages` for
 * code-extensions that are enabled (lifecycleState = "installed") and not
 * quarantined (scanState ≠ "quarantined"), then parses the stored
 * `pluginManifestJson` into `PluginManifest` objects so that
 * `buildCatalogWithDiskPlugins` can include them alongside built-in and
 * disk-discovered manifests.
 *
 * This is the sole bridge that makes a marketplace-installed code-extension
 * visible to the host catalog — and therefore to the supervisor (worker
 * registration), dispatch (routing), and renderer (projection).
 *
 * Architecture:
 *   - Fail-loud on DB error (CH5 policy — no silent fallbacks).
 *   - A single bad `pluginManifestJson` quarantines THAT entry and never
 *     blocks the rest (same quarantine-not-throw policy as disk manifests).
 *   - Accepts an injectable `ExtensionStoreApi` so the test suite can run
 *     entirely in-memory without touching the real app DB.
 *   - No writes. Read-only catalog source.
 */

import {
	safeParseJsonPluginManifest,
	type JsonManifestIssue,
} from "../../shared/firefly-plugin/json-manifest"
import type { PluginManifest } from "../../shared/firefly-plugin/manifest"

// ---------------------------------------------------------------------------
// Injectable store interface
// ---------------------------------------------------------------------------

/**
 * Minimal read-only slice of the extension store that F2 requires.
 * The default implementation delegates to the real `listInstalledExtensions`
 * from `install/extension-store.ts`; tests inject an in-memory stub.
 */
export interface InstalledExtensionRow {
	readonly installation: {
		readonly id: string
		readonly lifecycleState: string
	}
	readonly package: {
		readonly id: string
		readonly externalId: string
		readonly scanState: string
		readonly pluginManifestJson: string | null
		readonly requiredCapabilitiesJson: string | null
	}
}

export interface InstalledManifestStoreApi {
	/**
	 * List all non-removed installed extension records with their package data.
	 * Returns only rows whose `lifecycleState === "installed"` (the store
	 * already enforces this filter; F2 adds the scanState guard on top).
	 */
	listInstalledExtensions(): Promise<InstalledExtensionRow[]>
}

// ---------------------------------------------------------------------------
// Discovery result types
// ---------------------------------------------------------------------------

export interface InstalledManifestFailure {
	readonly installationId: string
	readonly packageId: string
	readonly externalId: string
	readonly issues: readonly JsonManifestIssue[]
}

export interface InstalledManifestDiscovery {
	readonly manifests: readonly PluginManifest[]
	readonly failures: readonly InstalledManifestFailure[]
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Discover manifests from the installed-extension store.
 *
 * Filters to rows where:
 *   - `lifecycleState === "installed"` (active — not disabled or removed)
 *   - `scanState !== "quarantined"` (not security-flagged)
 *   - `pluginManifestJson` is non-null (is a Firefly code-extension, not a theme)
 *
 * Each row's `pluginManifestJson` is parsed through the same
 * `safeParseJsonPluginManifest` path that disk-manifest discovery uses,
 * so the catalog builds descriptors identically regardless of source.
 *
 * A parse failure quarantines that one entry and is returned in `failures`;
 * valid manifests accumulate in `manifests`. Never throws.
 */
export async function discoverInstalledManifests(
	store: InstalledManifestStoreApi,
): Promise<InstalledManifestDiscovery> {
	const manifests: PluginManifest[] = []
	const failures: InstalledManifestFailure[] = []

	let rows: InstalledExtensionRow[]
	try {
		rows = await store.listInstalledExtensions()
	} catch (err) {
		// Fail-loud per CH5 policy: a DB error is not silently swallowed.
		// Re-throw so the caller (buildCatalogWithDiskPlugins) surfaces it.
		throw new Error(
			`discoverInstalledManifests: failed to query installed extensions: ${err instanceof Error ? err.message : String(err)}`,
			{ cause: err },
		)
	}

	for (const row of rows) {
		const { installation, package: pkg } = row

		// Must be actively installed (not disabled/removed). The store already
		// filters to "installed", but guard defensively in case the API changes.
		if (installation.lifecycleState !== "installed") continue

		// Skip quarantined packages — they may contain unsafe content.
		if (pkg.scanState === "quarantined") continue

		// Skip theme-only packages (no pluginManifestJson = no runtime manifest).
		if (pkg.pluginManifestJson === null) continue

		let raw: unknown
		try {
			raw = JSON.parse(pkg.pluginManifestJson)
		} catch (err) {
			failures.push({
				installationId: installation.id,
				packageId: pkg.id,
				externalId: pkg.externalId,
				issues: [
					{
						path: [],
						message: `pluginManifestJson is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
					},
				],
			})
			continue
		}

		const parsed = safeParseJsonPluginManifest(raw)
		if (!parsed.manifest) {
			failures.push({
				installationId: installation.id,
				packageId: pkg.id,
				externalId: pkg.externalId,
				issues: parsed.issues,
			})
			continue
		}

		manifests.push(parsed.manifest)
	}

	return { manifests, failures }
}

// ---------------------------------------------------------------------------
// Default store adapter (production wiring)
// ---------------------------------------------------------------------------

/**
 * Build the default `InstalledManifestStoreApi` backed by the real
 * `listInstalledExtensions` from the extension store. Lazily imports to
 * avoid pulling the DB into non-main-process contexts.
 */
export function createDefaultInstalledManifestStore(): InstalledManifestStoreApi {
	return {
		async listInstalledExtensions() {
			const { listInstalledExtensions } = await import("./install/extension-store")
			return listInstalledExtensions()
		},
	}
}
