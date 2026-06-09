/**
 * Unified backend service layer.
 *
 * Detects whether we're running inside Electron (preload bridge available)
 * or in a plain browser (Bun + Hono server on port 3100). All hooks import
 * from here instead of `elf-server.ts` directly.
 *
 * In Electron mode, calls go through IPC to the main process.
 * In browser mode, calls go through HTTP to the Elf server.
 */

import type {
	Automation,
	AutomationRun,
	BridgeActivityResult as BridgeActivityResultApi,
	BridgesResult as BridgesResultApi,
	BrowserActionEvent,
	CrmContact,
	CrmStore,
	Customer,
	CreateAutomationInput,
	CreateRemoteBrowserLaneInput,
	FileGitStatusResult,
	InboxChannel,
	InboxMessage,
	InboxSendResult,
	MigrationPreview,
	MigrationProvider,
	OfficeConversionResult,
	FilePreview,
	FileSystemEntry as FileSystemEntryApi,
	GitApplyResult,
	GitBranchInfo,
	GitCheckoutResult,
	GitCommitResult,
	GitDiffStat,
	GitPushResult,
	GitStashResult,
	GitStatusInfo,
	BrowserLane as BrowserLaneApi,
	BrowserLaneHealth as BrowserLaneHealthApi,
	BrowserLaneTabActionResult as BrowserLaneTabActionResultApi,
	BrowserLaneTabsState as BrowserLaneTabsStateApi,
	CreateBrowserLaneTabInput,
	ModelState,
	NavigateBrowserLaneTabInput,
	OpenInTargetsResult,
	OracleInfo,
	PtyDataEvent,
	PtyExitEvent,
	PtyOracleSpawnRequest,
	PtySpawnRequest,
	PtyTerminalSpawnRequest,
	PtyTmuxSpawnRequest,
	ProviderDetection,
	ProjectInfo,
	ProjectRun,
	RepoPulse,
	SessionBinding,
	TmuxSessionInfo,
	UpdateAutomationInput,
} from "../../preload/api"
import {
	ELF_SERVER_BASE_URL,
	subscribeToActiveOpenCodeSessionEvents as httpSubscribeActiveOpenCodeSessionEvents,
	type ActiveOpenCodeSessionStreamHandlers,
} from "./elf-server"

export { ELF_SERVER_BASE_URL }

export interface FileSystemEntry {
	name: string
	path: string
	type: "file" | "directory"
	mtime: number
}

export interface FileReadResult {
	path: string
	content: string
}

export interface ActiveOpenCodeSessionPresence {
	sessionId: string
	directory: string
	pid: number
	source: "attach" | "inferred"
	command: string
}

export interface ActiveOpenCodeSessionsSnapshot {
	serverUrl: string
	clientCount: number
	sessionCount: number
	sessions: ActiveOpenCodeSessionPresence[]
	refreshedAt: number
}

export type BridgeStatus = "connected" | "disconnected" | "soon"

export interface BridgeChannel {
	id: string
	name: string
	kind: string
	status: BridgeStatus
	alive: boolean
	pid: number | null
	uptime: string | null
	launchd: string | null
	loaded: boolean
	messagesTotal: number | null
	lastActivity: string | null
	lastActivityAgo: string | null
	today: number | null
	logPath: string | null
}

export interface BridgesResult {
	bridges: BridgeChannel[]
}

export interface BridgeMessage {
	ts: string
	tsAgo: string | null
	direction: "out" | "in"
	peer: string
	text: string
}

export interface BridgeActivityResult {
	messages: BridgeMessage[]
}

export type BrowserLane = BrowserLaneApi
export type BrowserLaneHealth = BrowserLaneHealthApi
export type BrowserLaneTabsState = BrowserLaneTabsStateApi
export type BrowserLaneTabActionResult = BrowserLaneTabActionResultApi

export type {
	CrmContact,
	CrmStore,
	Customer,
	FilePreview,
	InboxChannel,
	InboxMessage,
	InboxSendResult,
	MigrationPreview,
	MigrationProvider,
	ProviderDetection,
	OfficeConversionResult,
	OracleInfo,
	PtyDataEvent,
	PtyExitEvent,
	PtyOracleSpawnRequest,
	PtySpawnRequest,
	PtyTerminalSpawnRequest,
	PtyTmuxSpawnRequest,
	ProjectInfo,
	ProjectRun,
	RepoPulse,
	TmuxSessionInfo,
}

import { createLogger } from "../lib/logger"

const log = createLogger("backend")

// ============================================================
// Runtime detection
// ============================================================

/**
 * Returns true when running inside Electron (preload bridge is available).
 * The `elf` object is exposed via `contextBridge.exposeInMainWorld`.
 */
