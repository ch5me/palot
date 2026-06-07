import { describe, expect, test } from "bun:test"
import { z } from "zod"

import {
	derivePluginDescriptor,
	derivePluginDescriptorOrNull,
	HOST_PANEL_SLOTS,
	HOST_WIDGET_ZONES,
	parseAndDerivePluginDescriptor,
	parsePluginManifest,
	PluginDescriptorError,
	pluginManifestSchema,
	safeParsePluginManifest,
} from "./index"

const baseManifest = {
	apiVersion: "firefly.plugin/v2" as const,
	kind: "PluginManifest" as const,
	id: "firefly.built-in.review",
	displayName: "Review Panel",
	version: "1.0.0",
	trust: "built-in" as const,
	lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
	activationEvents: [{ kind: "onStartup" as const }],
	contributes: {
		panels: [
			{
				id: "review",
				title: "Changes",
				formFactor: "side-panel-tab" as const,
				defaultZone: "side-panel",
				defaultOn: true,
				commandIds: ["review-open"],
				render: { mode: "host-reconciler" as const },
			},
		],
		commands: [
			{
				id: "review-open",
				title: "Open review",
				requires: [],
			},
		],
		tools: [
			{
				id: "review.run",
				title: "Run review",
				description: "Trigger a review run",
				scope: "session" as const,
				requires: ["host:command.register"],
				args: { dryRun: z.boolean().optional() },
			},
		],
		themes: [
			{
				id: "default-light",
				label: "Default Light",
				kind: "light" as const,
				tokens: { "--bg": "#fff" },
			},
		],
		widgets: [],
	},
	capabilities: ["host:command.register", "host:tool.register"],
}

describe("pluginManifestSchema", () => {
	test("accepts a well-formed built-in manifest", () => {
		const parsed = parsePluginManifest(baseManifest)
		expect(parsed.id).toBe("firefly.built-in.review")
		expect(parsed.contributes.panels).toHaveLength(1)
		expect(parsed.contributes.tools[0].scope).toBe("session")
	})

	test("rejects unknown apiVersion", () => {
		const result = safeParsePluginManifest({ ...baseManifest, apiVersion: "firefly.plugin/v1" })
		expect(result.manifest).toBeNull()
		expect(result.issues.length).toBeGreaterThan(0)
	})

	test("rejects non-built-in plugins using firefly. prefix", () => {
		const result = safeParsePluginManifest({
			...baseManifest,
			id: "firefly.not-built-in",
			trust: "local-dev",
		})
		expect(result.manifest).toBeNull()
		expect(result.issues.some((i) => i.message.includes('"firefly." prefix'))).toBe(true)
	})

	test("rejects command ids that collide with reserved host prefixes", () => {
		const result = safeParsePluginManifest({
			...baseManifest,
			contributes: {
				...baseManifest.contributes,
				commands: [{ id: "surface.review.open", title: "x", requires: [] }],
			},
		})
		expect(result.manifest).toBeNull()
		expect(result.issues.some((i) => i.message.includes("reserved host prefixes"))).toBe(true)
	})

	test("rejects tool ids that start with the plugins. reserved prefix", () => {
		const result = safeParsePluginManifest({
			...baseManifest,
			contributes: {
				...baseManifest.contributes,
				tools: [
					{
						id: "plugins.list",
						title: "list",
						description: "x",
						scope: "session",
						requires: [],
						args: {},
					},
				],
			},
		})
		expect(result.manifest).toBeNull()
		expect(result.issues.some((i) => i.message.includes("reserved host prefix"))).toBe(true)
	})

	test("rejects duplicate panel ids", () => {
		const result = safeParsePluginManifest({
			...baseManifest,
			contributes: {
				...baseManifest.contributes,
				panels: [
					baseManifest.contributes.panels[0],
					{ ...baseManifest.contributes.panels[0], title: "Other" },
				],
			},
		})
		expect(result.manifest).toBeNull()
		expect(result.issues.some((i) => i.message.includes("duplicate panel id"))).toBe(true)
	})

	test("rejects onCommand activation that references an undeclared command", () => {
		const result = safeParsePluginManifest({
			...baseManifest,
			activationEvents: [{ kind: "onCommand", commandId: "ghost.open" }],
		})
		expect(result.manifest).toBeNull()
		expect(
			result.issues.some((i) => i.message.includes("undeclared command id: ghost.open")),
		).toBe(true)
	})

	test("rejects panel.commandIds that reference an undeclared command", () => {
		const result = safeParsePluginManifest({
			...baseManifest,
			contributes: {
				...baseManifest.contributes,
				panels: [
					{
						...baseManifest.contributes.panels[0],
						commandIds: ["ghost.toggle"],
					},
				],
			},
		})
		expect(result.manifest).toBeNull()
		expect(
			result.issues.some((i) => i.message.includes("undeclared command id: ghost.toggle")),
		).toBe(true)
	})

	test("rejects unknown fields under strict mode", () => {
		const result = safeParsePluginManifest({ ...baseManifest, invented: true })
		expect(result.manifest).toBeNull()
	})

	test("rejects bad semver", () => {
		const result = safeParsePluginManifest({ ...baseManifest, version: "v1" })
		expect(result.manifest).toBeNull()
	})

	test("rejects a manifest whose id is reserved for built-ins but trust tier is not built-in", () => {
		const result = safeParsePluginManifest({
			...baseManifest,
			id: "acme.third-party.review",
			trust: "unsigned-third-party",
		})
		expect(result.manifest).not.toBeNull()
		const manifest = result.manifest
		expect(manifest?.id).toBe("acme.third-party.review")
		expect(manifest?.trust).toBe("unsigned-third-party")
	})

	test("allows an empty contributes object (defaults applied)", () => {
		const parsed = parsePluginManifest({
			...baseManifest,
			contributes: undefined,
		})
		expect(parsed.contributes.panels).toEqual([])
		expect(parsed.contributes.widgets).toEqual([])
		expect(parsed.contributes.commands).toEqual([])
		expect(parsed.contributes.themes).toEqual([])
		expect(parsed.contributes.tools).toEqual([])
	})
})

