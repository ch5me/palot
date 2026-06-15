import {
	app,
	BrowserWindow,
	clipboard,
	dialog,
	ipcMain,
	nativeTheme,
	net,
	shell,
	systemPreferences,
} from "electron"
import { readFile } from "node:fs/promises"
import {
	acceptRun,
	archiveRun,
	createAutomation,
	deleteAutomation,
	getAutomation,
	listAutomations,
	listRuns,
	markRunRead,
	previewSchedule,
	runNow,
	updateAutomation,
} from "./automation"
import type { CreateAutomationInput, UpdateAutomationInput } from "./automation/types"
import { installCli, isCliInstalled, uninstallCli } from "./cli-install"
import { deleteCredential, getCredential, storeCredential } from "./credential-store"
import {
	getAuthState,
	startSignIn,
	pollSignIn,
	cancelSignIn,
	signOut,
} from "./services/auth/auth-controller"
import {
	applyChangesToLocal,
	applyDiffTextToLocal,
	checkout,
	commitAll,
	createBranch,
	getDiffStat,
	getGitRoot,
	getRemoteUrl,
	getStatus,
	listBranches,
	push,
	stashAndCheckout,
	stashPop,
} from "./git-service"
import { getResolvedChromeTier } from "./liquid-glass"
import { createLogger } from "./logger"
import { getDiscoveredServers } from "./mdns-scanner"
import { bridgeActivity, listBridges } from "./bridges"
import { deleteContact, loadCrmStore, saveContact } from "./crm"
import { customerThread, listCustomers, sendMessage as sendInboxMessage } from "./inbox"
import type { InboxChannel } from "../preload/api"
import { FIREFLY_SURFACE_LANE_BY_ID } from "../shared/firefly-surface-ids"
import {
	palotOpenSidePanelInputSchema,
	palotUiStateSnapshotSchema,
	publishBrowserActionInputSchema,
	sessionBindingSchema,
} from "../shared/palot-bridge-schemas"
import { createPtyController } from "./pty"
import {
	deletePath as deleteProjectPath,
	detectProject,
	convertOfficeToPdf,
	getGitPulse,
	getGitStatus,
	getHomeDirectory,
	listDirectory as listProjectDirectory,
	listProjects as listKnownProjects,
	readDirectoryTree,
	readFilePreview,
	readTextFile,
	saveImageTemp,
	writeTextFile,
} from "./files"
import {
	appshot as oracleAppshot,
	createOracle,
	deleteOracle,
	killTmuxSession,
	listOracles,
	listTmuxSessions,
	renameOracle,
	type TmuxSessionInfo,
} from "./oracles"

import { readModelState, updateModelRecent } from "./model-state"
import { dismissNotification, updateBadgeCount } from "./notifications"
import type { MigrationProvider } from "./onboarding"
import {
	checkOpenCodeInstallation,
	detectProviders,
	executeMigration,
	installOpenCode,
	previewMigration,
	restoreMigrationBackup,
	scanProvider,
} from "./onboarding"
import { getOpenInTargets, openInTarget, setPreferredTarget } from "./open-in-targets"
import {
	ensureServer,
	getActiveOpenCodeSessions,
	getServerUrl,
	restartServer,
	stopServer,
} from "./opencode-manager"
import {
	activateBrowserLaneTab,
	closeBrowserLaneTab,
	createBrowserLaneTab,
	createRemoteBrowserLane,
	ensureBrowserLane,
	listBrowserLanes,
	listBrowserLaneTabs,
	navigateBrowserLane,
	navigateBrowserLaneTab,
	refreshBrowserLaneHealth,
	resetBrowserLaneProfile,
	restartBrowserLane,
	startBrowserLane,
	stopBrowserLane,
} from "./browser-lane-manager"
import {
	broadcastOpenSidePanel,
	getBrowserStateSnapshot,
	getSessionBinding,
	getUiStateSnapshot,
	publishBrowserAction,
	registerPalotBrowserWindows,
	releaseSessionBindingBySessionId,
	setSessionBinding,
	setUiStateSnapshot,
} from "./palot-browser-ipc"
import { openLoomSession as resolveLoomSession } from "./palot-resolver"
import { sessionOpenCommand, stateCommand } from "./palot-runtime/commands"
import { registerPalotArtifactIpc } from "./palot-runtime/ipc"
import { getLoomSessionState, queueLoomEvent } from "./palot-runtime/session-store"
import { encodeWirePayload } from "./palot-runtime/wire"
import { getOpaqueWindows, getSettings, onSettingsChanged, updateSettings } from "./settings-store"
import {
	checkForUpdates,
	downloadUpdate,
	getUpdateState,
	installUpdate,
	openReleasePage,
} from "./updater"
import { removeMcpConnectionConfig, upsertMcpConnectionConfig } from "./mcp-connections-config"
import { browseCatalog, searchCatalog } from "./mcp-catalog-service"
import {
	listMcpConnectionRecords,
	loginMcpConnection,
	registerMcpConnection,
	testMcpConnection,
} from "./mcp-connections-runtime"

