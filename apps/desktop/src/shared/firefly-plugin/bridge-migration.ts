/**
 * Firefly Plugin System V2 — Bridge migration (palot-bridge -> V2)
 *
 * The current `palot-bridge.js` runtime is the closest thing the
 * desktop app already has to a first-party V2 plugin. After legacy
 * browser/discovery cutover, it keeps side-panel tools and a
 * system-context block. The V2 plan calls for moving the remaining
 * bridge tools and hooks onto a V2 landing point so the runtime can drop the special-case Palot bridge
 * shim and treat the bridge as one more plugin on the canonical
 * path.
 *
 * This file encodes the still-live migration surface as a source artifact: for every
 * remaining bridge capability, it records the V2 landing point and disposition.
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
	currentTarget: "defer" | "v2.0" | "v2.1" | "v2.2",
): readonly BridgeMigrationRow[] {
	const order = { defer: -1, "v2.0": 0, "v2.1": 1, "v2.2": 2 } as const satisfies Readonly<
		Record<"defer" | "v2.0" | "v2.1" | "v2.2", number>
	>
	const current = order[currentTarget]
	return BRIDGE_MIGRATION_MATRIX.filter((row) => (order as Readonly<Record<string, number>>)[row.removeIn] > current)
}
