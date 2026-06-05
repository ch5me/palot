import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { Hono } from "hono"

interface BrowserLaneRouteEntry {
	id: string
	label: string
	mode: "local" | "remote"
	runtime: "docker-chromium" | "remote-attached"
	streamBackendUrl: string | null
	streamPath: string
	desktopStreamUrl: string | null
	cdpEndpoint: string | null
	profilePath: string | null
	host: string | null
	createdAt: number
	updatedAt: number
}

interface BrowserLaneRegistryFile {
	version: number
	lanes: Array<{
		id: string
		label: string
		mode?: "local" | "remote"
		runtime?: "docker-chromium" | "remote-attached"
		streamBackendUrl: string | null
		cdpEndpoint?: string | null
		profilePath?: string | null
		host?: string | null
		createdAt?: number
		updatedAt?: number
	}>
}

const app = new Hono()
export const LOCAL_LANE_AUTH_HEADER = `Basic ${Buffer.from("abc:abc").toString("base64")}`
const BROWSER_LANE_PAGE_SHIM = `<script data-elf-browser-lane-shim>(()=>{const warn=console.warn.bind(console);console.warn=(...args)=>{if(args[0]==="Received non-object message via window.postMessage:"&&typeof args[1]==="string"&&args[1].startsWith("setImmediate$"))return;warn(...args)}})();</script>`

function normalizeRemoteLaneInput(input: {
	id?: string
	label?: string
	streamBackendUrl?: string
	cdpEndpoint?: string | null
	host?: string | null
	profilePath?: string | null
}) {
	if (!input.id || !input.label || !input.streamBackendUrl) {
		throw new Error("Remote lane requires id, label, and streamBackendUrl")
	}
	return {
		id: input.id,
		label: input.label,
		mode: "remote" as const,
		runtime: "remote-attached" as const,
		streamBackendUrl: input.streamBackendUrl,
		cdpEndpoint: input.cdpEndpoint ?? null,
		profilePath: input.profilePath ?? null,
		host: input.host ?? null,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	}
}

async function writeBrowserLaneRoutes(lanes: BrowserLaneRegistryFile["lanes"]): Promise<void> {
	const registryPath = getRegistryPath()
	await fs.mkdir(path.dirname(registryPath), { recursive: true })
	const payload: BrowserLaneRegistryFile = { version: 1, lanes }
	await fs.writeFile(registryPath, JSON.stringify(payload, null, "\t"), "utf-8")
}

function getRegistryPath(): string {
	const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")
	return path.join(xdgConfig, "elf", "browser-lanes", "lanes.json")
}

async function readBrowserLaneRoutes(): Promise<BrowserLaneRouteEntry[]> {
	try {
		const raw = await fs.readFile(getRegistryPath(), "utf-8")
		const data = JSON.parse(raw) as BrowserLaneRegistryFile
		return Array.isArray(data.lanes)
			? data.lanes.map((lane) => ({
					id: lane.id,
					label: lane.label,
					mode: lane.mode ?? "local",
					runtime: lane.runtime ?? "docker-chromium",
					streamBackendUrl: lane.streamBackendUrl,
					streamPath: `/browser/${lane.id}/`,
					desktopStreamUrl: `http://elf-browser-lane.local/browser/${lane.id}/`,
					cdpEndpoint: lane.cdpEndpoint ?? null,
					profilePath: lane.profilePath ?? null,
					host: lane.host ?? null,
					createdAt: lane.createdAt ?? 0,
					updatedAt: lane.updatedAt ?? 0,
				}))
			: []
	} catch {
		return []
	}
}

function normalizeUpstreamUrl(
	lane: BrowserLaneRouteEntry,
	remainder: string,
	search = "",
): string | null {
	if (!lane.streamBackendUrl) return null
	const base = new URL(lane.streamBackendUrl)
	const cleaned = remainder.startsWith("/") ? remainder : `/${remainder}`
	base.pathname = cleaned === "/" ? "/" : cleaned
	base.search = search
	return base.toString()
}

export async function resolveBrowserLaneProxyTarget(
	requestUrl: string,
	protocol: "http:" | "ws:",
): Promise<string | null> {
	const url = new URL(requestUrl)
	const match = url.pathname.match(/^\/browser\/([^/]+)(\/.*)?$/)
	if (!match) return null
	const lane = (await readBrowserLaneRoutes()).find((entry) => entry.id === match[1])
	if (!lane) return null
	const upstreamUrl = normalizeUpstreamUrl(lane, match[2] || "/", url.search)
	if (!upstreamUrl) return null
	const upstream = new URL(upstreamUrl)
	upstream.protocol = protocol
	return upstream.toString()
}

