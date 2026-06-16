/**
 * Firefly Plugin System V2 — one-time feature-flag → plugin-lifecycle
 * migration.
 *
 * Migrated surfaces no longer read renderer feature-flag atoms; their
 * enable/disable state lives in the host plugin lifecycle store. This
 * module carries each surface's legacy localStorage flag value over
 * exactly once, so a user who had disabled a surface keeps it disabled
 * after the cutover.
 *
 * Pure logic is injectable for tests; `runFireflyPluginFlagMigrations`
 * wires real localStorage + the preload bridge.
 */

import { createLogger } from "./lib/logger"

const log = createLogger("firefly-plugin-flag-migration")

export interface SurfaceFlagMigration {
	readonly pluginId: string
	readonly legacyStorageKey: string
}

/** One row per migrated surface. Append on each migration slice. */
export const SURFACE_FLAG_MIGRATIONS: readonly SurfaceFlagMigration[] = [
	{
		pluginId: "firefly.built-in.surface.notes",
		legacyStorageKey: "elf:notesSurfaceEnabled",
	},
	{
		pluginId: "firefly.built-in.surface.review",
		legacyStorageKey: "elf:reviewSurfaceEnabled",
	},
	{
		pluginId: "firefly.built-in.surface.files",
		legacyStorageKey: "elf:filesSurfaceEnabled",
	},
	{
		pluginId: "firefly.built-in.surface.artifacts",
		legacyStorageKey: "elf:artifactsSurfaceEnabled",
	},
	{
		pluginId: "firefly.built-in.surface.bridges",
		legacyStorageKey: "elf:bridgesSurfaceEnabled",
	},
	{
		pluginId: "firefly.built-in.surface.pulse",
		legacyStorageKey: "elf:pulseSurfaceEnabled",
	},
	{
		pluginId: "firefly.built-in.surface.memory",
		legacyStorageKey: "elf:memorySurfaceEnabled",
	},
	{
		pluginId: "firefly.built-in.surface.editor",
		legacyStorageKey: "elf:editorSurfaceEnabled",
	},
]

const MARKER_PREFIX = "elf:plugin-flag-migrated:"

export interface FlagMigrationIo {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
	setPluginEnabled(pluginId: string, enabled: boolean): Promise<unknown>
}

export interface FlagMigrationResult {
	readonly pluginId: string
	readonly action: "skipped-already-migrated" | "skipped-no-flag" | "migrated-disabled" | "migrated-enabled-default"
}

/**
 * Migrate one surface flag. Idempotent: a marker key guards re-runs.
 * Only an explicit `false` flag value produces a host-side disable —
 * the host default is enabled, so `true`/missing needs no write.
 */
export async function migrateSurfaceFlag(
	migration: SurfaceFlagMigration,
	io: FlagMigrationIo,
): Promise<FlagMigrationResult> {
	const markerKey = `${MARKER_PREFIX}${migration.pluginId}`
	if (io.getItem(markerKey) !== null) {
		return { pluginId: migration.pluginId, action: "skipped-already-migrated" }
	}
	const raw = io.getItem(migration.legacyStorageKey)
	if (raw === null) {
		io.setItem(markerKey, new Date().toISOString())
		return { pluginId: migration.pluginId, action: "skipped-no-flag" }
	}
	let action: FlagMigrationResult["action"] = "migrated-enabled-default"
	if (raw === "false") {
		await io.setPluginEnabled(migration.pluginId, false)
		action = "migrated-disabled"
	}
	io.setItem(markerKey, new Date().toISOString())
	io.removeItem(migration.legacyStorageKey)
	return { pluginId: migration.pluginId, action }
}

/** Run all surface flag migrations against the live environment. */
export async function runFireflyPluginFlagMigrations(): Promise<void> {
	if (typeof window === "undefined" || !window.elf?.plugins) return
	const io: FlagMigrationIo = {
		getItem: (key) => window.localStorage.getItem(key),
		setItem: (key, value) => window.localStorage.setItem(key, value),
		removeItem: (key) => window.localStorage.removeItem(key),
		setPluginEnabled: (pluginId, enabled) => window.elf.plugins.setEnabled(pluginId, enabled),
	}
	for (const migration of SURFACE_FLAG_MIGRATIONS) {
		try {
			const result = await migrateSurfaceFlag(migration, io)
			if (!result.action.startsWith("skipped")) {
				log.info("Migrated surface flag to plugin lifecycle", { ...result })
			}
		} catch (err) {
			// Loud, non-fatal: a failed migration must not block app boot;
			// the marker is NOT set, so it retries next launch.
			log.error("Surface flag migration failed; will retry next launch", {
				pluginId: migration.pluginId,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}
}
