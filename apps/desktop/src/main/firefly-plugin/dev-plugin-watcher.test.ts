/**
 * Dev plugin watcher: pure path→pluginId resolution and change→kind
 * classification (the deterministic mapping the watcher applies before
 * it fires a hot-reload event). Plus the debounce + restart-wins
 * behavior over an injected fake fs.watch.
 */

import { describe, expect, test } from "bun:test"

import type { HotReloadEvent } from "../../shared/firefly-plugin/hot-reload"
import {
	classifyWatchChange,
	resolvePluginIdFromWatchPath,
	startDevPluginWatcher,
} from "./dev-plugin-watcher"
import type { HotReloadCycleResult, HotReloadExecutor } from "./hot-reload-executor"

const NOTES = "firefly.built-in.surface.notes"

describe("resolvePluginIdFromWatchPath", () => {
	const ids = [NOTES, "firefly.built-in.surface.review", "acme.notebook"]

	test("matches a packaged id-keyed directory (full id)", () => {
		expect(resolvePluginIdFromWatchPath(`${NOTES}/manifest.json`, ids)).toBe(NOTES)
	})

	test("matches a dev short-dir (id's last segment)", () => {
		expect(resolvePluginIdFromWatchPath("review/worker.mjs", ids)).toBe(
			"firefly.built-in.surface.review",
		)
		expect(resolvePluginIdFromWatchPath("notebook/panel/index.js", ids)).toBe("acme.notebook")
	})

	test("a stray file at the root or an unknown dir resolves to null", () => {
		expect(resolvePluginIdFromWatchPath("README.md", ids)).toBeNull()
		expect(resolvePluginIdFromWatchPath("unknown-dir/manifest.json", ids)).toBeNull()
		expect(resolvePluginIdFromWatchPath("", ids)).toBeNull()
	})
})

describe("classifyWatchChange", () => {
	test("manifest.json → manifest-changed", () => {
		expect(classifyWatchChange(`${NOTES}/manifest.json`)).toBe("manifest-changed")
	})
	test("worker.* → worker-code-changed", () => {
		expect(classifyWatchChange(`${NOTES}/worker.mjs`)).toBe("worker-code-changed")
		expect(classifyWatchChange(`${NOTES}/worker.js`)).toBe("worker-code-changed")
	})
	test("anything else → contribution-changed", () => {
		expect(classifyWatchChange(`${NOTES}/panel/dist/index.js`)).toBe("contribution-changed")
		expect(classifyWatchChange(`${NOTES}/theme.json`)).toBe("contribution-changed")
	})
})

type WatchListener = (eventType: string, filename: string | null) => void

function fakeExecutor(): { executor: HotReloadExecutor; events: HotReloadEvent[] } {
	const events: HotReloadEvent[] = []
	const executor: HotReloadExecutor = {
		execute: (event) => {
			events.push(event)
			const result: HotReloadCycleResult = {
				pluginId: event.pluginId,
				plan: {
					pluginId: event.pluginId,
					startingPhase: "idle",
					policy: "project",
					phaseSequence: [],
					reusesRendererProjection: true,
					reusesOpenCodeProjection: true,
					preservesSessionState: true,
					preservesProjectState: true,
					preservesAppState: true,
					expectedDurationMs: 0,
				},
				outcome: "ready",
				restartedWorker: false,
				reloadRequired: null,
			}
			return result
		},
		listReloadRequired: () => [],
		clearReloadRequired: () => undefined,
	}
	return { executor, events }
}

async function tick(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms))
}

describe("startDevPluginWatcher (debounce + restart-wins)", () => {
	test("debounces a burst of edits into one cycle; restart-class change wins", async () => {
		const { executor, events } = fakeExecutor()
		let listener: WatchListener = () => undefined
		const fakeWatch = ((_root: string, _opts: unknown, cb: WatchListener) => {
			listener = cb
			return { close: () => undefined } as unknown as import("node:fs").FSWatcher
		}) as unknown as typeof import("node:fs").watch

		const watcher = startDevPluginWatcher({
			roots: ["/dev"],
			pluginIds: [NOTES],
			executor,
			debounceMs: 30,
			watch: fakeWatch,
		})

		// Burst: a contribution edit followed by a worker edit in the same window.
		listener("change", `${NOTES}/panel/index.js`)
		listener("change", `${NOTES}/worker.mjs`)
		await tick(60)

		expect(events.length).toBe(1)
		expect(events[0]?.pluginId).toBe(NOTES)
		// restart-class (worker-code-changed) wins over the project-class edit.
		expect(events[0]?.kind).toBe("worker-code-changed")

		watcher.dispose()
	})

	test("ignores changes that do not resolve to a known plugin", async () => {
		const { executor, events } = fakeExecutor()
		let listener: WatchListener = () => undefined
		const fakeWatch = ((_root: string, _opts: unknown, cb: WatchListener) => {
			listener = cb
			return { close: () => undefined } as unknown as import("node:fs").FSWatcher
		}) as unknown as typeof import("node:fs").watch

		const watcher = startDevPluginWatcher({
			roots: ["/dev"],
			pluginIds: [NOTES],
			executor,
			debounceMs: 20,
			watch: fakeWatch,
		})

		listener("change", "some-other-dir/file.js")
		listener("change", null)
		await tick(40)

		expect(events).toEqual([])
		watcher.dispose()
	})

	test("empty roots ⇒ no watchers, dispose is a safe no-op", () => {
		const { executor } = fakeExecutor()
		const watcher = startDevPluginWatcher({ roots: [], pluginIds: [NOTES], executor })
		watcher.dispose()
		watcher.dispose() // idempotent
	})
})
