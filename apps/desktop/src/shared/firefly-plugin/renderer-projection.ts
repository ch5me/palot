import type { PluginDescriptor, HostPanelSlot, HostWidgetZone } from "./descriptor"
import {
	COMMAND_CONTRACT,
	NAV_SIDEBAR_CONTRACT,
	PANEL_CONTRACT,
	THEME_CONTRACT,
	WIDGET_CONTRACT,
	type ContributionFamilyContract,
	panelPlacementSlotSchema,
	widgetPlacementZoneSchema,
} from "./family-contracts"
import { evaluateBrokerRequest, lookupCapability, type CapabilityRisk } from "./capabilities"

export const RENDERER_PROJECTION_FAMILIES = ["panels", "navSidebars", "widgets", "commands", "themes"] as const
export type RendererProjectionFamily = (typeof RENDERER_PROJECTION_FAMILIES)[number]

export type RendererContributionState =
	| "ready"
	| "loading"
	| "disabled"
	| "quarantined"
	| "error"

export type RendererAvailabilityReasonCode =
	| "available"
	| "loading"
	| "plugin-disabled"
	| "plugin-quarantined"
	| "plugin-error"
	| "plugin-capability-missing"
	| "contribution-capability-missing"
	| "reserved-command-prefix"
	| "host-capability-unknown"

export interface CapabilityStateShape {
	readonly trust: PluginDescriptor["trust"]
	readonly sessionScope: "session" | "project" | "app"
	readonly grantedTokens: readonly string[]
	readonly loading?: boolean
	readonly pluginDisabled?: boolean
	readonly pluginQuarantined?: boolean
	readonly pluginError?: { readonly code: string; readonly message: string } | null
}

export interface RendererCapabilityGate {
	readonly token: string
	readonly knownToHost: boolean
	readonly granted: boolean
	readonly risk: CapabilityRisk | null
	readonly source: "plugin" | "contribution"
	readonly reason: string
}

export interface RendererAvailabilityReason {
	readonly code: RendererAvailabilityReasonCode
	readonly message: string
	readonly hostCapabilityState: Pick<
		CapabilityStateShape,
		"trust" | "sessionScope" | "grantedTokens" | "loading" | "pluginDisabled" | "pluginQuarantined" | "pluginError"
	>
	readonly missingCapabilities: readonly RendererCapabilityGate[]
}

export interface RendererAvailability {
	readonly available: boolean
	readonly state: RendererContributionState
	readonly reason: RendererAvailabilityReason | null
}

export interface ProjectionCollision {
	readonly family: RendererProjectionFamily
	readonly projectedId: string
	readonly pluginIds: readonly string[]
	readonly contributionIds: readonly string[]
	readonly message: string
}

export interface ProjectedSidePanel {
	readonly family: "panels"
	readonly pluginId: string
	readonly contributionId: string
	readonly projectedId: string
	readonly title: string
	readonly icon: string | null
	readonly formFactor: "side-panel-tab" | "main-pane"
	readonly hostSlot: HostPanelSlot
	readonly hostTarget: { readonly kind: "side-panel" | "main-pane"; readonly slot: HostPanelSlot }
	readonly defaultOn: boolean
	readonly commandIds: readonly string[]
	readonly persistenceKey: string | null
	readonly telemetryNamespace: string | null
	readonly renderMode: "host-reconciler" | "declarative-props" | "iframe"
	readonly declarativeSchemaRef: string | null
	readonly iframeSandbox: string | null
	readonly capabilityGates: readonly RendererCapabilityGate[]
	readonly availability: RendererAvailability
	readonly contract: ContributionFamilyContract
}

export interface ProjectedSessionWidget {
	readonly family: "widgets"
	readonly pluginId: string
	readonly contributionId: string
	readonly projectedId: string
	readonly title: string
	readonly icon: string | null
	readonly hostZone: HostWidgetZone
	readonly defaultEnabled: boolean
	readonly renderMode: "host-reconciler" | "declarative-props" | "iframe"
	readonly declarativeSchemaRef: string | null
	readonly iframeSandbox: string | null
	readonly capabilityGates: readonly RendererCapabilityGate[]
	readonly availability: RendererAvailability
	readonly contract: ContributionFamilyContract
}

