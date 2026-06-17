/**
 * Firefly Plugin System V2 — hot-reload executor (runtime tier)
 *
 * Consumes the locked hot-reload FSM contract
 * (`shared/firefly-plugin/hot-reload.ts`) and actually runs a reload
 * cycle against the live runtime. The contract module is pure (it
 * decides the policy + phase sequence); THIS module performs the side
 * effects the plan's §8 table prescribes:
 *
 *   | event kind            | policy   | effect                                  |
 *   |-----------------------|----------|-----------------------------------------|
 *   | contribution-changed  | project  | refresh catalog + broadcast (reproject) |
 *   | config-changed        | soft     | refresh catalog + broadcast (reproject) |
 *   | worker-code-changed   | restart  | restart the worker, then refresh+broadcast |
 *   | manifest-changed      | restart  | restart the worker, then refresh+broadcast |
 *
 * Fail loud (CH5 anti-S8): a failed cycle never serves a stale
 * projection silently. The executor records a `reload-required` signal
 * (named, queryable) and re-throws-as-result so the caller/operator
 * surface can offer a full restart. Module-cache hacks are forbidden by
 * the contract; a worker code change is a real worker restart.
 *
 * Testable by construction: the supervisor, catalog refresh, and
 * broadcaster are all injected.
 */

import {
	HOT_RELOAD_KIND_POLICY,
	planHotReloadCycle,
	type HotReloadCyclePlan,
	type HotReloadEvent,
} from "../../shared/firefly-plugin/hot-reload"
import type { CatalogBroadcaster } from "./catalog-broadcast"
import { restartSupervisedWorker } from "./supervisor-apply"
import type { PluginWorkerSupervisor } from "./worker-supervisor"

export interface HotReloadExecutorDeps {
	/** The booted worker supervisor (null before boot ⇒ restart is a no-op). */
	readonly supervisor: PluginWorkerSupervisor | null
	/** Re-derive the catalog projection from disk. */
	readonly refreshCatalog: () => void
	/** Publish `firefly-plugin:changed` to renderers. */
	readonly broadcast: CatalogBroadcaster
	/** Mode gates the FSM dev/production policy. Defaults to "dev". */
	readonly mode?: "dev" | "production"
	/** Logger seam (defaults to no-op so the executor loads in bun tests). */
	readonly log?: HotReloadExecutorLogger
}

export interface HotReloadExecutorLogger {
	info(message: string, meta?: Record<string, unknown>): void
	warn(message: string, meta?: Record<string, unknown>): void
	error(message: string, meta?: Record<string, unknown>): void
}

const noopLogger: HotReloadExecutorLogger = {
	info: () => undefined,
	warn: () => undefined,
	error: () => undefined,
}

/** A named reload-required signal — the fail-loud surface, never silent. */
export interface ReloadRequiredSignal {
	readonly pluginId: string
	readonly reason: string
	readonly observedAt: number
}

export interface HotReloadCycleResult {
	readonly pluginId: string
	readonly plan: HotReloadCyclePlan
	readonly outcome: "ready" | "failed"
	/** True when the cycle restarted a real worker (vs reproject-only). */
	readonly restartedWorker: boolean
	/** Present only when `outcome === "failed"`. */
	readonly reloadRequired: ReloadRequiredSignal | null
}

export interface HotReloadExecutor {
	/** Run one reload cycle for a watcher event. Never throws; failures
	 *  surface as `outcome: "failed"` + a reload-required signal. */
	execute(event: HotReloadEvent): HotReloadCycleResult
	/** Plugins currently flagged reload-required (failed cycle, not yet cleared). */
	listReloadRequired(): readonly ReloadRequiredSignal[]
	/** Clear the reload-required flag for a plugin (e.g. after a manual restart). */
	clearReloadRequired(pluginId: string): void
}

export function createHotReloadExecutor(deps: HotReloadExecutorDeps): HotReloadExecutor {
	const log = deps.log ?? noopLogger
	const mode = deps.mode ?? "dev"
	const reloadRequired = new Map<string, ReloadRequiredSignal>()

	function flagReloadRequired(pluginId: string, reason: string): ReloadRequiredSignal {
		const signal: ReloadRequiredSignal = { pluginId, reason, observedAt: Date.now() }
		reloadRequired.set(pluginId, signal)
		// Fail loud: this is the named, queryable surface — not a silent stale serve.
		log.error("Hot-reload cycle failed; plugin reload-required", { ...signal })
		return signal
	}

	function execute(event: HotReloadEvent): HotReloadCycleResult {
		const policy = HOT_RELOAD_KIND_POLICY[event.kind]
		const plan = planHotReloadCycle({ pluginId: event.pluginId, event, mode })
		log.info("Hot-reload cycle starting", {
			pluginId: event.pluginId,
			kind: event.kind,
			policy,
			source: event.source,
		})

		let restartedWorker = false
		try {
			if (policy === "restart") {
				// worker-code-changed / manifest-changed: a real process restart
				// (module-cache invalidation is forbidden by the contract). Tear
				// the worker down and re-activate it fresh.
				const result = restartSupervisedWorker(deps.supervisor, event.pluginId)
				restartedWorker = result.supervised
			}
			// All policies reproject: re-derive the catalog from disk and tell
			// renderers + OpenCode projections to re-read TOGETHER (no surface
			// sees a half-applied reload).
			deps.refreshCatalog()
			deps.broadcast(`hot-reload:${event.kind}`)
			reloadRequired.delete(event.pluginId)
			log.info("Hot-reload cycle ready", {
				pluginId: event.pluginId,
				policy,
				restartedWorker,
			})
			return {
				pluginId: event.pluginId,
				plan,
				outcome: "ready",
				restartedWorker,
				reloadRequired: null,
			}
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err)
			const signal = flagReloadRequired(event.pluginId, reason)
			return {
				pluginId: event.pluginId,
				plan,
				outcome: "failed",
				restartedWorker,
				reloadRequired: signal,
			}
		}
	}

	return {
		execute,
		listReloadRequired: () => [...reloadRequired.values()],
		clearReloadRequired: (pluginId) => {
			reloadRequired.delete(pluginId)
		},
	}
}
