import { z } from "zod"

import type { PluginManifest } from "./manifest"

export const MEMORY_SURFACE_PLUGIN_ID = "firefly.built-in.surface.memory"

export const memorySurfaceManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: MEMORY_SURFACE_PLUGIN_ID,
	displayName: "Memory Surface",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"First-party memory workspace surface. Hosts the synthetic memory document tree and editor flow on top of Palot memory services.",
	license: "MIT",
	manifestRevision: 1,
	engines: {
		desktop: "0.11.0",
	},
	trust: "built-in",
	lifecycle: {
		autoEnable: true,
		keepAliveAcrossSessions: false,
		quarantineOnCrashCount: 5,
		restartBackoffMs: 2_000,
	},
	activationEvents: [{ kind: "onStartup" }],
	contributes: {
		panels: [
			{
				id: "memory",
				title: "Memory",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "DatabaseIcon",
				defaultOn: false,
				commandIds: [],
				persistenceKey: "side-panel.memory",
				telemetryNamespace: "firefly.surface.memory",
				availability: {
					requires: ["host:panel.register"],
				},
				render: {
					mode: "host-reconciler",
				},
			},
		],
		widgets: [],
		commands: [],
		themes: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.memory.open",
				title: "Open memory surface",
				description: "Open the first-class memory workspace surface in the desktop UI.",
				scope: "session",
				requires: ["host:panel.register", "host:tool.register"],
				args: {
					projectId: z.string().optional(),
				},
				timeoutMs: 5_000,
				uiHints: { refreshProjection: true },
			},
		],
	},
	capabilities: ["host:panel.register", "host:tool.register"],
	bridge: {
		schemaVersion: 1,
		agentContextLabel: "memory-surface-context",
		requiresSessionBinding: false,
		bindOnActivation: false,
	},
	tags: ["surface", "memory", "first-party"],
}
