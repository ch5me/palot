import { useAtomValue } from "jotai"
import { useEffect } from "react"
import { activeServerConfigAtom, serverConnectedAtom } from "../atoms/connection"
import { discoveryAtom } from "../atoms/discovery"
import { isMockModeAtom } from "../atoms/mock-mode"
import { appStore } from "../atoms/store"
import { createLogger } from "../lib/logger"
import type { OpenCodeProject } from "../lib/types"
import {
	resolveAuthHeader,
	resolveServerUrl,
	subscribeToActiveOpenCodeSessionEvents,
} from "../services/backend"
import {
	connectToOpenCode,
	loadAllProjects,
	loadProjectSessions,
	syncActiveSessionPresence,
} from "../services/connection-manager"

const log = createLogger("discovery")
const ACTIVE_SESSION_FALLBACK_POLL_MS = 30_000
const POST_PAINT_DISCOVERY_DELAY_MS = 150

const FOCUSED_PROJECT_LIMIT = 10
const PRELOADED_PROJECT_LIMIT = 3

function isDiscoveryNoiseProject(project: OpenCodeProject): boolean {
	const worktree = project.worktree?.trim()
	if (!worktree) return true
	if (worktree === "/") return true
	if (worktree === "/tmp" || worktree.startsWith("/tmp/")) return true
	if (worktree === "/private/tmp" || worktree.startsWith("/private/tmp/")) return true
	if (worktree.includes("/.minimax/agents/")) return true

	const name = project.name ?? worktree.split("/").pop() ?? worktree
	if (name.startsWith("opencode-test-")) return true

	return false
}

function getFocusedProjects(projects: OpenCodeProject[]): OpenCodeProject[] {
	return [...projects]
		.filter((project) => !isDiscoveryNoiseProject(project))
		.sort((a, b) => (b.time.updated ?? 0) - (a.time.updated ?? 0))
		.slice(0, FOCUSED_PROJECT_LIMIT)
}

function scheduleAfterFirstPaint(callback: () => void): () => void {
	let cancelled = false
	let timeoutId: number | null = null

	const scheduleTimeout = () => {
		timeoutId = window.setTimeout(() => {
			if (!cancelled) callback()
		}, POST_PAINT_DISCOVERY_DELAY_MS)
	}

	if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
		window.requestAnimationFrame(() => {
			if (!cancelled) scheduleTimeout()
		})
	} else {
		scheduleTimeout()
	}

	return () => {
		cancelled = true
		if (timeoutId !== null) {
			window.clearTimeout(timeoutId)
		}
	}
}

// Module-level guard to prevent concurrent discovery runs.
// The Jotai atom guard (loaded/loading) depends on a React re-render
// to propagate, which can race with React Strict Mode double-effects
// or fast re-mounts.
let discoveryInFlight = false

/** Reset the discovery guard so discovery can re-run (used when switching servers or exiting mock mode). */
export function resetDiscoveryGuard(): void {
	discoveryInFlight = false
}

/** Helper to update the discovery phase without touching other fields. */
function setPhase(phase: import("../atoms/discovery").DiscoveryPhase): void {
	appStore.set(discoveryAtom, (prev) => ({ ...prev, phase }))
}

/**
 * API-first discovery hook.
 *
 * On mount:
 * 1. Resolves the active server URL (spawns local or uses remote URL)
 * 2. Resolves auth credentials if the server requires them
 * 3. Connects to the OpenCode server (SSE events for all projects)
 * 4. Lists all projects from the API via `client.project.list()`
 * 5. Loads sessions for the top few most-recently-active projects
 *    (enough to populate "Recent" and "Active Now" sections)
 *
 * Remaining project sessions are loaded lazily when expanded in the sidebar.
 * Active sessions also arrive in real-time via SSE events.
 */
