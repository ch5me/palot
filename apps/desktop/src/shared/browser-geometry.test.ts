import assert from "node:assert/strict"
import test from "node:test"
import {
	BROWSER_DRIFT_TOLERANCE_PX,
	BROWSER_GEOMETRY_FIXTURES,
	BROWSER_GEOMETRY_FALLBACK_LADDER,
	BROWSER_OVERLAY_MIN_FPS,
	BROWSER_REPLAY_P95_LATENCY_MS,
	calculateDriftPx,
	resolveBrowserCoordinatesFromEventCoords,
	resolveBrowserCoordinatesFromLastGoodCursor,
	resolveBrowserCoordinatesFromPageRect,
} from "./browser-geometry"

test("page rect fixture roundtrips for iframe zoomed and scroll anchored cases", () => {
	for (const fixture of BROWSER_GEOMETRY_FIXTURES) {
		const result = resolveBrowserCoordinatesFromPageRect({
			domRect: fixture.domRect,
			stream: fixture.stream,
			panel: fixture.panel,
		})
		assert.equal(result.x, fixture.expected.x)
		assert.equal(result.y, fixture.expected.y)
		assert.equal(result.caretConfidence, fixture.expected.caretConfidence)
	}
})

test("event coords fallback uses best-effort badge", () => {
	const fixture = BROWSER_GEOMETRY_FIXTURES[0]
	assert.ok(fixture)
	const result = resolveBrowserCoordinatesFromEventCoords({
		eventCoords: { x: 300, y: 120 },
		stream: fixture.stream,
		panel: fixture.panel,
	})
	assert.equal(result.fallbackLevel, 2)
	assert.equal(result.caretConfidence, "low")
	assert.equal(result.showBestEffortBadge, true)
})

test("last good cursor fallback keeps previous coordinate and no confidence", () => {
	const result = resolveBrowserCoordinatesFromLastGoodCursor({
		lastGoodCursor: { x: 10, y: 20 },
	})
	assert.equal(result.x, 10)
	assert.equal(result.y, 20)
	assert.equal(result.caretConfidence, "none")
	assert.equal(result.fallbackLevel, 3)
})

test("drift tolerance and perf targets stay documented in code", () => {
	assert.equal(BROWSER_DRIFT_TOLERANCE_PX, 4)
	assert.equal(BROWSER_OVERLAY_MIN_FPS, 30)
	assert.equal(BROWSER_REPLAY_P95_LATENCY_MS, 200)
	assert.equal(BROWSER_GEOMETRY_FALLBACK_LADDER.length, 3)
	assert.equal(calculateDriftPx({ x: 0, y: 0 }, { x: 3, y: 4 }), 5)
})
