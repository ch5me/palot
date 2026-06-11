import { z } from "zod"

export const CONTRIBUTION_FAMILIES = ["panels", "widgets", "commands", "themes", "components"] as const
export type ContributionFamily = (typeof CONTRIBUTION_FAMILIES)[number]

export const escapeHatchTransportSchema = z.enum(["iframe", "webview"])
export type EscapeHatchTransport = z.infer<typeof escapeHatchTransportSchema>

export const familyEscapeHatchPolicySchema = z.enum(["forbidden", "opt-in-explicit"])
export type FamilyEscapeHatchPolicy = z.infer<typeof familyEscapeHatchPolicySchema>

export const panelPlacementSlotSchema = z.enum(["side-panel", "main-pane"])
export type PanelPlacementSlot = z.infer<typeof panelPlacementSlotSchema>

export const panelActivationTriggerSchema = z.enum(["command", "panel-open", "tool-ui-hint", "host-restore"])
export type PanelActivationTrigger = z.infer<typeof panelActivationTriggerSchema>

export const panelPersistenceStrategySchema = z.enum([
	"none",
	"panel-instance-state",
	"panel-layout-preference",
])
export type PanelPersistenceStrategy = z.infer<typeof panelPersistenceStrategySchema>

export const widgetPlacementZoneSchema = z.enum(["above-chat", "chat-inline-right"])
export type WidgetPlacementZone = z.infer<typeof widgetPlacementZoneSchema>

export const widgetActivationTriggerSchema = z.enum([
	"session-attach",
	"widget-place",
	"tool-ui-hint",
	"host-restore",
])
export type WidgetActivationTrigger = z.infer<typeof widgetActivationTriggerSchema>

export const widgetPersistenceStrategySchema = z.enum([
	"none",
	"session-layout",
	"session-widget-state",
])
export type WidgetPersistenceStrategy = z.infer<typeof widgetPersistenceStrategySchema>

export const commandPlacementSurfaceSchema = z.enum([
	"command-palette",
	"menu",
	"keybinding",
	"contextual-action",
])
export type CommandPlacementSurface = z.infer<typeof commandPlacementSurfaceSchema>

export const commandActivationTriggerSchema = z.enum([
	"palette-invoke",
	"menu-select",
	"keybinding",
	"context-match",
])
export type CommandActivationTrigger = z.infer<typeof commandActivationTriggerSchema>

export const commandPersistenceStrategySchema = z.enum(["none", "host-managed-recents"])
export type CommandPersistenceStrategy = z.infer<typeof commandPersistenceStrategySchema>

export const themeActivationTriggerSchema = z.enum([
	"preview-request",
	"apply-request",
	"host-startup-restore",
])
export type ThemeActivationTrigger = z.infer<typeof themeActivationTriggerSchema>

export const themePersistenceStrategySchema = z.enum(["none", "host-theme-selection"])
export type ThemePersistenceStrategy = z.infer<typeof themePersistenceStrategySchema>

export const componentCategorySchema = z.enum(["diagram", "decision", "form", "viewer", "layout", "custom"])
export type ComponentCategory = z.infer<typeof componentCategorySchema>

export const componentActivationTriggerSchema = z.enum([
	"loom-tree-reference",
	"chat-fence",
	"host-preview",
	"host-restore",
])
export type ComponentActivationTrigger = z.infer<typeof componentActivationTriggerSchema>

export const componentPersistenceStrategySchema = z.enum([
	"none",
	"loom-node-state",
	"loom-artifact-state",
])
export type ComponentPersistenceStrategy = z.infer<typeof componentPersistenceStrategySchema>

export const contributionDefaultStateSchema = z.discriminatedUnion("mode", [
	z.object({ mode: z.literal("default-on") }).strict(),
	z.object({ mode: z.literal("default-off") }).strict(),
	z.object({ mode: z.literal("default-enabled") }).strict(),
	z.object({ mode: z.literal("default-disabled") }).strict(),
	z.object({ mode: z.literal("host-selects") }).strict(),
])
export type ContributionDefaultState = z.infer<typeof contributionDefaultStateSchema>

export const contributionAvailabilityContractSchema = z
	.object({
		staticRequiresCapabilities: z.boolean(),
		hostEvaluatesLiveAvailability: z.boolean(),
		hostOwnsReasonStrings: z.boolean(),
	})
	.strict()
