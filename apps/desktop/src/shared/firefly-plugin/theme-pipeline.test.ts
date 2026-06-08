/**
 * Firefly Plugin System V2 — Theme contribution pipeline tests
 *
 * Locks the precedence matrix, the preview-never-mutates rule, the
 * fallback chain behaviour, and the bounded import stance. Every row
 * in `THEME_PRECEDENCE_MATRIX` is covered; every helper is exercised
 * with at least one positive and one negative case.
 */

import { describe, expect, test } from "bun:test"

import type { PluginDescriptor } from "./descriptor"
import { derivePluginDescriptor, parsePluginManifest } from "./index"
import { THEME_CONTRACT } from "./family-contracts"
import type { ProjectedTheme } from "./renderer-projection"
import {
	APPLIED_CHAIN_SOURCES,
	buildThemeFallbackChain,
	buildThemePipelineState,
	enumerateThemeCandidates,
	enumerateThemeCandidatesBySource,
	flattenDescriptorThemes,
	IMPORT_STANCE,
	isSupportedImportSource,
	resolveAppliedTheme,
	resolvePreviewTheme,
	runThemePipeline,
	SUPPORTED_IMPORT_SOURCES,
	THEME_PRECEDENCE_MATRIX,
	THEME_PRECEDENCE_RANKS,
	THEME_SOURCE_KINDS,
	type ThemeCandidate,
	type ThemePipelineState,
} from "./theme-pipeline"

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const BUNDLED_DEFAULT = "default"

function makeProjectedTheme(input: {
	projectedId: string
	label?: string
	pluginId?: string
	imports?: { source: "vscode-theme" | "open-vsx"; externalId: string; provenance?: string | null } | null
}): ProjectedTheme {
	return {
		family: "themes",
		pluginId: input.pluginId ?? "firefly.built-in.example",
		contributionId: input.projectedId,
		projectedId: input.projectedId,
		label: input.label ?? input.projectedId,
		envelope: {
			kind: "system-adaptive",
			platforms: null,
			tokens: {},
			darkTokens: {},
			fontFamily: null,
			radius: null,
			density: null,
			imports: input.imports
				? {
						...input.imports,
						provenance: input.imports.provenance ?? null,
					}
				: null,
		},
		capabilityGates: [],
		availability: { available: true, state: "ready", reason: null },
		contract: THEME_CONTRACT,
	}
}

function emptyState(overrides: Partial<ThemePipelineState> = {}): ThemePipelineState {
	return {
		userPick: null,
		activePluginThemes: [],
		importedThemes: [],
		bundledDefaultId: BUNDLED_DEFAULT,
		previouslyAppliedThemeId: null,
		...overrides,
	}
}

function candidateBySource(
	candidates: readonly ThemeCandidate[],
	source: (typeof THEME_SOURCE_KINDS)[number],
): readonly ThemeCandidate[] {
	return candidates.filter((c) => c.source === source)
}

function makeThemeDescriptor(themeId: string, label: string): PluginDescriptor {
	const manifest = parsePluginManifest({
		apiVersion: "firefly.plugin/v2",
		kind: "PluginManifest",
		id: "firefly.built-in.example",
		displayName: "Example",
		version: "1.0.0",
		trust: "built-in",
		lifecycle: { autoEnable: true, keepAliveAcrossSessions: false },
		activationEvents: [{ kind: "onStartup" }],
		contributes: {
			themes: [{ id: themeId, label, kind: "system-adaptive", tokens: {}, darkTokens: {} }],
		},
		capabilities: [],
	})
	return derivePluginDescriptor(manifest, { appVersion: "0.11.0" })
}

// ---------------------------------------------------------------------------
// Precedence matrix shape
// ---------------------------------------------------------------------------

