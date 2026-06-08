/**
 * Firefly Plugin System V2 — Theme contribution pipeline and precedence model
 *
 * Themes are a host-owned, data-only family. This module encodes the pure
 * pipeline the host runs to decide which theme is currently applied and
 * which one (if any) the UI should render in a preview pane. The helpers
 * here are deterministic and side-effect free — they never mutate the
 * applied theme when answering a `plugin.theme.preview` request, and they
 * never load VS Code / Open VSX code paths at runtime.
 *
 * Locked precedence matrix (rank descending; higher rank wins):
 *
 *   1. user-pick       — explicit user selection in the operator UI
 *   2. active plugin   — a theme contributed by an active, loaded plugin
 *   3. imported        — a VS Code / Open VSX import that has been
 *                        converted into a V2 theme contribution at the
 *                        catalog loader
 *   4. bundled default — the host's own fallback theme
 *
 *   preview is a *side channel*: it can only be rendered in a preview
 *   pane; it MUST NOT mutate the currently-applied theme.
 *
 * Import stance (bounded):
 *
 *   - VS Code themes and Open VSX themes are converted into V2 theme
 *     contributions at the catalog-loader boundary. The runtime never
 *     imports vscode-specific modules; the only thing the pipeline
 *     consumes from the manifest is the same `ThemeContribution`
 *     envelope used by plugin-authored themes.
 *   - There is no runtime shim and no vscode-runtime dependency in the
 *     pipeline itself. The contract is what we promise; the loader is
 *     the implementation.
 *
 * Fallback rule:
 *
 *   When a previously-applied theme becomes unavailable (plugin
 *   uninstalled, plugin disabled, import removed), the pipeline walks
 *   the matrix in the locked order to find the next valid candidate.
 *   The bundled default is always the terminal fallback; the chain
 *   never returns "no theme".
 */

import type { PluginDescriptor } from "./descriptor"
import type { ProjectedTheme } from "./renderer-projection"

// ---------------------------------------------------------------------------
// Source kinds
// ---------------------------------------------------------------------------

/**
 * Origin of a theme in the candidate set. The rank of a source kind is
 * encoded in `THEME_PRECEDENCE_RANKS` and is the single source of truth
 * for the precedence matrix — every helper consults it.
 */
export const THEME_SOURCE_KINDS = [
	"user-pick",
	"active-plugin",
	"imported",
	"bundled",
	"preview",
] as const
export type ThemeSourceKind = (typeof THEME_SOURCE_KINDS)[number]

/**
 * Locked rank per source kind. Lower number = higher precedence. The
 * `preview` row is intentionally outside the applied chain (rank 99) —
 * it is a side channel and never participates in winner resolution.
 */
export const THEME_PRECEDENCE_RANKS: Readonly<Record<ThemeSourceKind, number>> = {
	"user-pick": 1,
	"active-plugin": 2,
	imported: 3,
	bundled: 4,
	preview: 99,
}

/**
 * Canonical placeholder id the preview pane renders when a `plugin.theme.preview`
 * request targets a theme that is not in the candidate set. Distinct from
 * `state.bundledDefaultId` so the preview pane always shows a stable
 * fallback regardless of which theme the user has applied.
 */
export const THEME_PREVIEW_PLACEHOLDER_ID = "default"

/**
 * Locked precedence matrix. Each row documents the canonical answer
 * for one source kind: who wins, how the host applies it, what the
 * user observes, and the canonical reason string the host emits in
 * logs / the operator UI.
 *
 * Downstream code MUST treat this as the contract. New rows may be
 * appended; existing rows are append-only.
 */
export interface ThemePrecedenceRow {
	readonly source: ThemeSourceKind
	readonly rank: number
	readonly winner: string
	readonly applyPath: string
	readonly userObservable: string
	readonly canonicalReason: string
	readonly participatesInAppliedChain: boolean
}