registerPalotBrowserWindows(() => BrowserWindow.getAllWindows())

const log = createLogger("ipc")
const ptyController = createPtyController({
	onData: (event) => {
		for (const win of BrowserWindow.getAllWindows()) {
			win.webContents.send("pty:data", event)
		}
	},
	onExit: (event) => {
		for (const win of BrowserWindow.getAllWindows()) {
			win.webContents.send("pty:exit", event)
		}
	},
})

/** Read the opaque windows preference for use at window creation time. */
export { getOpaqueWindows as getOpaqueWindowsPref } from "./settings-store"

// ============================================================
// Serialized fetch types — used to pass Request/Response over IPC
// ============================================================

interface SerializedRequest {
	url: string
	method: string
	headers: Record<string, string>
	body: string | null
}

interface SerializedResponse {
	status: number
	statusText: string
	headers: Record<string, string>
	body: string | null
}

interface FileReadResult {
	path: string
	content: string
}

/**
 * Generic fetch proxy handler for the renderer process.
 *
 * The renderer serializes a Request into a plain object, sends it over IPC,
 * and the main process performs the actual HTTP request using `net.fetch()`
 * (Electron's network stack, which has no connection-per-origin limits).
 * The response is serialized back to the renderer.
 *
 * This bypasses Chromium's 6-connections-per-origin HTTP/1.1 limit, which
 * causes severe queueing when many parallel requests hit the OpenCode server.
 */
async function handleFetchProxy(
	_event: Electron.IpcMainInvokeEvent,
	req: SerializedRequest,
): Promise<SerializedResponse> {
	log.info("IPC fetch proxy →", { method: req.method, url: req.url })
	const start = Date.now()
	const response = await net.fetch(req.url, {
		method: req.method,
		headers: req.headers,
		body: req.body ?? undefined,
	})

	const body = await response.text()
	const headers: Record<string, string> = {}
	response.headers.forEach((value, key) => {
		headers[key] = value
	})
	const durationMs = Date.now() - start

	log.info("IPC fetch proxy ←", {
		method: req.method,
		url: req.url,
		status: response.status,
		bodyLength: body.length,
		durationMs,
	})

	return {
		status: response.status,
		statusText: response.statusText,
		headers,
		body,
	}
}

async function readProjectFile(filePath: string): Promise<FileReadResult> {
	return {
		path: filePath,
		content: await readFile(filePath, "utf-8"),
	}
}


/**
 * Wraps an IPC handler to log errors before they propagate to the renderer.
 * Without this, errors thrown in handlers are silently serialized across IPC
 * and the main process log shows nothing.
 */
function withLogging<TArgs extends unknown[], TResult>(
	channel: string,
	handler: (...args: TArgs) => TResult | Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
	return async (...args: TArgs) => {
		const start = Date.now()
		try {
			const result = await handler(...args)
			const durationMs = Date.now() - start
			if (durationMs > 500) {
				log.warn(`Handler "${channel}" slow`, { durationMs })
			}
			return result
		} catch (err) {
			log.error(`Handler "${channel}" failed`, { durationMs: Date.now() - start }, err)
			throw err
		}
	}
}

/**
 * Registers all IPC handlers that the renderer can invoke via contextBridge.
 *
 * Each handler corresponds to an endpoint that was previously served by
 * the Bun + Hono server on port 3100. Now they run in-process in Electron's
 * main process, communicating via IPC instead of HTTP.
 */
