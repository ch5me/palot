import { describe, expect, test } from "bun:test"
import {
	getBrowserPanelActionLabels,
	getBrowserPanelFailureHint,
	getBrowserPanelState,
} from "./browser-panel-view-model"
import type { BrowserLane, BrowserLaneHealth } from "../../lib/types"

function createLane(overrides: Partial<BrowserLane> = {}): BrowserLane {
	return {
		id: "lane-1",
		label: "Lane 1",
		surfaceKind: "selkies-stream",
		runtimeOwnership: "attached",
		deploymentLocation: "remote",
		streamPath: "/browser/lane-1/",
		targetUrl: null,
		streamBackendUrl: "https://example.com/stream",
		desktopStreamUrl: "http://elf-browser-lane.local/browser/lane-1/",
		cdpEndpoint: null,
		profilePath: null,
		host: "example.com",
		createdAt: 1,
		updatedAt: 2,
		health: createHealth(),
		...overrides,
	}
}

function createHealth(overrides: Partial<BrowserLaneHealth> = {}): BrowserLaneHealth {
	return {
		status: "stopped",
		stream: { url: null, checkedAt: null, state: "unknown", error: null },
		cdp: { url: null, checkedAt: null, state: "unknown", error: null },
		message: "",
		...overrides,
	}
}

describe("browser panel view model", () => {
	test("direct iframe state and actions use target-first copy", () => {
		const lane = createLane({
			surfaceKind: "direct-iframe",
			targetUrl: "https://example.com/app",
			streamBackendUrl: null,
		})
		const state = getBrowserPanelState({
			activeLane: lane,
			laneHealth: createHealth({ status: "error", message: "Direct iframe unreachable or not configured" }),
			loadFailure: null,
			healthSummary: "Direct iframe unreachable or not configured",
		})
		const actions = getBrowserPanelActionLabels(lane)

		expect(state.title).toBe("Browser target unreachable")
		expect(actions.refreshLabel).toBe("Refresh target")
		expect(actions.openExternalLabel).toBe("Open target")
		expect(actions.canRestartManagedLane).toBe(false)
		expect(getBrowserPanelFailureHint(lane)).toBe(
			"Use refresh or open target to recover the embedded page.",
		)
	})

	test("attached selkies state and actions avoid managed wording", () => {
		const lane = createLane({ runtimeOwnership: "attached" })
		const state = getBrowserPanelState({
			activeLane: lane,
			laneHealth: createHealth({
				status: "degraded",
				cdp: { url: "https://example.com/cdp", checkedAt: 1, state: "ready", error: null },
				message: "Attached automation can connect, but the rendered stream is stale. Check the attached surface URL.",
			}),
			loadFailure: null,
			healthSummary: "Attached stream ready, CDP unavailable",
		})
		const actions = getBrowserPanelActionLabels(lane)

		expect(state.title).toBe("CDP live, surface missing")
		expect(state.detail).toContain("attached surface URL")
		expect(actions.restartLabel).toBe("Restart unavailable for attached lanes")
		expect(actions.resetProfileLabel).toBe("Profile reset unavailable for attached lanes")
		expect(getBrowserPanelFailureHint(lane)).toBe("Use restart or refresh to recover stream state.")
	})

	test("managed-local selkies state and actions expose managed controls", () => {
		const lane = createLane({
			runtimeOwnership: "managed-local",
			deploymentLocation: "local",
			profilePath: "/tmp/profile",
			streamBackendUrl: "http://127.0.0.1:3000",
		})
		const state = getBrowserPanelState({
			activeLane: lane,
			laneHealth: createHealth({ status: "profile-locked", message: "Profile exists but runtime has not started yet" }),
			loadFailure: null,
			healthSummary: "Profile exists but runtime has not started yet",
		})
		const actions = getBrowserPanelActionLabels(lane)

		expect(state.title).toBe("Managed profile waiting")
		expect(actions.restartLabel).toBe("Restart managed lane")
		expect(actions.resetProfileLabel).toBe("Reset managed profile")
		expect(actions.canRestartManagedLane).toBe(true)
		expect(actions.canResetManagedProfile).toBe(true)
	})
})
