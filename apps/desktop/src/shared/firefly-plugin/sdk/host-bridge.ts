/**
 * Firefly Plugin SDK — worker-side host bridge.
 *
 * Promise-correlated RPC over an injected message port. Mirrors the host's
 * `worker-request-handler.ts` from the worker side. NO `electron`,
 * NO `worker_threads` imports — the port is injected so this module is
 * reusable on any transport (node-worker, cloud-host WebSocket, tests).
 *
 * `requestId` uses a monotonic counter (NOT Math.random or
 * crypto.randomUUID) for predictability in restricted sandboxes.
 */

import type { ExtensionCapabilities, ExtensionStorage } from "./index"
import type { StorageRequest, StorageResponse } from "../extension-host-protocol"

// ---------------------------------------------------------------------------
// Port interface — injected, never imported directly
// ---------------------------------------------------------------------------

export interface WorkerPort {
	/** Post a raw message to the host. */
	post(message: unknown): void
	/**
	 * Register a message listener. Returns an unsubscribe function.
	 * Each incoming message is the raw value (already parsed by the caller or
	 * used raw here — we look for our request ids).
	 */
	onMessage(listener: (raw: unknown) => void): () => void
}

// ---------------------------------------------------------------------------
// Internal RPC machinery
// ---------------------------------------------------------------------------

let _idCounter = 0
function nextRequestId(): string {
	_idCounter += 1
	return String(_idCounter)
}

type PendingResolve = (value: unknown) => void
type PendingReject = (err: unknown) => void

interface Pending {
	resolve: PendingResolve
	reject: PendingReject
}

/** Shared pending-request map, keyed by requestId. */
const pending = new Map<string, Pending>()

/**
 * Dispatch an incoming raw message to any waiting RPC promise.
 * The caller (extension-worker-runtime) pipes every inbound message here
 * so storage/capability responses resolve their pending promises.
 */
export function dispatchHostResponse(raw: unknown): void {
	if (raw === null || typeof raw !== "object") return
	const msg = raw as Record<string, unknown>
	const type = msg["type"]
	const requestId = msg["requestId"]
	if (typeof requestId !== "string") return
	const entry = pending.get(requestId)
	if (!entry) return

	if (type === "storage-response" || type === "capability-response") {
		pending.delete(requestId)
		entry.resolve(msg)
	}
}

// ---------------------------------------------------------------------------
// Storage bridge
// ---------------------------------------------------------------------------

function postStorageRequest(port: WorkerPort, requestId: string, request: StorageRequest): void {
	port.post({ type: "storage-request", requestId, request })
}

async function rpcStorage(port: WorkerPort, request: StorageRequest): Promise<StorageResponse> {
	const requestId = nextRequestId()
	return new Promise<StorageResponse>((resolve, reject) => {
		pending.set(requestId, {
			resolve: (msg) => {
				const envelope = msg as { type: string; requestId: string; response: StorageResponse }
				resolve(envelope.response)
			},
			reject,
		})
		postStorageRequest(port, requestId, request)
	})
}

export function createStorageBridge(port: WorkerPort): ExtensionStorage {
	return {
		async get(key: string): Promise<unknown> {
			const resp = await rpcStorage(port, { op: "get", scope: "app", key })
			if (!resp.ok) throw Object.assign(new Error(resp.errorMessage), { code: resp.errorCode })
			return resp.value
		},

		async set(key: string, value: unknown): Promise<void> {
			const resp = await rpcStorage(port, { op: "set", scope: "app", key, value })
			if (!resp.ok) throw Object.assign(new Error(resp.errorMessage), { code: resp.errorCode })
		},

		async delete(key: string): Promise<void> {
			const resp = await rpcStorage(port, { op: "delete", scope: "app", key })
			if (!resp.ok) throw Object.assign(new Error(resp.errorMessage), { code: resp.errorCode })
		},

		async list(): Promise<readonly string[]> {
			const resp = await rpcStorage(port, { op: "list", scope: "app" })
			if (!resp.ok) throw Object.assign(new Error(resp.errorMessage), { code: resp.errorCode })
			return resp.keys ?? []
		},
	}
}

// ---------------------------------------------------------------------------
// Capability bridge
// ---------------------------------------------------------------------------

export function createCapabilitiesBridge(port: WorkerPort): ExtensionCapabilities {
	return {
		async request(capability: string): Promise<{ granted: boolean; reason: string }> {
			const requestId = nextRequestId()
			return new Promise<{ granted: boolean; reason: string }>((resolve, reject) => {
				pending.set(requestId, {
					resolve: (msg) => {
						const envelope = msg as { granted: boolean; reason: string }
						resolve({ granted: envelope.granted, reason: envelope.reason ?? "" })
					},
					reject,
				})
				port.post({ type: "capability-request", requestId, capability, reason: "" })
			})
		},
	}
}
