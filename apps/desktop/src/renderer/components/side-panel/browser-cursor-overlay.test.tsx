import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { Actor, BrowserActionClickEvent, BrowserActionMoveEvent, BrowserActionTypeEvent } from "../../../preload/api"
import { BrowserCursorOverlay } from "./browser-cursor-overlay"

const baseEvent: BrowserActionMoveEvent = {
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

const baseOverlayState = {
	activeSessionId: null,
	frozen: false,
	showBestEffortBadge: false,
	showHumanControlBadge: false,
	showDriftBadge: false,
	lastEvent: baseEvent,
}

describe("browser cursor overlay", () => {
	test("two actors render with distinct colors and names", () => {
		const actorA: Actor = { id: "act-A", displayName: "Agent Alpha", cursorColor: "#ff0000", kind: "main" }
		const actorB: Actor = { id: "act-B", displayName: "Agent Beta", cursorColor: "#0000ff", kind: "sub" }

		const eventA: BrowserActionMoveEvent = { ...baseEvent, id: "evt-A", sessionId: "ses-A", actor: actorA, viewportCoords: { x: 50, y: 60 } }
		const eventB: BrowserActionMoveEvent = { ...baseEvent, id: "evt-B", sessionId: "ses-B", actor: actorB, viewportCoords: { x: 80, y: 90 } }

		const htmlA = renderToStaticMarkup(
			<BrowserCursorOverlay
				events={[eventA]}
				overlayState={{ ...baseOverlayState, lastEvent: eventA }}
				sessionId="ses-A"
				actor={actorA}
			/>,
		)
		const htmlB = renderToStaticMarkup(
			<BrowserCursorOverlay
				events={[eventB]}
				overlayState={{ ...baseOverlayState, lastEvent: eventB }}
				sessionId="ses-B"
				actor={actorB}
			/>,
		)

		// Each overlay carries its actor's color
		expect(htmlA).toContain("#ff0000")
		expect(htmlB).toContain("#0000ff")
		// Each overlay carries its actor's name
		expect(htmlA).toContain("Agent Alpha")
		expect(htmlB).toContain("Agent Beta")
		// No cross-contamination
		expect(htmlA).not.toContain("#0000ff")
		expect(htmlA).not.toContain("Agent Beta")
		expect(htmlB).not.toContain("#ff0000")
		expect(htmlB).not.toContain("Agent Alpha")
	})

	test("shows best-effort and human badges when state asks for them", () => {
		const html = renderToStaticMarkup(
			<BrowserCursorOverlay
				events={[baseEvent]}
				overlayState={{
					activeSessionId: null,
					frozen: true,
					showBestEffortBadge: true,
					showHumanControlBadge: true,
					showDriftBadge: false,
					lastEvent: baseEvent,
				}}
				sessionId="ses_overlay"
			/>,
		)
		expect(html).toContain("Best-effort overlay")
		expect(html).toContain("Human in control")
	})

	test("renders type label, click ripple, and drift badge when events indicate them", () => {
		const typeEvent: BrowserActionTypeEvent = {
			...baseEvent,
			id: "evt-2",
			kind: "type",
			text: "hello",
			caretConfidence: "low",
			viewportCoords: { x: 100, y: 120 },
		}
		const clickEvent: BrowserActionClickEvent = {
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
					showDriftBadge: false,
					lastEvent: clickEvent,
				}}
				sessionId="ses_overlay"
			/>,
		)
		expect(html).toContain("Drift detected")
		expect(html).toContain("Click · left")
	})
})