export const THEME_PRECEDENCE_MATRIX: Readonly<Record<ThemeSourceKind, ThemePrecedenceRow>> = {
	"user-pick": {
		source: "user-pick",
		rank: 1,
		winner: "user-pick",
		applyPath: "host theme-apply (CSS class + CSS vars) without prompt",
		userObservable: "the picked theme is applied to <html>; preview is ignored",
		canonicalReason: "user pick overrides every other source",
		participatesInAppliedChain: true,
	},
	"active-plugin": {
		source: "active-plugin",
		rank: 2,
		winner: "user-pick (if present) — else the first active plugin theme by descriptor order",
		applyPath: "host theme-apply using the projected plugin theme envelope",
		userObservable: "plugin theme is applied when no user pick is set",
		canonicalReason: "active plugin theme wins when no user pick is present",
		participatesInAppliedChain: true,
	},
	imported: {
		source: "imported",
		rank: 3,
		winner:
			"user-pick → active-plugin — else the first imported (VS Code / Open VSX → V2) theme by import order",
		applyPath:
			"host theme-apply using the converted V2 theme envelope produced at the catalog loader",
		userObservable:
			"imported theme is applied when no user pick and no active plugin theme are present",
		canonicalReason: "imported theme wins when no user pick and no active plugin theme are present",
		participatesInAppliedChain: true,
	},
	bundled: {
		source: "bundled",
		rank: 4,
		winner: "bundled default — terminal fallback",
		applyPath: "host theme-apply using the bundled default theme",
		userObservable: "bundled default is the floor; reached only when no other source contributes",
		canonicalReason: "bundled default is reached only when no other source contributes",
		participatesInAppliedChain: true,
	},
	preview: {
		source: "preview",
		rank: 99,
		winner: "preview is a side channel; it never wins the applied chain",
		applyPath: "preview pane render only — applied theme is untouched",
		userObservable: "preview pane shows the requested theme; applied theme is unchanged",
		canonicalReason: "preview never mutates the applied theme",
		participatesInAppliedChain: false,
	},
}

/**
 * Sources that participate in resolving the currently applied theme.
 * The locked order is the precedence chain; downstream helpers iterate
 * it to pick the first valid candidate.
 */
export const APPLIED_CHAIN_SOURCES: ReadonlyArray<ThemeSourceKind> = [
	"user-pick",
	"active-plugin",
	"imported",
	"bundled",
]

// ---------------------------------------------------------------------------
// Pipeline state shape
// ---------------------------------------------------------------------------

/**
 * A theme candidate the pipeline knows about. Each candidate carries
 * the minimal data the host needs to display it in the operator UI
 * and to apply it: a globally-unique projected id, a human label, the
 * source kind, the contributing plugin id (when applicable), and the
 * optional import provenance (when the candidate was converted from
 * VS Code / Open VSX at the catalog loader).
 */
export interface ThemeCandidate {
	readonly projectedId: string
	readonly label: string
	readonly source: ThemeSourceKind
	readonly pluginId: string | null
	readonly importSource: "vscode-theme" | "open-vsx" | null
	readonly rank: number
	readonly participatesInAppliedChain: boolean
}

/**
 * The pipeline's view of the world. Callers (catalog loader, host
 * apply path, preview pane, fallback handler) populate it from
 * authoritative state and hand it to the pure helpers below.
 *
 * The pipeline does NOT inspect `window.elf`, `localStorage`, or any
 * transport — those concerns live in the host wiring. The pipeline
 * receives plain data and returns plain data.
 */
export interface ThemePipelineState {
	/**
	 * Theme id the user has explicitly picked in the operator UI, or
	 * `null` when no user pick is recorded. The id is matched against
	 * `candidates[*].projectedId`.
	 */
	readonly userPick: string | null
	/**
	 * Themes contributed by currently-active, loaded plugins. Already
	 * projected (caller has run `projectThemesFromCatalog`).
	 */
	readonly activePluginThemes: readonly ProjectedTheme[]
	/**
	 * Themes converted from VS Code / Open VSX imports at the catalog
	 * loader. Each entry is a normal `ProjectedTheme` with `imports`
	 * populated in its envelope.
	 */
	readonly importedThemes: readonly ProjectedTheme[]
	/**
	 * Host's bundled default theme id. Always present and always
	 * resolvable; the pipeline never returns "no theme".
	 */
	readonly bundledDefaultId: string
	/**
	 * Theme id the host currently has applied. Used by the fallback
	 * helper to detect "previously-applied theme became unavailable".
	 * The caller is responsible for keeping this in sync with the
	 * actual DOM state — the pipeline never reads the DOM.
	 */
	readonly previouslyAppliedThemeId: string | null
}

