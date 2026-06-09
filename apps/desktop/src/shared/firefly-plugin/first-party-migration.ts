/**
 * Firefly Plugin System V2 — First-party migration matrix
 *
 * Encodes the V2 plan's "first-party migration" matrix as source: for
 * every current first-party side panel / session widget / command /
 * theme in the desktop app, the matrix records:
 *   - current source file
 *   - target plugin id (or "host-only" exception with written rationale)
 *   - target contribution family
 *   - target tool surface
 *   - required capabilities
 *   - rollout phase
 *   - teardown behavior when the owning plugin is disabled or
 *     uninstalled while the surface is active
 *
 * The matrix is append-only. New rows land via new built-in plugin
 * manifests in `palot-bridge-manifest.ts` and friends; this file is
 * the canonical reference so the operator UI, the catalog loader,
 * and the migration tooling all consult the same source of truth.
 */

import type { CapabilityToken, PluginId, TrustTier } from "./manifest"

/**
 * Rollout phase for a migrated surface. Phases are ordered; later
 * phases may build on earlier ones but the order itself is locked
 * by the V2 plan's roadmap.
 */
export const ROLLOUT_PHASES = [
	"phase-1",
	"phase-2",
	"phase-3",
	"phase-4",
	"defer",
] as const
export type RolloutPhase = (typeof ROLLOUT_PHASES)[number]

/**
 * Built-in plugin owner for a migrated surface. The `host-only`
 * disposition is reserved for surfaces that cannot meaningfully
 * become plugins (e.g. host-internal Chrome).
 */
export type MigrationOwner =
	| { kind: "built-in-plugin"; pluginId: PluginId }
	| { kind: "host-only"; rationale: string }

/**
 * Teardown behavior. The host walks these rules when the owning
 * plugin is disabled or uninstalled while the surface is active.
 */
export const TEARDOWN_BEHAVIORS = [
	"close-surface",
	"dismiss-widget",
	"deregister-command",
	"cancel-in-flight-tool",
	"preserve-state",
] as const
export type TeardownBehavior = (typeof TEARDOWN_BEHAVIORS)[number]

export interface FirstPartyMigrationRow {
	readonly currentId: string
	readonly currentFile: string
	readonly currentFamily: "panel" | "widget" | "command" | "theme"
	readonly owner: MigrationOwner
	readonly targetFamily: "panels" | "widgets" | "commands" | "themes" | "tools"
	readonly targetToolId: string | null
	readonly requiredCapabilities: readonly CapabilityToken[]
	readonly trust: TrustTier
	readonly rolloutPhase: RolloutPhase
	readonly teardown: readonly TeardownBehavior[]
	readonly notes: string
}

/**
 * The full first-party migration matrix. The IDs and current files
 * here are anchored to the live repo at plan time
 * (`apps/desktop/src/renderer/firefly-surface-registry.tsx`,
 * `session-widget-registry.tsx`, `command-palette.tsx`,
 * `lib/themes.ts`).
 *
 * Append-only: never remove a row. Mark rows as `host-only` if the
 * surface cannot meaningfully become a plugin.
 */
