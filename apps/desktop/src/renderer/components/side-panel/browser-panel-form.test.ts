import { describe, expect, test } from "bun:test"
import {
	createDefaultBrowserPanelFormState,
	getBrowserPanelCreateFormViewModel,
} from "./browser-panel-form"

describe("browser panel create form view model", () => {
	test("direct iframe locks runtime ownership to attached and shows only target fields", () => {
		const view = getBrowserPanelCreateFormViewModel({
			...createDefaultBrowserPanelFormState(),
			surfaceKind: "direct-iframe",
			runtimeOwnership: "managed-local",
		})

		expect(view.runtimeOwnership).toBe("attached")
		expect(view.showTargetUrl).toBe(true)
		expect(view.showStreamBackendUrl).toBe(false)
		expect(view.showCdpEndpoint).toBe(false)
		expect(view.runtimeOwnershipOptions).toEqual(["attached"])
		expect(view.unsupportedManagedLocal).toBe(true)
	})

	test("attached selkies shows stream and optional cdp fields", () => {
		const view = getBrowserPanelCreateFormViewModel({
			...createDefaultBrowserPanelFormState(),
			surfaceKind: "selkies-stream",
			runtimeOwnership: "attached",
		})

		expect(view.showTargetUrl).toBe(false)
		expect(view.showStreamBackendUrl).toBe(true)
		expect(view.showCdpEndpoint).toBe(true)
		expect(view.showDeploymentLocation).toBe(true)
		expect(view.deploymentLocation).toBe("remote")
	})

	test("managed-local selkies hides attached-only metadata and pins local deployment", () => {
		const view = getBrowserPanelCreateFormViewModel({
			...createDefaultBrowserPanelFormState(),
			surfaceKind: "selkies-stream",
			runtimeOwnership: "managed-local",
			deploymentLocation: "remote",
		})

		expect(view.runtimeOwnership).toBe("managed-local")
		expect(view.showStreamBackendUrl).toBe(true)
		expect(view.showCdpEndpoint).toBe(false)
		expect(view.showDeploymentLocation).toBe(false)
		expect(view.deploymentLocation).toBe("local")
	})
})
