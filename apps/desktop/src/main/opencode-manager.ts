import { execFile, type ChildProcess, spawn } from "node:child_process"
import fs from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import electron from "electron"
import type {
	ActiveOpenCodeSessionPresence,
	ActiveOpenCodeSessionsSnapshot,
	LocalServerConfig,
} from "../preload/api"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import { getCredential } from "./credential-store"
import { ensureLoomBridgeServer } from "./loom-bridge"
import { ensurePalotBridgeServer } from "./palot-browser-ipc"
import { loadPalotPluginModule } from "./palot-opencode-plugin-shim"
import { findFreePort } from "./find-free-port"
import { createLogger } from "./logger"
import { ensurePalotPluginConfig } from "./mcp-connections-config"
import { startNotificationWatcher, stopNotificationWatcher } from "./notification-watcher"
import { PALOT_PLUGIN_ENTRY_RELATIVE_PATH } from "./palot-plugin-entry"
import { getListeningProcessOwner, isCurrentUser, isProcessAlive } from "./process-owner"
import { readLockfile, removeLockfile, writeLockfile } from "./server-lockfile"
import { getSettings } from "./settings-store"
import { waitForEnv } from "./shell-env"

const log = createLogger("opencode-manager")
const ACTIVE_SESSION_STREAM_POLL_MS = 1000

// ============================================================
// Types
// ============================================================

export interface OpenCodeServer {
	url: string
	pid: number | null
	managed: boolean
}

/** Result of detecting an existing server on the target port. */
type DetectionResult =
	| { kind: "found"; server: OpenCodeServer }
	| { kind: "conflict"; url: string; ownerUid: number | null }
	| { kind: "none" }

// ============================================================
// State -- single server
// ============================================================

let singleServer: {
	server: OpenCodeServer
	process: ChildProcess | null
} | null = null

let activeSessionPoller: ReturnType<typeof setInterval> | null = null
let lastActiveSessionSnapshotKey: string | null = null

const DEFAULT_PORT = Number(process.env.OPENCODE_PORT) || 4096
const DEFAULT_HOSTNAME = process.env.OPENCODE_HOSTNAME || "127.0.0.1"

function resolvePalotPluginPath(): string {
	return path.resolve(process.cwd(), PALOT_PLUGIN_ENTRY_RELATIVE_PATH)
}

interface ClientProcess {
	pid: number
	command: string
	directory: string
	startedAtMs: number
	sessionId?: string
	source: "attach" | "plain"
}

const PROCESS_START_GRACE_MS = 5 * 60 * 1000

// ============================================================
// Public API
// ============================================================

/** Reads the local server config from persisted settings. */
function getLocalServerConfig(): LocalServerConfig {
	const settings = getSettings()
	const local = settings.servers.servers.find((s) => s.id === "local")
	return (local as LocalServerConfig) ?? { id: "local", name: "This Mac", type: "local" }
}

/**
 * Ensures the single OpenCode server is running.
 * Starts it if not already running. Returns the server info.
 *
 * Performs ownership checks to prevent connecting to a server owned by a
 * different OS user. If a conflict is detected, prompts the user with a
 * dialog offering to start on a different port or connect anyway.
 */
export async function ensureServer(): Promise<OpenCodeServer> {
	if (singleServer) {
		log.debug("Server already running", {
			url: singleServer.server.url,
			pid: singleServer.server.pid,
		})
		return singleServer.server
	}

	// Ensure the full shell environment is available before spawning the server.
	// startEnvResolution() fires early in app startup; by the time the renderer
	// triggers ensureServer() the promise is usually already resolved.
	await waitForEnv()
	ensurePalotPluginConfig()

	const config = getLocalServerConfig()
	const hostname = config.hostname || DEFAULT_HOSTNAME
	const port = config.port || DEFAULT_PORT

	// --- Fast-path: check our own lockfile first ---
	const lockfile = readLockfile()
	if (lockfile) {
		const lockResult = await handleLockfile(lockfile, hostname)
		if (lockResult) return lockResult
	}

	// --- Probe the target port for an existing server ---
	log.info("Checking for existing server on port", port)
	const detection = await detectExistingServer(hostname, port)

	if (detection.kind === "found") {
		log.info("Detected existing same-user server", { url: detection.server.url })
		singleServer = { server: detection.server, process: null }
		startNotificationWatcher(detection.server.url)
		startActiveSessionBroadcast(detection.server.url)
		return detection.server
	}

	if (detection.kind === "conflict") {
		return handleConflict(detection, hostname, port, config)
	}

	// --- No existing server: spawn one on the configured port ---
	return spawnServer(hostname, port, config)
}