export type ContributionAvailabilityContract = z.infer<typeof contributionAvailabilityContractSchema>

export const contributionPersistenceContractSchema = z
	.object({
		strategy: z.string(),
		hostOwnsStorage: z.boolean(),
		pluginMayProvidePersistenceKey: z.boolean(),
		scope: z.enum(["none", "session", "project", "app"]),
	})
	.strict()
export type ContributionPersistenceContract = z.infer<typeof contributionPersistenceContractSchema>

export const contributionHostRenderingExpectationSchema = z
	.object({
		hostOwnsContainer: z.boolean(),
		hostOwnsPlacementVocabulary: z.boolean(),
		hostOwnsActivationLifecycle: z.boolean(),
		allowedModes: z.array(z.string()).readonly(),
		dataOnly: z.boolean(),
		hostMayPreviewWithoutApply: z.boolean(),
		hostMayApplyWithoutPluginRuntime: z.boolean(),
	})
	.strict()
export type ContributionHostRenderingExpectation = z.infer<
	typeof contributionHostRenderingExpectationSchema
>

export const contributionEscapeHatchContractSchema = z
	.object({
		policy: familyEscapeHatchPolicySchema,
		allowedTransports: z.array(escapeHatchTransportSchema).readonly(),
		requiresExplicitPolicyField: z.boolean(),
		hostOwnedSandbox: z.boolean(),
	})
	.strict()
export type ContributionEscapeHatchContract = z.infer<typeof contributionEscapeHatchContractSchema>

export const contributionMutationGuardSchema = z
	.object({
		mayDirectlyMutateHostChrome: z.boolean(),
		requiresWrapperToolsOrCapabilities: z.boolean(),
		notes: z.array(z.string()).readonly(),
	})
	.strict()
export type ContributionMutationGuard = z.infer<typeof contributionMutationGuardSchema>

export const contributionFamilyContractSchema = z
	.object({
		family: z.enum(CONTRIBUTION_FAMILIES),
		hostVocabulary: z.array(z.string()).readonly(),
		placementSurfaces: z.array(z.string()).readonly(),
		activationTriggers: z.array(z.string()).readonly(),
		defaultState: contributionDefaultStateSchema,
		availability: contributionAvailabilityContractSchema,
		persistence: contributionPersistenceContractSchema,
		hostRendering: contributionHostRenderingExpectationSchema,
		escapeHatch: contributionEscapeHatchContractSchema,
		mutationGuard: contributionMutationGuardSchema,
	})
	.strict()
export type ContributionFamilyContract = z.infer<typeof contributionFamilyContractSchema>

export const ESCAPE_HATCH_ELIGIBLE_FAMILIES: ReadonlySet<ContributionFamily> = new Set([
	"panels",
	"widgets",
])

export const HOST_CHROME_MUTATION_FORBIDDEN_FAMILIES: ReadonlySet<ContributionFamily> = new Set([
	"commands",
	"themes",
	"components",
])

export const PANEL_CONTRACT = contributionFamilyContractSchema.parse({
	family: "panels",
	hostVocabulary: panelPlacementSlotSchema.options,
	placementSurfaces: panelPlacementSlotSchema.options,
	activationTriggers: panelActivationTriggerSchema.options,
	defaultState: { mode: "default-off" },
	availability: {
		staticRequiresCapabilities: true,
		hostEvaluatesLiveAvailability: true,
		hostOwnsReasonStrings: true,
	},
	persistence: {
		strategy: panelPersistenceStrategySchema.enum["panel-instance-state"],
		hostOwnsStorage: true,
		pluginMayProvidePersistenceKey: true,
		scope: "app",
	},
	hostRendering: {
		hostOwnsContainer: true,
		hostOwnsPlacementVocabulary: true,
		hostOwnsActivationLifecycle: true,
		allowedModes: ["host-reconciler", "declarative-props", "iframe"],
		dataOnly: false,
		hostMayPreviewWithoutApply: false,
		hostMayApplyWithoutPluginRuntime: false,
	},
	escapeHatch: {
		policy: "opt-in-explicit",
		allowedTransports: ["iframe", "webview"],
		requiresExplicitPolicyField: true,
		hostOwnedSandbox: true,
	},
	mutationGuard: {
		mayDirectlyMutateHostChrome: false,
		requiresWrapperToolsOrCapabilities: true,
		notes: [
			"Panels occupy host slots only.",
			"Panel-triggered chrome changes must go through host commands, tools, or capabilities.",
		],
	},
})

