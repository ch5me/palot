/**
 * Type-safe RPC client for the Elf local backend server (Bun + Hono).
 *
 * Uses Hono's RPC client (`hc`) with the server's AppType for end-to-end
 * type safety. The type is resolved from compiled declarations (.d.ts)
 * so the desktop app doesn't need Bun types.
 */

import { createClient } from "@ch5me/elf-server/client"

const BASE_URL = "http://127.0.0.1:30206"
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
async function readError(res: Response, fallback: string): Promise<string> {
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
