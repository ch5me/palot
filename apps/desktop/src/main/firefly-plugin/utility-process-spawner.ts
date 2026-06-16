/**
 * Firefly Plugin System V2 — Electron utilityProcess spawner
 *
 * The `electron-utility` runtime location (design §2.3 matrix): runs each
 * plugin worker in an Electron `utilityProcess` — a real sandboxed child
 * process with access to Node APIs. The supervisor owns lifecycle; this
 * module only adapts the utilityProcess API to the `PluginWorkerHandle`
 * contract.
 *
 * `electron` is NOT imported at the module top level — doing so would make
 * this module un-importable outside the Electron main process (e.g. the bun
 * test runner). Instead, the default `forkUtilityProcess` implementation
 * lazily `require`s electron at call time. Pass a custom `forkUtilityProcess`
 * in `UtilityProcessSpawnerOptions` to test without electron.
 */

import type { PluginWorkerHandle, SpawnPluginWorker } from "./worker-supervisor"

// ---------------------------------------------------------------------------
// Structural interface for the child process returned by utilityProcess.fork
// ---------------------------------------------------------------------------

/**
 * The subset of `Electron.UtilityProcess` that this spawner uses.
 * Exported so tests can implement a fake without importing electron.
 */
export interface UtilityChildProcess {
	postMessage(message: unknown): void
	kill(): boolean
	on(event: "message", listener: (message: unknown) => void): void
	on(event: "exit", listener: (code: number | null) => void): void
	on(event: "spawn", listener: () => void): void
}

// ---------------------------------------------------------------------------
// Injected fork function type
// ---------------------------------------------------------------------------

type ForkUtilityProcess = (
	entryPath: string,
	args: string[],
	opts: {
		serviceName?: string
		env?: Record<string, string | undefined>
		execArgv?: string[]
	},
) => UtilityChildProcess

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UtilityProcessSpawnerOptions {
	/**
	 * Override the fork implementation. Defaults to a lazy `require("electron")`
	 * call so this module can be imported safely in non-Electron environments.
	 * Tests MUST supply a fake here — never let the default run in bun.
	 */
	readonly forkUtilityProcess?: ForkUtilityProcess
	/** Cap the plugin worker's V8 heap (--max-old-space-size). */
	readonly maxOldGenerationSizeMb?: number
	/**
	 * Prefix for the utilityProcess `serviceName`. The plugin id is appended
	 * after a `-`. Defaults to `"firefly-plugin"`.
	 */
	readonly serviceNamePrefix?: string
}

// ---------------------------------------------------------------------------
// Default fork: lazy require so the module is safe outside Electron
// ---------------------------------------------------------------------------

function defaultFork(
	entryPath: string,
	args: string[],
	opts: {
		serviceName?: string
		env?: Record<string, string | undefined>
		execArgv?: string[]
	},
): UtilityChildProcess {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const electron = require("electron") as typeof import("electron")
	return electron.utilityProcess.fork(entryPath, args, opts) as unknown as UtilityChildProcess
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a `SpawnPluginWorker` that launches each plugin worker inside an
 * Electron `utilityProcess` (design §2.3 `electron-utility` location).
 *
 * The pluginId is passed to the worker both as `argv[0]` and the
 * `FIREFLY_PLUGIN_ID` environment variable so the worker can identify itself
 * regardless of how it reads its configuration.
 *
 * Error handling: `utilityProcess` has no `"error"` event — failures surface
 * as a non-zero exit code on the `"exit"` event (handled by `onExit`) or as a
 * synchronous throw from `fork()` (caught by the supervisor's spawn
 * try/catch). `onError` listeners are stored but never called from this
 * adaptor; the supervisor wires `onError` but will receive errors via `onExit`
 * and the fork-level throw path instead.
 */
export function createUtilityProcessSpawner(
	options: UtilityProcessSpawnerOptions = {},
): SpawnPluginWorker {
	const fork = options.forkUtilityProcess ?? defaultFork
	const maxOldGenerationSizeMb = options.maxOldGenerationSizeMb
	const serviceNamePrefix = options.serviceNamePrefix ?? "firefly-plugin"

	return ({ pluginId, entryPath }): PluginWorkerHandle => {
		const serviceName = `${serviceNamePrefix}-${pluginId}`
		const execArgv = maxOldGenerationSizeMb
			? [`--max-old-space-size=${maxOldGenerationSizeMb}`]
			: []

		const child = fork(entryPath, [pluginId], {
			serviceName,
			env: {
				...process.env,
				FIREFLY_PLUGIN_ID: pluginId,
			},
			execArgv,
		})

		return {
			postMessage: (message) => child.postMessage(message),
			terminate: () => child.kill(),
			onMessage: (listener) => {
				child.on("message", listener)
			},
			onExit: (listener) => {
				child.on("exit", (code) => listener(code))
			},
			onError: (_listener) => {
				// utilityProcess surfaces failures through non-zero "exit" codes
				// and synchronous fork() throws — there is no "error" event.
				// This method is a no-op: the supervisor will receive errors via
				// onExit (non-zero code) and the fork() try/catch path instead.
			},
		}
	}
}