export function injectBrowserLanePageShim(html: string): string {
	if (html.includes("data-elf-browser-lane-shim")) return html
	if (html.includes('<script type="module"')) {
		return html.replace('<script type="module"', `${BROWSER_LANE_PAGE_SHIM}<script type="module"`)
	}
	if (html.includes("</head>")) {
		return html.replace("</head>", `${BROWSER_LANE_PAGE_SHIM}</head>`)
	}
	return `${BROWSER_LANE_PAGE_SHIM}${html}`
}

async function rewriteBrowserLaneResponseBody(
	request: Request,
	response: Response,
): Promise<BodyInit | null> {
	if (request.method !== "GET") return response.body
	const contentType = response.headers.get("content-type") ?? ""
	if (!contentType.toLowerCase().includes("text/html")) return response.body
	return injectBrowserLanePageShim(await response.text())
}

async function proxyLaneRequest(
	request: Request,
	lane: BrowserLaneRouteEntry,
	remainder: string,
): Promise<Response> {
	const requestUrl = new URL(request.url)
	const upstreamUrl = normalizeUpstreamUrl(lane, remainder, requestUrl.search)
	if (!upstreamUrl) {
		return Response.json({ error: `Lane ${lane.id} has no stream backend URL` }, { status: 503 })
	}

	const upstreamHeaders = new Headers(request.headers)
	upstreamHeaders.delete("host")
	upstreamHeaders.set("authorization", LOCAL_LANE_AUTH_HEADER)
	const upstreamResponse = await fetch(upstreamUrl, {
		method: request.method,
		headers: upstreamHeaders,
		body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
		redirect: "manual",
	})
	const responseHeaders = new Headers(upstreamResponse.headers)
	responseHeaders.delete("content-encoding")
	responseHeaders.delete("content-length")
	responseHeaders.delete("transfer-encoding")
	responseHeaders.set("cache-control", "no-store")
	const responseBody = await rewriteBrowserLaneResponseBody(request, upstreamResponse)
	return new Response(responseBody, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers: responseHeaders,
	})
}

