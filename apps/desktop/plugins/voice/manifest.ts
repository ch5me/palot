/**
 * Voice — first-party Firefly plugin.
 *
 * `firefly.built-in.surface.voice` per the locked first-party
 * migration matrix. This manifest replaces the former
 * `FIREFLY_SURFACE_REGISTRY` row (id: "voice") and the
 * `voiceSurfaceEnabledAtom` feature flag.
 *
 * persistenceKey and telemetryNamespace byte-match the deleted V1 row
 * for stable identity across the cutover.
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const voicePluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.voice",
	displayName: "Voice",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Input-first voice lane: mic dictation inserts transcripts into the active chat composer for the focused session. Preserve active session, last transcript, and pane-writer target.",
	license: "MIT",
	manifestRevision: 1,
	engines: {},
	trust: "built-in",
	lifecycle: {
		autoEnable: true,
		keepAliveAcrossSessions: false,
		quarantineOnCrashCount: 3,
	},
	activationEvents: [
		{ kind: "onPanelOpen", panelId: "voice" },
		{ kind: "onCommand", commandId: "open-voice" },
		{ kind: "onCommand", commandId: "toggle-voice" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.voice.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.voice.state" },
	],
	contributes: {
		panels: [
			{
				id: "voice",
				title: "Voice",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "mic",
				defaultOn: true,
				commandIds: ["open-voice", "toggle-voice"],
				persistenceKey: "side-panel.voice",
				telemetryNamespace: "firefly.surface.voice",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-voice",
				title: "Voice: Open",
				description: "Open the Voice side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-voice",
				title: "Voice: Toggle Surface",
				description: "Enable or disable the Voice surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.voice.open",
				title: "Open Voice panel",
				description: "Open the Voice side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "voice", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.voice.state",
				title: "Get Voice surface state",
				description:
					"Read the Voice surface state: whether the tab is available, open, and active for the focused session.",
				scope: "session",
				requires: ["host:bridge.ui-state-read", "host:tool.register"],
				args: {
					sessionId: z.string().optional(),
				},
				timeoutMs: 5_000,
			},
		],
	},
	capabilities: [
		"host:panel.register",
		"host:command.register",
		"host:tool.register",
		"host:bridge.ui-state-read",
		"host:bridge.ui-state-write",
	],
	tags: ["surface", "voice", "first-party", "phase-3"],
}

export const VOICE_PLUGIN_ID = voicePluginManifest.id
export const VOICE_PANEL_PROJECTED_ID = `${voicePluginManifest.id}.voice`
export const VOICE_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.voice.open"
export const VOICE_TOOL_STATE_ID = "plugin.firefly.built-in.surface.voice.state"
