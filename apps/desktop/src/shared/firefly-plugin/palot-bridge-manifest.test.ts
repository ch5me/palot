import { describe, expect, test } from "bun:test"

import {
	derivePluginDescriptor,
	parsePluginManifest,
} from "./index"
import {
	PALOT_BRIDGE_DECISION_CARD_COMPONENT,
	PALOT_BRIDGE_PLUGIN_ID,
	PALOT_BRIDGE_SIDE_PANEL_TABS,
	PALOT_BRIDGE_TOOL_IDS,
	palotBridgeManifest,
} from "./palot-bridge-manifest"
import { summarizeComponentBindings } from "./component-zod"

describe("palotBridgeManifest", () => {
	test("parses as a valid V2 manifest", () => {
		const parsed = parsePluginManifest(palotBridgeManifest)
		expect(parsed.id).toBe("firefly.built-in.palot-bridge")
	})

	test("derives a valid descriptor for the current app version", () => {
		const parsed = parsePluginManifest(palotBridgeManifest)
		const descriptor = derivePluginDescriptor(parsed, { appVersion: "0.11.0" })
		expect(descriptor.normalizedId).toBe(PALOT_BRIDGE_PLUGIN_ID)
		expect(descriptor.bridge?.requiresSessionBinding).toBe(true)
		expect(descriptor.bridge?.bindOnActivation).toBe(true)
	})

	test("declares all 13 current product + discovery tools", () => {
		const parsed = parsePluginManifest(palotBridgeManifest)
		expect(parsed.contributes.tools).toHaveLength(13)
		for (const id of PALOT_BRIDGE_TOOL_IDS) {
			expect(parsed.contributes.tools.some((t) => t.id === id)).toBe(true)
		}
		const names = parsed.contributes.tools.map((t) => t.id)
		expect(names).toContain("plugin.firefly.built-in.palot-bridge.browser_status")
		expect(names).toContain("plugin.firefly.built-in.palot-bridge.open_side_panel")
		expect(names).toContain("plugin.firefly.built-in.palot-bridge.ui_state")
		expect(names).toContain("plugin.firefly.built-in.palot-bridge.search_tools")
		expect(names).toContain("plugin.firefly.built-in.palot-bridge.describe_tool")
		expect(names).toContain("plugin.firefly.built-in.palot-bridge.call_tool")
		expect(names).toContain("plugin.firefly.built-in.palot-bridge.tools_status")
	})

	test("all tool ids use the namespaced plugin.<id>.* shape", () => {
		const parsed = parsePluginManifest(palotBridgeManifest)
		for (const tool of parsed.contributes.tools) {
			expect(tool.id.startsWith(`plugin.${PALOT_BRIDGE_PLUGIN_ID}.`)).toBe(true)
		}
	})

	test("declares Firefly-specific capabilities, not generic fs/net/shell", () => {
		const parsed = parsePluginManifest(palotBridgeManifest)
		expect(parsed.capabilities).toContain("host:bridge.session-read")
		expect(parsed.capabilities).toContain("host:bridge.ui-state-read")
		expect(parsed.capabilities).toContain("host:browser.lane-control")
		expect(parsed.capabilities).toContain("host:browser.action-dispatch")
		expect(parsed.capabilities).not.toContain("fs:read")
		expect(parsed.capabilities).not.toContain("shell:exec")
	})

	test("every tool that performs a side-effect declares the matching capability", () => {
		const parsed = parsePluginManifest(palotBridgeManifest)
		const byName = (id: string) => parsed.contributes.tools.find((t) => t.id.endsWith(id))
		expect(byName("browser_open")?.requires).toContain("host:browser.lane-control")
		expect(byName("browser_click")?.requires).toContain("host:browser.action-dispatch")
		expect(byName("open_side_panel")?.requires).toContain("host:bridge.ui-state-write")
		expect(byName("ui_state")?.requires).toContain("host:bridge.ui-state-read")
	})

	test("engine range matches current app version via engines.firefly (managed server only in V2)", () => {
		const parsed = parsePluginManifest(palotBridgeManifest)
		expect(parsed.engines.firefly).toBe(">=0.11.0")
		expect(parsed.engines.desktop).toBeUndefined()
		expect(() =>
			derivePluginDescriptor(parsed, { appVersion: "0.10.0" }),
		).toThrow()
		expect(() =>
			derivePluginDescriptor(parsed, { appVersion: "0.11.0" }),
		).not.toThrow()
	})

	test("side panel tab enum matches the current 18-tab inventory", () => {
		expect(PALOT_BRIDGE_SIDE_PANEL_TABS).toContain("review")
		expect(PALOT_BRIDGE_SIDE_PANEL_TABS).toContain("pdf-review")
		expect(PALOT_BRIDGE_SIDE_PANEL_TABS).toHaveLength(18)
	})

	test("decision_card component summary exposes events, state, and conflict policy", () => {
		const summary = summarizeComponentBindings("decision_card")
		expect(summary).toBeDefined()
		expect(summary?.events).toEqual(PALOT_BRIDGE_DECISION_CARD_COMPONENT.events)
		expect(summary?.state).toEqual(PALOT_BRIDGE_DECISION_CARD_COMPONENT.state)
		expect(summary?.conflictPolicy).toBe("ask")
	})

	test("no commands or themes declared (bridge is surface + tools only)", () => {
		const parsed = parsePluginManifest(palotBridgeManifest)
		expect(parsed.contributes.commands.length).toBe(2)
		expect(parsed.contributes.themes).toHaveLength(0)
		expect(parsed.contributes.panels).toHaveLength(0)
		expect(parsed.contributes.widgets).toHaveLength(0)
	})
})
