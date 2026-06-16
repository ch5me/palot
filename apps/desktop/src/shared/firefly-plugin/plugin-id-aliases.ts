/**
 * Firefly Plugin System V2 — Plugin identity alias map
 *
 * Canonical identity is `namespace.name` (§4 of the marketplace design doc,
 * 2026-06-16). Built-ins are migrating from the old reverse-DNS form
 * (`firefly.built-in.surface.memory`) to the canonical two-segment form
 * (`firefly.memory`). This file is the single source of truth for that
 * transition.
 *
 * During migration:
 *   - Manifests declare the NEW canonical id.
 *   - This file provides the old reverse-DNS id as an alias so any code
 *     that still holds the old string can resolve to the canonical entry.
 *   - Drop aliases from this file once the surface migration settles and
 *     no external store / serialised state can still carry the old id.
 *
 * Usage:
 *   - `resolveCanonicalPluginId(id)` — resolve any alias to its canonical id;
 *     returns the input unchanged when no alias exists (i.e. it is already
 *     canonical or unknown).
 *   - `PLUGIN_ID_CANONICAL_TO_ALIASES` — reverse map from canonical id to the
 *     set of legacy aliases (for migration tooling, linting, etc.).
 */

/**
 * Map from legacy reverse-DNS plugin id → canonical `namespace.name` id.
 *
 * ALL built-in + exemplar ids are listed here for completeness. The acme
 * exemplars are already in `namespace.name` form and therefore have no legacy
 * alias entry.
 */
export const PLUGIN_ID_ALIASES: Readonly<Record<string, string>> = {
	// ── palot-bridge ────────────────────────────────────────────────────────
	"firefly.built-in.palot-bridge": "firefly.palot-bridge",

	// ── surface panels (reverse-DNS → namespace.name) ────────────────────────
	"firefly.built-in.surface.memory": "firefly.memory",
	"firefly.built-in.surface.browser": "firefly.browser",
	"firefly.built-in.surface.notes": "firefly.notes",
	"firefly.built-in.surface.review": "firefly.review",
	"firefly.built-in.surface.files": "firefly.files",
	"firefly.built-in.surface.artifacts": "firefly.artifacts",
	"firefly.built-in.surface.bridges": "firefly.bridges",
	"firefly.built-in.surface.pulse": "firefly.pulse",
	"firefly.built-in.surface.editor": "firefly.editor",
	"firefly.built-in.surface.terminal": "firefly.terminal",
	"firefly.built-in.surface.claude": "firefly.claude",
	"firefly.built-in.surface.oracle": "firefly.oracle",
	"firefly.built-in.surface.voice": "firefly.voice",
	"firefly.built-in.surface.studio": "firefly.studio",
	"firefly.built-in.surface.ch5pm": "firefly.ch5pm",
	"firefly.built-in.surface.pdf-review": "firefly.pdf-review",
	"firefly.built-in.surface.crm": "firefly.crm",

	// ── devmux-toolbar (was already 3-segment, not surface-prefixed) ─────────
	"firefly.built-in.devmux-toolbar": "firefly.devmux-toolbar",
} as const

/**
 * Reverse map: canonical `namespace.name` id → list of legacy alias strings.
 * Useful for migration tooling to detect stale ids in serialised state.
 */
export const PLUGIN_ID_CANONICAL_TO_ALIASES: Readonly<Record<string, readonly string[]>> =
	Object.entries(PLUGIN_ID_ALIASES).reduce<Record<string, string[]>>((acc, [alias, canonical]) => {
		if (!acc[canonical]) acc[canonical] = []
		acc[canonical]!.push(alias)
		return acc
	}, {})

/**
 * Resolve any plugin id (canonical or legacy alias) to its canonical
 * `namespace.name` form. Returns the input unchanged when no alias mapping
 * exists (i.e. it is already canonical or it is an unknown third-party id).
 *
 * @example
 * resolveCanonicalPluginId("firefly.built-in.surface.memory") // → "firefly.memory"
 * resolveCanonicalPluginId("firefly.memory")                  // → "firefly.memory"
 * resolveCanonicalPluginId("acme.acme-notebook")              // → "acme.acme-notebook"
 */
export function resolveCanonicalPluginId(id: string): string {
	return PLUGIN_ID_ALIASES[id] ?? id
}

/**
 * True when `id` is a known legacy alias (i.e. should be migrated).
 */
export function isLegacyPluginId(id: string): boolean {
	return Object.prototype.hasOwnProperty.call(PLUGIN_ID_ALIASES, id)
}

/**
 * All known canonical plugin ids (built-in + exemplar set).
 * Does NOT include third-party ids discovered at runtime.
 */
export const ALL_CANONICAL_PLUGIN_IDS = [
	"firefly.palot-bridge",
	"firefly.memory",
	"firefly.browser",
	"firefly.notes",
	"firefly.review",
	"firefly.files",
	"firefly.artifacts",
	"firefly.bridges",
	"firefly.pulse",
	"firefly.editor",
	"firefly.terminal",
	"firefly.claude",
	"firefly.oracle",
	"firefly.voice",
	"firefly.studio",
	"firefly.ch5pm",
	"firefly.pdf-review",
	"firefly.crm",
	"firefly.devmux-toolbar",
	// acme exemplars (already canonical)
	"acme.acme-notebook",
	"acme.components-showcase",
] as const

export type CanonicalPluginId = (typeof ALL_CANONICAL_PLUGIN_IDS)[number]