/**
 * Gets the single server URL, or null if not running.
 */
export function getServerUrl(): string | null {
	return singleServer?.server.url ?? null
}

export async function getActiveOpenCodeSessions(): Promise<ActiveOpenCodeSessionsSnapshot> {
	const server = await ensureServer()
	return buildActiveOpenCodeSessionsSnapshot(server.url)
}

/**
 * Stops the single server if we manage it and removes the lockfile.
 */
export function stopServer(): boolean {
	stopNotificationWatcher()
	stopActiveSessionBroadcast()
	if (!singleServer?.process) {
		log.debug("No managed server to stop")
		removeLockfile()
		return false
	}
	log.info("Stopping managed server", { pid: singleServer.process.pid })
	singleServer.process.kill()
	singleServer = null
	removeLockfile()
	return true
}

/**
 * Restarts the managed server (stop + start). Used when local server
 * settings (hostname, port, password) change.
 */
export async function restartServer(): Promise<OpenCodeServer> {
	log.info("Restarting server due to settings change")
	stopServer()
	return ensureServer()
}

// ============================================================
// Internal -- lockfile handling
// ============================================================

/**
 * Attempts to reconnect to a server described by an existing lockfile.
 * Returns an OpenCodeServer if successful, null if the lockfile is stale
 * or the server belongs to a different user (lockfile is cleaned up and
 * the caller should fall through to normal detection).
 */
async function handleLockfile(
	lockfile: { port: number; pid: number; startedAt: string },
	hostname: string,
): Promise<OpenCodeServer | null> {
	if (!isProcessAlive(lockfile.pid)) {
		log.info("Stale lockfile detected (PID dead), cleaning up", {
			pid: lockfile.pid,
			port: lockfile.port,
		})
		removeLockfile()
		return null
	}

	// PID is alive -- verify it's ours
	const owner = await getListeningProcessOwner(lockfile.port)
	if (owner && !isCurrentUser(owner.uid)) {
		log.warn("Lockfile PID is alive but owned by different user", {
			pid: lockfile.pid,
			uid: owner.uid,
		})
		removeLockfile()
		return null // Fall through to normal detection, which will trigger the conflict dialog
	}

	// PID alive + same user: probe to confirm it's actually an opencode server
	const url = `http://${hostname}:${lockfile.port}`
	if (await probeServer(url)) {
		log.info("Reconnecting to server from lockfile", { url, pid: lockfile.pid })
		const server: OpenCodeServer = { url, pid: lockfile.pid, managed: false }
		singleServer = { server, process: null }
		startNotificationWatcher(url)
		startActiveSessionBroadcast(url)
		return server
	}

	// PID alive but not responding on the expected port -- stale lockfile
	log.info("Lockfile PID alive but server not responding, cleaning up", {
		pid: lockfile.pid,
		port: lockfile.port,
	})
	removeLockfile()
	return null
}

// ============================================================
// Internal -- detection with ownership check
// ============================================================

/**
 * Probes the target port for an existing OpenCode server and checks
 * whether the listening process belongs to the current OS user.
 */