export interface ProjectedCommand {
	readonly family: "commands"
	readonly pluginId: string
	readonly contributionId: string
	readonly projectedId: string
	readonly title: string
	readonly description: string | null
	readonly category: string | null
	readonly icon: string | null
	readonly keybinding: string | null
	readonly when: string | null
	readonly placement: {
		readonly palette: boolean
		readonly menuPath: readonly string[]
		readonly keybinding: string | null
		readonly contextualWhen: string | null
	}
	readonly capabilityGates: readonly RendererCapabilityGate[]
	readonly availability: RendererAvailability
	readonly contract: ContributionFamilyContract
}

export interface ProjectedTheme {
	readonly family: "themes"
	readonly pluginId: string
	readonly contributionId: string
	readonly projectedId: string
	readonly label: string
	readonly envelope: {
		readonly kind: "light" | "dark" | "system-adaptive"
		readonly platforms: readonly ("darwin" | "linux" | "win32")[] | null
		readonly tokens: Readonly<Record<string, string>>
		readonly darkTokens: Readonly<Record<string, string>>
		readonly fontFamily: string | null
		readonly radius: string | null
		readonly density: "compact" | "cozy" | "comfortable" | null
		readonly imports:
			| {
					readonly source: "vscode-theme" | "open-vsx"
					readonly externalId: string
					readonly provenance: string | null
			  }
			| null
	}
	readonly capabilityGates: readonly RendererCapabilityGate[]
	readonly availability: RendererAvailability
	readonly contract: ContributionFamilyContract
}

export interface RendererProjectionResult<T> {
	readonly items: readonly T[]
	readonly collisions: readonly ProjectionCollision[]
}

function cloneGrantedTokens(tokens: readonly string[]): readonly string[] {
	return [...tokens]
}

function snapshotHostCapabilityState(state: CapabilityStateShape) {
	return {
		trust: state.trust,
		sessionScope: state.sessionScope,
		grantedTokens: cloneGrantedTokens(state.grantedTokens),
		loading: state.loading ?? false,
		pluginDisabled: state.pluginDisabled ?? false,
		pluginQuarantined: state.pluginQuarantined ?? false,
		pluginError: state.pluginError ? { ...state.pluginError } : null,
	} as const
}

function buildCapabilityGates(
	descriptor: PluginDescriptor,
	contributionRequires: readonly string[],
	state: CapabilityStateShape,
): RendererCapabilityGate[] {
	const pluginDeclared = new Set(descriptor.capabilities)
	const gates: RendererCapabilityGate[] = []
	const seen = new Set<string>()
	const pushGate = (token: string, source: "plugin" | "contribution") => {
		const key = `${source}:${token}`
		if (seen.has(key)) return
		seen.add(key)
		const known = lookupCapability(token)
		const decision = evaluateBrokerRequest({
			token,
			trust: state.trust,
			sessionScope: state.sessionScope,
			grantedTokens: [...state.grantedTokens],
		})
		gates.push({
			token,
			knownToHost: known !== null,
			granted: decision.granted,
			risk: known?.risk ?? null,
			source,
			reason: decision.reason,
		})
	}
	for (const token of descriptor.capabilities) pushGate(token, "plugin")
	for (const token of contributionRequires) {
		pushGate(token, "contribution")
		if (!pluginDeclared.has(token)) pushGate(token, "plugin")
	}
	return gates
}

function firstAvailabilityReasonCode(missing: readonly RendererCapabilityGate[]): RendererAvailabilityReasonCode {
	if (missing.some((gate) => !gate.knownToHost)) return "host-capability-unknown"
	if (missing.some((gate) => gate.source === "plugin")) return "plugin-capability-missing"
	return "contribution-capability-missing"
}

