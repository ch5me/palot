import type {
	BrowserCoordinateTransformResult,
	BrowserGeometryFixture,
	DomRectSnapshot,
	PanelGeometrySnapshot,
	StreamGeometrySnapshot,
} from "../preload/api"

export const BROWSER_EVENT_BURST_CAP_PER_BINDING = 200
export const BROWSER_OVERLAY_MIN_FPS = 30
export const BROWSER_REPLAY_P95_LATENCY_MS = 200
export const BROWSER_DRIFT_TOLERANCE_PX = 4

export const BROWSER_GEOMETRY_FALLBACK_LADDER = [
	"page_rect_high_confidence",
	"stream_transform_low_confidence",
	"last_good_cursor_no_confidence",
] as const

export function domRectToViewportCenter(rect: DomRectSnapshot): { x: number; y: number } {
	return {
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2,
	}
}

export function pageViewportToStreamViewport(
	coords: { x: number; y: number },
	stream: StreamGeometrySnapshot,
): { x: number; y: number } {
	return {
		x: (coords.x - stream.scrollX) * stream.zoom,
		y: (coords.y - stream.scrollY) * stream.zoom,
	}
}

export function streamViewportToPanelViewport(
	coords: { x: number; y: number },
	stream: StreamGeometrySnapshot,
	panel: PanelGeometrySnapshot,
): { x: number; y: number } {
	const widthScale = panel.scaleX || (stream.viewportWidth === 0 ? 1 : panel.viewportWidth / stream.viewportWidth)
	const heightScale = panel.scaleY || (stream.viewportHeight === 0 ? 1 : panel.viewportHeight / stream.viewportHeight)
	return {
		x: panel.offsetLeft + coords.x * widthScale,
		y: panel.offsetTop + coords.y * heightScale,
	}
}

export function calculateDriftPx(
	a: { x: number; y: number },
	b: { x: number; y: number },
): number {
	return Math.hypot(a.x - b.x, a.y - b.y)
}

export function resolveBrowserCoordinatesFromPageRect(input: {
	domRect: DomRectSnapshot
	stream: StreamGeometrySnapshot
	panel: PanelGeometrySnapshot
}): BrowserCoordinateTransformResult {
	const viewport = domRectToViewportCenter(input.domRect)
	const streamCoords = pageViewportToStreamViewport(viewport, input.stream)
	const panelCoords = streamViewportToPanelViewport(streamCoords, input.stream, input.panel)
	return {
		x: panelCoords.x,
		y: panelCoords.y,
		caretConfidence: "high",
		fallbackLevel: 1,
		showBestEffortBadge: false,
	}
}

export function resolveBrowserCoordinatesFromEventCoords(input: {
	eventCoords: { x: number; y: number }
	stream: StreamGeometrySnapshot
	panel: PanelGeometrySnapshot
}): BrowserCoordinateTransformResult {
	const panelCoords = streamViewportToPanelViewport(input.eventCoords, input.stream, input.panel)
	return {
		x: panelCoords.x,
		y: panelCoords.y,
		caretConfidence: "low",
		fallbackLevel: 2,
		showBestEffortBadge: true,
	}
}

export function resolveBrowserCoordinatesFromLastGoodCursor(input: {
	lastGoodCursor: { x: number; y: number }
}): BrowserCoordinateTransformResult {
	return {
		x: input.lastGoodCursor.x,
		y: input.lastGoodCursor.y,
		caretConfidence: "none",
		fallbackLevel: 3,
		showBestEffortBadge: true,
	}
}

export const BROWSER_GEOMETRY_FIXTURES: BrowserGeometryFixture[] = [
	{
		name: "iframe-zoomed",
		domRect: { left: 120, top: 240, width: 200, height: 80 },
		stream: {
			viewportWidth: 1280,
			viewportHeight: 720,
			scrollX: 0,
			scrollY: 100,
			panelWidth: 960,
			panelHeight: 540,
			zoom: 1.25,
		},
		panel: {
			viewportWidth: 960,
			viewportHeight: 540,
			offsetLeft: 12,
			offsetTop: 16,
			scaleX: 0.75,
			scaleY: 0.75,
		},
		expected: {
			x: 218.25,
			y: 184.75,
			caretConfidence: "high",
			fallbackLevel: 1,
			showBestEffortBadge: false,
		},
	},
	{
		name: "scroll-anchored",
		domRect: { left: 40, top: 680, width: 160, height: 40 },
		stream: {
			viewportWidth: 1024,
			viewportHeight: 768,
			scrollX: 0,
			scrollY: 640,
			panelWidth: 512,
			panelHeight: 384,
			zoom: 1,
		},
		panel: {
			viewportWidth: 512,
			viewportHeight: 384,
			offsetLeft: 0,
			offsetTop: 0,
			scaleX: 0.5,
			scaleY: 0.5,
		},
		expected: {
			x: 60,
			y: 30,
			caretConfidence: "high",
			fallbackLevel: 1,
			showBestEffortBadge: false,
		},
	},
]
