/**
 * Type-safe RPC client for the Elf local backend server (Bun + Hono).
 *
 * Uses Hono's RPC client (`hc`) with the server's AppType for end-to-end
 * type safety. The type is resolved from compiled declarations (.d.ts)
 * so the desktop app doesn't need Bun types.
 */

import { createClient } from "@ch5me/elf-server/client"
import {
	Ch5PmAttentionActionError,
	extractAttentionErrorMessage,
} from "../ch5pm-dashboard/attention"

export const ELF_SERVER_BASE_URL = "http://127.0.0.1:30206"
const BASE_URL = ELF_SERVER_BASE_URL
const ACTIVE_SESSION_EVENTS_PATH = "/api/servers/opencode/active-sessions/events"

export interface ActiveOpenCodeSessionPresence {
	sessionId: string
	directory: string
	pid: number
	source: "attach" | "inferred"
	command: string
}

export interface ActiveOpenCodeSessionsSnapshot {
	serverUrl: string
	clientCount: number
	sessionCount: number
	sessions: ActiveOpenCodeSessionPresence[]
	refreshedAt: number
}

export interface ActiveOpenCodeSessionStreamHandlers {
	onError?: (message: string) => void
	onHeartbeat?: () => void
	onOpen?: () => void
	onSnapshot?: (snapshot: ActiveOpenCodeSessionsSnapshot) => void
}

interface ErrorBodyResponse {
	json(): Promise<unknown>
}

/**
 * Pre-typed Hono RPC client.
 * All routes are fully typed — autocomplete on paths, inferred request/response types.
 */
export const client = createClient(BASE_URL)

/**
 * Fetches all running OpenCode servers (detected + managed).
 */
