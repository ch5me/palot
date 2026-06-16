/**
 * Firefly Plugin System V2 — worker supervisor boot wiring
 *
 * Glues the tested pieces together for the live app: catalog authority
 * (which plugins exist + lifecycle overlay) → worker entry discovery on
 * the same disk roots the manifest loader scans → one supervised
 * `worker_thread` per plugin that ships a worker entry.
 *
 * Worker entry layout (plan §2.3):
 *   - packaged: `<resources>/plugins/<plugin-id>/worker.mjs` (id-keyed,
 *     emitted by `scripts/build-plugins.ts`)
 *   - dev:      `apps/desktop/plugins/<dir>/worker.mjs` where `<dir>` is
 *     the plugin directory (the id's last segment for built-ins, e.g.
 *     `plugins/notes/` for `firefly.built-in.surface.notes`)
 *
 * A plugin with no worker entry is panel/command/tool-only — that is the
 * normal case for the current built-ins and NOT an error. Quarantine
 * decisions made by the locked supervision reducer persist into the
 * same durable lifecycle store the UI-crash path uses, so the operator
 * surface shows one truth.
 */

import * as fs from "node:fs"

import { createLogger } from "../logger"
import { getPluginCatalog, getPluginLifecycleStore, resolvePluginRoots } from "./authority"
import {
	createPluginWorkerSupervisor,
	type PluginWorkerSupervisor,
	type QuarantineStore,
	type SpawnPluginWorker,
} from "./worker-supervisor"
import { createWorkerThreadSpawner } from "./worker-thread-spawner"
import { createUtilityProcessSpawner } from "./utility-process-spawner"
import { createBootWorkerRequestHandler } from "./worker-request-handler"

const log = createLogger("firefly-plugin/supervisor-boot")

/** Cap a leaking plugin's heap so it OOMs itself, not the host. */
const DEFAULT_WORKER_HEAP_MB = 256

export interface DiscoveredWorkerEntry {
	readonly pluginId: string
	readonly entryPath: string
}

const WORKER_ENTRY_FILENAMES = ["worker.mjs", "worker.js"] as const

/**
 * Find the worker entry for each plugin id. Deterministic: roots in
 * input order, id-keyed directory before short-dir, `.mjs` before `.js`;
 * first hit wins. Pure given the injected `existsSync`.
 */
export function discoverPluginWorkerEntries(input: {
	pluginIds: readonly string[]
	roots: readonly string[]
	existsSync?: (p: string) => boolean
	joinPath?: (...parts: string[]) => string
}): DiscoveredWorkerEntry[] {
	const existsSync = input.existsSync ?? ((p: string) => fs.existsSync(p))
	const joinPath = input.joinPath ?? ((...parts: string[]) => parts.join("/"))
	const entries: DiscoveredWorkerEntry[] = []
	for (const pluginId of input.pluginIds) {
		const shortDir = pluginId.split(".").at(-1) ?? pluginId
		const candidateDirs = shortDir === pluginId ? [pluginId] : [pluginId, shortDir]
		let found: string | null = null
		for (const root of input.roots) {
			for (const dir of candidateDirs) {
				for (const filename of WORKER_ENTRY_FILENAMES) {
					const candidate = joinPath(root, dir, filename)
					if (existsSync(candidate)) {
						found = candidate
						break
					}
				}
				if (found) break
			}
			if (found) break
		}
		if (found) entries.push({ pluginId, entryPath: found })
	}
	return entries
}

/**
 * Quarantine store adapter: supervision-reducer quarantine decisions
 * land in the durable lifecycle store (same file as UI-crash
 * quarantine), so the catalog overlay and operator surface reflect
 * worker quarantines without a second source of truth.
 */
function lifecycleQuarantineStore(): QuarantineStore {
	return {
		write: (record) => {
			getPluginLifecycleStore().quarantine(
				record.pluginId,
				`worker quarantined (${record.reason}): ${record.detail}`,
			)
		},
		clear: (pluginId) => {
			getPluginLifecycleStore().releaseQuarantine(pluginId, "worker supervisor clear-quarantine")
		},
	}
}

export interface SupervisorBootResult {
	readonly supervisor: PluginWorkerSupervisor
	readonly supervised: readonly DiscoveredWorkerEntry[]
}

