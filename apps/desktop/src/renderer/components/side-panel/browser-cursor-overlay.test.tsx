import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { BrowserCursorOverlay } from "./browser-cursor-overlay"

const baseEvent = {
	id: "evt-1",
	sessionId: "ses_overlay",
	laneId: "lane_overlay",
	source: "tool_request",
	sequence: 1,
	requestId: null,
	causationId: null,
	toolCallId: null,
	targetDescription: null,
	viewportCoords: { x: 10, y: 20 },
	streamGeometrySnapshot: null,
	timestamp: 1,
	durationMs: null,
	status: "queued",
	errorCode: null,
	errorMessage: null,
	kind: "move",
} as const

describe("browser cursor overlay", () => {
	test("shows best-effort and human badges when state asks for them", () => {
		const html = renderToStaticMarkup(
			<BrowserCursorOverlay
				events={[baseEvent]}
				overlayState={{
					activeSessionId: null,
					frozen: true,
					showBestEffortBadge: true,
					showHumanControlBadge: true,
					lastEvent: baseEvent,
				}}
			/>,
		)
		expect(html).toContain("Best-effort overlay")
		expect(html).toContain("Human in control")
	})

	test("renders type label, click ripple, and drift badge when events indicate them", () => {
		const typeEvent = {
			...baseEvent,
			id: "evt-2",
			kind: "type",
			text: "hello",
			caretConfidence: "low",
			viewportCoords: { x: 100, y: 120 },
		}
		const clickEvent = {
			...baseEvent,
			id: "evt-3",
			sequence: 3,
			kind: "click",
			button: "left",
			clickCount: 1,
			viewportCoords: { x: 120, y: 160 },
		}
		const html = renderToStaticMarkup(
			<BrowserCursorOverlay
				events={[typeEvent, clickEvent]}
				overlayState={{
					activeSessionId: null,
					frozen: false,
					showBestEffortBadge: true,
					showHumanControlBadge: false,
					lastEvent: clickEvent,
				}}
			/>,
		)
		expect(html).toContain("Drift detected")
		expect(html).toContain("Click · left")
	})
})