/**
 * Result of resolving the currently-applied theme from the state.
 * `appliedThemeId` is the id the host should apply; `reason` is the
 * canonical reason string the operator UI can render directly.
 */
export interface ThemeResolution {
	readonly appliedThemeId: string
	readonly source: ThemeSourceKind
	readonly rank: number
	readonly reason: string
	readonly winner: ThemeCandidate
	readonly previewThemeId: string | null
	readonly previewedCandidate: ThemeCandidate | null
	/**
	 * `true` when the user had an explicit pick but the pick did not
	 * resolve to any real candidate and the resolver fell through to a
	 * lower row. The host UI uses this to emit the
	 * "Picked theme `<id>` is no longer available" notice. The
	 * `themeAtom` is NOT rewritten by the resolver — that is the
	 * host's job (`plugin.theme.reset` is the explicit user escape
	 * hatch).
	 */
	readonly fellBackFromUserPick: boolean
}

/**
 * A preview request. Mirrors the args shape registered for
 * `plugin.theme.preview` in `tool-projection.ts`. The pipeline accepts
 * the same payload and never mutates the applied state.
 */
export interface ThemePreviewRequest {
	readonly themeId: string
}

/**
 * Result of evaluating a `plugin.theme.preview` request. The
 * `previewThemeId` is what the UI should render in the preview pane;
 * the `appliedThemeId` is what the host should KEEP applied.
 */
export interface ThemePreviewResolution {
	readonly appliedThemeId: string
	readonly previewThemeId: string
	readonly previewedCandidate: ThemeCandidate
	readonly reason: string
}

/**
 * Result of the fallback computation. The chain lists the candidates
 * the host should consider, in locked precedence order, when a
 * previously-applied theme becomes unavailable. The chain always ends
 * with the bundled default.
 */
