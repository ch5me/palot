import assert from "node:assert/strict"
import test from "node:test"
import { buildHealthFromProbe } from "./browser-lane-process"

test("browser lane health reports running when stream and cdp are ready", () => {
	const health = buildHealthFromProbe({
		streamUrl: "http://127.0.0.1:3000",
		cdpUrl: "http://127.0.0.1:9222",
		streamReady: true,
		cdpReady: true,
		streamError: null,
		cdpError: null,
		runtimeOwnership: "managed-local",
		surfaceKind: "selkies-stream",
		profilePath: "/tmp/browser-profile-default",
		profileResetAt: null,
	})

	assert.equal(health.status, "running")
	assert.equal(health.message, "Stream and CDP ready")
	assert.equal(health.stream.state, "ready")
	assert.equal(health.cdp.state, "ready")
})

test("browser lane health treats attached direct iframe as cdp not applicable", () => {
	const health = buildHealthFromProbe({
		streamUrl: "https://example.com",
		cdpUrl: null,
		streamReady: true,
		cdpReady: false,
		streamError: null,
		cdpError: "CDP URL missing",
		runtimeOwnership: "attached",
		surfaceKind: "direct-iframe",
		profilePath: null,
		profileResetAt: null,
	})

	assert.equal(health.status, "running")
	assert.equal(health.message, "Direct iframe ready")
	assert.equal(health.cdp.state, "not-applicable")
	assert.equal(health.cdp.error, null)
})

test("browser lane health avoids managed-local profile states for attached selkies lanes", () => {
	const health = buildHealthFromProbe({
		streamUrl: "https://example.com/stream",
		cdpUrl: null,
		streamReady: false,
		cdpReady: false,
		streamError: "unreachable",
		cdpError: "missing",
		runtimeOwnership: "attached",
		surfaceKind: "selkies-stream",
		profilePath: "/tmp/should-not-matter",
		profileResetAt: null,
	})

	assert.equal(health.status, "error")
	assert.equal(health.message, "Attached lane unreachable or not configured")
	assert.equal(health.cdp.state, "failed")
})
