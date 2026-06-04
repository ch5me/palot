import assert from "node:assert/strict"
import test, { afterEach } from "node:test"
import {
	onAiosDrag,
	openFileInPane,
	openUrlInPane,
	registerOpenFile,
	registerOpenUrl,
	resetPaneBusForTests,
	setPaneDragActiveForTests,
} from "./pane-bus"

afterEach(() => {
	resetPaneBusForTests()
})

test("openFileInPane uses the registered opener and falls back cleanly", () => {
	const calls: Array<{ path: string; name: string }> = []
	assert.equal(openFileInPane("/tmp/example.md", "example.md"), false)

	const unregister = registerOpenFile((path, name) => {
		calls.push({ path, name })
	})

	assert.equal(openFileInPane("/tmp/example.md", "example.md"), true)
	assert.deepEqual(calls, [{ path: "/tmp/example.md", name: "example.md" }])

	unregister()
	assert.equal(openFileInPane("/tmp/example.md", "example.md"), false)
})

test("openUrlInPane uses the registered opener and clears on unregister", () => {
	const calls: Array<{ url: string; label?: string }> = []
	const unregister = registerOpenUrl((url, label) => {
		calls.push({ url, label })
	})

	assert.equal(openUrlInPane("https://example.com", "Example"), true)
	assert.deepEqual(calls, [{ url: "https://example.com", label: "Example" }])

	unregister()
	assert.equal(openUrlInPane("https://example.com"), false)
})

test("onAiosDrag publishes current and future drag state", () => {
	const seen: boolean[] = []
	const unsubscribe = onAiosDrag((active) => {
		seen.push(active)
	})

	setPaneDragActiveForTests(true)
	setPaneDragActiveForTests(false)
	unsubscribe()
	setPaneDragActiveForTests(true)

	assert.deepEqual(seen, [false, true, false])
})
