import { expect, mock, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

mock.module("../lib/monaco", () => ({
	initMonaco: () => ({}),
	languageForPath: () => "plaintext",
}))

const { FIREFLY_SURFACE_IDS, FIREFLY_SURFACE_REGISTRY } = await import(
	"../firefly-surface-registry"
)
const {
	fireflySurfaceDefaults,
	fireflySurfaceFlagAtoms,
	fireflySurfaceLabels,
} = await import("../atoms/feature-flags")
const { palotSidePanelTabSchema } = await import(
	"../../shared/firefly-plugin/palot-bridge-manifest"
)
const { sidePanelTabSchema } = await import("../../shared/palot-bridge-schemas")

const sidecarPath = path.join(import.meta.dir, "..", "firefly-surface-registry-ids.json")
const sidecarIds = JSON.parse(readFileSync(sidecarPath, "utf8")) as string[]

function sorted(values: readonly string[]): string[] {
	return [...values].sort()
}

test("registry exposes 18 surface ids", () => {
	expect(FIREFLY_SURFACE_IDS.length).toBe(18)
})

test("registry ids match FIREFLY_SURFACE_IDS", () => {
	expect(new Set(FIREFLY_SURFACE_REGISTRY.map((surface) => surface.id))).toEqual(
		new Set(FIREFLY_SURFACE_IDS),
	)
})

test("fireflySurfaceFlagAtoms keys match FIREFLY_SURFACE_IDS", () => {
	expect(sorted(Object.keys(fireflySurfaceFlagAtoms))).toEqual(sorted(FIREFLY_SURFACE_IDS))
})

test("fireflySurfaceDefaults keys match FIREFLY_SURFACE_IDS", () => {
	expect(sorted(Object.keys(fireflySurfaceDefaults))).toEqual(sorted(FIREFLY_SURFACE_IDS))
})

test("fireflySurfaceLabels keys match FIREFLY_SURFACE_IDS", () => {
	expect(sorted(Object.keys(fireflySurfaceLabels))).toEqual(sorted(FIREFLY_SURFACE_IDS))
})

test("palotSidePanelTabSchema options match FIREFLY_SURFACE_IDS", () => {
	expect(sorted(palotSidePanelTabSchema.options)).toEqual(sorted(FIREFLY_SURFACE_IDS))
})

test("sidePanelTabSchema options match FIREFLY_SURFACE_IDS", () => {
	expect(sorted(sidePanelTabSchema.options)).toEqual(sorted(FIREFLY_SURFACE_IDS))
})

test("registry id sidecar matches FIREFLY_SURFACE_IDS", () => {
	expect(sorted(sidecarIds)).toEqual(sorted(FIREFLY_SURFACE_IDS))
})

test("every surface flag atom is a usable atom object", () => {
	for (const id of FIREFLY_SURFACE_IDS) {
		expect(fireflySurfaceFlagAtoms[id]).toBeTruthy()
		expect(typeof fireflySurfaceFlagAtoms[id]).toBe("object")
		expect("toString" in fireflySurfaceFlagAtoms[id]).toBe(true)
	}
})