export const isElectron = typeof window !== "undefined" && "elf" in window

// ============================================================
// Backend API — same signatures regardless of runtime
// ============================================================

/**
 * Ensures the single OpenCode server is running and returns its URL.
 * For local servers, this spawns/attaches via IPC.
 * For remote servers, the URL is already known and returned directly.
 */
export async function fetchOpenCodeUrl(): Promise<{ url: string }> {
	log.debug("fetchOpenCodeUrl", { via: isElectron ? "ipc" : "http" })
	try {
		if (isElectron) {
			const info = await window.elf.ensureOpenCode()
			log.info("OpenCode server URL resolved", { url: info.url })
			return { url: info.url }
		}
		const { fetchOpenCodeUrl: httpFetch } = await import("./elf-server")
		const result = await httpFetch()
		log.info("OpenCode server URL resolved", { url: result.url })
		return result
	} catch (err) {
		log.error("fetchOpenCodeUrl failed", err)
		throw err
	}
}

export async function fetchActiveOpenCodeSessions(): Promise<ActiveOpenCodeSessionsSnapshot> {
	if (isElectron) {
		return window.elf.getActiveOpenCodeSessions()
	}
	const { fetchActiveOpenCodeSessions: httpFetch } = await import("./elf-server")
	return httpFetch()
}

export async function fetchBrowserLanes(): Promise<BrowserLane[]> {
	if (isElectron) {
		return window.elf.browserLanes.list() as Promise<BrowserLane[]>
	}
	const { fetchBrowserLanes: httpFetch } = await import("./elf-server")
	return (await httpFetch()) as BrowserLane[]
}

export async function createRemoteBrowserLane(input: CreateRemoteBrowserLaneInput): Promise<BrowserLane> {
	if (isElectron) {
		return window.elf.browserLanes.createRemote(input) as Promise<BrowserLane>
	}
	const { createRemoteBrowserLane: httpCreate } = await import("./elf-server")
	return (await httpCreate(input)) as BrowserLane
}

export async function fetchPalotSessionBinding(sessionId: string): Promise<SessionBinding | null> {
	if (isElectron) {
		return window.elf.palot.getBinding(sessionId)
	}
	return null
}

export async function fetchPalotUiStateSnapshot(): Promise<import("../../preload/api").PalotUiStateSnapshot | null> {
	if (isElectron) {
		return window.elf.palot.getUiStateSnapshot()
	}
	return null
}

export async function openPalotSidePanel(tab: import("../../preload/api").SidePanelTabId): Promise<import("../../preload/api").PalotUiStateSnapshot | null> {
	if (isElectron) {
		return window.elf.palot.openSidePanel(tab)
	}
	return null
}

export async function openLoomSession(sessionId: string): Promise<import("../../preload/api").LoomOpenSessionResult | null> {
	if (isElectron) {
		return window.elf.palot.openLoomSession(sessionId)
	}
	return null
}

export async function sendLoomEvent(
	sessionId: string,
	event: { type: string; nodeId: string; payload?: Record<string, unknown> },
): Promise<void> {
	if (!isElectron) return
	await window.elf.palot.sendLoomEvent(sessionId, event)
}

export async function sendLoomStateDelta(
	sessionId: string,
	delta: { nodeId: string; field: string; value: unknown },
): Promise<void> {
	if (!isElectron) return
	await window.elf.palot.sendLoomStateDelta(sessionId, delta)
}


export async function fetchArtifactRecords(
	sessionId: string,
): Promise<import("../atoms/genui-artifacts").SessionGenUiArtifactsState | null> {
	if (!isElectron) return null
	return window.elf.palot.listArtifacts(sessionId)
}

export async function fetchArtifactRecord(
	sessionId: string,
	artifactId: string,
): Promise<import("../lib/types").GenUiArtifactRecord | null> {
	if (!isElectron) return null
	return window.elf.palot.getArtifact(sessionId, artifactId)
}

export async function upsertArtifactRecord(
	sessionId: string,
	record: import("../lib/types").GenUiArtifactRecord,
): Promise<import("../lib/types").GenUiArtifactRecord | null> {
	if (!isElectron) return record
	return window.elf.palot.upsertArtifact(sessionId, record)
}

export async function patchArtifactRecord(
	sessionId: string,
	artifactId: string,
	input: {
		propsPatch?: Record<string, unknown>
		pin?: import("../lib/types").GenUiArtifactPinState
		markDirty?: string[]
		lastAgentPatchAt?: number
		lastHumanEditAt?: number
		lastRenderedAt?: number
	},
): Promise<import("../lib/types").GenUiArtifactRecord | null> {
	if (!isElectron) return null
	return window.elf.palot.patchArtifact(sessionId, artifactId, input)
}

