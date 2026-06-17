/**
 * Firefly Plugin System V2 — worker supervisor boot wiring
 *
 * Glues the tested pieces together for the live app: catalog authority
 * (which plugins exist + lifecycle overlay) → worker entry discovery on
 * the same disk roots the manifest loader scans → one supervised
 * `worker_thread` per plugin that ships a worker entry.
 *
 * Worker entry layout (plan §2.3):
 *   - packaged: `<resources>/plugins/<plugin-id>/worker.mjs` (id-keyed,
 *     emitted by `scripts/build-plugins.ts`)
 *   - dev:      `apps/desktop/plugins/<dir>/worker.mjs` where `<dir>` is
 *     the plugin directory (the id's last segment for built-ins, e.g.
 *     `plugins/notes/` for `firefly.built-in.surface.notes`)
 *   - installed: `<unpackedPath>/worker.mjs` (content-addressed; F3 path)
 *
 * A plugin with no worker entry is panel/command/tool-only — that is the
 * normal case for the current built-ins and NOT an error. Quarantine
 * decisions made by the locked supervision reducer persist into the
 * same durable lifecycle store the UI-crash path uses, so the operator
 * surface shows one truth.
 *
 * Spawn gate (security, §7, B1+F3): workers are bare unsandboxed Node —
 * the broker only gates host-mediated RPC, not raw `require('fs')` inside
 * the worker. Therefore the spawn itself is the real trust boundary:
 * `registerInstalledExtensionWorker` refuses to activate a `node-worker`
 * unless `trustTier === "signed-third-party"` AND
 * `signatureState === "verified"` (or `trustTier === "local-dev"` for
 * allow-unsigned-with-consent local dev). No silent fallbacks.
 */

import * as fs from "node:fs"
import * as path from "node:path"

import { createLogger } from "../logger"
import {
	getPluginCatalog,
	getPluginLifecycleStore,
	refreshPluginCatalogAsync,
	resolvePluginRoots,
} from "./authority"
import {
	createPluginWorkerSupervisor,
	type PluginWorkerSupervisor,
	type QuarantineStore,
	type SpawnPluginWorker,
} from "./worker-supervisor"
import { createWorkerThreadSpawner } from "./worker-thread-spawner"
import { createUtilityProcessSpawner } from "./utility-process-spawner"
import { createBootWorkerRequestHandler } from "./worker-request-handler"
import { getHostGrantStore } from "./grant-store"
import { setWorkerInvokeRouter, createWorkerInvokeRouter } from "./worker-invoke-router"

const log = createLogger("firefly-plugin/supervisor-boot")

/** Cap a leaking plugin's heap so it OOMs itself, not the host. */
const DEFAULT_WORKER_HEAP_MB = 256

export interface DiscoveredWorkerEntry {
	readonly pluginId: string
	readonly entryPath: string
}

const WORKER_ENTRY_FILENAMES = ["worker.mjs", "worker.js"] as const

/**
 * Find the worker entry for each plugin id. Deterministic: roots in
 * input order, id-keyed directory before short-dir, `.mjs` before `.js`;
 * first hit wins. Pure given the injected `existsSync`.
 *
 * F3 extension: also accepts explicit `installedEntryPaths` (content-addressed
 * `<unpackedPath>/worker.mjs`) that are prepended before disk-root scanning.
 * This covers the app-restart-after-install path; the live post-boot path uses
 * `registerInstalledExtensionWorker` directly.
 */
export function discoverPluginWorkerEntries(input: {
	pluginIds: readonly string[]
	roots: readonly string[]
	existsSync?: (p: string) => boolean
	joinPath?: (...parts: string[]) => string
	/** Extra pre-resolved entry paths keyed by pluginId (installed extensions). */
	installedEntryPaths?: ReadonlyMap<string, string>
}): DiscoveredWorkerEntry[] {
	const existsSync = input.existsSync ?? ((p: string) => fs.existsSync(p))
	const joinPath = input.joinPath ?? ((...parts: string[]) => parts.join("/"))
	const installedEntryPaths = input.installedEntryPaths ?? new Map<string, string>()
	const entries: DiscoveredWorkerEntry[] = []
	for (const pluginId of input.pluginIds) {
		// F3: prefer a content-addressed installed path when present.
		const installedPath = installedEntryPaths.get(pluginId)
		if (installedPath) {
			if (existsSync(installedPath)) {
				entries.push({ pluginId, entryPath: installedPath })
				continue
			}
		}

		const shortDir = pluginId.split(".").at(-1) ?? pluginId
		const candidateDirs = shortDir === pluginId ? [pluginId] : [pluginId, shortDir]
		let found: string | null = null
		for (const root of input.roots) {
			for (const dir of candidateDirs) {
				for (const filename of WORKER_ENTRY_FILENAMES) {
					const candidate = joinPath(root, dir, filename)
					if (existsSync(candidate)) {
						found = candidate
						break
					}
				}
				if (found) break
			}
			if (found) break
		}
		if (found) entries.push({ pluginId, entryPath: found })
	}
	return entries
}

