/**
 * Firefly Plugin System V2 — worker invoke router (B3)
 *
 * Bridges `dispatch.ts` invocations to the live plugin worker managed by the
 * supervisor. The router is intentionally kept as a thin injectable seam so
 * dispatch stays testable without a real supervisor in scope.
 *
 * Ordering contract (design §3 Stream B, §5):
 *   dispatch.ts → broker check (deny-by-default) → isWorkerBacked? →
 *     yes → router.invoke → supervisor.sendInvoke → worker round-trip
 *     no  → in-process handler (built-ins, unchanged)
 *
 * The default export state (no router set) returns `isWorkerBacked=false` so
 * all dispatch falls through to the existing in-process handlers until a real
 * supervisor is wired at boot.
 */

import { createLogger } from "../logger"

const log = createLogger("firefly-plugin/worker-invoke-router")

// ---------------------------------------------------------------------------
// Public contract
// ---------------------------------------------------------------------------

export type WorkerInvokeKind = "command" | "tool"

export interface WorkerInvokeInput {
	readonly pluginId: string
	readonly kind: WorkerInvokeKind
	readonly targetId: string
	readonly args: Record<string, unknown>
	readonly sessionId: string | null
	readonly timeoutMs?: number
}

export type WorkerInvokeResult =
	| { readonly ok: true; readonly data: unknown }
	| { readonly ok: false; readonly errorCode: string; readonly errorMessage: string }

export interface WorkerInvokeRouter {
	/** Returns true iff the plugin's runtime location is `electron-utility`
	 *  AND its supervisor state is `active`. */
	isWorkerBacked(pluginId: string): boolean
	/** Dispatch an invoke to the live worker and await the result. */
	invoke(input: WorkerInvokeInput): Promise<WorkerInvokeResult>
}

// ---------------------------------------------------------------------------
// Module-level singleton (injectable for tests)
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 30_000

/** Null-object router: all plugins are in-process until a real router is set. */
const nullRouter: WorkerInvokeRouter = {
	isWorkerBacked: () => false,
	invoke: () =>
		Promise.resolve({
			ok: false,
			errorCode: "router_not_configured",
			errorMessage: "No worker invoke router is configured",
		}),
}

let activeRouter: WorkerInvokeRouter = nullRouter

/** Install the live router (called at boot once the supervisor is ready). */
export function setWorkerInvokeRouter(router: WorkerInvokeRouter): void {
	activeRouter = router
}

/** Retrieve the current router (called by dispatch.ts on every invocation). */
export function getWorkerInvokeRouter(): WorkerInvokeRouter {
	return activeRouter
}

/** Reset to the null router — test isolation only. */
export function _resetWorkerInvokeRouterForTests(): void {
	activeRouter = nullRouter
}

// ---------------------------------------------------------------------------
// Factory: build the live router from the supervisor
// ---------------------------------------------------------------------------

/**
 * Minimal supervisor surface that the router needs.
 * `PluginWorkerSupervisor` satisfies this; tests pass a fake.
 */
export interface WorkerInvokeRouterSupervisor {
	getSummary(pluginId: string): { state: string } | null
	sendInvoke(
		pluginId: string,
		input: {
			kind: WorkerInvokeKind
			targetId: string
			args: Record<string, unknown>
			sessionId: string | null
			timeoutMs: number
		},
	): Promise<WorkerInvokeResult>
}

/**
 * Minimal catalog surface that the router needs.
 * `PluginCatalog` satisfies this; tests pass a fake.
 */
export interface WorkerInvokeRouterCatalog {
	descriptors: ReadonlyArray<{
		normalizedId: string
		runtimeResolution: { supported: boolean; location?: string }
	}>
}

export function createWorkerInvokeRouter(
	supervisor: WorkerInvokeRouterSupervisor,
	getCatalog: () => WorkerInvokeRouterCatalog,
): WorkerInvokeRouter {
	function isWorkerBacked(pluginId: string): boolean {
		const catalog = getCatalog()
		const descriptor = catalog.descriptors.find((d) => d.normalizedId === pluginId)
		if (!descriptor) return false
		if (!descriptor.runtimeResolution.supported) return false
		if (descriptor.runtimeResolution.location !== "electron-utility") return false
		const summary = supervisor.getSummary(pluginId)
		return summary?.state === "active"
	}

	async function invoke(input: WorkerInvokeInput): Promise<WorkerInvokeResult> {
		const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS
		log.debug("Invoking via worker", { pluginId: input.pluginId, kind: input.kind, targetId: input.targetId })
		try {
			return await supervisor.sendInvoke(input.pluginId, {
				kind: input.kind,
				targetId: input.targetId,
				args: input.args,
				sessionId: input.sessionId,
				timeoutMs,
			})
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			log.warn("Worker invoke failed", { pluginId: input.pluginId, error: message })
			return { ok: false, errorCode: "worker_invoke_error", errorMessage: message }
		}
	}

	return { isWorkerBacked, invoke }
}
