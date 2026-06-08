import { describe, expect, test } from "bun:test"

import { parsePluginManifest, derivePluginDescriptor } from "./index"
import {
	defaultCapabilityState,
	projectCommands,
	projectCommandsFromCatalog,
	projectRendererFamiliesFromCatalog,
	projectSessionWidgets,
	projectSessionWidgetsFromCatalog,
	projectSidePanels,
	projectSidePanelsFromCatalog,
	projectThemes,
	projectThemesFromCatalog,
} from "./renderer-projection"

const baseManifest = parsePluginManifest({
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.built-in.review",
	displayName: "Review plugin",
	version: "1.0.0",
	trust: "built-in",
	lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
	activationEvents: [{ kind: "onStartup" }],
	contributes: {
		panels: [
			{
				id: "review",
				title: "Changes",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "FileDiffIcon",
				defaultOn: true,
				commandIds: ["review-open"],
				persistenceKey: "side-panel.review",
				telemetryNamespace: "firefly.surface.review",
				availability: { requires: ["host:panel.register"] },
				render: { mode: "host-reconciler" },
			},
		],
		widgets: [
			{
				id: "task-list",
				title: "Task list",
				zoneId: "above-chat",
				defaultEnabled: true,
				icon: "CheckSquare2Icon",
				availability: { requires: ["host:widget.register"] },
				render: { mode: "host-reconciler" },
			},
		],
		commands: [
			{
				id: "review-open",
				title: "Open review",
				description: "Open the review surface",
				category: "Surfaces",
				keybinding: "Cmd+Shift+R",
				menuPath: ["View", "Review"],
				when: "session.active && diff.available",
				requires: ["host:command.register"],
			},
		],
		themes: [
			{
				id: "aurora",
				label: "Aurora",
				kind: "system-adaptive",
				platforms: ["darwin"],
				tokens: { "--background": "#ffffff" },
				darkTokens: { "--background": "#111111" },
				fontFamily: "Fraunces",
				radius: "0.75rem",
				density: "cozy",
				imports: {
					source: "open-vsx",
					externalId: "acme.aurora-theme",
					provenance: "Imported from Open VSX",
				},
			},
		],
		tools: [],
	},
	capabilities: ["host:panel.register", "host:widget.register", "host:command.register"],
})

function descriptorFromManifest(manifest = baseManifest) {
	return derivePluginDescriptor(manifest, { appVersion: "0.11.0" })
}

