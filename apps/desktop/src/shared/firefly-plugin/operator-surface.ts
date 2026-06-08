/**
 * Firefly Plugin System V2 — Operator surface plan (lifecycle UI)
 *
 * The current Plugins panel is inventory-only. V2 replaces it with a
 * real lifecycle operator surface. This file encodes the operator
 * view-model as a source contract: the fields the operator UI must
 * render per plugin, the lifecycle actions it must offer, and the
 * scope boundary (lifecycle + inventory only — no marketplace
 * browse/discover product).
 */

import { z } from "zod"

/**
 * The locked set of operator actions. The UI renders one button per
 * action; the host gates each one by the plugin's current state.
 */
export const OPERATOR_ACTIONS = [
	"enable",
	"disable",
	"reload",
	"quarantine",
	"release-quarantine",
	"review-permissions",
	"view-logs",
	"uninstall",
] as const
export type OperatorAction = (typeof OPERATOR_ACTIONS)[number]

export const operatorActionSchema = z.enum(OPERATOR_ACTIONS)

/**
 * The locked set of operator-visible fields per plugin. The UI must
 * render every one of these; the V2 plan calls them out explicitly.
 */
export const operatorPluginRowSchema = z
	.object({
		pluginId: z.string().min(1).max(160),
		displayName: z.string().min(1).max(160),
		version: z.string().min(1).max(80),
		trustTier: z.enum(["built-in", "local-dev", "signed-third-party", "unsigned-third-party"]),
		enabled: z.boolean(),
		quarantined: z.boolean(),
		grantedCapabilities: z.array(z.string()).readonly(),
		activeSessionBindings: z.number().int().nonnegative(),
		exposedTools: z.array(z.string()).readonly(),
		lastCrash: z
			.object({
				reason: z.string().min(1).max(400),
				timestamp: z.number().int().nonnegative(),
			})
			.nullable(),
		quarantineStatus: z.enum(["none", "auto", "operator", "security"]),
		appliedThemeOwnership: z.string().nullable(),
	})
	.strict()
export type OperatorPluginRow = z.infer<typeof operatorPluginRowSchema>

/**
 * The locked action-availability matrix: which operator actions are
 * allowed in which plugin state. The UI consults this to enable /
 * disable each button.
 */
export interface OperatorActionAvailability {
	readonly action: OperatorAction
	readonly availableWhen: string
}

export const OPERATOR_ACTION_AVAILABILITY: readonly OperatorActionAvailability[] = [
	{ action: "enable", availableWhen: "plugin is disabled AND not quarantined" },
	{ action: "disable", availableWhen: "plugin is enabled" },
	{ action: "reload", availableWhen: "plugin is enabled (dev mode or hot-reload supported)" },
	{ action: "quarantine", availableWhen: "plugin is enabled (operator-initiated)" },
	{ action: "release-quarantine", availableWhen: "plugin is quarantined" },
	{ action: "review-permissions", availableWhen: "always (read-only)" },
	{ action: "view-logs", availableWhen: "always (read-only)" },
	{ action: "uninstall", availableWhen: "plugin is not built-in" },
]

/**
 * The scope boundary. The operator surface is lifecycle + inventory
 * ONLY. The V2 plan explicitly forbids marketplace browse/discover
 * product scope; these flags lock that boundary in source so a
 * future contributor cannot silently add a marketplace tab.
 */
export const OPERATOR_SCOPE = {
	includesLifecycle: true,
	includesInventory: true,
	includesPermissionReview: true,
	includesLogs: true,
	includesDevReload: true,
	includesMarketplaceBrowse: false,
	includesMarketplaceDiscover: false,
	includesMarketplaceRanking: false,
	includesMarketplacePurchase: false,
} as const

/**
 * Compute which operator actions are currently available for a
 * plugin row. Pure; the UI renders the returned set as enabled
 * buttons and the rest as disabled.
 */
export function availableOperatorActions(row: OperatorPluginRow): readonly OperatorAction[] {
	const actions: OperatorAction[] = ["review-permissions", "view-logs"]
	if (!row.enabled && !row.quarantined) actions.push("enable")
	if (row.enabled) {
		actions.push("disable")
		actions.push("reload")
		actions.push("quarantine")
	}
	if (row.quarantined) actions.push("release-quarantine")
	if (row.trustTier !== "built-in") actions.push("uninstall")
	return actions
}

/**
 * Build the operator row from the four canonical runtime objects.
 * Pure; the runtime calls this when it refreshes the operator UI.
 */
export function buildOperatorPluginRow(input: {
	pluginId: string
	displayName: string
	version: string
	trustTier: OperatorPluginRow["trustTier"]
	enabled: boolean
	quarantined: boolean
	grantedCapabilities: readonly string[]
	activeSessionBindings: number
	exposedTools: readonly string[]
	lastCrash: OperatorPluginRow["lastCrash"]
	quarantineStatus: OperatorPluginRow["quarantineStatus"]
	appliedThemeOwnership: string | null
}): OperatorPluginRow {
	return operatorPluginRowSchema.parse({
		pluginId: input.pluginId,
		displayName: input.displayName,
		version: input.version,
		trustTier: input.trustTier,
		enabled: input.enabled,
		quarantined: input.quarantined,
		grantedCapabilities: input.grantedCapabilities,
		activeSessionBindings: input.activeSessionBindings,
		exposedTools: input.exposedTools,
		lastCrash: input.lastCrash,
		quarantineStatus: input.quarantineStatus,
		appliedThemeOwnership: input.appliedThemeOwnership,
	})
}

/**
 * The required operator fields, as a flat list. Tests lock this so
 * the V2 plan's "required operator fields" must-have cannot regress.
 */
export const REQUIRED_OPERATOR_FIELDS = [
	"trustTier",
	"grantedCapabilities",
	"activeSessionBindings",
	"exposedTools",
	"lastCrash",
	"quarantineStatus",
	"appliedThemeOwnership",
] as const