function buildAvailability(
	state: CapabilityStateShape,
	gates: readonly RendererCapabilityGate[],
	extra?: { code: RendererAvailabilityReasonCode; message: string },
): RendererAvailability {
	const hostCapabilityState = snapshotHostCapabilityState(state)
	if (state.pluginError) {
		return {
			available: false,
			state: "error",
			reason: {
				code: "plugin-error",
				message: `Plugin error: ${state.pluginError.message}`,
				hostCapabilityState,
				missingCapabilities: [],
			},
		}
	}
	if (state.pluginQuarantined) {
		return {
			available: false,
			state: "quarantined",
			reason: {
				code: "plugin-quarantined",
				message: "Plugin is quarantined by the host",
				hostCapabilityState,
				missingCapabilities: [],
			},
		}
	}
	if (state.pluginDisabled) {
		return {
			available: false,
			state: "disabled",
			reason: {
				code: "plugin-disabled",
				message: "Plugin is disabled by the host",
				hostCapabilityState,
				missingCapabilities: [],
			},
		}
	}
	if (state.loading) {
		return {
			available: false,
			state: "loading",
			reason: {
				code: "loading",
				message: "Plugin projection is waiting for capability state",
				hostCapabilityState,
				missingCapabilities: [],
			},
		}
	}
	if (extra) {
		return {
			available: false,
			state: "error",
			reason: {
				code: extra.code,
				message: extra.message,
				hostCapabilityState,
				missingCapabilities: [],
			},
		}
	}
	const missing = gates.filter((gate) => !gate.granted)
	if (missing.length > 0) {
		return {
			available: false,
			state: "ready",
			reason: {
				code: firstAvailabilityReasonCode(missing),
				message: missing[0]?.reason ?? "Required capabilities are not granted",
				hostCapabilityState,
				missingCapabilities: missing,
			},
		}
	}
	return {
		available: true,
		state: "ready",
		reason: {
			code: "available",
			message: "Available",
			hostCapabilityState,
			missingCapabilities: [],
		},
	}
}

function buildCollisionMap<T extends { projectedId: string; pluginId: string; contributionId: string }>(
	family: RendererProjectionFamily,
	items: readonly T[],
): ProjectionCollision[] {
	const byId = new Map<string, { pluginIds: Set<string>; contributionIds: Set<string> }>()
	for (const item of items) {
		const entry = byId.get(item.projectedId) ?? {
			pluginIds: new Set<string>(),
			contributionIds: new Set<string>(),
		}
		entry.pluginIds.add(item.pluginId)
		entry.contributionIds.add(item.contributionId)
		byId.set(item.projectedId, entry)
	}
	const collisions: ProjectionCollision[] = []
	for (const [projectedId, entry] of byId) {
		if (entry.pluginIds.size < 2) continue
		collisions.push({
			family,
			projectedId,
			pluginIds: [...entry.pluginIds],
			contributionIds: [...entry.contributionIds],
			message: `Projected ${family} id collision: ${projectedId}`,
		})
	}
	return collisions
}

function projectIdForCollision(contributionId: string): string {
	return contributionId
}

export function getProjectedPanelId(descriptor: PluginDescriptor, panelId: string): string {
	return `${descriptor.normalizedId}.${panelId}`
}

export function getProjectedWidgetId(descriptor: PluginDescriptor, widgetId: string): string {
	return `${descriptor.normalizedId}.${widgetId}`
}

export function getProjectedCommandId(descriptor: PluginDescriptor, commandId: string): string {
	return `${descriptor.normalizedId}.${commandId}`
}

export function getProjectedThemeId(descriptor: PluginDescriptor, themeId: string): string {
	return `${descriptor.normalizedId}.${themeId}`
}

