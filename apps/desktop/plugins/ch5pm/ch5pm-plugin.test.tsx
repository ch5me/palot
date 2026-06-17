/**
 * Slice-proof tests for the CH5PM Dashboard migration (plan §6 criteria):
 *  1. registry row deleted — grep-proof on the registry source;
 *  2. the ch5pm tab derives solely from the catalog projection;
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
	registerCh5pmHostHandlers,
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
	CH5PM_PANEL_PROJECTED_ID,
	CH5PM_PLUGIN_ID,
	CH5PM_TOOL_OPEN_ID,
	CH5PM_TOOL_STATE_ID,
	ch5pmPluginManifest,
} from "./manifest"

const REGISTRY_SOURCE = path.join(
	import.meta.dir,
	"../../src/renderer/firefly-surface-registry.tsx",
)

const FEATURE_FLAGS_SOURCE = path.join(
	import.meta.dir,
	"../../src/renderer/atoms/feature-flags.ts",
)

function fakeCh5pmDeps() {
	const opened: string[] = []
	let enabled = false
	return {
		opened,
		deps: {
			openSidePanel: async (tab: "ch5pm") => {
				opened.push(tab)
			},
			getSidePanelState: () => ({
				open: true,
				activeTab: "ch5pm",
				availableTabs: ["review", "notes", "ch5pm"],
			}),
			setPluginEnabled: (_pluginId: string, next: boolean) => {
				enabled = next
				return { enabled }
			},
		},
	}
}

describe("criterion 1 — registry row deleted (grep-proof)", () => {
	test("firefly-surface-registry.tsx has no ch5pm surface row", () => {
		const source = fs.readFileSync(REGISTRY_SOURCE, "utf8")
		expect(source).not.toContain('id: "ch5pm"')
		expect(source).not.toContain("Ch5PmDashboardPanel")
		expect(source).not.toContain("ch5pmSurfaceEnabledAtom")
	})

	test("feature-flags.ts has no ch5pmSurfaceEnabledAtom or toggleCh5PmSurfaceAtom", () => {
		const source = fs.readFileSync(FEATURE_FLAGS_SOURCE, "utf8")
		expect(source).not.toContain("ch5pmSurfaceEnabledAtom = atomWithStorage")
		expect(source).not.toContain("toggleCh5PmSurfaceAtom = atom")
	})
})

describe("criterion 2 — ch5pm serves from the catalog projection", () => {
	test("manifest parses and derives a descriptor on the canonical path", () => {
		const manifest = parsePluginManifest(ch5pmPluginManifest)
		const descriptor = derivePluginDescriptor(manifest, { appVersion: "0.11.0" })
		expect(descriptor.normalizedId).toBe(CH5PM_PLUGIN_ID)
		expect(descriptor.panels).toHaveLength(1)
		expect(descriptor.tools.map((t) => t.id)).toEqual([CH5PM_TOOL_OPEN_ID, CH5PM_TOOL_STATE_ID])
	})

	test("catalog projects the ch5pm side-panel tab with stable identity", () => {
		_resetPluginAuthorityForTests()
		const catalog = getPluginCatalog()
		const panel = catalog.projections.panels.find((p) => p.pluginId === CH5PM_PLUGIN_ID)
		expect(panel).toBeDefined()
		expect(panel?.projectedId).toBe(CH5PM_PANEL_PROJECTED_ID)

		const descriptor = catalogPanelToTabDescriptor(panel!)
		expect(descriptor).not.toBeNull()
		expect(descriptor?.id).toBe("ch5pm")
		// criterion 6: persistence + telemetry identity survive the cutover (byte-match old row).
		expect(descriptor?.persistenceKey).toBe("side-panel.ch5pm")
		expect(descriptor?.telemetryNamespace).toBe("firefly.surface.ch5pm")
		expect(descriptor?.renderMode).toBe("host-reconciler")
	})

	test("ch5pm tools project into the bridge tool surface (OpenCode visibility)", () => {
		_resetPluginAuthorityForTests()
		const catalog = getPluginCatalog()
		const descriptor = catalog.descriptors.find((d) => d.normalizedId === CH5PM_PLUGIN_ID)
		const projected = projectBridgeToolDefinitions(descriptor!)
		expect(projected.map((t) => t.id)).toContain(CH5PM_TOOL_OPEN_ID)
		expect(projected.map((t) => t.id)).toContain(CH5PM_TOOL_STATE_ID)
	})

	test("ch5pm manifest declares autoEnable=false (default-off)", () => {
		// ch5pm is default-off: autoEnable:false in the manifest lifecycle.
		// The catalog availability starts true (valid plugin, no lifecycle override);
		// the actual initial disabled state is set from the migration of the legacy
		// elf:ch5pmSurfaceEnabled flag (default false) during app boot.
		expect(ch5pmPluginManifest.lifecycle?.autoEnable).toBe(false)
		expect(ch5pmPluginManifest.contributes?.panels?.[0]?.defaultOn).toBe(false)
	})
})

describe("criterion 3 — paired tools dispatch with typed envelopes", () => {
	test("ch5pm.open opens the side panel", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		_resetHostCommandsForTests()
		const { deps, opened } = fakeCh5pmDeps()
		registerCh5pmHostHandlers(deps)
		const result = await invokePluginTool({
			pluginId: CH5PM_PLUGIN_ID,
			toolId: CH5PM_TOOL_OPEN_ID,
			args: {},
		})
		expect(result.status).toBe("completed")
		expect(opened).toEqual(["ch5pm"])
		expect((result.data as { tab: string }).tab).toBe("ch5pm")
	})

	test("ch5pm.state returns typed surface state", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerCh5pmHostHandlers(fakeCh5pmDeps().deps)
		const result = await invokePluginTool({
			pluginId: CH5PM_PLUGIN_ID,
			toolId: CH5PM_TOOL_STATE_ID,
			args: {},
		})
		expect(result.status).toBe("completed")
		expect(result.data).toEqual({
			tab: "ch5pm",
			available: true,
			open: true,
			active: true,
		})
	})

	test("unknown tool and invalid args produce typed failures, not throws", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerCh5pmHostHandlers(fakeCh5pmDeps().deps)
		const unknown = await invokePluginTool({
			pluginId: CH5PM_PLUGIN_ID,
			toolId: "plugin.firefly.built-in.surface.ch5pm.ghost",
			args: {},
		})
		expect(unknown.status).toBe("unavailable")
		const badArgs = await invokePluginTool({
			pluginId: CH5PM_PLUGIN_ID,
			toolId: CH5PM_TOOL_STATE_ID,
			args: { sessionId: 42 },
		})
		expect(badArgs.status).toBe("failed")
		expect(badArgs.errorCode).toBe("validation_error")
	})

	test("open-ch5pm / toggle-ch5pm commands dispatch through the V2 command path", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		_resetHostCommandsForTests()
		const { deps, opened } = fakeCh5pmDeps()
		registerCh5pmHostHandlers(deps)
		const open = await invokePluginCommand({
			pluginId: CH5PM_PLUGIN_ID,
			commandId: "open-ch5pm",
			args: {},
		})
		expect(open.status).toBe("completed")
		expect(opened).toEqual(["ch5pm"])
		const toggle = await invokePluginCommand({
			pluginId: CH5PM_PLUGIN_ID,
			commandId: "toggle-ch5pm",
			args: {},
		})
		expect(toggle.status).toBe("completed")
		// Plugin starts enabled (no lifecycle override after reset); toggle flips to disabled.
		expect((toggle.data as { enabled: boolean }).enabled).toBe(false)
	})
})

describe("criterion 4 — disable/enable round-trip via host lifecycle", () => {
	test("disable flips catalog status + projection availability; tools refuse; enable restores", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerCh5pmHostHandlers(fakeCh5pmDeps().deps)

		setPluginEnabled(CH5PM_PLUGIN_ID, false)
		const disabledCatalog = getPluginCatalog()
		const entry = disabledCatalog.entries.find((e) => e.pluginId === CH5PM_PLUGIN_ID)
		expect(entry?.status).toBe("disabled")
		const panel = disabledCatalog.projections.panels.find((p) => p.pluginId === CH5PM_PLUGIN_ID)
		expect(panel?.availability.available).toBe(false)
		expect(panel?.availability.state).toBe("disabled")
		// Commands vanish from the available set the same way.
		const commands = disabledCatalog.projections.commands.filter(
			(c) => c.pluginId === CH5PM_PLUGIN_ID,
		)
		for (const command of commands) {
			expect(command.availability.available).toBe(false)
		}
		// Tool dispatch refuses while disabled.
		const refused = await invokePluginTool({
			pluginId: CH5PM_PLUGIN_ID,
			toolId: CH5PM_TOOL_OPEN_ID,
			args: {},
		})
		expect(refused.status).toBe("unavailable")
		expect(refused.errorCode).toBe("plugin_disabled")

		setPluginEnabled(CH5PM_PLUGIN_ID, true)
		const restored = getPluginCatalog()
		expect(
			restored.projections.panels.find((p) => p.pluginId === CH5PM_PLUGIN_ID)?.availability
				.available,
		).toBe(true)
	})
})

describe("criterion 5 — UI-crash quarantine drill", () => {
	test("3 panel crashes quarantine the plugin; release restores it", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerCh5pmHostHandlers(fakeCh5pmDeps().deps)

		reportPluginPanelCrash(CH5PM_PLUGIN_ID, "drill crash 1")
		reportPluginPanelCrash(CH5PM_PLUGIN_ID, "drill crash 2")
		const third = reportPluginPanelCrash(CH5PM_PLUGIN_ID, "drill crash 3")
		expect(third.quarantined).toBe(true)

		const catalog = getPluginCatalog()
		const entry = catalog.entries.find((e) => e.pluginId === CH5PM_PLUGIN_ID)
		expect(entry?.status).toBe("quarantined")
		expect(entry?.statusDetail).toContain("renderer panel crashes")
		// The rest of the catalog is untouched — sibling plugins stay validated.
		const sibling = catalog.entries.find((e) => e.pluginId === "firefly.built-in.palot-bridge")
		expect(sibling?.status).toBe("validated")
		// Quarantined plugin refuses tool calls.
		const refused = await invokePluginTool({
			pluginId: CH5PM_PLUGIN_ID,
			toolId: CH5PM_TOOL_OPEN_ID,
			args: {},
		})
		expect(refused.status).toBe("unavailable")
		expect(refused.errorCode).toBe("plugin_quarantined")

		releasePluginQuarantine(CH5PM_PLUGIN_ID, "drill release")
		const restored = getPluginCatalog()
		expect(restored.entries.find((e) => e.pluginId === CH5PM_PLUGIN_ID)?.status).toBe("validated")
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
		pluginId: CH5PM_PLUGIN_ID,
		legacyStorageKey: "elf:ch5pmSurfaceEnabled",
	}

	test("flag=false migrates to a host-side disable, once", async () => {
		const { io, enabledCalls, store } = migrationIo({ "elf:ch5pmSurfaceEnabled": "false" })
		const first = await migrateSurfaceFlag(migration, io)
		expect(first.action).toBe("migrated-disabled")
		expect(enabledCalls).toEqual([{ pluginId: CH5PM_PLUGIN_ID, enabled: false }])
		expect(store.has("elf:ch5pmSurfaceEnabled")).toBe(false)
		const second = await migrateSurfaceFlag(migration, io)
		expect(second.action).toBe("skipped-already-migrated")
		expect(enabledCalls).toHaveLength(1)
	})

	test("flag=true needs no host write (enabled is the default)", async () => {
		const { io, enabledCalls } = migrationIo({ "elf:ch5pmSurfaceEnabled": "true" })
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

	test("SURFACE_FLAG_MIGRATIONS contains the ch5pm row", () => {
		const { SURFACE_FLAG_MIGRATIONS } = require("../../src/renderer/firefly-plugin-flag-migration")
		const row = (SURFACE_FLAG_MIGRATIONS as Array<{ pluginId: string; legacyStorageKey: string }>).find(
			(m) => m.pluginId === CH5PM_PLUGIN_ID,
		)
		expect(row).toBeDefined()
		expect(row?.legacyStorageKey).toBe("elf:ch5pmSurfaceEnabled")
	})
})
