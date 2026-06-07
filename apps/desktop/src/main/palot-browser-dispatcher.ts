import type { BrowserActionEvent, BrowserLaneTabActionResult } from "../preload/api"
import type { DispatchBrowserToolInput } from "../shared/palot-bridge-schemas"
import { dispatchBrowserToolInputSchema } from "../shared/palot-bridge-schemas"
import {
	activateBrowserLaneTab,
	clickBrowserLane,
	closeBrowserLaneTab,
	createBrowserLaneTab,
	listBrowserLaneTabs,
	navigateBrowserLane,
	scrollBrowserLane,
	typeBrowserLane,
} from "./browser-lane-manager"
import { publishBrowserAction } from "./palot-browser-ipc"
import { resolvePalotSessionBinding } from "./palot-resolver"

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
): Promise<BrowserLaneTabActionResult | ReturnType<typeof listBrowserLaneTabs>> {
	switch (args.action) {
		case "open":
			return await createBrowserLaneTab(laneId, { url: (args.url as string | undefined) ?? "about:blank" })
		case "close":
			return await closeBrowserLaneTab(laneId, String(args.tabId ?? ""))
		case "activate":
			return await activateBrowserLaneTab(laneId, String(args.tabId ?? ""))
		case "list":
		case undefined:
			return await listBrowserLaneTabs(laneId)
		default:
			return await listBrowserLaneTabs(laneId)
	}
}

export async function dispatchBrowserTool(input: DispatchBrowserToolInput): Promise<{ status: string; resultSummary: string }> {
	const parsedInput = dispatchBrowserToolInputSchema.parse(input)
	const resolved = resolvePalotSessionBinding(parsedInput.sessionId)
	if (!resolved.binding?.browserLaneId) {
		return {
			status: "failed",
			resultSummary: "unbound_session",
		}
	}
	await publishBrowserAction({ event: buildToolRequestEvent(parsedInput) })
	let resultSummary = "queued"
	if (parsedInput.toolName === "browser_status") {
		const snapshot = resolvePalotSessionBinding(parsedInput.sessionId)
		resultSummary = JSON.stringify({
			status: snapshot.binding?.status ?? "unbound",
			viewerUrl: snapshot.nonSecretSnapshot?.viewerUrl ?? null,
			currentUrl: snapshot.nonSecretSnapshot?.viewport?.currentUrl ?? null,
		})
	} else if (parsedInput.toolName === "browser_navigate" || parsedInput.toolName === "browser_open") {
		const result = await navigateBrowserLane(
			resolved.binding.browserLaneId,
			String(parsedInput.args.url ?? "about:blank"),
		)
		resultSummary = JSON.stringify(result)
	} else if (parsedInput.toolName === "browser_tabs") {
		const result = await dispatchTabsAction(resolved.binding.browserLaneId, parsedInput.args)
		resultSummary = JSON.stringify(result)
	} else if (parsedInput.toolName === "browser_click") {
		await clickBrowserLane(resolved.binding.browserLaneId, {
			x: Number(parsedInput.args.x ?? 0),
			y: Number(parsedInput.args.y ?? 0),
			button: parsedInput.args.button as "left" | "middle" | "right" | undefined,
			clickCount: parsedInput.args.clickCount as number | undefined,
		})
		resultSummary = JSON.stringify({ status: "completed", action: "click" })
	} else if (parsedInput.toolName === "browser_type") {
		await typeBrowserLane(resolved.binding.browserLaneId, {
			text: String(parsedInput.args.text ?? ""),
			submit: parsedInput.args.submit as boolean | undefined,
		})
		resultSummary = JSON.stringify({ status: "completed", action: "type" })
	} else if (parsedInput.toolName === "browser_scroll") {
		await scrollBrowserLane(resolved.binding.browserLaneId, {
			deltaX: parsedInput.args.deltaX as number | undefined,
			deltaY:
				typeof parsedInput.args.deltaY === "number"
					? parsedInput.args.deltaY
					: parsedInput.args.direction === "up"
						? -Math.abs(Number(parsedInput.args.amount ?? 400))
						: Math.abs(Number(parsedInput.args.amount ?? 400)),
		})
		resultSummary = JSON.stringify({ status: "completed", action: "scroll" })
	}
	await publishBrowserAction({ event: buildToolResultEvent(parsedInput, resultSummary) })
	return {
		status: "queued",
		resultSummary,
	}
}
