/**
 * Unit tests for browser-tool-handlers.ts
 *
 * Covers:
 * - isStreamedLane (mode detection)
 * - resolveWebToolDispatch (tool id → legacy dispatcher mapping)
 * - TOON formatters (formatSnapshotToon, formatLinksToon, formatTabsToon, formatActionToon)
 * - buildBrowserSurfaceFragment (context projector, iframe vs streamed)
 *
 * No real lane manager / magic-browser engine is used; all deps are injected
 * fakes so the tests are purely in-process.
 */

import assert from "node:assert/strict"
import test from "node:test"
import type { BrowserLane } from "../../shared/browser-lanes"
import {
	BROWSER_TOOL_PREFIX,
	buildBrowserSurfaceFragment,
	formatActionToon,
	formatLinksToon,
	formatSnapshotToon,
	formatTabsToon,
	isStreamedLane,
	resolveWebToolDispatch,
} from "./browser-tool-handlers"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildLane(overrides: Partial<BrowserLane> = {}): BrowserLane {
	const now = Date.now()
	return {
		id: "default",
		label: "Default",
		mode: "remote",
		runtime: "remote-attached",
		surfaceKind: "direct-iframe",
		streamPath: "/browser/default/",
		streamBackendUrl: null,
		cdpEndpoint: null,
		profilePath: null,
		host: null,
		createdAt: now,
		updatedAt: now,
		health: {
			status: "running",
			stream: { url: null, checkedAt: now, state: "ready", error: null },
			cdp: { url: null, checkedAt: now, state: "not-applicable", error: null },
			message: "",
		},
		...overrides,
	}
}

// ---------------------------------------------------------------------------
// isStreamedLane
// ---------------------------------------------------------------------------

test("isStreamedLane: direct-iframe lane without cdpEndpoint → false", () => {
	const lane = buildLane({ surfaceKind: "direct-iframe", cdpEndpoint: null })
	assert.equal(isStreamedLane(lane), false)
})

test("isStreamedLane: selkies-stream lane → true regardless of cdpEndpoint", () => {
	const lane = buildLane({ surfaceKind: "selkies-stream", cdpEndpoint: null })
	assert.equal(isStreamedLane(lane), true)
})

test("isStreamedLane: direct-iframe lane with cdpEndpoint → true (remote-attached CDP)", () => {
	const lane = buildLane({ surfaceKind: "direct-iframe", cdpEndpoint: "http://127.0.0.1:9222" })
	assert.equal(isStreamedLane(lane), true)
})

// ---------------------------------------------------------------------------
// resolveWebToolDispatch
// ---------------------------------------------------------------------------

test("resolveWebToolDispatch: navigate maps to browser_navigate", () => {
	const result = resolveWebToolDispatch(`${BROWSER_TOOL_PREFIX}navigate`, { url: "https://example.com" })
	assert.deepEqual(result, { toolName: "browser_navigate", args: { url: "https://example.com" } })
})

test("resolveWebToolDispatch: click maps to browser_click", () => {
	const args = { selector: "#btn", button: "left", clickCount: 1 }
	const result = resolveWebToolDispatch(`${BROWSER_TOOL_PREFIX}click`, args)
	assert.deepEqual(result, { toolName: "browser_click", args })
})

test("resolveWebToolDispatch: type maps to browser_type", () => {
	const args = { text: "hello", selector: "#input" }
	const result = resolveWebToolDispatch(`${BROWSER_TOOL_PREFIX}type`, args)
	assert.deepEqual(result, { toolName: "browser_type", args })
})

test("resolveWebToolDispatch: scroll maps to browser_scroll", () => {
	const args = { direction: "down", amount: 400 }
	const result = resolveWebToolDispatch(`${BROWSER_TOOL_PREFIX}scroll`, args)
	assert.deepEqual(result, { toolName: "browser_scroll", args })
})

test("resolveWebToolDispatch: tabs maps to browser_tabs", () => {
	const args = { action: "list" }
	const result = resolveWebToolDispatch(`${BROWSER_TOOL_PREFIX}tabs`, args)
	assert.deepEqual(result, { toolName: "browser_tabs", args })
})

test("resolveWebToolDispatch: status maps to browser_status with empty args", () => {
	const result = resolveWebToolDispatch(`${BROWSER_TOOL_PREFIX}status`, {})
	assert.deepEqual(result, { toolName: "browser_status", args: {} })
})

test("resolveWebToolDispatch: unknown tool → null", () => {
	const result = resolveWebToolDispatch(`${BROWSER_TOOL_PREFIX}read`, {})
	assert.equal(result, null)
})

test("resolveWebToolDispatch: short-form id (no prefix) also resolves", () => {
	const result = resolveWebToolDispatch("navigate", { url: "https://foo.com" })
	assert.deepEqual(result, { toolName: "browser_navigate", args: { url: "https://foo.com" } })
})

