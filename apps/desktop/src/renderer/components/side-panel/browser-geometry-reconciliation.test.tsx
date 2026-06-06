import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { BrowserCursorOverlay } from "./browser-cursor-overlay"

const sessionId = "ses_reconcile"
const baseEvent = {
	id: "evt-a",
	sessionId,
	laneId: "lane_reconcile",
	source: "tool_request",
	sequence: 1,
	requestId: null,
	causationId: null,
	toolCallId: null,
	targetDescription: null,
	viewportCoords: { x: 0, y: 0 },
	streamGeometrySnapshot: null,
	timestamp: 1,
	durationMs: null,
	status: "queued",
	errorCode: null,
	errorMessage: null,
	kind: "move",
} as const

describe("browser geometry reconciliation", () => {
	test("shows drift badge when cursor jumps beyond tolerance", () => {
		const drifted = { ...baseEvent, id: "evt-b", sequence: 2, viewportCoords: { x: 20, y: 20 } }
		const html = renderToStaticMarkup(
			<BrowserCursorOverlay
				events={[baseEvent, drifted]}
				overlayState={{
					activeSessionId: sessionId,
					frozen: false,
					showBestEffortBadge: false,
					showHumanControlBadge: false,
					showDriftBadge: false,
					lastEvent: drifted,
				}}
				sessionId={sessionId}
			/>,
		)
		expect(html).toContain("Drift detected")
	})

	test("hides overlay when active session does not match", () => {
		const html = renderToStaticMarkup(
			<BrowserCursorOverlay
				events={[baseEvent]}
				overlayState={{
					activeSessionId: "ses_other",
					frozen: false,
					showBestEffortBadge: false,
					showHumanControlBadge: false,
					showDriftBadge: false,
					lastEvent: baseEvent,
				}}
				sessionId={sessionId}
			/>,
		)
		expect(html).toBe("<div class=\"hidden\"></div>")
	})
})
