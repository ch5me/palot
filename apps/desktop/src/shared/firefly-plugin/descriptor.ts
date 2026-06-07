/**
 * Firefly Plugin System V2 — PluginDescriptor (host-validated, normalized form)
 *
 * `PluginDescriptor` is the canonical contribution source of truth used by
 * every projection (renderer, OpenCode bridge, lifecycle, policy). It is
 * produced by `derivePluginDescriptor` from a validated `PluginManifest`
 * plus host-side constants (app version, current build, known widget zones,
 * known panel slots). It contains no live process handles — those live on
 * `PluginInstance` and `PluginSessionHandle`, defined in their own modules.
 *
 * The derivation is intentionally pure and deterministic so the host can
 * re-derive descriptors after any catalog reload without state drift.
 */

import {
	pluginManifestSchema,
	type ActivationEvent,
	type BridgeMetadata,
	type CapabilityToken,
	type CommandContribution,
	type LifecycleHints,
	type PanelContribution,
	type PluginId,
	type PluginManifest,
	type ThemeContribution,
	type ToolContribution,
	type TrustTier,
	type WidgetContribution,
} from "./manifest"

/** Host-known panel slots the projection must align to. V2 may not mint
 *  new slots; the set is closed and the host owns it. */
export const HOST_PANEL_SLOTS = ["side-panel", "main-pane"] as const
export type HostPanelSlot = (typeof HOST_PANEL_SLOTS)[number]

/** Host-known widget zones. Current seed mirrors
 *  `apps/desktop/src/renderer/atoms/session-widgets.ts`. V2 may not mint
 *  new zones; if a plugin needs a new zone it must be added here first. */
export const HOST_WIDGET_ZONES = ["above-chat", "chat-inline-right"] as const
export type HostWidgetZone = (typeof HOST_WIDGET_ZONES)[number]

export interface DerivePluginDescriptorOptions {
	appVersion: string
	knownPanelSlot?: (zone: string) => zone is HostPanelSlot
	knownWidgetZone?: (zone: string) => zone is HostWidgetZone
	defaultQuarantineOnCrashCount?: number
	defaultToolTimeoutMs?: number
	defaultDispatchTimeoutMs?: number
}

export class PluginDescriptorError extends Error {
	readonly issues: { path: (string | number)[]; message: string }[]
	constructor(
		pluginId: PluginId,
		issues: { path: (string | number)[]; message: string }[],
	) {
		super(`PluginDescriptor for ${pluginId} rejected: ${issues.map((i) => i.message).join("; ")}`)
		this.name = "PluginDescriptorError"
		this.issues = issues
	}
}

export interface PluginDescriptor {
	readonly manifest: PluginManifest
	readonly normalizedId: PluginId
	readonly trust: TrustTier
	readonly lifecycle: LifecycleHints
	readonly capabilities: readonly CapabilityToken[]
	readonly activationEvents: readonly ActivationEvent[]
	readonly panels: readonly PanelContribution[]
	readonly widgets: readonly WidgetContribution[]
	readonly commands: readonly CommandContribution[]
	readonly themes: readonly ThemeContribution[]
	readonly tools: readonly ToolContribution[]
	readonly bridge: BridgeMetadata | null
	readonly derived: {
		readonly appVersion: string
		readonly derivedAt: number
		readonly quarantineOnCrashCount: number
		readonly defaultToolTimeoutMs: number
		readonly defaultDispatchTimeoutMs: number
		readonly hostPanelSlots: readonly HostPanelSlot[]
		readonly hostWidgetZones: readonly HostWidgetZone[]
	}
}

function defaultKnownPanelSlot(zone: string): zone is HostPanelSlot {
	return (HOST_PANEL_SLOTS as readonly string[]).includes(zone)
}

function defaultKnownWidgetZone(zone: string): zone is HostWidgetZone {
	return (HOST_WIDGET_ZONES as readonly string[]).includes(zone)
}