export function subscribeToPalotOpenSidePanel(
	callback: (payload: { tab: import("../../preload/api").SidePanelTabId }) => void,
): () => void {
	if (isElectron) {
		return window.elf.palot.onOpenSidePanel(callback)
	}
	return () => {}
}

export function subscribeToBrowserActions(callback: (event: BrowserActionEvent) => void): () => void {
	if (isElectron) {
		return window.elf.palot.onBrowserActions(callback)
	}
	return () => {}
}

export async function readHostClipboardText(): Promise<string> {
	if (isElectron) {
		return window.elf.clipboard.readText()
	}
	if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
		return ""
	}
	return await navigator.clipboard.readText()
}

export async function writeHostClipboardText(text: string): Promise<void> {
	if (isElectron) {
		await window.elf.clipboard.writeText(text)
		return
	}
	if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
		return
	}
	await navigator.clipboard.writeText(text)
}

export async function ensureBrowserLane(laneId: string): Promise<BrowserLane> {
	if (isElectron) {
		return window.elf.browserLanes.ensure(laneId) as Promise<BrowserLane>
	}
	const { ensureBrowserLane: httpEnsure } = await import("./elf-server")
	return (await httpEnsure(laneId)) as BrowserLane
}

export async function startBrowserLane(laneId: string): Promise<BrowserLane> {
	if (isElectron) {
		return window.elf.browserLanes.start(laneId) as Promise<BrowserLane>
	}
	const { startBrowserLane: httpStart } = await import("./elf-server")
	return (await httpStart(laneId)) as BrowserLane
}

export async function stopBrowserLane(laneId: string): Promise<BrowserLane> {
	if (isElectron) {
		return window.elf.browserLanes.stop(laneId) as Promise<BrowserLane>
	}
	const { stopBrowserLane: httpStop } = await import("./elf-server")
	return (await httpStop(laneId)) as BrowserLane
}

export async function restartBrowserLane(laneId: string): Promise<BrowserLane> {
	if (isElectron) {
		return window.elf.browserLanes.restart(laneId) as Promise<BrowserLane>
	}
	const { restartBrowserLane: httpRestart } = await import("./elf-server")
	return (await httpRestart(laneId)) as BrowserLane
}

export async function resetBrowserLaneProfile(laneId: string): Promise<BrowserLane> {
	if (isElectron) {
		return window.elf.browserLanes.resetProfile(laneId) as Promise<BrowserLane>
	}
	const { resetBrowserLaneProfile: httpReset } = await import("./elf-server")
	return (await httpReset(laneId)) as BrowserLane
}

export async function fetchBrowserLaneHealth(laneId: string): Promise<BrowserLaneHealth> {
	if (isElectron) {
		return window.elf.browserLanes.health(laneId) as Promise<BrowserLaneHealth>
	}
	const { fetchBrowserLaneHealth: httpHealth } = await import("./elf-server")
	return (await httpHealth(laneId)) as BrowserLaneHealth
}

export async function navigateBrowserLane(
	laneId: string,
	url: string,
): Promise<BrowserLaneTabActionResult> {
	if (isElectron) {
		return window.elf.browserLanes.navigate(laneId, url) as Promise<BrowserLaneTabActionResult>
	}
	const { navigateBrowserLane: httpNavigate } = await import("./elf-server")
	return (await httpNavigate(laneId, url)) as BrowserLaneTabActionResult
}

export async function fetchBrowserLaneTabs(laneId: string): Promise<BrowserLaneTabsState> {
	if (isElectron) {
		return window.elf.browserLanes.listTabs(laneId) as Promise<BrowserLaneTabsState>
	}
	const { fetchBrowserLaneTabs: httpTabs } = await import("./elf-server")
	return (await httpTabs(laneId)) as BrowserLaneTabsState
}

export async function createBrowserLaneTab(
	laneId: string,
	input: CreateBrowserLaneTabInput = {},
): Promise<BrowserLaneTabActionResult> {
	if (isElectron) {
		return window.elf.browserLanes.createTab(laneId, input) as Promise<BrowserLaneTabActionResult>
	}
	const { createBrowserLaneTab: httpCreateTab } = await import("./elf-server")
	return (await httpCreateTab(laneId, input)) as BrowserLaneTabActionResult
}

export async function activateBrowserLaneTab(
	laneId: string,
	tabId: string,
): Promise<BrowserLaneTabActionResult> {
	if (isElectron) {
		return window.elf.browserLanes.activateTab(laneId, tabId) as Promise<BrowserLaneTabActionResult>
	}
	const { activateBrowserLaneTab: httpActivateTab } = await import("./elf-server")
	return (await httpActivateTab(laneId, tabId)) as BrowserLaneTabActionResult
}