export const WIDGET_CONTRACT = contributionFamilyContractSchema.parse({
	family: "widgets",
	hostVocabulary: widgetPlacementZoneSchema.options,
	placementSurfaces: widgetPlacementZoneSchema.options,
	activationTriggers: widgetActivationTriggerSchema.options,
	defaultState: { mode: "default-enabled" },
	availability: {
		staticRequiresCapabilities: true,
		hostEvaluatesLiveAvailability: true,
		hostOwnsReasonStrings: true,
	},
	persistence: {
		strategy: widgetPersistenceStrategySchema.enum["session-layout"],
		hostOwnsStorage: true,
		pluginMayProvidePersistenceKey: false,
		scope: "session",
	},
	hostRendering: {
		hostOwnsContainer: true,
		hostOwnsPlacementVocabulary: true,
		hostOwnsActivationLifecycle: true,
		allowedModes: ["host-reconciler", "declarative-props", "iframe"],
		dataOnly: false,
		hostMayPreviewWithoutApply: false,
		hostMayApplyWithoutPluginRuntime: false,
	},
	escapeHatch: {
		policy: "opt-in-explicit",
		allowedTransports: ["iframe", "webview"],
		requiresExplicitPolicyField: true,
		hostOwnedSandbox: true,
	},
	mutationGuard: {
		mayDirectlyMutateHostChrome: false,
		requiresWrapperToolsOrCapabilities: true,
		notes: [
			"Widgets occupy host zones only.",
			"Widget movement and visibility stay host-owned.",
		],
	},
})

export const COMMAND_CONTRACT = contributionFamilyContractSchema.parse({
	family: "commands",
	hostVocabulary: commandPlacementSurfaceSchema.options,
	placementSurfaces: commandPlacementSurfaceSchema.options,
	activationTriggers: commandActivationTriggerSchema.options,
	defaultState: { mode: "host-selects" },
	availability: {
		staticRequiresCapabilities: true,
		hostEvaluatesLiveAvailability: true,
		hostOwnsReasonStrings: true,
	},
	persistence: {
		strategy: commandPersistenceStrategySchema.enum["host-managed-recents"],
		hostOwnsStorage: true,
		pluginMayProvidePersistenceKey: false,
		scope: "app",
	},
	hostRendering: {
		hostOwnsContainer: true,
		hostOwnsPlacementVocabulary: true,
		hostOwnsActivationLifecycle: true,
		allowedModes: [],
		dataOnly: false,
		hostMayPreviewWithoutApply: false,
		hostMayApplyWithoutPluginRuntime: true,
	},
	escapeHatch: {
		policy: "forbidden",
		allowedTransports: [],
		requiresExplicitPolicyField: false,
		hostOwnedSandbox: true,
	},
	mutationGuard: {
		mayDirectlyMutateHostChrome: false,
		requiresWrapperToolsOrCapabilities: true,
		notes: [
			"Commands project into palette, menu, keybinding, and context predicates only.",
			"Commands cannot mutate host chrome directly; they must invoke wrapper tools or granted host capabilities.",
		],
	},
})

export const THEME_CONTRACT = contributionFamilyContractSchema.parse({
	family: "themes",
	hostVocabulary: ["theme-catalog", "theme-preview", "theme-apply"],
	placementSurfaces: ["theme-catalog"],
	activationTriggers: themeActivationTriggerSchema.options,
	defaultState: { mode: "host-selects" },
	availability: {
		staticRequiresCapabilities: false,
		hostEvaluatesLiveAvailability: true,
		hostOwnsReasonStrings: true,
	},
	persistence: {
		strategy: themePersistenceStrategySchema.enum["host-theme-selection"],
		hostOwnsStorage: true,
		pluginMayProvidePersistenceKey: false,
		scope: "app",
	},
	hostRendering: {
		hostOwnsContainer: true,
		hostOwnsPlacementVocabulary: true,
		hostOwnsActivationLifecycle: true,
		allowedModes: ["data-only"],
		dataOnly: true,
		hostMayPreviewWithoutApply: true,
		hostMayApplyWithoutPluginRuntime: true,
	},
	escapeHatch: {
		policy: "forbidden",
		allowedTransports: [],
		requiresExplicitPolicyField: false,
		hostOwnedSandbox: true,
	},
	mutationGuard: {
		mayDirectlyMutateHostChrome: false,
		requiresWrapperToolsOrCapabilities: true,
		notes: [
			"Themes are data-only contributions.",
			"Preview and apply semantics stay host-owned.",
		],
	},
})

