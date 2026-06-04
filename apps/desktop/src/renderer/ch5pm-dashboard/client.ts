import { createLogger } from "../lib/logger"
import type {
	Ch5PmDashboardState,
	Ch5PmPressurePayload,
	Ch5PmSnapshotPayload,
	Ch5PmEventStreamHandlers,
	Ch5PmSystemPayload,
} from "./types"

const log = createLogger("ch5pm-dashboard-client")

const SNAPSHOT_PATH = "/data/snapshot.json"
const PRESSURE_PATH = "/data/pressure.json"
const SYSTEM_PATH = "/data/system.json"
const EVENTS_PATH = "/events"

const isElectron = typeof window !== "undefined" && "elf" in window

interface SerializedFetchRequest {
	url: string
	method: string
	headers: Record<string, string>
	body: string | null
}

function isSseRequest(request: Request): boolean {
	return request.headers.get("accept") === "text/event-stream" || request.url.includes(EVENTS_PATH)
}

async function fetchThroughElectron(request: Request): Promise<Response> {
	if (!isElectron || isSseRequest(request)) {
		return fetch(request)
	}

	const headers: Record<string, string> = {}
	request.headers.forEach((value, key) => {
		headers[key] = value
	})

	const serialized: SerializedFetchRequest = {
		url: request.url,
		method: request.method,
		headers,
		body: request.body ? await request.text() : null,
	}

	const result = await window.elf.fetch(serialized)
	const isNullBodyStatus = [101, 204, 205, 304].includes(result.status)
	return new Response(isNullBodyStatus ? null : result.body, {
		status: result.status,
		statusText: result.statusText,
		headers: result.headers,
	})
}

async function fetchJson<T>(baseUrl: string, path: string): Promise<T> {
	const request = new Request(`${baseUrl}${path}?t=${Date.now()}`, {
		cache: "no-store",
		headers: {
			accept: "application/json",
		},
	})
	const response = await fetchThroughElectron(request)
	if (!response.ok) {
		throw new Error(`${path} failed: HTTP ${response.status}`)
	}
	return (await response.json()) as T
}

export async function fetchCh5PmSnapshot(baseUrl: string): Promise<Ch5PmSnapshotPayload> {
	return fetchJson<Ch5PmSnapshotPayload>(baseUrl, SNAPSHOT_PATH)
}

export async function fetchCh5PmPressure(baseUrl: string): Promise<Ch5PmPressurePayload> {
	return fetchJson<Ch5PmPressurePayload>(baseUrl, PRESSURE_PATH)
}

export async function fetchCh5PmSystem(baseUrl: string): Promise<Ch5PmSystemPayload> {
	return fetchJson<Ch5PmSystemPayload>(baseUrl, SYSTEM_PATH)
}

export async function fetchCh5PmDashboard(baseUrl: string): Promise<Ch5PmDashboardState> {
	const [snapshot, pressure, system] = await Promise.all([
		fetchCh5PmSnapshot(baseUrl),
		fetchCh5PmPressure(baseUrl),
		fetchCh5PmSystem(baseUrl),
	])

	return {
		snapshot,
		pressure,
		system,
		streamConnected: false,
		streamError: null,
		lastEventAt: null,
	}
}

export function subscribeToCh5PmEvents(
	baseUrl: string,
	handlers: Ch5PmEventStreamHandlers,
): () => void {
	if (typeof window === "undefined" || !("EventSource" in window)) {
		handlers.onError?.("EventSource unavailable")
		return () => {}
	}

	const source = new EventSource(`${baseUrl}${EVENTS_PATH}`)

	source.onopen = () => {
		log.info("CH5PM event stream connected", { baseUrl })
		handlers.onOpen?.()
	}

	source.onerror = () => {
		log.warn("CH5PM event stream error", { baseUrl })
		handlers.onError?.("event stream reconnecting")
	}

	source.addEventListener("snapshot", (event) => {
		try {
			handlers.onSnapshot?.(JSON.parse(event.data) as Ch5PmSnapshotPayload)
		} catch (error) {
			handlers.onError?.(error instanceof Error ? error.message : String(error))
		}
	})

	source.addEventListener("pressure", (event) => {
		try {
			handlers.onPressure?.(JSON.parse(event.data) as Ch5PmPressurePayload)
		} catch (error) {
			handlers.onError?.(error instanceof Error ? error.message : String(error))
		}
	})

	source.addEventListener("system", (event) => {
		try {
			handlers.onSystem?.(JSON.parse(event.data) as Ch5PmSystemPayload)
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
