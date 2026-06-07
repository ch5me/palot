import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { mock, test } from "bun:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-dispatcher-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

test("dispatcher rejects unbound session", async () => {
	const cleanup = setupTempXdg()
	try {
		const mod = await import("./palot-browser-dispatcher")
		const result = await mod.dispatchBrowserTool({
			sessionId: "ses_unbound",
			toolName: "browser_navigate",
			args: { url: "https://example.com" },
		})
		assert.equal(result.status, "failed")
		assert.equal(result.resultSummary, "unbound_session")
	} finally {
		cleanup()
	}
})

test("dispatcher publishes request and result for bound tabs list action", async () => {
	const cleanup = setupTempXdg()
	try {
		listBrowserLaneTabs.mockReset()
		listBrowserLaneTabs.mockImplementation(async () => ({
			laneId: "lane_bound",
			activeTabId: "tab_1",
			tabs: [
				{
					id: "tab_1",
					title: "Example",
					url: "https://example.com",
					type: "page",
					active: true,
					attached: false,
					openerId: null,
					faviconUrl: null,
				},
			],
		}))
		const bindingMod = await import("./palot-session-binding")
		const busMod = await import("./palot-browser-ipc")
		const dispatcher = await import("./palot-browser-dispatcher")
		bindingMod.upsertSessionBinding(
			bindingMod.createSessionBinding({
				openCodeSessionId: "ses_bound",
				browserLaneId: "lane_bound",
				status: "attached",
			}),
		)
		const result = await dispatcher.dispatchBrowserTool({
			sessionId: "ses_bound",
			toolName: "browser_tabs",
			args: { action: "list" },
		})
		assert.equal(result.status, "queued")
		const parsed = JSON.parse(result.resultSummary)
		assert.equal(parsed.activeTabId, "tab_1")
		assert.equal(parsed.tabs.length, 1)
		assert.equal(listBrowserLaneTabs.mock.calls.length, 1)
		const events = busMod.getBrowserActionEvents("ses_bound")
		assert.ok(events.some((event) => event.kind === "toolRequest"))
		assert.ok(events.some((event) => event.kind === "toolResult"))
	} finally {
		cleanup()
	}
})

test("dispatcher returns queued result for navigate payloads before per-tool arg validation lands", async () => {
	const cleanup = setupTempXdg()
	try {
		const dispatcher = await import("./palot-browser-dispatcher")
		const result = await dispatcher.dispatchBrowserTool({
			sessionId: "ses_bad",
			toolName: "browser_navigate",
			args: { url: "" },
		})
		assert.equal(result.status, "failed")
		assert.equal(result.resultSummary, "unbound_session")
	} finally {
		cleanup()
	}
})

const clickBrowserLane = mock(async () => undefined)
const typeBrowserLane = mock(async () => undefined)
const scrollBrowserLane = mock(async () => undefined)
const listBrowserLaneTabs = mock(async () => ({
	laneId: "lane_bound",
	activeTabId: "tab_1",
	tabs: [{ id: "tab_1", title: "Example", url: "https://example.com", type: "page", active: true, attached: false, openerId: null, faviconUrl: null }],
}))

mock.module("./browser-lane-manager", () => ({
	activateBrowserLaneTab: async () => ({ status: "queued" }),
	clickBrowserLane,
	closeBrowserLaneTab: async () => ({ status: "queued" }),
	createBrowserLaneTab: async () => ({ status: "queued" }),
	listBrowserLaneTabs,
	navigateBrowserLane: async () => ({ status: "queued" }),
	scrollBrowserLane,
	typeBrowserLane,
}))

test("dispatcher routes click type and scroll through lane helpers", async () => {
	const cleanup = setupTempXdg()
	try {
		clickBrowserLane.mockReset()
		typeBrowserLane.mockReset()
		scrollBrowserLane.mockReset()
		listBrowserLaneTabs.mockReset()
		const bindingMod = await import("./palot-session-binding")
		const busMod = await import("./palot-browser-ipc")
		const dispatcher = await import("./palot-browser-dispatcher")
		bindingMod.upsertSessionBinding(
			bindingMod.createSessionBinding({
				openCodeSessionId: "ses_lane_actions",
				browserLaneId: "lane_actions",
				status: "attached",
			}),
		)
		await dispatcher.dispatchBrowserTool({
			sessionId: "ses_lane_actions",
			toolName: "browser_click",
			args: { x: 10, y: 20 },
		})
		await dispatcher.dispatchBrowserTool({
			sessionId: "ses_lane_actions",
			toolName: "browser_type",
			args: { text: "hello" },
		})
		await dispatcher.dispatchBrowserTool({
			sessionId: "ses_lane_actions",
			toolName: "browser_scroll",
			args: { deltaY: 300 },
		})
		assert.equal(clickBrowserLane.mock.calls.length, 1)
		assert.equal(typeBrowserLane.mock.calls.length, 1)
		assert.equal(scrollBrowserLane.mock.calls.length, 1)
		const events = busMod.getBrowserActionEvents("ses_lane_actions")
		assert.equal(events.filter((event) => event.kind === "toolRequest").length, 3)
		assert.equal(events.filter((event) => event.kind === "toolResult").length, 3)
	} finally {
		cleanup()
	}
})
