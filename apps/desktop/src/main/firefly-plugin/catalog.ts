/**
 * Firefly Plugin System V2 — catalog authority
 *
 * The host-side runtime layer that turns V2 manifests into the
 * canonical objects the rest of the app reads. The V2 plan (see
 * `.sisyphus/plans/firefly-plugin-system-v2.md`) names four runtime
 * objects: `PluginManifest` (on disk), `PluginDescriptor` (validated
 * + normalized), `PluginInstance` (host-owned live worker), and
 * `PluginSessionHandle` (session view). This file owns the first two
 * and is the entry point every IPC channel calls into.
 *
 * The catalog deliberately starts narrow: built-in manifests are
 * read from the existing shared V2 scaffold, validated through the
 * same Zod schema the tests exercise, and turned into descriptors
 * the host can trust as a single source of truth. Third-party /
 * AI-authored manifests load the same way — every plugin goes
 * through the same code path. That is the V2 acceptance criterion
 * "first-party and third-party plugins use the SAME runtime path".
 *
 * No worker spawning, no tool dispatch, no renderer DOM in this
 * module. Those are layered on top by the IPC handlers and the
 * renderer projection consumer.
 */

import { z } from "zod"

import {
	acmeNotebookManifest,
	ACME_NOTEBOOK_PLUGIN_ID,
} from "../../shared/firefly-plugin/acme-notebook-exemplar"
import {
	browserPluginManifest,
	BROWSER_PLUGIN_ID,
} from "../../../plugins/browser/manifest"
import {
	notesPluginManifest,
	NOTES_PLUGIN_ID,
} from "../../../plugins/notes/manifest"
import {
	reviewPluginManifest,
	REVIEW_PLUGIN_ID,
} from "../../../plugins/review/manifest"
import {
	devmuxToolbarManifest,
	DEVMUX_TOOLBAR_PLUGIN_ID,
} from "../../../plugins/devmux-toolbar/manifest"
import {
	filesPluginManifest,
	FILES_PLUGIN_ID,
} from "../../../plugins/files/manifest"
import {
	artifactsPluginManifest,
	ARTIFACTS_PLUGIN_ID,
} from "../../../plugins/artifacts/manifest"
import {
	bridgesPluginManifest,
	BRIDGES_PLUGIN_ID,
} from "../../../plugins/bridges/manifest"
import {
	pulsePluginManifest,
	PULSE_PLUGIN_ID,
} from "../../../plugins/pulse/manifest"
import {
	editorPluginManifest,
	EDITOR_PLUGIN_ID,
} from "../../../plugins/editor/manifest"
import {
	terminalPluginManifest,
	TERMINAL_PLUGIN_ID,
} from "../../../plugins/terminal/manifest"
import {
	claudePluginManifest,
	CLAUDE_PLUGIN_ID,
} from "../../../plugins/claude/manifest"
import {
	oraclePluginManifest,
	ORACLE_PLUGIN_ID,
} from "../../../plugins/oracle/manifest"
import {
	voicePluginManifest,
	VOICE_PLUGIN_ID,
} from "../../../plugins/voice/manifest"
import { BUILT_IN_DEFAULT_CAPABILITIES } from "../../shared/firefly-plugin/capabilities"
import { type PluginDescriptor } from "../../shared/firefly-plugin/descriptor"
import {
	memoryPluginManifest,
	MEMORY_PLUGIN_ID,
} from "../../../plugins/memory/manifest"
import {
	defaultCapabilityState,
	projectCommandsFromCatalog,
	projectComponentsFromCatalog,
	projectSidePanelsFromCatalog,
	projectSessionWidgetsFromCatalog,
	projectThemesFromCatalog,
	type CapabilityStateShape,
} from "../../shared/firefly-plugin/index"
import {
	type ProjectedCommand,
	type ProjectedComponent,
	type ProjectedSessionWidget,
	type ProjectedSidePanel,
	type ProjectedTheme,
} from "../../shared/firefly-plugin/renderer-projection"
import { type PluginManifest } from "../../shared/firefly-plugin/manifest"
import {
	acmeComponentsExemplarManifest,
	ACME_COMPONENTS_PLUGIN_ID,
} from "../../shared/firefly-plugin/exemplars/acme-components-exemplar"
import { palotBridgeManifest, PALOT_BRIDGE_PLUGIN_ID } from "../../shared/firefly-plugin/palot-bridge-manifest"

import { derivePluginDescriptor, parsePluginManifest } from "../../shared/firefly-plugin/index"

import { createLogger } from "../logger"

