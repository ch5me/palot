/**
 * Firefly Plugin System V2 — worker→host request router (P3 last-mile)
 *
 * Services the non-lifecycle arms of the extension-host protocol that a plugin
 * worker sends: storage-request (→ plugin storage service) and
 * capability-request (→ grant store). Returns the typed reply the supervisor
 * posts back to the worker. Pure aside from the injected services, so it is
 * unit-testable without a live worker.
 *
 * The supervisor stays generic — it knows only the protocol, not the storage
 * service or grant store; this module is the seam that wires them in.
 */

import type {
	HostToWorkerMessage,
	StorageRequest,
	StorageResponse,
	WorkerToHostMessage,
} from "../../shared/firefly-plugin/extension-host-protocol"
import type { StorageScope } from "../../shared/firefly-plugin/storage-scopes"
import { ensureDb } from "../automation/database"
import { createGrantStore, type GrantStore } from "./grant-store"
import { createPluginStorageService, type IPluginStorageService } from "./plugin-storage-service"

export interface WorkerRequestHandlerDeps {
	storage: IPluginStorageService
	grants: GrantStore
	/**
	 * Resolve the concrete scope id for a storage request. The worker protocol
	 * carries `scope` but not `scopeId` — the host supplies it from its context.
	 * Default: `app` → "app"; session/project → "<scope>-default" until a live
	 * session/project binding threads through (documented limitation).
	 */
	resolveScopeId?: (input: { pluginId: string; scope: StorageScope }) => string
}

export type WorkerRequestHandler = (input: {
	pluginId: string
	message: WorkerToHostMessage
}) => Promise<HostToWorkerMessage | null>

export function createWorkerRequestHandler(deps: WorkerRequestHandlerDeps): WorkerRequestHandler {
	const resolveScopeId =
		deps.resolveScopeId ?? (({ scope }) => (scope === "app" ? "app" : `${scope}-default`))

	async function handleStorage(pluginId: string, req: StorageRequest): Promise<StorageResponse> {
		try {
			const scopeId = resolveScopeId({ pluginId, scope: req.scope })
			switch (req.op) {
				case "get":
					return { ok: true, value: await deps.storage.get({ pluginId, scope: req.scope, scopeId, key: req.key }) }
				case "set":
					await deps.storage.set({ pluginId, scope: req.scope, scopeId, key: req.key, value: req.value })
					return { ok: true }
				case "delete":
					await deps.storage.delete({ pluginId, scope: req.scope, scopeId, key: req.key })
					return { ok: true }
				case "list":
					return { ok: true, keys: await deps.storage.list({ pluginId, scope: req.scope, scopeId }) }
			}
		} catch (err) {
			const code = (err as { code?: string }).code ?? "storage_error"
			return { ok: false, errorCode: code, errorMessage: err instanceof Error ? err.message : String(err) }
		}
	}

	return async ({ pluginId, message }) => {
		switch (message.type) {
			case "storage-request":
				return {
					type: "storage-response",
					requestId: message.requestId,
					response: await handleStorage(pluginId, message.request),
				}
			case "capability-request": {
				// Runtime grant check: granted only if a persisted grant exists for
				// this capability in the active scope (deny-by-default).
				const granted = (await deps.grants.resolveGrantedTokens({ pluginId, scope: "session" })).includes(
					message.capability,
				)
				return {
					type: "capability-response",
					requestId: message.requestId,
					granted,
					reason: granted ? "granted" : "capability not granted (deny-by-default)",
				}
			}
			default:
				// invoke-result and lifecycle arms are handled by the supervisor.
				return null
		}
	}
}

/**
 * Lazily-wired handler for the live app: resolves the DB-backed storage service
 * and grant store on first use and caches them. Used by supervisor-boot so the
 * supervisor never imports the concrete services directly.
 */
export function createBootWorkerRequestHandler(): WorkerRequestHandler {
	let cached: Promise<WorkerRequestHandler> | null = null
	function build(): Promise<WorkerRequestHandler> {
		if (!cached) {
			cached = ensureDb().then((db) =>
				createWorkerRequestHandler({
					storage: createPluginStorageService({ db }),
					grants: createGrantStore({ db }),
				}),
			)
		}
		return cached
	}
	return async (input) => {
		const handler = await build()
		return handler(input)
	}
}
