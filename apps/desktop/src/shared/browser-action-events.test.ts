import assert from "node:assert/strict"
import test from "node:test"
import {
	BROWSER_ACTION_EVENT_CONTRACT_CHECKSUM,
	BROWSER_ACTION_EVENT_VERSION,
	normalizeBrowserActionEvent,
} from "./browser-action-events"

test("normalizeBrowserActionEvent defaults click payload and stable id", () => {
	const event = normalizeBrowserActionEvent({
		kind: "click",
		sessionId: "ses_a",
		source: "tool_request",
		sequence: 2,
		status: "queued",
	})
	assert.equal(event.id, "ses_a:2:click")
	assert.equal(event.button, "left")
	assert.equal(event.clickCount, 1)
})

test("normalizeBrowserActionEvent preserves type event caret confidence", () => {
	const event = normalizeBrowserActionEvent({
		kind: "type",
		sessionId: "ses_b",
		source: "automation_runtime",
		sequence: 5,
		status: "runtime_ack",
		text: "hello",
		caretConfidence: "high",
	})
	assert.equal(event.text, "hello")
	assert.equal(event.caretConfidence, "high")
})

test("contract metadata stays stable", () => {
	assert.equal(BROWSER_ACTION_EVENT_VERSION, 1)
	assert.equal(BROWSER_ACTION_EVENT_CONTRACT_CHECKSUM, "browser-action-event-v1-tool-request-runtime-ack")
})
