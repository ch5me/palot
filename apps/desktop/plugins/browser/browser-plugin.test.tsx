/**
 * Slice-proof tests for the Browser V2 migration (plan §6 criteria):
 *  1. registry row deleted — grep-proof on the registry source;
 *  2. the Browser tab derives solely from the catalog projection;
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
	registerBrowserHostHandlers,
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
	BROWSER_PANEL_PROJECTED_ID,
	BROWSER_PLUGIN_ID,
	BROWSER_TOOL_OPEN_ID,
	BROWSER_TOOL_STATE_ID,
	browserPluginManifest,
} from "./manifest"

const REGISTRY_SOURCE = path.join(
	import.meta.dir,
	"../../src/renderer/firefly-surface-registry.tsx",
)

const FEATURE_FLAGS_SOURCE = path.join(
	import.meta.dir,
	"../../src/renderer/atoms/feature-flags.ts",
)

function fakeBrowserDeps() {
	const opened: string[] = []
	let enabled = true
	return {
		opened,
		deps: {
			openSidePanel: async (tab: "browser") => {
				opened.push(tab)
			},
			getSidePanelState: () => ({
				open: true,
				activeTab: "browser",
				availableTabs: ["review", "browser", "notes", "files"],
			}),
			setPluginEnabled: (_pluginId: string, next: boolean) => {
				enabled = next
				return { enabled }
			},
		},
	}
}

describe("criterion 1 — registry row deleted (grep-proof)", () => {
	test("firefly-surface-registry.tsx has no browser surface row", () => {
		const source = fs.readFileSync(REGISTRY_SOURCE, "utf8")
		expect(source).not.toContain('id: "browser"')
		expect(source).not.toContain("BrowserPanel")
		expect(source).not.toContain("browserPanelEnabledAtom")
	})

	test("the legacy panel file is gone from components/side-panel", () => {
		const legacyPath = path.join(
			import.meta.dir,
			"../../src/renderer/components/side-panel/browser-panel.tsx",
		)
		expect(fs.existsSync(legacyPath)).toBe(false)
	})

	test("feature-flags.ts has no browserPanelEnabledAtom export", () => {
		const source = fs.readFileSync(FEATURE_FLAGS_SOURCE, "utf8")
		expect(source).not.toContain("export const browserPanelEnabledAtom")
		expect(source).not.toContain("export const toggleBrowserPanelAtom")
	})
})

describe("criterion 2 — Browser serves from the catalog projection", () => {
	test("manifest parses and derives a descriptor on the canonical path", () => {
		const manifest = parsePluginManifest(browserPluginManifest)
		const descriptor = derivePluginDescriptor(manifest, { appVersion: "0.11.0" })
		expect(descriptor.normalizedId).toBe(BROWSER_PLUGIN_ID)
		expect(descriptor.panels).toHaveLength(1)
		expect(descriptor.tools.map((t) => t.id)).toEqual([BROWSER_TOOL_OPEN_ID, BROWSER_TOOL_STATE_ID])
	})

	test("catalog projects the browser side-panel tab with stable identity", () => {
		_resetPluginAuthorityForTests()
		const catalog = getPluginCatalog()
		const panel = catalog.projections.panels.find((p) => p.pluginId === BROWSER_PLUGIN_ID)
		expect(panel).toBeDefined()
		expect(panel?.projectedId).toBe(BROWSER_PANEL_PROJECTED_ID)
		expect(panel?.availability.available).toBe(true)

		const descriptor = catalogPanelToTabDescriptor(panel!)
		expect(descriptor).not.toBeNull()
		expect(descriptor?.id).toBe("browser")
		// criterion 6: persistence + telemetry identity survive the cutover.
		expect(descriptor?.persistenceKey).toBe("side-panel.browser")
		expect(descriptor?.telemetryNamespace).toBe("firefly.surface.browser")
		expect(descriptor?.renderMode).toBe("host-reconciler")
	})

	test("browser tools project into the bridge tool surface (OpenCode visibility)", () => {
		_resetPluginAuthorityForTests()
		const catalog = getPluginCatalog()
		const descriptor = catalog.descriptors.find((d) => d.normalizedId === BROWSER_PLUGIN_ID)
		const projected = projectBridgeToolDefinitions(descriptor!)
		expect(projected.map((t) => t.id)).toContain(BROWSER_TOOL_OPEN_ID)
		expect(projected.map((t) => t.id)).toContain(BROWSER_TOOL_STATE_ID)
	})
})

describe("criterion 3 — paired tools dispatch with typed envelopes", () => {
	test("browser.open opens the side panel", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		_resetHostCommandsForTests()
		const { deps, opened } = fakeBrowserDeps()
		registerBrowserHostHandlers(deps)
		const result = await invokePluginTool({
			pluginId: BROWSER_PLUGIN_ID,
			toolId: BROWSER_TOOL_OPEN_ID,
			args: {},
		})
		expect(result.status).toBe("completed")
		expect(opened).toEqual(["browser"])
		expect((result.data as { tab: string }).tab).toBe("browser")
	})

	test("browser.state returns typed surface state", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerBrowserHostHandlers(fakeBrowserDeps().deps)
		const result = await invokePluginTool({
			pluginId: BROWSER_PLUGIN_ID,
			toolId: BROWSER_TOOL_STATE_ID,
			args: {},
		})
		expect(result.status).toBe("completed")
		expect(result.data).toEqual({
			tab: "browser",
			available: true,
			open: true,
			active: true,
		})
	})

	test("unknown tool and invalid args produce typed failures, not throws", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerBrowserHostHandlers(fakeBrowserDeps().deps)
		const unknown = await invokePluginTool({
			pluginId: BROWSER_PLUGIN_ID,
			toolId: "plugin.firefly.built-in.surface.browser.ghost",
			args: {},
		})
		expect(unknown.status).toBe("unavailable")
		const badArgs = await invokePluginTool({
			pluginId: BROWSER_PLUGIN_ID,
			toolId: BROWSER_TOOL_STATE_ID,
			args: { sessionId: 42 },
		})
		expect(badArgs.status).toBe("failed")
		expect(badArgs.errorCode).toBe("validation_error")
	})

	test("open-browser / toggle-browser commands dispatch through the V2 command path", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		_resetHostCommandsForTests()
		const { deps, opened } = fakeBrowserDeps()
		registerBrowserHostHandlers(deps)
		const open = await invokePluginCommand({
			pluginId: BROWSER_PLUGIN_ID,
			commandId: "open-browser",
			args: {},
		})
		expect(open.status).toBe("completed")
		expect(opened).toEqual(["browser"])
		const toggle = await invokePluginCommand({
			pluginId: BROWSER_PLUGIN_ID,
			commandId: "toggle-browser",
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
		registerBrowserHostHandlers(fakeBrowserDeps().deps)

		setPluginEnabled(BROWSER_PLUGIN_ID, false)
		const disabledCatalog = getPluginCatalog()
		const entry = disabledCatalog.entries.find((e) => e.pluginId === BROWSER_PLUGIN_ID)
		expect(entry?.status).toBe("disabled")
		const panel = disabledCatalog.projections.panels.find((p) => p.pluginId === BROWSER_PLUGIN_ID)
		expect(panel?.availability.available).toBe(false)
		expect(panel?.availability.state).toBe("disabled")
		// Tool dispatch refuses while disabled.
		const refused = await invokePluginTool({
			pluginId: BROWSER_PLUGIN_ID,
			toolId: BROWSER_TOOL_OPEN_ID,
			args: {},
		})
		expect(refused.status).toBe("unavailable")
		expect(refused.errorCode).toBe("plugin_disabled")

		setPluginEnabled(BROWSER_PLUGIN_ID, true)
		const restored = getPluginCatalog()
		expect(
			restored.projections.panels.find((p) => p.pluginId === BROWSER_PLUGIN_ID)?.availability
				.available,
		).toBe(true)
	})
})

describe("criterion 5 — UI-crash quarantine drill", () => {
	test("3 panel crashes quarantine the plugin; release restores it", async () => {
		_resetPluginAuthorityForTests()
		_resetHostToolsForTests()
		registerBrowserHostHandlers(fakeBrowserDeps().deps)

		reportPluginPanelCrash(BROWSER_PLUGIN_ID, "drill crash 1")
		reportPluginPanelCrash(BROWSER_PLUGIN_ID, "drill crash 2")
		const third = reportPluginPanelCrash(BROWSER_PLUGIN_ID, "drill crash 3")
		expect(third.quarantined).toBe(true)

		const catalog = getPluginCatalog()
		const entry = catalog.entries.find((e) => e.pluginId === BROWSER_PLUGIN_ID)
		expect(entry?.status).toBe("quarantined")
		expect(entry?.statusDetail).toContain("renderer panel crashes")
		// The rest of the catalog is untouched.
		const sibling = catalog.entries.find((e) => e.pluginId === "firefly.built-in.palot-bridge")
		expect(sibling?.status).toBe("validated")
		// Quarantined plugin refuses tool calls.
		const refused = await invokePluginTool({
			pluginId: BROWSER_PLUGIN_ID,
			toolId: BROWSER_TOOL_OPEN_ID,
			args: {},
		})
		expect(refused.status).toBe("unavailable")
		expect(refused.errorCode).toBe("plugin_quarantined")

		releasePluginQuarantine(BROWSER_PLUGIN_ID, "drill release")
		const restored = getPluginCatalog()
		expect(restored.entries.find((e) => e.pluginId === BROWSER_PLUGIN_ID)?.status).toBe("validated")
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
		pluginId: BROWSER_PLUGIN_ID,
		legacyStorageKey: "elf:browserPanelEnabled",
	}

	test("flag=false migrates to a host-side disable, once", async () => {
		const { io, enabledCalls, store } = migrationIo({ "elf:browserPanelEnabled": "false" })
		const first = await migrateSurfaceFlag(migration, io)
		expect(first.action).toBe("migrated-disabled")
		expect(enabledCalls).toEqual([{ pluginId: BROWSER_PLUGIN_ID, enabled: false }])
		expect(store.has("elf:browserPanelEnabled")).toBe(false)
		const second = await migrateSurfaceFlag(migration, io)
		expect(second.action).toBe("skipped-already-migrated")
		expect(enabledCalls).toHaveLength(1)
	})

	test("flag=true needs no host write (enabled is the default)", async () => {
		const { io, enabledCalls } = migrationIo({ "elf:browserPanelEnabled": "true" })
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

	test("flag migration row is present in SURFACE_FLAG_MIGRATIONS with exact key", async () => {
		const { SURFACE_FLAG_MIGRATIONS } = await import("../../src/renderer/firefly-plugin-flag-migration")
		const row = SURFACE_FLAG_MIGRATIONS.find((m) => m.pluginId === BROWSER_PLUGIN_ID)
		expect(row).toBeDefined()
		expect(row?.legacyStorageKey).toBe("elf:browserPanelEnabled")
	})
})