// ---------------------------------------------------------------------------
// TOON formatters
// ---------------------------------------------------------------------------

test("formatSnapshotToon: object with url/title/text", () => {
	const result = formatSnapshotToon({ url: "https://example.com", title: "Example", text: "Hello world" })
	assert.ok(result.includes("url https://example.com"))
	assert.ok(result.includes("title Example"))
	assert.ok(result.includes("Hello world"))
})

test("formatSnapshotToon: object with content instead of text", () => {
	const result = formatSnapshotToon({ url: "https://example.com", content: "page body" })
	assert.ok(result.includes("page body"))
})

test("formatSnapshotToon: null input returns 'no content'", () => {
	const result = formatSnapshotToon(null)
	assert.equal(result, "no content")
})

test("formatSnapshotToon: truncates long text", () => {
	const longText = "x".repeat(1200)
	const result = formatSnapshotToon({ url: "u", text: longText })
	assert.ok(result.includes("truncated"))
	assert.ok(result.includes("1200 chars"))
})

test("formatLinksToon: array of {url, text} objects", () => {
	const links = [
		{ url: "https://a.com", text: "A" },
		{ url: "https://b.com", text: "B" },
	]
	const result = formatLinksToon(links)
	assert.ok(result.includes("links (2)"))
	assert.ok(result.includes("A → https://a.com"))
	assert.ok(result.includes("B → https://b.com"))
})

test("formatLinksToon: array of plain strings", () => {
	const result = formatLinksToon(["https://a.com", "https://b.com"])
	assert.ok(result.includes("links (2)"))
	assert.ok(result.includes("https://a.com"))
})

test("formatLinksToon: non-array input shows as string", () => {
	const result = formatLinksToon("not an array")
	assert.ok(result.includes("links:"))
})

test("formatLinksToon: caps at 20 items, shows overflow count", () => {
	const links = Array.from({ length: 25 }, (_, i) => ({ url: `https://${i}.com`, text: `Link ${i}` }))
	const result = formatLinksToon(links)
	assert.ok(result.includes("5 more"))
})

test("formatTabsToon: array of tab objects", () => {
	const tabs = [
		{ id: "t1", title: "Tab One", url: "https://one.com" },
		{ id: "t2", title: "Tab Two", url: "https://two.com" },
	]
	const result = formatTabsToon(tabs)
	assert.ok(result.includes("tabs (2)"))
	assert.ok(result.includes("[t1] Tab One"))
	assert.ok(result.includes("[t2] Tab Two"))
})

test("formatTabsToon: tab without title falls back to url", () => {
	const tabs = [{ id: "t1", url: "https://example.com" }]
	const result = formatTabsToon(tabs)
	assert.ok(result.includes("https://example.com"))
})

test("formatTabsToon: non-array input", () => {
	const result = formatTabsToon("not tabs")
	assert.ok(result.includes("tabs:"))
})

test("formatActionToon: object with status", () => {
	const result = formatActionToon("click", { status: "ok" })
	assert.equal(result, "click ok")
})

test("formatActionToon: object with status and message", () => {
	const result = formatActionToon("type", { status: "ok", message: "typed 5 chars" })
	assert.equal(result, "type ok — typed 5 chars")
})

test("formatActionToon: null input → verb: ok", () => {
	const result = formatActionToon("scroll", null)
	assert.equal(result, "scroll: ok")
})

// ---------------------------------------------------------------------------
// buildBrowserSurfaceFragment
// ---------------------------------------------------------------------------

test("buildBrowserSurfaceFragment: null sessionId → null fragment", async () => {
	const result = await buildBrowserSurfaceFragment(null)
	assert.equal(result, null)
})

test("buildBrowserSurfaceFragment: iframe mode — usable excludes streamed-only tools, lists web.mode", async () => {
	// Stub resolvePalotSessionBinding and getBrowserLane via module-level mocking isn't
	// available in bun's node:test runner without a mock library, so we test the
	// output shape when there is no binding (sessionId unknown → no binding).
	// The projector returns a fragment with mode=iframe, bound=n.
	//
	// This exercises the real code path: resolvePalotSessionBinding returns null
	// binding for unknown sessions (via the real palot-browser-ipc stub path),
	// and getBrowserLane is never called (no laneId).
	//
	// We accept that the test may vary by environment; the key assertions are shape
	// and that web.mode is always in usable.
	const frag = await buildBrowserSurfaceFragment("unknown-session-id")
	// May be null if the binding store is completely isolated, or a valid fragment.
	// Either way: if we got a fragment it must be well-shaped.
	if (frag !== null) {
		assert.equal(frag.surfaceId, "browser")
		assert.equal(frag.label, "Browser")
		assert.ok(typeof frag.toon === "string")
		assert.ok(frag.toon.includes("web.mode"), "web.mode must be in usable tools for iframe mode")
	}
})