const log = createLogger("firefly-plugin-catalog")

/**
 * The deterministic, in-source list of V2 manifests the desktop
 * app currently ships with. New exemplars land here in the same
 * shape: a `PluginManifest` constant imported from `shared/firefly-plugin`.
 *
 * Treat this list as the boot order: first entry is the primary
 * first-party exemplar, second is the third-party / AI-authored
 * exemplar. The catalog is the only place that knows about either.
 */
const BUILT_IN_MANIFESTS: readonly PluginManifest[] = [
	palotBridgeManifest,
	memoryPluginManifest,
	acmeNotebookManifest,
	browserPluginManifest,
	notesPluginManifest,
	reviewPluginManifest,
	filesPluginManifest,
	artifactsPluginManifest,
	bridgesPluginManifest,
	pulsePluginManifest,
	editorPluginManifest,
	terminalPluginManifest,
	claudePluginManifest,
	oraclePluginManifest,
	voicePluginManifest,
	acmeComponentsExemplarManifest,
	devmuxToolbarManifest,
]

/**
 * Lifecycle status for a plugin the catalog knows about. The V2
 * lifecycle state machine in `runtime-supervision.ts` defines the
 * full set; for the catalog authority we expose a projection that
 * only carries the states the operator surface cares about.
 */
export const PLUGIN_CATALOG_STATUSES = [
	"validated",
	"installed",
	"disabled",
	"active",
	"degraded",
	"quarantined",
] as const
export type PluginCatalogStatus = (typeof PLUGIN_CATALOG_STATUSES)[number]

/**
 * The minimal, safe-to-serialize plugin row. The full
 * `PluginDescriptor` lives in main only; the renderer gets this
 * slimmed view plus the projection outputs.
 */
export interface PluginCatalogEntry {
	readonly pluginId: string
	readonly displayName: string
	readonly version: string
	readonly trust: PluginDescriptor["trust"]
	readonly status: PluginCatalogStatus
	readonly manifestRevision: number
	readonly appVersion: string
	readonly requiredCapabilities: readonly string[]
	readonly defaultGrantedCapabilities: readonly string[]
	/** Human-readable reason for a non-nominal status (e.g. quarantine cause). */
	readonly statusDetail?: string
	/** Where the manifest came from. Built-ins are in-source TS manifests. */
	readonly source?: "built-in" | "disk"
}

/**
 * A disk manifest that failed the JSON-profile parse. The catalog
 * surfaces these as quarantined entries so the operator UI can show
 * the failure without the bad manifest blocking the rest of boot.
 */
export interface PluginCatalogLoadFailure {
	readonly manifestPath: string
	readonly pluginId: string | null
	readonly issues: readonly { readonly path: (string | number)[]; readonly message: string }[]
}

const appVersionSchema = z
	.string()
	.min(1)
	.max(40)
	.regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u, "appVersion must be semver")

/**
 * The single in-process catalog. Hosts:
 *   - the parsed `PluginDescriptor[]` (one per built-in manifest)
 *   - the per-plugin capability state the renderer reads
 *   - the latest projections (panels/widgets/commands/themes/components)
 *
 * Pure functions, no fs. Persistence is handled by the runtime
 * supervisor and the storage scopes layer (see
 * `shared/firefly-plugin/storage-scopes.ts`).
 */
export interface PluginCatalog {
	readonly appVersion: string
	readonly descriptors: readonly PluginDescriptor[]
	readonly entries: readonly PluginCatalogEntry[]
	readonly capabilityStates: Readonly<Record<string, CapabilityStateShape>>
	readonly projections: {
		readonly panels: readonly ProjectedSidePanel[]
		readonly widgets: readonly ProjectedSessionWidget[]
		readonly commands: readonly ProjectedCommand[]
		readonly themes: readonly ProjectedTheme[]
		readonly components: readonly ProjectedComponent[]
	}
}

/**
 * Build the V2 catalog. Pure: no fs, no side effects, no broadcast.
 * The catalog's lifecycle status projection is deterministic
 * (`validated` for every entry) until the runtime supervisor
 * upgrades it. That keeps slice 1 auditable.
 */
/**
 * Host runtime overlay for one plugin: operator enable/disable and
 * UI-crash quarantine state owned by the lifecycle store. Applied to
 * the capability state before projections so availability derives
 * from the single catalog path.
 */
export interface PluginCatalogStateOverride {
	readonly pluginDisabled?: boolean
	readonly pluginQuarantined?: boolean
	readonly quarantineDetail?: string | null
}