export function useDiscovery() {
	const discovery = useAtomValue(discoveryAtom)
	const isMockMode = useAtomValue(isMockModeAtom)
	const activeServer = useAtomValue(activeServerConfigAtom)
	const serverConnected = useAtomValue(serverConnectedAtom)
	const { loaded, loading } = discovery
	const discoveryReady = loaded || discovery.phase === "ready"

	useEffect(() => {
		// In mock mode, atoms are hydrated by useMockMode() -- skip real discovery
		if (isMockMode) return
		if (loaded || loading || discoveryInFlight) return
		discoveryInFlight = true

		// Set loading
		appStore.set(discoveryAtom, (prev) => ({
			...prev,
			loading: true,
			error: null,
			phase: "starting-server",
		}))

		;(async () => {
			try {
				// --- Step 1: Resolve the server URL ---
				log.info("Resolving server URL...", {
					server: activeServer.name,
					type: activeServer.type,
				})
				const url = await resolveServerUrl(activeServer)

				// --- Step 2: Resolve auth if needed ---
				const authHeader = await resolveAuthHeader(activeServer)

				// --- Step 3: Connect to the server (starts SSE event loop) ---
				setPhase("connecting")
				log.info("Connecting to OpenCode server", {
					url,
					server: activeServer.name,
					authenticated: !!authHeader,
				})
				await connectToOpenCode(url, authHeader)

				// --- Step 3b: Bail if server is unreachable ---
				// connectToOpenCode runs a health check and sets serverConnectedAtom.
				// If the server is offline, skip project/session loading so discovery
				// stays in a non-loaded state, allowing the sidebar to show "Server offline".
				// Keep discoveryInFlight = true to prevent an infinite retry loop;
				// resetDiscoveryGuard() (called on server switch) clears it.
				if (!appStore.get(serverConnectedAtom)) {
					log.warn("Server is unreachable, skipping project discovery", {
						server: activeServer.name,
					})
					appStore.set(discoveryAtom, (prev) => ({
						...prev,
						loading: false,
						error: "Server offline",
						phase: "error",
					}))
					return
				}

				// --- Step 4: Discover projects from the API ---
				setPhase("loading-projects")
				log.info("Loading projects from API...")
				const projects = await loadAllProjects()
				const focusedProjects = getFocusedProjects(projects)
				const existingBootstrapDirectories = appStore.get(discoveryAtom).bootstrapDirectories ?? []
				const projectSandboxMap = new Map<string, Set<string>>()
				for (const project of projects) {
					if (!project.worktree || !project.sandboxes?.length) continue
					const sandboxSet = new Set<string>()
					for (const s of project.sandboxes) sandboxSet.add(s)
					projectSandboxMap.set(project.worktree, sandboxSet)
				}
				const bootstrapProjects = projects.filter((project) => {
					const worktree = project.worktree?.trim()
					return !!worktree && existingBootstrapDirectories.includes(worktree)
				})
				const discoveredProjects = new Map<string, OpenCodeProject>()
				for (const project of [...focusedProjects, ...bootstrapProjects]) {
					if (!project.worktree) continue
					discoveredProjects.set(project.worktree, project)
				}
				const projectsToKeep = Array.from(discoveredProjects.values())
				log.info("Discovered projects via API", {
					totalCount: projects.length,
					focusedCount: focusedProjects.length,
					bootstrapCount: bootstrapProjects.length,
				})

				appStore.set(discoveryAtom, {
					loaded: true,
					loading: false,
					error: null,
					phase: "ready",
					projects: projectsToKeep,
					bootstrapDirectories: existingBootstrapDirectories,
				})

				const preloadProjects = new Map<string, OpenCodeProject>()
				for (const project of focusedProjects.slice(0, PRELOADED_PROJECT_LIMIT)) {
					if (!project.worktree) continue
					preloadProjects.set(project.worktree, project)
				}
				for (const project of bootstrapProjects) {
					if (!project.worktree) continue
					preloadProjects.set(project.worktree, project)
				}

				const projectsToPreload = Array.from(preloadProjects.values())
				if (projectsToPreload.length > 0) {
					scheduleAfterFirstPaint(() => {
						void Promise.allSettled(
							projectsToPreload.map((project) => {
								const sandboxDirs = projectSandboxMap.get(project.worktree!)
								return loadProjectSessions(
									project.worktree!,
									sandboxDirs?.size ? sandboxDirs : undefined,
									{ limit: 5, roots: true },
								)
							}),
						)
					})
				}

				log.info("Discovery complete", {
					server: activeServer.name,
					url,
					totalProjects: projects.length,
					focusedProjects: focusedProjects.length,
				})
			} catch (err) {
				log.error("Discovery failed", err)
				discoveryInFlight = false
				appStore.set(discoveryAtom, (prev) => ({
					...prev,
					loading: false,
					error: err instanceof Error ? err.message : "Discovery failed",
					phase: "error",
				}))
			}
		})()
	}, [loaded, loading, isMockMode, activeServer])

	useEffect(() => {
		if (isMockMode) return
		if (activeServer.type !== "local") return
		if (!serverConnected || !discoveryReady) return

		let cancelDeferredStart = () => {}
		let unsubscribe = () => {}
		let intervalId: number | null = null

		cancelDeferredStart = scheduleAfterFirstPaint(() => {
			void syncActiveSessionPresence()
			unsubscribe = subscribeToActiveOpenCodeSessionEvents({
				onError: (message) => {
					if (message !== "active session stream unavailable") {
						log.warn("Active OpenCode session stream error", { message })
					}
				},
				onSnapshot: (snapshot) => {
					void syncActiveSessionPresence(snapshot)
				},
			})

			intervalId = window.setInterval(() => {
				void syncActiveSessionPresence()
			}, ACTIVE_SESSION_FALLBACK_POLL_MS)
		})

		return () => {
			cancelDeferredStart()
			unsubscribe()
			if (intervalId !== null) {
				window.clearInterval(intervalId)
			}
		}
	}, [isMockMode, activeServer.id, activeServer.type, serverConnected, discoveryReady])
}
