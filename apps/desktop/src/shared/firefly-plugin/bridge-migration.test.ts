import { describe, expect, test } from "bun:test"

import {
	BRIDGE_CATEGORIES,
	BRIDGE_LANDING_POINTS,
	bridgeLandingPointSchema,
	BRIDGE_MIGRATION_MATRIX,
	findBridgeMigrationRow,
	groupBridgeMigrationByCategory,
	groupBridgeMigrationByDisposition,
	pendingBridgeMigrationRows,
} from "./bridge-migration"

describe("BRIDGE_LANDING_POINTS vocabulary", () => {
	test("contains the expected locked tokens", () => {
		expect(BRIDGE_LANDING_POINTS).toContain("plugin.panel.open")
		expect(BRIDGE_LANDING_POINTS).toContain("plugin.theme.preview")
		expect(BRIDGE_LANDING_POINTS).toContain("plugins.list")
		expect(BRIDGE_LANDING_POINTS).toContain("plugins.describe")
		expect(BRIDGE_LANDING_POINTS).toContain("plugins.tools")
		expect(BRIDGE_LANDING_POINTS).toContain("experimental.chat.system.transform")
		expect(BRIDGE_LANDING_POINTS).toContain("event:session.idle")
	})

	test("bridgeLandingPointSchema accepts every locked token and rejects unknown", () => {
		for (const lp of BRIDGE_LANDING_POINTS) {
			expect(bridgeLandingPointSchema.parse(lp)).toBe(lp)
		}
		expect(bridgeLandingPointSchema.safeParse("surface.review.open").success).toBe(false)
	})
})

describe("BRIDGE_MIGRATION_MATRIX coverage", () => {
	test("covers the remaining palot-bridge tools", () => {
		const rowIds = BRIDGE_MIGRATION_MATRIX.map((r) => r.currentId)
		for (const id of ["open_side_panel", "ui_state"]) {
			expect(rowIds).toContain(id)
		}
	})

	test("covers both bridge hook kinds", () => {
		const ids = BRIDGE_MIGRATION_MATRIX.map((r) => r.currentId)
		expect(ids).toContain("experimental.chat.system.transform")
		expect(ids).toContain("event:session.idle")
	})

	test("every row has a landing point in the locked vocabulary", () => {
		for (const row of BRIDGE_MIGRATION_MATRIX) {
			expect(BRIDGE_LANDING_POINTS).toContain(row.landingPoint)
		}
	})

	test("every move row's landing point is plugin.tool.<pluginId>.<shortName>", () => {
		for (const row of BRIDGE_MIGRATION_MATRIX) {
			if (row.disposition === "move") {
				expect(row.landingPoint).toBe("plugin.tool.<pluginId>.<shortName>")
			}
		}
	})

	test("every row's category is in the locked vocabulary", () => {
		for (const row of BRIDGE_MIGRATION_MATRIX) {
			expect(BRIDGE_CATEGORIES).toContain(row.category)
		}
	})

	test("removed legacy rows stay absent", () => {
		const rowIds = BRIDGE_MIGRATION_MATRIX.map((r) => r.currentId)
		for (const id of [
			"browser_status",
			"browser_open",
			"browser_navigate",
			"browser_tabs",
			"browser_click",
			"browser_type",
			"browser_scroll",
			"search_tools",
			"describe_tool",
			"call_tool",
			"tools_status",
		]) {
			expect(rowIds).not.toContain(id)
		}
	})
})

describe("findBridgeMigrationRow", () => {
	test("returns the row for a known id", () => {
		const row = findBridgeMigrationRow("open_side_panel")
		expect(row?.currentId).toBe("open_side_panel")
	})

	test("returns null for an unknown id", () => {
		expect(findBridgeMigrationRow("ghost_tool")).toBeNull()
	})
})

describe("groupBridgeMigrationByDisposition", () => {
	test("every row lands in exactly one bucket", () => {
		const grouped = groupBridgeMigrationByDisposition()
		const total = grouped.move.length + grouped.deprecate.length + grouped.remove.length
		expect(total).toBe(BRIDGE_MIGRATION_MATRIX.length)
	})

	test("no removed legacy tools remain in remove", () => {
		const grouped = groupBridgeMigrationByDisposition()
		expect(grouped.remove).toHaveLength(0)
	})
})

describe("groupBridgeMigrationByCategory", () => {
	test("every row lands in exactly one category bucket", () => {
		const grouped = groupBridgeMigrationByCategory()
		let total = 0
		for (const cat of BRIDGE_CATEGORIES) {
			total += grouped[cat].length
		}
		expect(total).toBe(BRIDGE_MIGRATION_MATRIX.length)
	})

	test("browser-control and connected-app-discovery are empty after legacy cutover", () => {
		const grouped = groupBridgeMigrationByCategory()
		expect(grouped["browser-control"]).toHaveLength(0)
		expect(grouped["connected-app-discovery"]).toHaveLength(0)
	})
})

describe("pendingBridgeMigrationRows", () => {
	test("v2.0 has 2 pending (the deprecate rows targeting v2.1)", () => {
		const pending = pendingBridgeMigrationRows("v2.0")
		expect(pending.length).toBe(2)
		for (const row of pending) {
			expect(row.removeIn).toBe("v2.1")
		}
	})

	test("v2.1 has 0 pending", () => {
		expect(pendingBridgeMigrationRows("v2.1")).toHaveLength(0)
	})
})
