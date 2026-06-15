import { describe, expect, test } from "bun:test"

import { PANEL_CONTRACT } from "../shared/firefly-plugin/family-contracts"
import type { ProjectedSidePanel } from "../shared/firefly-plugin/renderer-projection"
import {
	catalogPanelToTabDescriptor,
	isKnownSidePanelTabId,
	mergeSurfaceTabs,
	SIDE_PANEL_TAB_ORDER,
} from "./firefly-plugin-surface-merge"

function projectedPanel(overrides: Partial<ProjectedSidePanel> = {}): ProjectedSidePanel {
	return {
		family: "panels",
		pluginId: "firefly.built-in.surface.notes",
		contributionId: "notes",
		projectedId: "firefly.built-in.surface.notes.notes",
		title: "Notes",
		icon: "book-text",
		formFactor: "side-panel-tab",
		hostSlot: "side-panel",
		hostTarget: { kind: "side-panel", slot: "side-panel" },
		defaultOn: true,
		commandIds: ["open-notes", "toggle-notes"],
		persistenceKey: "side-panel.notes",
		telemetryNamespace: "firefly.surface.notes",
		renderMode: "host-reconciler",
		declarativeSchemaRef: null,
		iframeSandbox: null,
		capabilityGates: [],
		availability: { available: true, state: "ready", reason: null },
		contract: PANEL_CONTRACT,
		...overrides,
	}
}

describe("catalogPanelToTabDescriptor", () => {
	test("maps a side-panel-tab panel to a typed descriptor", () => {
		const descriptor = catalogPanelToTabDescriptor(projectedPanel())
		expect(descriptor).not.toBeNull()
		expect(descriptor?.id).toBe("notes")
		expect(descriptor?.lane).toBe("utility")
		expect(descriptor?.persistenceKey).toBe("side-panel.notes")
		expect(descriptor?.telemetryNamespace).toBe("firefly.surface.notes")
		expect(descriptor?.available).toBe(true)
	})

	test("maps document-lane panels from catalog metadata", () => {
		const descriptor = catalogPanelToTabDescriptor(
			projectedPanel({
				contributionId: "pdf-review",
				projectedId: "firefly.built-in.side-panel.pdf-review",
				title: "PDF Review",
				hostTarget: { kind: "side-panel", slot: "main-pane" },
			}),
		)
		expect(descriptor?.lane).toBe("document")
	})

	test("skips main-pane panels", () => {
		expect(catalogPanelToTabDescriptor(projectedPanel({ formFactor: "main-pane" }))).toBeNull()
	})

	test("skips contribution ids outside the SidePanelTabId union", () => {
		expect(catalogPanelToTabDescriptor(projectedPanel({ contributionId: "mystery" }))).toBeNull()
	})

	test("carries unavailable reason through", () => {
		const descriptor = catalogPanelToTabDescriptor(
			projectedPanel({
				availability: {
					available: false,
					state: "disabled",
					reason: {
						code: "plugin-disabled",
						message: "Plugin is disabled by the host",
						hostCapabilityState: {
							trust: "built-in",
							sessionScope: "session",
							grantedTokens: [],
							loading: false,
							pluginDisabled: true,
							pluginQuarantined: false,
							pluginError: null,
						},
						missingCapabilities: [],
					},
				},
			}),
		)
		expect(descriptor?.available).toBe(false)
		expect(descriptor?.unavailableReason).toBe("Plugin is disabled by the host")
	})
})

describe("mergeSurfaceTabs", () => {
	const tab = (id: (typeof SIDE_PANEL_TAB_ORDER)[number], origin: string) => ({ id, origin })

	test("with zero catalog tabs the registry view is unchanged (cutover identity)", () => {
		const registry = [tab("review", "registry"), tab("notes", "registry"), tab("files", "registry")]
		const merged = mergeSurfaceTabs(registry, [])
		expect(merged).toEqual(registry)
	})

	test("catalog wins over a registry row with the same id", () => {
		const registry = [tab("review", "registry"), tab("notes", "registry")]
		const catalog = [tab("notes", "catalog")]
		const merged = mergeSurfaceTabs(registry, catalog)
		expect(merged.find((t) => t.id === "notes")?.origin).toBe("catalog")
		expect(merged).toHaveLength(2)
	})

	test("a migrated surface keeps its canonical position", () => {
		const registry = [
			tab("review", "registry"),
			tab("browser", "registry"),
			tab("pulse", "registry"),
		]
		const catalog = [tab("notes", "catalog")]
		const merged = mergeSurfaceTabs(registry, catalog)
		expect(merged.map((t) => t.id)).toEqual(["review", "browser", "notes", "pulse"])
	})

	test("isKnownSidePanelTabId guards the union", () => {
		expect(isKnownSidePanelTabId("notes")).toBe(true)
		expect(isKnownSidePanelTabId("nope")).toBe(false)
	})
})