describe("derivePluginDescriptor", () => {
	test("produces a descriptor with default timeouts and quarantine floor", () => {
		const manifest = parsePluginManifest(baseManifest)
		const descriptor = derivePluginDescriptor(manifest, { appVersion: "0.11.0" })
		expect(descriptor.normalizedId).toBe("firefly.built-in.review")
		expect(descriptor.derived.appVersion).toBe("0.11.0")
		expect(descriptor.derived.quarantineOnCrashCount).toBe(3)
		expect(descriptor.derived.defaultToolTimeoutMs).toBe(60_000)
		expect(descriptor.derived.defaultDispatchTimeoutMs).toBe(5_000)
		expect(descriptor.derived.hostPanelSlots).toEqual(HOST_PANEL_SLOTS)
		expect(descriptor.derived.hostWidgetZones).toEqual(HOST_WIDGET_ZONES)
	})

	test("honors manifest.lifecycle.quarantineOnCrashCount when set", () => {
		const manifest = parsePluginManifest({
			...baseManifest,
			lifecycle: { autoEnable: true, keepAliveAcrossSessions: false, quarantineOnCrashCount: 7 },
		})
		const descriptor = derivePluginDescriptor(manifest, { appVersion: "0.11.0" })
		expect(descriptor.derived.quarantineOnCrashCount).toBe(7)
	})

	test("rejects when appVersion is below engines.desktop floor", () => {
		const manifest = parsePluginManifest({
			...baseManifest,
			engines: { desktop: "1.0.0" },
		})
		expect(() => derivePluginDescriptor(manifest, { appVersion: "0.11.0" })).toThrow(
			PluginDescriptorError,
		)
	})

	test("rejects when a panel declares an unknown host panel slot", () => {
		const manifest = parsePluginManifest({
			...baseManifest,
			contributes: {
				...baseManifest.contributes,
				panels: [
					{
						...baseManifest.contributes.panels[0],
						defaultZone: "floating-window",
					},
				],
			},
		})
		expect(() => derivePluginDescriptor(manifest, { appVersion: "0.11.0" })).toThrow(
			PluginDescriptorError,
		)
	})

	test("rejects when a widget declares an unknown host widget zone", () => {
		const manifest = parsePluginManifest({
			...baseManifest,
			contributes: {
				...baseManifest.contributes,
				widgets: [
					{
						id: "new-widget",
						title: "x",
						zoneId: "below-chat",
						defaultEnabled: true,
						render: { mode: "host-reconciler" },
					},
				],
			},
		})
		expect(() => derivePluginDescriptor(manifest, { appVersion: "0.11.0" })).toThrow(
			PluginDescriptorError,
		)
	})

	test("derivePluginDescriptorOrNull returns null on host rejection", () => {
		const manifest = parsePluginManifest({
			...baseManifest,
			engines: { desktop: "1.0.0" },
		})
		expect(derivePluginDescriptorOrNull(manifest, { appVersion: "0.11.0" })).toBeNull()
	})

	test("parseAndDerivePluginDescriptor rejects raw bad input", () => {
		expect(() => parseAndDerivePluginDescriptor({ id: "x" }, { appVersion: "0.11.0" })).toThrow()
	})

	test("derives with widget zone aligned to current host seed", () => {
		const manifest = parsePluginManifest({
			...baseManifest,
			contributes: {
				...baseManifest.contributes,
				widgets: [
					{
						id: "tasks",
						title: "Tasks",
						zoneId: "above-chat",
						defaultEnabled: true,
						render: { mode: "host-reconciler" },
					},
				],
			},
		})
		const descriptor = derivePluginDescriptor(manifest, { appVersion: "0.11.0" })
		expect(descriptor.widgets).toHaveLength(1)
		expect(descriptor.widgets[0].zoneId).toBe("above-chat")
	})
})

describe("V2 invariants", () => {
	test("manifest schema is the same object exported from manifest.ts", () => {
		expect(pluginManifestSchema).toBeDefined()
	})

	test("HOST_PANEL_SLOTS is the closed host vocabulary", () => {
		expect(HOST_PANEL_SLOTS).toEqual(["side-panel", "main-pane"])
	})

	test("HOST_WIDGET_ZONES mirrors the current renderer seed", () => {
		expect(HOST_WIDGET_ZONES).toEqual(["above-chat", "chat-inline-right"])
	})
})
