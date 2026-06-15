import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import {
	DOCUMENT_SURFACE_IDS,
	FIREFLY_SURFACE_LANE_BY_ID,
} from "../shared/firefly-surface-ids"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-browser-ipc-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

async function postBridgeAction(url: string, token: string, payload: unknown) {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-palot-bridge-key": token,
		},
		body: JSON.stringify(payload),
	})
	return (await response.json()) as { ok: boolean; result?: unknown }
}

test("browser state snapshot returns binding and recent actions", async () => {
	const cleanup = setupTempXdg()
	try {
		const bindingMod = await import("./palot-session-binding")
		const ipcMod = await import("./palot-browser-ipc")
		await ipcMod.resetPalotBrowserIpcStateForTests()
		bindingMod.upsertSessionBinding(
			bindingMod.createSessionBinding({
				openCodeSessionId: "ses_snapshot",
				browserLaneId: "default",
				status: "attached",
			}),
		)
		await ipcMod.publishBrowserAction({
			event: {
				id: "ses_snapshot:1:move",
				sessionId: "ses_snapshot",
				laneId: "default",
				source: "tool_request",
				sequence: 1,
				requestId: null,
				causationId: null,
				toolCallId: null,
				targetDescription: null,
				viewportCoords: null,
				streamGeometrySnapshot: null,
				timestamp: 1,
				durationMs: null,
				status: "queued",
				errorCode: null,
				errorMessage: null,
				kind: "move",
			},
		})
		ipcMod.setUiStateSnapshot({
			sidePanel: { open: true, activeTab: "browser", availableTabs: ["browser", "review"] },
			documentPanel: { open: false, activeTab: null, availableTabs: [] },
		})
		const snapshot = ipcMod.getBrowserStateSnapshot("ses_snapshot")
		assert.equal(snapshot.binding?.browserLaneId, "default")
		assert.equal(snapshot.lastActions.length, 1)
		assert.equal(snapshot.lastActions[0]?.kind, "move")
		const uiState = ipcMod.getUiStateSnapshot()
		assert.equal(uiState.sidePanel.activeTab, "browser")
		assert.equal(uiState.documentPanel.open, false)
	} finally {
		cleanup()
	}
})

test("bridge open-side-panel accepts document surfaces without collapsing mixed pane inventory", async () => {
	const cleanup = setupTempXdg()
	try {
		const ipcMod = await import("./palot-browser-ipc")
		await ipcMod.resetPalotBrowserIpcStateForTests()
		const bridge = await ipcMod.ensurePalotBridgeServer()
		const url = `http://${bridge.host}:${bridge.port}${bridge.path}`
		const sent: Array<{ channel: string; payload: unknown }> = []

		ipcMod.registerPalotBrowserWindows(() => [
			{
				webContents: {
					send(channel: string, payload: unknown) {
						sent.push({ channel, payload })
					},
				},
			},
		])
		ipcMod.setUiStateSnapshot({
			sidePanel: {
				open: false,
				activeTab: null,
				availableTabs: ["browser", "review"],
			},
			documentPanel: {
				open: false,
				activeTab: null,
				availableTabs: [...DOCUMENT_SURFACE_IDS],
			},
		})

		for (const tab of DOCUMENT_SURFACE_IDS) {
			const response = await postBridgeAction(url, bridge.token, {
				action: "open-side-panel",
				tab,
			})
			assert.equal(response.ok, true)
			assert.equal(FIREFLY_SURFACE_LANE_BY_ID[tab], "document")
			assert.deepEqual(response.result, {
				sidePanel: {
					open: false,
					activeTab: null,
					availableTabs: ["browser", "review"],
				},
				documentPanel: {
					open: true,
					activeTab: tab,
					availableTabs: [...DOCUMENT_SURFACE_IDS],
				},
			})
		}

		const uiState = ipcMod.getUiStateSnapshot()
		assert.equal(uiState.sidePanel.activeTab, null)
		assert.deepEqual(uiState.sidePanel.availableTabs, ["browser", "review"])
		assert.equal(uiState.documentPanel.activeTab, "pdf-review")
		assert.deepEqual(uiState.documentPanel.availableTabs, [...DOCUMENT_SURFACE_IDS])
		assert.equal(
			sent.filter((event) => event.channel === "palot:open-side-panel").length,
			DOCUMENT_SURFACE_IDS.length,
		)
		assert.deepEqual(
			sent.map((event) => event.payload),
			[{ tab: "studio" }, { tab: "pdf-review" }],
		)
	} finally {
		cleanup()
	}
})
