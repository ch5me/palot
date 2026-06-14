import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-browser-ipc-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
	}
}

test("browser state snapshot returns binding and recent actions", async () => {
	const cleanup = setupTempXdg()
	try {
		const bindingMod = await import("./palot-session-binding")
		const ipcMod = await import("./palot-browser-ipc")
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
			logicalPanelRoute: {
				logicalPanelId: "browser",
				preferredZoneId: "side-panel",
				action: "reveal-preferred-zone",
				focusAuthorityOwner: "workspace",
				legacySidePanelTabId: "browser",
				allowCreate: true,
				requestedBy: "test",
			},
		})
		const snapshot = ipcMod.getBrowserStateSnapshot("ses_snapshot")
		assert.equal(snapshot.binding?.browserLaneId, "default")
		assert.equal(snapshot.lastActions.length, 1)
		assert.equal(snapshot.lastActions[0]?.kind, "move")
		const uiState = ipcMod.getUiStateSnapshot()
		assert.equal(uiState.sidePanel.activeTab, "browser")
		assert.equal(uiState.logicalPanelRoute?.logicalPanelId, "browser")
	} finally {
		cleanup()
	}
})