export async function closeBrowserLaneTab(
	laneId: string,
	tabId: string,
): Promise<BrowserLaneTabActionResult> {
	if (isElectron) {
		return window.elf.browserLanes.closeTab(laneId, tabId) as Promise<BrowserLaneTabActionResult>
	}
	const { closeBrowserLaneTab: httpCloseTab } = await import("./elf-server")
	return (await httpCloseTab(laneId, tabId)) as BrowserLaneTabActionResult
}

export async function navigateBrowserLaneTab(
	laneId: string,
	tabId: string,
	input: NavigateBrowserLaneTabInput,
): Promise<BrowserLaneTabActionResult> {
	if (isElectron) {
		return window.elf.browserLanes.navigateTab(laneId, tabId, input) as Promise<BrowserLaneTabActionResult>
	}
	const { navigateBrowserLaneTab: httpNavigateTab } = await import("./elf-server")
	return (await httpNavigateTab(laneId, tabId, input)) as BrowserLaneTabActionResult
}

export function subscribeToActiveOpenCodeSessionEvents(
	handlers: ActiveOpenCodeSessionStreamHandlers,
): () => void {
	if (isElectron) {
		return window.elf.onActiveOpenCodeSessionsChanged((snapshot) => {
			handlers.onSnapshot?.(snapshot)
		})
	}
	return httpSubscribeActiveOpenCodeSessionEvents(handlers)
}

/**
 * Resolve the connection URL for a server config.
 * For local servers, spawns/attaches via the existing IPC mechanism.
 * For remote servers, returns the configured URL directly.
 */
export async function resolveServerUrl(
	server: import("../../preload/api").ServerConfig,
): Promise<string> {
	switch (server.type) {
		case "local": {
			const { url } = await fetchOpenCodeUrl()
			return url
		}
		case "remote":
			return server.url
		case "ssh":
			// SSH tunneling not yet implemented; the URL would come from the tunnel manager
			throw new Error("SSH tunnel servers are not yet supported")
		default:
			throw new Error(`Unknown server type: ${(server as { type: string }).type}`)
	}
}

/**
 * Resolve the auth header for a server config.
 * Fetches the encrypted password from the main process via IPC.
 * Returns null for unauthenticated servers.
 */
export async function resolveAuthHeader(
	server: import("../../preload/api").ServerConfig,
): Promise<string | null> {
	if (server.type === "local") return null
	if (server.type === "remote" || server.type === "ssh") {
		if (!server.hasPassword) return null
		if (!isElectron) return null

		const password = await window.elf.credential.get(server.id)
		if (!password) return null

		const username = server.username || "opencode"
		return `Basic ${btoa(`${username}:${password}`)}`
	}
	return null
}

/**
 * Fetches the OpenCode model state (recent models, favorites, variants)
 * from ~/.local/state/opencode/model.json.
 */
export async function fetchModelState(): Promise<ModelState> {
	if (isElectron) {
		return window.elf.getModelState()
	}
	const { fetchModelState: httpFetch } = await import("./elf-server")
	return httpFetch() as unknown as Promise<ModelState>
}

/**
 * Adds a model to the front of the recent list in model.json.
 * Matches the TUI's `model.set(model, { recent: true })` behavior.
 * Returns the updated model state.
 */
export async function updateModelRecent(model: {
	providerID: string
	modelID: string
}): Promise<ModelState> {
	if (isElectron) {
		return window.elf.updateModelRecent(model)
	}
	const { updateModelRecent: httpUpdate } = await import("./elf-server")
	return httpUpdate(model) as unknown as Promise<ModelState>
}

/**
 * Checks if the backend is available.
 * In Electron, always returns true (main process is always there).
 * In browser, pings the Elf HTTP server.
 */
export async function checkBackendHealth(): Promise<boolean> {
	if (isElectron) {
		return true
	}
	const { checkServerHealth } = await import("./elf-server")
	return checkServerHealth()
}

// ============================================================
// Directory picker — Electron-only (native dialog via IPC)
// ============================================================

/**
 * Opens a native folder picker dialog.
 * Returns the selected directory path, or null if cancelled.
 */
export async function pickDirectory(): Promise<string | null> {
	if (isElectron) {
		return window.elf.pickDirectory()
	}
	throw new Error("Directory picker is only available in Electron mode")
}

export async function listDirectory(directory: string): Promise<FileSystemEntry[]> {
	if (isElectron) {
		return window.elf.listDirectory(directory) as Promise<FileSystemEntryApi[]>
	}
	throw new Error("Directory listing is only available in Electron mode")
}