export async function fetchServers() {
	const res = await client.api.servers.$get()
	if (!res.ok) {
		throw new Error(`Server list failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

/**
 * Ensures the single OpenCode server is running and returns its URL.
 * Calls `GET /api/servers/opencode` on the Elf backend.
 */
export async function fetchOpenCodeUrl(): Promise<{ url: string }> {
	const res = await client.api.servers.opencode.$get()
	if (!res.ok) {
		const data = await res.json()
		throw new Error("error" in data ? data.error : "Failed to get OpenCode server URL")
	}
	return res.json()
}

export async function fetchActiveOpenCodeSessions(): Promise<ActiveOpenCodeSessionsSnapshot> {
	const res = await client.api.servers.opencode["active-sessions"].$get()
	if (!res.ok) {
		throw new Error(await readError(res, `Active session presence failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function fetchBrowserLanes() {
	const res = await client.browser.$get()
	if (!res.ok) {
		throw new Error(`Browser lane list failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

export async function createRemoteBrowserLane(input: {
	id: string
	label: string
	streamBackendUrl: string
	cdpEndpoint: string | null
	host?: string | null
	profilePath?: string | null
}) {
	const res = await fetch(`${BASE_URL}/browser`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "create-remote", lane: input }),
	})
	if (!res.ok) {
		throw new Error(`Remote browser lane create failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

export async function ensureBrowserLane(laneId: string) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "ensure" }),
	})
	if (!res.ok) {
		throw new Error(`Browser lane ensure failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

export async function startBrowserLane(laneId: string) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "start" }),
	})
	if (!res.ok) {
		throw new Error(`Browser lane start failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

export async function stopBrowserLane(laneId: string) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "stop" }),
	})
	if (!res.ok) {
		throw new Error(`Browser lane stop failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

export async function restartBrowserLane(laneId: string) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "restart" }),
	})
	if (!res.ok) {
		throw new Error(`Browser lane restart failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

export async function resetBrowserLaneProfile(laneId: string) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "reset-profile" }),
	})
	if (!res.ok) {
		throw new Error(`Browser lane profile reset failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

export async function fetchBrowserLaneHealth(laneId: string) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}/health`)
	if (!res.ok) {
		throw new Error(`Browser lane health failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

export async function navigateBrowserLane(laneId: string, url: string) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "navigate", url }),
	})
	if (!res.ok) {
		throw new Error(await readError(res, `Browser lane navigate failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function fetchBrowserLaneTabs(laneId: string) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}/tabs`)
	if (!res.ok) {
		throw new Error(await readError(res, `Browser lane tabs failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function createBrowserLaneTab(laneId: string, input: { url?: string | null } = {}) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}/tabs`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	})
	if (!res.ok) {
		throw new Error(await readError(res, `Browser lane tab create failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function activateBrowserLaneTab(laneId: string, tabId: string) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}/tabs/${tabId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "activate" }),
	})
	if (!res.ok) {
		throw new Error(await readError(res, `Browser lane tab activate failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function closeBrowserLaneTab(laneId: string, tabId: string) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}/tabs/${tabId}`, {
		method: "DELETE",
	})
	if (!res.ok) {
		throw new Error(await readError(res, `Browser lane tab close failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function navigateBrowserLaneTab(
	laneId: string,
	tabId: string,
	input: { url: string },
) {
	const res = await fetch(`${BASE_URL}/browser/${laneId}/tabs/${tabId}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "navigate", url: input.url }),
	})
	if (!res.ok) {
		throw new Error(await readError(res, `Browser lane tab navigate failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export function subscribeToActiveOpenCodeSessionEvents(
	handlers: ActiveOpenCodeSessionStreamHandlers,
): () => void {
	if (typeof window === "undefined" || !("EventSource" in window)) {
		handlers.onError?.("EventSource unavailable")
		return () => {}
	}

	const source = new EventSource(`${BASE_URL}${ACTIVE_SESSION_EVENTS_PATH}`)

	source.onopen = () => {
		handlers.onOpen?.()
	}

	source.onerror = () => {
		handlers.onError?.("active session stream reconnecting")
	}

	source.addEventListener("presence", (event) => {
		try {
			handlers.onSnapshot?.(JSON.parse(event.data) as ActiveOpenCodeSessionsSnapshot)
		} catch (error) {
			handlers.onError?.(error instanceof Error ? error.message : String(error))
		}
	})

	source.addEventListener("presence-error", (event) => {
		try {
			const data = JSON.parse(event.data) as { message?: string }
			handlers.onError?.(data.message ?? "active session stream error")
		} catch (error) {
			handlers.onError?.(error instanceof Error ? error.message : String(error))
		}
	})

	source.addEventListener("heartbeat", () => {
		handlers.onHeartbeat?.()
	})

	return () => {
		source.close()
	}
}

/**
 * Fetches the OpenCode model state (recent models, favorites, variants)
 * from the backend, which reads ~/.local/state/opencode/model.json.
 */
export async function browseMcpCatalog(input: import("../../shared/mcp-connections-shared").McpCatalogBrowseInput) {
	const res = await fetch(`${BASE_URL}/api/mcp-connections/catalog/browse`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	})
	if (!res.ok) {
		throw new Error(await readError(res, `MCP catalog browse failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function searchMcpCatalog(input: import("../../shared/mcp-connections-shared").McpCatalogSearchInput) {
	const res = await fetch(`${BASE_URL}/api/mcp-connections/catalog/search`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	})
	if (!res.ok) {
		throw new Error(await readError(res, `MCP catalog search failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function registerMcpConnection(input: import("../../shared/mcp-connections-shared").McpConnectionRegisterInput) {
	const res = await fetch(`${BASE_URL}/api/mcp-connections/register`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	})
	if (!res.ok) {
		throw new Error(await readError(res, `MCP connection registration failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function loginMcpConnection(name: string) {
	const res = await fetch(`${BASE_URL}/api/mcp-connections/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	})
	if (!res.ok) {
		throw new Error(await readError(res, `MCP connection login failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function startMcpConnectionAuth(name: string) {
	const res = await fetch(`${BASE_URL}/api/mcp-connections/auth/start`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	})
	if (!res.ok) {
		throw new Error(await readError(res, `MCP auth start failed: ${res.status} ${res.statusText}`))
	}
	return res.json() as Promise<{ name: string; status: string; authorizeUrl: string | null; message: string | null }>
}

export async function getMcpConnectionAuthStatus(name: string) {
	const res = await fetch(`${BASE_URL}/api/mcp-connections/auth/${encodeURIComponent(name)}`)
	if (!res.ok) {
		throw new Error(await readError(res, `MCP auth status failed: ${res.status} ${res.statusText}`))
	}
	return res.json() as Promise<{ name: string; status: string; authorizeUrl: string | null; message: string | null }>
}

export async function testMcpConnection(name: string) {
	const res = await fetch(`${BASE_URL}/api/mcp-connections/test`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name }),
	})
	if (!res.ok) {
		throw new Error(await readError(res, `MCP connection test failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function listMcpConnectionRecords() {
	const res = await fetch(`${BASE_URL}/api/mcp-connections/records`)
	if (!res.ok) {
		throw new Error(await readError(res, `MCP connection records failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function fetchModelState(): Promise<{
	recent: { providerID: string; modelID: string }[]
	favorite: { providerID: string; modelID: string }[]
	variant: Record<string, string | undefined>
}> {
	const res = await client.api["model-state"].$get()
	if (!res.ok) {
		throw new Error(`Model state fetch failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

export async function fetchCh5PmState() {
	const res = await client.api.ch5pm.state.$get()
	if (!res.ok) {
		throw new Error(await readError(res, `CH5PM state fetch failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function fetchCh5PmSideAgentFeed() {
	const res = await client.api.ch5pm.babysitter.$get()
	if (!res.ok) {
		throw new Error(await readError(res, `CH5PM side-agent feed fetch failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function fetchCh5PmSideAgentQueue() {
	const res = await client.api.ch5pm.queue.$get()
	if (!res.ok) {
		throw new Error(await readError(res, `CH5PM side-agent queue fetch failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

export async function fetchCh5PmSideAgentHealth() {
	const res = await client.api.ch5pm.health.$get()
	if (!res.ok) {
		throw new Error(await readError(res, `CH5PM side-agent health fetch failed: ${res.status} ${res.statusText}`))
	}
	return res.json()
}

async function postCh5PmAttentionAction(
	action: "resolve" | "cancel",
	body: Record<string, unknown>,
): Promise<void> {
	const res =
		action === "resolve"
			? await client.api.ch5pm.attention.resolve.$post({ json: body })
			: await client.api.ch5pm.attention.cancel.$post({ json: body })
	if (!res.ok) {
		let payload: unknown = null
		try {
			payload = await res.json()
		} catch {
			// Non-JSON failure body — fall through to the status-based message.
		}
		throw new Ch5PmAttentionActionError(
			res.status,
			extractAttentionErrorMessage(
				payload,
				`CH5PM attention ${action} failed: ${res.status} ${res.statusText}`,
			),
		)
	}
}

/** Answer an AskHuman attention item (daemon `/mutations/attention/resolve`). */
export async function resolveCh5PmAttentionItem(input: {
	id: string
	chosenLabel: string
	note?: string
}): Promise<void> {
	await postCh5PmAttentionAction("resolve", input)
}

/** Dismiss an AskHuman attention item (daemon `/mutations/attention/cancel`). */
export async function cancelCh5PmAttentionItem(input: {
	id: string
	note?: string
}): Promise<void> {
	await postCh5PmAttentionAction("cancel", input)
}

/**
 * Updates the recent model list via the backend server.
 * Adds the model to the front, deduplicates, caps at 10.
 */
export async function updateModelRecent(model: { providerID: string; modelID: string }): Promise<{
	recent: { providerID: string; modelID: string }[]
	favorite: { providerID: string; modelID: string }[]
	variant: Record<string, string | undefined>
}> {
	const res = await client.api["model-state"].recent.$post({
		json: model,
	})
	if (!res.ok) {
		throw new Error(`Model state update failed: ${res.status} ${res.statusText}`)
	}
	return res.json()
}

/**
 * Checks if the Elf server is running.
 */
async function readError(res: ErrorBodyResponse, fallback: string): Promise<string> {
	try {
		const data = await res.json()
		if (typeof data === "object" && data !== null && "error" in data && typeof data.error === "string") {
			return data.error
		}
	} catch {}
	return fallback
}

export async function fetchTextFile(filePath: string): Promise<string> {
	const res = await client.api.files.text.$get({
		query: { path: filePath },
	})
	if (!res.ok) {
		throw new Error(await readError(res, `Text file fetch failed: ${res.status} ${res.statusText}`))
	}
	return res.text()
}

export async function saveTextFile(filePath: string, content: string): Promise<void> {
	const res = await client.api.files.text.$put({
		json: { path: filePath, content },
	})
	if (!res.ok) {
		throw new Error(await readError(res, `Text file save failed: ${res.status} ${res.statusText}`))
	}
}

export async function checkServerHealth() {
	try {
		const res = await client.health.$get()
		return res.ok
	} catch {
		return false
	}
}