/**
 * Quarantine store adapter: supervision-reducer quarantine decisions
 * land in the durable lifecycle store (same file as UI-crash
 * quarantine), so the catalog overlay and operator surface reflect
 * worker quarantines without a second source of truth.
 */
function lifecycleQuarantineStore(): QuarantineStore {
	return {
		write: (record) => {
			getPluginLifecycleStore().quarantine(
				record.pluginId,
				`worker quarantined (${record.reason}): ${record.detail}`,
			)
		},
		clear: (pluginId) => {
			getPluginLifecycleStore().releaseQuarantine(pluginId, "worker supervisor clear-quarantine")
		},
	}
}

export interface SupervisorBootResult {
	readonly supervisor: PluginWorkerSupervisor
	readonly supervised: readonly DiscoveredWorkerEntry[]
}

export interface SupervisorBootOptions {
	/** Override the disk roots scanned for worker entries (tests). */
	readonly roots?: readonly string[]
	/** Override the worker spawner (tests inject fixture workers). */
	readonly spawnWorker?: Parameters<typeof createPluginWorkerSupervisor>[0]["spawnWorker"]
	/** Override the worker storage/capability request router (tests). */
	readonly onWorkerRequest?: Parameters<typeof createPluginWorkerSupervisor>[0]["onWorkerRequest"]
	/**
	 * Override the activation resolver (tests). In production this is wired to
	 * `getHostGrantStore().resolveGrantedTokens`; tests that inject their own
	 * `spawnWorker` may pass `null` to use the empty-grants default (no DB
	 * required) or a custom resolver to assert capability passing.
	 *
	 * `null`    → use the built-in empty-grants fallback (safe, no DB).
	 * undefined → use the production DB-backed resolver.
	 * function  → use the provided resolver.
	 */
	readonly resolveActivation?: Parameters<typeof createPluginWorkerSupervisor>[0]["resolveActivation"] | null
}

let booted: SupervisorBootResult | null = null

/**
 * Boot the per-plugin worker_thread runtime for every catalog plugin
 * that ships a worker entry. Idempotent: repeat calls return the live
 * instance. Plugins that are disabled or quarantined in the lifecycle
 * store are registered but NOT activated (enable/release activates
 * them through the supervisor API later).
 *
 * Boot wiring (F3):
 *   - Wires `resolveActivation` from `getHostGrantStore().resolveGrantedTokens`
 *     so each spawn receives the correct capability snapshot + scope.
 *   - Installs the `WorkerInvokeRouter` via `setWorkerInvokeRouter` so dispatch
 *     can route to live workers immediately after boot.
 */