export async function readDirectoryTree(directory: string): Promise<FileSystemEntry[]> {
	if (isElectron) {
		return window.elf.readDirectoryTree(directory) as Promise<FileSystemEntryApi[]>
	}
	throw new Error("Directory listing is only available in Electron mode")
}

export async function fetchFileGitStatus(directory: string): Promise<FileGitStatusResult> {
	if (isElectron) {
		return window.elf.gitStatus(directory) as Promise<FileGitStatusResult>
	}
	throw new Error("Git status is only available in Electron mode")
}

export async function fetchGitPulse(directories: string[]): Promise<RepoPulse[]> {
	if (isElectron) {
		return window.elf.gitPulse(directories) as Promise<RepoPulse[]>
	}
	throw new Error("Git pulse is only available in Electron mode")
}

export async function fetchHomeDirectory(): Promise<string> {
	if (isElectron) {
		return window.elf.homeDir()
	}
	throw new Error("Home directory is only available in Electron mode")
}

export async function fetchProjectDetection(filePath: string): Promise<ProjectRun> {
	if (isElectron) {
		return window.elf.detectProject(filePath) as Promise<ProjectRun>
	}
	throw new Error("Project detection is only available in Electron mode")
}

export async function fetchKnownProjects(rootDirectory?: string): Promise<ProjectInfo[]> {
	if (isElectron) {
		return window.elf.listProjects(rootDirectory) as Promise<ProjectInfo[]>
	}
	throw new Error("Project listing is only available in Electron mode")
}

export async function browseMcpCatalog(input: import("../../preload/api").McpCatalogBrowseInput) {
	if (isElectron) {
		return window.elf.mcpConnections.browseCatalog(input)
	}
	throw new Error("MCP catalog browse is only available in Electron mode")
}

export async function searchMcpCatalog(input: import("../../preload/api").McpCatalogSearchInput) {
	if (isElectron) {
		return window.elf.mcpConnections.searchCatalog(input)
	}
	throw new Error("MCP catalog search is only available in Electron mode")
}

export async function registerMcpConnection(input: {
	name: string
	transport: "remote-http" | "remote-sse" | "local-stdio"
	target: string
	ownershipMode?: "local-only" | "cloud-only" | "handoff-derived"
	canonicalStore?: "local" | "gateway"
	restorePolicy?: "none" | "reproject_on_boot" | "reproject_and_reauth_if_needed"
	source?: "registry" | "curated" | "imported" | "manual"
	scope?: "home" | "project"
	metadata?: Record<string, unknown>
}) {
	if (isElectron) {
		return window.elf.mcpConnections.register(input)
	}
	throw new Error("MCP connection registration is only available in Electron mode")
}

export async function loginMcpConnection(name: string) {
	if (isElectron) {
		return window.elf.mcpConnections.login(name)
	}
	throw new Error("MCP connection login is only available in Electron mode")
}

export async function testMcpConnection(name: string) {
	if (isElectron) {
		return window.elf.mcpConnections.test(name)
	}
	throw new Error("MCP connection test is only available in Electron mode")
}

export async function listMcpConnectionRecords() {
	if (isElectron) {
		return window.elf.mcpConnections.listRecords()
	}
	throw new Error("MCP connection records are only available in Electron mode")
}

export async function readFileContents(filePath: string): Promise<FileReadResult> {
	if (isElectron) {
		return window.elf.readFile(filePath) as Promise<FileReadResult>
	}
	throw new Error("File reads are only available in Electron mode")
}

export async function fetchFilePreview(filePath: string): Promise<FilePreview> {
	if (isElectron) {
		return window.elf.readFilePreview(filePath) as Promise<FilePreview>
	}
	throw new Error("File previews are only available in Electron mode")
}

export async function readTextFile(filePath: string): Promise<string> {
	if (isElectron) {
		return window.elf.readTextFile(filePath)
	}
	const { fetchTextFile } = await import("./elf-server")
	return fetchTextFile(filePath)
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
	if (isElectron) {
		return window.elf.writeTextFile(filePath, content)
	}
	const { saveTextFile } = await import("./elf-server")
	return saveTextFile(filePath, content)
}

export async function deletePath(filePath: string): Promise<void> {
	if (isElectron) {
		return window.elf.deletePath(filePath)
	}
	throw new Error("File deletion is only available in Electron mode")
}

export async function saveImageTemp(data: string, extension: string): Promise<string> {
	if (isElectron) {
		return window.elf.saveImageTemp(data, extension)
	}
	throw new Error("Temp image save is only available in Electron mode")
}

