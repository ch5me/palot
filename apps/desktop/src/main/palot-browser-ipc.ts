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
	palotComponentsDescribeArgsSchema,
	palotComponentsListArgsSchema,
	palotUiStateSnapshotSchema,
	publishBrowserActionInputSchema,
	sessionBindingSchema,
} from "../shared/palot-bridge-schemas"
import {
	getSessionBindingByOpenCodeSession,
	releaseSessionBinding,
	upsertSessionBinding,
} from "./palot-session-binding"
const componentHandlerLoadPromise = import("./palot-plugin-entry.js") as unknown as Promise<{
	buildComponentsListHandler: () => (args?: unknown) => Promise<string>
	buildComponentsDescribeHandler: () => (args?: unknown) => Promise<string>
}>

export interface PublishBrowserActionInput {
	event: BrowserActionEvent
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

async function broadcastBrowserAction(event: BrowserActionEvent): Promise<void> {
	const electron = (await import("electron")) as { BrowserWindow?: { getAllWindows(): Array<{ webContents: { send(channel: string, payload: BrowserActionEvent): void } }> } }
	const windows = electron.BrowserWindow?.getAllWindows() ?? []
	for (const win of windows) {
		win.webContents.send("palot:browser-actions", event)
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

export async function palotComponentsList(args: unknown): Promise<string> {
	const parsedArgs = palotComponentsListArgsSchema.parse(args ?? {})
	const { buildComponentsListHandler } = await componentHandlerLoadPromise
	return await buildComponentsListHandler()(parsedArgs)
}

export async function palotComponentsDescribe(args: unknown): Promise<string> {
	const parsedArgs = palotComponentsDescribeArgsSchema.parse(args ?? {})
	const { buildComponentsDescribeHandler } = await componentHandlerLoadPromise
	return await buildComponentsDescribeHandler()(parsedArgs)
}

export function releaseSessionBindingBySessionId(sessionId: string): SessionBinding | null {
	return releaseSessionBinding(sessionId)
}
