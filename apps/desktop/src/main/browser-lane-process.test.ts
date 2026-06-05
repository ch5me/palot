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
		mode: "local",
		profilePath: "/tmp/browser-profile-default",
		profileResetAt: null,
	})

	assert.equal(health.status, "running")
	assert.equal(health.message, "Stream and CDP ready")
	assert.equal(health.stream.state, "ready")
	assert.equal(health.cdp.state, "ready")
})