export async function convertOfficeToPdf(filePath: string): Promise<OfficeConversionResult> {
	if (isElectron) {
		return window.elf.convertOfficeToPdf(filePath) as Promise<OfficeConversionResult>
	}
	throw new Error("Office conversion is only available in Electron mode")
}

export async function fetchOracles(): Promise<OracleInfo[]> {
	if (isElectron) {
		return window.elf.oracles.list() as Promise<OracleInfo[]>
	}
	throw new Error("Oracle roster is only available in Electron mode")
}

export async function fetchTmuxSessions(): Promise<TmuxSessionInfo[]> {
	if (isElectron) {
		return window.elf.oracles.listTmuxSessions() as Promise<TmuxSessionInfo[]>
	}
	throw new Error("Tmux sessions are only available in Electron mode")
}

export async function createOracle(identity: string, command?: string | null): Promise<string> {
	if (isElectron) {
		return window.elf.oracles.create(identity, command)
	}
	throw new Error("Oracle roster is only available in Electron mode")
}

export async function renameOracle(from: string, to: string): Promise<string> {
	if (isElectron) {
		return window.elf.oracles.rename(from, to)
	}
	throw new Error("Oracle roster is only available in Electron mode")
}

export async function deleteOracle(identity: string, force = false): Promise<void> {
	if (isElectron) {
		return window.elf.oracles.delete(identity, force)
	}
	throw new Error("Oracle roster is only available in Electron mode")
}

export async function killTmuxSession(socket: string, session: string): Promise<void> {
	if (isElectron) {
		return window.elf.oracles.killTmuxSession(socket, session)
	}
	throw new Error("Tmux sessions are only available in Electron mode")
}

export async function appshot(identity?: string | null): Promise<string> {
	if (isElectron) {
		return window.elf.oracles.appshot(identity)
	}
	throw new Error("Oracle appshot is only available in Electron mode")
}

export async function spawnPtyShell(request: PtySpawnRequest): Promise<number> {
	if (isElectron) {
		return window.elf.pty.spawnShell(request)
	}
	throw new Error("PTY sessions are only available in Electron mode")
}

export async function spawnPtyTerminal(request: PtyTerminalSpawnRequest): Promise<number> {
	if (isElectron) {
		return window.elf.pty.spawnTerminal(request)
	}
	throw new Error("PTY sessions are only available in Electron mode")
}

export async function spawnPtyOracle(request: PtyOracleSpawnRequest): Promise<number> {
	if (isElectron) {
		return window.elf.pty.spawnOracle(request)
	}
	throw new Error("PTY sessions are only available in Electron mode")
}

export async function spawnPtyTmux(request: PtyTmuxSpawnRequest): Promise<number> {
	if (isElectron) {
		return window.elf.pty.spawnTmux(request)
	}
	throw new Error("PTY sessions are only available in Electron mode")
}

export async function writePty(id: number, data: string): Promise<void> {
	if (isElectron) {
		return window.elf.pty.write(id, data)
	}
	throw new Error("PTY sessions are only available in Electron mode")
}

export async function resizePty(id: number, cols: number, rows: number): Promise<void> {
	if (isElectron) {
		return window.elf.pty.resize(id, cols, rows)
	}
	throw new Error("PTY sessions are only available in Electron mode")
}

export async function killPty(id: number): Promise<void> {
	if (isElectron) {
		return window.elf.pty.kill(id)
	}
	throw new Error("PTY sessions are only available in Electron mode")
}

export function onPtyData(callback: (event: PtyDataEvent) => void): () => void {
	if (isElectron) {
		return window.elf.pty.onData(callback)
	}
	throw new Error("PTY sessions are only available in Electron mode")
}

export function onPtyExit(callback: (event: PtyExitEvent) => void): () => void {
	if (isElectron) {
		return window.elf.pty.onExit(callback)
	}
	throw new Error("PTY sessions are only available in Electron mode")
}

export async function fetchBridges(): Promise<BridgesResult> {
	if (isElectron) {
		return window.elf.bridges.list() as Promise<BridgesResultApi>
	}
	throw new Error("Bridges are only available in Electron mode")
}

export async function fetchBridgeActivity(
	id: string,
	limit = 25,
): Promise<BridgeActivityResult> {
	if (isElectron) {
		return window.elf.bridges.activity(id, limit) as Promise<BridgeActivityResultApi>
	}
	throw new Error("Bridge activity is only available in Electron mode")
}

export async function fetchProviderDetections(): Promise<ProviderDetection[]> {
	if (isElectron) {
		return window.elf.onboarding.detectProviders()
	}
	return []
}