export const FIRST_PARTY_MIGRATION_MATRIX: readonly FirstPartyMigrationRow[] = [
	{
		currentId: "review",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.review" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.review.run",
		requiredCapabilities: ["host:panel.register", "host:command.register", "host:tool.register"],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["close-surface", "dismiss-widget", "cancel-in-flight-tool"],
		notes: "Review surface owns the changes panel; pairs with the git diff IPC bridge.",
	},
	{
		currentId: "browser",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.browser" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.browser.open",
		requiredCapabilities: [
			"host:panel.register",
			"host:browser.lane-control",
			"host:tool.register",
		],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["close-surface", "cancel-in-flight-tool", "deregister-command"],
		notes: "Browser surface is gated by the palot-bridge v2 manifest; the browser plugin re-exports the lane tools.",
	},
	{
		currentId: "notes",
		currentFile: "apps/desktop/plugins/notes/manifest.ts",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.notes" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.notes.open",
		requiredCapabilities: ["host:panel.register", "host:command.register"],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["close-surface", "dismiss-widget"],
		notes: "MIGRATED (slice 1, 2026-06-09): Notes is served from the plugin catalog; its registry row and feature-flag atom are deleted. No in-flight tool calls to cancel.",
	},
	{
		currentId: "pulse",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.pulse" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.pulse.open",
		requiredCapabilities: ["host:panel.register"],
		trust: "built-in",
		rolloutPhase: "phase-2",
		teardown: ["close-surface"],
		notes: "Pulse surface is a low-traffic observability pane; migrated in phase 2 to give the telemetry namespace a stable home.",
	},
	{
		currentId: "artifacts",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.artifacts" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.artifacts.open",
		requiredCapabilities: ["host:panel.register", "host:widget.register", "host:command.register"],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["close-surface", "dismiss-widget"],
		notes: "Artifacts surface is paired with the genui-artifacts widget zone.",
	},
	{
		currentId: "memory",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.memory" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.memory.open",
		requiredCapabilities: ["host:panel.register"],
		trust: "built-in",
		rolloutPhase: "phase-2",
		teardown: ["close-surface"],
		notes: "Memory surface is feature-flagged; migration path mirrors the review surface shape.",
	},
	{
		currentId: "files",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.files" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.files.open",
		requiredCapabilities: ["host:panel.register", "host:command.register"],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["close-surface", "dismiss-widget"],
		notes: "Files surface is a thin wrapper over the project file tree; migration is mechanical.",
	},
	{
		currentId: "terminal",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.terminal" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.terminal.open",
		requiredCapabilities: ["host:panel.register", "host:command.register"],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["close-surface", "cancel-in-flight-tool"],
		notes: "Terminal surface may have in-flight shell sessions; teardown must cancel them.",
	},
	{
		currentId: "editor",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.editor" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.editor.open",
		requiredCapabilities: ["host:panel.register"],
		trust: "built-in",
		rolloutPhase: "phase-2",
		teardown: ["close-surface"],
		notes: "Editor surface shares scrollback with the bridge; migration includes the deeplink command.",
	},
	{
		currentId: "plugins",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "host-only", rationale: "the plugins panel is the operator UI for the V2 catalog itself; it cannot be a plugin without a self-reference loop" },
		targetFamily: "panels",
		targetToolId: null,
		requiredCapabilities: [],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["close-surface"],
		notes: "Host-only exception. The plugins panel reads from the V2 catalog store directly; making it a plugin would require the catalog to load itself.",
	},
	{
		currentId: "bridges",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.bridges" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.bridges.open",
		requiredCapabilities: ["host:panel.register", "host:bridge.session-read"],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["close-surface"],
		notes: "Bridges surface is a thin layer over the bridge registry; pairs with the V2 introspection tools.",
	},
	{
		currentId: "crm",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.crm" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.crm.open",
		requiredCapabilities: ["host:panel.register"],
		trust: "built-in",
		rolloutPhase: "phase-2",
		teardown: ["close-surface"],
		notes: "CRM surface is feature-flagged; migration brings it onto the V2 storage scopes.",
	},
	{
		currentId: "studio",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.studio" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.studio.open",
		requiredCapabilities: ["host:panel.register", "host:command.register"],
		trust: "built-in",
		rolloutPhase: "phase-3",
		teardown: ["close-surface"],
		notes: "Studio surface ships in phase 3 to give the iframe escape-hatch policy time to mature.",
	},
	{
		currentId: "voice",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.voice" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.voice.open",
		requiredCapabilities: ["host:panel.register"],
		trust: "built-in",
		rolloutPhase: "phase-3",
		teardown: ["close-surface"],
		notes: "Voice surface depends on a not-yet-finalized audio capture capability; deferred to phase 3.",
	},
	{
		currentId: "oracle",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.oracle" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.oracle.open",
		requiredCapabilities: ["host:panel.register"],
		trust: "built-in",
		rolloutPhase: "phase-3",
		teardown: ["close-surface"],
		notes: "Oracle roster surface depends on agent roster; phase 3 to land with the roster contract.",
	},
	{
		currentId: "claude",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.claude" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.claude.open",
		requiredCapabilities: ["host:panel.register"],
		trust: "built-in",
		rolloutPhase: "phase-3",
		teardown: ["close-surface"],
		notes: "Claude Code surface is a parity surface; phase 3 to land alongside the V2 migration tooling.",
	},
	{
		currentId: "ch5pm",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.ch5pm" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.ch5pm.open",
		requiredCapabilities: ["host:panel.register"],
		trust: "built-in",
		rolloutPhase: "phase-3",
		teardown: ["close-surface"],
		notes: "CH5PM dashboard surface is feature-flagged; phase 3.",
	},
	{
		currentId: "pdf-review",
		currentFile: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.surface.pdf-review" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.surface.pdf-review.open",
		requiredCapabilities: ["host:panel.register"],
		trust: "built-in",
		rolloutPhase: "phase-2",
		teardown: ["close-surface", "cancel-in-flight-tool"],
		notes: "PDF review surface has in-flight tool calls (locator dispatch); teardown must cancel them.",
	},
	{
		currentId: "session-task-list",
		currentFile: "apps/desktop/src/renderer/session-widget-registry.tsx",
		currentFamily: "widget",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.widget.tasks" },
		targetFamily: "widgets",
		targetToolId: null,
		requiredCapabilities: ["host:widget.register"],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["dismiss-widget", "preserve-state"],
		notes: "Tasks widget persists layout to elf:session-widget-layouts.",
	},
	{
		currentId: "genui-artifacts",
		currentFile: "apps/desktop/src/renderer/session-widget-registry.tsx",
		currentFamily: "widget",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.widget.genui-artifacts" },
		targetFamily: "widgets",
		targetToolId: null,
		requiredCapabilities: ["host:widget.register"],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["dismiss-widget", "preserve-state"],
		notes: "GenUI artifacts widget is zoned to chat-inline-right.",
	},
	{
		currentId: "default",
		currentFile: "apps/desktop/src/renderer/lib/themes.ts",
		currentFamily: "theme",
		owner: { kind: "host-only", rationale: "bundled default theme is a host fallback; the theme pipeline always includes it regardless of plugin state" },
		targetFamily: "themes",
		targetToolId: null,
		requiredCapabilities: [],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["preserve-state"],
		notes: "Bundled default is host-owned; theme pipeline ranks it at the bottom of the precedence matrix.",
	},
	{
		currentId: "cortex",
		currentFile: "apps/desktop/src/renderer/lib/themes.ts",
		currentFamily: "theme",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.theme.cortex" },
		targetFamily: "themes",
		targetToolId: null,
		requiredCapabilities: ["host:theme.register"],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["preserve-state"],
		notes: "Cortex theme is a built-in plugin contribution; preview/apply semantics stay host-owned.",
	},
	{
		currentId: "liquid-glass",
		currentFile: "apps/desktop/src/renderer/lib/themes.ts",
		currentFamily: "theme",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.theme.liquid-glass" },
		targetFamily: "themes",
		targetToolId: null,
		requiredCapabilities: ["host:theme.register"],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["preserve-state"],
		notes: "Liquid Glass theme is darwin-only; the contribution declares platforms.",
	},
	{
		currentId: "chat",
		currentFile: "apps/desktop/src/renderer/components/session-view.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.main-pane.chat" },
		targetFamily: "panels",
		targetToolId: null,
		requiredCapabilities: ["host:panel.register", "host:command.register"],
		trust: "built-in",
		rolloutPhase: "phase-4",
		teardown: ["close-surface", "preserve-state"],
		notes: "Main-pane surface (formFactor: main-pane). The product's core chat loop migrates LAST — only after the side-panel tier has proven the platform on 20+ surfaces.",
	},
	{
		currentId: "project-manager",
		currentFile: "apps/desktop/src/renderer/components/project-manager.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.main-pane.project-manager" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.main-pane.project-manager.open",
		requiredCapabilities: ["host:panel.register", "host:command.register"],
		trust: "built-in",
		rolloutPhase: "phase-3",
		teardown: ["close-surface", "preserve-state"],
		notes: "Main-pane surface (formFactor: main-pane). PM dashboard route (/project-manager); phase 3 alongside the other main-pane candidates.",
	},
	{
		currentId: "automations",
		currentFile: "apps/desktop/src/renderer/components/automations/automations-page.tsx",
		currentFamily: "panel",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.main-pane.automations" },
		targetFamily: "panels",
		targetToolId: "plugin.firefly.built-in.main-pane.automations.open",
		requiredCapabilities: ["host:panel.register", "host:command.register"],
		trust: "built-in",
		rolloutPhase: "phase-3",
		teardown: ["close-surface", "preserve-state"],
		notes: "Main-pane surface (formFactor: main-pane). Automations routes (/automations + detail/runs); phase 3.",
	},
	{
		currentId: "settings",
		currentFile: "apps/desktop/src/renderer/components/settings",
		currentFamily: "panel",
		owner: {
			kind: "host-only",
			rationale:
				"the settings SHELL hosts plugin and permission UX (same self-reference class as the plugins panel); individual settings sections become plugin contributions later via a contributes.settings family",
		},
		targetFamily: "panels",
		targetToolId: null,
		requiredCapabilities: [],
		trust: "built-in",
		rolloutPhase: "defer",
		teardown: ["close-surface"],
		notes: "Host-only exception (main-pane). The shell stays host-owned; a future contributes.settings family lets plugins contribute sections.",
	},
	{
		currentId: "palot-bridge",
		currentFile: "apps/desktop/src/main/palot-plugin/plugin.js",
		currentFamily: "command",
		owner: { kind: "built-in-plugin", pluginId: "firefly.built-in.palot-bridge" },
		targetFamily: "tools",
		targetToolId: "plugin.firefly.built-in.palot-bridge.open_side_panel",
		requiredCapabilities: [
			"host:bridge.session-read",
			"host:bridge.ui-state-write",
			"host:tool.register",
		],
		trust: "built-in",
		rolloutPhase: "phase-1",
		teardown: ["deregister-command", "cancel-in-flight-tool"],
		notes: "Palot bridge exemplar: 13 tools (7 browser + 2 side panel + 4 connected-app discovery). First-party exemplar for Task 21.",
	},
] as const satisfies readonly FirstPartyMigrationRow[]

