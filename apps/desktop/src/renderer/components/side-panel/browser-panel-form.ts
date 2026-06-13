import type { BrowserLaneDeploymentLocation, BrowserLaneRuntimeOwnership, BrowserLaneSurfaceKind } from "../../lib/types"

export interface BrowserPanelCreateFormState {
	id: string
	label: string
	surfaceKind: BrowserLaneSurfaceKind
	runtimeOwnership: BrowserLaneRuntimeOwnership
	targetUrl: string
	streamBackendUrl: string
	cdpEndpoint: string
	deploymentLocation: BrowserLaneDeploymentLocation
	host: string
	profilePath: string
}

export interface BrowserPanelCreateFormViewModel {
	runtimeOwnership: BrowserLaneRuntimeOwnership
	showRuntimeOwnership: boolean
	showTargetUrl: boolean
	showStreamBackendUrl: boolean
	showCdpEndpoint: boolean
	showDeploymentLocation: boolean
	showHost: boolean
	showProfilePath: boolean
	deploymentLocation: BrowserLaneDeploymentLocation
	unsupportedManagedLocal: boolean
	runtimeOwnershipOptions: BrowserLaneRuntimeOwnership[]
}

export function createDefaultBrowserPanelFormState(): BrowserPanelCreateFormState {
	return {
		id: "",
		label: "",
		surfaceKind: "selkies-stream",
		runtimeOwnership: "attached",
		targetUrl: "",
		streamBackendUrl: "",
		cdpEndpoint: "",
		deploymentLocation: "remote",
		host: "",
		profilePath: "",
	}
}

export function getBrowserPanelCreateFormViewModel(
	form: BrowserPanelCreateFormState,
): BrowserPanelCreateFormViewModel {
	const runtimeOwnership = form.surfaceKind === "direct-iframe" ? "attached" : form.runtimeOwnership
	const isManagedLocal = runtimeOwnership === "managed-local"

	return {
		runtimeOwnership,
		showRuntimeOwnership: true,
		showTargetUrl: form.surfaceKind === "direct-iframe",
		showStreamBackendUrl: form.surfaceKind === "selkies-stream",
		showCdpEndpoint: form.surfaceKind === "selkies-stream" && !isManagedLocal,
		showDeploymentLocation: !isManagedLocal,
		showHost: false,
		showProfilePath: false,
		deploymentLocation: isManagedLocal ? "local" : form.deploymentLocation,
		unsupportedManagedLocal: form.surfaceKind === "direct-iframe",
		runtimeOwnershipOptions:
			form.surfaceKind === "direct-iframe" ? ["attached"] : ["attached", "managed-local"],
	}
}