export async function fetchClaudeMigrationPreview(
	provider: MigrationProvider,
	scanResult: unknown,
	categories: string[],
): Promise<MigrationPreview> {
	if (isElectron) {
		return window.elf.onboarding.previewMigration(provider, scanResult, categories)
	}
	throw new Error("Migration preview is only available in Electron mode")
}

export async function restoreMigrationBackup(): Promise<{
	success: boolean
	restored: string[]
	removed: string[]
	errors: string[]
}> {
	if (isElectron) {
		return window.elf.onboarding.restoreBackup()
	}
	throw new Error("Migration restore is only available in Electron mode")
}

export async function fetchCrmStore(): Promise<CrmStore> {
	if (isElectron) {
		return window.elf.crm.load()
	}
	throw new Error("CRM is only available in Electron mode")
}

export async function saveCrmContact(contact: Partial<CrmContact>): Promise<string> {
	if (isElectron) {
		return window.elf.crm.saveContact(contact)
	}
	throw new Error("CRM is only available in Electron mode")
}

export async function deleteCrmContact(id: string): Promise<void> {
	if (isElectron) {
		return window.elf.crm.deleteContact(id)
	}
	throw new Error("CRM is only available in Electron mode")
}

export async function listInboxCustomers(): Promise<Customer[]> {
	if (isElectron) {
		return window.elf.inbox.listCustomers()
	}
	throw new Error("Inbox is only available in Electron mode")
}

export async function fetchInboxThread(handle: string, limit = 200): Promise<InboxMessage[]> {
	if (isElectron) {
		return window.elf.inbox.customerThread(handle, limit)
	}
	throw new Error("Inbox is only available in Electron mode")
}

export async function sendInboxMessage(
	channel: InboxChannel,
	to: string,
	text: string,
): Promise<InboxSendResult> {
	if (isElectron) {
		return window.elf.inbox.sendMessage(channel, to, text)
	}
	throw new Error("Inbox is only available in Electron mode")
}

// ============================================================
// Git operations — Electron-only (main process via IPC)
// In browser mode, these are not available (OpenCode server
// doesn't expose git checkout/stash APIs).
// ============================================================

/**
 * Lists all local and remote branches for a project directory.
 */
