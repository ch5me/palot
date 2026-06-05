import type { Session } from "electron"

const BROWSER_LANE_ORIGIN = "http://elf-browser-lane.local"

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

export async function registerBrowserLaneProtocol(
	session: Session,
	fetchImpl: typeof fetch = fetch,
): Promise<void> {
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
		return await fetchImpl(upstreamUrl)
	})
}

export function getBrowserLaneDesktopUrl(laneId: string): string {
	return `${BROWSER_LANE_ORIGIN}/browser/${laneId}/`
}