export interface ThemeFallbackChain {
	readonly previouslyAppliedThemeId: string | null
	readonly previouslyAppliedSource: ThemeSourceKind | null
	readonly chain: readonly ThemeCandidate[]
	readonly resolvedThemeId: string
	readonly resolvedSource: ThemeSourceKind
	readonly reason: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function cloneProjectedTheme(theme: ProjectedTheme): ThemeCandidate {
	return {
		projectedId: theme.projectedId,
		label: theme.label,
		source: "active-plugin",
		pluginId: theme.pluginId,
		importSource: null,
		rank: THEME_PRECEDENCE_RANKS["active-plugin"],
		participatesInAppliedChain: true,
	}
}

function cloneImportedTheme(theme: ProjectedTheme): ThemeCandidate {
	return {
		projectedId: theme.projectedId,
		label: theme.label,
		source: "imported",
		pluginId: theme.pluginId,
		importSource: theme.envelope.imports?.source ?? null,
		rank: THEME_PRECEDENCE_RANKS.imported,
		participatesInAppliedChain: true,
	}
}

function buildBundledCandidate(bundledDefaultId: string): ThemeCandidate {
	return {
		projectedId: bundledDefaultId,
		label: bundledDefaultId,
		source: "bundled",
		pluginId: null,
		importSource: null,
		rank: THEME_PRECEDENCE_RANKS.bundled,
		participatesInAppliedChain: true,
	}
}

function buildUserPickCandidate(userPick: string): ThemeCandidate {
	return {
		projectedId: userPick,
		label: userPick,
		source: "user-pick",
		pluginId: null,
		importSource: null,
		rank: THEME_PRECEDENCE_RANKS["user-pick"],
		participatesInAppliedChain: true,
	}
}

function buildPreviewCandidate(themeId: string): ThemeCandidate {
	return {
		projectedId: themeId,
		label: themeId,
		source: "preview",
		pluginId: null,
		importSource: null,
		rank: THEME_PRECEDENCE_RANKS.preview,
		participatesInAppliedChain: false,
	}
}

// ---------------------------------------------------------------------------
// Candidate enumeration
// ---------------------------------------------------------------------------

/**
 * Enumerate every theme candidate the pipeline knows about, grouped
 * by source kind and sorted by locked precedence rank (ascending).
 * The bundled default is always included even when no other source
 * contributes — the pipeline never returns an empty set.
 *
 * The result is a flat array, not a grouped record, so callers can
 * pass it directly to the operator UI.
 */
export function enumerateThemeCandidates(state: ThemePipelineState): readonly ThemeCandidate[] {
	const items: ThemeCandidate[] = []
	if (state.userPick) {
		items.push(buildUserPickCandidate(state.userPick))
	}
	for (const theme of state.activePluginThemes) {
		items.push(cloneProjectedTheme(theme))
	}
	for (const theme of state.importedThemes) {
		items.push(cloneImportedTheme(theme))
	}
	items.push(buildBundledCandidate(state.bundledDefaultId))
	return [...items].sort((a, b) => a.rank - b.rank)
}

/**
 * Variant of `enumerateThemeCandidates` that returns one row per
 * source kind, in the locked precedence order. Useful for tests and
 * for the "precedence matrix" tab in the operator UI.
 */
export function enumerateThemeCandidatesBySource(
	state: ThemePipelineState,
): Readonly<Record<ThemeSourceKind, readonly ThemeCandidate[]>> {
	return {
		"user-pick": state.userPick ? [buildUserPickCandidate(state.userPick)] : [],
		"active-plugin": state.activePluginThemes.map(cloneProjectedTheme),
		imported: state.importedThemes.map(cloneImportedTheme),
		bundled: [buildBundledCandidate(state.bundledDefaultId)],
		preview: [],
	}
}

// ---------------------------------------------------------------------------
// Applied theme resolution
// ---------------------------------------------------------------------------

function findCandidateById(
	candidates: readonly ThemeCandidate[],
	projectedId: string,
): ThemeCandidate | null {
	for (const candidate of candidates) {
		if (candidate.projectedId === projectedId) return candidate
	}
	return null
}

/**
 * Resolve the currently applied theme from the pipeline state. The
 * helper iterates the locked chain in `APPLIED_CHAIN_SOURCES` order
 * and returns the first valid candidate. The bundled default is
 * always reachable because `enumerateThemeCandidates` always
 * includes it.
 *
 * A user-pick is honoured only when it matches an existing candidate
 * (plugin, import, or bundled). A user-pick that points at a
 * previously-applied, now-missing theme falls through to the next
 * row — that is the fallback path.
 */
export function resolveAppliedTheme(state: ThemePipelineState): ThemeResolution {
	const candidates = enumerateThemeCandidates(state)
	const hadUserPick = state.userPick !== null && state.userPick.length > 0
	for (const source of APPLIED_CHAIN_SOURCES) {
		const row = THEME_PRECEDENCE_MATRIX[source]
		const winner = pickFirstForSource(candidates, source, state)
		if (winner) {
			const fellBack = hadUserPick && source !== "user-pick"
			const displayWinner =
				source === "user-pick"
					? {
							...winner,
							source: "user-pick" as ThemeSourceKind,
							label: state.userPick ?? winner.label,
							rank: THEME_PRECEDENCE_RANKS["user-pick"],
						}
					: winner
			return {
				appliedThemeId: displayWinner.projectedId,
				source,
				rank: row.rank,
				reason: row.canonicalReason,
				winner: displayWinner,
				previewThemeId: null,
				previewedCandidate: null,
				fellBackFromUserPick: fellBack,
			}
		}
	}
	// Unreachable: bundled is always in the candidate set. Keep the
	// contract explicit so downstream code does not have to special-case
	// a null theme.
	const bundled = buildBundledCandidate(state.bundledDefaultId)
	return {
		appliedThemeId: bundled.projectedId,
		source: "bundled",
		rank: THEME_PRECEDENCE_MATRIX.bundled.rank,
		reason: THEME_PRECEDENCE_MATRIX.bundled.canonicalReason,
		winner: bundled,
		previewThemeId: null,
		previewedCandidate: null,
		fellBackFromUserPick: hadUserPick,
	}
}

function pickFirstForSource(
	candidates: readonly ThemeCandidate[],
	source: ThemeSourceKind,
	state: ThemePipelineState,
): ThemeCandidate | null {
	switch (source) {
		case "user-pick": {
			// The user-pick row wins only when the pick matches a REAL
			// candidate (active-plugin, imported, or bundled). A pick
			// that points at a now-missing contribution falls through to
			// the next row — that is the V2 fallback path. The user-pick
			// placeholder candidate (added by `enumerateThemeCandidates`
			// for UI display) is intentionally excluded from the lookup
			// so the resolution layer can re-label the winner with
			// `source: "user-pick"`.
			if (!state.userPick) return null
			for (const candidate of candidates) {
				if (candidate.source === "user-pick") continue
				if (candidate.projectedId === state.userPick) return candidate
			}
			return null
		}
		case "active-plugin": {
			// Id-stable sort so plugin order is deterministic across
			// hosts. The first id (ascending) wins.
			const plugins = candidates.filter((c) => c.source === "active-plugin")
			return pickFirstById(plugins)
		}
		case "imported": {
			// Id-stable sort across the import registry.
			const imports = candidates.filter((c) => c.source === "imported")
			return pickFirstById(imports)
		}
		case "bundled": {
			for (const candidate of candidates) {
				if (candidate.source === "bundled") return candidate
			}
			return null
		}
		case "preview":
			return null
	}
}

function pickFirstById(candidates: readonly ThemeCandidate[]): ThemeCandidate | null {
	if (candidates.length === 0) return null
	let best = candidates[0]
	if (!best) return null
	for (let i = 1; i < candidates.length; i += 1) {
		const candidate = candidates[i]
		if (!candidate) continue
		if (candidate.projectedId < best.projectedId) best = candidate
	}
	return best
}

// ---------------------------------------------------------------------------
// Preview resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a `plugin.theme.preview` request without mutating the
 * applied theme. The helper returns a `ThemePreviewResolution` whose
 * `appliedThemeId` is what the host should KEEP applied and whose
 * `previewThemeId` is what the preview pane should render.
 *
 * Behaviour:
 *   - When the requested preview id is missing from the candidate
 *     set, the helper still resolves `appliedThemeId` (via the
 *     regular chain) and reports `previewThemeId: state.bundledDefaultId`
 *     so the preview pane can show a stable placeholder.
 *   - The applied state is NEVER touched. The helper does not write
 *     to `state` and does not produce any side effect.
 *   - The preview is always a side-channel row: the candidate is
 *     re-tagged with `source: "preview"` and `participatesInAppliedChain: false`.
 */
export function resolvePreviewTheme(
	state: ThemePipelineState,
	request: ThemePreviewRequest,
): ThemePreviewResolution {
	const applied = resolveAppliedTheme(state)
	const candidates = enumerateThemeCandidates(state)
	const matched = findCandidateById(candidates, request.themeId)
	if (matched) {
		return {
			appliedThemeId: applied.appliedThemeId,
			previewThemeId: matched.projectedId,
			previewedCandidate: {
				...matched,
				source: "preview",
				rank: THEME_PRECEDENCE_RANKS.preview,
				participatesInAppliedChain: false,
			},
			reason: THEME_PRECEDENCE_MATRIX.preview.canonicalReason,
		}
	}
	const placeholder = buildPreviewCandidate(THEME_PREVIEW_PLACEHOLDER_ID)
	return {
		appliedThemeId: applied.appliedThemeId,
		previewThemeId: placeholder.projectedId,
		previewedCandidate: placeholder,
		reason: `preview requested theme ${request.themeId} is not in the candidate set; using bundled placeholder`,
	}
}

// ---------------------------------------------------------------------------
// Fallback chain
// ---------------------------------------------------------------------------

/**
 * Build the fallback chain for the currently-applied theme. When the
 * previously-applied theme is still in the candidate set, the chain
 * is a single-row confirmation. When it has become unavailable, the
 * chain lists the candidates the pipeline will walk in precedence
 * order until it finds a valid winner, and the bundled default is
 * always the terminal row.
 */
export function buildThemeFallbackChain(state: ThemePipelineState): ThemeFallbackChain {
	const candidates = enumerateThemeCandidates(state)
	const previouslyApplied = state.previouslyAppliedThemeId
		? findCandidateById(candidates, state.previouslyAppliedThemeId)
		: null
	const previouslyAppliedSource: ThemeSourceKind | null = previouslyApplied?.source ?? null

	if (previouslyApplied) {
		return {
			previouslyAppliedThemeId: previouslyApplied.projectedId,
			previouslyAppliedSource,
			chain: [previouslyApplied],
			resolvedThemeId: previouslyApplied.projectedId,
			resolvedSource: previouslyApplied.source,
			reason: `previously-applied theme ${previouslyApplied.projectedId} is still available`,
		}
	}

	const chain: ThemeCandidate[] = []
	for (const source of APPLIED_CHAIN_SOURCES) {
		const winner = pickFirstForSource(candidates, source, state)
		if (!winner) continue
		if (source === "user-pick") {
			chain.push({
				...winner,
				source: "user-pick" as ThemeSourceKind,
				label: state.userPick ?? winner.label,
				rank: THEME_PRECEDENCE_RANKS["user-pick"],
			})
		} else {
			chain.push(winner)
		}
	}
	if (chain.length === 0) {
		const bundled = buildBundledCandidate(state.bundledDefaultId)
		chain.push(bundled)
	}
	const resolved = chain[0]
	if (!resolved) {
		throw new Error("Theme fallback chain resolved to an empty chain; bundled default missing")
	}
	return {
		previouslyAppliedThemeId: state.previouslyAppliedThemeId,
		previouslyAppliedSource,
		chain,
		resolvedThemeId: resolved.projectedId,
		resolvedSource: resolved.source,
		reason: `previously-applied theme ${state.previouslyAppliedThemeId ?? "<none>"} is unavailable; falling back through ${chain.length} candidate(s) to ${resolved.source}`,
	}
}

// ---------------------------------------------------------------------------
// Import stance (bounded)
// ---------------------------------------------------------------------------

/**
 * Bounded import stance. The runtime never loads vscode-specific code
 * paths; the catalog loader is the single conversion point. The
 * pipeline's job is to label imported candidates with the
 * `importSource` they were converted from so the operator UI can
 * surface provenance and the host can audit the conversion.
 *
 * This exported function exists so downstream code can ask "is X a
 * known import source?" without re-deriving the answer from inline
 * string comparisons.
 */
export const SUPPORTED_IMPORT_SOURCES = ["vscode-theme", "open-vsx"] as const
export type SupportedImportSource = (typeof SUPPORTED_IMPORT_SOURCES)[number]

export function isSupportedImportSource(value: string): value is SupportedImportSource {
	return (SUPPORTED_IMPORT_SOURCES as readonly string[]).includes(value)
}

export interface ImportStance {
	readonly runtimeLoadsVscodeSpecificCode: false
	readonly catalogLoaderConvertsImports: true
	readonly allowedSources: readonly SupportedImportSource[]
	readonly notes: readonly string[]
}

export const IMPORT_STANCE: ImportStance = {
	runtimeLoadsVscodeSpecificCode: false,
	catalogLoaderConvertsImports: true,
	allowedSources: SUPPORTED_IMPORT_SOURCES,
	notes: [
		"VS Code themes and Open VSX themes are converted into V2 theme contributions at the catalog loader boundary.",
		"The runtime never imports vscode-specific modules; the pipeline only consumes the standard ProjectedTheme envelope.",
		"There is no runtime shim and no vscode-runtime dependency in the pipeline itself.",
	],
}

// ---------------------------------------------------------------------------
// Convenience: full pipeline run
// ---------------------------------------------------------------------------

export interface ThemePipelineRunResult {
	readonly resolution: ThemeResolution
	readonly candidates: readonly ThemeCandidate[]
	readonly candidatesBySource: Readonly<Record<ThemeSourceKind, readonly ThemeCandidate[]>>
	readonly fallback: ThemeFallbackChain
	readonly importStance: ImportStance
}

/**
 * Run the full theme pipeline in one call. Useful for the host
 * startup / operator-UI refresh path. The helper is pure — it
 * composes the other public helpers without adding side effects.
 */
export function runThemePipeline(state: ThemePipelineState): ThemePipelineRunResult {
	const resolution = resolveAppliedTheme(state)
	const candidates = enumerateThemeCandidates(state)
	const candidatesBySource = enumerateThemeCandidatesBySource(state)
	const fallback = buildThemeFallbackChain(state)
	return {
		resolution,
		candidates,
		candidatesBySource,
		fallback,
		importStance: IMPORT_STANCE,
	}
}

// ---------------------------------------------------------------------------
// Cross-cutting: descriptor-aware candidate builder
// ---------------------------------------------------------------------------

/**
 * Build a `ThemePipelineState` from a catalog of `PluginDescriptor`s
 * plus the import list, user pick, and bundled default. This is a
 * convenience for the host wiring — it does the projected-theme
 * flattening the pipeline expects without forcing the caller to
 * invoke `projectThemesFromCatalog` directly. The helper is pure:
 * it does not consult any runtime state.
 */
export interface BuildPipelineStateInput {
	readonly descriptors: readonly PluginDescriptor[]
	readonly pluginThemeSelections: Readonly<Record<string, readonly ProjectedTheme[]>>
	readonly importedThemes: readonly ProjectedTheme[]
	readonly userPick: string | null
	readonly bundledDefaultId: string
	readonly previouslyAppliedThemeId: string | null
}

/**
 * Flatten a list of `PluginDescriptor`s into their active themes
 * without going through the renderer projection. Used by the host
 * startup path; the renderer projection is layered on top of the
 * pipeline for the UI.
 */
export function flattenDescriptorThemes(
	descriptors: readonly PluginDescriptor[],
): readonly ProjectedTheme[] {
	const items: ProjectedTheme[] = []
	for (const descriptor of descriptors) {
		for (const theme of descriptor.themes) {
			items.push({
				family: "themes",
				pluginId: descriptor.normalizedId,
				contributionId: theme.id,
				projectedId: `${descriptor.normalizedId}.${theme.id}`,
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
				capabilityGates: [],
				availability: {
					available: true,
					state: "ready",
					reason: null,
				},
				contract: {
					family: "themes",
					hostVocabulary: ["theme-catalog", "theme-preview", "theme-apply"],
					placementSurfaces: ["theme-catalog"],
					activationTriggers: ["preview-request", "apply-request", "host-startup-restore"],
					defaultState: { mode: "host-selects" },
					availability: {
						staticRequiresCapabilities: false,
						hostEvaluatesLiveAvailability: true,
						hostOwnsReasonStrings: true,
					},
					persistence: {
						strategy: "host-theme-selection",
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
				},
			})
		}
	}
	return items
}

/**
 * Build a `ThemePipelineState` from a `BuildPipelineStateInput`.
 * Convenience helper for the host wiring; the pipeline itself never
 * reaches for descriptors.
 */
export function buildThemePipelineState(input: BuildPipelineStateInput): ThemePipelineState {
	const activePluginThemes: ProjectedTheme[] = []
	for (const descriptor of input.descriptors) {
		const selected = input.pluginThemeSelections[descriptor.normalizedId]
		if (selected) {
			activePluginThemes.push(...selected)
			continue
		}
		activePluginThemes.push(...flattenDescriptorThemes([descriptor]))
	}
	return {
		userPick: input.userPick,
		activePluginThemes,
		importedThemes: input.importedThemes,
		bundledDefaultId: input.bundledDefaultId,
		previouslyAppliedThemeId: input.previouslyAppliedThemeId,
	}
}
