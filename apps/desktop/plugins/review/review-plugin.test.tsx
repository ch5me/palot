/**
 * Slice-proof tests for the Review (Changes) migration (§6.12 criteria):
 *  1. registry row deleted — grep-proof on the registry source;
 *  2. the Review tab derives solely from the catalog projection;
 *  3. paired tools dispatch through the V2 tool path with typed envelopes;
 *  4. disable/enable round-trip flows through the host lifecycle;
 *  5. UI-crash quarantine drill (boundary report → quarantined catalog state);
 *  6. persistence key + telemetry namespace stable across the cutover;
 *  7. legacy feature-flag migration is one-time and value-preserving.
 */

import { describe, expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"

import {
	_resetPluginAuthorityForTests,
	getPluginCatalog,
	releasePluginQuarantine,
	reportPluginPanelCrash,
	setPluginEnabled,
} from "../../src/main/firefly-plugin/authority"
import {
	_resetHostCommandsForTests,
	_resetHostToolsForTests,
	invokePluginCommand,
	invokePluginTool,
	registerReviewHostHandlers,
} from "../../src/main/firefly-plugin/dispatch"
import { derivePluginDescriptor } from "../../src/shared/firefly-plugin/descriptor"
import { parsePluginManifest } from "../../src/shared/firefly-plugin/manifest"
import { projectBridgeToolDefinitions } from "../../src/shared/firefly-plugin/bridge-projection"
import {
	migrateSurfaceFlag,
	type FlagMigrationIo,
} from "../../src/renderer/firefly-plugin-flag-migration"
import { catalogPanelToTabDescriptor } from "../../src/renderer/firefly-plugin-surface-merge"
import {
	REVIEW_PANEL_PROJECTED_ID,
	REVIEW_PLUGIN_ID,
	REVIEW_TOOL_OPEN_ID,
	REVIEW_TOOL_STATE_ID,
	reviewPluginManifest,
} from "./manifest"

const REGISTRY_SOURCE = path.join(
	import.meta.dir,
	"../../src/renderer/firefly-surface-registry.tsx",
)

function fakeReviewDeps() {
	const opened: string[] = []
	let enabled = true
	return {
		opened,
		deps: {
			openSidePanel: async (tab: "review") => {
				opened.push(tab)
			},
			getSidePanelState: () => ({
				open: true,
				activeTab: "review",
				availableTabs: ["review", "notes", "files"],
			}),
			setPluginEnabled: (_pluginId: string, next: boolean) => {
				enabled = next
				return { enabled }
			},
		},
	}
}

describe("criterion 1 — registry row deleted (grep-proof)", () => {
	test("firefly-surface-registry.tsx has no review surface row", () => {
		const source = fs.readFileSync(REGISTRY_SOURCE, "utf8")
		expect(source).not.toContain('id: "review"')
		// Check for the direct (non-Pdf) ReviewPanel import that belonged to the V1 row.
		expect(source).not.toContain('import { ReviewPanel }')
		expect(source).not.toContain("reviewSurfaceEnabledAtom")
	})

	test("the review row is in CATALOG_SERVED_SURFACE_IDS", () => {
		const source = fs.readFileSync(REGISTRY_SOURCE, "utf8")
		expect(source).toContain('"review"')
		expect(source).toContain("CATALOG_SERVED_SURFACE_IDS")
	})
})

describe("criterion 2 — Review serves from the catalog projection", () => {
	test("manifest parses and derives a descriptor on the canonical path", () => {
		const manifest = parsePluginManifest(reviewPluginManifest)
		const descriptor = derivePluginDescriptor(manifest, { appVersion: "0.11.0" })
		expect(descriptor.normalizedId).toBe(REVIEW_PLUGIN_ID)
		expect(descriptor.panels).toHaveLength(1)
		expect(descriptor.tools.map((t) => t.id)).toEqual([REVIEW_TOOL_OPEN_ID, REVIEW_TOOL_STATE_ID])
	})

	test("catalog projects the review side-panel tab with stable identity", () => {
		_resetPluginAuthorityForTests()
		const catalog = getPluginCatalog()
		const panel = catalog.projections.panels.find((p) => p.pluginId === REVIEW_PLUGIN_ID)
		expect(panel).toBeDefined()
		expect(panel?.projectedId).toBe(REVIEW_PANEL_PROJECTED_ID)
		expect(panel?.availability.available).toBe(true)

		const descriptor = catalogPanelToTabDescriptor(panel!)
		expect(descriptor).not.toBeNull()
		expect(descriptor?.id).toBe("review")
		// criterion 6: persistence + telemetry identity survive the cutover.
		expect(descriptor?.persistenceKey).toBe("side-panel.review")
		expect(descriptor?.telemetryNamespace).toBe("firefly.surface.review")
		expect(descriptor?.renderMode).toBe("host-reconciler")
	})

	test("review tools project into the bridge tool surface (OpenCode visibility)", () => {
		_resetPluginAuthorityForTests()
		const catalog = getPluginCatalog()
		const descriptor = catalog.descriptors.find((d) => d.normalizedId === REVIEW_PLUGIN_ID)
		const projected = projectBridgeToolDefinitions(descriptor!)
		expect(projected.map((t) => t.id)).toContain(REVIEW_TOOL_OPEN_ID)
		expect(projected.map((t) => t.id)).toContain(REVIEW_TOOL_STATE_ID)
	})
})

describe("criterion 3 — paired tools dispatch with typed envelopes", () => {
	test("review.open opens the side panel", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		_resetHostCommandsForTests()
		const { deps, opened } = fakeReviewDeps()
		registerReviewHostHandlers(deps)
		const result = await invokePluginTool({
			pluginId: REVIEW_PLUGIN_ID,
			toolId: REVIEW_TOOL_OPEN_ID,
			args: {},
		})
		expect(result.status).toBe("completed")
		expect(opened).toEqual(["review"])
		expect((result.data as { tab: string }).tab).toBe("review")
	})

	test("review.state returns typed surface state", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerReviewHostHandlers(fakeReviewDeps().deps)
		const result = await invokePluginTool({
			pluginId: REVIEW_PLUGIN_ID,
			toolId: REVIEW_TOOL_STATE_ID,
			args: {},
		})
		expect(result.status).toBe("completed")
		expect(result.data).toEqual({
			tab: "review",
			available: true,
			open: true,
			active: true,
		})
	})

	test("unknown tool and invalid args produce typed failures, not throws", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerReviewHostHandlers(fakeReviewDeps().deps)
		const unknown = await invokePluginTool({
			pluginId: REVIEW_PLUGIN_ID,
			toolId: "plugin.firefly.built-in.surface.review.ghost",
			args: {},
		})
		expect(unknown.status).toBe("unavailable")
		const badArgs = await invokePluginTool({
			pluginId: REVIEW_PLUGIN_ID,
			toolId: REVIEW_TOOL_STATE_ID,
			args: { sessionId: 42 },
		})
		expect(badArgs.status).toBe("failed")
		expect(badArgs.errorCode).toBe("validation_error")
	})

	test("open-review / toggle-review commands dispatch through the V2 command path", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		_resetHostCommandsForTests()
		const { deps, opened } = fakeReviewDeps()
		registerReviewHostHandlers(deps)
		const open = await invokePluginCommand({
			pluginId: REVIEW_PLUGIN_ID,
			commandId: "open-review",
			args: {},
		})
		expect(open.status).toBe("completed")
		expect(opened).toEqual(["review"])
		const toggle = await invokePluginCommand({
			pluginId: REVIEW_PLUGIN_ID,
			commandId: "toggle-review",
			args: {},
		})
		expect(toggle.status).toBe("completed")
		expect((toggle.data as { enabled: boolean }).enabled).toBe(false)
	})
})