async function detectExistingServer(
	hostname: string,
	port: number,
): Promise<DetectionResult> {
	const url = `http://${hostname}:${port}`
	const isResponding = await probeServer(url)
	if (!isResponding) {
		return { kind: "none" }
	}

	// Something is listening -- check who owns it
	const owner = await getListeningProcessOwner(port)

	if (!owner) {
		// Can't determine ownership (Windows, or lsof failed). On Windows this
		// is expected; on macOS/Linux treat as a soft conflict with a less
		// alarming prompt.
		if (process.platform === "win32") {
			log.debug("Existing server responded OK (ownership check skipped on Windows)", { url })
			return { kind: "found", server: { url, pid: null, managed: false } }
		}
		log.warn("Existing server found but could not determine owner", { url })
		return { kind: "conflict", url, ownerUid: null }
	}

	if (isCurrentUser(owner.uid)) {
		log.debug("Existing server belongs to current user", { url, pid: owner.pid, uid: owner.uid })
		return { kind: "found", server: { url, pid: owner.pid, managed: false } }
	}

	log.warn("Existing server belongs to a DIFFERENT user", { url, pid: owner.pid, uid: owner.uid })
	return { kind: "conflict", url, ownerUid: owner.uid }
}

// ============================================================
// Internal -- conflict resolution
// ============================================================

/**
 * Shows a dialog when the server on the target port belongs to a different
 * user. Offers three choices: start on a different port, connect anyway,
 * or cancel.
 */
async function handleConflict(
	conflict: { url: string; ownerUid: number | null },
	hostname: string,
	_configuredPort: number,
	config: LocalServerConfig,
): Promise<OpenCodeServer> {
	const ownerText =
		conflict.ownerUid !== null
			? `It appears to belong to a different user account (UID ${conflict.ownerUid}).`
			: "Its owner could not be determined."

	const { response } = await electron.dialog.showMessageBox({
		type: "warning",
		title: "Server Ownership Conflict",
		message: "An OpenCode server is already running on the configured port.",
		detail:
			`${ownerText}\n\n` +
			"Connecting to a server owned by another user is a security risk: " +
			"they could access your sessions and files.\n\n" +
			"You can start your own server on a different port, or connect anyway " +
			"if you trust this server.",
		buttons: ["Start My Own Server", "Connect Anyway", "Cancel"],
		defaultId: 0,
		cancelId: 2,
	})

	if (response === 0) {
		// Start on a free port
		log.info("User chose to start own server on a different port")
		const freePort = await findFreePort(hostname)
		log.info("Found free port", { freePort })
		return spawnServer(hostname, freePort, config)
	}

	if (response === 1) {
		// Connect anyway (user accepts the risk)
		log.warn("User chose to connect to foreign server anyway", { url: conflict.url })
			const server: OpenCodeServer = { url: conflict.url, pid: null, managed: false }
			singleServer = { server, process: null }
			startNotificationWatcher(conflict.url)
			startActiveSessionBroadcast(conflict.url)
			return server

	}

	// Cancel
	throw new Error("Server connection cancelled by user due to ownership conflict")
}

// ============================================================
// Internal -- server spawning
// ============================================================

/**
 * Spawns a new opencode server process on the given hostname:port.
 * Writes a lockfile on success.
 */
function tokenizeArgs(input: string): string[] {
	const matches = input.match(/"[^"]*"|'[^']*'|\S+/g)
	if (!matches) return []
	return matches.map((token) => {
		if (
			(token.startsWith('"') && token.endsWith('"')) ||
			(token.startsWith("'") && token.endsWith("'"))
		) {
			return token.slice(1, -1)
		}
		return token
	})
}

function readFlag(tokens: string[], name: string): string | undefined {
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]
		if (token === name) return tokens[i + 1]
		if (token.startsWith(`${name}=`)) return token.slice(name.length + 1)
	}
	return undefined
}

function normalizeOrigin(value: string): string | null {
	try {
		const url = new URL(value)
		const port =
			url.port || (url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "")
		return `${url.protocol}//${url.hostname}${port ? `:${port}` : ""}`
	} catch {
		return null
	}
}

