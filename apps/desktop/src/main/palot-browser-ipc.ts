import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import type {
	BrowserActionEvent,
	BrowserLaneHealth,
	BrowserStateSnapshot,
	PalotUiStateSnapshot,
	SessionBinding,
	SidePanelTabId,
} from "../preload/api"
import {
	browserStateSnapshotSchema,
	dispatchBrowserToolInputSchema,
	palotOpenSidePanelInputSchema,
	palotUiStateSnapshotSchema,
	publishBrowserActionInputSchema,
	sessionBindingSchema,
} from "../shared/palot-bridge-schemas"
import {
	getSessionBindingByOpenCodeSession,
	releaseSessionBinding,
	upsertSessionBinding,
} from "./palot-session-binding"

export interface PublishBrowserActionInput {
	event: BrowserActionEvent
}

export interface PalotBridgeServer {
	host: string
	port: number
	path: string
	token: string
}

type BrowserWindowLike = {
	webContents: {
		send(channel: string, payload: unknown): void
	}
}

type BrowserWindowProvider = () => BrowserWindowLike[]

function nextSequence(sessionId: string): number {
	const next = (sequenceBySession.get(sessionId) ?? 0) + 1
	sequenceBySession.set(sessionId, next)
	return next
}

function shouldRejectForTakeover(event: BrowserActionEvent): boolean {
	return humanTakeoverPaused && event.kind === "toolRequest"
}

function normalizePublishedEvent(event: BrowserActionEvent): BrowserActionEvent {
	const existing = actionEvents.find(
		(entry) => entry.sessionId === event.sessionId && entry.sequence === event.sequence,
	)
	if (existing) {
		return existing
	}
	if (event.kind === "humanTakeoverPaused") {
		humanTakeoverPaused = true
	}
	if (event.kind === "humanTakeoverResumed") {
		humanTakeoverPaused = false
	}
	if (shouldRejectForTakeover(event)) {
		return {
			...event,
			status: "failed",
			errorCode: "human_in_control",
			errorMessage: "Human takeover is active",
			sequence: nextSequence(event.sessionId),
		}
	}
	const next = nextSequence(event.sessionId)
	if (event.sequence >= next) {
		sequenceBySession.set(event.sessionId, event.sequence)
		return event
	}
	return { ...event, sequence: next }
}

export function getBrowserActionEvents(sessionId?: string): BrowserActionEvent[] {
	const events = sessionId ? actionEvents.filter((event) => event.sessionId === sessionId) : actionEvents
	return [...events]
}

export function isHumanTakeoverPaused(): boolean {
	return humanTakeoverPaused
}

const actionEvents: BrowserActionEvent[] = []
const MAX_ACTION_EVENTS = 50
const sequenceBySession = new Map<string, number>()
const BRIDGE_PATH = "/palot-bridge"
let humanTakeoverPaused = false
let browserWindowsProvider: () => Array<{ webContents: { send(channel: string, payload: unknown): void } }> =
	() => []
let bridgeServerPromise: Promise<PalotBridgeServer> | null = null
let uiStateSnapshot: PalotUiStateSnapshot = {
	sidePanel: {
		open: false,
		activeTab: null,
		availableTabs: [],
	},
}
const laneSnapshots = new Map<
	string,
	{
		currentUrl: string | null
		streamUrl: string | null
		health: BrowserLaneHealth | null
		viewportWidth: number | null
		viewportHeight: number | null
	}
>()
let browserWindowProvider: BrowserWindowProvider | null = null
let palotBridgeServer: (PalotBridgeServer & { server: Server }) | null = null

export function registerPalotBrowserWindows(
	provider: () => Array<{ webContents: { send(channel: string, payload: unknown): void } }>,
): void {
	browserWindowsProvider = provider
}

function getBrowserWindows() {
	return browserWindowsProvider()
}

async function broadcastBrowserAction(event: BrowserActionEvent): Promise<void> {
	const windows = await getPalotBrowserWindows()
	for (const win of windows) {
		win.webContents.send("palot:browser-actions", event)
	}
}