/**
 * Group migration rows by their rollout phase. The roadmap consults
 * the result directly to decide which phases are still pending.
 */
export function groupFirstPartyMigrationByPhase(): Readonly<Record<RolloutPhase, readonly FirstPartyMigrationRow[]>> {
	const out: Record<RolloutPhase, FirstPartyMigrationRow[]> = {
		"phase-1": [],
		"phase-2": [],
		"phase-3": [],
		"phase-4": [],
		defer: [],
	}
	for (const row of FIRST_PARTY_MIGRATION_MATRIX) {
		out[row.rolloutPhase].push(row)
	}
	return out
}

/** Thrown when a currentId matches rows in more than one family and no family was given. */
export class AmbiguousMigrationRowError extends Error {
	constructor(currentId: string, families: readonly string[]) {
		super(
			`migration row lookup for "${currentId}" is ambiguous across families [${families.join(", ")}]; pass currentFamily to disambiguate`,
		)
		this.name = "AmbiguousMigrationRowError"
	}
}

/**
 * Look up the migration row for a current surface id. Returns `null`
 * when the surface is not in the matrix (e.g. a third-party extension
 * added it).
 *
 * Fail-fast on ambiguity: if the id matches rows in MORE than one
 * family and no `currentFamily` filter was given, this throws instead
 * of silently returning the first match (the old first-match behavior
 * masked the doubled `browser` row bug).
 */