async function listClientProcesses(serverUrl: string): Promise<ClientProcess[]> {
	const targetOrigin = normalizeOrigin(serverUrl)
	if (!targetOrigin) {
		throw new Error(`Invalid OpenCode server URL: ${serverUrl}`)
	}

	const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
		execFile(
			"ps",
			["-axo", "pid=,lstart=,command=", "-ww"],
			(err: Error | null, stdout: string) => {
				if (err) {
					reject(err)
					return
				}
				resolve({ stdout })
			},
		)
	})
	const processes: ClientProcess[] = []

	for (const line of stdout.split("\n")) {
		const match = line.match(
			/^\s*(\d+)\s+([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.*)$/,
		)
		if (!match) continue

		const pid = Number(match[1])
		const startedAtMs = Date.parse(match[2])
		const command = match[3]
		if (!Number.isFinite(startedAtMs)) continue
		const firstSpace = command.indexOf(" ")
		const executable = firstSpace === -1 ? command : command.slice(0, firstSpace)
		if (executable !== "opencode" && !executable.endsWith("/opencode")) continue

		const rest = firstSpace === -1 ? "" : command.slice(firstSpace + 1).trim()
		if (!rest) continue

		const tokens = tokenizeArgs(rest)
		if (tokens.length === 0) continue

		const subcommand = tokens[0]
		if (subcommand === "serve" || subcommand === "run") continue

		if (subcommand === "attach") {
			const attachTarget = normalizeOrigin(tokens[1] ?? "")
			if (attachTarget !== targetOrigin) continue

			const sessionId = readFlag(tokens, "--session")
			const directory = readFlag(tokens, "--dir")
			if (!sessionId || !directory) continue

			processes.push({
				pid,
				command,
				directory,
				startedAtMs,
				sessionId,
				source: "attach",
			})
			continue
		}

		const directory = tokens.find((token) => token.startsWith("/"))
		if (!directory) continue

		processes.push({
			pid,
			command,
			directory,
			startedAtMs,
			source: "plain",
		})
	}

	return processes
}

async function listRecentRootSessions(
	serverUrl: string,
	directory: string,
	limit: number,
): Promise<Session[]> {
	try {
		const client = createOpencodeClient({ baseUrl: serverUrl, directory })
		const result = await client.session.list({ roots: true, limit })
		return (result.data as Session[]) ?? []
	} catch {
		return []
	}
}

function buildActiveSessionSnapshotKey(snapshot: ActiveOpenCodeSessionsSnapshot): string {
	const sessions = [...snapshot.sessions]
		.sort((a, b) => a.sessionId.localeCompare(b.sessionId))
		.map((session) => ({
			sessionId: session.sessionId,
			directory: session.directory,
			pid: session.pid,
			source: session.source,
		}))

	return JSON.stringify({
		serverUrl: snapshot.serverUrl,
		clientCount: snapshot.clientCount,
		sessionCount: snapshot.sessionCount,
		sessions,
	})
}

function normalizeActiveSessionPresence(
	sessions: ActiveOpenCodeSessionPresence[],
): ActiveOpenCodeSessionPresence[] {
	return [...sessions].sort((a, b) => a.sessionId.localeCompare(b.sessionId))
}

