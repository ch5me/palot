import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { Hono } from "hono"
import {
	activateBrowserLaneCdpTab,
	type BrowserLaneTab,
	closeBrowserLaneCdpTab,
	createBrowserLaneCdpTab,
	listBrowserLaneCdpTabs,
	navigateBrowserLaneCdp,
} from "../services/browser-lane-cdp"

interface BrowserLaneRouteEntry {
	id: string
	label: string
	mode: "local" | "remote"
	runtime: "docker-chromium" | "remote-attached"
	surfaceKind: "selkies-stream" | "direct-iframe"
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
		surfaceKind?: "selkies-stream" | "direct-iframe"
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
const BROWSER_LANE_PAGE_SHIM = `<script data-elf-browser-lane-shim>(()=>{const warn=console.warn.bind(console);console.warn=(...args)=>{if(args[0]==="Received non-object message via window.postMessage:"&&typeof args[1]==="string"&&args[1].startsWith("setImmediate$"))return;warn(...args)};const HIDE_SELECTORS=["#nav",".nav",".sidebar","[class*='sidebar']","[class*='SideBar']","[class*='control-bar']","[class*='control_bar']","[class*='toolbar']","[aria-label='Sidebar']","[title='Sidebar']"];const HIDE_TEXT=["Selkies Logo","Selkies","Toggle Theme","Enter Fullscreen","Gaming Mode","Video Settings","Screen Settings","Audio Settings","Stats","Clipboard","Files","Apps","Sharing","Gamepads","Disable Video Stream","Disable Audio Stream","Enable Microphone","Disable Gamepad Input"];const injectStyle=()=>{if(document.getElementById("elf-browser-lane-style"))return;const style=document.createElement("style");style.id="elf-browser-lane-style";style.textContent="html,body{background:#000!important;overflow:hidden!important;}iframe{border:0!important;}#nav,.nav,[class*='sidebar'],[class*='SideBar'],[class*='control-bar'],[class*='control_bar'],[class*='toolbar']{display:none!important;visibility:hidden!important;pointer-events:none!important;}[data-elf-browser-main]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;margin:0!important;border:0!important;}";document.head.appendChild(style)};const shouldHideByText=(text)=>HIDE_TEXT.includes((text||"").trim());const hideNode=(node)=>{if(!(node instanceof HTMLElement))return false;node.style.setProperty("display","none","important");node.style.setProperty("visibility","hidden","important");node.style.setProperty("pointer-events","none","important");node.setAttribute("data-elf-hidden","true");return true};const scan=()=>{injectStyle();for(const selector of HIDE_SELECTORS){document.querySelectorAll(selector).forEach((node)=>hideNode(node))}document.querySelectorAll("button,[role='button'],a,h1,h2,h3,div,span").forEach((node)=>{const element=node;const text=element.textContent?.trim()||"";if(text&&shouldHideByText(text)){const container=element.closest("button,[role='button'],a,section,header,aside,nav,div")||element;hideNode(container)}});const searchboxes=[...document.querySelectorAll("input[type='text'],input[type='search']")].filter((node)=>node instanceof HTMLElement);if(searchboxes.length>1){searchboxes.slice(0,-1).forEach((node)=>hideNode(node))}const candidates=[...document.querySelectorAll("canvas,video,img")].filter((node)=>node instanceof HTMLElement&&node.getBoundingClientRect().width>200&&node.getBoundingClientRect().height>120);let best=null;for(const node of candidates){const rect=node.getBoundingClientRect();if(!best||rect.width*rect.height>best.rect.width*best.rect.height){best={node,rect}}}if(best){const target=(best.node.closest("main,section,article,div")||best.node);if(target instanceof HTMLElement){target.setAttribute("data-elf-browser-main","true")}}};const setEditableValue=(target,text)=>{if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement){const start=target.selectionStart??target.value.length;const end=target.selectionEnd??start;target.setRangeText(text,start,end,"end");target.dispatchEvent(new Event("input",{bubbles:true}));return true}return false};const writeHostClipboard=async(text)=>{if(typeof text!=="string")return;const value=text.trim();if(!value)return;try{if(window.parent!==window&&window.parent?.postMessage){window.parent.postMessage({type:"elf-browser-lane-clipboard-copy",text:value},"*")}}catch(error){warn("elf browser lane parent clipboard bridge failed",error)}};document.addEventListener("copy",()=>{const text=window.getSelection?.()?.toString()||"";void writeHostClipboard(text)},true);document.addEventListener("cut",()=>{const text=window.getSelection?.()?.toString()||"";void writeHostClipboard(text)},true);window.addEventListener("message",(event)=>{const data=event.data;if(!data||typeof data!=="object")return;if(data.type==="elf-browser-lane-host-paste"&&typeof data.text==="string"){const target=document.activeElement;if(setEditableValue(target,data.text))return;document.execCommand?.("insertText",false,data.text)}});const start=()=>{scan();const observer=new MutationObserver(()=>scan());observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true});window.addEventListener("load",scan,{once:true});setTimeout(scan,250);setTimeout(scan,1000)};if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",start,{once:true})}else{start()}})();</script>`
const activeBrowserLaneTabIds = new Map<string, string | null>()

function inferSurfaceKind(input: {
	surfaceKind?: "selkies-stream" | "direct-iframe"
	cdpEndpoint?: string | null
}) {
	if (input.surfaceKind) {
		return input.surfaceKind
	}
	return input.cdpEndpoint ? "selkies-stream" : "direct-iframe"
}

function normalizeRemoteLaneInput(input: {
	id?: string
	label?: string
	surfaceKind?: "selkies-stream" | "direct-iframe"
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
		surfaceKind: inferSurfaceKind(input),
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
					surfaceKind:
						lane.surfaceKind ??
						(lane.runtime === "docker-chromium"
							? "selkies-stream"
							: lane.cdpEndpoint
								? "selkies-stream"
								: "direct-iframe"),
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
	lane: BrowserLaneRouteEntry,
): Promise<BodyInit | null> {
	if (lane.surfaceKind !== "selkies-stream") return response.body
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
	const responseBody = await rewriteBrowserLaneResponseBody(request, upstreamResponse, lane)
	return new Response(responseBody, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers: responseHeaders,
	})
}

function assertNavigableUrl(url: string): void {
	try {
		new URL(url)
	} catch {
		throw new Error(`Invalid browser navigation URL: ${url}`)
	}
}

function getCdpEndpoint(lane: BrowserLaneRouteEntry): string {
	if (!lane.cdpEndpoint) {
		throw new Error(`Browser lane ${lane.id} has no CDP endpoint`)
	}
	return lane.cdpEndpoint
}

async function listLaneTabs(lane: BrowserLaneRouteEntry) {
	const tabsState = await listBrowserLaneCdpTabs(
		getCdpEndpoint(lane),
		activeBrowserLaneTabIds.get(lane.id) ?? null,
	)
	activeBrowserLaneTabIds.set(lane.id, tabsState.activeTabId)
	return {
		laneId: lane.id,
		activeTabId: tabsState.activeTabId,
		tabs: tabsState.tabs,
	}
}

function buildTabActionResult(
	laneId: string,
	state: Awaited<ReturnType<typeof listLaneTabs>>,
	tab: BrowserLaneTab | null,
) {
	return {
		laneId,
		activeTabId: state.activeTabId,
		tabs: state.tabs,
		tab,
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeComparableUrl(url: string): string {
	try {
		return new URL(url).toString()
	} catch {
		return url
	}
}

function tabHasUrl(tab: BrowserLaneTab | undefined, url: string): boolean {
	if (!tab?.url) return false
	return normalizeComparableUrl(tab.url) === normalizeComparableUrl(url)
}

async function waitForNavigatedTabsState(lane: BrowserLaneRouteEntry, tabId: string, url: string) {
	let state = await listLaneTabs(lane)
	for (
		let attempt = 0;
		attempt < 10 &&
		!tabHasUrl(
			state.tabs.find((entry) => entry.id === tabId),
			url,
		);
		attempt += 1
	) {
		await delay(100)
		state = await listLaneTabs(lane)
	}
	return state
}

async function waitForClosedTabsState(lane: BrowserLaneRouteEntry, tabId: string) {
	let state = await listLaneTabs(lane)
	for (
		let attempt = 0;
		attempt < 10 && state.tabs.some((entry) => entry.id === tabId);
		attempt += 1
	) {
		await delay(100)
		state = await listLaneTabs(lane)
	}
	return state
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
				surfaceKind?: "selkies-stream" | "direct-iframe"
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
					surfaceKind: entry.surfaceKind,
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
					status:
						lane.surfaceKind === "direct-iframe"
							? "running"
							: lane.cdpEndpoint
								? "running"
								: "degraded",
					stream: {
						url: lane.streamBackendUrl,
						checkedAt,
						state: "ready",
						error: null,
					},
					cdp: {
						url: lane.cdpEndpoint,
						checkedAt,
						state:
							lane.surfaceKind === "direct-iframe"
								? "not-applicable"
								: lane.cdpEndpoint
									? "ready"
									: "failed",
						error:
							lane.surfaceKind === "direct-iframe"
								? null
								: lane.cdpEndpoint
									? null
									: "CDP endpoint missing",
					},
					message:
						lane.surfaceKind === "direct-iframe"
							? "Direct iframe route attached"
							: lane.cdpEndpoint
								? "Remote stream attached, CDP ready"
								: "Remote stream attached, CDP unavailable",
				},
			})
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : String(error) }, 400)
		}
	})
	.get("/:laneId/tabs", async (c) => {
		const laneId = c.req.param("laneId")
		const lane = (await readBrowserLaneRoutes()).find((entry) => entry.id === laneId)
		if (!lane) {
			return c.json({ error: `Browser lane ${laneId} not found` }, 404)
		}
		try {
			return c.json(await listLaneTabs(lane), 200)
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : String(error) }, 503)
		}
	})
	.post("/:laneId/tabs", async (c) => {
		const laneId = c.req.param("laneId")
		const lane = (await readBrowserLaneRoutes()).find((entry) => entry.id === laneId)
		if (!lane) {
			return c.json({ error: `Browser lane ${laneId} not found` }, 404)
		}
		const body = (await c.req.json().catch(() => ({}))) as { url?: string | null }
		const url = body.url?.trim() || "about:blank"
		try {
			assertNavigableUrl(url)
			const cdpEndpoint = getCdpEndpoint(lane)
			const tab = await createBrowserLaneCdpTab(cdpEndpoint, url)
			await activateBrowserLaneCdpTab(cdpEndpoint, tab.id)
			activeBrowserLaneTabIds.set(lane.id, tab.id)
			const state = await listLaneTabs(lane)
			return c.json(
				buildTabActionResult(
					lane.id,
					state,
					state.tabs.find((entry) => entry.id === tab.id) ?? tab,
				),
				200,
			)
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : String(error) }, 502)
		}
	})
	.post("/:laneId/tabs/:tabId", async (c) => {
		const laneId = c.req.param("laneId")
		const tabId = c.req.param("tabId")
		const lane = (await readBrowserLaneRoutes()).find((entry) => entry.id === laneId)
		if (!lane) {
			return c.json({ error: `Browser lane ${laneId} not found` }, 404)
		}
		const body = (await c.req.json().catch(() => ({}))) as {
			action?: "activate" | "navigate"
			url?: string
		}
		const action = body.action || "activate"
		try {
			const cdpEndpoint = getCdpEndpoint(lane)
			if (action === "navigate") {
				if (!body.url) {
					return c.json({ error: "Browser lane tab navigate requires url" }, 400)
				}
				assertNavigableUrl(body.url)
				await navigateBrowserLaneCdp(cdpEndpoint, body.url, tabId)
			} else {
				await activateBrowserLaneCdpTab(cdpEndpoint, tabId)
			}
			activeBrowserLaneTabIds.set(lane.id, tabId)
			const state =
				action === "navigate" && body.url
					? await waitForNavigatedTabsState(lane, tabId, body.url)
					: await listLaneTabs(lane)
			return c.json(
				buildTabActionResult(
					lane.id,
					state,
					state.tabs.find((entry) => entry.id === tabId) ?? null,
				),
				200,
			)
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : String(error) }, 502)
		}
	})
	.delete("/:laneId/tabs/:tabId", async (c) => {
		const laneId = c.req.param("laneId")
		const tabId = c.req.param("tabId")
		const lane = (await readBrowserLaneRoutes()).find((entry) => entry.id === laneId)
		if (!lane) {
			return c.json({ error: `Browser lane ${laneId} not found` }, 404)
		}
		try {
			await closeBrowserLaneCdpTab(getCdpEndpoint(lane), tabId)
			if (activeBrowserLaneTabIds.get(lane.id) === tabId) {
				activeBrowserLaneTabIds.set(lane.id, null)
			}
			const state = await waitForClosedTabsState(lane, tabId)
			return c.json(buildTabActionResult(lane.id, state, null), 200)
		} catch (error) {
			return c.json({ error: error instanceof Error ? error.message : String(error) }, 502)
		}
	})
	.post("/:laneId", async (c) => {
		const laneId = c.req.param("laneId")
		const body = (await c.req.json().catch(() => ({}))) as { action?: string; url?: string }
		const action = body.action || "ensure"
		const lane = (await readBrowserLaneRoutes()).find((entry) => entry.id === laneId)

		if (!lane) {
			return c.json({ error: `Browser lane ${laneId} not found` }, 404)
		}

		if (action === "navigate") {
			if (!body.url) {
				return c.json({ error: "Browser lane navigate requires url" }, 400)
			}
			if (lane.surfaceKind === "direct-iframe") {
				return c.json(
					{
						error: `Browser lane ${laneId} is direct-iframe; change the target URL in panel state instead of CDP navigation`,
					},
					409,
				)
			}
			if (!lane.cdpEndpoint) {
				return c.json({ error: `Browser lane ${laneId} has no CDP endpoint` }, 503)
			}
			try {
				new URL(body.url)
				let state = await listLaneTabs(lane)
				const tabId = state.activeTabId
				if (!tabId) {
					const tab = await createBrowserLaneCdpTab(lane.cdpEndpoint, body.url)
					await activateBrowserLaneCdpTab(lane.cdpEndpoint, tab.id)
					activeBrowserLaneTabIds.set(lane.id, tab.id)
					state = await listLaneTabs(lane)
					return c.json(
						buildTabActionResult(
							lane.id,
							state,
							state.tabs.find((entry) => entry.id === tab.id) ?? tab,
						),
						200,
					)
				}
				await navigateBrowserLaneCdp(lane.cdpEndpoint, body.url, tabId)
				activeBrowserLaneTabIds.set(lane.id, tabId)
				state = await waitForNavigatedTabsState(lane, tabId, body.url)
				return c.json(
					buildTabActionResult(
						lane.id,
						state,
						state.tabs.find((entry) => entry.id === tabId) ?? null,
					),
					200,
				)
			} catch (error) {
				return c.json({ error: error instanceof Error ? error.message : String(error) }, 502)
			}
		}

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
								: lane.surfaceKind === "direct-iframe"
									? "not-applicable"
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
		const directIframe = lane.surfaceKind === "direct-iframe"
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
		if (cdpReady && !directIframe) {
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
			lane.mode === "remote" &&
			!directIframe &&
			streamReady &&
			streamProbeOk &&
			(!cdpReady || !cdpProbeOk)
		const directIframeOk = directIframe && streamReady && streamProbeOk
		const localBothOk = !directIframe && streamReady && streamProbeOk && cdpReady && cdpProbeOk
		const status = remoteFailure
			? "error"
			: remoteDegraded
				? "degraded"
				: directIframeOk || localBothOk
					? "running"
					: lane.profilePath
						? "profile-locked"
						: "stopped"
		const message = remoteFailure
			? "Remote lane unreachable or not configured"
			: remoteDegraded
				? "Remote stream reachable, CDP unavailable"
				: directIframeOk
					? "Direct iframe reachable"
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
					state: directIframe ? "not-applicable" : cdpProbeOk ? "ready" : "failed",
					error: directIframe ? null : cdpProbeOk ? null : "CDP endpoint unreachable",
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
