/**
 * Firefly Plugin System V2 — dev hot-reload boot wiring
 *
 * Glues the hot-reload executor + dev file watcher to the live runtime,
 * DEV ONLY. Mirrors `supervisor-boot.ts`: a boot fn that builds the
 * executor (supervisor + catalog refresh + broadcaster injected) and
 * starts the watcher over the same disk roots the supervisor scans, plus
 * a singleton accessor and an idempotent dispose for app quit.
 *
 * Packaged builds never call this (the `index.ts` boot site is the dev
 * gate); a defensive guard here keeps it a no-op even if it is.
 */

import { createLogger } from "../logger"
import { refreshPluginCatalog, resolvePluginRoots, getPluginCatalog } from "./authority"
import { broadcastCatalogChanged } from "./catalog-broadcast"
import { startDevPluginWatcher, type DevPluginWatcher } from "./dev-plugin-watcher"
import {
	createHotReloadExecutor,
	type HotReloadExecutor,
} from "./hot-reload-executor"
import { getBootedPluginWorkerSupervisor } from "./supervisor-boot"

const log = createLogger("firefly-plugin/dev-watcher-boot")

export interface DevWatcherBootResult {
	readonly executor: HotReloadExecutor
	readonly watcher: DevPluginWatcher
	readonly roots: readonly string[]
}

export interface DevWatcherBootOptions {
	/** Whether the app is a packaged build. Packaged ⇒ no-op (no watch). */
	readonly isPackaged: boolean
	/** Override the disk roots scanned (tests). */
	readonly roots?: readonly string[]
}

let booted: DevWatcherBootResult | null = null

/**
 * Boot the dev hot-reload loop: watch plugin roots → executor →
 * supervisor restart + catalog reproject + renderer broadcast.
 * Idempotent. Returns null in a packaged build (dev-only feature).
 */
export function bootDevPluginWatcher(options: DevWatcherBootOptions): DevWatcherBootResult | null {
	if (options.isPackaged) {
		log.info("Packaged build: dev plugin watcher disabled")
		return null
	}
	if (booted) return booted

	const roots = options.roots ?? resolvePluginRoots()
	const executor = createHotReloadExecutor({
		supervisor: getBootedPluginWorkerSupervisor(),
		refreshCatalog: () => {
			refreshPluginCatalog()
		},
		broadcast: broadcastCatalogChanged,
		mode: "dev",
		log: {
			info: (message, meta) => log.info(message, meta),
			warn: (message, meta) => log.warn(message, meta),
			error: (message, meta) => log.error(message, meta),
		},
	})

	const watcher = startDevPluginWatcher({
		roots,
		pluginIds: getPluginCatalog().descriptors.map((d) => d.normalizedId),
		executor,
		log: {
			info: (message, meta) => log.info(message, meta),
			warn: (message, meta) => log.warn(message, meta),
		},
	})

	log.info("Dev plugin hot-reload watcher booted", { roots })
	booted = { executor, watcher, roots }
	return booted
}

/** Singleton accessor. Null before boot / in a packaged build. */
export function getBootedDevPluginWatcher(): DevWatcherBootResult | null {
	return booted
}

/** Teardown for app quit. Idempotent. */
export function disposeDevPluginWatcher(): void {
	if (!booted) return
	const current = booted
	booted = null
	current.watcher.dispose()
	log.info("Dev plugin hot-reload watcher disposed")
}

/** Test hook. */
export function _resetDevWatcherBootForTests(): void {
	if (booted) {
		booted.watcher.dispose()
		booted = null
	}
}
