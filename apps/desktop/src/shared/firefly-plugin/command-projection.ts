/**
 * Firefly Plugin System V2 — Command/menu/keybinding projection
 *
 * Pure projection helpers that turn a `PluginDescriptor` into the
 * command palette entries, menu items, and keybinding registrations
 * the renderer needs. The helpers are deterministic; the renderer
 * feeds them the active descriptor set and consumes the result.
 *
 * Reserved host command prefixes (from the V2 plan): `firefly.`,
 * `surface.`, `plugins.`, `plugin.<pluginId>.*`. Plugins must not
 * shadow them. The `commandIds` schema in `manifest.ts` enforces this
 * at parse time; the projection layer is responsible for surfacing
 * collision reports when two plugins publish the same id.
 *
 * Dynamic visibility/enablement: each command may declare a `when`
 * expression. The renderer evaluates it against the current session
 * + flags + scope state. The helpers here do not evaluate `when`
 * expressions; they only shape the projection so the renderer can.
 */

import { z } from "zod"

import type { CommandContribution, PluginDescriptor, PluginId } from "./manifest"

/**
 * The four host-owned command placement surfaces. The host owns the
 * vocabulary; plugins may contribute to each but cannot mint new
 * surfaces.
 */
export const COMMAND_PLACEMENT_SURFACES = [
	"command-palette",
	"menu",
	"keybinding",
	"contextual-action",
] as const
export type CommandPlacementSurface = (typeof COMMAND_PLACEMENT_SURFACES)[number]

export const commandPlacementSurfaceSchema = z.enum(COMMAND_PLACEMENT_SURFACES)

/**
 * Reserved host command-id prefixes. Plugins may not contribute
 * commands whose id starts with any of these. Mirrors the
 * `reservedCommandPrefixes` constant in `manifest.ts`; duplicated
 * here so the projection layer can surface collision reports
 * without re-parsing the manifest.
 */
export const RESERVED_COMMAND_PREFIXES = ["firefly.", "surface.", "plugins.", "plugin."] as const

/**
 * Context shape the renderer evaluates `when` expressions against.
 * Plugins may consult any of these fields when deciding whether a
 * command is currently visible. The shape is host-owned; plugins do
 * not extend it.
 */
export const commandWhenContextSchema = z
	.object({
		activeSessionId: z.string().min(1).nullable(),
		flags: z.record(z.string(), z.boolean()).readonly(),
		scope: z.enum(["session", "project", "app"]),
		pluginEnabled: z.boolean(),
		pluginQuarantined: z.boolean(),
	})
	.strict()
export type CommandWhenContext = z.infer<typeof commandWhenContextSchema>

/**
 * A projected command entry. The renderer consumes one of these per
 * contributed command. The `shadowedBy` field is set when another
 * plugin has the same id; the renderer uses it to surface a
 * "shadowed by X" badge in the operator UI.
 */
export interface ProjectedCommand {
	readonly id: string
	readonly pluginId: PluginId
	readonly title: string
	readonly description: string | null
	readonly category: string | null
	readonly icon: string | null
	readonly keybinding: string | null
	readonly menuPath: readonly string[] | null
	readonly placements: readonly CommandPlacementSurface[]
	readonly requires: readonly string[]
	readonly when: string | null
	readonly available: boolean
	readonly shadowedBy: PluginId | null
}

function resolveCommandPlacements(command: CommandContribution): readonly CommandPlacementSurface[] {
	const placements = new Set<CommandPlacementSurface>(["command-palette"])
	if (command.menuPath && command.menuPath.length > 0) placements.add("menu")
	if (command.keybinding) placements.add("keybinding")
	return [...placements]
}

export function projectCommand(input: {
	command: CommandContribution
	pluginId: PluginId
	shadowedBy?: PluginId | null
	available?: boolean
}): ProjectedCommand {
	return {
		id: input.command.id,
		pluginId: input.pluginId,
		title: input.command.title,
		description: input.command.description ?? null,
		category: input.command.category ?? null,
		icon: input.command.icon ?? null,
		keybinding: input.command.keybinding ?? null,
		menuPath: input.command.menuPath ? [...input.command.menuPath] : null,
		placements: resolveCommandPlacements(input.command),
		requires: [...input.command.requires],
		when: input.command.when ?? null,
		available: input.available ?? true,
		shadowedBy: input.shadowedBy ?? null,
	}
}

export interface CommandCollision {
	readonly commandId: string
	readonly owners: readonly PluginId[]
	readonly winner: PluginId
}