async function buildActiveOpenCodeSessionsSnapshot(
	serverUrl: string,
): Promise<ActiveOpenCodeSessionsSnapshot> {
	const processes = await listClientProcesses(serverUrl)
	const exactSessions = new Map<string, ActiveOpenCodeSessionPresence>()
	const exactSessionIdsByDirectory = new Map<string, Set<string>>()
	const inferredNeeds = new Map<string, ClientProcess[]>()

	for (const process of processes) {
		if (process.source === "attach" && process.sessionId) {
			exactSessions.set(process.sessionId, {
				sessionId: process.sessionId,
				directory: process.directory,
				pid: process.pid,
				source: "attach",
				command: process.command,
			})

			const existing = exactSessionIdsByDirectory.get(process.directory) ?? new Set<string>()
			existing.add(process.sessionId)
			exactSessionIdsByDirectory.set(process.directory, existing)
			continue
		}

		const existing = inferredNeeds.get(process.directory) ?? []
		existing.push(process)
		inferredNeeds.set(process.directory, existing)
	}

	const inferredBatches = await Promise.all(
		Array.from(inferredNeeds.entries()).map(async ([directory, directoryProcesses]) => {
			const claimed = exactSessionIdsByDirectory.get(directory) ?? new Set<string>()
			const limit = Math.max(directoryProcesses.length + claimed.size + 5, 10)
			const sessions = await listRecentRootSessions(serverUrl, directory, limit)
			const remaining = sessions.filter((session) => !claimed.has(session.id))
			const next: ActiveOpenCodeSessionPresence[] = []

			for (const process of [...directoryProcesses].sort((a, b) => b.startedAtMs - a.startedAtMs)) {
				if (remaining.length === 0) break

				const bounded = remaining.filter(
					(session) => session.time.created <= process.startedAtMs + PROCESS_START_GRACE_MS,
				)
				const chosen = bounded[0]
				if (!chosen) continue

				next.push({
					sessionId: chosen.id,
					directory,
					pid: process.pid,
					source: "inferred",
					command: process.command,
				})

				const index = remaining.findIndex((session) => session.id === chosen.id)
				if (index >= 0) remaining.splice(index, 1)
			}

			return next
		}),
	)

	const uniqueSessions = new Map<string, ActiveOpenCodeSessionPresence>()
	for (const entry of exactSessions.values()) uniqueSessions.set(entry.sessionId, entry)
	for (const batch of inferredBatches) {
		for (const entry of batch) {
			if (!uniqueSessions.has(entry.sessionId)) {
				uniqueSessions.set(entry.sessionId, entry)
			}
		}
	}

	return {
		serverUrl,
		clientCount: processes.length,
		sessionCount: uniqueSessions.size,
		sessions: normalizeActiveSessionPresence(Array.from(uniqueSessions.values())),
		refreshedAt: Date.now(),
	}
}

async function broadcastActiveSessionSnapshot(serverUrl: string): Promise<void> {
	const snapshot = await buildActiveOpenCodeSessionsSnapshot(serverUrl)
	const nextKey = buildActiveSessionSnapshotKey(snapshot)
	if (nextKey === lastActiveSessionSnapshotKey) return
	lastActiveSessionSnapshotKey = nextKey
	for (const win of electron.BrowserWindow.getAllWindows()) {
		win.webContents.send("opencode:active-sessions", snapshot)
	}
}

function stopActiveSessionBroadcast(): void {
	if (activeSessionPoller) {
		clearInterval(activeSessionPoller)
		activeSessionPoller = null
	}
	lastActiveSessionSnapshotKey = null
}

function startActiveSessionBroadcast(serverUrl: string): void {
	stopActiveSessionBroadcast()
	void broadcastActiveSessionSnapshot(serverUrl).catch((err) => {
		log.error("Initial active session snapshot failed", err)
	})
	activeSessionPoller = setInterval(() => {
		void broadcastActiveSessionSnapshot(serverUrl).catch((err) => {
			log.error("Active session snapshot poll failed", err)
		})
	}, ACTIVE_SESSION_STREAM_POLL_MS)
}

async function appendPalotPlugin(env: NodeJS.ProcessEnv & { OPENCODE_PLUGIN?: string }): Promise<void> {
	const pluginPath = resolvePalotPluginPath()
	if (!fs.existsSync(pluginPath)) {
		log.warn("Palot bridge plugin file missing", { pluginPath })
		return
	}
	const bridgeServer = await ensurePalotBridgeServer()
	const loomBridge = await ensureLoomBridgeServer()
	await loadPalotPluginModule(pluginPath)
	env.OPENCODE_PLUGIN = [env.OPENCODE_PLUGIN, pluginPath].filter(Boolean).join(",")
	env.PALOT_BRIDGE_URL = `http://${bridgeServer.host}:${bridgeServer.port}${bridgeServer.path}`
	env.PALOT_BRIDGE_TOKEN = bridgeServer.token
	env.LOOM_RUNTIME_URL = `ws://${loomBridge.host}:${loomBridge.port}`
}

