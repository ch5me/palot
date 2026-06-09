import { describe, expect, test } from "bun:test"

import {
	AmbiguousMigrationRowError,
	builtInPluginIdsInMatrix,
	findFirstPartyMigrationRow,
	FIRST_PARTY_MIGRATION_MATRIX,
	groupFirstPartyMigrationByPhase,
	hostOnlyExceptions,
	ROLLOUT_PHASES,
	TEARDOWN_BEHAVIORS,
} from "./first-party-migration"

describe("FIRST_PARTY_MIGRATION_MATRIX", () => {
	test("covers every current first-party panel (18 entries)", () => {
		const panelRows = FIRST_PARTY_MIGRATION_MATRIX.filter((r) => r.currentFamily === "panel")
		const panelIds = panelRows.map((r) => r.currentId)
		const expectedPanels = [
			"review",
			"browser",
			"notes",
			"pulse",
			"artifacts",
			"memory",
			"files",
			"terminal",
			"editor",
			"plugins",
			"bridges",
			"crm",
			"studio",
			"voice",
			"oracle",
			"claude",
			"ch5pm",
			"pdf-review",
		]
		for (const id of expectedPanels) {
			expect(panelIds).toContain(id)
		}
	})

	test("covers the two current session widgets", () => {
		const widgetRows = FIRST_PARTY_MIGRATION_MATRIX.filter((r) => r.currentFamily === "widget")
		expect(widgetRows.map((r) => r.currentId).sort()).toEqual(["genui-artifacts", "session-task-list"])
	})

	test("covers the three current themes", () => {
		const themeRows = FIRST_PARTY_MIGRATION_MATRIX.filter((r) => r.currentFamily === "theme")
		expect(themeRows.map((r) => r.currentId).sort()).toEqual(["cortex", "default", "liquid-glass"])
	})

	test("every row's required capabilities are non-empty when the owner is a built-in plugin", () => {
		for (const row of FIRST_PARTY_MIGRATION_MATRIX) {
			if (row.owner.kind === "built-in-plugin") {
				expect(row.requiredCapabilities.length).toBeGreaterThan(0)
			}
		}
	})

	test("every row's teardown behaviors are subset of the locked vocabulary", () => {
		for (const row of FIRST_PARTY_MIGRATION_MATRIX) {
			for (const behavior of row.teardown) {
				expect(TEARDOWN_BEHAVIORS).toContain(behavior)
			}
		}
	})

	test("every row's rollout phase is from the locked phase vocabulary", () => {
		for (const row of FIRST_PARTY_MIGRATION_MATRIX) {
			expect(ROLLOUT_PHASES).toContain(row.rolloutPhase)
		}
	})

	test("every row references a non-empty current file", () => {
		for (const row of FIRST_PARTY_MIGRATION_MATRIX) {
			expect(row.currentFile.length).toBeGreaterThan(0)
		}
	})

	test("(currentId, currentFamily) pairs are unique — no doubled rows", () => {
		const seen = new Set<string>()
		for (const row of FIRST_PARTY_MIGRATION_MATRIX) {
			const key = `${row.currentFamily}::${row.currentId}`
			expect(seen.has(key)).toBe(false)
			seen.add(key)
		}
	})

	test("covers the four main-pane surfaces", () => {
		const ids = FIRST_PARTY_MIGRATION_MATRIX.map((r) => r.currentId)
		expect(ids).toContain("chat")
		expect(ids).toContain("project-manager")
		expect(ids).toContain("automations")
		expect(ids).toContain("settings")
	})

	test("chat (core loop) migrates last — phase 4", () => {
		const row = findFirstPartyMigrationRow("chat")
		expect(row?.rolloutPhase).toBe("phase-4")
	})

	test("migrated notes row points at the plugin directory, not the deleted registry row", () => {
		const row = findFirstPartyMigrationRow("notes")
		expect(row?.currentFile).toBe("apps/desktop/plugins/notes/manifest.ts")
	})
})

describe("groupFirstPartyMigrationByPhase", () => {
	test("every row lands in exactly one bucket", () => {
		const grouped = groupFirstPartyMigrationByPhase()
		let total = 0
		for (const phase of ROLLOUT_PHASES) {
			total += grouped[phase].length
		}
		expect(total).toBe(FIRST_PARTY_MIGRATION_MATRIX.length)
	})

	test("phase-1 includes the foundational panels", () => {
		const grouped = groupFirstPartyMigrationByPhase()
		const phase1Ids = grouped["phase-1"].map((r) => r.currentId)
		expect(phase1Ids).toContain("review")
		expect(phase1Ids).toContain("browser")
		expect(phase1Ids).toContain("notes")
		expect(phase1Ids).toContain("artifacts")
		expect(phase1Ids).toContain("files")
		expect(phase1Ids).toContain("terminal")
	})
})

describe("findFirstPartyMigrationRow", () => {
	test("returns the row for a known id", () => {
		const row = findFirstPartyMigrationRow("review")
		expect(row?.currentId).toBe("review")
	})

	test("returns null for an unknown id", () => {
		expect(findFirstPartyMigrationRow("ghost-surface")).toBeNull()
	})

	test("family filter narrows the lookup", () => {
		const row = findFirstPartyMigrationRow("default", "theme")
		expect(row?.currentFamily).toBe("theme")
		expect(findFirstPartyMigrationRow("default", "panel")).toBeNull()
	})

	test("exports the ambiguity error type for cross-family collisions", () => {
		// No cross-family collision exists in the locked matrix today; the
		// error class is the contract for when one appears.
		expect(new AmbiguousMigrationRowError("x", ["panel", "theme"]).name).toBe(
			"AmbiguousMigrationRowError",
		)
	})
})

describe("builtInPluginIdsInMatrix", () => {
	test("returns a non-empty list of plugin ids that own first-party rows", () => {
		const ids = builtInPluginIdsInMatrix()
		expect(ids.length).toBeGreaterThan(0)
	})

	test("returns a sorted list", () => {
		const ids = builtInPluginIdsInMatrix()
		const sorted = [...ids].sort()
		expect(ids).toEqual(sorted)
	})

	test("includes the foundational surface plugin ids", () => {
		const ids = builtInPluginIdsInMatrix()
		expect(ids).toContain("firefly.built-in.surface.review")
		expect(ids).toContain("firefly.built-in.surface.browser")
		expect(ids).toContain("firefly.built-in.surface.notes")
	})
})

describe("hostOnlyExceptions", () => {
	test("the plugins panel is host-only (cannot be a plugin without a self-reference)", () => {
		const row = findFirstPartyMigrationRow("plugins")
		expect(row?.owner.kind).toBe("host-only")
	})

	test("the bundled default theme is host-only", () => {
		const row = findFirstPartyMigrationRow("default")
		expect(row?.owner.kind).toBe("host-only")
	})

	test("hostOnlyExceptions returns at least the plugins and default rows with rationales", () => {
		const exceptions = hostOnlyExceptions()
		const exceptionsById = new Map(exceptions.map((e) => [e.currentId, e.rationale]))
		expect(exceptionsById.get("plugins")?.length ?? 0).toBeGreaterThan(0)
		expect(exceptionsById.get("default")?.length ?? 0).toBeGreaterThan(0)
	})
})