export function bootPluginWorkerSupervisor(options: SupervisorBootOptions = {}): SupervisorBootResult {
	if (booted) return booted

	const catalog = getPluginCatalog()
	const roots = options.roots ?? resolvePluginRoots()
	const discovered = discoverPluginWorkerEntries({
		pluginIds: catalog.descriptors.map((d) => d.normalizedId),
		roots: [...roots],
	})

	// Transport selection per §2.3: a plugin whose runtime location resolves to
	// `electron-utility` (node-worker on the electron build) runs in a real
	// Electron utilityProcess; everything else (web-worker dev, tests) uses the
	// worker_threads transport. Resolution comes from the descriptor's
	// runtime-location matrix (P3a). Default to worker_threads — never assume
	// utility for an unknown/unsupported location.
	const workerThreadSpawner = createWorkerThreadSpawner({ maxOldGenerationSizeMb: DEFAULT_WORKER_HEAP_MB })
	const utilityProcessSpawner = createUtilityProcessSpawner({ maxOldGenerationSizeMb: DEFAULT_WORKER_HEAP_MB })
	const selectSpawner: SpawnPluginWorker = (input) => {
		const descriptor = catalog.descriptors.find((d) => d.normalizedId === input.pluginId)
		const location = descriptor?.runtimeResolution.supported ? descriptor.runtimeResolution.location : null
		return location === "electron-utility" ? utilityProcessSpawner(input) : workerThreadSpawner(input)
	}

	const supervisor = createPluginWorkerSupervisor({
		spawnWorker: options.spawnWorker ?? selectSpawner,
		quarantineStore: lifecycleQuarantineStore(),
		// Route worker storage/capability requests to the DB-backed services
		// (lazily resolved). Tests inject their own via options.spawnWorker paths.
		onWorkerRequest: options.onWorkerRequest ?? createBootWorkerRequestHandler(),
		onTransition: (summary, decision) => {
			if (decision.action === "none") return
			log.info("Plugin worker transition", {
				pluginId: summary.pluginId,
				state: summary.state,
				action: decision.action,
			})
		},
		// F3: wire the grant-store activation resolver so each spawned worker
		// receives its granted-capability snapshot + session scope. The stable
		// `resolveGrantedTokens` seam is preserved (C2 contract).
		//
		// Tests may pass `null` to skip the DB and let the supervisor use its
		// built-in empty-grants fallback (no DB required). Tests may pass
		// `undefined` (option absent) to use the production DB-backed path.
		// Production: `options.resolveActivation` is `undefined` → DB-backed path.
		//
		// The production resolver is resilient to DB unavailability: if the grant
		// store cannot be resolved at activation time (DB not yet migrated, test
		// env, early boot), it falls back to empty grants and logs a warning.
		// The deny-by-default broker still protects at dispatch time, so an
		// empty-grants activation is safe — the worker simply cannot invoke any
		// medium+ capabilities until grants are loaded on the next request.
		resolveActivation: options.resolveActivation !== undefined
			? (options.resolveActivation ?? undefined)
			: async (pluginId) => {
				try {
					const store = await getHostGrantStore()
					const grantedCapabilities = await store.resolveGrantedTokens({
						pluginId,
						scope: "session",
					})
					return { grantedCapabilities, sessionScope: "session" as const }
				} catch (err) {
					log.warn(
						"resolveActivation: grant store unavailable — activating with empty grants " +
							"(broker deny-by-default still enforced at dispatch time)",
						{
							pluginId,
							error: err instanceof Error ? err.message : String(err),
						},
					)
					return { grantedCapabilities: [], sessionScope: "session" as const }
				}
			},
	})

	// F3: install the worker invoke router so dispatch can route to live workers.
	setWorkerInvokeRouter(createWorkerInvokeRouter(supervisor, getPluginCatalog))

	const store = getPluginLifecycleStore()
	for (const entry of discovered) {
		const descriptor = catalog.descriptors.find((d) => d.normalizedId === entry.pluginId)
		supervisor.register({
			pluginId: entry.pluginId,
			entryPath: entry.entryPath,
			quarantineOnCrashCount: descriptor?.derived.quarantineOnCrashCount,
		})
		const state = store.get(entry.pluginId)
		if (!state.enabled || state.quarantined) {
			log.info("Plugin worker registered but not activated (lifecycle override)", {
				pluginId: entry.pluginId,
				enabled: state.enabled,
				quarantined: state.quarantined,
			})
			continue
		}
		supervisor.activate(entry.pluginId)
	}

	log.info("Plugin worker supervisor booted", {
		roots,
		workerCount: discovered.length,
		workerPluginIds: discovered.map((d) => d.pluginId),
	})

	booted = { supervisor, supervised: discovered }
	return booted
}

/** Singleton accessor for IPC/operator paths. Null before boot. */
export function getBootedPluginWorkerSupervisor(): PluginWorkerSupervisor | null {
	return booted?.supervisor ?? null
}

/** Teardown for app quit. Idempotent. */
export async function disposePluginWorkerSupervisor(): Promise<void> {
	if (!booted) return
	const current = booted
	booted = null
	await current.supervisor.dispose()
	log.info("Plugin worker supervisor disposed")
}

/** Test hook. */
export function _resetSupervisorBootForTests(): void {
	booted = null
}

// ---------------------------------------------------------------------------
// F3 — Live post-boot worker registration
// ---------------------------------------------------------------------------

/**
 * Describes an installed extension as needed by the spawn gate + live
 * registration. Matches the shape available from the extension store after
 * a successful install (F1 persists these fields).
 */
export interface InstalledExtensionForRegistration {
	/** Unique installation record id. */
	readonly installationId: string
	/** Content-addressed unpacked directory (where `worker.mjs` lives). */
	readonly unpackedPath: string
	/** Trust tier derived by A2 (`derivePackageTrust`). */
	readonly trustTier: string
	/** Signature verification state from A2. */
	readonly signatureState: string
	/** Plugin id from the manifest (`pluginManifest.normalizedId`). */
	readonly pluginId: string
	/** Whether this installation is currently enabled. */
	readonly enabled: boolean
}

