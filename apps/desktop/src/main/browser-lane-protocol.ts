import fs from "node:fs"
import path from "node:path"
import type { Session } from "electron"
import { getBrowserLaneConfigDir } from "./automation/paths"

const BROWSER_LANE_ORIGIN = "http://elf-browser-lane.local"
const LOCAL_LANE_AUTH_HEADER = `Basic ${Buffer.from("abc:abc").toString("base64")}`
const REGISTRY_FILE = path.join(getBrowserLaneConfigDir(), "lanes.json")

interface BrowserLaneProtocolRecord {
	id: string
	streamBackendUrl: string | null
	mode?: "local" | "remote"
	surfaceKind?: "selkies-stream" | "direct-iframe"
}

interface BrowserLaneProtocolRegistry {
	lanes?: BrowserLaneProtocolRecord[]
}

function createBrowserLaneUrl(upstreamBase: string, requestUrl: string): string {
	const upstream = new URL(upstreamBase)
	const incoming = new URL(requestUrl)
	upstream.pathname = incoming.pathname
	upstream.search = incoming.search
	return upstream.toString()
}

async function resolveLaneRegistry(fetchImpl: typeof fetch): Promise<Map<string, string>> {
	const response = await fetchImpl("http://127.0.0.1:30206/browser")
	if (!response.ok) {
		return new Map()
	}
	const lanes = (await response.json()) as Array<{
		id: string
		streamBackendUrl: string | null
	}>
	return new Map(
		lanes
			.filter((lane) => lane.streamBackendUrl)
			.map((lane) => [lane.id, lane.streamBackendUrl as string]),
	)
}

function normalizeHttpOrigin(rawUrl: string): string | null {
	try {
		const url = new URL(rawUrl)
		if (url.protocol === "ws:") url.protocol = "http:"
		if (url.protocol === "wss:") url.protocol = "https:"
		return url.origin
	} catch {
		return null
	}
}

function isLoopbackUrl(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl)
		return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1"
	} catch {
		return false
	}
}

function readLocalBrowserLaneStreamOrigins(): Set<string> {
	try {
		const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8")) as BrowserLaneProtocolRegistry
		return new Set(
			(data.lanes ?? [])
				.filter((lane) => lane.mode !== "remote")
				.map((lane) => lane.streamBackendUrl)
				.filter((url): url is string => Boolean(url))
				.filter((url) => isLoopbackUrl(url))
				.map((url) => normalizeHttpOrigin(url))
				.filter((origin): origin is string => Boolean(origin)),
		)
	} catch {
		return new Set()
	}
}

function isKnownLocalBrowserLaneRequest(rawUrl: string): boolean {
	const origin = normalizeHttpOrigin(rawUrl)
	if (!origin) return false
	return readLocalBrowserLaneStreamOrigins().has(origin)
}

function withLocalLaneAuthorizationHeader(
	requestHeaders: Record<string, string>,
): Record<string, string> {
	const hasAuthorization = Object.keys(requestHeaders).some(
		(header) => header.toLowerCase() === "authorization",
	)
	if (hasAuthorization) return requestHeaders
	return { ...requestHeaders, Authorization: LOCAL_LANE_AUTH_HEADER }
}

export async function registerBrowserLaneProtocol(
	session: Session,
	fetchImpl: typeof fetch = fetch,
): Promise<void> {
	session.webRequest.onBeforeSendHeaders(
		{
			urls: [
				"http://127.0.0.1:*/*",
				"http://localhost:*/*",
				"ws://127.0.0.1:*/*",
				"ws://localhost:*/*",
			],
		},
		(details, callback) => {
			if (!isKnownLocalBrowserLaneRequest(details.url)) {
				callback({ requestHeaders: details.requestHeaders })
				return
			}
			callback({
				requestHeaders: withLocalLaneAuthorizationHeader(details.requestHeaders),
			})
		},
	)

	if (session.protocol.isProtocolHandled("http")) {
		return
	}

	session.protocol.handle("http", async (request) => {
		const url = new URL(request.url)
		if (url.hostname !== "elf-browser-lane.local") {
			return await fetchImpl(request)
		}

		const match = url.pathname.match(/^\/browser\/([^/]+)(\/.*)?$/)
		if (!match) {
			return new Response("browser lane not found", { status: 404 })
		}
		const laneId = match[1] ?? ""
		const remainder = match[2] || "/"
		const registry = await resolveLaneRegistry(fetchImpl)
		const upstream = registry.get(laneId)
		if (!upstream) {
			return new Response("browser lane not found", { status: 404 })
		}
		const upstreamUrl = createBrowserLaneUrl(upstream, `${BROWSER_LANE_ORIGIN}${remainder}${url.search}`)
		const upstreamHeaders = new Headers(request.headers)
		upstreamHeaders.delete("host")
		upstreamHeaders.set("authorization", LOCAL_LANE_AUTH_HEADER)
		return await fetchImpl(upstreamUrl, {
			method: request.method,
			headers: upstreamHeaders,
			body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
			redirect: "manual",
		})
	})
}

export function getBrowserLaneDesktopUrl(
	laneId: string,
	streamBackendUrl?: string | null,
	surfaceKind?: "selkies-stream" | "direct-iframe",
): string {
	if (surfaceKind === "direct-iframe" && streamBackendUrl) {
		return streamBackendUrl
	}
	if (streamBackendUrl && isLoopbackUrl(streamBackendUrl)) {
		return new URL("/", streamBackendUrl).toString()
	}
	return `${BROWSER_LANE_ORIGIN}/browser/${laneId}/`
}
