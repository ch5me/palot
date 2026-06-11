import { expect, mock, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

mock.module("../lib/monaco", () => ({
	initMonaco: () => ({}),
	languageForPath: () => "plaintext",
}))

const { CATALOG_SERVED_SURFACE_IDS, FIREFLY_SURFACE_IDS, FIREFLY_SURFACE_REGISTRY } = await import(
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

test("registry rows plus catalog-served surfaces cover FIREFLY_SURFACE_IDS", () => {
	const covered = [
		...FIREFLY_SURFACE_REGISTRY.map((surface) => surface.id),
		...CATALOG_SERVED_SURFACE_IDS,
	]
	expect(sorted(covered)).toEqual(sorted(FIREFLY_SURFACE_IDS))
})

test("every registry row's enabledFlag.key has a flag atom, default, and label", () => {
	for (const surface of FIREFLY_SURFACE_REGISTRY) {
		const key = surface.enabledFlag.key
		expect(fireflySurfaceFlagAtoms).toHaveProperty(key)
		expect(fireflySurfaceDefaults).toHaveProperty(key)
		expect(fireflySurfaceLabels).toHaveProperty(key)
	}
})

test("flag atom keys match registry enabledFlag keys exactly (no orphan flags)", () => {
	const registryKeys = FIREFLY_SURFACE_REGISTRY.map((surface) => surface.enabledFlag.key)
	expect(sorted(Object.keys(fireflySurfaceFlagAtoms))).toEqual(sorted(registryKeys))
})

test("fireflySurfaceDefaults keys match flag atom keys", () => {
	expect(sorted(Object.keys(fireflySurfaceDefaults))).toEqual(
		sorted(Object.keys(fireflySurfaceFlagAtoms)),
	)
})

test("fireflySurfaceLabels keys match flag atom keys", () => {
	expect(sorted(Object.keys(fireflySurfaceLabels))).toEqual(
		sorted(Object.keys(fireflySurfaceFlagAtoms)),
	)
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
	for (const surface of FIREFLY_SURFACE_REGISTRY) {
		const flagAtom =
			fireflySurfaceFlagAtoms[surface.enabledFlag.key as keyof typeof fireflySurfaceFlagAtoms]
		expect(flagAtom).toBeTruthy()
		expect(typeof flagAtom).toBe("object")
		expect("toString" in flagAtom).toBe(true)
	}
})
