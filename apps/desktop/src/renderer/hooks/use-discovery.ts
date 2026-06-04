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
const ACTIVE_SESSION_FALLBACK_POLL_MS = 10_000

const FOCUSED_PROJECT_LIMIT = 10

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

				if (activeServer.type === "local") {
					await syncActiveSessionPresence()
				}

				// --- Step 4: Discover projects from the API ---
				setPhase("loading-projects")
				log.info("Loading projects from API...")
				const projects = await loadAllProjects()
				const focusedProjects = getFocusedProjects(projects)
				log.info("Discovered projects via API", {
					totalCount: projects.length,
					focusedCount: focusedProjects.length,
				})

				// Store only the focused working set.
				// The full OpenCode project list often contains stale test/scratch roots
				// that overwhelm the sidebar. Fresh sessions from outside this set still
				// appear live via SSE because session events seed the store directly.
				appStore.set(discoveryAtom, {
					loaded: true,
					loading: false,
					error: null,
					phase: "ready",
					projects: focusedProjects,
				})

				// --- Step 5: Pre-fetch sessions for the focused projects ---
				// We keep the sidebar small by trimming the project universe, then load
				// root sessions for every focused project so Recent/Active are accurate
				// across that working set on first paint.
				if (focusedProjects.length > 0) {
					// Build sandbox lookup for worktree metadata restoration
					const projectSandboxMap = new Map<string, Set<string>>()
					for (const project of projects) {
						if (!project.worktree || !project.sandboxes?.length) continue
						const sandboxSet = new Set<string>()
						for (const s of project.sandboxes) sandboxSet.add(s)
						projectSandboxMap.set(project.worktree, sandboxSet)
					}

					await Promise.allSettled(
						focusedProjects.map((project) => {
							const sandboxDirs = projectSandboxMap.get(project.worktree!)
							return loadProjectSessions(
								project.worktree!,
								sandboxDirs?.size ? sandboxDirs : undefined,
								{ limit: 5, roots: true },
							)
						}),
					)
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
		if (!serverConnected) return

		void syncActiveSessionPresence()
		const unsubscribe = subscribeToActiveOpenCodeSessionEvents({
			onError: (message) => {
				log.warn("Active OpenCode session stream error", { message })
			},
			onSnapshot: (snapshot) => {
				void syncActiveSessionPresence(snapshot)
			},
		})

		const intervalId = window.setInterval(() => {
			void syncActiveSessionPresence()
		}, ACTIVE_SESSION_FALLBACK_POLL_MS)

		return () => {
			unsubscribe()
			window.clearInterval(intervalId)
		}
	}, [isMockMode, activeServer.id, activeServer.type, serverConnected])
}