export interface SupervisorBootOptions {
	/** Override the disk roots scanned for worker entries (tests). */
	readonly roots?: readonly string[]
	/** Override the worker spawner (tests inject fixture workers). */
	readonly spawnWorker?: Parameters<typeof createPluginWorkerSupervisor>[0]["spawnWorker"]
	/** Override the worker storage/capability request router (tests). */
	readonly onWorkerRequest?: Parameters<typeof createPluginWorkerSupervisor>[0]["onWorkerRequest"]
}

let booted: SupervisorBootResult | null = null

/**
 * Boot the per-plugin worker_thread runtime for every catalog plugin
 * that ships a worker entry. Idempotent: repeat calls return the live
 * instance. Plugins that are disabled or quarantined in the lifecycle
 * store are registered but NOT activated (enable/release activates
 * them through the supervisor API later).
 */
export function bootPluginWorkerSupervisor(options: SupervisorBootOptions = {}): SupervisorBootResult {
	if (booted) return booted

	const catalog = getPluginCatalog()
	const roots = options.roots ?? resolvePluginRoots()
	const discovered = discoverPluginWorkerEntries({
		pluginIds: catalog.descriptors.map((d) => d.normalizedId),
		roots: [...roots],
	})

	// Transport selection per §2.3: a plugin whose runtime location resolves to
	// `electron-utility` (node-worker on the electron build) runs in a real
	// Electron utilityProcess; everything else (web-worker dev, tests) uses the
	// worker_threads transport. Resolution comes from the descriptor's
	// runtime-location matrix (P3a). Default to worker_threads — never assume
	// utility for an unknown/unsupported location.
	const workerThreadSpawner = createWorkerThreadSpawner({ maxOldGenerationSizeMb: DEFAULT_WORKER_HEAP_MB })
	const utilityProcessSpawner = createUtilityProcessSpawner({ maxOldGenerationSizeMb: DEFAULT_WORKER_HEAP_MB })
	const selectSpawner: SpawnPluginWorker = (input) => {
		const descriptor = catalog.descriptors.find((d) => d.normalizedId === input.pluginId)
		const location = descriptor?.runtimeResolution.supported ? descriptor.runtimeResolution.location : null
		return location === "electron-utility" ? utilityProcessSpawner(input) : workerThreadSpawner(input)
	}

	const supervisor = createPluginWorkerSupervisor({
		spawnWorker: options.spawnWorker ?? selectSpawner,
		quarantineStore: lifecycleQuarantineStore(),
		// Route worker storage/capability requests to the DB-backed services
		// (lazily resolved). Tests inject their own via options.spawnWorker paths.
		onWorkerRequest: options.onWorkerRequest ?? createBootWorkerRequestHandler(),
		onTransition: (summary, decision) => {
			if (decision.action === "none") return
			log.info("Plugin worker transition", {
				pluginId: summary.pluginId,
				state: summary.state,
				action: decision.action,
			})
		},
	})

	const store = getPluginLifecycleStore()
	for (const entry of discovered) {
		const descriptor = catalog.descriptors.find((d) => d.normalizedId === entry.pluginId)
		supervisor.register({
			pluginId: entry.pluginId,
			entryPath: entry.entryPath,
			quarantineOnCrashCount: descriptor?.derived.quarantineOnCrashCount,
		})
		const state = store.get(entry.pluginId)
		if (!state.enabled || state.quarantined) {
			log.info("Plugin worker registered but not activated (lifecycle override)", {
				pluginId: entry.pluginId,
				enabled: state.enabled,
				quarantined: state.quarantined,
			})
			continue
		}
		supervisor.activate(entry.pluginId)
	}

	log.info("Plugin worker supervisor booted", {
		roots,
		workerCount: discovered.length,
		workerPluginIds: discovered.map((d) => d.pluginId),
	})

	booted = { supervisor, supervised: discovered }
	return booted
}

/** Singleton accessor for IPC/operator paths. Null before boot. */
export function getBootedPluginWorkerSupervisor(): PluginWorkerSupervisor | null {
	return booted?.supervisor ?? null
}

/** Teardown for app quit. Idempotent. */
export async function disposePluginWorkerSupervisor(): Promise<void> {
	if (!booted) return
	const current = booted
	booted = null
	await current.supervisor.dispose()
	log.info("Plugin worker supervisor disposed")
}

/** Test hook. */
export function _resetSupervisorBootForTests(): void {
	booted = null
}
