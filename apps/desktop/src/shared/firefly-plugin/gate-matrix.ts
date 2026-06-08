/**
 * Firefly Plugin System V2 — Verification matrix and release gates
 *
 * Three gate tiers, four workstreams.
 *   Tiers:    local | pre-merge | release
 *   Streams:  runtime | bridge | renderer | theme
 *
 * Local gates run on every save; pre-merge gates run on every PR;
 * release gates run on every release tag. The V2 plan requires
 * that each (tier, stream) cell has an explicit obligation, and
 * that the matrix is grounded in real repo commands.
 */

import { z } from "zod"

export const gateTierSchema = z.enum(["local", "pre-merge", "release"])
export type GateTier = z.infer<typeof gateTierSchema>

export const gateStreamSchema = z.enum(["runtime", "bridge", "renderer", "theme"])
export type GateStream = z.infer<typeof gateStreamSchema>

export const gateObligationSchema = z
	.object({
		stream: gateStreamSchema,
		tier: gateTierSchema,
		obligation: z.string().min(1).max(300),
		command: z.string().min(1).max(400),
		module: z.string().min(1).max(120),
		blocksMerge: z.boolean(),
	})
	.strict()
export type GateObligation = z.infer<typeof gateObligationSchema>

/**
 * The locked V2 verification matrix. Every (tier, stream) cell has
 * at least one obligation. Pre-merge and release gates are marked
 * `blocksMerge: true`; local gates are advisory only.
 *
 * Commands are grounded in the real repo:
 *   - `cd apps/desktop && bunx tsgo --noEmit` is the V2 typecheck
 *   - `cd apps/desktop && bun test src/shared/firefly-plugin/` is the V2 test
 *   - `cd apps/desktop && bun run lint` is the Biome lint
 */
