import { describe, expect, test } from "bun:test"
import { selectBrowserPanelLane } from "./browser-panel-selection"
import type { BrowserLane } from "../../lib/types"
import type { SessionBinding } from "../../../preload/api"

function createLane(id: string): BrowserLane {
	return {
		id,
		label: id,
		surfaceKind: "selkies-stream",
		runtimeOwnership: "attached",
		deploymentLocation: "remote",
		streamPath: `/browser/${id}/`,
		targetUrl: null,
		streamBackendUrl: `https://example.com/${id}`,
		desktopStreamUrl: `http://elf-browser-lane.local/browser/${id}/`,
		cdpEndpoint: null,
		profilePath: null,
		host: "example.com",
		createdAt: 1,
		updatedAt: 2,
		health: {
			status: "stopped",
			stream: { url: null, checkedAt: null, state: "unknown", error: null },
			cdp: { url: null, checkedAt: null, state: "unknown", error: null },
			message: "",
		},
	}
}

function createBinding(browserLaneId: string | null, status: SessionBinding["status"] = "attached"): SessionBinding {
	return {
		id: "binding-1",
		openCodeSessionId: "ses_1",
		browserLaneId,
		magicBrowserSessionId: null,
		status,
		createdAt: 1,
		updatedAt: 2,
		releasedAt: status === "released" ? 3 : null,
	}
}

describe("browser panel lane selection", () => {
	test("prefers bound lane over stored active lane", () => {
		const lanes = [createLane("lane_global"), createLane("lane_bound")]
		const selected = selectBrowserPanelLane({
			lanes,
			activeLaneId: "lane_global",
			binding: createBinding("lane_bound"),
		})

		expect(selected?.id).toBe("lane_bound")
	})

	test("falls back to stored active lane when no binding exists", () => {
		const lanes = [createLane("lane_global"), createLane("lane_bound")]
		const selected = selectBrowserPanelLane({
			lanes,
			activeLaneId: "lane_global",
			binding: null,
		})

		expect(selected?.id).toBe("lane_global")
	})

	test("ignores released bindings and falls back to first lane when needed", () => {
		const lanes = [createLane("lane_first")]
		const selected = selectBrowserPanelLane({
			lanes,
			activeLaneId: "lane_missing",
			binding: createBinding("lane_bound", "released"),
		})

		expect(selected?.id).toBe("lane_first")
	})
})
