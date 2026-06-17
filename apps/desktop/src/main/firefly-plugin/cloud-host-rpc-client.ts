/**
 * Firefly Plugin System V2 — firefly-cloud RPC client (P3f, design §2.4)
 *
 * The web build has no local Electron main process; its `HostAuthority` is
 * fulfilled remotely by firefly-cloud over HTTP/WS RPC. This is the typed
 * client skeleton for that transport.
 *
 * CROSS-REPO: the firefly-cloud *server* (the gallery, publish API, and the
 * remote extension host that answers these RPCs) lives in the `firefly-cloud`
 * repo and CANNOT land from palot. This client is the palot-side half; until the
 * server endpoints exist and `FIREFLY_CLOUD_URL` is configured, calls fail fast
 * with a typed, named error — never a silent fallback (CH5 #9).
 *
 * NOTE (D-P2): `fetchProjectionSnapshot` and `subscribeProjection` are the
 * projection-channel methods. The named method strings ("projectionSnapshot")
 * are authored in `host-authority.ts CloudHostAuthority` (§6.1 SSOT), which
 * delegates here as a generic transport. The live push transport (WebSocket
 * via WsGatewayDO) is wired in D-C5; `subscribeProjection` is the shape-stub.
 */

export class CloudHostNotConfiguredError extends Error {
	readonly missing: string
	constructor(missing: string) {
		super(
			`firefly-cloud host is not configured: missing ${missing}. ` +
				`Set it to point the web build at a firefly-cloud deployment (cross-repo dependency).`,
		)
		this.name = "CloudHostNotConfiguredError"
		this.missing = missing
	}
}

export class CloudHostRpcError extends Error {
	readonly status: number
	constructor(method: string, status: number, detail: string) {
		super(`firefly-cloud RPC "${method}" failed (${status}): ${detail}`)
		this.name = "CloudHostRpcError"
		this.status = status
	}
}

export interface CloudHostConfig {
	readonly baseUrl: string
	readonly token: string | null
}

/**
 * Resolve firefly-cloud config from the environment. Returns null when the base
 * URL is absent — the caller fails fast rather than guessing a default host.
 */
export function resolveCloudHostConfig(env: Record<string, string | undefined> = process.env): CloudHostConfig | null {
	const baseUrl = env.FIREFLY_CLOUD_URL?.trim()
	if (!baseUrl) return null
	return { baseUrl: baseUrl.replace(/\/$/u, ""), token: env.FIREFLY_CLOUD_TOKEN?.trim() || null }
}

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
	ok: boolean
	status: number
	json(): Promise<unknown>
	text(): Promise<string>
}>

// Import for local use in this file's own signatures.
import type { CatalogProjectionSnapshot } from "../../shared/firefly-plugin/host-authority-types"
// Re-export the shared CatalogProjectionSnapshot so importers of this module
// (including the test file) can reference it without touching the shared path.
export type { CatalogProjectionSnapshot } from "../../shared/firefly-plugin/host-authority-types"

export interface CloudHostRpcClient {
	call<T>(method: string, params: Record<string, unknown>): Promise<T>
	readonly configured: boolean
	/**
	 * Fetch the current catalog-projection snapshot from firefly-cloud.
	 * Delegates to `call("projectionSnapshot", { sinceRevision })`.
	 *
	 * The method name "projectionSnapshot" is the canonical wire name; it is
	 * authored in `host-authority.ts CloudHostAuthority` (§6.1 SSOT) and
	 * reproduced here for the convenience wrapper only.
	 *
	 * Throws `CloudHostNotConfiguredError` when `FIREFLY_CLOUD_URL` is absent.
	 */
	fetchProjectionSnapshot(sinceRevision?: number): Promise<CatalogProjectionSnapshot>
	/**
	 * Subscribe to push-delivered projection snapshots from firefly-cloud.
	 *
	 * Returns an unsubscribe function. The subscriber is called with each new
	 * `CatalogProjectionSnapshot` as the catalog changes server-side.
	 *
	 * ⚠ STUB (D-P2): the shape and fail-fast guard are in place; the live
	 * push transport (WebSocket via WsGatewayDO) is wired in D-C5. Until then,
	 * the subscriber is registered but never invoked automatically — callers
	 * must fall back to polling `fetchProjectionSnapshot` for now.
	 *
	 * Throws `CloudHostNotConfiguredError` when `FIREFLY_CLOUD_URL` is absent
	 * (fail-fast: better to surface misconfiguration immediately than silently
	 * receive no updates).
	 */
	subscribeProjection(onSnapshot: (snapshot: CatalogProjectionSnapshot) => void): () => void
}

/**
 * Build an RPC client. `config` null ⇒ unconfigured: every `call` throws
 * `CloudHostNotConfiguredError`. `fetchFn` is injectable for tests.
 */
export function createCloudHostRpcClient(deps: {
	config: CloudHostConfig | null
	fetchFn?: FetchFn
}): CloudHostRpcClient {
	const fetchFn = deps.fetchFn ?? ((globalThis as { fetch?: FetchFn }).fetch as FetchFn | undefined)

	const client: CloudHostRpcClient = {
		configured: deps.config !== null,
		async call<T>(method: string, params: Record<string, unknown>): Promise<T> {
			if (!deps.config) {
				throw new CloudHostNotConfiguredError("FIREFLY_CLOUD_URL")
			}
			if (!fetchFn) {
				throw new CloudHostNotConfiguredError("a fetch implementation")
			}
			const headers: Record<string, string> = { "content-type": "application/json" }
			if (deps.config.token) headers.authorization = `Bearer ${deps.config.token}`
			const res = await fetchFn(`${deps.config.baseUrl}/firefly-plugin/rpc`, {
				method: "POST",
				headers,
				body: JSON.stringify({ method, params }),
			})
			if (!res.ok) {
				throw new CloudHostRpcError(method, res.status, await res.text().catch(() => "no body"))
			}
			return (await res.json()) as T
		},

		async fetchProjectionSnapshot(sinceRevision?: number): Promise<CatalogProjectionSnapshot> {
			const params: Record<string, unknown> = {}
			if (sinceRevision !== undefined) params.sinceRevision = sinceRevision
			return client.call<CatalogProjectionSnapshot>("projectionSnapshot", params)
		},

		subscribeProjection(onSnapshot: (snapshot: CatalogProjectionSnapshot) => void): () => void {
			if (!deps.config) {
				throw new CloudHostNotConfiguredError("FIREFLY_CLOUD_URL")
			}
			// STUB (D-P2): the subscriber registration shape is in place.
			// The live push transport (WebSocket via WsGatewayDO) is wired in D-C5.
			// Until D-C5 lands, callers should poll `fetchProjectionSnapshot` for
			// updates; the returned unsubscribe fn is a no-op.
			void onSnapshot // referenced to satisfy the type; live transport wires it in D-C5
			return () => {
				// no-op until D-C5 wires the WebSocket push channel
			}
		},
	}
	return client
}
