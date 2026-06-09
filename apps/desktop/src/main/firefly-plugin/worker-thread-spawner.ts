/**
 * Firefly Plugin System V2 — node:worker_threads spawner
 *
 * The production `SpawnPluginWorker` implementation: one
 * `worker_thread` per active plugin, exactly the containment grade the
 * plan's §2.1 process tier specifies. The supervisor owns lifecycle;
 * this module only adapts the worker_threads API to the
 * `PluginWorkerHandle` contract.
 *
 * Works in any Node-compatible host process: Electron main, the
 * utilityProcess plugin host, and the bun test runner (integration
 * drills spawn real workers through this exact code path).
 */

import { Worker } from "node:worker_threads"

import type { PluginWorkerHandle, SpawnPluginWorker } from "./worker-supervisor"

export interface WorkerThreadSpawnerOptions {
	/** Extra worker data merged into `{ pluginId }`. */
	readonly workerData?: Record<string, unknown>
	/** Cap worker heap so a leaking plugin OOMs itself, not the host. */
	readonly maxOldGenerationSizeMb?: number
}

export function createWorkerThreadSpawner(
	options: WorkerThreadSpawnerOptions = {},
): SpawnPluginWorker {
	return ({ pluginId, entryPath }): PluginWorkerHandle => {
		const worker = new Worker(entryPath, {
			workerData: { pluginId, ...options.workerData },
			resourceLimits: options.maxOldGenerationSizeMb
				? { maxOldGenerationSizeMb: options.maxOldGenerationSizeMb }
				: undefined,
		})
		return {
			postMessage: (message) => worker.postMessage(message),
			terminate: () => worker.terminate(),
			onMessage: (listener) => {
				worker.on("message", listener)
			},
			onExit: (listener) => {
				worker.on("exit", (code) => listener(code))
			},
			onError: (listener) => {
				worker.on("error", listener)
			},
		}
	}
}
