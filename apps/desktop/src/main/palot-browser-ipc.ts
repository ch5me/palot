import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import { randomUUID } from "node:crypto"

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

export function registerPalotBrowserWindows(
	provider: () => Array<{ webContents: { send(channel: string, payload: unknown): void } }>,
): void {
	browserWindowsProvider = provider
}

function getBrowserWindows() {
	return browserWindowsProvider()
}

async function broadcastBrowserAction(event: BrowserActionEvent): Promise<void> {
	for (const win of getBrowserWindows()) {
		win.webContents.send("palot:browser-actions", event)
	}
}

export function broadcastOpenSidePanel(tab: SidePanelTabId): void {
	for (const win of getBrowserWindows()) {
		win.webContents.send("palot:open-side-panel", { tab })
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