export function projectSidePanels(
	descriptor: PluginDescriptor,
	state: CapabilityStateShape,
): readonly ProjectedSidePanel[] {
	return descriptor.panels.map((panel) => {
		const gates = buildCapabilityGates(descriptor, panel.availability.requires, state)
		const hostSlot = panelPlacementSlotSchema.parse(panel.defaultZone) as HostPanelSlot
		return {
			family: "panels",
			pluginId: descriptor.normalizedId,
			contributionId: panel.id,
			projectedId: getProjectedPanelId(descriptor, panel.id),
			title: panel.title,
			icon: panel.icon ?? null,
			formFactor: panel.formFactor,
			hostSlot,
			hostTarget: {
				kind: hostSlot === "main-pane" ? "main-pane" : "side-panel",
				slot: hostSlot,
			},
			defaultOn: panel.defaultOn,
			commandIds: [...panel.commandIds],
			persistenceKey: panel.persistenceKey ?? null,
			telemetryNamespace: panel.telemetryNamespace ?? null,
			renderMode: panel.render.mode,
			declarativeSchemaRef: panel.render.declarativeSchemaRef ?? null,
			iframeSandbox: panel.render.iframeSandbox ?? null,
			capabilityGates: gates,
			availability: buildAvailability(state, gates),
			contract: PANEL_CONTRACT,
		}
	})
}

export function projectSessionWidgets(
	descriptor: PluginDescriptor,
	state: CapabilityStateShape,
): readonly ProjectedSessionWidget[] {
	return descriptor.widgets.map((widget) => {
		const gates = buildCapabilityGates(descriptor, widget.availability.requires, state)
		return {
			family: "widgets",
			pluginId: descriptor.normalizedId,
			contributionId: widget.id,
			projectedId: getProjectedWidgetId(descriptor, widget.id),
			title: widget.title,
			icon: widget.icon ?? null,
			hostZone: widgetPlacementZoneSchema.parse(widget.zoneId) as HostWidgetZone,
			defaultEnabled: widget.defaultEnabled,
			renderMode: widget.render.mode,
			declarativeSchemaRef: widget.render.declarativeSchemaRef ?? null,
			iframeSandbox: widget.render.iframeSandbox ?? null,
			capabilityGates: gates,
			availability: buildAvailability(state, gates),
			contract: WIDGET_CONTRACT,
		}
	})
}

function commandPrefixViolation(commandId: string): boolean {
	return (
		commandId.startsWith("firefly.") ||
		commandId.startsWith("surface.") ||
		commandId.startsWith("plugins.") ||
		commandId.startsWith("plugin.")
	)
}

export function projectCommands(
	descriptor: PluginDescriptor,
	state: CapabilityStateShape,
): readonly ProjectedCommand[] {
	return descriptor.commands.map((command) => {
		const gates = buildCapabilityGates(descriptor, command.requires, state)
		const availability = buildAvailability(
			state,
			gates,
			commandPrefixViolation(command.id)
				? {
						code: "reserved-command-prefix",
						message: `Command ${command.id} uses a reserved host prefix`,
				  }
				: undefined,
		)
		return {
			family: "commands",
			pluginId: descriptor.normalizedId,
			contributionId: command.id,
			projectedId: getProjectedCommandId(descriptor, command.id),
			title: command.title,
			description: command.description ?? null,
			category: command.category ?? null,
			icon: command.icon ?? null,
			keybinding: command.keybinding ?? null,
			when: command.when ?? null,
			placement: {
				palette: true,
				menuPath: command.menuPath ? [...command.menuPath] : [],
				keybinding: command.keybinding ?? null,
				contextualWhen: command.when ?? null,
			},
			capabilityGates: gates,
			availability,
			contract: COMMAND_CONTRACT,
		}
	})
}

