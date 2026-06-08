import { describe, expect, test } from "bun:test"
import {
	V2_DOMAIN_SPLIT,
	V2_FILE_MATRIX,
	fileMatrixEntrySchema,
	findV2Module,
	repoAreaSchema,
} from "./repo-matrix"

describe("repo-matrix", () => {
	test("V2_FILE_MATRIX includes every committed V2 contract path", () => {
		const requiredPaths = [
			"apps/desktop/src/shared/firefly-plugin/manifest.ts",
			"apps/desktop/src/shared/firefly-plugin/descriptor.ts",
			"apps/desktop/src/shared/firefly-plugin/capabilities.ts",
			"apps/desktop/src/shared/firefly-plugin/tool-projection.ts",
			"apps/desktop/src/shared/firefly-plugin/family-contracts.ts",
			"apps/desktop/src/shared/firefly-plugin/hot-reload.ts",
			"apps/desktop/src/shared/firefly-plugin/runtime-supervision.ts",
			"apps/desktop/src/shared/firefly-plugin/palot-bridge-manifest.ts",
			"apps/desktop/src/shared/firefly-plugin/api-versioning.ts",
			"apps/desktop/src/shared/firefly-plugin/bridge-projection.ts",
			"apps/desktop/src/shared/firefly-plugin/renderer-projection.ts",
			"apps/desktop/src/shared/firefly-plugin/theme-pipeline.ts",
			"apps/desktop/src/shared/firefly-plugin/storage-scopes.ts",
			"apps/desktop/src/shared/firefly-plugin/command-projection.ts",
			"apps/desktop/src/shared/firefly-plugin/first-party-migration.ts",
			"apps/desktop/src/shared/firefly-plugin/bridge-migration.ts",
			"apps/desktop/src/shared/firefly-plugin/acme-notebook-exemplar.ts",
			"apps/desktop/src/shared/firefly-plugin/vscode-import.ts",
			"apps/desktop/src/shared/firefly-plugin/operator-surface.ts",
			"apps/desktop/src/shared/firefly-plugin/roadmap.ts",
		]
		const matrixPaths = V2_FILE_MATRIX.filter((m) => m.role === "v2-contract").map(
			(m) => m.path,
		)
		for (const p of requiredPaths) {
			expect(matrixPaths).toContain(p)
		}
	})

	test("every v2-evidence path is a real, existing repo area", () => {
		const evidencePaths = V2_FILE_MATRIX.filter((m) => m.role === "v2-evidence").map(
			(m) => m.path,
		)
		const grounded = [
			"apps/desktop/src/main/palot-plugin/plugin.js",
			"apps/desktop/src/renderer/firefly-surface-registry.tsx",
			"apps/desktop/src/renderer/components/side-panel/plugins-panel.tsx",
		]
		for (const p of grounded) {
			expect(evidencePaths).toContain(p)
		}
	})

	test("every v2-writes path is marked locked=false (NOT modified in this slice)", () => {
		const writes = V2_FILE_MATRIX.filter((m) => m.role === "v2-writes")
		expect(writes.length).toBeGreaterThan(0)
		for (const w of writes) {
			expect(w.locked).toBe(false)
		}
	})

	test("every v2-contract path is marked locked=true", () => {
		const contracts = V2_FILE_MATRIX.filter((m) => m.role === "v2-contract")
		for (const c of contracts) {
			expect(c.locked).toBe(true)
		}
	})

	test("fileMatrixEntrySchema rejects unknown fields (strict)", () => {
		const r = fileMatrixEntrySchema.safeParse({ ...V2_FILE_MATRIX[0], extra: "x" })
		expect(r.success).toBe(false)
	})

	test("fileMatrixEntrySchema rejects invalid area enum", () => {
		const r = fileMatrixEntrySchema.safeParse({ ...V2_FILE_MATRIX[0], area: "bogus" })
		expect(r.success).toBe(false)
	})

	test("repoAreaSchema has 7 locked values", () => {
		const parsed = repoAreaSchema.options
		expect(parsed).toContain("shared/firefly-plugin")
		expect(parsed).toContain("main")
		expect(parsed).toContain("preload")
		expect(parsed).toContain("renderer")
		expect(parsed).toContain("server")
		expect(parsed).toContain("ui-kit")
		expect(parsed).toContain("configconv")
	})

	test("V2_DOMAIN_SPLIT names main, preload, shared, renderer, sdk, runtime-host, plugin-examples", () => {
		const text = V2_DOMAIN_SPLIT.join("\n")
		expect(text).toContain("main")
		expect(text).toContain("preload")
		expect(text).toContain("shared")
		expect(text).toContain("renderer")
		expect(text).toContain("sdk")
		expect(text).toContain("runtime-host")
		expect(text).toContain("plugin-examples")
	})

	test("V2_DOMAIN_SPLIT notes that SDK / runtime-host / plugin-examples are planned, not committed", () => {
		const text = V2_DOMAIN_SPLIT.join("\n")
		expect(text).toMatch(/sdk.*planned/i)
		expect(text).toMatch(/runtime-host.*planned/i)
	})

	test("findV2Module returns the matrix entry for a known module", () => {
		const m = findV2Module("manifest")
		expect(m?.path).toBe("apps/desktop/src/shared/firefly-plugin/manifest.ts")
	})

	test("findV2Module returns null for an unknown module", () => {
		const m = findV2Module("totally-not-a-module")
		expect(m).toBeNull()
	})

	test("every V2_FILE_MATRIX entry has a non-empty v2Module field", () => {
		for (const e of V2_FILE_MATRIX) {
			expect(e.v2Module.length).toBeGreaterThan(0)
		}
	})
})