function compareSemver(a: string, b: string): number {
	const [aMajor, aMinor, aPatch] = a.split("-")[0].split(".").map((n) => Number.parseInt(n, 10))
	const [bMajor, bMinor, bPatch] = b.split("-")[0].split(".").map((n) => Number.parseInt(n, 10))
	if (aMajor !== bMajor) return aMajor - bMajor
	if (aMinor !== bMinor) return aMinor - bMinor
	return aPatch - bPatch
}

/**
 * Derive a `PluginDescriptor` from a validated manifest. Pure & deterministic
 * so reload cycles can re-run this without state drift.
 *
 * Throws `PluginDescriptorError` for any host-side rejection (unknown
 * panel slot, unknown widget zone, host version too old). The catalog
 * loader is expected to catch this and quarantine the plugin.
 */
export function derivePluginDescriptor(
	manifest: PluginManifest,
	options: DerivePluginDescriptorOptions,
): PluginDescriptor {
	const issues: { path: (string | number)[]; message: string }[] = []
	const knownPanelSlot = options.knownPanelSlot ?? defaultKnownPanelSlot
	const knownWidgetZone = options.knownWidgetZone ?? defaultKnownWidgetZone

	if (manifest.engines.desktop && compareSemver(options.appVersion, manifest.engines.desktop) < 0) {
		issues.push({
			path: ["engines", "desktop"],
			message: `host appVersion ${options.appVersion} is below plugin floor ${manifest.engines.desktop}`,
		})
	}

	for (const panel of manifest.contributes.panels) {
		if (!knownPanelSlot(panel.defaultZone)) {
			issues.push({
				path: ["contributes", "panels"],
				message: `panel ${panel.id} declares unknown host panel slot: ${panel.defaultZone}`,
			})
		}
	}

	for (const widget of manifest.contributes.widgets) {
		if (!knownWidgetZone(widget.zoneId)) {
			issues.push({
				path: ["contributes", "widgets"],
				message: `widget ${widget.id} declares unknown host widget zone: ${widget.zoneId}`,
			})
		}
	}

	if (issues.length > 0) {
		throw new PluginDescriptorError(manifest.id, issues)
	}

	return {
		manifest,
		normalizedId: manifest.id,
		trust: manifest.trust,
		lifecycle: manifest.lifecycle,
		capabilities: manifest.capabilities,
		activationEvents: manifest.activationEvents,
		panels: manifest.contributes.panels,
		widgets: manifest.contributes.widgets,
		commands: manifest.contributes.commands,
		themes: manifest.contributes.themes,
		tools: manifest.contributes.tools,
		bridge: manifest.bridge ?? null,
		derived: {
			appVersion: options.appVersion,
			derivedAt: Date.now(),
			quarantineOnCrashCount: manifest.lifecycle.quarantineOnCrashCount ?? options.defaultQuarantineOnCrashCount ?? 3,
			defaultToolTimeoutMs: options.defaultToolTimeoutMs ?? 60_000,
			defaultDispatchTimeoutMs: options.defaultDispatchTimeoutMs ?? 5_000,
			hostPanelSlots: HOST_PANEL_SLOTS,
			hostWidgetZones: HOST_WIDGET_ZONES,
		},
	}
}

export function derivePluginDescriptorOrNull(
	manifest: PluginManifest,
	options: DerivePluginDescriptorOptions,
): PluginDescriptor | null {
	try {
		return derivePluginDescriptor(manifest, options)
	} catch {
		return null
	}
}

/** Strict variant — re-parses the input first so callers can pass raw
 *  on-disk bytes / untyped JSON. */
export function parseAndDerivePluginDescriptor(
	input: unknown,
	options: DerivePluginDescriptorOptions,
): PluginDescriptor {
	const manifest = pluginManifestSchema.parse(input)
	return derivePluginDescriptor(manifest, options)
}