export function projectThemes(
	descriptor: PluginDescriptor,
	state: CapabilityStateShape,
): readonly ProjectedTheme[] {
	return descriptor.themes.map((theme) => {
		const gates = buildCapabilityGates(descriptor, [], state)
		return {
			family: "themes",
			pluginId: descriptor.normalizedId,
			contributionId: theme.id,
			projectedId: getProjectedThemeId(descriptor, theme.id),
			label: theme.label,
			envelope: {
				kind: theme.kind,
				platforms: theme.platforms ? [...theme.platforms] : null,
				tokens: { ...theme.tokens },
				darkTokens: { ...theme.darkTokens },
				fontFamily: theme.fontFamily ?? null,
				radius: theme.radius ?? null,
				density: theme.density ?? null,
				imports: theme.imports
					? {
							source: theme.imports.source,
							externalId: theme.imports.externalId,
							provenance: theme.imports.provenance ?? null,
					  }
					: null,
			},
			capabilityGates: gates,
			availability: buildAvailability(state, gates),
			contract: THEME_CONTRACT,
		}
	})
}

export function projectSidePanelsFromCatalog(
	descriptors: readonly PluginDescriptor[],
	stateByPluginId: Readonly<Record<string, CapabilityStateShape>>,
): RendererProjectionResult<ProjectedSidePanel> {
	const items = descriptors.flatMap((descriptor) =>
		projectSidePanels(descriptor, stateByPluginId[descriptor.normalizedId] ?? defaultCapabilityState(descriptor)),
	)
	const collisions = buildCollisionMap(
		"panels",
		items.map((item) => ({ ...item, projectedId: projectIdForCollision(item.contributionId) })),
	)
	return { items, collisions }
}

export function projectSessionWidgetsFromCatalog(
	descriptors: readonly PluginDescriptor[],
	stateByPluginId: Readonly<Record<string, CapabilityStateShape>>,
): RendererProjectionResult<ProjectedSessionWidget> {
	const items = descriptors.flatMap((descriptor) =>
		projectSessionWidgets(
			descriptor,
			stateByPluginId[descriptor.normalizedId] ?? defaultCapabilityState(descriptor),
		),
	)
	const collisions = buildCollisionMap(
		"widgets",
		items.map((item) => ({ ...item, projectedId: projectIdForCollision(item.contributionId) })),
	)
	return { items, collisions }
}

export function projectCommandsFromCatalog(
	descriptors: readonly PluginDescriptor[],
	stateByPluginId: Readonly<Record<string, CapabilityStateShape>>,
): RendererProjectionResult<ProjectedCommand> {
	const items = descriptors.flatMap((descriptor) =>
		projectCommands(descriptor, stateByPluginId[descriptor.normalizedId] ?? defaultCapabilityState(descriptor)),
	)
	const collisions = buildCollisionMap(
		"commands",
		items.map((item) => ({ ...item, projectedId: projectIdForCollision(item.contributionId) })),
	)
	return { items, collisions }
}

export function projectThemesFromCatalog(
	descriptors: readonly PluginDescriptor[],
	stateByPluginId: Readonly<Record<string, CapabilityStateShape>>,
): RendererProjectionResult<ProjectedTheme> {
	const items = descriptors.flatMap((descriptor) =>
		projectThemes(descriptor, stateByPluginId[descriptor.normalizedId] ?? defaultCapabilityState(descriptor)),
	)
	const collisions = buildCollisionMap(
		"themes",
		items.map((item) => ({ ...item, projectedId: projectIdForCollision(item.contributionId) })),
	)
	return { items, collisions }
}

export function defaultCapabilityState(descriptor: PluginDescriptor): CapabilityStateShape {
	return {
		trust: descriptor.trust,
		sessionScope: "session",
		grantedTokens: [...descriptor.capabilities],
		loading: false,
		pluginDisabled: false,
		pluginQuarantined: false,
		pluginError: null,
	}
}

export function projectRendererFamiliesFromCatalog(
	descriptors: readonly PluginDescriptor[],
	stateByPluginId: Readonly<Record<string, CapabilityStateShape>>,
) {
	return {
		panels: projectSidePanelsFromCatalog(descriptors, stateByPluginId),
		widgets: projectSessionWidgetsFromCatalog(descriptors, stateByPluginId),
		commands: projectCommandsFromCatalog(descriptors, stateByPluginId),
		themes: projectThemesFromCatalog(descriptors, stateByPluginId),
	} as const
}
