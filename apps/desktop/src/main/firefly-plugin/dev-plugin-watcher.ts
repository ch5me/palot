/**
 * Firefly Plugin System V2 — dev file watcher (hot-reload trigger)
 *
 * DEV ONLY. Watches the on-disk plugin roots and turns a file change
 * into a `HotReloadEvent`, then drives the hot-reload executor. Never
 * runs in a packaged build (no roots are watched, no dep is required).
 *
 * Uses `node:fs.watch` (recursive) — no new dependency (chokidar is not
 * in package.json and is not needed for a dev-only loop). Each root is a
 * shallow tree (`<root>/<plugin-dir>/...`), so recursive watch on the
 * root catches manifest, worker, and panel/dist edits.
 *
 * Change → kind mapping (plan §8 + hot-reload contract):
 *   - `manifest.json`            → `manifest-changed`   (restart)
 *   - `worker.*`                 → `worker-code-changed` (restart)
 *   - anything else under a dir  → `contribution-changed` (project)
 *
 * Events are debounced per-plugin so a burst of writes from one rebuild
 * collapses into one reload cycle.
 */

import * as fs from "node:fs"
import * as path from "node:path"

import type { HotReloadEvent, HotReloadEventKind } from "../../shared/firefly-plugin/hot-reload"
import type { HotReloadExecutor } from "./hot-reload-executor"

export interface DevPluginWatcherLogger {
	info(message: string, meta?: Record<string, unknown>): void
	warn(message: string, meta?: Record<string, unknown>): void
}

const noopLogger: DevPluginWatcherLogger = {
	info: () => undefined,
	warn: () => undefined,
}

/** Don't keep the host process alive for a debounce timer. Node timers expose
 *  `unref`; DOM-typed environments return a number that has none. */
function unrefTimer(timer: unknown): void {
	if (
		timer !== null &&
		typeof timer === "object" &&
		typeof (timer as { unref?: unknown }).unref === "function"
	) {
		;(timer as { unref: () => void }).unref()
	}
}

export interface DevPluginWatcherDeps {
	/** Disk roots to watch (from `resolvePluginRoots()`). Empty ⇒ no-op. */
	readonly roots: readonly string[]
	/** Catalog plugin ids, so a changed dir resolves to a plugin id. */
	readonly pluginIds: readonly string[]
	/** Runs the reload cycle for a mapped event. */
	readonly executor: HotReloadExecutor
	/** Debounce window per plugin (ms). Defaults to 200ms. */
	readonly debounceMs?: number
	readonly log?: DevPluginWatcherLogger
	/** fs.watch seam (tests inject a fake). */
	readonly watch?: typeof fs.watch
}

export interface DevPluginWatcher {
	/** Stop all watchers + cancel pending debounced cycles. Idempotent. */
	dispose(): void
}

/**
 * Resolve a watch-event filename (relative to a watched root) to a
 * plugin id. The first path segment is the plugin directory; it matches
 * a plugin id either as the full id (packaged id-keyed dir) or as the
 * id's last dotted segment (dev short-dir) — mirroring
 * `discoverPluginWorkerEntries`. Returns null when no segment or no
 * match (e.g. a stray file at the root).
 */
export function resolvePluginIdFromWatchPath(
	relativePath: string,
	pluginIds: readonly string[],
): string | null {
	const normalized = relativePath.split(path.sep).join("/")
	const dir = normalized.split("/").filter(Boolean)[0]
	if (!dir) return null
	for (const id of pluginIds) {
		if (id === dir) return id
		const shortDir = id.split(".").at(-1) ?? id
		if (shortDir === dir) return id
	}
	return null
}

/**
 * Map a changed file's basename to a hot-reload event kind. `null` means
 * "ignore this change" (e.g. an editor swap/temp file with no segment).
 */
export function classifyWatchChange(relativePath: string): HotReloadEventKind {
	const base = path.basename(relativePath).toLowerCase()
	if (base === "manifest.json") return "manifest-changed"
	if (base === "worker.mjs" || base === "worker.js") return "worker-code-changed"
	return "contribution-changed"
}

/**
 * Start the dev plugin watcher. Returns a handle whose `dispose()` tears
 * down every watcher. A packaged build passes empty `roots` and gets a
 * no-op handle (the boot site is the dev gate).
 */
export function startDevPluginWatcher(deps: DevPluginWatcherDeps): DevPluginWatcher {
	const log = deps.log ?? noopLogger
	const debounceMs = deps.debounceMs ?? 200
	const watchFn = deps.watch ?? fs.watch
	const watchers: fs.FSWatcher[] = []
	const pending = new Map<string, { kind: HotReloadEventKind; timer: ReturnType<typeof setTimeout> }>()
	let disposed = false

	function fire(pluginId: string, kind: HotReloadEventKind, source: string): void {
		const event: HotReloadEvent = {
			pluginId,
			kind,
			observedAt: Date.now(),
			source,
		}
		const result = deps.executor.execute(event)
		log.info("Dev watcher ran hot-reload cycle", {
			pluginId,
			kind,
			outcome: result.outcome,
			restartedWorker: result.restartedWorker,
		})
	}

	function schedule(pluginId: string, kind: HotReloadEventKind, source: string): void {
		if (disposed) return
		const existing = pending.get(pluginId)
		if (existing) {
			clearTimeout(existing.timer)
			// A restart-class change wins over a project-class change in the
			// same debounce window (manifest/worker edits force the heavier path).
			if (kind === "contribution-changed" && existing.kind !== "contribution-changed") {
				kind = existing.kind
			}
		}
		const timer = setTimeout(() => {
			pending.delete(pluginId)
			fire(pluginId, kind, source)
		}, debounceMs)
		// Don't keep the host alive for a debounce timer. Node timers expose
		// `unref`; DOM-typed environments return a number with no `unref`.
		unrefTimer(timer)
		pending.set(pluginId, { kind, timer })
	}

	for (const root of deps.roots) {
		if (!fs.existsSync(root)) {
			log.warn("Dev plugin watch root does not exist; skipping", { root })
			continue
		}
		try {
			const watcher = watchFn(root, { recursive: true }, (_eventType, filename) => {
				if (!filename) return
				const relativePath = filename.toString()
				const pluginId = resolvePluginIdFromWatchPath(relativePath, deps.pluginIds)
				if (!pluginId) return
				const kind = classifyWatchChange(relativePath)
				schedule(pluginId, kind, relativePath)
			})
			watchers.push(watcher)
			log.info("Watching plugin root for hot-reload", { root })
		} catch (err) {
			log.warn("Failed to watch plugin root", {
				root,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	return {
		dispose() {
			if (disposed) return
			disposed = true
			for (const { timer } of pending.values()) clearTimeout(timer)
			pending.clear()
			for (const watcher of watchers) {
				try {
					watcher.close()
				} catch {
					// best-effort teardown
				}
			}
			watchers.length = 0
		},
	}
}