describe("criterion 4 — disable/enable round-trip via host lifecycle", () => {
	test("disable flips catalog status + projection availability; tools refuse; enable restores", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerReviewHostHandlers(fakeReviewDeps().deps)

		setPluginEnabled(REVIEW_PLUGIN_ID, false)
		const disabledCatalog = getPluginCatalog()
		const entry = disabledCatalog.entries.find((e) => e.pluginId === REVIEW_PLUGIN_ID)
		expect(entry?.status).toBe("disabled")
		const panel = disabledCatalog.projections.panels.find((p) => p.pluginId === REVIEW_PLUGIN_ID)
		expect(panel?.availability.available).toBe(false)
		expect(panel?.availability.state).toBe("disabled")
		// Commands vanish from the available set.
		const commands = disabledCatalog.projections.commands.filter(
			(c) => c.pluginId === REVIEW_PLUGIN_ID,
		)
		for (const command of commands) {
			expect(command.availability.available).toBe(false)
		}
		// Tool dispatch refuses while disabled.
		const refused = await invokePluginTool({
			pluginId: REVIEW_PLUGIN_ID,
			toolId: REVIEW_TOOL_OPEN_ID,
			args: {},
		})
		expect(refused.status).toBe("unavailable")
		expect(refused.errorCode).toBe("plugin_disabled")

		setPluginEnabled(REVIEW_PLUGIN_ID, true)
		const restored = getPluginCatalog()
		expect(
			restored.projections.panels.find((p) => p.pluginId === REVIEW_PLUGIN_ID)?.availability
				.available,
		).toBe(true)
	})
})

