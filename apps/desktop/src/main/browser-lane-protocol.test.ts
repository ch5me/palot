import assert from "node:assert/strict"
import test from "node:test"
import { getBrowserLaneDesktopUrl } from "./browser-lane-protocol"

test("browser lane desktop url uses same local origin path", () => {
	assert.equal(getBrowserLaneDesktopUrl("default"), "http://elf-browser-lane.local/browser/default/")
})

test("browser lane desktop url uses loopback backend when ready", () => {
	assert.equal(
		getBrowserLaneDesktopUrl("default", null, "http://127.0.0.1:58406"),
		"http://127.0.0.1:58406/",
	)
})

test("browser lane desktop url uses target url for direct iframe", () => {
	assert.equal(
		getBrowserLaneDesktopUrl(
			"default",
			"https://example.com/app",
			null,
			"direct-iframe",
		),
		"https://example.com/app",
	)
})
