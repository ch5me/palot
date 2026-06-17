/**
 * Firefly Plugin System V2 — supervisor enable/disable bridge
 *
 * The operator enable/disable IPC and the dev hot-reload executor both
 * need to push a runtime-state change into the worker supervisor. This
 * module owns that bridge so the "surface-only plugin has no worker"
 * case is handled in exactly one place.
 *
 * Graceful no-op contract (plan §2.3 / §8): a plugin with no worker
 * entry is panel/command/tool-only — the supervisor has no registration
 * for it. Toggling such a plugin is a renderer-only concern; the
 * supervisor call MUST be a safe no-op (no registration ⇒ nothing to
 * start/stop), never a throw. We detect "registered" via `getSummary`
 * (null when absent) so we never rely on catching `UnknownPluginError`.
 */

import type { PluginWorkerSupervisor } from "./worker-supervisor"
import type { PluginSupervisionSummary } from "../../shared/firefly-plugin/runtime-supervision"

export interface SupervisorEnableResult {
	/** True when the plugin had a worker registration the call acted on. */
	readonly supervised: boolean
	/** The post-call supervision summary, or null for surface-only plugins. */
	readonly summary: PluginSupervisionSummary | null
}

/**
 * Apply an enable/disable to the worker supervisor for one plugin.
 *
 * - `supervisor` null (supervisor not booted yet, e.g. before app ready
 *   or in a renderer-only test) ⇒ no-op, `supervised: false`.
 * - plugin not registered (surface-only, no worker entry) ⇒ no-op,
 *   `supervised: false`. Never throws.
 * - registered ⇒ calls `enable`/`disable` and returns the summary.
 */
export function applyEnabledToSupervisor(
	supervisor: PluginWorkerSupervisor | null,
	pluginId: string,
	enabled: boolean,
): SupervisorEnableResult {
	if (!supervisor) return { supervised: false, summary: null }
	// Absent summary == no worker registration: surface-only plugin.
	if (!supervisor.getSummary(pluginId)) {
		return { supervised: false, summary: null }
	}
	const summary = enabled ? supervisor.enable(pluginId) : supervisor.disable(pluginId)
	return { supervised: true, summary }
}

/**
 * Restart a plugin's worker for a hot-reload `restart` cycle: disable
 * (tear the worker down) then enable (re-activate fresh). Surface-only
 * plugins are a safe no-op, same contract as {@link applyEnabledToSupervisor}.
 */
export function restartSupervisedWorker(
	supervisor: PluginWorkerSupervisor | null,
	pluginId: string,
): SupervisorEnableResult {
	if (!supervisor) return { supervised: false, summary: null }
	if (!supervisor.getSummary(pluginId)) {
		return { supervised: false, summary: null }
	}
	supervisor.disable(pluginId)
	const summary = supervisor.enable(pluginId)
	return { supervised: true, summary }
}