export function registerIpcHandlers(): void {
	registerPalotArtifactIpc(ipcMain)

	// --- App info ---

	ipcMain.handle("app:info", () => ({
		version: app.getVersion(),
		isDev: !app.isPackaged,
	}))

	// --- OpenCode server lifecycle ---

	ipcMain.handle(
		"opencode:ensure",
		withLogging("opencode:ensure", async () => await ensureServer()),
	)

	ipcMain.handle("opencode:url", () => getServerUrl())

	ipcMain.handle(
		"opencode:stop",
		withLogging("opencode:stop", () => stopServer()),
	)

	ipcMain.handle(
		"opencode:restart",
		withLogging("opencode:restart", async () => await restartServer()),
	)

	ipcMain.handle(
		"opencode:active-sessions",
		withLogging("opencode:active-sessions", async () => await getActiveOpenCodeSessions()),
	)

	ipcMain.handle("clipboard:read-text", withLogging("clipboard:read-text", async () => clipboard.readText()))
	ipcMain.handle(
		"clipboard:write-text",
		withLogging("clipboard:write-text", async (_, text: string) => {
			clipboard.writeText(text)
		}),
	)

	ipcMain.handle(
		"browser-lanes:list",
		withLogging("browser-lanes:list", async () => await listBrowserLanes()),
	)
	ipcMain.handle(
		"browser-lanes:create-remote",
		withLogging(
			"browser-lanes:create-remote",
			async (
				_,
				input: {
					id: string
					label: string
					streamBackendUrl: string
					cdpEndpoint: string | null
					host?: string | null
					profilePath?: string | null
				},
			) => await createRemoteBrowserLane(input),
		),
	)
	ipcMain.handle(
		"browser-lanes:ensure",
		withLogging("browser-lanes:ensure", async (_, laneId: string) => await ensureBrowserLane(laneId)),
	)
	ipcMain.handle(
		"browser-lanes:start",
		withLogging("browser-lanes:start", async (_, laneId: string) => await startBrowserLane(laneId)),
	)
	ipcMain.handle(
		"browser-lanes:stop",
		withLogging("browser-lanes:stop", async (_, laneId: string) => await stopBrowserLane(laneId)),
	)
	ipcMain.handle(
		"browser-lanes:restart",
		withLogging("browser-lanes:restart", async (_, laneId: string) => await restartBrowserLane(laneId)),
	)
	ipcMain.handle(
		"browser-lanes:reset-profile",
		withLogging(
			"browser-lanes:reset-profile",
			async (_, laneId: string) => await resetBrowserLaneProfile(laneId),
		),
	)
	ipcMain.handle(
		"browser-lanes:health",
		withLogging(
			"browser-lanes:health",
			async (_, laneId: string) => await refreshBrowserLaneHealth(laneId),
		),
	)
	ipcMain.handle(
		"browser-lanes:navigate",
		withLogging(
			"browser-lanes:navigate",
			async (_, laneId: string, url: string) => await navigateBrowserLane(laneId, url),
		),
	)
	ipcMain.handle(
		"browser-lanes:tabs:list",
		withLogging("browser-lanes:tabs:list", async (_, laneId: string) => await listBrowserLaneTabs(laneId)),
	)
	ipcMain.handle(
		"browser-lanes:tabs:create",
		withLogging(
			"browser-lanes:tabs:create",
			async (_, laneId: string, input?: { url?: string | null }) =>
				await createBrowserLaneTab(laneId, input),
		),
	)
	ipcMain.handle(
		"browser-lanes:tabs:activate",
		withLogging(
			"browser-lanes:tabs:activate",
			async (_, laneId: string, tabId: string) => await activateBrowserLaneTab(laneId, tabId),
		),
	)
	ipcMain.handle(
		"browser-lanes:tabs:close",
		withLogging(
			"browser-lanes:tabs:close",
			async (_, laneId: string, tabId: string) => await closeBrowserLaneTab(laneId, tabId),
		),
	)
	ipcMain.handle(
		"browser-lanes:tabs:navigate",
		withLogging(
			"browser-lanes:tabs:navigate",
			async (_, laneId: string, tabId: string, input: { url: string }) =>
				await navigateBrowserLaneTab(laneId, tabId, input),
		),
	)
	ipcMain.handle(
		"palot:browser-state-snapshot",
		withLogging("palot:browser-state-snapshot", async (_, sessionId: string) =>
			getBrowserStateSnapshot(sessionId),
		),
	)
	ipcMain.handle(
		"palot:browser-action",
		withLogging("palot:browser-action", async (_, input: { event: import("../preload/api").BrowserActionEvent }) =>
			publishBrowserAction(publishBrowserActionInputSchema.parse(input)),
		),
	)
	ipcMain.handle(
		"palot:binding-get",
		withLogging("palot:binding-get", async (_, sessionId: string) => getSessionBinding(sessionId)),
	)
	ipcMain.handle(
		"palot:binding-set",
		withLogging(
			"palot:binding-set",
			async (_, binding: import("../preload/api").SessionBinding) =>
				setSessionBinding(sessionBindingSchema.parse(binding)),
		),
	)
	ipcMain.handle(
		"palot:binding-release",
		withLogging("palot:binding-release", async (_, sessionId: string) =>
			releaseSessionBindingBySessionId(sessionId),
		),
	)
	ipcMain.handle(
		"palot:ui-state-snapshot",
		withLogging("palot:ui-state-snapshot", async () => getUiStateSnapshot()),
	)
	ipcMain.handle(
		"palot:ui-state-snapshot:set",
		withLogging(
			"palot:ui-state-snapshot:set",
			async (_, snapshot: import("../preload/api").PalotUiStateSnapshot) =>
				setUiStateSnapshot(palotUiStateSnapshotSchema.parse(snapshot)),
		),
	)
	ipcMain.handle(
		"palot:open-side-panel",
		withLogging("palot:open-side-panel", async (_, tab: import("../preload/api").SidePanelTabId) => {
			const parsedTab = palotOpenSidePanelInputSchema.parse(tab)
			const targetPanel =
				FIREFLY_SURFACE_LANE_BY_ID[parsedTab] === "document" ? "documentPanel" : "sidePanel"
			const snapshot = setUiStateSnapshot({
				[targetPanel]: {
					open: true,
					activeTab: parsedTab,
				},
			})
			broadcastOpenSidePanel(parsedTab)
			return snapshot
		}),
	)
	ipcMain.handle(
		"palot:loom-session-open",
		withLogging("palot:loom-session-open", async (_, sessionId: string) => {
			sessionOpenCommand(sessionId, encodeWirePayload({ title: sessionId }))
			const session = getLoomSessionState(sessionId)
			const resolved = await resolveLoomSession(sessionId)
			return {
				sessionId,
				surfaceUrl: resolved.surface_url,
				rev: session?.rev ?? 0,
			}
		}),
	)
	ipcMain.handle(
		"palot:loom-event",
		withLogging(
			"palot:loom-event",
			async (_, sessionId: string, event: { type: string; nodeId: string; payload?: Record<string, unknown> }) => {
				queueLoomEvent(sessionId, event)
			},
		),
	)
	ipcMain.handle(
		"palot:loom-state",
		withLogging(
			"palot:loom-state",
			async (_, sessionId: string, delta: { nodeId: string; field: string; value: unknown }) => {
				stateCommand(sessionId, encodeWirePayload({ delta }))
			},
		),
	)

	// --- Model state ---

	ipcMain.handle(
		"model-state",
		withLogging("model-state", async () => await readModelState()),
	)

	ipcMain.handle(
		"model-state:update-recent",
		withLogging(
			"model-state:update-recent",
			async (_, model: { providerID: string; modelID: string }) => await updateModelRecent(model),
		),
	)

	// --- Auto-updater ---

	ipcMain.handle("updater:state", () => getUpdateState())

	ipcMain.handle("updater:check", async () => await checkForUpdates())

	ipcMain.handle("updater:download", async () => await downloadUpdate())

	ipcMain.handle("updater:install", async () => await installUpdate())

	ipcMain.handle("updater:open-release-page", async () => await openReleasePage())

	// --- Git operations ---

	ipcMain.handle(
		"git:branches",
		withLogging("git:branches", async (_, directory: string) => await listBranches(directory)),
	)

	ipcMain.handle(
		"git:status",
		withLogging("git:status", async (_, directory: string) => await getStatus(directory)),
	)

	ipcMain.handle(
		"git:checkout",
		withLogging(
			"git:checkout",
			async (_, directory: string, branch: string) => await checkout(directory, branch),
		),
	)

	ipcMain.handle(
		"git:stash-and-checkout",
		withLogging(
			"git:stash-and-checkout",
			async (_, directory: string, branch: string) => await stashAndCheckout(directory, branch),
		),
	)

	ipcMain.handle(
		"git:stash-pop",
		withLogging("git:stash-pop", async (_, directory: string) => await stashPop(directory)),
	)

	ipcMain.handle(
		"git:diff-stat",
		withLogging("git:diff-stat", async (_, directory: string) => await getDiffStat(directory)),
	)

	ipcMain.handle(
		"git:commit-all",
		withLogging(
			"git:commit-all",
			async (_, directory: string, message: string) => await commitAll(directory, message),
		),
	)

	ipcMain.handle(
		"git:push",
		withLogging(
			"git:push",
			async (_, directory: string, remote?: string) => await push(directory, remote),
		),
	)

	ipcMain.handle(
		"git:create-branch",
		withLogging(
			"git:create-branch",
			async (_, directory: string, branchName: string) => await createBranch(directory, branchName),
		),
	)

	ipcMain.handle(
		"git:apply-to-local",
		withLogging(
			"git:apply-to-local",
			async (_, worktreeDir: string, localDir: string) =>
				await applyChangesToLocal(worktreeDir, localDir),
		),
	)

	ipcMain.handle(
		"git:apply-diff-text",
		withLogging(
			"git:apply-diff-text",
			async (_, localDir: string, diffText: string) =>
				await applyDiffTextToLocal(localDir, diffText),
		),
	)

	ipcMain.handle(
		"git:root",
		withLogging("git:root", async (_, directory: string) => await getGitRoot(directory)),
	)

	ipcMain.handle(
		"git:remote-url",
		withLogging(
			"git:remote-url",
			async (_, directory: string, remote?: string) => await getRemoteUrl(directory, remote),
		),
	)

	// --- Directory picker ---

	ipcMain.handle(
		"dialog:open-directory",
		withLogging("dialog:open-directory", async () => {
			const result = await dialog.showOpenDialog({
				properties: ["openDirectory"],
				title: "Select a project folder",
			})
			if (result.canceled || result.filePaths.length === 0) return null
			return result.filePaths[0]
		}),
	)

	ipcMain.handle(
		"files:list-directory",
		withLogging("files:list-directory", async (_, directory: string) => listProjectDirectory(directory)),
	)

	ipcMain.handle(
		"files:read-directory-tree",
		withLogging("files:read-directory-tree", async (_, directory: string) => readDirectoryTree(directory)),
	)

	ipcMain.handle(
		"files:git-status",
		withLogging("files:git-status", async (_, directory: string) => await getGitStatus(directory)),
	)

	ipcMain.handle(
		"files:git-pulse",
		withLogging("files:git-pulse", async (_, directories: string[]) => await getGitPulse(directories)),
	)

	ipcMain.handle("files:home-dir", withLogging("files:home-dir", async () => getHomeDirectory()))

	ipcMain.handle(
		"files:detect-project",
		withLogging("files:detect-project", async (_, filePath: string) => detectProject(filePath)),
	)

	ipcMain.handle(
		"files:list-projects",
		withLogging("files:list-projects", async (_, rootDirectory?: string) => listKnownProjects(rootDirectory)),
	)

	ipcMain.handle(
		"files:read-preview",
		withLogging("files:read-preview", async (_, filePath: string) => readFilePreview(filePath)),
	)

	ipcMain.handle(
		"files:read-text",
		withLogging("files:read-text", async (_, filePath: string) => readTextFile(filePath)),
	)

	ipcMain.handle(
		"files:write-text",
		withLogging("files:write-text", async (_, filePath: string, content: string) =>
			writeTextFile(filePath, content),
		),
	)

	ipcMain.handle(
		"files:delete-path",
		withLogging("files:delete-path", async (_, filePath: string) => deleteProjectPath(filePath)),
	)

	ipcMain.handle(
		"files:save-image-temp",
		withLogging("files:save-image-temp", async (_, data: string, extension: string) =>
			saveImageTemp(data, extension),
		),
	)

	ipcMain.handle(
		"office:convert",
		withLogging("office:convert", async (_, filePath: string) => convertOfficeToPdf(filePath)),
	)

	ipcMain.handle("oracles:list", withLogging("oracles:list", async () => listOracles()))
	ipcMain.handle(
		"oracles:list-tmux-sessions",
		withLogging("oracles:list-tmux-sessions", async () => listTmuxSessions()),
	)
	ipcMain.handle(
		"oracles:create",
		withLogging("oracles:create", async (_, identity: string, command?: string | null) =>
			createOracle(identity, command),
		),
	)
	ipcMain.handle(
		"oracles:rename",
		withLogging("oracles:rename", async (_, from: string, to: string) => renameOracle(from, to)),
	)
	ipcMain.handle(
		"oracles:delete",
		withLogging("oracles:delete", async (_, identity: string, force?: boolean) =>
			deleteOracle(identity, force),
		),
	)
	ipcMain.handle(
		"oracles:kill-tmux-session",
		withLogging("oracles:kill-tmux-session", async (_, socket: string, session: string) =>
			killTmuxSession(socket, session),
		),
	)
	ipcMain.handle(
		"oracles:appshot",
		withLogging("oracles:appshot", async (_, identity?: string | null) => oracleAppshot(identity)),
	)

	ipcMain.handle(
		"files:read",
		withLogging("files:read", async (_, filePath: string) => await readProjectFile(filePath)),
	)

	ipcMain.handle(
		"pty:spawn-shell",
		withLogging("pty:spawn-shell", async (_, request) => ptyController.spawnShell(request)),
	)

	ipcMain.handle(
		"pty:spawn-terminal",
		withLogging("pty:spawn-terminal", async (_, request) => ptyController.spawnTerminal(request)),
	)

	ipcMain.handle(
		"pty:spawn-oracle",
		withLogging("pty:spawn-oracle", async (_, request) => ptyController.spawnOracle(request)),
	)

	ipcMain.handle(
		"pty:spawn-tmux",
		withLogging("pty:spawn-tmux", async (_, request) => ptyController.spawnTmux(request)),
	)

	ipcMain.handle(
		"pty:write",
		withLogging("pty:write", async (_, id: number, data: string) => ptyController.write(id, data)),
	)

	ipcMain.handle(
		"pty:resize",
		withLogging("pty:resize", async (_, id: number, cols: number, rows: number) =>
			ptyController.resize(id, cols, rows),
		),
	)

	ipcMain.handle(
		"pty:kill",
		withLogging("pty:kill", async (_, id: number) => ptyController.kill(id)),
	)

	ipcMain.handle(
		"bridges:list",
		withLogging("bridges:list", async () => await listBridges()),
	)

	ipcMain.handle(
		"bridges:activity",
		withLogging(
			"bridges:activity",
			async (_, id: string, limit?: number) => await bridgeActivity(id, limit ?? 25),
		),
	)

	ipcMain.handle(
		"crm:load",
		withLogging("crm:load", async () => await loadCrmStore()),
	)

	ipcMain.handle(
		"crm:save-contact",
		withLogging("crm:save-contact", async (_, contact) => await saveContact(contact)),
	)

	ipcMain.handle(
		"crm:delete-contact",
		withLogging("crm:delete-contact", async (_, id: string) => await deleteContact(id)),
	)

	ipcMain.handle(
		"inbox:list-customers",
		withLogging("inbox:list-customers", async () => await listCustomers()),
	)

	ipcMain.handle(
		"inbox:customer-thread",
		withLogging(
			"inbox:customer-thread",
			async (_, handle: string, limit?: number) => await customerThread(handle, limit ?? 200),
		),
	)

	ipcMain.handle(
		"inbox:send-message",
		withLogging(
			"inbox:send-message",
			async (_, channel: InboxChannel, to: string, text: string) =>
				await sendInboxMessage(channel, to, text),
		),
	)

	ipcMain.handle(
		"tmux:list",
		withLogging("tmux:list", async (): Promise<TmuxSessionInfo[]> => await listTmuxSessions()),
	)

	ipcMain.handle(
		"tmux:kill-session",
		withLogging("tmux:kill-session", async (_, socket: string, session: string) => await killTmuxSession(socket, session)),
	)

	// --- Fetch proxy (bypasses Chromium connection limits) ---

	ipcMain.handle("fetch:request", withLogging("fetch:request", handleFetchProxy))

	// --- CLI install ---

	ipcMain.handle("cli:is-installed", () => isCliInstalled())

	ipcMain.handle("cli:install", () => installCli())

	ipcMain.handle("cli:uninstall", () => uninstallCli())

	// --- Open in external app ---

	ipcMain.handle("open-in:targets", () => getOpenInTargets())

	ipcMain.handle(
		"open-in:open",
		withLogging(
			"open-in:open",
			async (_, directory: string, targetId: string, persistPreferred?: boolean) =>
				await openInTarget(directory, targetId, { persistPreferred }),
		),
	)

	ipcMain.handle("open-in:set-preferred", (_, targetId: string) => {
		setPreferredTarget(targetId)
		return { success: true }
	})

	ipcMain.handle(
		"browser:open-external",
		withLogging("browser:open-external", async (_, url: string) => {
			await shell.openExternal(url)
		}),
	)

	// --- Chrome tier (pull-based, avoids race with push-based "chrome-tier" event) ---

	ipcMain.handle("chrome-tier:get", () => getResolvedChromeTier())

	// --- Window preferences (opaque windows) ---

	ipcMain.handle("prefs:get-opaque-windows", () => {
		return getOpaqueWindows()
	})

	ipcMain.handle("prefs:set-opaque-windows", (_, value: boolean) => {
		updateSettings({ opaqueWindows: value })
		return { success: true }
	})

	ipcMain.handle("app:relaunch", () => {
		app.relaunch()
		app.exit(0)
	})

	// --- Notifications ---

	ipcMain.handle("notification:dismiss", (_, sessionId: string) => {
		dismissNotification(sessionId)
	})

	ipcMain.handle("notification:badge", (_, count: number) => {
		updateBadgeCount(count)
	})

	// --- Settings ---

	ipcMain.handle("settings:get", () => getSettings())

	ipcMain.handle("settings:update", (_, partial) => updateSettings(partial))

	ipcMain.handle(
		"mcp-connections:config-upsert",
		withLogging(
			"mcp-connections:config-upsert",
			(_, input: import("../preload/api").McpConnectionConfigMutationInput) =>
				upsertMcpConnectionConfig(input),
		),
	)

	ipcMain.handle(
		"mcp-connections:config-remove",
		withLogging("mcp-connections:config-remove", (_, name: string) => removeMcpConnectionConfig(name)),
	)

	ipcMain.handle(
		"mcp-connections:catalog-browse",
		withLogging(
			"mcp-connections:catalog-browse",
			(_, input: import("../preload/api").McpCatalogBrowseInput) => browseCatalog(input),
		),
	)

	ipcMain.handle(
		"mcp-connections:catalog-search",
		withLogging(
			"mcp-connections:catalog-search",
			(_, input: import("../preload/api").McpCatalogSearchInput) => searchCatalog(input),
		),
	)

	ipcMain.handle(
		"mcp-connections:register",
		withLogging(
			"mcp-connections:register",
			(
				_,
				input: {
					name: string
					transport: "remote-http" | "remote-sse" | "local-stdio"
					target: string
					ownershipMode?: "local-only" | "cloud-only" | "handoff-derived"
					canonicalStore?: "local" | "gateway"
					restorePolicy?: "none" | "reproject_on_boot" | "reproject_and_reauth_if_needed"
					source?: "registry" | "curated" | "imported" | "manual"
					scope?: "home" | "project"
					metadata?: Record<string, unknown>
				},

			) => registerMcpConnection(input),
		),
	)

	ipcMain.handle(
		"mcp-connections:login",
		withLogging("mcp-connections:login", (_, name: string) => loginMcpConnection(name)),
	)

	ipcMain.handle(
		"mcp-connections:test",
		withLogging("mcp-connections:test", (_, name: string) => testMcpConnection(name)),
	)

	ipcMain.handle("mcp-connections:records-list", withLogging("mcp-connections:records-list", () => listMcpConnectionRecords()))

	// --- Credential storage (safeStorage-backed) ---

	ipcMain.handle(
		"credential:store",
		withLogging("credential:store", (_, serverId: string, password: string) => {
			storeCredential(serverId, password)
		}),
	)

	ipcMain.handle("credential:get", (_, serverId: string) => getCredential(serverId))

	ipcMain.handle(
		"credential:delete",
		withLogging("credential:delete", (_, serverId: string) => {
			deleteCredential(serverId)
		}),
	)

	// --- Firefly Cloud auth ---

	ipcMain.handle("auth:get-state", async () => {
		return getAuthState()
	})

	ipcMain.handle("auth:sign-in", async (_, clientId?: string) => {
		return startSignIn(clientId)
	})

	ipcMain.handle("auth:poll", async () => {
		const state = await pollSignIn()
		for (const win of BrowserWindow.getAllWindows()) {
			win.webContents.send("auth:state-changed", state)
		}
		return state
	})

	ipcMain.handle("auth:cancel-sign-in", async () => {
		return cancelSignIn()
	})

	ipcMain.handle("auth:sign-out", async () => {
		await signOut()
		for (const win of BrowserWindow.getAllWindows()) {
			win.webContents.send("auth:state-changed", null)
		}
	})

	// --- Firefly Cloud runtime (Lane B first end-to-end consumer) ---

	ipcMain.handle(
		"cloud:runtime-status",
		withLogging("cloud:runtime-status", async () => {
			const { getFireflyRuntimeProvisioningStatus } = await import(
				"./services/cloud/firefly-runtime-client"
			)
			return getFireflyRuntimeProvisioningStatus()
		}),
	)

	ipcMain.handle(
		"cloud:claim-runtime",
		withLogging("cloud:claim-runtime", async () => {
			const { claimFireflyRuntime } = await import(
				"./services/cloud/firefly-runtime-client"
			)
			return claimFireflyRuntime()
		}),
	)

	// --- mDNS discovery ---

	ipcMain.handle("mdns:get-discovered", () => getDiscoveredServers())

	// --- Remote server connectivity test ---

	ipcMain.handle(
		"server:test-connection",
		withLogging(
			"server:test-connection",
			async (_, url: string, username?: string, password?: string) => {
				try {
					const headers: Record<string, string> = {}
					if (password) {
						const user = username || "opencode"
						headers.Authorization = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`
					}
					const res = await net.fetch(`${url}/session`, {
						method: "GET",
						headers,
						signal: AbortSignal.timeout(5000),
					})
					if (res.ok) return null
					if (res.status === 401) return "Authentication failed. Check username and password."
					return `Server responded with HTTP ${res.status} ${res.statusText}`
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					if (msg.includes("ECONNREFUSED")) return "Connection refused. Is the server running?"
					if (msg.includes("ENOTFOUND")) return "Host not found. Check the URL."
					if (msg.includes("ETIMEDOUT") || msg.includes("timeout")) return "Connection timed out."
					if (msg.includes("CERT")) return `TLS/certificate error: ${msg}`
					return `Connection failed: ${msg}`
				}
			},
		),
	)

	// --- Native theme (controls macOS glass tint color) ---

	ipcMain.handle("theme:set-native", (_, source: string) => {
		if (source === "light" || source === "dark") {
			nativeTheme.themeSource = source
		} else {
			nativeTheme.themeSource = "system"
		}
	})

	// --- System accent color (macOS / Windows) ---

	ipcMain.handle("theme:accent-color", () => {
		try {
			return systemPreferences.getAccentColor()
		} catch {
			return null
		}
	})

	// Broadcast accent color changes to all renderer windows
	systemPreferences.on("accent-color-changed", (_event, newColor) => {
		for (const win of BrowserWindow.getAllWindows()) {
			win.webContents.send("theme:accent-color-changed", newColor)
		}
	})

	// --- Onboarding ---

	ipcMain.handle(
		"onboarding:check-opencode",
		withLogging("onboarding:check-opencode", async () => await checkOpenCodeInstallation()),
	)

	ipcMain.handle(
		"onboarding:install-opencode",
		withLogging("onboarding:install-opencode", async () => await installOpenCode()),
	)

	ipcMain.handle(
		"onboarding:detect-providers",
		withLogging("onboarding:detect-providers", async () => await detectProviders()),
	)

	ipcMain.handle(
		"onboarding:scan-provider",
		withLogging(
			"onboarding:scan-provider",
			async (_, provider: MigrationProvider) => await scanProvider(provider),
		),
	)

	ipcMain.handle(
		"onboarding:preview-migration",
		withLogging(
			"onboarding:preview-migration",
			async (_, provider: MigrationProvider, scanResult: unknown, categories: string[]) =>
				await previewMigration(provider, scanResult, categories),
		),
	)

	ipcMain.handle(
		"onboarding:execute-migration",
		withLogging(
			"onboarding:execute-migration",
			async (_, provider: MigrationProvider, scanResult: unknown, categories: string[]) =>
				await executeMigration(provider, scanResult, categories),
		),
	)

	ipcMain.handle(
		"onboarding:restore-backup",
		withLogging("onboarding:restore-backup", async () => await restoreMigrationBackup()),
	)

	// --- Automations ---

	ipcMain.handle(
		"automation:list",
		withLogging("automation:list", () => listAutomations()),
	)

	ipcMain.handle(
		"automation:get",
		withLogging("automation:get", (_, id: string) => getAutomation(id)),
	)

	ipcMain.handle(
		"automation:create",
		withLogging("automation:create", async (_, input: CreateAutomationInput) => {
			const result = await createAutomation(input)
			for (const win of BrowserWindow.getAllWindows()) {
				win.webContents.send("automation:runs-updated")
			}
			return result
		}),
	)

	ipcMain.handle(
		"automation:update",
		withLogging("automation:update", async (_, input: UpdateAutomationInput) => {
			const result = await updateAutomation(input)
			for (const win of BrowserWindow.getAllWindows()) {
				win.webContents.send("automation:runs-updated")
			}
			return result
		}),
	)

	ipcMain.handle(
		"automation:delete",
		withLogging("automation:delete", async (_, id: string) => {
			const result = await deleteAutomation(id)
			for (const win of BrowserWindow.getAllWindows()) {
				win.webContents.send("automation:runs-updated")
			}
			return result
		}),
	)

	ipcMain.handle(
		"automation:run-now",
		withLogging("automation:run-now", async (_, id: string) => {
			// runNow is fire-and-forget: it returns immediately after validating
			// the automation exists. Execution happens in the background, and
			// broadcastRunsUpdated() is called from within executeAutomation.
			return runNow(id)
		}),
	)

	ipcMain.handle(
		"automation:list-runs",
		withLogging("automation:list-runs", (_, automationId?: string) => listRuns(automationId)),
	)

	ipcMain.handle(
		"automation:archive-run",
		withLogging("automation:archive-run", async (_, runId: string) => {
			const result = await archiveRun(runId)
			for (const win of BrowserWindow.getAllWindows()) {
				win.webContents.send("automation:runs-updated")
			}
			return result
		}),
	)

	ipcMain.handle(
		"automation:accept-run",
		withLogging("automation:accept-run", async (_, runId: string) => {
			const result = await acceptRun(runId)
			for (const win of BrowserWindow.getAllWindows()) {
				win.webContents.send("automation:runs-updated")
			}
			return result
		}),
	)

	ipcMain.handle(
		"automation:mark-run-read",
		withLogging("automation:mark-run-read", async (_, runId: string) => {
			const result = await markRunRead(runId)
			for (const win of BrowserWindow.getAllWindows()) {
				win.webContents.send("automation:runs-updated")
			}
			return result
		}),
	)

	ipcMain.handle(
		"automation:preview-schedule",
		withLogging("automation:preview-schedule", (_, rrule: string, timezone: string) =>
			previewSchedule(rrule, timezone),
		),
	)

	// --- Settings push channel (main -> renderer) ---
	// Notify all renderer windows when settings change so they can update reactively.

	onSettingsChanged((settings) => {
		for (const win of BrowserWindow.getAllWindows()) {
			win.webContents.send("settings:changed", settings)
		}
	})
}