async function getPalotBrowserWindows(): Promise<BrowserWindowLike[]> {
	if (browserWindowProvider) return browserWindowProvider()
	const electron = (await import("electron")) as {
		BrowserWindow?: { getAllWindows(): BrowserWindowLike[] }
	}
	return electron.BrowserWindow?.getAllWindows() ?? []
}

export function registerPalotBrowserWindows(provider: BrowserWindowProvider): void {
	browserWindowProvider = provider
}

export async function broadcastOpenSidePanel(tab: SidePanelTabId): Promise<void> {
	const parsedTab = palotOpenSidePanelInputSchema.parse(tab)
	const windows = await getPalotBrowserWindows()
	for (const win of windows) {
		win.webContents.send("palot:open-side-panel", parsedTab)
	}
}

export function setBrowserLaneSnapshot(input: {
	laneId: string
	currentUrl?: string | null
	streamUrl?: string | null
	health?: BrowserLaneHealth | null
	viewportWidth?: number | null
	viewportHeight?: number | null
}): void {
	const existing = laneSnapshots.get(input.laneId)
	laneSnapshots.set(input.laneId, {
		currentUrl: input.currentUrl ?? existing?.currentUrl ?? null,
		streamUrl: input.streamUrl ?? existing?.streamUrl ?? null,
		health: input.health ?? existing?.health ?? null,
		viewportWidth: input.viewportWidth ?? existing?.viewportWidth ?? null,
		viewportHeight: input.viewportHeight ?? existing?.viewportHeight ?? null,
	})
}

export function getBrowserStateSnapshot(sessionId: string): BrowserStateSnapshot {
	const binding = getSessionBindingByOpenCodeSession(sessionId)
	const laneSnapshot = binding?.browserLaneId ? laneSnapshots.get(binding.browserLaneId) : null
	return browserStateSnapshotSchema.parse({
		sessionId,
		activeLaneId: binding?.browserLaneId ?? null,
		magicBrowserSessionId: binding?.magicBrowserSessionId ?? null,
		viewerUrl: laneSnapshot?.streamUrl ?? null,
		binding,
		health: laneSnapshot?.health ?? null,
		lastActions: actionEvents.filter((event) => event.sessionId === sessionId).slice(-8),
		viewport: laneSnapshot
			? {
				currentUrl: laneSnapshot.currentUrl,
				streamUrl: laneSnapshot.streamUrl,
				viewportWidth: laneSnapshot.viewportWidth,
				viewportHeight: laneSnapshot.viewportHeight,
			}
			: null,
	})
}

export async function publishBrowserAction(input: PublishBrowserActionInput): Promise<BrowserActionEvent> {
	const parsedInput = publishBrowserActionInputSchema.parse(input)
	const event = normalizePublishedEvent(parsedInput.event)
	const duplicate = actionEvents.find(
		(entry) => entry.sessionId === event.sessionId && entry.sequence === event.sequence,
	)
	if (duplicate) {
		return duplicate
	}
	actionEvents.push(event)
	if (actionEvents.length > MAX_ACTION_EVENTS) {
		actionEvents.splice(0, actionEvents.length - MAX_ACTION_EVENTS)
	}
	await broadcastBrowserAction(event)
	return event
}

export async function ensurePalotBridgeServer(): Promise<PalotBridgeServer> {
	if (palotBridgeServer) return toBridgeServerInfo(palotBridgeServer)

	const token = randomBytes(24).toString("base64url")
	const server = createServer((req, res) => {
		void handleBridgeHttpRequest(req, res, token).catch((err) => {
			sendJson(res, 500, {
				ok: false,
				error: { message: err instanceof Error ? err.message : "Bridge request failed" },
			})
		})
	})

	await new Promise<void>((resolve, reject) => {
		server.once("error", reject)
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject)
			resolve()
		})
	})

	const address = server.address()
	if (!address || typeof address === "string") {
		server.close()
		throw new Error("Palot bridge server did not bind to a TCP port")
	}
	server.unref()
	palotBridgeServer = {
		server,
		host: "127.0.0.1",
		port: address.port,
		path: BRIDGE_PATH,
		token,
	}
	return toBridgeServerInfo(palotBridgeServer)
}

function toBridgeServerInfo(server: PalotBridgeServer & { server: Server }): PalotBridgeServer {
	return {
		host: server.host,
		port: server.port,
		path: server.path,
		token: server.token,
	}
}

