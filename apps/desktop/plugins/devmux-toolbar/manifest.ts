/**
 * DevMux Toolbar — first-party Firefly plugin.
 *
 * The first plugin built end-to-end against the V2 system as a worked
 * example of "a plugin that needs a Node-only host callback". It contributes
 * an inline widget (the `above-chat` toolbar zone, same family as the Task
 * list) that, for the project you've clicked into, reads that project's
 * `devmux.config.json`, lists the declared dev services, shows whether each
 * is running, launches them on demand, and opens the running service either
 * embedded in-app or in your system browser.
 *
 * Architecture (see `.agents/skills/firefly-plugins/SKILL.md`):
 *   - This manifest is pure data: contributions + declared capabilities.
 *   - The Node-only work (read config, query tmux health, start services,
 *     open URLs) lives in the HOST, behind the `host:devmux.*` and
 *     `host:shell.open-external` capability tokens, implemented in
 *     `main/devmux/service.ts` and dispatched through the host command/tool
 *     handlers in `main/firefly-plugin/dispatch.ts`. The plugin never imports
 *     a Node library — it invokes host commands, the VS Code `registerCommand`
 *     + `vscode.tasks` model.
 *   - The rendered React component is host-bundled and wired through the
 *     renderer's static `SESSION_WIDGET_REGISTRY` (built-ins render via
 *     `host-reconciler`; the manifest widget entry is the catalog/capability
 *     declaration, the registry entry is the component).
 */

import { z } from "zod"

import type { PluginManifest } from "../../src/shared/firefly-plugin/manifest"

export const DEVMUX_TOOLBAR_PLUGIN_ID = "firefly.built-in.devmux-toolbar"

export const DEVMUX_TOOL_LIST_ID = "plugin.firefly.built-in.devmux-toolbar.list"
export const DEVMUX_TOOL_STATUS_ID = "plugin.firefly.built-in.devmux-toolbar.status"
export const DEVMUX_TOOL_ENSURE_ID = "plugin.firefly.built-in.devmux-toolbar.ensure"

export const DEVMUX_COMMAND_LIST_ID = "devmux-list"
export const DEVMUX_COMMAND_STATUS_ID = "devmux-status"
export const DEVMUX_COMMAND_LAUNCH_ID = "devmux-launch"
export const DEVMUX_COMMAND_OPEN_EXTERNAL_ID = "devmux-open-external"

export const devmuxToolbarManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: DEVMUX_TOOLBAR_PLUGIN_ID,
	displayName: "DevMux Toolbar",
	version: "0.1.0",
	publisher: "Firefly",
	description:
		"Lists the DevMux services declared in the active project's devmux.config.json, shows whether each is running, launches them, and opens the running service in-app or in your browser.",
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
		{ kind: "onStartup" },
		{ kind: "onWidgetPlace", widgetId: "devmux-toolbar" },
		{ kind: "onCommand", commandId: DEVMUX_COMMAND_LIST_ID },
		{ kind: "onCommand", commandId: DEVMUX_COMMAND_STATUS_ID },
		{ kind: "onCommand", commandId: DEVMUX_COMMAND_LAUNCH_ID },
		{ kind: "onCommand", commandId: DEVMUX_COMMAND_OPEN_EXTERNAL_ID },
		{ kind: "onToolCall", toolId: DEVMUX_TOOL_LIST_ID },
		{ kind: "onToolCall", toolId: DEVMUX_TOOL_STATUS_ID },
		{ kind: "onToolCall", toolId: DEVMUX_TOOL_ENSURE_ID },
	],
	contributes: {
		panels: [],
		navSidebars: [],
		widgets: [
			{
				id: "devmux-toolbar",
				title: "DevMux",
				zoneId: "above-chat",
				defaultEnabled: true,
				icon: "server",
				availability: { requires: ["host:devmux.read"] },
				render: { mode: "host-reconciler" },
			},
		],
		commands: [
			{
				id: DEVMUX_COMMAND_LIST_ID,
				title: "DevMux: List services",
				description: "List the DevMux services declared in a project's devmux config.",
				category: "DevMux",
				requires: ["host:command.register", "host:devmux.read"],
			},
			{
				id: DEVMUX_COMMAND_STATUS_ID,
				title: "DevMux: Service status",
				description: "Read live running state + URL for a project's DevMux services.",
				category: "DevMux",
				requires: ["host:command.register", "host:devmux.read"],
			},
			{
				id: DEVMUX_COMMAND_LAUNCH_ID,
				title: "DevMux: Launch service",
				description: "Ensure a DevMux service is running (start it if needed) and resolve its URL.",
				category: "DevMux",
				requires: ["host:command.register", "host:devmux.control"],
			},
			{
				id: DEVMUX_COMMAND_OPEN_EXTERNAL_ID,
				title: "DevMux: Open service in browser",
				description: "Open a running DevMux service URL in the system browser.",
				category: "DevMux",
				requires: ["host:command.register", "host:shell.open-external"],
			},
		],
		themes: [],
		components: [],
		tools: [
			{
				id: DEVMUX_TOOL_LIST_ID,
				title: "List DevMux services",
				description:
					"List the DevMux services declared in the given project's devmux.config.json (name, command, port, description).",
				scope: "project",
				requires: ["host:tool.register", "host:devmux.read"],
				args: { projectDir: z.string().min(1) },
				timeoutMs: 10_000,
			},
			{
				id: DEVMUX_TOOL_STATUS_ID,
				title: "Get DevMux service status",
				description:
					"Read live running state and URL for every DevMux service in the given project directory.",
				scope: "project",
				requires: ["host:tool.register", "host:devmux.read"],
				args: { projectDir: z.string().min(1) },
				timeoutMs: 15_000,
			},
			{
				id: DEVMUX_TOOL_ENSURE_ID,
				title: "Start a DevMux service",
				description:
					"Idempotently ensure a DevMux service is running and healthy in the given project directory, then return its URL.",
				scope: "project",
				requires: ["host:tool.register", "host:devmux.control"],
				args: {
					projectDir: z.string().min(1),
					service: z.string().min(1),
				},
				timeoutMs: 180_000,
			},
		],
	},
	capabilities: [
		"host:widget.register",
		"host:command.register",
		"host:tool.register",
		"host:devmux.read",
		"host:devmux.control",
		"host:shell.open-external",
	],
	bridge: {
		schemaVersion: 1,
		agentContextLabel: "DevMux",
		systemContextBlock:
			"DevMux services for the active project can be listed, status-checked, and started via the DevMux tools. Use the project directory of the focused session as projectDir.",
		requiresSessionBinding: false,
		bindOnActivation: false,
	},
	tags: ["devmux", "dev-services", "toolbar", "first-party"],
}