function detectCollisions(commands: readonly ProjectedCommand[]): readonly CommandCollision[] {
	const byId = new Map<string, ProjectedCommand[]>()
	for (const command of commands) {
		const bucket = byId.get(command.id) ?? []
		bucket.push(command)
		byId.set(command.id, bucket)
	}
	const collisions: CommandCollision[] = []
	for (const [commandId, bucket] of byId) {
		if (bucket.length <= 1) continue
		const sorted = [...bucket].sort((a, b) => a.pluginId.localeCompare(b.pluginId))
		const winner = sorted[0]
		if (!winner) continue
		collisions.push({
			commandId,
			owners: sorted.map((c) => c.pluginId),
			winner: winner.pluginId,
		})
	}
	return collisions
}

export function projectAllCommands(descriptors: readonly PluginDescriptor[]): {
	commands: readonly ProjectedCommand[]
	collisions: readonly CommandCollision[]
} {
	const projected: ProjectedCommand[] = []
	for (const descriptor of descriptors) {
		for (const command of descriptor.commands) {
			projected.push(projectCommand({ command, pluginId: descriptor.normalizedId }))
		}
	}
	const collisions = detectCollisions(projected)
	const withShadows = projected.map((entry) => {
		const collision = collisions.find((c) => c.commandId === entry.id)
		const winner = collision?.winner
		if (!winner) return entry
		if (winner === entry.pluginId) return { ...entry, shadowedBy: null }
		return { ...entry, available: false, shadowedBy: winner }
	})
	return { commands: withShadows, collisions }
}

export function projectCommandsBySurface(
	descriptors: readonly PluginDescriptor[],
): Readonly<Record<CommandPlacementSurface, readonly ProjectedCommand[]>> {
	const { commands } = projectAllCommands(descriptors)
	const grouped: Record<CommandPlacementSurface, ProjectedCommand[]> = {
		"command-palette": [],
		menu: [],
		keybinding: [],
		"contextual-action": [],
	}
	for (const command of commands) {
		for (const surface of command.placements) {
			grouped[surface].push(command)
		}
	}
	return {
		"command-palette": grouped["command-palette"],
		menu: grouped.menu,
		keybinding: grouped.keybinding,
		"contextual-action": grouped["contextual-action"],
	}
}

export function projectCommandsByCategory(
	descriptors: readonly PluginDescriptor[],
): Readonly<Record<string, readonly ProjectedCommand[]>> {
	const { commands } = projectAllCommands(descriptors)
	const grouped = new Map<string, ProjectedCommand[]>()
	for (const command of commands) {
		const category = command.category ?? ""
		const bucket = grouped.get(category) ?? []
		bucket.push(command)
		grouped.set(category, bucket)
	}
	return Object.fromEntries([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

export function evaluateCommandWhen(
	expression: string | null,
	context: CommandWhenContext,
): boolean {
	if (!expression || expression.trim().length === 0) return true
	return evaluateWhenAtom(expression.trim(), context)
}

function evaluateWhenAtom(input: string, context: CommandWhenContext): boolean {
	const orParts = splitTopLevel(input, "|")
	if (orParts.length > 1) {
		return orParts.some((part) => evaluateWhenAtom(part.trim(), context))
	}
	const andParts = splitTopLevel(input, "&")
	if (andParts.length > 1) {
		return andParts.every((part) => evaluateWhenAtom(part.trim(), context))
	}
	return evaluateWhenLeaf(input.trim(), context)
}

function splitTopLevel(input: string, separator: "&" | "|"): string[] {
	const result: string[] = []
	let depth = 0
	let current = ""
	for (const char of input) {
		if (char === "(") {
			depth += 1
			current += char
			continue
		}
		if (char === ")") {
			depth -= 1
			current += char
			continue
		}
		if (char === separator && depth === 0) {
			result.push(current)
			current = ""
			continue
		}
		current += char
	}
	if (current.length > 0) result.push(current)
	return result
}

function evaluateWhenLeaf(input: string, context: CommandWhenContext): boolean {
	if (input.startsWith("(") && input.endsWith(")")) {
		return evaluateWhenAtom(input.slice(1, -1), context)
	}
	if (input === "pluginEnabled") return context.pluginEnabled
	if (input === "pluginQuarantined") return context.pluginQuarantined
	if (input === "inSession") return context.activeSessionId !== null
	if (input.startsWith("!")) {
		const body = input.slice(1)
		if (body.startsWith("flag:")) {
			return context.flags[body.slice("flag:".length)] !== true
		}
		if (body.startsWith("scope:")) {
			return context.scope !== body.slice("scope:".length)
		}
		return false
	}
	if (input.startsWith("flag:")) {
		return context.flags[input.slice("flag:".length)] === true
	}
	if (input.startsWith("scope:")) {
		return context.scope === input.slice("scope:".length)
	}
	return false
}
