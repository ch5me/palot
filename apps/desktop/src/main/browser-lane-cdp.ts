interface CdpTarget {
	id: string
	type: string
	title?: string
	url?: string
	attached?: boolean
	openerId?: string
	faviconUrl?: string
	webSocketDebuggerUrl?: string
}

interface CdpResponse {
	id?: number
	result?: unknown
	error?: { message?: string }
}

export interface BrowserLaneTab {
	id: string
	title: string
	url: string
	type: string
	active: boolean
	attached: boolean
	openerId: string | null
	faviconUrl: string | null
}

export interface BrowserLaneTabsState {
	activeTabId: string | null
	tabs: BrowserLaneTab[]
}

export interface BrowserLaneNavigateResult {
	targetId: string
	url: string
}

const CDP_TIMEOUT_MS = 5000

export async function listBrowserLaneCdpTabs(
	cdpEndpoint: string,
	activeTabId?: string | null,
): Promise<BrowserLaneTabsState> {
	const targets = await fetchPageTargets(cdpEndpoint)
	const resolvedActiveTabId = resolveActiveTabId(targets, activeTabId)
	return {
		activeTabId: resolvedActiveTabId,
		tabs: targets.map((target) => toBrowserLaneTab(target, target.id === resolvedActiveTabId)),
	}
}

export async function createBrowserLaneCdpTab(
	cdpEndpoint: string,
	url = "about:blank",
): Promise<BrowserLaneTab> {
	const endpoint = cdpEndpoint.replace(/\/$/, "")
	const requestUrl = `${endpoint}/json/new?${encodeURIComponent(url)}`
	let response = await fetchCdpHttp(requestUrl, { method: "PUT", throwOnError: false })
	if (!response.ok) {
		response = await fetchCdpHttp(requestUrl, { method: "GET" })
	}
	const target = (await response.json()) as CdpTarget
	return toBrowserLaneTab(target, true)
}

export async function activateBrowserLaneCdpTab(
	cdpEndpoint: string,
	tabId: string,
): Promise<void> {
	const endpoint = cdpEndpoint.replace(/\/$/, "")
	await fetchCdpHttp(`${endpoint}/json/activate/${encodeURIComponent(tabId)}`)
}

export async function closeBrowserLaneCdpTab(cdpEndpoint: string, tabId: string): Promise<void> {
	const endpoint = cdpEndpoint.replace(/\/$/, "")
	await fetchCdpHttp(`${endpoint}/json/close/${encodeURIComponent(tabId)}`)
}

export async function navigateBrowserLaneCdp(
	cdpEndpoint: string,
	url: string,
	tabId?: string | null,
): Promise<BrowserLaneNavigateResult> {
	const target = await resolvePageTarget(cdpEndpoint, tabId)
	if (!target.webSocketDebuggerUrl) {
		throw new Error("Browser lane page target is missing a CDP websocket URL")
	}
	await sendCdpCommand(target.webSocketDebuggerUrl, "Page.navigate", { url })
	return { targetId: target.id, url }
}

async function fetchCdpHttp(
	url: string,
	init?: RequestInit & { throwOnError?: boolean },
): Promise<Response> {
	const { throwOnError = true, ...requestInit } = init ?? {}
	const response = await fetch(url, {
		...requestInit,
		signal: AbortSignal.timeout(CDP_TIMEOUT_MS),
	})
	if (throwOnError && !response.ok) {
		throw new Error(`Browser lane CDP request failed: ${response.status} ${response.statusText}`)
	}
	return response
}

async function fetchPageTargets(cdpEndpoint: string): Promise<CdpTarget[]> {
	const endpoint = cdpEndpoint.replace(/\/$/, "")
	const response = await fetchCdpHttp(`${endpoint}/json/list`)
	const targets = (await response.json()) as CdpTarget[]
	return targets.filter((target) => target.type === "page")
}

function resolveActiveTabId(targets: CdpTarget[], activeTabId?: string | null): string | null {
	if (activeTabId && targets.some((target) => target.id === activeTabId)) {
		return activeTabId
	}
	return targets[0]?.id ?? null
}

async function resolvePageTarget(cdpEndpoint: string, tabId?: string | null): Promise<CdpTarget> {
	const targets = await fetchPageTargets(cdpEndpoint)
	const page = tabId
		? targets.find((target) => target.id === tabId)
		: targets.find((target) => target.webSocketDebuggerUrl)
	if (!page) {
		throw new Error(tabId ? `Browser lane tab ${tabId} not found` : "Browser lane has no navigable page target")
	}
	if (!page.webSocketDebuggerUrl) {
		throw new Error(`Browser lane tab ${page.id} is missing a CDP websocket URL`)
	}
	return page
}

function toBrowserLaneTab(target: CdpTarget, active: boolean): BrowserLaneTab {
	return {
		id: target.id,
		title: target.title ?? "",
		url: target.url ?? "about:blank",
		type: target.type,
		active,
		attached: target.attached ?? false,
		openerId: target.openerId ?? null,
		faviconUrl: target.faviconUrl ?? null,
	}
}

async function sendCdpCommand(
	webSocketDebuggerUrl: string,
	method: string,
	params: Record<string, unknown>,
): Promise<unknown> {
	const WebSocketImpl = globalThis.WebSocket
	if (!WebSocketImpl) {
		throw new Error("WebSocket unavailable for browser lane CDP navigation")
	}
	return await new Promise<unknown>((resolve, reject) => {
		const ws = new WebSocketImpl(webSocketDebuggerUrl)
		const id = 1
		let settled = false
		const timeout = setTimeout(() => {
			finish(new Error(`Browser lane CDP command timed out: ${method}`))
		}, CDP_TIMEOUT_MS)

		function finish(error: Error | null, result?: unknown) {
			if (settled) return
			settled = true
			clearTimeout(timeout)
			try {
				ws.close()
			} catch {
				// Ignore close errors during cleanup.
			}
			if (error) reject(error)
			else resolve(result)
		}

		ws.addEventListener("open", () => {
			ws.send(JSON.stringify({ id, method, params }))
		})
		ws.addEventListener("message", (event) => {
			if (typeof event.data !== "string") return
			let message: CdpResponse
			try {
				message = JSON.parse(event.data) as CdpResponse
			} catch (error) {
				finish(error instanceof Error ? error : new Error(String(error)))
				return
			}
			if (message.id !== id) return
			if (message.error) {
				finish(new Error(message.error.message || `Browser lane CDP command failed: ${method}`))
				return
			}
			finish(null, message.result)
		})
		ws.addEventListener("error", () => {
			finish(new Error(`Browser lane CDP websocket failed: ${method}`))
		})
		ws.addEventListener("close", () => {
			finish(new Error(`Browser lane CDP websocket closed before response: ${method}`))
		})
	})
}
