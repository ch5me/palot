/**
 * Firefly Plugin System V2 — host lifecycle runtime state
 *
 * The durable, host-owned enable/disable + quarantine state that
 * overlays the (pure, rebuild-on-demand) plugin catalog. This is the
 * migration replacement for the renderer's per-surface feature-flag
 * atoms: a migrated surface's availability derives from THIS state via
 * the catalog projection, not from localStorage flags.
 *
 * Also owns the renderer UI-crash counter (plan §2.1): repeated panel
 * render crashes count toward the same quarantine threshold as worker
 * crashes (`quarantineOnCrashCount`, default 3, within the standard
 * crash window).
 *
 * Persistence is injectable; production writes
 * `<userData>/firefly-plugins.json` atomically.
 */

import * as fs from "node:fs"
import * as path from "node:path"

import { z } from "zod"

import { DEFAULT_CRASH_WINDOW_POLICY } from "../../shared/firefly-plugin/runtime-supervision"
import { createLogger } from "../logger"

const log = createLogger("firefly-plugin/lifecycle-state")

const persistedPluginStateSchema = z.object({
	enabled: z.boolean(),
	quarantined: z.boolean(),
	quarantineDetail: z.string().nullable(),
})

const persistedFileSchema = z.record(z.string(), persistedPluginStateSchema)

export interface PluginRuntimeStateSnapshot {
	readonly enabled: boolean
	readonly quarantined: boolean
	readonly quarantineDetail: string | null
	readonly uiCrashCount: number
}

export interface PluginLifecycleStateIo {
	read(): string | null
	write(content: string): void
}

export interface PluginLifecycleStateStore {
	get(pluginId: string): PluginRuntimeStateSnapshot
	/** All plugin ids with non-default state. */
	listOverridden(): Record<string, PluginRuntimeStateSnapshot>
	setEnabled(pluginId: string, enabled: boolean): PluginRuntimeStateSnapshot
	/**
	 * Record one renderer panel crash. Crosses into quarantine when
	 * `threshold` crashes land within `windowMs`.
	 */
	reportUiCrash(
		pluginId: string,
		message: string,
		options?: { threshold?: number; windowMs?: number },
	): PluginRuntimeStateSnapshot
	releaseQuarantine(pluginId: string, note: string): PluginRuntimeStateSnapshot
	subscribe(listener: () => void): () => void
}

interface MutableState {
	enabled: boolean
	quarantined: boolean
	quarantineDetail: string | null
	uiCrashTimestamps: number[]
}

const DEFAULT_STATE: PluginRuntimeStateSnapshot = {
	enabled: true,
	quarantined: false,
	quarantineDetail: null,
	uiCrashCount: 0,
}

export function createFileLifecycleStateIo(filePath: string): PluginLifecycleStateIo {
	return {
		read: () => {
			try {
				if (!fs.existsSync(filePath)) return null
				return fs.readFileSync(filePath, "utf8")
			} catch (err) {
				log.warn("Failed to read plugin lifecycle state file", {
					filePath,
					error: err instanceof Error ? err.message : String(err),
				})
				return null
			}
		},
		write: (content) => {
			const dir = path.dirname(filePath)
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
			const tmpPath = `${filePath}.tmp`
			fs.writeFileSync(tmpPath, content, "utf8")
			fs.renameSync(tmpPath, filePath)
		},
	}
}

export function createPluginLifecycleStateStore(input: {
	io: PluginLifecycleStateIo
	now?: () => number
}): PluginLifecycleStateStore {
	const now = input.now ?? (() => Date.now())
	const states = new Map<string, MutableState>()
	const listeners = new Set<() => void>()

	// Load persisted state once at construction. A corrupt file is
	// logged loudly and treated as empty — losing enable overrides is
	// recoverable; blocking boot on a bad JSON file is not.
	const raw = input.io.read()
	if (raw !== null) {
		try {
			const parsed = persistedFileSchema.parse(JSON.parse(raw))
			for (const [pluginId, state] of Object.entries(parsed)) {
				states.set(pluginId, {
					enabled: state.enabled,
					quarantined: state.quarantined,
					quarantineDetail: state.quarantineDetail,
					uiCrashTimestamps: [],
				})
			}
		} catch (err) {
			log.error("Plugin lifecycle state file is corrupt; starting from defaults", {
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	function persist(): void {
		const payload: Record<string, z.infer<typeof persistedPluginStateSchema>> = {}
		for (const [pluginId, state] of states) {
			if (state.enabled && !state.quarantined) continue
			payload[pluginId] = {
				enabled: state.enabled,
				quarantined: state.quarantined,
				quarantineDetail: state.quarantineDetail,
			}
		}
		try {
			input.io.write(JSON.stringify(payload, null, "\t"))
		} catch (err) {
			log.error("Failed to persist plugin lifecycle state", {
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	function notify(): void {
		for (const listener of listeners) {
			try {
				listener()
			} catch (err) {
				log.error("Plugin lifecycle listener error", {
					error: err instanceof Error ? err.message : String(err),
				})
			}
		}
	}

	function mutable(pluginId: string): MutableState {
		const existing = states.get(pluginId)
		if (existing) return existing
		const fresh: MutableState = {
			enabled: true,
			quarantined: false,
			quarantineDetail: null,
			uiCrashTimestamps: [],
		}
		states.set(pluginId, fresh)
		return fresh
	}

	function snapshot(state: MutableState | undefined): PluginRuntimeStateSnapshot {
		if (!state) return DEFAULT_STATE
		return {
			enabled: state.enabled,
			quarantined: state.quarantined,
			quarantineDetail: state.quarantineDetail,
			uiCrashCount: state.uiCrashTimestamps.length,
		}
	}

	return {
		get(pluginId) {
			return snapshot(states.get(pluginId))
		},

		listOverridden() {
			const result: Record<string, PluginRuntimeStateSnapshot> = {}
			for (const [pluginId, state] of states) {
				if (state.enabled && !state.quarantined) continue
				result[pluginId] = snapshot(state)
			}
			return result
		},

		setEnabled(pluginId, enabled) {
			const state = mutable(pluginId)
			state.enabled = enabled
			persist()
			notify()
			log.info("Plugin enabled state changed", { pluginId, enabled })
			return snapshot(state)
		},

		reportUiCrash(pluginId, message, options) {
			const threshold = options?.threshold ?? DEFAULT_CRASH_WINDOW_POLICY.runtimeCrashThreshold
			const windowMs = options?.windowMs ?? DEFAULT_CRASH_WINDOW_POLICY.windowMs
			const state = mutable(pluginId)
			const nowMs = now()
			state.uiCrashTimestamps = state.uiCrashTimestamps.filter((t) => nowMs - t <= windowMs)
			state.uiCrashTimestamps.push(nowMs)
			log.warn("Plugin panel UI crash reported", {
				pluginId,
				message,
				crashCount: state.uiCrashTimestamps.length,
				threshold,
			})
			if (!state.quarantined && state.uiCrashTimestamps.length >= threshold) {
				state.quarantined = true
				state.quarantineDetail = `${state.uiCrashTimestamps.length} renderer panel crashes within ${windowMs}ms; last: ${message}`
				log.warn("Plugin quarantined by UI crash policy", { pluginId })
				persist()
			}
			notify()
			return snapshot(state)
		},

		releaseQuarantine(pluginId, note) {
			const state = mutable(pluginId)
			state.quarantined = false
			state.quarantineDetail = null
			state.uiCrashTimestamps = []
			persist()
			notify()
			log.info("Plugin quarantine released", { pluginId, note })
			return snapshot(state)
		},

		subscribe(listener) {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
	}
}