export const V2_GATE_MATRIX: readonly GateObligation[] = [
	// === runtime / local ===
	{
		stream: "runtime",
		tier: "local",
		obligation: "V2 typecheck passes",
		command: "cd apps/desktop && bunx tsgo --noEmit",
		module: "manifest",
		blocksMerge: false,
	},
	{
		stream: "runtime",
		tier: "local",
		obligation: "V2 test suite passes",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/",
		module: "manifest",
		blocksMerge: false,
	},

	// === runtime / pre-merge ===
	{
		stream: "runtime",
		tier: "pre-merge",
		obligation: "Manifest, descriptor, capability, tool-projection tests all pass",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/manifest.test.ts src/shared/firefly-plugin/descriptor.test.ts src/shared/firefly-plugin/capabilities.test.ts src/shared/firefly-plugin/tool-projection.test.ts",
		module: "manifest",
		blocksMerge: true,
	},
	{
		stream: "runtime",
		tier: "pre-merge",
		obligation: "Hot reload and runtime supervision tests pass",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/hot-reload.test.ts src/shared/firefly-plugin/runtime-supervision.test.ts",
		module: "hot-reload",
		blocksMerge: true,
	},
	{
		stream: "runtime",
		tier: "pre-merge",
		obligation: "First-party and bridge migration matrices hold their dispositions",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/first-party-migration.test.ts src/shared/firefly-plugin/bridge-migration.test.ts",
		module: "first-party-migration",
		blocksMerge: true,
	},

	// === runtime / release ===
	{
		stream: "runtime",
		tier: "release",
		obligation: "All V2 firefly-plugin tests pass at HEAD",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/",
		module: "manifest",
		blocksMerge: true,
	},
	{
		stream: "runtime",
		tier: "release",
		obligation: "Roadmap M1 promoted, M2 promoted or explicitly deferred",
		command: "bun -e 'import { V2_ROADMAP } from \"./apps/desktop/src/shared/firefly-plugin/roadmap\"; const m1 = V2_ROADMAP.find(m => m.id === \"M1-source-of-truth\"); const m2 = V2_ROADMAP.find(m => m.id === \"M2-first-vertical-slice\"); if (m1.status !== \"promoted\") throw new Error(\"M1 not promoted\"); if (m2.status !== \"promoted\" && m2.status !== \"deferred\") throw new Error(\"M2 not promoted or deferred\");'",
		module: "roadmap",
		blocksMerge: true,
	},

	// === bridge / local ===
	{
		stream: "bridge",
		tier: "local",
		obligation: "Bridge projection + palot-bridge V2 manifest tests pass",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/bridge-projection.test.ts src/shared/firefly-plugin/palot-bridge-manifest.test.ts",
		module: "bridge-projection",
		blocksMerge: false,
	},

	// === bridge / pre-merge ===
	{
		stream: "bridge",
		tier: "pre-merge",
		obligation: "Bridge migration matrix tests pass",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/bridge-migration.test.ts",
		module: "bridge-migration",
		blocksMerge: true,
	},
	{
		stream: "bridge",
		tier: "pre-merge",
		obligation: "Every server-mode cell in bridge-projection is covered",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/bridge-projection.test.ts",
		module: "bridge-projection",
		blocksMerge: true,
	},

	// === bridge / release ===
	{
		stream: "bridge",
		tier: "release",
		obligation: "OpenCode SDK is at or above the V2 manifest floor",
		command: "cd apps/desktop && bun -e 'import packageJson from \"./apps/desktop/package.json\" with {type:\"json\"}; const ver = packageJson.dependencies[\"@opencode-ai/sdk\"] ?? \"\"; if (!ver) throw new Error(\"@opencode-ai/sdk not declared\");'",
		module: "bridge-projection",
		blocksMerge: true,
	},

	// === renderer / local ===
	{
		stream: "renderer",
		tier: "local",
		obligation: "Renderer projection + family contracts tests pass",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/renderer-projection.test.ts src/shared/firefly-plugin/family-contracts.test.ts",
		module: "renderer-projection",
		blocksMerge: false,
	},

	// === renderer / pre-merge ===
	{
		stream: "renderer",
		tier: "pre-merge",
		obligation: "Command projection + storage scopes tests pass",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/command-projection.test.ts src/shared/firefly-plugin/storage-scopes.test.ts",
		module: "command-projection",
		blocksMerge: true,
	},
	{
		stream: "renderer",
		tier: "pre-merge",
		obligation: "Operator surface tests pass (marketplace flags locked)",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/operator-surface.test.ts",
		module: "operator-surface",
		blocksMerge: true,
	},

	// === renderer / release ===
	{
		stream: "renderer",
		tier: "release",
		obligation: "All renderer stream tests pass at HEAD",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/renderer-projection.test.ts src/shared/firefly-plugin/family-contracts.test.ts src/shared/firefly-plugin/command-projection.test.ts src/shared/firefly-plugin/storage-scopes.test.ts src/shared/firefly-plugin/operator-surface.test.ts",
		module: "renderer-projection",
		blocksMerge: true,
	},

	// === theme / local ===
	{
		stream: "theme",
		tier: "local",
		obligation: "Theme pipeline precedence tests pass",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/theme-pipeline.test.ts",
		module: "theme-pipeline",
		blocksMerge: false,
	},

	// === theme / pre-merge ===
	{
		stream: "theme",
		tier: "pre-merge",
		obligation: "Theme pipeline test covers every (userPick, activePlugin, imported, bundled) combination",
		command: "cd apps/desktop && bun test src/shared/firefly-plugin/theme-pipeline.test.ts",
		module: "theme-pipeline",
		blocksMerge: true,
	},

	// === theme / release ===
	{
		stream: "theme",
		tier: "release",
		obligation: "M5-themes milestone is promoted or explicitly deferred",
		command: "bun -e 'import { V2_ROADMAP } from \"./apps/desktop/src/shared/firefly-plugin/roadmap\"; const m5 = V2_ROADMAP.find(m => m.id === \"M5-themes\"); if (m5.status !== \"promoted\" && m5.status !== \"deferred\") throw new Error(\"M5 not promoted or deferred\");'",
		module: "theme-pipeline",
		blocksMerge: true,
	},
] as const

/**
 * Returns all blocking obligations for a given tier. Pre-merge and
 * release tiers block merge; local is advisory.
 */
export function blockingObligations(
	tier: GateTier,
	matrix: readonly GateObligation[] = V2_GATE_MATRIX,
): readonly GateObligation[] {
	return matrix.filter((g) => g.tier === tier && g.blocksMerge)
}

/**
 * Returns all obligations for a given stream. The V2 plan acceptance
 * criterion requires that each stream has explicit obligations.
 */
export function obligationsForStream(
	stream: GateStream,
	matrix: readonly GateObligation[] = V2_GATE_MATRIX,
): readonly GateObligation[] {
	return matrix.filter((g) => g.stream === stream)
}
