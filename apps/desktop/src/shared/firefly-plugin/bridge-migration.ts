/**
 * Firefly Plugin System V2 — Bridge migration (palot-bridge -> V2)
 *
 * The current `palot-bridge.js` runtime is the closest thing the
 * desktop app already has to a first-party V2 plugin. It exposes
 * 13 tools and a system-context block. The V2 plan calls for
 * moving every current bridge tool and hook onto a V2 landing
 * point so the runtime can drop the special-case Palot bridge
 * shim and treat the bridge as one more plugin on the canonical
 * path.
 *
 * This file encodes that migration as a source artifact: for every
 * current bridge capability, it records the V2 landing point and
 * the disposition. The matrix is append-only.
 */

import { z } from "zod"

export const BRIDGE_LANDING_POINTS = [
	"plugin.tool.<pluginId>.<shortName>",
	"plugin.panel.open",
	"plugin.widget.place",
	"plugin.command.run",
	"plugin.theme.apply",
	"plugin.theme.preview",
	"plugin.theme.reset",
	"plugins.list",
	"plugins.describe",
	"plugins.tools",
	"plugins.panels",
	"plugins.widgets",
	"plugins.commands",
	"plugins.themes",
	"plugins.state",
	"plugins.permissions",
	"plugins.lifecycle",
	"host.bridge.session-read",
	"host.bridge.ui-state-read",
	"host.bridge.ui-state-write",
	"experimental.chat.system.transform",
	"event:session.idle",
] as const
export type BridgeLandingPoint = (typeof BRIDGE_LANDING_POINTS)[number]

export const bridgeLandingPointSchema = z.enum(BRIDGE_LANDING_POINTS)

export const BRIDGE_CATEGORIES = [
	"browser-control",
	"side-panel-control",
	"ui-state-read",
	"connected-app-discovery",
	"system-context",
	"event-handling",
] as const
export type BridgeCategory = (typeof BRIDGE_CATEGORIES)[number]

export const BRIDGE_DISPOSITIONS = ["move", "deprecate", "remove"] as const
export type BridgeDisposition = (typeof BRIDGE_DISPOSITIONS)[number]

export interface BridgeMigrationRow {
	readonly currentId: string
	readonly category: BridgeCategory
	readonly currentSurface: string
	readonly landingPoint: BridgeLandingPoint
	readonly targetPluginId: string
	readonly disposition: BridgeDisposition
	readonly removeIn: "v2.0" | "v2.1" | "v2.2" | "defer"
	readonly notes: string
}