async function handleBridgeHttpRequest(
	req: IncomingMessage,
	res: ServerResponse,
	token: string,
): Promise<void> {
	const url = new URL(req.url ?? "/", "http://127.0.0.1")
	if (req.method !== "POST" || url.pathname !== BRIDGE_PATH) {
		sendJson(res, 404, { ok: false, error: { message: "Unknown Palot bridge endpoint" } })
		return
	}
	if (req.headers["x-palot-bridge-key"] !== token) {
		sendJson(res, 403, { ok: false, error: { message: "Invalid Palot bridge token" } })
		return
	}
	const payload = await readJsonBody(req)
	const result = await handleBridgePayload(payload)
	sendJson(res, 200, { ok: true, result })
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = []
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
	}
	if (chunks.length === 0) return null
	return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
	if (res.headersSent) return
	res.writeHead(statusCode, { "content-type": "application/json" })
	res.end(JSON.stringify(payload))
}

async function handleBridgePayload(payload: unknown): Promise<unknown> {
	const action = typeof payload === "object" && payload ? (payload as { action?: unknown }).action : null
	if (action === "resolve-binding") return resolveBridgeBinding(payload)
	if (action === "dispatch-browser-tool") return await dispatchBridgeBrowserTool(payload)
	if (action === "open-side-panel") return await openBridgeSidePanel(payload)
	if (action === "get-ui-state") return getUiStateSnapshot()
	if (action === "list-plugin-tools") return await listBridgePluginTools()
	if (action === "invoke-plugin-tool") return await invokeBridgePluginTool(payload)
	throw new Error("Unsupported Palot bridge action")
}

// ---------------------------------------------------------------------------
// V2 plugin catalog tool projection over the bridge
//
// The OpenCode plugin (`palot-plugin/plugin.js`) runs in the OpenCode
// process and cannot read the catalog directly. These two actions are
// the seam: `list-plugin-tools` projects every available catalog tool
// (`plugin.<id>.*`) with a JSON-Schema args description, and
// `invoke-plugin-tool` routes execution back through the host's
// `invokePluginTool` (manifest lookup → broker → Zod validation →
// registered host handler). Disabled/quarantined plugins are filtered
// at list time AND re-checked at invoke time by the dispatcher.
// ---------------------------------------------------------------------------

export interface BridgePluginToolDefinition {
	readonly pluginId: string
	readonly toolId: string
	readonly title: string
	readonly description: string
	readonly scope: "session" | "project" | "app"
	readonly timeoutMs: number
	readonly argsJsonSchema: Record<string, unknown>
}

export async function listBridgePluginTools(): Promise<{
	tools: BridgePluginToolDefinition[]
}> {
	// Dynamic imports: firefly-plugin/dispatch lazily imports THIS module
	// for the notes host handlers, so a static import would be a cycle.
	const { getPluginCatalog } = await import("./firefly-plugin/authority")
	const { projectBridgeToolDefinitions } = await import(
		"../shared/firefly-plugin/bridge-projection"
	)
	const catalog = getPluginCatalog()
	const tools: BridgePluginToolDefinition[] = []
	for (const descriptor of catalog.descriptors) {
		const state = catalog.capabilityStates[descriptor.normalizedId]
		if (state?.pluginDisabled || state?.pluginQuarantined) continue
		for (const def of projectBridgeToolDefinitions(descriptor)) {
			let argsJsonSchema: Record<string, unknown>
			try {
				argsJsonSchema = z.toJSONSchema(def.argsSchema, { io: "input" }) as Record<
					string,
					unknown
				>
			} catch (err) {
				// One unrepresentable arg schema must not hide every other
				// catalog tool — skip THIS tool, loudly. The manifest author
				// sees the omission in the OpenCode tool list and this log.
				const { createLogger } = await import("./logger")
				createLogger("palot-bridge").warn("Skipping plugin tool: args schema is not JSON-Schema representable", {
					pluginId: def.pluginId,
					toolId: def.id,
					reason: err instanceof Error ? err.message : String(err),
				})
				continue
			}
			tools.push({
				pluginId: def.pluginId,
				toolId: def.id,
				title: def.title,
				description: def.description,
				scope: def.scope,
				timeoutMs: def.timeoutMs,
				argsJsonSchema,
			})
		}
	}
	return { tools }
}

