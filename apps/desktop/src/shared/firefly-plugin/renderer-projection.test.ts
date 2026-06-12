import { describe, expect, test } from "bun:test"
import { z } from "zod"

import { derivePluginDescriptor, parsePluginManifest } from "./index"
import {
	defaultCapabilityState,
	projectCommands,
	projectCommandsFromCatalog,
	projectComponents,
	projectComponentsFromCatalog,
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
		components: [
			{
				id: "decision_card",
				apiVersion: 1,
				category: "decision",
				props: z.object({
					title: z.string(),
					options: z.array(z.object({ id: z.string(), label: z.string() })),
					selected: z.string().nullable(),
				}),
				events: {},
				state: {},
				supports_append: false,
				presentation: "inline-artifact",
				scope: "generic",
				maturity: "stable",
				defaultPlacement: "inline",
				allowedPlacements: ["inline", "chat-inline-right"],
				docsPath: "docs/genui-artifact-architecture.md",
				example: {
					component: "decision_card",
					props: {
						title: "Pick launch path",
						options: [{ id: "a", label: "A" }],
						selected: null,
					},
				},
				capabilityGates: [],
				hostVocabulary: {
					slots: ["notes"],
					zones: ["loom-tree"],
				},
				conflictPolicy: "ask",
			},
		],
	},
	capabilities: ["host:panel.register", "host:widget.register", "host:command.register"],
})

function descriptorFromManifest(manifest = baseManifest) {
	return derivePluginDescriptor(manifest, { appVersion: "0.11.0" })
}

describe("renderer projections", () => {
	test("all projections are independent and pure", () => {
		const descriptor = descriptorFromManifest()
		const capabilityState = defaultCapabilityState(descriptor)
		const panels = projectSidePanels(descriptor, capabilityState)
		const widgets = projectSessionWidgets(descriptor, capabilityState)
		const commands = projectCommands(descriptor, capabilityState)
		const themes = projectThemes(descriptor, capabilityState)
		const components = projectComponents(descriptor, capabilityState)

		expect(panels).toHaveLength(1)
		expect(widgets).toHaveLength(1)
		expect(commands).toHaveLength(1)
		expect(themes).toHaveLength(1)
		expect(components).toHaveLength(1)
		expect(components[0]?.contributionId).toBe("decision_card")
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
		expect(projectComponents(descriptor, state)).toEqual([])
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
		const result = projectSidePanelsFromCatalog([first, second], {
			[first.normalizedId]: defaultCapabilityState(first),
			[second.normalizedId]: defaultCapabilityState(second),
		})
		expect(result.items).toHaveLength(2)
		expect(result.collisions[0]?.family).toBe("panels")
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
		const result = projectSessionWidgetsFromCatalog([first, second], {
			[first.normalizedId]: defaultCapabilityState(first),
			[second.normalizedId]: defaultCapabilityState(second),
		})
		expect(result.items).toHaveLength(2)
		expect(result.collisions[0]?.family).toBe("widgets")
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
		expect(panel?.availability.reason?.hostCapabilityState.grantedTokens).toEqual([])
	})

	test("themes keep their data-only envelope", () => {
		const descriptor = descriptorFromManifest()
		const [theme] = projectThemes(descriptor, defaultCapabilityState(descriptor))
		expect(theme?.contract.hostRendering.dataOnly).toBe(true)
		expect(theme?.envelope.kind).toBe("system-adaptive")
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
	})

	test("component projections surface expected rows", () => {
		const descriptor = descriptorFromManifest()
		const [component] = projectComponents(descriptor, defaultCapabilityState(descriptor))
		expect(component?.category).toBe("decision")
		expect(component?.hostVocabulary.zones).toEqual(["loom-tree"])
		expect(component?.supportsAppend).toBe(false)
	})

	test("family projections stay independently callable from catalog helper", () => {
		const descriptor = descriptorFromManifest()
		const result = projectRendererFamiliesFromCatalog([descriptor], {
			[descriptor.normalizedId]: defaultCapabilityState(descriptor),
		})
		expect(result.panels.items).toHaveLength(1)
		expect(result.widgets.items).toHaveLength(1)
		expect(result.commands.items).toHaveLength(1)
		expect(result.themes.items).toHaveLength(1)
		expect(result.components.items).toHaveLength(1)
	})

	test("command theme and component catalog projections stay collision-aware", () => {
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
		expect(projectComponentsFromCatalog([first], stateMap).collisions).toEqual([])
		expect(projectCommandsFromCatalog([first, second], stateMap).collisions[0]?.family).toBe("commands")
		expect(projectThemesFromCatalog([first, second], stateMap).collisions[0]?.family).toBe("themes")
		expect(projectComponentsFromCatalog([first, second], stateMap).collisions[0]?.family).toBe("components")
	})
})
