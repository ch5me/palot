import assert from "node:assert/strict"
import test from "node:test"
import { getBrowserLaneDesktopUrl } from "./browser-lane-protocol"

test("browser lane desktop url uses same local origin path", () => {
	assert.equal(getBrowserLaneDesktopUrl("default"), "http://elf-browser-lane.local/browser/default/")
})