const invokeBridgePluginToolSchema = z.object({
	action: z.literal("invoke-plugin-tool"),
	pluginId: z.string().min(1).max(128),
	toolId: z.string().min(1).max(256),
	args: z.record(z.string(), z.unknown()).optional(),
	sessionId: z.string().nullable().optional(),
})

async function invokeBridgePluginTool(payload: unknown): Promise<unknown> {
	const input = invokeBridgePluginToolSchema.parse(payload)
	const { invokePluginTool } = await import("./firefly-plugin/dispatch")
	return invokePluginTool({
		pluginId: input.pluginId,
		toolId: input.toolId,
		args: input.args ?? {},
		sessionId: input.sessionId ?? null,
	})
}

function resolveBridgeBinding(payload: unknown): unknown {
	const sessionId = typeof (payload as { sessionId?: unknown })?.sessionId === "string"
		? (payload as { sessionId: string }).sessionId
		: null
	if (!sessionId) return null
	const binding = getSessionBinding(sessionId)
	return {
		binding,
		nonSecretSnapshot: getBrowserStateSnapshot(sessionId),
		opaqueActionTarget: binding
			? {
				bindingId: binding.id,
				laneId: binding.browserLaneId,
				magicBrowserSessionId: binding.magicBrowserSessionId,
			}
			: null,
		uiState: getUiStateSnapshot(),
	}
}

async function dispatchBridgeBrowserTool(payload: unknown): Promise<unknown> {
	const input = dispatchBrowserToolInputSchema.parse(payload)
	// Dynamic import: palot-browser-dispatcher statically imports publishBrowserAction
	// from this module, so a static import here would create a cycle.
	const { dispatchBrowserTool } = await import("./palot-browser-dispatcher")
	const result = await dispatchBrowserTool(input)
	return { ...result, toolName: input.toolName }
}

async function openBridgeSidePanel(payload: unknown): Promise<PalotUiStateSnapshot> {
	const tab = palotOpenSidePanelInputSchema.parse((payload as { tab?: unknown })?.tab)
	const snapshot = setUiStateSnapshot({
		sidePanel: {
			open: true,
			activeTab: tab,
		},
	})
	await broadcastOpenSidePanel(tab)
	return snapshot
}

export function getSessionBinding(sessionId: string): SessionBinding | null {
	const binding = getSessionBindingByOpenCodeSession(sessionId)
	return binding ? sessionBindingSchema.parse(binding) : null
}

export function getUiStateSnapshot(): PalotUiStateSnapshot {
	return palotUiStateSnapshotSchema.parse({
		sidePanel: {
			open: uiStateSnapshot.sidePanel.open,
			activeTab: uiStateSnapshot.sidePanel.activeTab,
			availableTabs: [...uiStateSnapshot.sidePanel.availableTabs],
		},
	})
}

export function setUiStateSnapshot(input: {
	sidePanel?: {
		open?: boolean
		activeTab?: SidePanelTabId | null
		availableTabs?: SidePanelTabId[]
	}
}): PalotUiStateSnapshot {
	uiStateSnapshot = {
		sidePanel: {
			open: input.sidePanel?.open ?? uiStateSnapshot.sidePanel.open,
			activeTab: input.sidePanel?.activeTab ?? uiStateSnapshot.sidePanel.activeTab,
			availableTabs:
				input.sidePanel?.availableTabs ? [...input.sidePanel.availableTabs] : [...uiStateSnapshot.sidePanel.availableTabs],
		},
	}
	return getUiStateSnapshot()
}

export function setSessionBinding(binding: SessionBinding): SessionBinding {
	return upsertSessionBinding(sessionBindingSchema.parse(binding))
}

export function releaseSessionBindingBySessionId(sessionId: string): SessionBinding | null {
	return releaseSessionBinding(sessionId)
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = []
	for await (const chunk of req) {
		chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
	}
	return Buffer.concat(chunks).toString("utf-8")
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
	res.statusCode = statusCode
	res.setHeader("content-type", "application/json")
	res.end(JSON.stringify(payload))
}

