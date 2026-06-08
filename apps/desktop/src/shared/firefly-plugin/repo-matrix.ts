/**
 * Firefly Plugin System V2 — Repo surface and file matrix
 *
 * Every V2 contract has a known repo touch point. This file encodes
 * the matrix as a typed list so a future contributor cannot silently
 * add a new V2 module that does not have a real, repo-grounded
 * landing point. The matrix separates:
 *   - new V2 contracts (committed in this slice)
 *   - existing repo areas that V2 reads (treat as runtime evidence)
 *   - integration points that V2 will write into (in a future ship)
 */

import { z } from "zod"

export const repoAreaSchema = z.enum([
	"shared/firefly-plugin",
	"main",
	"preload",
	"renderer",
	"server",
	"ui-kit",
	"configconv",
])
export type RepoArea = z.infer<typeof repoAreaSchema>

export const fileMatrixEntrySchema = z
	.object({
		path: z.string().min(1).max(240),
		area: repoAreaSchema,
		role: z.enum(["v2-contract", "v2-reads", "v2-writes", "v2-evidence"]),
		v2Module: z.string().min(1).max(120),
		locked: z.boolean(),
	})
	.strict()
export type FileMatrixEntry = z.infer<typeof fileMatrixEntrySchema>

/**
 * The locked V2 file matrix. Every entry is grounded in a real
 * repo path or a clearly-marked new module. New V2 work must add
 * an entry here before committing new files.
 */
export const V2_FILE_MATRIX: readonly FileMatrixEntry[] = [
	// === v2-contract: new files committed in this slice ===
	{
		path: "apps/desktop/src/shared/firefly-plugin/manifest.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "manifest",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/descriptor.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "descriptor",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/capabilities.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "capabilities",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/tool-projection.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "tool-projection",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/family-contracts.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "family-contracts",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/hot-reload.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "hot-reload",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/runtime-supervision.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "runtime-supervision",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "palot-bridge-manifest",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/api-versioning.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "api-versioning",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/bridge-projection.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "bridge-projection",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/renderer-projection.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "renderer-projection",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/theme-pipeline.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "theme-pipeline",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/storage-scopes.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "storage-scopes",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/command-projection.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "command-projection",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/first-party-migration.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "first-party-migration",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/bridge-migration.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "bridge-migration",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/acme-notebook-exemplar.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "acme-notebook-exemplar",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/vscode-import.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "vscode-import",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/operator-surface.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "operator-surface",
		locked: true,
	},
	{
		path: "apps/desktop/src/shared/firefly-plugin/roadmap.ts",
		area: "shared/firefly-plugin",
		role: "v2-contract",
		v2Module: "roadmap",
		locked: true,
	},

	// === v2-evidence: existing repo files V2 reads as runtime evidence ===
	{
		path: "apps/desktop/src/main/palot-plugin/plugin.js",
		area: "main",
		role: "v2-evidence",
		v2Module: "palot-bridge-manifest",
		locked: true,
	},
	{
		path: "apps/desktop/src/renderer/firefly-surface-registry.tsx",
		area: "renderer",
		role: "v2-evidence",
		v2Module: "renderer-projection",
		locked: true,
	},
	{
		path: "apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx",
		area: "renderer",
		role: "v2-evidence",
		v2Module: "operator-surface",
		locked: true,
	},

	// === v2-writes: future integration points (NOT modified in this slice) ===
	{
		path: "apps/desktop/src/main/palot-plugin/catalog-loader.ts",
		area: "main",
		role: "v2-writes",
		v2Module: "manifest",
		locked: false,
	},
	{
		path: "apps/desktop/src/preload/plugin-bridge.ts",
		area: "preload",
		role: "v2-writes",
		v2Module: "bridge-projection",
		locked: false,
	},
	{
		path: "apps/desktop/src/renderer/components/operator-panel/plugin-row.tsx",
		area: "renderer",
		role: "v2-writes",
		v2Module: "operator-surface",
		locked: false,
	},
] as const

/**
 * The locked domain split: main / preload / shared / renderer / sdk
 * / runtime-host / plugin-examples. The V2 plan requires this split
 * to be explicit. New V2 work must respect these seams.
 */
export const V2_DOMAIN_SPLIT = [
	"main: Electron main process; owns plugin catalog loader, IPC",
	"preload: secure bridge; exposes a narrow plugin API",
	"shared: cross-process schemas, projections, broker, migrations (this is where V2 contracts live)",
	"renderer: React app; host-owned DOM; only reads V2 descriptors",
	"sdk: future — pure TS SDK for plugin authors (planned, not committed)",
	"runtime-host: future — V2 host runtime that drives loaded plugins (planned, not committed)",
	"plugin-examples: future — third-party / AI-authored exemplars (only `acme-notebook-exemplar.ts` is committed as a fixture)",
] as const

/**
 * Returns the V2 file-matrix entry for a given V2 module, or null if
 * the module is not in the matrix. Used by the operator UI to show
 * "this module is in source but not yet wired into the host" status.
 */
export function findV2Module(
	moduleName: string,
	matrix: readonly FileMatrixEntry[] = V2_FILE_MATRIX,
): FileMatrixEntry | null {
	return matrix.find((m) => m.v2Module === moduleName) ?? null
}