/**
 * Allowed trust combinations for node-worker activation.
 *
 * Spawn gate (security, §B1+F3, §7): workers are bare unsandboxed Node; the
 * broker only gates host-mediated RPC. Therefore the SPAWN is the real trust
 * boundary. Only verified signed-third-party extensions (or local-dev with
 * allow-unsigned-with-consent) may be activated. All others are
 * registered-but-never-activated (fail-loud on missing `worker.mjs`).
 */
function isSpawnAllowed(trustTier: string, signatureState: string): boolean {
	if (trustTier === "signed-third-party" && signatureState === "verified") return true
	// Local-dev / allow-unsigned-with-consent path (no signature required in
	// dev; explicit allow). Never enabled in packaged builds — the trust-anchor
	// registry's `devOnly` suppression (A1) closes that surface.
	if (trustTier === "local-dev") return true
	return false
}

/** Injectable deps for `registerInstalledExtensionWorker` (test seam). */
export interface RegisterInstalledExtensionWorkerDeps {
	/**
	 * Async catalog refresh called after register. Defaults to
	 * `refreshPluginCatalogAsync` from authority. Inject a no-op in tests
	 * that do not have a real DB (the real refresh reads the install DB).
	 */
	refreshCatalog?: () => Promise<unknown>
}

/**
 * Register a freshly-installed extension worker on the already-booted
 * supervisor singleton WITHOUT requiring an app restart (F3).
 *
 * Must be called AFTER `bootPluginWorkerSupervisor` has run (throws if not).
 *
 * Spawn gate: refuses to activate a `node-worker` unless the install's trust
 * tier + signature state satisfy the allowed combinations above. Unverified
 * or unsigned installs are registered (so lifecycle tooling can see them)
 * but NEVER activated. Fail-loud if the install has no `worker.mjs`.
 *
 * Calls `refreshPluginCatalogAsync()` after registering so the catalog
 * (projection, dispatch routing) immediately reflects the new extension.
 *
 * @param installation - shape from the install store after F1 persist step.
 * @param deps - injectable test seams (optional in production).
 */
export async function registerInstalledExtensionWorker(
	installation: InstalledExtensionForRegistration,
	deps?: RegisterInstalledExtensionWorkerDeps,
): Promise<void> {
	if (!booted) {
		throw new Error(
			`registerInstalledExtensionWorker: supervisor not yet booted — ` +
				`call bootPluginWorkerSupervisor() first`,
		)
	}

	const { supervisor } = booted
	const { installationId, unpackedPath, trustTier, signatureState, pluginId, enabled } = installation

	// Resolve and validate the worker entry. Fail-loud if missing — a node-worker
	// install with no worker.mjs is a packaging error, not a soft skip.
	const workerPath = path.join(unpackedPath, "worker.mjs")
	if (!fs.existsSync(workerPath)) {
		throw new Error(
			`registerInstalledExtensionWorker: worker.mjs not found at ` +
				`${workerPath} for installation ${installationId} (pluginId=${pluginId}). ` +
				`This is a packaging error — the extension bundle must include worker.mjs.`,
		)
	}

	// Register on the booted singleton. Idempotent if already registered.
	supervisor.register({
		pluginId,
		entryPath: workerPath,
		trustTier,
		signatureState,
	})

	// Refresh the catalog so projections, dispatch routing, and the renderer all
	// pick up the new extension without an app restart (F2 bridge).
	const doRefresh = deps?.refreshCatalog ?? refreshPluginCatalogAsync
	await doRefresh()

	// Spawn gate: only activate if the install satisfies the trust requirements.
	if (!enabled) {
		log.info("Installed extension registered but not activated (disabled)", {
			pluginId,
			installationId,
		})
		return
	}

	if (!isSpawnAllowed(trustTier, signatureState)) {
		log.warn(
			"Installed extension registered but NOT activated — spawn gate: " +
				"node-worker requires trustTier=signed-third-party + signatureState=verified " +
				"(or local-dev). This is a security enforcement, not an error in the supervisor.",
			{
				pluginId,
				installationId,
				trustTier,
				signatureState,
			},
		)
		return
	}

	log.info("Activating installed extension worker (spawn gate passed)", {
		pluginId,
		installationId,
		trustTier,
		signatureState,
	})
	supervisor.activate(pluginId)
}
