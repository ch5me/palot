import { describe, expect, test } from "bun:test"

import { derivePluginDescriptor, parsePluginManifest } from "./index"
import {
	COMMAND_PLACEMENT_SURFACES,
	commandWhenContextSchema,
	evaluateCommandWhen,
	projectAllCommands,
	projectCommand,
	projectCommandsByCategory,
	projectCommandsBySurface,
	RESERVED_COMMAND_PREFIXES,
} from "./command-projection"

function makeDescriptor(
	commandIds: {
		id: string
		title?: string
		category?: string
		keybinding?: string
		menuPath?: string[]
		requires?: string[]
		when?: string
	}[],
) {
	const manifest = parsePluginManifest({
		apiVersion: "firefly.plugin/v2",
		kind: "PluginManifest",
		id: "firefly.built-in.example",
		displayName: "Example",
		version: "1.0.0",
		trust: "built-in",
		lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
		activationEvents: [{ kind: "onStartup" }],
		contributes: {
			commands: commandIds.map((c) => ({
				id: c.id,
				title: c.title ?? c.id,
				category: c.category,
				keybinding: c.keybinding,
				menuPath: c.menuPath,
				requires: c.requires ?? ["host:command.register"],
				when: c.when,
			})),
		},
		capabilities: [],
	})
	return derivePluginDescriptor(manifest, { appVersion: "0.11.0" })
}

function ctx(
	overrides: Partial<Parameters<typeof commandWhenContextSchema.parse>[0]> = {},
) {
	return commandWhenContextSchema.parse({
		activeSessionId: "sess-1",
		flags: { filesEnabled: true },
		scope: "session",
		pluginEnabled: true,
		pluginQuarantined: false,
		...overrides,
	})
}

describe("command-placement surface vocabulary", () => {
	test("exposes the four host-owned placement surfaces", () => {
		expect(COMMAND_PLACEMENT_SURFACES).toEqual([
			"command-palette",
			"menu",
			"keybinding",
			"contextual-action",
		])
	})

	test("exposes the reserved host command-id prefixes", () => {
		expect(RESERVED_COMMAND_PREFIXES).toContain("firefly.")
		expect(RESERVED_COMMAND_PREFIXES).toContain("surface.")
		expect(RESERVED_COMMAND_PREFIXES).toContain("plugins.")
		expect(RESERVED_COMMAND_PREFIXES).toContain("plugin.")
	})
})

describe("projectCommand", () => {
	test("preserves id, title, keybinding, menuPath, category", () => {
		const descriptor = makeDescriptor([
			{
				id: "open-review",
				title: "Open review",
				category: "Surface",
				keybinding: "Cmd+Shift+R",
				menuPath: ["Surface", "Review"],
			},
		])
		const cmd = descriptor.commands[0]
		if (!cmd) throw new Error("missing")
		const projected = projectCommand({ command: cmd, pluginId: descriptor.normalizedId })
		expect(projected.id).toBe("open-review")
		expect(projected.title).toBe("Open review")
		expect(projected.keybinding).toBe("Cmd+Shift+R")
		expect(projected.menuPath).toEqual(["Surface", "Review"])
		expect(projected.category).toBe("Surface")
	})

	test("every command lands in command-palette placement", () => {
		const descriptor = makeDescriptor([{ id: "a" }, { id: "b" }])
		for (const command of descriptor.commands) {
			const projected = projectCommand({ command, pluginId: descriptor.normalizedId })
			expect(projected.placements).toContain("command-palette")
		}
	})

	test("commands with keybinding are also in keybinding placement", () => {
		const descriptor = makeDescriptor([{ id: "open-review", keybinding: "Cmd+R" }])
		const cmd = descriptor.commands[0]
		if (!cmd) throw new Error("missing")
		const projected = projectCommand({ command: cmd, pluginId: descriptor.normalizedId })
		expect(projected.placements).toContain("keybinding")
	})

	test("commands with menuPath are also in menu placement", () => {
		const descriptor = makeDescriptor([{ id: "open-files", menuPath: ["File", "Open"] }])
		const cmd = descriptor.commands[0]
		if (!cmd) throw new Error("missing")
		const projected = projectCommand({ command: cmd, pluginId: descriptor.normalizedId })
		expect(projected.placements).toContain("menu")
	})

	test("commands without keybinding/menuPath land only in command-palette", () => {
		const descriptor = makeDescriptor([{ id: "open-notes" }])
		const cmd = descriptor.commands[0]
		if (!cmd) throw new Error("missing")
		const projected = projectCommand({ command: cmd, pluginId: descriptor.normalizedId })
		expect(projected.placements).toEqual(["command-palette"])
	})

	test("preserves the requires capability list", () => {
		const descriptor = makeDescriptor([{ id: "open" }])
		const cmd = descriptor.commands[0]
		if (!cmd) throw new Error("missing")
		const projected = projectCommand({ command: cmd, pluginId: descriptor.normalizedId })
		expect(projected.requires).toContain("host:command.register")
	})

	test("shadowedBy defaults to null", () => {
		const descriptor = makeDescriptor([{ id: "open" }])
		const cmd = descriptor.commands[0]
		if (!cmd) throw new Error("missing")
		const projected = projectCommand({ command: cmd, pluginId: descriptor.normalizedId })
		expect(projected.shadowedBy).toBeNull()
		expect(projected.available).toBe(true)
	})
})

