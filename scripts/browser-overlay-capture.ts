import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { BrowserActionEvent } from "../apps/desktop/src/preload/api"
import { BrowserCursorOverlay } from "../apps/desktop/src/renderer/components/side-panel/browser-cursor-overlay"

const outputDir = path.join(process.cwd(), ".sisyphus", "evidence", "final-qa")
mkdirSync(outputDir, { recursive: true })

const events: BrowserActionEvent[] = [
	{
		id: "evt-a",
		sessionId: "ses_capture",
		laneId: "lane_capture",
		source: "tool_request",
		sequence: 1,
		requestId: null,
		causationId: null,
		toolCallId: null,
		targetDescription: null,
		viewportCoords: { x: 100, y: 140 },
		streamGeometrySnapshot: null,
		timestamp: 1,
		durationMs: null,
		status: "queued",
		errorCode: null,
		errorMessage: null,
		kind: "move",
	},
	{
		id: "evt-b",
		sessionId: "ses_capture",
		laneId: "lane_capture",
		source: "tool_request",
		sequence: 2,
		requestId: null,
		causationId: null,
		toolCallId: null,
		targetDescription: null,
		viewportCoords: { x: 130, y: 170 },
		streamGeometrySnapshot: null,
		timestamp: 2,
		durationMs: null,
		status: "queued",
		errorCode: null,
		errorMessage: null,
		kind: "click",
		button: "left",
		clickCount: 1,
	},
]

const html = renderToStaticMarkup(
	createElement(BrowserCursorOverlay, {
		events,
		overlayState: {
			activeSessionId: "ses_capture",
			frozen: false,
			showBestEffortBadge: false,
			showHumanControlBadge: false,
			showDriftBadge: false,
			lastEvent: events[1] ?? null,
		},
		sessionId: "ses_capture",
	}),
)

const outputPath = path.join(outputDir, "browser-overlay-capture.html")
writeFileSync(outputPath, html, "utf-8")

const cursorExists = html.includes("Click · left") && html.includes("2. Click · left")
if (!cursorExists) {
	throw new Error("Overlay capture assertion failed")
}

console.log(outputPath)