export const COMPONENT_CONTRACT = contributionFamilyContractSchema.parse({
	family: "components",
	hostVocabulary: ["loom-tree", "genui-fence", "artifact-widget", "side-panel"],
	placementSurfaces: ["loom-tree", "chat-fence", "artifact-widget"],
	activationTriggers: componentActivationTriggerSchema.options,
	defaultState: { mode: "default-off" },
	availability: {
		staticRequiresCapabilities: true,
		hostEvaluatesLiveAvailability: true,
		hostOwnsReasonStrings: true,
	},
	persistence: {
		strategy: componentPersistenceStrategySchema.enum["loom-node-state"],
		hostOwnsStorage: true,
		pluginMayProvidePersistenceKey: false,
		scope: "session",
	},
	hostRendering: {
		hostOwnsContainer: true,
		hostOwnsPlacementVocabulary: true,
		hostOwnsActivationLifecycle: true,
		allowedModes: ["host-reconciler", "declarative-props"],
		dataOnly: false,
		hostMayPreviewWithoutApply: true,
		hostMayApplyWithoutPluginRuntime: false,
	},
	escapeHatch: {
		policy: "forbidden",
		allowedTransports: [],
		requiresExplicitPolicyField: false,
		hostOwnedSandbox: true,
	},
	mutationGuard: {
		mayDirectlyMutateHostChrome: false,
		requiresWrapperToolsOrCapabilities: true,
		notes: [
			"Components render inside host-owned Loom and GenUI containers only.",
			"Component state and events flow through Loom bindings; direct DOM escape is forbidden.",
		],
	},
})

export const CONTRIBUTION_FAMILY_CONTRACTS = {
	panels: PANEL_CONTRACT,
	widgets: WIDGET_CONTRACT,
	commands: COMMAND_CONTRACT,
	themes: THEME_CONTRACT,
	components: COMPONENT_CONTRACT,
} as const satisfies Readonly<Record<ContributionFamily, ContributionFamilyContract>>

export const ALL_CONTRIBUTION_FAMILY_CONTRACTS = Object.values(CONTRIBUTION_FAMILY_CONTRACTS)

export interface EscapeHatchRequest {
	family: ContributionFamily
	transport: EscapeHatchTransport
	explicitPolicy: boolean
}

export function getContributionFamilyContract(family: ContributionFamily): ContributionFamilyContract {
	return CONTRIBUTION_FAMILY_CONTRACTS[family]
}

export function isEscapeHatchAllowed(request: EscapeHatchRequest): boolean {
	const contract = getContributionFamilyContract(request.family)
	if (contract.escapeHatch.policy !== "opt-in-explicit") return false
	if (!request.explicitPolicy) return false
	return contract.escapeHatch.allowedTransports.includes(request.transport)
}

export function familyMayRequestEscapeHatch(family: ContributionFamily): boolean {
	return ESCAPE_HATCH_ELIGIBLE_FAMILIES.has(family)
}

export function familyAllowsDirectHostChromeMutation(family: ContributionFamily): boolean {
	return getContributionFamilyContract(family).mutationGuard.mayDirectlyMutateHostChrome
}

export function commandRequiresWrapperToolsForChromeMutation(): boolean {
	return COMMAND_CONTRACT.mutationGuard.requiresWrapperToolsOrCapabilities
}

export function themeIsDataOnly(): boolean {
	return THEME_CONTRACT.hostRendering.dataOnly
}

export function themePreviewApplyOwnedByHost(): boolean {
	return THEME_CONTRACT.hostRendering.hostMayPreviewWithoutApply
}