export async function fetchGitBranches(directory: string): Promise<GitBranchInfo> {
	if (isElectron) {
		return window.elf.git.listBranches(directory)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Gets the working tree status (clean/dirty, file counts).
 */
export async function fetchGitStatus(directory: string): Promise<GitStatusInfo> {
	if (isElectron) {
		return window.elf.git.getStatus(directory)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Checks out a branch. Fails if there are uncommitted changes
 * that would conflict.
 */
export async function gitCheckout(directory: string, branch: string): Promise<GitCheckoutResult> {
	if (isElectron) {
		return window.elf.git.checkout(directory, branch)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Stashes uncommitted changes, then checks out the target branch.
 */
export async function gitStashAndCheckout(
	directory: string,
	branch: string,
): Promise<GitStashResult> {
	if (isElectron) {
		return window.elf.git.stashAndCheckout(directory, branch)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Pops the most recent stash entry.
 */
export async function gitStashPop(directory: string): Promise<GitStashResult> {
	if (isElectron) {
		return window.elf.git.stashPop(directory)
	}
	throw new Error("Git operations are only available in Electron mode")
}

// ============================================================
// Worktree operations — OpenCode API only
// ============================================================

export type { WorktreeResult } from "./worktree-service"
export {
	createWorktree as createWorktreeViaApi,
	listWorktrees as listWorktreesViaApi,
	removeWorktree as removeWorktreeViaApi,
	resetWorktree,
} from "./worktree-service"

/**
 * Gets the git repository root for a directory.
 */
export async function getGitRoot(directory: string): Promise<string | null> {
	if (isElectron) {
		return window.elf.git.getRoot(directory)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Gets a summary of uncommitted changes in a directory.
 */
export async function fetchDiffStat(directory: string): Promise<GitDiffStat> {
	if (isElectron) {
		return window.elf.git.diffStat(directory)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Commits all changes (staged + unstaged) with the given message.
 */
export async function gitCommitAll(directory: string, message: string): Promise<GitCommitResult> {
	if (isElectron) {
		return window.elf.git.commitAll(directory, message)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Pushes the current branch to the remote.
 */
export async function gitPush(directory: string, remote?: string): Promise<GitPushResult> {
	if (isElectron) {
		return window.elf.git.push(directory, remote)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Creates a new branch on the given directory.
 */
export async function gitCreateBranch(
	directory: string,
	branchName: string,
): Promise<GitCheckoutResult> {
	if (isElectron) {
		return window.elf.git.createBranch(directory, branchName)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Gets the remote URL for a repository (defaults to "origin").
 */
export async function getGitRemoteUrl(directory: string, remote?: string): Promise<string | null> {
	if (isElectron) {
		return window.elf.git.getRemoteUrl(directory, remote)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Applies uncommitted changes from a worktree to the local checkout as a patch.
 */
export async function gitApplyToLocal(
	worktreeDir: string,
	localDir: string,
): Promise<GitApplyResult> {
	if (isElectron) {
		return window.elf.git.applyToLocal(worktreeDir, localDir)
	}
	throw new Error("Git operations are only available in Electron mode")
}

/**
 * Applies a raw diff string to a local directory using `git apply`.
 * Used for remote worktree apply-to-local, where the diff is fetched
 * from the OpenCode session.diff API rather than from a local worktree.
 */
export async function gitApplyDiffText(
	localDir: string,
	diffText: string,
): Promise<GitApplyResult> {
	if (isElectron) {
		return window.elf.git.applyDiffText(localDir, diffText)
	}
	throw new Error("Git operations are only available in Electron mode")
}

// ============================================================
// Open in external app — Electron-only (main process via IPC)
// ============================================================

/**
 * Gets the list of available "Open in" targets (editors, terminals, file managers)
 * with their availability status and the user's preferred target.
 */
export async function fetchOpenInTargets(): Promise<OpenInTargetsResult> {
	if (isElectron) {
		return window.elf.openIn.getTargets()
	}
	throw new Error("Open-in targets are only available in Electron mode")
}

/**
 * Opens a directory in the specified target application.
 * Optionally persists the target as the user's preferred choice.
 */
export async function openInTarget(
	directory: string,
	targetId: string,
	persistPreferred?: boolean,
): Promise<void> {
	if (isElectron) {
		return window.elf.openIn.open(directory, targetId, persistPreferred)
	}
	throw new Error("Open-in targets are only available in Electron mode")
}

/**
 * Sets the user's preferred "Open in" target without opening anything.
 */
export async function setOpenInPreferred(targetId: string): Promise<{ success: boolean }> {
	if (isElectron) {
		return window.elf.openIn.setPreferred(targetId)
	}
	throw new Error("Open-in targets are only available in Electron mode")
}

// ============================================================
// Automations — Electron-only
// ============================================================

export async function fetchAutomations(): Promise<Automation[]> {
	if (isElectron) {
		return window.elf.automation.list()
	}
	throw new Error("Automations are only available in Electron mode")
}

export async function fetchAutomation(id: string): Promise<Automation | null> {
	if (isElectron) {
		return window.elf.automation.get(id)
	}
	throw new Error("Automations are only available in Electron mode")
}

export async function createAutomation(input: CreateAutomationInput): Promise<Automation> {
	if (isElectron) {
		return window.elf.automation.create(input)
	}
	throw new Error("Automations are only available in Electron mode")
}

export async function updateAutomation(input: UpdateAutomationInput): Promise<Automation | null> {
	if (isElectron) {
		return window.elf.automation.update(input)
	}
	throw new Error("Automations are only available in Electron mode")
}

export async function deleteAutomation(id: string): Promise<boolean> {
	if (isElectron) {
		return window.elf.automation.delete(id)
	}
	throw new Error("Automations are only available in Electron mode")
}

export async function runAutomationNow(id: string): Promise<boolean> {
	if (isElectron) {
		return window.elf.automation.runNow(id)
	}
	throw new Error("Automations are only available in Electron mode")
}

export async function fetchAutomationRuns(automationId?: string): Promise<AutomationRun[]> {
	if (isElectron) {
		return window.elf.automation.listRuns(automationId)
	}
	throw new Error("Automations are only available in Electron mode")
}

export async function archiveAutomationRun(runId: string): Promise<boolean> {
	if (isElectron) {
		return window.elf.automation.archiveRun(runId)
	}
	throw new Error("Automations are only available in Electron mode")
}

export async function acceptAutomationRun(runId: string): Promise<boolean> {
	if (isElectron) {
		return window.elf.automation.acceptRun(runId)
	}
	throw new Error("Automations are only available in Electron mode")
}

export async function markAutomationRunRead(runId: string): Promise<boolean> {
	if (isElectron) {
		return window.elf.automation.markRunRead(runId)
	}
	throw new Error("Automations are only available in Electron mode")
}

export async function previewAutomationSchedule(
	rrule: string,
	timezone: string,
): Promise<string[]> {
	if (isElectron) {
		return window.elf.automation.previewSchedule(rrule, timezone)
	}
	throw new Error("Automations are only available in Electron mode")
}