export function findFirstPartyMigrationRow(
	currentId: string,
	currentFamily?: FirstPartyMigrationRow["currentFamily"],
): FirstPartyMigrationRow | null {
	const matches = FIRST_PARTY_MIGRATION_MATRIX.filter(
		(row) => row.currentId === currentId && (currentFamily === undefined || row.currentFamily === currentFamily),
	)
	if (matches.length === 0) return null
	const families = [...new Set(matches.map((row) => row.currentFamily))]
	if (families.length > 1) {
		throw new AmbiguousMigrationRowError(currentId, families)
	}
	return matches[0] ?? null
}

/**
 * Iterate every row whose owner is a built-in plugin id. The operator
 * UI uses this to know which plugin ids are "owned" by a current
 * surface, and the catalog loader uses it to reject duplicate
 * registrations.
 */
export function builtInPluginIdsInMatrix(): readonly PluginId[] {
	const ids = new Set<PluginId>()
	for (const row of FIRST_PARTY_MIGRATION_MATRIX) {
		if (row.owner.kind === "built-in-plugin") ids.add(row.owner.pluginId)
	}
	return [...ids].sort()
}

/**
 * The set of host-only exceptions with their rationales. Surfaced
 * in the operator UI so reviewers can see WHY a surface is exempt.
 */
export function hostOnlyExceptions(): readonly { currentId: string; rationale: string }[] {
	return FIRST_PARTY_MIGRATION_MATRIX.filter(
		(row): row is FirstPartyMigrationRow & { owner: { kind: "host-only"; rationale: string } } =>
			row.owner.kind === "host-only",
	).map((row) => ({ currentId: row.currentId, rationale: row.owner.rationale }))
}
