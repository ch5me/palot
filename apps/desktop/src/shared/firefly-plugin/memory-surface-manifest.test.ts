import { describe, expect, test } from "bun:test"

import { derivePluginDescriptor, parsePluginManifest } from "./index"
import {
	memorySurfaceManifest,
	MEMORY_SURFACE_PLUGIN_ID,
} from "./memory-surface-manifest"

describe("memorySurfaceManifest", () => {
	test("parses as a valid V2 manifest", () => {
		const parsed = parsePluginManifest(memorySurfaceManifest)
		expect(parsed.id).toBe(MEMORY_SURFACE_PLUGIN_ID)
	})

	test("derives a valid descriptor for the current app version", () => {
		const parsed = parsePluginManifest(memorySurfaceManifest)
		const descriptor = derivePluginDescriptor(parsed, { appVersion: "0.11.0" })
		expect(descriptor.normalizedId).toBe(MEMORY_SURFACE_PLUGIN_ID)
		expect(descriptor.panels).toHaveLength(1)
		expect(descriptor.tools).toHaveLength(1)
	})

	test("declares the memory side-panel contribution and open tool", () => {
		const parsed = parsePluginManifest(memorySurfaceManifest)
		expect(parsed.contributes.panels).toHaveLength(1)
		expect(parsed.contributes.panels[0]).toMatchObject({
			id: "memory",
			title: "Memory",
			formFactor: "side-panel-tab",
			defaultZone: "side-panel",
			persistenceKey: "side-panel.memory",
			telemetryNamespace: "firefly.surface.memory",
		})
		expect(parsed.contributes.tools[0]?.id).toBe(
			"plugin.firefly.built-in.surface.memory.open",
		)
	})
})