describe("THEME_PRECEDENCE_MATRIX", () => {
	test("covers every source kind exactly once", () => {
		expect(Object.keys(THEME_PRECEDENCE_MATRIX).sort()).toEqual([...THEME_SOURCE_KINDS].sort())
	})

	test("ranks agree with the locked source-of-truth table", () => {
		for (const source of THEME_SOURCE_KINDS) {
			expect(THEME_PRECEDENCE_MATRIX[source].rank).toBe(THEME_PRECEDENCE_RANKS[source])
		}
	})

	test("applied chain rows are in the locked order", () => {
		expect(APPLIED_CHAIN_SOURCES).toEqual(["user-pick", "active-plugin", "imported", "bundled"])
	})

	test("user-pick wins the chain; bundled is the terminal row", () => {
		const order = APPLIED_CHAIN_SOURCES.map((s) => THEME_PRECEDENCE_MATRIX[s].rank)
		const sortedAsc = [...order].sort((a, b) => a - b)
		expect(order).toEqual(sortedAsc)
		expect(THEME_PRECEDENCE_MATRIX["user-pick"].rank).toBe(1)
		expect(THEME_PRECEDENCE_MATRIX.bundled.rank).toBe(4)
	})

	test("every row declares a winner, apply path, observable, and reason", () => {
		for (const source of THEME_SOURCE_KINDS) {
			const row = THEME_PRECEDENCE_MATRIX[source]
			expect(row.winner.length).toBeGreaterThan(0)
			expect(row.applyPath.length).toBeGreaterThan(0)
			expect(row.userObservable.length).toBeGreaterThan(0)
			expect(row.canonicalReason.length).toBeGreaterThan(0)
		}
	})

	test("preview is the only row that does not participate in the applied chain", () => {
		const applied = APPLIED_CHAIN_SOURCES.map((s) => THEME_PRECEDENCE_MATRIX[s])
		expect(applied.every((row) => row.participatesInAppliedChain === true)).toBe(true)
		expect(THEME_PRECEDENCE_MATRIX.preview.participatesInAppliedChain).toBe(false)
	})

	test("preview is the only row whose rank is outside the applied chain (>= 99)", () => {
		const appliedRanks = APPLIED_CHAIN_SOURCES.map((s) => THEME_PRECEDENCE_MATRIX[s].rank)
		expect(THEME_PRECEDENCE_MATRIX.preview.rank).toBeGreaterThanOrEqual(99)
		expect(appliedRanks.every((r) => r < 99)).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Candidate enumeration
// ---------------------------------------------------------------------------

describe("enumerateThemeCandidates", () => {
	test("returns the bundled default even when no other source contributes", () => {
		const candidates = enumerateThemeCandidates(emptyState())
		expect(candidates).toHaveLength(1)
		expect(candidates[0]?.source).toBe("bundled")
		expect(candidates[0]?.projectedId).toBe(BUNDLED_DEFAULT)
	})

	test("ranks are sorted ascending (lower rank = higher precedence)", () => {
		const state = emptyState({
			userPick: "cortex",
			activePluginThemes: [makeProjectedTheme({ projectedId: "firefly.built-in.theme.aurora" })],
			importedThemes: [
				makeProjectedTheme({
					projectedId: "imported.dark-plus",
					imports: { source: "vscode-theme", externalId: "dark-plus" },
				}),
			],
		})
		const candidates = enumerateThemeCandidates(state)
		const ranks = candidates.map((c) => c.rank)
		const sorted = [...ranks].sort((a, b) => a - b)
		expect(ranks).toEqual(sorted)
	})

	test("user-pick candidate carries rank 1 and is the first row", () => {
		const state = emptyState({ userPick: "cortex" })
		const [first] = enumerateThemeCandidates(state)
		expect(first?.source).toBe("user-pick")
		expect(first?.rank).toBe(1)
		expect(first?.projectedId).toBe("cortex")
	})

	test("imported candidates carry the importSource from the projected envelope", () => {
		const state = emptyState({
			importedThemes: [
				makeProjectedTheme({
					projectedId: "imported.dark-plus",
					imports: { source: "vscode-theme", externalId: "dark-plus" },
				}),
				makeProjectedTheme({
					projectedId: "imported.aurora",
					imports: { source: "open-vsx", externalId: "acme.aurora" },
				}),
			],
		})
		const candidates = candidateBySource(enumerateThemeCandidates(state), "imported")
		expect(candidates).toHaveLength(2)
		expect(candidates[0]?.importSource).toBe("vscode-theme")
		expect(candidates[1]?.importSource).toBe("open-vsx")
	})
})

describe("enumerateThemeCandidatesBySource", () => {
	test("returns one bucket per source kind in the locked order", () => {
		const buckets = enumerateThemeCandidatesBySource(emptyState({ userPick: "cortex" }))
		expect(Object.keys(buckets).sort()).toEqual([...THEME_SOURCE_KINDS].sort())
		expect(buckets["user-pick"]).toHaveLength(1)
		expect(buckets.bundled).toHaveLength(1)
		expect(buckets.preview).toEqual([])
	})
})

// ---------------------------------------------------------------------------
// Applied theme resolution — precedence winners
// ---------------------------------------------------------------------------

describe("resolveAppliedTheme", () => {
	test("user-pick always wins over plugin/imported/default", () => {
		const state = emptyState({
			userPick: "cortex",
			bundledDefaultId: "cortex",
			activePluginThemes: [makeProjectedTheme({ projectedId: "firefly.built-in.theme.aurora" })],
			importedThemes: [
				makeProjectedTheme({
					projectedId: "imported.dark-plus",
					imports: { source: "vscode-theme", externalId: "dark-plus" },
				}),
			],
		})
		const result = resolveAppliedTheme(state)
		expect(result.appliedThemeId).toBe("cortex")
		expect(result.source).toBe("user-pick")
		expect(result.rank).toBe(1)
		expect(result.reason).toBe(THEME_PRECEDENCE_MATRIX["user-pick"].canonicalReason)
	})

	test("active plugin theme wins when no user-pick is set", () => {
		const state = emptyState({
			activePluginThemes: [makeProjectedTheme({ projectedId: "firefly.built-in.theme.aurora" })],
			importedThemes: [
				makeProjectedTheme({
					projectedId: "imported.dark-plus",
					imports: { source: "open-vsx", externalId: "acme.dark-plus" },
				}),
			],
		})
		const result = resolveAppliedTheme(state)
		expect(result.appliedThemeId).toBe("firefly.built-in.theme.aurora")
		expect(result.source).toBe("active-plugin")
		expect(result.rank).toBe(2)
		expect(result.reason).toBe(THEME_PRECEDENCE_MATRIX["active-plugin"].canonicalReason)
	})

	test("imported theme wins when no user-pick and no active plugin", () => {
		const state = emptyState({
			importedThemes: [
				makeProjectedTheme({
					projectedId: "imported.dark-plus",
					imports: { source: "vscode-theme", externalId: "dark-plus" },
				}),
			],
		})
		const result = resolveAppliedTheme(state)
		expect(result.appliedThemeId).toBe("imported.dark-plus")
		expect(result.source).toBe("imported")
		expect(result.rank).toBe(3)
		expect(result.reason).toBe(THEME_PRECEDENCE_MATRIX.imported.canonicalReason)
	})

	test("bundled default is reached only when no other source contributes", () => {
		const result = resolveAppliedTheme(emptyState())
		expect(result.appliedThemeId).toBe(BUNDLED_DEFAULT)
		expect(result.source).toBe("bundled")
		expect(result.rank).toBe(4)
		expect(result.reason).toBe(THEME_PRECEDENCE_MATRIX.bundled.canonicalReason)
	})

	test("user-pick that points at a missing theme falls through to the next row", () => {
		const state = emptyState({
			userPick: "ghost-theme",
			activePluginThemes: [makeProjectedTheme({ projectedId: "firefly.built-in.theme.aurora" })],
		})
		const result = resolveAppliedTheme(state)
		expect(result.appliedThemeId).toBe("firefly.built-in.theme.aurora")
		expect(result.source).toBe("active-plugin")
	})

	test("resolution never returns previewThemeId from the applied chain", () => {
		const state = emptyState({ userPick: "cortex", bundledDefaultId: "cortex" })
		const result = resolveAppliedTheme(state)
		expect(result.previewThemeId).toBeNull()
		expect(result.previewedCandidate).toBeNull()
	})

	test("resolution embeds the winning candidate for downstream UI rendering", () => {
		const state = emptyState({ userPick: "cortex", bundledDefaultId: "cortex" })
		const result = resolveAppliedTheme(state)
		expect(result.winner.projectedId).toBe("cortex")
		expect(result.winner.source).toBe("user-pick")
		expect(result.winner.participatesInAppliedChain).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// Preview — never mutates applied state
// ---------------------------------------------------------------------------

describe("resolvePreviewTheme", () => {
	const baseState = emptyState({
		userPick: "cortex",
		bundledDefaultId: "cortex",
		activePluginThemes: [makeProjectedTheme({ projectedId: "firefly.built-in.theme.aurora" })],
		importedThemes: [
			makeProjectedTheme({
				projectedId: "imported.dark-plus",
				imports: { source: "vscode-theme", externalId: "dark-plus" },
			}),
		],
	})

	test("preview never mutates the applied theme (user-pick stays applied)", () => {
		const result = resolvePreviewTheme(baseState, { themeId: "imported.dark-plus" })
		expect(result.appliedThemeId).toBe("cortex")
		expect(result.previewThemeId).toBe("imported.dark-plus")
	})

	test("preview never mutates the applied theme (active plugin stays applied)", () => {
		const state = emptyState({
			activePluginThemes: [makeProjectedTheme({ projectedId: "firefly.built-in.theme.aurora" })],
			importedThemes: [
				makeProjectedTheme({
					projectedId: "imported.dark-plus",
					imports: { source: "vscode-theme", externalId: "dark-plus" },
				}),
			],
		})
		const result = resolvePreviewTheme(state, { themeId: "imported.dark-plus" })
		expect(result.appliedThemeId).toBe("firefly.built-in.theme.aurora")
		expect(result.previewThemeId).toBe("imported.dark-plus")
	})

	test("preview candidate is re-tagged with source 'preview' and excluded from the chain", () => {
		const result = resolvePreviewTheme(baseState, { themeId: "imported.dark-plus" })
		expect(result.previewedCandidate.source).toBe("preview")
		expect(result.previewedCandidate.participatesInAppliedChain).toBe(false)
		expect(result.previewedCandidate.rank).toBe(THEME_PRECEDENCE_RANKS.preview)
	})

	test("preview of the currently-applied theme keeps the applied state intact", () => {
		const result = resolvePreviewTheme(baseState, { themeId: "cortex" })
		expect(result.appliedThemeId).toBe("cortex")
		expect(result.previewThemeId).toBe("cortex")
	})

	test("preview of a missing theme falls back to the bundled placeholder", () => {
		const result = resolvePreviewTheme(baseState, { themeId: "ghost-theme" })
		expect(result.appliedThemeId).toBe("cortex")
		expect(result.previewThemeId).toBe(BUNDLED_DEFAULT)
	})

	test("preview reason always cites the preview contract", () => {
		const result = resolvePreviewTheme(baseState, { themeId: "imported.dark-plus" })
		expect(result.reason).toBe(THEME_PRECEDENCE_MATRIX.preview.canonicalReason)
	})

	test("preview is pure: identical inputs produce identical outputs", () => {
		const a = resolvePreviewTheme(baseState, { themeId: "imported.dark-plus" })
		const b = resolvePreviewTheme(baseState, { themeId: "imported.dark-plus" })
		expect(a).toEqual(b)
	})
})

// ---------------------------------------------------------------------------
// Fallback chain
// ---------------------------------------------------------------------------

describe("buildThemeFallbackChain", () => {
	test("returns a single-row confirmation when previously-applied is still available", () => {
		const state = emptyState({
			userPick: "cortex",
			previouslyAppliedThemeId: "cortex",
		})
		const result = buildThemeFallbackChain(state)
		expect(result.previouslyAppliedThemeId).toBe("cortex")
		expect(result.previouslyAppliedSource).toBe("user-pick")
		expect(result.chain).toHaveLength(1)
		expect(result.chain[0]?.projectedId).toBe("cortex")
		expect(result.resolvedThemeId).toBe("cortex")
	})

	test("walks the precedence chain when a previously-applied plugin theme is uninstalled", () => {
		const state = emptyState({
			userPick: "cortex",
			bundledDefaultId: "cortex",
			previouslyAppliedThemeId: "firefly.built-in.theme.aurora",
		})
		const result = buildThemeFallbackChain(state)
		expect(result.previouslyAppliedThemeId).toBe("firefly.built-in.theme.aurora")
		expect(result.previouslyAppliedSource).toBeNull()
		expect(result.resolvedThemeId).toBe("cortex")
		expect(result.resolvedSource).toBe("user-pick")
	})

	test("falls down to the bundled default when the user-pick also becomes unavailable", () => {
		const state = emptyState({
			userPick: "ghost-theme",
			previouslyAppliedThemeId: "firefly.built-in.theme.aurora",
		})
		const result = buildThemeFallbackChain(state)
		expect(result.resolvedThemeId).toBe(BUNDLED_DEFAULT)
		expect(result.resolvedSource).toBe("bundled")
	})

	test("fallback chain always terminates at the bundled default", () => {
		const state = emptyState({
			previouslyAppliedThemeId: "firefly.built-in.theme.aurora",
		})
		const result = buildThemeFallbackChain(state)
		const last = result.chain[result.chain.length - 1]
		expect(last?.source).toBe("bundled")
		expect(last?.projectedId).toBe(BUNDLED_DEFAULT)
	})

	test("fallback chain preserves the locked precedence order", () => {
		const state = emptyState({
			userPick: "cortex",
			bundledDefaultId: "cortex",
			activePluginThemes: [makeProjectedTheme({ projectedId: "firefly.built-in.theme.aurora" })],
			importedThemes: [
				makeProjectedTheme({
					projectedId: "imported.dark-plus",
					imports: { source: "open-vsx", externalId: "acme.dark-plus" },
				}),
			],
			previouslyAppliedThemeId: "missing",
		})
		const result = buildThemeFallbackChain(state)
		const ranks = result.chain.map((c) => c.rank)
		const sorted = [...ranks].sort((a, b) => a - b)
		expect(ranks).toEqual(sorted)
	})

	test("null previously-applied falls through to the chain", () => {
		const state = emptyState({ userPick: "cortex", bundledDefaultId: "cortex" })
		const result = buildThemeFallbackChain(state)
		expect(result.previouslyAppliedThemeId).toBeNull()
		expect(result.resolvedThemeId).toBe("cortex")
		expect(result.resolvedSource).toBe("user-pick")
	})
})

// ---------------------------------------------------------------------------
// Import stance — bounded
// ---------------------------------------------------------------------------

describe("IMPORT_STANCE", () => {
	test("runtime never loads vscode-specific code paths", () => {
		expect(IMPORT_STANCE.runtimeLoadsVscodeSpecificCode).toBe(false)
	})

	test("catalog loader is the single conversion point", () => {
		expect(IMPORT_STANCE.catalogLoaderConvertsImports).toBe(true)
	})

	test("only VS Code and Open VSX are accepted import sources", () => {
		expect(IMPORT_STANCE.allowedSources).toEqual(SUPPORTED_IMPORT_SOURCES)
		expect(SUPPORTED_IMPORT_SOURCES).toEqual(["vscode-theme", "open-vsx"])
	})

	test("isSupportedImportSource narrows known sources and rejects unknown", () => {
		expect(isSupportedImportSource("vscode-theme")).toBe(true)
		expect(isSupportedImportSource("open-vsx")).toBe(true)
		expect(isSupportedImportSource("npm")).toBe(false)
		expect(isSupportedImportSource("")).toBe(false)
	})

	test("notes explicitly forbid runtime shim and vscode-runtime dependency", () => {
		const joined = IMPORT_STANCE.notes.join("\n")
		expect(joined).toMatch(/no runtime shim/i)
		expect(joined).toMatch(/no vscode-runtime dependency/i)
		expect(joined).toMatch(/converted into V2 theme contributions at the catalog loader/i)
	})
})

// ---------------------------------------------------------------------------
// Convenience: full pipeline run + descriptor builder
// ---------------------------------------------------------------------------

describe("runThemePipeline", () => {
	test("returns a complete, internally consistent snapshot", () => {
		const state = emptyState({
			userPick: "cortex",
			bundledDefaultId: "cortex",
			activePluginThemes: [makeProjectedTheme({ projectedId: "firefly.built-in.theme.aurora" })],
			importedThemes: [
				makeProjectedTheme({
					projectedId: "imported.dark-plus",
					imports: { source: "vscode-theme", externalId: "dark-plus" },
				}),
			],
		})
		const result = runThemePipeline(state)
		expect(result.resolution.appliedThemeId).toBe("cortex")
		expect(result.candidates).toContainEqual(
			expect.objectContaining({ projectedId: "cortex", source: "user-pick" }),
		)
		expect(result.candidatesBySource.bundled).toHaveLength(1)
		expect(result.fallback.resolvedThemeId).toBe("cortex")
		expect(result.importStance).toBe(IMPORT_STANCE)
	})
})

describe("flattenDescriptorThemes", () => {
	test("returns an empty list for an empty descriptor list", () => {
		expect(flattenDescriptorThemes([])).toEqual([])
	})

	test("flattens themes with the projected-id convention", () => {
		const themes = flattenDescriptorThemes([makeThemeDescriptor("aurora", "Aurora")])
		expect(themes).toHaveLength(1)
		expect(themes[0]?.projectedId).toBe("firefly.built-in.example.aurora")
		expect(themes[0]?.label).toBe("Aurora")
	})
})

describe("buildThemePipelineState", () => {
	test("flattens descriptors into active plugin themes", () => {
		const state = buildThemePipelineState({
			descriptors: [makeThemeDescriptor("aurora", "Aurora")],
			pluginThemeSelections: {},
			importedThemes: [],
			userPick: null,
			bundledDefaultId: BUNDLED_DEFAULT,
			previouslyAppliedThemeId: null,
		})
		expect(state.activePluginThemes).toHaveLength(1)
		expect(state.activePluginThemes[0]?.projectedId).toBe("firefly.built-in.example.aurora")
	})

	test("honours an explicit pluginThemeSelections override per plugin", () => {
		const override = makeProjectedTheme({ projectedId: "override.theme" })
		const state = buildThemePipelineState({
			descriptors: [makeThemeDescriptor("aurora", "Aurora")],
			pluginThemeSelections: { "firefly.built-in.example": [override] },
			importedThemes: [],
			userPick: null,
			bundledDefaultId: BUNDLED_DEFAULT,
			previouslyAppliedThemeId: null,
		})
		expect(state.activePluginThemes).toEqual([override])
	})
})
