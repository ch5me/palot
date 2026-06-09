import { describe, expect, test } from "bun:test"

import { buildPluginCatalog } from "./catalog"
import {
	createPluginLifecycleStateStore,
	type PluginLifecycleStateIo,
} from "./lifecycle-state"

function memoryIo(initial: string | null = null): PluginLifecycleStateIo & { content: () => string | null } {
	let stored = initial
	return {
		read: () => stored,
		write: (content) => {
			stored = content
		},
		content: () => stored,
	}
}

describe("plugin lifecycle state store", () => {
	test("defaults: enabled, not quarantined", () => {
		const store = createPluginLifecycleStateStore({ io: memoryIo() })
		const state = store.get("firefly.built-in.surface.notes")
		expect(state.enabled).toBe(true)
		expect(state.quarantined).toBe(false)
	})

	test("setEnabled persists and notifies", () => {
		const io = memoryIo()
		const store = createPluginLifecycleStateStore({ io })
		let notified = 0
		store.subscribe(() => {
			notified += 1
		})
		store.setEnabled("firefly.built-in.surface.notes", false)
		expect(store.get("firefly.built-in.surface.notes").enabled).toBe(false)
		expect(notified).toBe(1)
		expect(io.content()).toContain("firefly.built-in.surface.notes")

		// A fresh store from the same io restores the override.
		const restored = createPluginLifecycleStateStore({ io })
		expect(restored.get("firefly.built-in.surface.notes").enabled).toBe(false)
	})

	test("UI crashes below threshold do not quarantine; reaching it does", () => {
		let clock = 1_000
		const store = createPluginLifecycleStateStore({ io: memoryIo(), now: () => clock })
		const id = "firefly.built-in.surface.notes"
		expect(store.reportUiCrash(id, "boom 1", { threshold: 3 }).quarantined).toBe(false)
		clock += 100
		expect(store.reportUiCrash(id, "boom 2", { threshold: 3 }).quarantined).toBe(false)
		clock += 100
		const third = store.reportUiCrash(id, "boom 3", { threshold: 3 })
		expect(third.quarantined).toBe(true)
		expect(third.quarantineDetail).toContain("renderer panel crashes")
	})

	test("crashes outside the window age out", () => {
		let clock = 1_000
		const store = createPluginLifecycleStateStore({ io: memoryIo(), now: () => clock })
		const id = "acme.flaky"
		store.reportUiCrash(id, "old", { threshold: 2, windowMs: 500 })
		clock += 10_000
		const result = store.reportUiCrash(id, "new", { threshold: 2, windowMs: 500 })
		expect(result.quarantined).toBe(false)
		expect(result.uiCrashCount).toBe(1)
	})

	test("releaseQuarantine clears state and counters", () => {
		const store = createPluginLifecycleStateStore({ io: memoryIo() })
		const id = "acme.flaky"
		store.reportUiCrash(id, "boom", { threshold: 1 })
		expect(store.get(id).quarantined).toBe(true)
		const released = store.releaseQuarantine(id, "operator drill")
		expect(released.quarantined).toBe(false)
		expect(released.uiCrashCount).toBe(0)
	})

	test("corrupt persisted file starts from defaults (loud, non-blocking)", () => {
		const store = createPluginLifecycleStateStore({ io: memoryIo("{nonsense") })
		expect(store.get("anything").enabled).toBe(true)
	})
})

describe("catalog state overrides (lifecycle overlay)", () => {
	test("disabled override flips entry status and projection availability", () => {
		const catalog = buildPluginCatalog({
			appVersion: "0.11.0",
			stateOverrides: {
				"firefly.built-in.palot-bridge": { pluginDisabled: true },
			},
		})
		const entry = catalog.entries.find((e) => e.pluginId === "firefly.built-in.palot-bridge")
		expect(entry?.status).toBe("disabled")
		const commands = catalog.projections.commands.filter(
			(c) => c.pluginId === "firefly.built-in.palot-bridge",
		)
		expect(commands.length).toBeGreaterThan(0)
		for (const command of commands) {
			expect(command.availability.available).toBe(false)
			expect(command.availability.state).toBe("disabled")
		}
	})

	test("quarantined override flips entry status with detail", () => {
		const catalog = buildPluginCatalog({
			appVersion: "0.11.0",
			stateOverrides: {
				"acme.acme-notebook": {
					pluginQuarantined: true,
					quarantineDetail: "3 renderer panel crashes",
				},
			},
		})
		const entry = catalog.entries.find((e) => e.pluginId === "acme.acme-notebook")
		expect(entry?.status).toBe("quarantined")
		expect(entry?.statusDetail).toContain("renderer panel crashes")
		const widgets = catalog.projections.widgets.filter((w) => w.pluginId === "acme.acme-notebook")
		for (const widget of widgets) {
			expect(widget.availability.available).toBe(false)
			expect(widget.availability.state).toBe("quarantined")
		}
	})
})