const routes = app
	.get("/", async (c) => {
		return c.json(await readBrowserLaneRoutes(), 200)
	})
	.post("/", async (c) => {
		const body = (await c.req.json().catch(() => ({}))) as {
			action?: string
			lane?: {
				id?: string
				label?: string
				streamBackendUrl?: string
				cdpEndpoint?: string | null
				host?: string | null
				profilePath?: string | null
			}
		}
		if (body.action !== "create-remote") {
			return c.json({ error: "Unsupported browser lane collection action" }, 400)
		}
		try {
			const lane = normalizeRemoteLaneInput(body.lane ?? {})
			const current = await readBrowserLaneRoutes()
			const next = current
				.filter((entry) => entry.id !== lane.id)
				.map((entry) => ({
					id: entry.id,
					label: entry.label,
					mode: entry.mode,
					runtime: entry.runtime,
					streamBackendUrl: entry.streamBackendUrl,
					cdpEndpoint: entry.cdpEndpoint,
					profilePath: entry.profilePath,
					host: entry.host,
					createdAt: entry.createdAt,
					updatedAt: entry.updatedAt,
				}))
			next.push(lane)
			await writeBrowserLaneRoutes(next)
			const checkedAt = Date.now()
			return c.json({
				...lane,
				streamPath: `/browser/${lane.id}/`,
				desktopStreamUrl: `http://elf-browser-lane.local/browser/${lane.id}/`,
				health: {
					status: lane.cdpEndpoint ? "degraded" : "stopped",
					stream: {
						url: lane.streamBackendUrl,
						checkedAt,
						state: "ready",
						error: null,
					},
					cdp: {
						url: lane.cdpEndpoint,
						checkedAt,
						state: lane.cdpEndpoint ? "ready" : "failed",
						error: lane.cdpEndpoint ? null : "CDP endpoint missing",
					},
					message: lane.cdpEndpoint
						? "Remote stream attached, CDP ready"
						: "Remote lane attached without CDP endpoint",
				},
			})
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : String(error) }, 400)
		}
	})
	.post("/:laneId", async (c) => {
		const laneId = c.req.param("laneId")
		const body = (await c.req.json().catch(() => ({}))) as { action?: string }
		const action = body.action || "ensure"
		const statusMessage =
			action === "reset-profile"
				? "Profile reset; restart lane to create a clean session"
				: action === "stop"
					? "Lane stopped"
					: action === "restart"
						? "Lane restarting"
						: action === "start"
							? "Lane starting"
							: "Lane runtime prepared"
		const checkedAt = Date.now()
		const lane = (await readBrowserLaneRoutes()).find((entry) => entry.id === laneId)

		if (!lane) {
			return c.json({ error: `Browser lane ${laneId} not found` }, 404)
		}
		return c.json(
			{
				...lane,
				health: {
					status:
						action === "reset-profile"
							? "profile-locked"
							: action === "stop"
								? "stopped"
								: "starting",
					stream: {
						url: lane.streamBackendUrl,
						checkedAt,
						state: action === "stop" || action === "reset-profile" ? "unknown" : "pending",
						error: null,
					},
					cdp: {
						url: lane.cdpEndpoint,
						checkedAt,
						state:
							action === "stop" || action === "reset-profile"
								? "unknown"
								: lane.mode === "remote"
									? "ready"
									: "pending",
						error: null,
					},
					message: statusMessage,
				},
			},
			200,
		)
	})
	.get("/:laneId/health", async (c) => {
		const laneId = c.req.param("laneId")
		const lane = (await readBrowserLaneRoutes()).find((entry) => entry.id === laneId)
		if (!lane) {
			return c.json({ error: `Browser lane ${laneId} not found` }, 404)
		}
		const checkedAt = Date.now()
		const streamReady = Boolean(lane.streamBackendUrl)
		const cdpReady = Boolean(lane.cdpEndpoint)
		let streamProbeOk = streamReady
		let cdpProbeOk = cdpReady
		if (streamReady) {
			try {
				const res = await fetch(lane.streamBackendUrl as string, {
					method: "HEAD",
					signal: AbortSignal.timeout(2500),
					headers: { authorization: `Basic ${Buffer.from("abc:abc").toString("base64")}` },
				})
				streamProbeOk = res.ok
			} catch {
				streamProbeOk = false
			}
		}
		if (cdpReady) {
			try {
				const res = await fetch(`${(lane.cdpEndpoint as string).replace(/\/$/, "")}/json/version`, {
					signal: AbortSignal.timeout(2500),
					headers: { authorization: `Basic ${Buffer.from("abc:abc").toString("base64")}` },
				})
				cdpProbeOk = res.ok
			} catch {
				cdpProbeOk = false
			}
		}
		const remoteFailure = lane.mode === "remote" && (!streamReady || !streamProbeOk)
		const remoteDegraded =
			lane.mode === "remote" && streamReady && streamProbeOk && (!cdpReady || !cdpProbeOk)
		const localBothOk = streamReady && streamProbeOk && cdpReady && cdpProbeOk
		const status = remoteFailure
			? "error"
			: remoteDegraded
				? "degraded"
				: localBothOk
					? "running"
					: lane.profilePath
						? "profile-locked"
						: "stopped"
		const message = remoteFailure
			? "Remote lane unreachable or not configured"
			: remoteDegraded
				? "Remote stream reachable, CDP unavailable"
				: localBothOk
					? lane.mode === "remote"
						? "Remote lane attached and reachable"
						: "Stream and CDP ready"
					: lane.profilePath
						? "Profile exists but runtime has not started yet"
						: "Lane stopped"
		return c.json(
			{
				status,
				stream: {
					url: lane.streamBackendUrl,
					checkedAt,
					state: streamProbeOk ? "ready" : "failed",
					error: streamProbeOk ? null : "Stream backend URL unreachable",
				},
				cdp: {
					url: lane.cdpEndpoint,
					checkedAt,
					state: cdpProbeOk ? "ready" : "failed",
					error: cdpProbeOk ? null : "CDP endpoint unreachable",
				},
				message,
			},
			200,
		)
	})
	.all("/:laneId", async (c) => {
		const laneId = c.req.param("laneId")
		const lane = (await readBrowserLaneRoutes()).find((entry) => entry.id === laneId)
		if (!lane) {
			return c.json({ error: `Browser lane ${laneId} not found` }, 404)
		}
		return await proxyLaneRequest(c.req.raw, lane, "/")
	})
	.all("/:laneId/*", async (c) => {
		const laneId = c.req.param("laneId")
		const lane = (await readBrowserLaneRoutes()).find((entry) => entry.id === laneId)
		if (!lane) {
			return c.json({ error: `Browser lane ${laneId} not found` }, 404)
		}
		const lanePrefix = `/browser/${laneId}`
		const rest = c.req.path.startsWith(lanePrefix)
			? c.req.path.slice(lanePrefix.length) || "/"
			: "/"
		return await proxyLaneRequest(c.req.raw, lane, rest)
	})

export default routes
