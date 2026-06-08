import { contextBridge, ipcRenderer } from "electron"
import type { DeviceCodeUi, ElfAuthStateDto } from "./api"

/**
 * Preload bridge — exposes a typed API from the main process to the renderer.
 *
 * The renderer accesses these via `window.elf*`.
 * All methods return Promises (backed by `ipcRenderer.invoke`).
 */
contextBridge.exposeInMainWorld("elf", {
	/** The host platform: "darwin", "win32", or "linux". */
	platform: process.platform,

	/** Returns app version and dev/production mode. */
	getAppInfo: () => ipcRenderer.invoke("app:info"),

	// --- Window chrome / liquid glass ---

	/**
	 * Subscribes to the window chrome tier notification from the main process.
	 * Fired once after the window finishes loading.
	 * Tier values: "liquid-glass" | "vibrancy" | "opaque"
	 */
	onChromeTier: (callback: (tier: string) => void) => {
		const listener = (_event: unknown, tier: string) => callback(tier)
		ipcRenderer.on("chrome-tier", listener)
		return () => {
			ipcRenderer.removeListener("chrome-tier", listener)
		}
	},

	/** Get the current chrome tier (pull-based, avoids race with push event). */
	getChromeTier: () => ipcRenderer.invoke("chrome-tier:get"),

	/** Ensures the OpenCode server is running. Spawns it if not. */
	ensureOpenCode: () => ipcRenderer.invoke("opencode:ensure"),

	/** Gets the URL of the running server, or null. */
	getServerUrl: () => ipcRenderer.invoke("opencode:url"),

	/** Stops the managed OpenCode server. */
	stopOpenCode: () => ipcRenderer.invoke("opencode:stop"),

	/** Restarts the managed OpenCode server (stops and re-starts with current settings). */
	restartOpenCode: () => ipcRenderer.invoke("opencode:restart"),

	getActiveOpenCodeSessions: () => ipcRenderer.invoke("opencode:active-sessions"),
	browserLanes: {
		list: () => ipcRenderer.invoke("browser-lanes:list"),
		createRemote: (input: import("./api").CreateRemoteBrowserLaneInput) =>
			ipcRenderer.invoke("browser-lanes:create-remote", input),
		ensure: (laneId: string) => ipcRenderer.invoke("browser-lanes:ensure", laneId),
		start: (laneId: string) => ipcRenderer.invoke("browser-lanes:start", laneId),
		stop: (laneId: string) => ipcRenderer.invoke("browser-lanes:stop", laneId),
		restart: (laneId: string) => ipcRenderer.invoke("browser-lanes:restart", laneId),
		resetProfile: (laneId: string) => ipcRenderer.invoke("browser-lanes:reset-profile", laneId),
		health: (laneId: string) => ipcRenderer.invoke("browser-lanes:health", laneId),
		navigate: (laneId: string, url: string) =>
			ipcRenderer.invoke("browser-lanes:navigate", laneId, url),
		listTabs: (laneId: string) => ipcRenderer.invoke("browser-lanes:tabs:list", laneId),
		createTab: (laneId: string, input?: import("./api").CreateBrowserLaneTabInput) =>
			ipcRenderer.invoke("browser-lanes:tabs:create", laneId, input),
		activateTab: (laneId: string, tabId: string) =>
			ipcRenderer.invoke("browser-lanes:tabs:activate", laneId, tabId),
		closeTab: (laneId: string, tabId: string) =>
			ipcRenderer.invoke("browser-lanes:tabs:close", laneId, tabId),
		navigateTab: (
			laneId: string,
			tabId: string,
			input: import("./api").NavigateBrowserLaneTabInput,
		) => ipcRenderer.invoke("browser-lanes:tabs:navigate", laneId, tabId, input),
	},
	palot: {
		getBrowserStateSnapshot: (sessionId: string) =>
			ipcRenderer.invoke("palot:browser-state-snapshot", sessionId),
		publishBrowserAction: (input: { event: import("./api").BrowserActionEvent }) =>
			ipcRenderer.invoke("palot:browser-action", input),
		getBinding: (sessionId: string) => ipcRenderer.invoke("palot:binding-get", sessionId),
		setBinding: (binding: import("./api").SessionBinding) =>
			ipcRenderer.invoke("palot:binding-set", binding),
		releaseBinding: (sessionId: string) => ipcRenderer.invoke("palot:binding-release", sessionId),
		getUiStateSnapshot: () => ipcRenderer.invoke("palot:ui-state-snapshot"),
		openSidePanel: (tab: import("./api").SidePanelTabId) =>
			ipcRenderer.invoke("palot:open-side-panel", tab),
		onOpenSidePanel: (callback: (payload: { tab: import("./api").SidePanelTabId }) => void) => {
			const listener = (_event: unknown, payload: { tab: import("./api").SidePanelTabId }) => callback(payload)
			ipcRenderer.on("palot:open-side-panel", listener)
			return () => {
				ipcRenderer.removeListener("palot:open-side-panel", listener)
			}
		},
		onBrowserActions: (callback: (event: import("./api").BrowserActionEvent) => void) => {
			const listener = (_event: unknown, event: import("./api").BrowserActionEvent) => callback(event)
			ipcRenderer.on("palot:browser-actions", listener)
			return () => {
				ipcRenderer.removeListener("palot:browser-actions", listener)
			}
		},
	},

	onActiveOpenCodeSessionsChanged: (
		callback: (snapshot: import("./api").ActiveOpenCodeSessionsSnapshot) => void,
	) => {
		const listener = (
			_event: unknown,
			snapshot: import("./api").ActiveOpenCodeSessionsSnapshot,
		) => callback(snapshot)
		ipcRenderer.on("opencode:active-sessions", listener)
		return () => {
			ipcRenderer.removeListener("opencode:active-sessions", listener)
		}
	},

	// --- Credential storage (safeStorage-backed) ---

	credential: {
		store: (serverId: string, password: string) =>
			ipcRenderer.invoke("credential:store", serverId, password),
		get: (serverId: string) => ipcRenderer.invoke("credential:get", serverId),
		delete: (serverId: string) => ipcRenderer.invoke("credential:delete", serverId),
	},

	/** Test connectivity to a remote OpenCode server. Returns null on success or error message. */
	testServerConnection: (url: string, username?: string, password?: string) =>
		ipcRenderer.invoke("server:test-connection", url, username, password),

	// --- mDNS discovery ---

	mdns: {
		/** Get the current list of discovered servers. */
		getDiscovered: () => ipcRenderer.invoke("mdns:get-discovered"),
		/** Subscribe to discovered server list changes. */
		onChanged: (callback: (servers: unknown[]) => void) => {
			const listener = (_event: unknown, servers: unknown[]) => callback(servers)
			ipcRenderer.on("mdns:servers-changed", listener)
			return () => {
				ipcRenderer.removeListener("mdns:servers-changed", listener)
			}
		},
	},

	/** Reads model state (recent models, favorites, variants). */
	getModelState: () => ipcRenderer.invoke("model-state"),

	/** Updates the recent model list (adds model to front, deduplicates, caps at 10). */
	updateModelRecent: (model: { providerID: string; modelID: string }) =>
		ipcRenderer.invoke("model-state:update-recent", model),

	// --- Auto-updater ---

	/** Gets the current auto-updater state. */
	getUpdateState: () => ipcRenderer.invoke("updater:state"),

	/** Manually triggers an update check. */
	checkForUpdates: () => ipcRenderer.invoke("updater:check"),

	/** Starts downloading the available update. */
	downloadUpdate: () => ipcRenderer.invoke("updater:download"),

	/** Quits the app and installs the downloaded update. */
	installUpdate: () => ipcRenderer.invoke("updater:install"),

	/** Opens the GitHub release page for the current update version. */
	openReleasePage: () => ipcRenderer.invoke("updater:open-release-page"),

	/** Subscribes to update state changes pushed from the main process. */
	onUpdateStateChanged: (callback: (state: unknown) => void) => {
		const listener = (_event: unknown, state: unknown) => callback(state)
		ipcRenderer.on("updater:state-changed", listener)
		return () => {
			ipcRenderer.removeListener("updater:state-changed", listener)
		}
	},

	// --- Git operations ---

	git: {
		listBranches: (directory: string) => ipcRenderer.invoke("git:branches", directory),
		getStatus: (directory: string) => ipcRenderer.invoke("git:status", directory),
		checkout: (directory: string, branch: string) =>
			ipcRenderer.invoke("git:checkout", directory, branch),
		stashAndCheckout: (directory: string, branch: string) =>
			ipcRenderer.invoke("git:stash-and-checkout", directory, branch),
		stashPop: (directory: string) => ipcRenderer.invoke("git:stash-pop", directory),
		getRoot: (directory: string) => ipcRenderer.invoke("git:root", directory),
		diffStat: (directory: string) => ipcRenderer.invoke("git:diff-stat", directory),
		commitAll: (directory: string, message: string) =>
			ipcRenderer.invoke("git:commit-all", directory, message),
		push: (directory: string, remote?: string) => ipcRenderer.invoke("git:push", directory, remote),
		createBranch: (directory: string, branchName: string) =>
			ipcRenderer.invoke("git:create-branch", directory, branchName),
		applyToLocal: (worktreeDir: string, localDir: string) =>
			ipcRenderer.invoke("git:apply-to-local", worktreeDir, localDir),
		applyDiffText: (localDir: string, diffText: string) =>
			ipcRenderer.invoke("git:apply-diff-text", localDir, diffText),
		getRemoteUrl: (directory: string, remote?: string) =>
			ipcRenderer.invoke("git:remote-url", directory, remote),
	},

	// --- Window preferences (opaque windows / transparency) ---

	/** Get the persisted opaque windows preference from the main process. */
	getOpaqueWindows: () => ipcRenderer.invoke("prefs:get-opaque-windows"),

	/** Set the opaque windows preference and persist it in the main process. */
	setOpaqueWindows: (value: boolean) => ipcRenderer.invoke("prefs:set-opaque-windows", value),

	/** Relaunch the app (used after toggling transparency, which requires a restart). */
	relaunch: () => ipcRenderer.invoke("app:relaunch"),

	// --- CLI install ---

	cli: {
		/** Checks whether the `elf` CLI command is installed. */
		isInstalled: () => ipcRenderer.invoke("cli:is-installed"),
		/** Installs the `elf` CLI command (symlinks to /usr/local/bin). */
		install: () => ipcRenderer.invoke("cli:install"),
		/** Uninstalls the `elf` CLI command. */
		uninstall: () => ipcRenderer.invoke("cli:uninstall"),
	},

	// --- Open in external app ---

	openIn: {
		getTargets: () => ipcRenderer.invoke("open-in:targets"),
		open: (directory: string, targetId: string, persistPreferred?: boolean) =>
			ipcRenderer.invoke("open-in:open", directory, targetId, persistPreferred),
		setPreferred: (targetId: string) => ipcRenderer.invoke("open-in:set-preferred", targetId),
	},

	openExternal: (url: string) => ipcRenderer.invoke("browser:open-external", url),
	plugins: {
		list: () => ipcRenderer.invoke("firefly-plugin:list"),
		describe: (pluginId: string) => ipcRenderer.invoke("firefly-plugin:describe", { pluginId }),
		capabilities: (pluginId: string) =>
			ipcRenderer.invoke("firefly-plugin:state", { pluginId }),
		panels: () => ipcRenderer.invoke("firefly-plugin:panels"),
		widgets: () => ipcRenderer.invoke("firefly-plugin:widgets"),
		commands: () => ipcRenderer.invoke("firefly-plugin:commands"),
		themes: () => ipcRenderer.invoke("firefly-plugin:themes"),
		tools: (pluginId?: string) =>
			ipcRenderer.invoke("firefly-plugin:tools", { pluginId }),
		invoke: (input: { pluginId: string; commandId: string; args: Record<string, unknown> }) =>
			ipcRenderer.invoke("firefly-plugin:invoke", input),
		refresh: () => ipcRenderer.invoke("firefly-plugin:refresh"),
		onChanged: (callback: (payload: { appVersion: string; pluginCount: number }) => void) => {
			const listener = (
				_event: unknown,
				payload: { appVersion: string; pluginCount: number },
			) => callback(payload)
			ipcRenderer.on("firefly-plugin:changed", listener)
			return () => {
				ipcRenderer.removeListener("firefly-plugin:changed", listener)
			}
		},
	},
	clipboard: {
		readText: () => ipcRenderer.invoke("clipboard:read-text"),
		writeText: (text: string) => ipcRenderer.invoke("clipboard:write-text", text),
	},

	// --- Native theme (syncs macOS glass tint to app color scheme) ---

	/** Set the native theme source to control macOS glass tint color. */
	setNativeTheme: (source: string) => ipcRenderer.invoke("theme:set-native", source),

	/** Get the system accent color as an 8-char hex RRGGBBAA string, or null if unavailable. */
	getAccentColor: () => ipcRenderer.invoke("theme:accent-color"),

	/** Subscribe to system accent color changes (fired when the user changes OS accent color). */
	onAccentColorChanged: (callback: (color: string) => void) => {
		const listener = (_event: unknown, color: string) => callback(color)
		ipcRenderer.on("theme:accent-color-changed", listener)
		return () => {
			ipcRenderer.removeListener("theme:accent-color-changed", listener)
		}
	},

	// --- Directory picker ---

	/** Opens a native folder picker dialog. Returns the selected path, or null if cancelled. */
	pickDirectory: () => ipcRenderer.invoke("dialog:open-directory"),
	listDirectory: (directory: string) => ipcRenderer.invoke("files:list-directory", directory),
	readDirectoryTree: (directory: string) => ipcRenderer.invoke("files:read-directory-tree", directory),
	gitStatus: (directory: string) => ipcRenderer.invoke("files:git-status", directory),
	gitPulse: (directories: string[]) => ipcRenderer.invoke("files:git-pulse", directories),
	homeDir: () => ipcRenderer.invoke("files:home-dir"),
	detectProject: (filePath: string) => ipcRenderer.invoke("files:detect-project", filePath),
	listProjects: (rootDirectory?: string) => ipcRenderer.invoke("files:list-projects", rootDirectory),
	readFile: (filePath: string) => ipcRenderer.invoke("files:read", filePath),
	readFilePreview: (filePath: string) => ipcRenderer.invoke("files:read-preview", filePath),
	readTextFile: (filePath: string) => ipcRenderer.invoke("files:read-text", filePath),
	writeTextFile: (filePath: string, content: string) =>
		ipcRenderer.invoke("files:write-text", filePath, content),
	deletePath: (filePath: string) => ipcRenderer.invoke("files:delete-path", filePath),
	saveImageTemp: (data: string, extension: string) =>
		ipcRenderer.invoke("files:save-image-temp", data, extension),
	convertOfficeToPdf: (filePath: string) => ipcRenderer.invoke("office:convert", filePath),
	oracles: {
		list: () => ipcRenderer.invoke("oracles:list"),
		listTmuxSessions: () => ipcRenderer.invoke("oracles:list-tmux-sessions"),
		create: (identity: string, command?: string | null) => ipcRenderer.invoke("oracles:create", identity, command),
		rename: (from: string, to: string) => ipcRenderer.invoke("oracles:rename", from, to),
		delete: (identity: string, force?: boolean) => ipcRenderer.invoke("oracles:delete", identity, force),
		killTmuxSession: (socket: string, session: string) => ipcRenderer.invoke("oracles:kill-tmux-session", socket, session),
		appshot: (identity?: string | null) => ipcRenderer.invoke("oracles:appshot", identity),
	},
	bridges: {
		list: () => ipcRenderer.invoke("bridges:list"),
		activity: (id: string, limit?: number) => ipcRenderer.invoke("bridges:activity", id, limit),
	},
	crm: {
		load: () => ipcRenderer.invoke("crm:load"),
		saveContact: (contact: unknown) => ipcRenderer.invoke("crm:save-contact", contact),
		deleteContact: (id: string) => ipcRenderer.invoke("crm:delete-contact", id),
	},
	inbox: {
		listCustomers: () => ipcRenderer.invoke("inbox:list-customers"),
		customerThread: (handle: string, limit?: number) => ipcRenderer.invoke("inbox:customer-thread", handle, limit),
		sendMessage: (channel: string, to: string, text: string) => ipcRenderer.invoke("inbox:send-message", channel, to, text),
	},
	pty: {
		spawnShell: (request: { cols: number; rows: number; cwd?: string | null }) =>
			ipcRenderer.invoke("pty:spawn-shell", request),
		spawnTerminal: (request: {
			name: string
			command?: string | null
			cols: number
			rows: number
			cwd?: string | null
		}) => ipcRenderer.invoke("pty:spawn-terminal", request),
		spawnOracle: (request: { identity: string; cols: number; rows: number; cwd?: string | null }) =>
			ipcRenderer.invoke("pty:spawn-oracle", request),
		spawnTmux: (request: { socket: string; session: string; cols: number; rows: number; cwd?: string | null }) =>
			ipcRenderer.invoke("pty:spawn-tmux", request),
		write: (id: number, data: string) => ipcRenderer.invoke("pty:write", id, data),
		resize: (id: number, cols: number, rows: number) => ipcRenderer.invoke("pty:resize", id, cols, rows),
		kill: (id: number) => ipcRenderer.invoke("pty:kill", id),
		onData: (callback: (event: { id: number; data: string }) => void) => {
			const listener = (_event: unknown, data: { id: number; data: string }) => callback(data)
			ipcRenderer.on("pty:data", listener)
			return () => {
				ipcRenderer.removeListener("pty:data", listener)
			}
		},
		onExit: (callback: (event: { id: number; exitCode: number; signal?: number }) => void) => {
			const listener = (
				_event: unknown,
				data: { id: number; exitCode: number; signal?: number },
			) => callback(data)
			ipcRenderer.on("pty:exit", listener)
			return () => {
				ipcRenderer.removeListener("pty:exit", listener)
			}
		},
	},
	// --- Fetch proxy (bypasses Chromium connection limits) ---

	/**
	 * Proxies an HTTP request through the main process using Electron's `net.fetch()`.
	 * This bypasses Chromium's 6-connections-per-origin limit for HTTP/1.1.
	 * The renderer serializes the Request, sends it over IPC, and gets back
	 * a serialized Response.
	 */
	fetch: (req: {
		url: string
		method: string
		headers: Record<string, string>
		body: string | null
	}) => ipcRenderer.invoke("fetch:request", req),

	// --- Notifications ---

	/**
	 * Subscribes to notification navigation events from the main process.
	 * Fired when the user clicks a native OS notification — the renderer
	 * should navigate to the specified session.
	 */
	onNotificationNavigate: (callback: (data: { sessionId: string }) => void) => {
		const listener = (_event: unknown, data: { sessionId: string }) => callback(data)
		ipcRenderer.on("notification:navigate", listener)
		return () => {
			ipcRenderer.removeListener("notification:navigate", listener)
		}
	},

	/** Dismiss any active notification for a session (e.g. when the user navigates to it). */
	dismissNotification: (sessionId: string) => ipcRenderer.invoke("notification:dismiss", sessionId),

	/** Update the dock badge / app badge count. */
	updateBadgeCount: (count: number) => ipcRenderer.invoke("notification:badge", count),

	// --- Settings ---

	/** Get the full app settings object. */
	getSettings: () => ipcRenderer.invoke("settings:get"),

	/** Update settings with a partial object (deep-merged). */
	updateSettings: (partial: Record<string, unknown>) =>
		ipcRenderer.invoke("settings:update", partial),
	mcpConnections: {
		upsertConfig: (input: import("./api").McpConnectionConfigMutationInput) =>
			ipcRenderer.invoke("mcp-connections:config-upsert", input),
		removeConfig: (name: string) => ipcRenderer.invoke("mcp-connections:config-remove", name),
		browseCatalog: (input: import("./api").McpCatalogBrowseInput) =>
			ipcRenderer.invoke("mcp-connections:catalog-browse", input),
		searchCatalog: (input: import("./api").McpCatalogSearchInput) =>
			ipcRenderer.invoke("mcp-connections:catalog-search", input),
		register: (input: {
			name: string
			transport: "remote-http" | "remote-sse" | "local-stdio"
			target: string
			ownershipMode?: "local-only" | "cloud-only" | "handoff-derived"
			canonicalStore?: "local" | "gateway"
			restorePolicy?: "none" | "reproject_on_boot" | "reproject_and_reauth_if_needed"
			source?: "registry" | "curated" | "imported" | "manual"
			scope?: "home" | "project"
			metadata?: Record<string, unknown>
		}) => ipcRenderer.invoke("mcp-connections:register", input),
		login: (name: string) => ipcRenderer.invoke("mcp-connections:login", name),
		test: (name: string) => ipcRenderer.invoke("mcp-connections:test", name),
		listRecords: () => ipcRenderer.invoke("mcp-connections:records-list"),
	},

	/** Subscribe to settings changes pushed from the main process. */
	onSettingsChanged: (callback: (settings: unknown) => void) => {
		const listener = (_event: unknown, settings: unknown) => callback(settings)
		ipcRenderer.on("settings:changed", listener)
		return () => {
			ipcRenderer.removeListener("settings:changed", listener)
		}
	},

	// --- Automations ---

	automation: {
		list: () => ipcRenderer.invoke("automation:list"),
		get: (id: string) => ipcRenderer.invoke("automation:get", id),
		create: (input: unknown) => ipcRenderer.invoke("automation:create", input),
		update: (input: unknown) => ipcRenderer.invoke("automation:update", input),
		delete: (id: string) => ipcRenderer.invoke("automation:delete", id),
		runNow: (id: string) => ipcRenderer.invoke("automation:run-now", id),
		listRuns: (automationId?: string) => ipcRenderer.invoke("automation:list-runs", automationId),
		archiveRun: (runId: string) => ipcRenderer.invoke("automation:archive-run", runId),
		acceptRun: (runId: string) => ipcRenderer.invoke("automation:accept-run", runId),
		markRunRead: (runId: string) => ipcRenderer.invoke("automation:mark-run-read", runId),
		previewSchedule: (rrule: string, timezone: string) =>
			ipcRenderer.invoke("automation:preview-schedule", rrule, timezone),
	},

	onAutomationRunsUpdated: (callback: () => void) => {
		const listener = () => callback()
		ipcRenderer.on("automation:runs-updated", listener)
		return () => {
			ipcRenderer.removeListener("automation:runs-updated", listener)
		}
	},

	// --- Onboarding ---

	onboarding: {
		/** Check if OpenCode CLI is installed and compatible. */
		checkOpenCode: () => ipcRenderer.invoke("onboarding:check-opencode"),
		/** Install OpenCode CLI via the official install script. */
		installOpenCode: () => ipcRenderer.invoke("onboarding:install-opencode"),
		/** Subscribe to install output lines (streamed from the install script). */
		onInstallOutput: (callback: (text: string) => void) => {
			const listener = (_event: unknown, text: string) => callback(text)
			ipcRenderer.on("onboarding:install-output", listener)
			return () => {
				ipcRenderer.removeListener("onboarding:install-output", listener)
			}
		},
		/** Quick detect all supported providers (Claude Code, Cursor, OpenCode). */
		detectProviders: () => ipcRenderer.invoke("onboarding:detect-providers"),
		/** Full scan of a specific provider's configuration. */
		scanProvider: (provider: string) => ipcRenderer.invoke("onboarding:scan-provider", provider),
		/** Dry-run migration preview for a provider. */
		previewMigration: (provider: string, scanResult: unknown, categories: string[]) =>
			ipcRenderer.invoke("onboarding:preview-migration", provider, scanResult, categories),
		/** Execute migration (writes files with backup). */
		executeMigration: (provider: string, scanResult: unknown, categories: string[]) =>
			ipcRenderer.invoke("onboarding:execute-migration", provider, scanResult, categories),
		/** Subscribe to migration progress updates (history writing). */
		onMigrationProgress: (callback: (progress: unknown) => void) => {
			const listener = (_event: unknown, progress: unknown) => callback(progress)
			ipcRenderer.on("onboarding:migration-progress", listener)
			return () => {
				ipcRenderer.removeListener("onboarding:migration-progress", listener)
			}
		},
		/** Restore the most recent migration backup. */
		restoreBackup: () => ipcRenderer.invoke("onboarding:restore-backup"),
	},

	// --- Firefly Cloud auth ---
	auth: {
		getState(): Promise<ElfAuthStateDto | null> {
			return ipcRenderer.invoke("auth:get-state")
		},
		signIn(): Promise<DeviceCodeUi> {
			return ipcRenderer.invoke("auth:sign-in")
		},
		poll(): Promise<ElfAuthStateDto | null> {
			return ipcRenderer.invoke("auth:poll")
		},
		cancelSignIn(): Promise<void> {
			return ipcRenderer.invoke("auth:cancel-sign-in")
		},
		signOut(): Promise<void> {
			return ipcRenderer.invoke("auth:sign-out")
		},
		onChange(cb: (state: ElfAuthStateDto | null) => void): () => void {
			const listener = (_event: unknown, state: ElfAuthStateDto | null) => cb(state)
			ipcRenderer.on("auth:state-changed", listener)
			return () => {
				ipcRenderer.removeListener("auth:state-changed", listener)
			}
		},
	},
})