async function handleBridgeRequest(payload: Record<string, unknown>) {
	const action = typeof payload.action === "string" ? payload.action : null
	if (action === "resolve-binding") {
		const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : ""
		return {
			binding: getSessionBinding(sessionId),
			nonSecretSnapshot: getBrowserStateSnapshot(sessionId),
			uiState: getUiStateSnapshot(),
			connections: [],
		}
	}
	if (action === "get-ui-state") {
		return getUiStateSnapshot()
	}
	if (action === "open-side-panel") {
		const tab = typeof payload.tab === "string" ? payload.tab : null
		if (!tab) {
			throw new Error("tab is required")
		}
		const snapshot = setUiStateSnapshot({
			sidePanel: {
				open: true,
				activeTab: tab as SidePanelTabId,
			},
		})
		broadcastOpenSidePanel(tab as SidePanelTabId)
		return snapshot
	}
	if (action === "dispatch-browser-tool") {
		const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : ""
		const toolName = typeof payload.toolName === "string" ? payload.toolName : "unknown"
		const snapshot = getBrowserStateSnapshot(sessionId)
		const resultSummary = JSON.stringify({
			currentUrl: snapshot.viewport?.currentUrl ?? null,
			viewerUrl: snapshot.viewerUrl ?? null,
		})
		const requestId = `${toolName}:${sessionId || "unknown"}`
		await publishBrowserAction({
			event: {
				id: randomUUID(),
				kind: "toolRequest",
				sessionId,
				laneId: snapshot.activeLaneId,
				source: "tool_request",
				sequence: Number.MAX_SAFE_INTEGER,
				requestId,
				causationId: null,
				targetDescription: null,
				viewportCoords: null,
				streamGeometrySnapshot: null,
				timestamp: Date.now(),
				durationMs: null,
				status: "queued",
				toolName,
				argsSummary: JSON.stringify(payload.args ?? {}),
			},
		})
		await publishBrowserAction({
			event: {
				id: randomUUID(),
				kind: "toolResult",
				sessionId,
				laneId: snapshot.activeLaneId,
				source: "tool_request",
				sequence: Number.MAX_SAFE_INTEGER,
				requestId,
				causationId: requestId,
				targetDescription: null,
				viewportCoords: null,
				streamGeometrySnapshot: null,
				timestamp: Date.now(),
				durationMs: 0,
				status: "completed",
				toolName,
				resultSummary,
			},
		})
		return {
			status: "queued",
			toolName,
			requestId,
			resultSummary,
		}
	}
	throw new Error(`Unsupported bridge action: ${action ?? "unknown"}`)
}

export async function ensurePalotBridgeServer(): Promise<PalotBridgeServer> {
	if (bridgeServerPromise) {
		return bridgeServerPromise
	}
	bridgeServerPromise = new Promise((resolve, reject) => {
		const token = randomUUID()
		const path = "/palot-bridge"
		const server = createServer(async (req, res) => {
			if (req.method !== "POST" || req.url !== path) {
				writeJson(res, 404, { ok: false, error: { message: "Not found" } })
				return
			}
			if (req.headers["x-palot-bridge-key"] !== token) {
				writeJson(res, 401, { ok: false, error: { message: "Unauthorized" } })
				return
			}
			try {
				const body = await readRequestBody(req)
				const payload = body ? JSON.parse(body) as Record<string, unknown> : {}
				const result = await handleBridgeRequest(payload)
				writeJson(res, 200, { ok: true, result })
			} catch (error) {
				writeJson(res, 500, {
					ok: false,
					error: { message: error instanceof Error ? error.message : String(error) },
				})
			}
		})
		server.once("error", (error) => {
			bridgeServerPromise = null
			reject(error)
		})
		server.listen(0, "127.0.0.1", () => {
			const address = server.address()
			if (!address || typeof address === "string") {
				bridgeServerPromise = null
				reject(new Error("Palot bridge failed to bind"))
				return
			}
			resolve({
				host: "127.0.0.1",
				port: address.port,
				path,
				token,
			})
		})
	})
	return bridgeServerPromise
}