export function buildPluginCatalog(input: {
	appVersion: string
	/** JSON-profile manifests discovered on disk (already parsed). */
	diskManifests?: readonly PluginManifest[]
	/** Disk manifests that failed to parse — surfaced as quarantined entries. */
	diskFailures?: readonly PluginCatalogLoadFailure[]
	/** Host lifecycle overlay (enable/disable + quarantine) by plugin id. */
	stateOverrides?: Readonly<Record<string, PluginCatalogStateOverride>>
}): PluginCatalog {
	const appVersion = appVersionSchema.parse(input.appVersion)
	const descriptors: PluginDescriptor[] = []
	const entries: PluginCatalogEntry[] = []
	const capabilityStates: Record<string, CapabilityStateShape> = {}

	const sources: readonly { manifest: PluginManifest; source: "built-in" | "disk" }[] = [
		...BUILT_IN_MANIFESTS.map((manifest) => ({ manifest, source: "built-in" as const })),
		...(input.diskManifests ?? []).map((manifest) => ({ manifest, source: "disk" as const })),
	]

	const quarantineEntry = (pluginId: string, source: "built-in" | "disk", detail: string): void => {
		entries.push({
			pluginId,
			displayName: "(invalid manifest)",
			version: "0.0.0",
			trust: "unsigned-third-party",
			status: "quarantined",
			manifestRevision: 1,
			appVersion,
			requiredCapabilities: [],
			defaultGrantedCapabilities: [],
			statusDetail: detail,
			source,
		})
	}

	for (const { manifest, source } of sources) {
		// Reuse the same parse/derive path the test suite exercises.
		// Quarantine on parse failure rather than throwing: the
		// catalog stays the source of truth, and one bad manifest
		// cannot break boot.
		let parsed: PluginManifest
		try {
			parsed = parsePluginManifest(manifest)
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err)
			log.warn("Plugin manifest failed V2 schema parse, quarantining", {
				pluginId: manifest.id,
				reason,
			})
			quarantineEntry(manifest.id, source, `manifest schema parse failed: ${reason}`)
			continue
		}

		// Disk-loaded manifests may never claim host trust. A manifest
		// that ships on the third-party path declaring `built-in` is a
		// trust escalation attempt — quarantine, fail loud.
		if (source === "disk" && parsed.trust === "built-in") {
			log.warn("Disk plugin manifest claims built-in trust, quarantining", {
				pluginId: parsed.id,
			})
			quarantineEntry(parsed.id, source, 'disk-loaded manifests must not declare trust "built-in"')
			continue
		}

		let descriptor: PluginDescriptor
		try {
			descriptor = derivePluginDescriptor(parsed, { appVersion })
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err)
			log.warn("Plugin descriptor derivation failed, quarantining", {
				pluginId: parsed.id,
				reason,
			})
			quarantineEntry(parsed.id, source, `descriptor derivation failed: ${reason}`)
			continue
		}

		descriptors.push(descriptor)
		const override = input.stateOverrides?.[descriptor.normalizedId]
		const baseState = defaultCapabilityState(descriptor)
		capabilityStates[descriptor.normalizedId] = override
			? {
					...baseState,
					pluginDisabled: override.pluginDisabled ?? false,
					pluginQuarantined: override.pluginQuarantined ?? false,
			  }
			: baseState
		const status: PluginCatalogStatus = override?.pluginQuarantined
			? "quarantined"
			: override?.pluginDisabled
				? "disabled"
				: "validated"
		entries.push({
			pluginId: descriptor.normalizedId,
			displayName: descriptor.manifest.displayName,
			version: descriptor.manifest.version,
			trust: descriptor.trust,
			status,
			manifestRevision: descriptor.manifest.manifestRevision,
			appVersion: descriptor.derived.appVersion,
			requiredCapabilities: [...descriptor.capabilities],
			defaultGrantedCapabilities: descriptor.trust === "built-in"
				? [...BUILT_IN_DEFAULT_CAPABILITIES]
				: [],
			statusDetail: override?.quarantineDetail ?? undefined,
			source,
		})
	}

	for (const failure of input.diskFailures ?? []) {
		const detail = failure.issues
			.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
			.join("; ")
		quarantineEntry(
			failure.pluginId ?? `invalid.manifest.${entries.length}`,
			"disk",
			`manifest.json rejected (${failure.manifestPath}): ${detail}`,
		)
	}

	const panels = projectSidePanelsFromCatalog(
		descriptors,
		capabilityStates,
	).items
	const widgets = projectSessionWidgetsFromCatalog(
		descriptors,
		capabilityStates,
	).items
	const commands = projectCommandsFromCatalog(
		descriptors,
		capabilityStates,
	).items
	const themes = projectThemesFromCatalog(
		descriptors,
		capabilityStates,
	).items
	const components = projectComponentsFromCatalog(
		descriptors,
		capabilityStates,
	).items

	log.info("Built V2 plugin catalog", {
		appVersion,
		pluginCount: descriptors.length,
		pluginIds: descriptors.map((d) => d.normalizedId),
	})

	return {
		appVersion,
		descriptors,
		entries,
		capabilityStates,
		projections: { panels, widgets, commands, themes, components },
	}
}