describe("criterion 5 — UI-crash quarantine drill", () => {
	test("3 panel crashes quarantine the plugin; release restores it", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerReviewHostHandlers(fakeReviewDeps().deps)

		reportPluginPanelCrash(REVIEW_PLUGIN_ID, "drill crash 1")
		reportPluginPanelCrash(REVIEW_PLUGIN_ID, "drill crash 2")
		const third = reportPluginPanelCrash(REVIEW_PLUGIN_ID, "drill crash 3")
		expect(third.quarantined).toBe(true)

		const catalog = getPluginCatalog()
		const entry = catalog.entries.find((e) => e.pluginId === REVIEW_PLUGIN_ID)
		expect(entry?.status).toBe("quarantined")
		expect(entry?.statusDetail).toContain("renderer panel crashes")
		// The rest of the catalog is untouched.
		const sibling = catalog.entries.find((e) => e.pluginId === "firefly.built-in.palot-bridge")
		expect(sibling?.status).toBe("validated")
		// Quarantined plugin refuses tool calls.
		const refused = await invokePluginTool({
			pluginId: REVIEW_PLUGIN_ID,
			toolId: REVIEW_TOOL_OPEN_ID,
			args: {},
		})
		expect(refused.status).toBe("unavailable")
		expect(refused.errorCode).toBe("plugin_quarantined")

		releasePluginQuarantine(REVIEW_PLUGIN_ID, "drill release")
		const restored = getPluginCatalog()
		expect(restored.entries.find((e) => e.pluginId === REVIEW_PLUGIN_ID)?.status).toBe("validated")
	})
})

describe("criterion 7 — legacy flag migration", () => {
	function migrationIo(initial: Record<string, string>) {
		const store = new Map(Object.entries(initial))
		const enabledCalls: { pluginId: string; enabled: boolean }[] = []
		const io: FlagMigrationIo = {
			getItem: (key) => store.get(key) ?? null,
			setItem: (key, value) => void store.set(key, value),
			removeItem: (key) => void store.delete(key),
			setPluginEnabled: async (pluginId, enabled) => {
				enabledCalls.push({ pluginId, enabled })
				return {}
			},
		}
		return { io, store, enabledCalls }
	}

	const migration = {
		pluginId: REVIEW_PLUGIN_ID,
		legacyStorageKey: "elf:reviewSurfaceEnabled",
	}

	test("flag=false migrates to a host-side disable, once", async () => {
		const { io, enabledCalls, store } = migrationIo({ "elf:reviewSurfaceEnabled": "false" })
		const first = await migrateSurfaceFlag(migration, io)
		expect(first.action).toBe("migrated-disabled")
		expect(enabledCalls).toEqual([{ pluginId: REVIEW_PLUGIN_ID, enabled: false }])
		expect(store.has("elf:reviewSurfaceEnabled")).toBe(false)
		const second = await migrateSurfaceFlag(migration, io)
		expect(second.action).toBe("skipped-already-migrated")
		expect(enabledCalls).toHaveLength(1)
	})

	test("flag=true needs no host write (enabled is the default)", async () => {
		const { io, enabledCalls } = migrationIo({ "elf:reviewSurfaceEnabled": "true" })
		const result = await migrateSurfaceFlag(migration, io)
		expect(result.action).toBe("migrated-enabled-default")
		expect(enabledCalls).toHaveLength(0)
	})

	test("no flag marks migrated without touching the host", async () => {
		const { io, enabledCalls } = migrationIo({})
		const result = await migrateSurfaceFlag(migration, io)
		expect(result.action).toBe("skipped-no-flag")
		expect(enabledCalls).toHaveLength(0)
	})

	test("flag migration row is in SURFACE_FLAG_MIGRATIONS and is idempotent", async () => {
		const { SURFACE_FLAG_MIGRATIONS } = await import(
			"../../src/renderer/firefly-plugin-flag-migration"
		)
		const row = SURFACE_FLAG_MIGRATIONS.find((m) => m.pluginId === REVIEW_PLUGIN_ID)
		expect(row).toBeDefined()
		expect(row?.legacyStorageKey).toBe("elf:reviewSurfaceEnabled")

		// idempotency: running twice with a migrated marker skips
		const { io, enabledCalls } = migrationIo({ "elf:reviewSurfaceEnabled": "false" })
		await migrateSurfaceFlag(row!, io)
		await migrateSurfaceFlag(row!, io)
		expect(enabledCalls).toHaveLength(1) // second run skipped
	})
})
