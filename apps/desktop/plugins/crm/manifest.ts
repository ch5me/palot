/**
 * CRM / Contacts — first-party Firefly plugin.
 *
 * `firefly.built-in.surface.crm` per the locked first-party
 * migration matrix row (`shared/firefly-plugin/first-party-migration.ts`).
 * This TypeScript manifest is the same Zod artifact the catalog
 * validates for every plugin; built-ins keep TS manifests (the
 * manifest is code), third-party ships the JSON profile — both derive
 * identical descriptors.
 *
 * The CRM side-panel tab, its palette commands, and its paired
 * OpenCode tools all project from THIS file. Its former
 * `FIREFLY_SURFACE_REGISTRY` row and `crmSurfaceEnabledAtom`
 * feature flag are deleted; enable/disable now flows through the host
 * plugin lifecycle (catalog stateOverrides).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const crmPluginManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: "firefly.built-in.surface.crm",
	displayName: "Contacts / CRM",
	version: "0.11.0",
	publisher: "Firefly",
	description:
		"Contact management and inbox threading: manage contacts, send drafts, and track inbox threads per project.",
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
		{ kind: "onPanelOpen", panelId: "crm" },
		{ kind: "onCommand", commandId: "open-crm" },
		{ kind: "onCommand", commandId: "toggle-crm" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.crm.open" },
		{ kind: "onToolCall", toolId: "plugin.firefly.built-in.surface.crm.state" },
	],
	contributes: {
		panels: [
			{
				id: "crm",
				title: "Contacts / CRM",
				formFactor: "side-panel-tab",
				defaultZone: "side-panel",
				icon: "users",
				defaultOn: true,
				commandIds: ["open-crm", "toggle-crm"],
				persistenceKey: "side-panel.crm",
				telemetryNamespace: "firefly.surface.crm",
				availability: { requires: [] },
				render: { mode: "host-reconciler" },
			},
		],
		navSidebars: [],
		widgets: [],
		commands: [
			{
				id: "open-crm",
				title: "CRM: Open",
				description: "Open the Contacts / CRM side-panel tab.",
				category: "Surface",
				requires: ["host:command.register"],
			},
			{
				id: "toggle-crm",
				title: "CRM: Toggle Surface",
				description: "Enable or disable the Contacts / CRM surface.",
				category: "Surface",
				requires: ["host:command.register"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: "plugin.firefly.built-in.surface.crm.open",
				title: "Open CRM panel",
				description: "Open the Contacts / CRM side-panel tab in the Firefly desktop UI.",
				scope: "session",
				requires: ["host:bridge.ui-state-write", "host:tool.register"],
				args: {},
				timeoutMs: 5_000,
				uiHints: { openPanel: "crm", refreshProjection: true },
			},
			{
				id: "plugin.firefly.built-in.surface.crm.state",
				title: "Get CRM surface state",
				description:
					"Read the CRM surface state: whether the tab is available, open, and active for the focused session.",
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
	tags: ["surface", "crm", "contacts", "first-party", "phase-2"],
}

export const CRM_PLUGIN_ID = crmPluginManifest.id
export const CRM_PANEL_PROJECTED_ID = `${crmPluginManifest.id}.crm`
export const CRM_TOOL_OPEN_ID = "plugin.firefly.built-in.surface.crm.open"
export const CRM_TOOL_STATE_ID = "plugin.firefly.built-in.surface.crm.state"
