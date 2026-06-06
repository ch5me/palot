import type { BrowserActionEvent, BrowserLaneTabActionResult } from "../preload/api"
import {
	activateBrowserLaneTab,
	closeBrowserLaneTab,
	createBrowserLaneTab,
	navigateBrowserLane,
} from "./browser-lane-manager"
import { publishBrowserAction } from "./palot-browser-ipc"
import { resolvePalotSessionBinding } from "./palot-resolver"

export interface DispatchBrowserToolInput {
	sessionId: string
	toolName:
		| "palot_browser_status"
		| "palot_browser_open"
		| "palot_browser_navigate"
		| "palot_browser_tabs"
		| "palot_browser_click"
		| "palot_browser_type"
		| "palot_browser_scroll"
	args: Record<string, unknown>
}

function buildToolRequestEvent(input: DispatchBrowserToolInput): BrowserActionEvent {
	return {
		id: `${input.sessionId}:${input.toolName}:toolRequest`,
		sessionId: input.sessionId,
		laneId: null,
		source: "tool_request",
		sequence: 0,
		requestId: `${input.toolName}:${input.sessionId}`,
		causationId: null,
		toolCallId: null,
		targetDescription: null,
		viewportCoords: null,
		streamGeometrySnapshot: null,
		timestamp: Date.now(),
		durationMs: null,
		status: "queued",
		errorCode: null,
		errorMessage: null,
		kind: "toolRequest",
		toolName: input.toolName,
		argsSummary: JSON.stringify(input.args),
	}
}

function buildToolResultEvent(input: DispatchBrowserToolInput, summary: string): BrowserActionEvent {
	return {
		id: `${input.sessionId}:${input.toolName}:toolResult`,
		sessionId: input.sessionId,
		laneId: null,
		source: "automation_runtime",
		sequence: 0,
		requestId: `${input.toolName}:${input.sessionId}`,
		causationId: null,
		toolCallId: null,
		targetDescription: null,
		viewportCoords: null,
		streamGeometrySnapshot: null,
		timestamp: Date.now(),
		durationMs: null,
		status: "completed",
		errorCode: null,
		errorMessage: null,
		kind: "toolResult",
		toolName: input.toolName,
		resultSummary: summary,
	}
}

async function dispatchTabsAction(
	laneId: string,
	args: Record<string, unknown>,
): Promise<BrowserLaneTabActionResult | unknown> {
	switch (args.action) {
		case "open":
			return await createBrowserLaneTab(laneId, { url: (args.url as string | undefined) ?? "about:blank" })
		case "close":
			return await closeBrowserLaneTab(laneId, String(args.tabId ?? ""))
		case "activate":
			return await activateBrowserLaneTab(laneId, String(args.tabId ?? ""))
		default:
			return { status: "queued", action: "list" }
	}
}

export async function dispatchBrowserTool(input: DispatchBrowserToolInput): Promise<{ status: string; resultSummary: string }> {
	const resolved = resolvePalotSessionBinding(input.sessionId)
	if (!resolved.binding?.browserLaneId) {
		return {
			status: "failed",
			resultSummary: "unbound_session",
		}
	}
	await publishBrowserAction({ event: buildToolRequestEvent(input) })
	let resultSummary = "queued"
	if (input.toolName === "palot_browser_navigate" || input.toolName === "palot_browser_open") {
		const result = await navigateBrowserLane(resolved.binding.browserLaneId, String(input.args.url ?? "about:blank"))
		resultSummary = JSON.stringify(result)
	} else if (input.toolName === "palot_browser_tabs") {
		const result = await dispatchTabsAction(resolved.binding.browserLaneId, input.args)
		resultSummary = JSON.stringify(result)
	}
	await publishBrowserAction({ event: buildToolResultEvent(input, resultSummary) })
	return {
		status: "queued",
		resultSummary,
	}
}
