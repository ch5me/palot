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
	type ComponentContribution,
	type GrammarContribution,
	type IconThemeContribution,
	type LanguageContribution,
	type LifecycleHints,
	type NavSidebarContribution,
	type PanelContribution,
	type PluginId,
	type PluginManifest,
	type SnippetContribution,
	type ThemeContribution,
	type ToolContribution,
	type TrustTier,
	type WidgetContribution,
} from "./manifest"
import {
	DEFAULT_RUNTIME_SURFACES,
	inferDefaultHostKind,
	resolveRuntimeLocation,
	type BuildSurface,
	type RuntimeDeclaration,
	type RuntimeResolution,
} from "./runtime-location"

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
	/**
	 * The build currently running the host. Drives §2.3 runtime-location
	 * resolution. Defaults to `"electron"` — palot ships only the desktop
	 * build today; the web build passes `"web"` once firefly-cloud lands.
	 */
	currentBuild?: BuildSurface
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
	readonly navSidebars: readonly NavSidebarContribution[]
	readonly widgets: readonly WidgetContribution[]
	readonly commands: readonly CommandContribution[]
	readonly themes: readonly ThemeContribution[]
	readonly tools: readonly ToolContribution[]
	readonly components: readonly ComponentContribution[]
	readonly snippets: readonly SnippetContribution[]
	readonly languages: readonly LanguageContribution[]
	readonly grammars: readonly GrammarContribution[]
	readonly iconThemes: readonly IconThemeContribution[]
	readonly bridge: BridgeMetadata | null
	/**
	 * Effective runtime declaration (design §2.5). Always present: either the
	 * manifest's explicit `runtime` block, or a back-compat default inferred
	 * from the contributions (`inferDefaultHostKind`).
	 */
	readonly runtime: RuntimeDeclaration
	/**
	 * Resolved §2.3 location for the host's current build. `{ supported:false }`
	 * names exactly why a location does not exist (e.g. a node-worker on web
	 * with no cloud-host) — the projection surfaces this as "unsupported on this
	 * surface" rather than silently disabling (CH5 #9, no silent fallback).
	 */
	readonly runtimeResolution: RuntimeResolution
	readonly derived: {
		readonly appVersion: string
		readonly currentBuild: BuildSurface
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
 * Evaluate whether `hostVersion` satisfies `range`.
 *
 * Supports the subset accepted by `semverRangeSchema` in `manifest.ts`:
 *   `>=X.Y.Z`           – floor (inclusive)
 *   `>X.Y.Z`            – floor (exclusive)
 *   `<X.Y.Z`            – upper bound (exclusive)
 *   `<=X.Y.Z`           – upper bound (inclusive)
 *   `>=X.Y.Z <A.B.C`    – compound (space-separated; all must pass)
 *   `X.Y.Z`             – bare version treated as `>=X.Y.Z`
 *
 * Throws if a constraint token cannot be parsed (which should not happen
 * when the range was validated by `semverRangeSchema` at parse time).
 */
export function satisfiesSemverRange(hostVersion: string, range: string): boolean {
	// bare version → treat as >=
	const trimmed = range.trim()
	if (/^\d/u.test(trimmed)) {
		return compareSemver(hostVersion, trimmed) >= 0
	}
	// split compound range on whitespace, evaluate every constraint
	const tokens = trimmed.split(/\s+/u)
	for (const token of tokens) {
		const match = /^(>=?|<=?)(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/u.exec(token)
		if (!match) {
			throw new Error(`satisfiesSemverRange: cannot parse constraint token "${token}" in range "${range}"`)
		}
		const op = match[1]!
		const ver = match[2]!
		const cmp = compareSemver(hostVersion, ver)
		if (op === ">=" && cmp < 0) return false
		if (op === ">" && cmp <= 0) return false
		if (op === "<=" && cmp > 0) return false
		if (op === "<" && cmp >= 0) return false
	}
	return true
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

	// Resolve the effective engines range: `engines.firefly` is canonical;
	// `engines.desktop` is the migration alias treated as `>=<floor>`.
	const enginesRange: string | undefined =
		manifest.engines.firefly ?? (manifest.engines.desktop ? `>=${manifest.engines.desktop}` : undefined)
	if (enginesRange !== undefined && !satisfiesSemverRange(options.appVersion, enginesRange)) {
		const field = manifest.engines.firefly ? "engines.firefly" : "engines.desktop"
		issues.push({
			path: ["engines", "firefly"],
			message: `host appVersion ${options.appVersion} does not satisfy ${field} range "${enginesRange}"`,
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

	// Resolve the effective runtime declaration (design §2.5). Explicit
	// `runtime` wins; otherwise infer a back-compat default from the
	// contributions so pre-`runtime` manifests keep their current behavior.
	// Tolerate partially-populated contributions: a validated manifest always
	// has every family (Zod `.default([])`), but `derivePluginDescriptor` is
	// also called directly in tests with hand-built partial manifests, and the
	// rest of this function never assumes a family is present either.
	const c = manifest.contributes
	const n = (arr: readonly unknown[] | undefined): number => arr?.length ?? 0
	const runtime: RuntimeDeclaration = manifest.runtime ?? {
		hostKind: inferDefaultHostKind({
			codeContributions: n(c.commands) + n(c.tools) + (manifest.bridge ? 1 : 0),
			uiContributions: n(c.panels) + n(c.navSidebars) + n(c.widgets) + n(c.components),
			dataContributions: n(c.themes) + n(c.snippets) + n(c.languages) + n(c.grammars) + n(c.iconThemes),
		}),
		surfaces: [...DEFAULT_RUNTIME_SURFACES],
		webStrategy: "unsupported",
	}
	const currentBuild: BuildSurface = options.currentBuild ?? "electron"
	const runtimeResolution = resolveRuntimeLocation({
		hostKind: runtime.hostKind,
		build: currentBuild,
		webStrategy: runtime.webStrategy,
		surfaces: runtime.surfaces,
	})

	return {
		manifest,
		normalizedId: manifest.id,
		trust: manifest.trust,
		lifecycle: manifest.lifecycle,
		capabilities: manifest.capabilities,
		activationEvents: manifest.activationEvents,
		panels: manifest.contributes.panels,
		navSidebars: manifest.contributes.navSidebars,
		widgets: manifest.contributes.widgets,
		commands: manifest.contributes.commands,
		themes: manifest.contributes.themes,
		tools: manifest.contributes.tools,
		components: manifest.contributes.components,
		snippets: manifest.contributes.snippets,
		languages: manifest.contributes.languages,
		grammars: manifest.contributes.grammars,
		iconThemes: manifest.contributes.iconThemes,
		bridge: manifest.bridge ?? null,
		runtime,
		runtimeResolution,
		derived: {
			appVersion: options.appVersion,
			currentBuild,
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