async function spawnServer(
	hostname: string,
	port: number,
	config: LocalServerConfig,
): Promise<OpenCodeServer> {
	// Build PATH with ~/.opencode/bin prepended so we find the opencode binary
	const opencodeBinDir = path.join(homedir(), ".opencode", "bin")
	const sep = process.platform === "win32" ? ";" : ":"
	const augmentedPath = `${opencodeBinDir}${sep}${process.env.PATH ?? ""}`

	// Build CLI args
	const args = ["serve", `--hostname=${hostname}`, `--port=${port}`]

	// Add password if configured
	if (config.hasPassword) {
		const password = getCredential("local")
		if (password) {
			args.push(`--password=${password}`)
		}
	}

	// Add mDNS flags if enabled
	if (config.mdns) {
		args.push("--mdns")
		if (config.mdnsDomain) {
			args.push(`--mdns-domain=${config.mdnsDomain}`)
		}
	}

	const spawnEnv: NodeJS.ProcessEnv & { OPENCODE_PLUGIN?: string } = {
		...process.env,
		PATH: augmentedPath,
	}
	await appendPalotPlugin(spawnEnv)

	log.info("Spawning opencode server", {
		hostname,
		port,
		hasPassword: !!config.hasPassword,
		mdns: !!config.mdns,
		binDir: opencodeBinDir,
		hasPalotPlugin: Boolean(spawnEnv.OPENCODE_PLUGIN),
	})

	const proc = spawn("opencode", args, {
		cwd: homedir(),
		stdio: "pipe",
		env: spawnEnv,
	})

	const url = `http://${hostname}:${port}`
	const server: OpenCodeServer = {
		url,
		pid: proc.pid ?? null,
		managed: true,
	}

	singleServer = { server, process: proc }
	startActiveSessionBroadcast(url)

	// Capture stdout/stderr for diagnostics
	proc.stdout?.on("data", (data: Buffer) => {
		const text = data.toString().trim()
		if (text) log.debug(`[stdout] ${text}`)
	})

	proc.stderr?.on("data", (data: Buffer) => {
		const text = data.toString().trim()
		if (text) log.warn(`[stderr] ${text}`)
	})

	// Handle spawn errors (e.g. binary not found)
	proc.on("error", (err) => {
		log.error("Failed to spawn opencode process", err)
		if (singleServer?.process === proc) {
			singleServer = null
			removeLockfile()
		}
	})

	// Clean up on exit -- allow lazy restart on next request
	proc.on("exit", (code, signal) => {
		log.info("opencode server exited", { code, signal })
		stopNotificationWatcher()
		stopActiveSessionBroadcast()
		singleServer = null
		removeLockfile()
	})


	// Wait for the server to be ready
	await waitForReady(url, 15_000)

	// Write lockfile after successful start
	if (proc.pid) {
		writeLockfile(port, proc.pid)
	}

	log.info("Server started successfully", { url, pid: proc.pid })
	startNotificationWatcher(url)
	return server
}

// ============================================================
// Internal -- HTTP probe & readiness
// ============================================================

/** Quick probe to check if a server responds on the given URL. */
async function probeServer(url: string): Promise<boolean> {
	try {
		const res = await fetch(`${url}/session`, {
			signal: AbortSignal.timeout(2000),
		})
		if (res.ok) {
			log.debug("Server probe OK", { url })
			return true
		}
		log.debug("Server probe returned error status", { url, status: res.status })
	} catch (err) {
		log.debug("Server probe failed", { url, reason: String(err) })
	}
	return false
}

async function waitForReady(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now()
	let attempts = 0
	while (Date.now() - start < timeoutMs) {
		attempts++
		try {
			const res = await fetch(`${url}/session`, {
				signal: AbortSignal.timeout(1000),
			})
			if (res.ok) {
				log.debug("Server ready", { url, attempts, elapsed: Date.now() - start })
				return
			}
			log.debug("Server not ready yet", { url, status: res.status, attempts })
		} catch (err) {
			log.debug("Server not ready yet", { url, reason: String(err), attempts })
		}
		await sleep(250)
	}
	const error = new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`)
	log.error(error.message, { attempts })
	throw error
}