/**
 * Render-friendly descriptor projection: the host can show "this
 * plugin contributes N panels / M widgets / K tools" without
 * shipping the full descriptor to the renderer.
 */
export interface PluginProjectionSummary {
	readonly pluginId: string
	readonly panelCount: number
	readonly widgetCount: number
	readonly commandCount: number
	readonly themeCount: number
	readonly toolCount: number
	readonly componentCount: number
}

export function summarizeProjection(catalog: PluginCatalog): readonly PluginProjectionSummary[] {
	return catalog.descriptors.map((descriptor) => {
		const projected = {
			panelCount: catalog.projections.panels.filter(
				(p) => p.pluginId === descriptor.normalizedId,
			).length,
			widgetCount: catalog.projections.widgets.filter(
				(w) => w.pluginId === descriptor.normalizedId,
			).length,
			commandCount: catalog.projections.commands.filter(
				(c) => c.pluginId === descriptor.normalizedId,
			).length,
			themeCount: catalog.projections.themes.filter(
				(t) => t.pluginId === descriptor.normalizedId,
			).length,
			toolCount: descriptor.tools.length,
			componentCount: catalog.projections.components.filter(
				(component) => component.pluginId === descriptor.normalizedId,
			).length,
		}
		return { pluginId: descriptor.normalizedId, ...projected }
	})
}

/**
 * Convenience: get one descriptor by normalized id. Returns `null`
 * when the plugin is unknown to the catalog (caller should usually
 * treat that as a `quarantined` result, not an error).
 */
export function findDescriptor(
	catalog: PluginCatalog,
	pluginId: string,
): PluginDescriptor | null {
	return catalog.descriptors.find((d) => d.normalizedId === pluginId) ?? null
}

/**
 * Convenience: get the capability state the renderer should read
 * for a plugin. Returns the catalog's default state when the
 * plugin is unknown so the renderer can render a "loading" row
 * instead of crashing.
 */
export function getCapabilityState(
	catalog: PluginCatalog,
	pluginId: string,
): CapabilityStateShape {
	return (
		catalog.capabilityStates[pluginId] ?? {
			...defaultCapabilityStateForId(pluginId),
		}
	)
}

function defaultCapabilityStateForId(pluginId: string): CapabilityStateShape {
	// We don't have a descriptor here; produce a minimal state with
	// `session` scope and no granted tokens. The renderer treats
	// this exactly like `defaultCapabilityState` would.
	return {
		trust: pluginId.startsWith("firefly.built-in.") ? "built-in" : "signed-third-party",
		sessionScope: "session",
		grantedTokens: [],
		loading: true,
		pluginDisabled: false,
		pluginQuarantined: false,
		pluginError: null,
	}
}

/**
 * Exported plugin id constants so callers (IPC handlers, the
 * renderer hook) can refer to a single typed name instead of a
 * raw string. Re-exported from the exemplar manifests.
 */
export const KNOWN_PLUGIN_IDS = {
	palotBridge: PALOT_BRIDGE_PLUGIN_ID,
	memorySurface: MEMORY_PLUGIN_ID,
	acmeNotebook: ACME_NOTEBOOK_PLUGIN_ID,
	browser: BROWSER_PLUGIN_ID,
	notes: NOTES_PLUGIN_ID,
	review: REVIEW_PLUGIN_ID,
	files: FILES_PLUGIN_ID,
	artifacts: ARTIFACTS_PLUGIN_ID,
	bridges: BRIDGES_PLUGIN_ID,
	pulse: PULSE_PLUGIN_ID,
	editor: EDITOR_PLUGIN_ID,
	terminal: TERMINAL_PLUGIN_ID,
	claude: CLAUDE_PLUGIN_ID,
	oracle: ORACLE_PLUGIN_ID,
	acmeComponents: ACME_COMPONENTS_PLUGIN_ID,
	devmuxToolbar: DEVMUX_TOOLBAR_PLUGIN_ID,
	voice: VOICE_PLUGIN_ID,
} as const
