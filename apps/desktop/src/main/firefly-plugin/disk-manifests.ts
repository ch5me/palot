/**
 * Firefly Plugin System V2 — disk manifest discovery
 *
 * Discovers JSON-profile plugin manifests on disk and parses them at
 * the catalog boundary. Two roots are scanned:
 *   - dev:       `<repo>/apps/desktop/plugins/<plugin-dir>/manifest.json`
 *   - packaged:  `<resources>/plugins/<plugin-dir>/manifest.json`
 *
 * Built-in plugins keep TypeScript manifests imported by the catalog
 * directly (the manifest is code); this module is the third-party /
 * disk path. Both produce identical `PluginManifest` values via the
 * JSON profile (`shared/firefly-plugin/json-manifest.ts`).
 *
 * Failure policy (locked by the V2 plan): a bad manifest quarantines
 * that one entry — visible in the operator surface with the issues —
 * and never blocks the rest of the catalog or boot. A missing plugins
 * directory is a legitimate empty set, not an error.
 */

import * as fs from "node:fs"
import * as path from "node:path"

import {
	safeParseJsonPluginManifest,
	type JsonManifestIssue,
} from "../../shared/firefly-plugin/json-manifest"
import type { PluginManifest } from "../../shared/firefly-plugin/manifest"

export interface DiskManifestFailure {
	readonly directory: string
	readonly manifestPath: string
	readonly pluginId: string | null
	readonly issues: readonly JsonManifestIssue[]
}

export interface DiskManifestDiscovery {
	readonly manifests: readonly PluginManifest[]
	readonly failures: readonly DiskManifestFailure[]
}

export interface DiskManifestFs {
	readonly existsSync: (p: string) => boolean
	readonly readdirSync: (p: string) => string[]
	readonly statIsDirectory: (p: string) => boolean
	readonly readFileSync: (p: string) => string
}

const nodeFs: DiskManifestFs = {
	existsSync: (p) => fs.existsSync(p),
	readdirSync: (p) => fs.readdirSync(p),
	statIsDirectory: (p) => fs.statSync(p).isDirectory(),
	readFileSync: (p) => fs.readFileSync(p, "utf8"),
}

/**
 * Scan plugin root directories for `<dir>/<plugin>/manifest.json`.
 * Pure given the injected fs; deterministic ordering (sorted by
 * plugin directory name within each root, roots in input order).
 */
export function discoverDiskManifests(
	roots: readonly string[],
	io: DiskManifestFs = nodeFs,
): DiskManifestDiscovery {
	const manifests: PluginManifest[] = []
	const failures: DiskManifestFailure[] = []

	for (const root of roots) {
		if (!io.existsSync(root)) continue
		let children: string[]
		try {
			children = io.readdirSync(root).sort()
		} catch (err) {
			failures.push({
				directory: root,
				manifestPath: root,
				pluginId: null,
				issues: [{ path: [], message: `failed to read plugins root: ${String(err)}` }],
			})
			continue
		}
		for (const child of children) {
			const pluginDir = path.join(root, child)
			let isDir = false
			try {
				isDir = io.statIsDirectory(pluginDir)
			} catch {
				continue
			}
			if (!isDir) continue
			const manifestPath = path.join(pluginDir, "manifest.json")
			if (!io.existsSync(manifestPath)) continue

			let raw: unknown
			try {
				raw = JSON.parse(io.readFileSync(manifestPath))
			} catch (err) {
				failures.push({
					directory: pluginDir,
					manifestPath,
					pluginId: null,
					issues: [{ path: [], message: `manifest.json is not valid JSON: ${String(err)}` }],
				})
				continue
			}

			const parsed = safeParseJsonPluginManifest(raw)
			if (!parsed.manifest) {
				const pluginId =
					typeof (raw as { id?: unknown })?.id === "string" ? ((raw as { id: string }).id ?? null) : null
				failures.push({ directory: pluginDir, manifestPath, pluginId, issues: parsed.issues })
				continue
			}
			manifests.push(parsed.manifest)
		}
	}

	return { manifests, failures }
}

/**
 * Resolve the default plugin roots for the running process.
 *  - packaged app: `<resourcesPath>/plugins`
 *  - dev: `<appRoot>/plugins` (apps/desktop/plugins)
 */
export function defaultPluginRoots(input: {
	isPackaged: boolean
	resourcesPath: string | null
	appRoot: string
}): string[] {
	if (input.isPackaged && input.resourcesPath) {
		return [path.join(input.resourcesPath, "plugins")]
	}
	return [path.join(input.appRoot, "plugins")]
}