export const BRIDGE_MIGRATION_MATRIX: readonly BridgeMigrationRow[] = [
	{
		currentId: "browser_status",
		category: "browser-control",
		currentSurface: "palot-bridge.js :: tool.browser_status",
		landingPoint: "plugin.tool.<pluginId>.<shortName>",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "move",
		removeIn: "v2.0",
		notes: "V2 generalized projection wraps the args; runtime stops calling the Palot-only implementation.",
	},
	{
		currentId: "browser_open",
		category: "browser-control",
		currentSurface: "palot-bridge.js :: tool.browser_open",
		landingPoint: "plugin.tool.<pluginId>.<shortName>",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "move",
		removeIn: "v2.0",
		notes: "Requires host:browser.lane-control; args migrate to Zod schema.",
	},
	{
		currentId: "browser_navigate",
		category: "browser-control",
		currentSurface: "palot-bridge.js :: tool.browser_navigate",
		landingPoint: "plugin.tool.<pluginId>.<shortName>",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "move",
		removeIn: "v2.0",
		notes: "Same shape as browser_open; shares the lane-control capability.",
	},
	{
		currentId: "browser_tabs",
		category: "browser-control",
		currentSurface: "palot-bridge.js :: tool.browser_tabs",
		landingPoint: "plugin.tool.<pluginId>.<shortName>",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "move",
		removeIn: "v2.0",
		notes: "Browser-tab control lands on host:browser.tab-control.",
	},
	{
		currentId: "browser_click",
		category: "browser-control",
		currentSurface: "palot-bridge.js :: tool.browser_click",
		landingPoint: "plugin.tool.<pluginId>.<shortName>",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "move",
		removeIn: "v2.0",
		notes: "Dispatch is broker-mediated; runtime stops calling action dispatcher directly.",
	},
	{
		currentId: "browser_type",
		category: "browser-control",
		currentSurface: "palot-bridge.js :: tool.browser_type",
		landingPoint: "plugin.tool.<pluginId>.<shortName>",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "move",
		removeIn: "v2.0",
		notes: "Same as browser_click; lands on host:browser.action-dispatch.",
	},
	{
		currentId: "browser_scroll",
		category: "browser-control",
		currentSurface: "palot-bridge.js :: tool.browser_scroll",
		landingPoint: "plugin.tool.<pluginId>.<shortName>",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "move",
		removeIn: "v2.0",
		notes: "Scroll is action-dispatch; V2 wraps the arg schema in z.object(passthrough).",
	},
	{
		currentId: "open_side_panel",
		category: "side-panel-control",
		currentSurface: "palot-bridge.js :: tool.open_side_panel",
		landingPoint: "plugin.tool.<pluginId>.<shortName>",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "move",
		removeIn: "v2.0",
		notes: "Generalized surface-wrapper tool; the V2 host also exposes plugin.panel.open for plugin-self-service use.",
	},
	{
		currentId: "ui_state",
		category: "ui-state-read",
		currentSurface: "palot-bridge.js :: tool.ui_state",
		landingPoint: "plugin.tool.<pluginId>.<shortName>",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "move",
		removeIn: "v2.0",
		notes: "Side-panel snapshot read; lands on host:bridge.ui-state-read.",
	},
	{
		currentId: "search_tools",
		category: "connected-app-discovery",
		currentSurface: "palot-bridge.js :: tool.search_tools",
		landingPoint: "plugins.tools",
		targetPluginId: "host:built-in",
		disposition: "remove",
		removeIn: "v2.0",
		notes: "V2 generalizes connected-app discovery under plugins.tools; the Palot copy is redundant and goes away.",
	},
	{
		currentId: "describe_tool",
		category: "connected-app-discovery",
		currentSurface: "palot-bridge.js :: tool.describe_tool",
		landingPoint: "plugins.tools",
		targetPluginId: "host:built-in",
		disposition: "remove",
		removeIn: "v2.0",
		notes: "Replaced by the host's plugins.tools with a structured describe argument.",
	},
	{
		currentId: "call_tool",
		category: "connected-app-discovery",
		currentSurface: "palot-bridge.js :: tool.call_tool",
		landingPoint: "plugins.tools",
		targetPluginId: "host:built-in",
		disposition: "remove",
		removeIn: "v2.0",
		notes: "Replaced by the host's plugins.tools with explicit execute semantics.",
	},
	{
		currentId: "tools_status",
		category: "connected-app-discovery",
		currentSurface: "palot-bridge.js :: tool.tools_status",
		landingPoint: "plugins.tools",
		targetPluginId: "host:built-in",
		disposition: "remove",
		removeIn: "v2.0",
		notes: "Replaced by plugins.tools with a status filter.",
	},
	{
		currentId: "experimental.chat.system.transform",
		category: "system-context",
		currentSurface: "palot-bridge.js :: experimental.chat.system.transform",
		landingPoint: "experimental.chat.system.transform",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "deprecate",
		removeIn: "v2.1",
		notes: "Hook is general-purpose; the bridge-projection helper now produces it from bridge.systemContextBlock.",
	},
	{
		currentId: "event:session.idle",
		category: "event-handling",
		currentSurface: "palot-bridge.js :: event",
		landingPoint: "event:session.idle",
		targetPluginId: "firefly.built-in.palot-bridge",
		disposition: "deprecate",
		removeIn: "v2.1",
		notes: "The bridge-projection helper normalizes this; plugin keeps the listener registration.",
	},
] as const satisfies readonly BridgeMigrationRow[]

export function groupBridgeMigrationByDisposition(): Readonly<
	Record<BridgeDisposition, readonly BridgeMigrationRow[]>
> {
	const out: Record<BridgeDisposition, BridgeMigrationRow[]> = {
		move: [],
		deprecate: [],
		remove: [],
	}
	for (const row of BRIDGE_MIGRATION_MATRIX) {
		out[row.disposition].push(row)
	}
	return out
}

export function groupBridgeMigrationByCategory(): Readonly<
	Record<BridgeCategory, readonly BridgeMigrationRow[]>
> {
	const out: Record<BridgeCategory, BridgeMigrationRow[]> = {
		"browser-control": [],
		"side-panel-control": [],
		"ui-state-read": [],
		"connected-app-discovery": [],
		"system-context": [],
		"event-handling": [],
	}
	for (const row of BRIDGE_MIGRATION_MATRIX) {
		out[row.category].push(row)
	}
	return out
}

export function findBridgeMigrationRow(currentId: string): BridgeMigrationRow | null {
	for (const row of BRIDGE_MIGRATION_MATRIX) {
		if (row.currentId === currentId) return row
	}
	return null
}

export function pendingBridgeMigrationRows(
	currentTarget: "v2.0" | "v2.1" | "v2.2",
): readonly BridgeMigrationRow[] {
	const order = { "v2.0": 0, "v2.1": 1, "v2.2": 2 } as const
	const current = order[currentTarget]
	return BRIDGE_MIGRATION_MATRIX.filter((row) => order[row.removeIn] > current)
}
