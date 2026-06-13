import type { BrowserLane, BrowserLaneHealth } from "../../lib/types"

export interface BrowserPanelState {
	title: string
	detail: string
	showFrame: boolean
}

export interface BrowserPanelActionLabels {
	refreshLabel: string
	restartLabel: string
	resetProfileLabel: string
	openExternalLabel: string
	canRestartManagedLane: boolean
	canResetManagedProfile: boolean
}

export function getBrowserPanelActionLabels(activeLane: BrowserLane | null): BrowserPanelActionLabels {
	const canRestartManagedLane = activeLane?.runtimeOwnership === "managed-local"
	const canResetManagedProfile =
		activeLane?.runtimeOwnership === "managed-local" && activeLane.surfaceKind === "selkies-stream"

	return {
		refreshLabel: activeLane?.surfaceKind === "direct-iframe" ? "Refresh target" : "Refresh route",
		restartLabel:
			activeLane?.runtimeOwnership === "managed-local"
				? "Restart managed lane"
				: "Restart unavailable for attached lanes",
		resetProfileLabel:
			activeLane?.runtimeOwnership === "managed-local"
				? "Reset managed profile"
				: "Profile reset unavailable for attached lanes",
		openExternalLabel: activeLane?.surfaceKind === "direct-iframe" ? "Open target" : "Open diagnostics",
		canRestartManagedLane,
		canResetManagedProfile,
	}
}

export function getBrowserPanelFailureHint(activeLane: BrowserLane | null): string {
	if (activeLane?.surfaceKind === "direct-iframe") {
		return "Use refresh or open target to recover the embedded page."
	}
	return "Use restart or refresh to recover stream state."
}

export function getBrowserPanelState(input: {
	activeLane: BrowserLane | null
	laneHealth: BrowserLaneHealth | null
	loadFailure: string | null
	healthSummary: string
}): BrowserPanelState {
	const { activeLane, laneHealth, loadFailure, healthSummary } = input

	if (!activeLane) {
		return {
			title: "No browser lane ready",
			detail: "Create or start a browser lane to render the browser surface.",
			showFrame: false,
		}
	}

	if (!laneHealth) {
		return {
			title: "Checking browser lane",
			detail:
				activeLane.surfaceKind === "direct-iframe"
					? "Waiting for target reachability."
					: activeLane.runtimeOwnership === "managed-local"
						? "Waiting for managed stream and CDP status."
						: "Waiting for attached stream and CDP status.",
			showFrame: false,
		}
	}

	if (loadFailure) {
		return {
			title: "Lane request failed",
			detail: loadFailure,
			showFrame: false,
		}
	}

	if (laneHealth.stream.state === "ready") {
		return {
			title:
				activeLane.surfaceKind === "direct-iframe"
					? "Target live"
					: activeLane.runtimeOwnership === "managed-local"
						? "Managed stream live"
						: "Attached stream live",
			detail: healthSummary,
			showFrame: true,
		}
	}

	if (laneHealth.cdp.state === "ready") {
		return {
			title: "CDP live, surface missing",
			detail:
				activeLane.runtimeOwnership === "managed-local"
					? "Managed automation can connect, but the rendered stream is stale. Refresh or restart the lane."
					: "Attached automation can connect, but the rendered stream is stale. Check the attached surface URL.",
			showFrame: false,
		}
	}

	if (laneHealth.status === "profile-locked") {
		return {
			title: "Managed profile waiting",
			detail: laneHealth.message,
			showFrame: false,
		}
	}

	if (laneHealth.status === "error") {
		return {
			title:
				activeLane.surfaceKind === "direct-iframe"
					? "Browser target unreachable"
					: activeLane.runtimeOwnership === "managed-local"
						? "Managed browser lane broken"
						: "Attached browser lane unavailable",
			detail: laneHealth.message,
			showFrame: false,
		}
		}

	return {
		title: "Browser lane not visible yet",
		detail: healthSummary,
		showFrame: false,
	}
}