describe("projectAllCommands", () => {
	test("returns all commands from the catalog", () => {
		const descriptor = makeDescriptor([{ id: "a" }, { id: "b" }, { id: "c" }])
		const { commands } = projectAllCommands([descriptor])
		expect(commands).toHaveLength(3)
	})

	test("empty catalog returns empty projection", () => {
		const { commands, collisions } = projectAllCommands([])
		expect(commands).toEqual([])
		expect(collisions).toEqual([])
	})

	test("detects collisions when two plugins claim the same command id", () => {
		const aManifest = parsePluginManifest({
			apiVersion: "firefly.plugin/v2",
			kind: "PluginManifest",
			id: "firefly.built-in.a",
			displayName: "A",
			version: "1.0.0",
			trust: "built-in",
			lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
			activationEvents: [{ kind: "onStartup" }],
			contributes: { commands: [{ id: "open-shared", title: "Open shared", requires: [] }] },
			capabilities: [],
		})
		const bManifest = parsePluginManifest({
			apiVersion: "firefly.plugin/v2",
			kind: "PluginManifest",
			id: "firefly.built-in.b",
			displayName: "B",
			version: "1.0.0",
			trust: "built-in",
			lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
			activationEvents: [{ kind: "onStartup" }],
			contributes: { commands: [{ id: "open-shared", title: "Open shared", requires: [] }] },
			capabilities: [],
		})
		const a = derivePluginDescriptor(aManifest, { appVersion: "0.11.0" })
		const b = derivePluginDescriptor(bManifest, { appVersion: "0.11.0" })
		const { commands, collisions } = projectAllCommands([a, b])
		const shared = commands.filter((c) => c.id === "open-shared")
		expect(shared).toHaveLength(2)
		const collision = collisions.find((c) => c.commandId === "open-shared")
		expect(collision).toBeDefined()
		expect(collision?.owners).toEqual(["firefly.built-in.a", "firefly.built-in.b"])
		expect(collision?.winner).toBe("firefly.built-in.a")
		const winner = shared.find((c) => c.pluginId === collision?.winner)
		const loser = shared.find((c) => c.pluginId !== collision?.winner)
		expect(winner?.available).toBe(true)
		expect(winner?.shadowedBy).toBeNull()
		expect(loser?.available).toBe(false)
		expect(loser?.shadowedBy).toBe(collision?.winner)
	})
})