describe("renderer projections", () => {
	test("all four projections are independent and pure", () => {
		const descriptor = descriptorFromManifest()
		const capabilityState = defaultCapabilityState(descriptor)
		const panels = projectSidePanels(descriptor, capabilityState)
		const widgets = projectSessionWidgets(descriptor, capabilityState)
		const commands = projectCommands(descriptor, capabilityState)
		const themes = projectThemes(descriptor, capabilityState)

		expect(panels).toHaveLength(1)
		expect(widgets).toHaveLength(1)
		expect(commands).toHaveLength(1)
		expect(themes).toHaveLength(1)

		panels[0]?.commandIds.length
		widgets[0]?.capabilityGates.length
		commands[0]?.placement.menuPath.length
		themes[0]?.envelope.tokens["--background"]

		expect(descriptor.panels[0]?.commandIds).toEqual(["review-open"])
		expect(descriptor.commands[0]?.menuPath).toEqual(["View", "Review"])
		expect(descriptor.themes[0]?.tokens).toEqual({ "--background": "#ffffff" })
	})

	test("empty manifest yields empty projections", () => {
		const descriptor = derivePluginDescriptor(
			parsePluginManifest({
				apiVersion: "firefly.plugin/v2",
				kind: "PluginManifest",
				id: "firefly.built-in.empty",
				displayName: "Empty",
				version: "1.0.0",
				trust: "built-in",
				lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
				activationEvents: [{ kind: "onStartup" }],
				contributes: {},
				capabilities: [],
			}),
			{ appVersion: "0.11.0" },
		)
		const state = defaultCapabilityState(descriptor)
		expect(projectSidePanels(descriptor, state)).toEqual([])
		expect(projectSessionWidgets(descriptor, state)).toEqual([])
		expect(projectCommands(descriptor, state)).toEqual([])
		expect(projectThemes(descriptor, state)).toEqual([])
	})

	test("duplicate panel ids across plugins surface collisions", () => {
		const first = descriptorFromManifest()
		const second = descriptorFromManifest(
			parsePluginManifest({
				...baseManifest,
				id: "firefly.built-in.other-review",
				displayName: "Other review",
			}),
		)
		const result = projectSidePanelsFromCatalog(
			[first, second],
			{
				[first.normalizedId]: defaultCapabilityState(first),
				[second.normalizedId]: defaultCapabilityState(second),
			},
		)
		expect(result.items).toHaveLength(2)
		expect(result.collisions).toEqual([
			{
				family: "panels",
				projectedId: "review",
				pluginIds: [first.normalizedId, second.normalizedId],
				contributionIds: ["review"],
				message: "Projected panels id collision: review",
			},
		])
	})

	test("duplicate widget ids across plugins surface collisions", () => {
		const first = descriptorFromManifest()
		const second = descriptorFromManifest(
			parsePluginManifest({
				...baseManifest,
				id: "firefly.built-in.other-widget",
				displayName: "Other widget",
			}),
		)
		const result = projectSessionWidgetsFromCatalog(
			[first, second],
			{
				[first.normalizedId]: defaultCapabilityState(first),
				[second.normalizedId]: defaultCapabilityState(second),
			},
		)
		expect(result.items).toHaveLength(2)
		expect(result.collisions).toEqual([
			{
				family: "widgets",
				projectedId: "task-list",
				pluginIds: [first.normalizedId, second.normalizedId],
				contributionIds: ["task-list"],
				message: "Projected widgets id collision: task-list",
			},
		])
	})

	test("availability reasons reference host-known capability state shape", () => {
		const descriptor = descriptorFromManifest()
		const [panel] = projectSidePanels(descriptor, {
			trust: "local-dev",
			sessionScope: "session",
			grantedTokens: [],
			loading: false,
			pluginDisabled: false,
			pluginQuarantined: false,
			pluginError: null,
		})
		expect(panel?.availability.available).toBe(false)
		expect(panel?.availability.reason?.hostCapabilityState).toEqual({
			trust: "local-dev",
			sessionScope: "session",
			grantedTokens: [],
			loading: false,
			pluginDisabled: false,
			pluginQuarantined: false,
			pluginError: null,
		})
		expect(panel?.availability.reason?.missingCapabilities[0]?.token).toBe("host:panel.register")
		expect(panel?.availability.reason?.code).toBe("plugin-capability-missing")
	})

	test("themes keep their data-only envelope", () => {
		const descriptor = descriptorFromManifest()
		const [theme] = projectThemes(descriptor, defaultCapabilityState(descriptor))
		expect(theme?.contract.hostRendering.dataOnly).toBe(true)
		expect(theme?.envelope).toEqual({
			kind: "system-adaptive",
			platforms: ["darwin"],
			tokens: { "--background": "#ffffff" },
			darkTokens: { "--background": "#111111" },
			fontFamily: "Fraunces",
			radius: "0.75rem",
			density: "cozy",
			imports: {
				source: "open-vsx",
				externalId: "acme.aurora-theme",
				provenance: "Imported from Open VSX",
			},
		})
	})

	test("commands project placement, keybinding, and when metadata", () => {
		const descriptor = descriptorFromManifest()
		const [command] = projectCommands(descriptor, defaultCapabilityState(descriptor))
		expect(command?.placement).toEqual({
			palette: true,
			menuPath: ["View", "Review"],
			keybinding: "Cmd+Shift+R",
			contextualWhen: "session.active && diff.available",
		})
		expect(command?.keybinding).toBe("Cmd+Shift+R")
		expect(command?.when).toBe("session.active && diff.available")
	})

	test("family projections stay independently callable from catalog helper", () => {
		const descriptor = descriptorFromManifest()
		const result = projectRendererFamiliesFromCatalog(
			[descriptor],
			{ [descriptor.normalizedId]: defaultCapabilityState(descriptor) },
		)
		expect(result.panels.items).toHaveLength(1)
		expect(result.widgets.items).toHaveLength(1)
		expect(result.commands.items).toHaveLength(1)
		expect(result.themes.items).toHaveLength(1)
		expect(result.commands.collisions).toEqual([])
		expect(result.themes.collisions).toEqual([])
	})

	test("command and theme catalog projections stay pure and collision-aware", () => {
		const first = descriptorFromManifest()
		const second = descriptorFromManifest(
			parsePluginManifest({
				...baseManifest,
				id: "firefly.built-in.other-command-theme",
				displayName: "Other command theme",
			}),
		)
		const stateMap = {
			[first.normalizedId]: defaultCapabilityState(first),
			[second.normalizedId]: defaultCapabilityState(second),
		}
		expect(projectCommandsFromCatalog([first], stateMap).collisions).toEqual([])
		expect(projectThemesFromCatalog([first], stateMap).collisions).toEqual([])
		expect(projectCommandsFromCatalog([first, second], stateMap).collisions[0]?.family).toBe("commands")
		expect(projectThemesFromCatalog([first, second], stateMap).collisions[0]?.family).toBe("themes")
	})
})