describe("projectCommandsBySurface", () => {
	test("splits commands across the four placement surfaces", () => {
		const descriptor = makeDescriptor([
			{ id: "a", keybinding: "Cmd+K", menuPath: ["File", "A"] },
			{ id: "b", keybinding: "Cmd+L" },
			{ id: "c" },
		])
		const grouped = projectCommandsBySurface([descriptor])
		expect(grouped["command-palette"].length).toBe(3)
		expect(grouped.keybinding.length).toBe(2)
		expect(grouped.menu.length).toBe(1)
		expect(grouped["contextual-action"].length).toBe(0)
	})
})

describe("projectCommandsByCategory", () => {
	test("groups commands by their declared category", () => {
		const descriptor = makeDescriptor([
			{ id: "a", category: "Surface" },
			{ id: "b", category: "Surface" },
			{ id: "c", category: "Files" },
		])
		const grouped = projectCommandsByCategory([descriptor])
		expect(grouped["Surface"]?.length).toBe(2)
		expect(grouped["Files"]?.length).toBe(1)
	})

	test("uncategorized commands land in the empty-string bucket", () => {
		const descriptor = makeDescriptor([{ id: "a" }])
		const grouped = projectCommandsByCategory([descriptor])
		expect(grouped[""]).toHaveLength(1)
	})
})

describe("evaluateCommandWhen", () => {
	test("empty expression is always true", () => {
		expect(evaluateCommandWhen(null, ctx())).toBe(true)
		expect(evaluateCommandWhen("", ctx())).toBe(true)
		expect(evaluateCommandWhen("   ", ctx())).toBe(true)
	})

	test("flag:foo reads from context.flags", () => {
		expect(evaluateCommandWhen("flag:filesEnabled", ctx())).toBe(true)
		expect(evaluateCommandWhen("flag:filesEnabled", ctx({ flags: { filesEnabled: false } }))).toBe(
			false,
		)
	})

	test("!flag:foo inverts", () => {
		expect(evaluateCommandWhen("!flag:filesEnabled", ctx({ flags: { filesEnabled: false } }))).toBe(
			true,
		)
		expect(evaluateCommandWhen("!flag:filesEnabled", ctx())).toBe(false)
	})

	test("scope:session matches context.scope", () => {
		expect(evaluateCommandWhen("scope:session", ctx())).toBe(true)
		expect(evaluateCommandWhen("scope:app", ctx())).toBe(false)
	})

	test("pluginEnabled and pluginQuarantined", () => {
		expect(evaluateCommandWhen("pluginEnabled", ctx({ pluginEnabled: true }))).toBe(true)
		expect(evaluateCommandWhen("pluginEnabled", ctx({ pluginEnabled: false }))).toBe(false)
		expect(evaluateCommandWhen("pluginQuarantined", ctx({ pluginQuarantined: true }))).toBe(true)
	})

	test("inSession", () => {
		expect(evaluateCommandWhen("inSession", ctx({ activeSessionId: "sess-1" }))).toBe(true)
		expect(evaluateCommandWhen("inSession", ctx({ activeSessionId: null }))).toBe(false)
	})

	test("& combines atoms with AND", () => {
		expect(evaluateCommandWhen("flag:filesEnabled & scope:session", ctx())).toBe(true)
		expect(evaluateCommandWhen("flag:filesEnabled & scope:session", ctx({ scope: "app" }))).toBe(
			false,
		)
	})

	test("| combines atoms with OR", () => {
		expect(evaluateCommandWhen("scope:session | scope:app", ctx())).toBe(true)
	})

	test("parentheses group", () => {
		expect(
			evaluateCommandWhen("(flag:filesEnabled & scope:session) | pluginQuarantined", ctx()),
		).toBe(true)
		expect(
			evaluateCommandWhen(
				"(flag:filesEnabled & scope:app) | pluginQuarantined",
				ctx({ pluginQuarantined: true }),
			),
		).toBe(true)
	})

	test("invalid expression is treated as false", () => {
		expect(evaluateCommandWhen("unknown:predicate", ctx())).toBe(false)
	})
})
