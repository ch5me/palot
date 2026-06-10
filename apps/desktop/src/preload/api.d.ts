/**
 * Type definitions for the Electron preload bridge.
 *
 * These types are shared between the preload script and the renderer.
 * The renderer accesses these via `window.elf`.
 */

export interface OpenCodeServerInfo {
	url: string
	pid: number | null
	managed: boolean
}

export type BrowserLaneMode = "local" | "remote"

export type BrowserLaneRuntime = "docker-chromium" | "remote-attached"

export type BrowserLaneStatus =
	| "installing"
	| "starting"
	| "running"
	| "degraded"
	| "stopped"
	| "error"
	| "profile-locked"

export type BrowserLaneReadiness = "unknown" | "pending" | "ready" | "failed"

export interface BrowserLaneEndpoint {
	url: string | null
	checkedAt: number | null
	state: BrowserLaneReadiness
	error: string | null
}

export interface BrowserLaneHealth {
	status: BrowserLaneStatus
	stream: BrowserLaneEndpoint
	cdp: BrowserLaneEndpoint
	message: string
}

export interface BrowserLane {
	id: string
	label: string
	mode: BrowserLaneMode
	runtime: BrowserLaneRuntime
	streamPath: string
	streamBackendUrl: string | null
	desktopStreamUrl?: string | null
	cdpEndpoint: string | null
	profilePath: string | null
	host: string | null
	createdAt: number
	updatedAt: number
	health: BrowserLaneHealth
}

export interface BrowserLaneRecord {
	id: string
	label: string
	mode: BrowserLaneMode
	runtime: BrowserLaneRuntime
	streamBackendUrl: string | null
	cdpEndpoint: string | null
	profilePath: string | null
	host: string | null
	createdAt: number
	updatedAt: number
}

export interface CreateRemoteBrowserLaneInput {
	id: string
	label: string
	streamBackendUrl: string
	cdpEndpoint: string | null
	host?: string | null
	profilePath?: string | null
}

export interface BrowserLaneTab {
	id: string
	title: string
	url: string
	type: string
	active: boolean
	attached: boolean
	openerId: string | null
	faviconUrl: string | null
}

export interface BrowserLaneTabsState {
	laneId: string
	activeTabId: string | null
	tabs: BrowserLaneTab[]
}

export interface BrowserLaneTabActionResult extends BrowserLaneTabsState {
	tab: BrowserLaneTab | null
}

export interface CreateBrowserLaneTabInput {
	url?: string | null
}

export interface NavigateBrowserLaneTabInput {
	url: string
}

export interface BrowserLaneCapabilityReport {
	platform: NodeJS.Platform
	localRuntimeSupported: boolean
	remoteAttachSupported: boolean
	docker: {
		installed: boolean
		version: string | null
	}
	compose: {
		available: boolean
		command: "docker compose" | "docker-compose" | null
		version: string | null
	}
	unsupportedReason: string | null
	remediation: string | null
}

export type ActiveOpenCodeSessionPresenceSource = "attach" | "inferred"

export interface ActiveOpenCodeSessionPresence {
	sessionId: string
	directory: string
	pid: number
	source: ActiveOpenCodeSessionPresenceSource
	command: string
}

export interface ActiveOpenCodeSessionsSnapshot {
	serverUrl: string
	clientCount: number
	sessionCount: number
	sessions: ActiveOpenCodeSessionPresence[]
	refreshedAt: number
}

export type SessionBindingStatus =
	| "unbound"
	| "attaching"
	| "attached"
	| "suspended"
	| "restored"
	| "released"

export interface SessionBindingAuthority {
	openCodeSessionId: string
	browserLaneId: string | null
	magicBrowserSessionId: string | null
}

export interface SessionBinding {
	id: string
	openCodeSessionId: string
	browserLaneId: string | null
	magicBrowserSessionId: string | null
	status: SessionBindingStatus
	createdAt: number
	updatedAt: number
	releasedAt: number | null
}

export interface SessionBindingRecord {
	id: string
	openCodeSessionId: string
	browserLaneId: string | null
	magicBrowserSessionId: string | null
	status: SessionBindingStatus
	createdAt: number
	updatedAt: number
	releasedAt: number | null
}

export interface SessionBindingSecretRecord {
	bindingId: string
	viewerAuthToken: string
	updatedAt: number
}

export interface SessionBindingStoreFile {
	version: 1
	bindings: SessionBindingRecord[]
}

export type SidePanelTabId =
	| "review"
	| "browser"
	| "notes"
	| "pulse"
	| "memory"
	| "files"
	| "terminal"
	| "editor"
	| "plugins"
	| "bridges"
	| "crm"
	| "studio"
	| "voice"
	| "oracle"
	| "claude"
	| "ch5pm"
	| "artifacts"
	| "pdf-review"

export interface BrowserViewportSnapshot {
	currentUrl: string | null
	streamUrl: string | null
	viewportWidth: number | null
	viewportHeight: number | null
}

export interface BrowserStateSnapshot {
	sessionId: string
	activeLaneId: string | null
	magicBrowserSessionId: string | null
	viewerUrl: string | null
	binding: SessionBinding | null
	health: BrowserLaneHealth | null
	lastActions: BrowserActionEvent[]
	viewport: BrowserViewportSnapshot | null
}

export interface PalotSidePanelSnapshot {
	open: boolean
	activeTab: SidePanelTabId | null
	availableTabs: SidePanelTabId[]
}

export interface PalotUiStateSnapshot {
	sidePanel: PalotSidePanelSnapshot
}

export type BrowserActionSource =
	| "tool_request"
	| "automation_runtime"
	| "human_takeover"
	| "system_reconcile"

export type BrowserActionStatus =
	| "queued"
	| "dispatched"
	| "runtime_ack"
	| "completed"
	| "failed"
	| "cancelled"

export type BrowserActionCaretConfidence = "none" | "low" | "high"

export type BrowserActionErrorCode =
	| "unbound_session"
	| "lane_unavailable"
	| "human_in_control"
	| "magic_browser_unavailable"
	| "geometry_low_confidence"
	| "binding_in_flight"
	| "permission_denied"

export interface BrowserActionViewportCoords {
	x: number
	y: number
}

export interface BrowserActionTargetDescription {
	selector: string | null
	text: string | null
	role: string | null
}

export interface DomRectSnapshot {
	left: number
	top: number
	width: number
	height: number
}

export interface StreamGeometrySnapshot {
	viewportWidth: number
	viewportHeight: number
	scrollX: number
	scrollY: number
	panelWidth: number | null
	panelHeight: number | null
	zoom: number
}

export interface PanelGeometrySnapshot {
	viewportWidth: number
	viewportHeight: number
	offsetLeft: number
	offsetTop: number
	scaleX: number
	scaleY: number
}

export interface BrowserCoordinateTransformResult {
	x: number
	y: number
	caretConfidence: BrowserActionCaretConfidence
	fallbackLevel: 1 | 2 | 3
	showBestEffortBadge: boolean
}

export interface BrowserGeometryFixture {
	name: string
	domRect: DomRectSnapshot
	stream: StreamGeometrySnapshot
	panel: PanelGeometrySnapshot
	expected: BrowserCoordinateTransformResult
}

export interface BrowserActionEventBase {
	id: string
	sessionId: string
	laneId: string | null
	source: BrowserActionSource
	sequence: number
	requestId: string | null
	causationId: string | null
	toolCallId?: string | null
	targetDescription: BrowserActionTargetDescription | null
	viewportCoords: BrowserActionViewportCoords | null
	streamGeometrySnapshot: StreamGeometrySnapshot | null
	timestamp: number
	durationMs: number | null
	status: BrowserActionStatus
	errorCode?: BrowserActionErrorCode | null
	errorMessage?: string | null
}

export interface BrowserActionMoveEvent extends BrowserActionEventBase {
	kind: "move"
}

export interface BrowserActionClickEvent extends BrowserActionEventBase {
	kind: "click"
	button: "left" | "middle" | "right"
	clickCount: number
}

export interface BrowserActionTypeEvent extends BrowserActionEventBase {
	kind: "type"
	text: string
	caretConfidence: BrowserActionCaretConfidence
}

export interface BrowserActionScrollEvent extends BrowserActionEventBase {
	kind: "scroll"
	deltaX: number
	deltaY: number
}

export interface BrowserActionFocusEvent extends BrowserActionEventBase {
	kind: "focus"
}

export interface BrowserActionHoverEvent extends BrowserActionEventBase {
	kind: "hover"
}

export interface BrowserActionWaitForEvent extends BrowserActionEventBase {
	kind: "waitFor"
	waitFor: string
}

export interface BrowserActionNavigateEvent extends BrowserActionEventBase {
	kind: "navigate"
	url: string
}

export interface BrowserActionAttachSessionEvent extends BrowserActionEventBase {
	kind: "attachSession"
	magicBrowserSessionId: string | null
}

export interface BrowserActionDetachSessionEvent extends BrowserActionEventBase {
	kind: "detachSession"
	reason: string | null
}

export interface BrowserActionToolRequestEvent extends BrowserActionEventBase {
	kind: "toolRequest"
	toolName: string
	argsSummary: string | null
}

export interface BrowserActionToolResultEvent extends BrowserActionEventBase {
	kind: "toolResult"
	toolName: string
	resultSummary: string | null
}

export interface BrowserActionSystemReconcileEvent extends BrowserActionEventBase {
	kind: "systemReconcile"
	reason: string
}

export interface BrowserActionHumanTakeoverPausedEvent extends BrowserActionEventBase {
	kind: "humanTakeoverPaused"
	reason: string | null
}

export interface BrowserActionHumanTakeoverResumedEvent extends BrowserActionEventBase {
	kind: "humanTakeoverResumed"
	reason: string | null
}

export type BrowserActionEvent =
	| BrowserActionMoveEvent
	| BrowserActionClickEvent
	| BrowserActionTypeEvent
	| BrowserActionScrollEvent
	| BrowserActionFocusEvent
	| BrowserActionHoverEvent
	| BrowserActionWaitForEvent
	| BrowserActionNavigateEvent
	| BrowserActionAttachSessionEvent
	| BrowserActionDetachSessionEvent
	| BrowserActionToolRequestEvent
	| BrowserActionToolResultEvent
	| BrowserActionSystemReconcileEvent
	| BrowserActionHumanTakeoverPausedEvent
	| BrowserActionHumanTakeoverResumedEvent

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

export interface OracleInfo {
	identity: string
	session: string
	socket: string
	displayName: string
	attached: boolean
	isMaster: boolean
	running: boolean
}

export interface TmuxSessionInfo {
	socket: string
	name: string
	attached: boolean
	windows: number
	isOracle: boolean
}

export interface CrmContact {
	id: string
	name: string
	company?: string
	email?: string
	phone?: string
	channel?: "whatsapp" | "instagram" | "telegram" | "email" | "phone" | "referral" | "other"
	tags?: string[]
	notes?: string
	createdAt: number
}

export interface CrmStore {
	contacts: CrmContact[]
	deals: unknown[]
}

export type InboxChannel = "whatsapp" | "whatsapp-personal" | "instagram" | "telegram" | "email" | "phone" | "other"

export interface Customer {
	id: string
	name: string
	channel: InboxChannel
	handle: string
	lastAt: string | null
	lastAgo: string | null
	lastText: string
	msgCount: number
}

export interface InboxMessage {
	ts: string
	tsAgo: string | null
	direction: "out" | "in"
	text: string
}

export interface InboxSendResult {
	delivered: false
	ts: number
	reason: string
}

export interface PtySpawnRequest {
	cols: number
	rows: number
	cwd?: string | null
}

export interface PtyTerminalSpawnRequest extends PtySpawnRequest {
	name: string
	command?: string | null
}

export interface PtyOracleSpawnRequest extends PtySpawnRequest {
	identity: string
}

export interface PtyTmuxSpawnRequest extends PtySpawnRequest {
	socket: string
	session: string
}

export interface PtyDataEvent {
	id: number
	data: string
}

export interface PtyExitEvent {
	id: number
	exitCode: number
	signal?: number
}

export interface FileSystemEntry {
	name: string
	path: string
	type: "file" | "directory"
	mtime: number
}

export type GitCode = "M" | "A" | "D" | "R" | "U"

export interface FileGitEntry {
	path: string
	status: GitCode
}

export interface FileGitStatusResult {
	root: string | null
	entries: FileGitEntry[]
}

export interface RepoPulse {
	root: string
	name: string
	branch: string
	dirty: number
	ahead: number
	behind: number
}

export interface RunCommand {
	label: string
	cmd: string
}

export interface ProjectRun {
	kind: string
	root: string | null
	commands: RunCommand[]
}

export interface ProjectInfo {
	name: string
	root: string
	kind: string
	commands: RunCommand[]
	mtime: number
}

export type FilePreviewKind = "text" | "image" | "pdf" | "office" | "binary"

export interface FilePreview {
	kind: FilePreviewKind
	text: string | null
	size: number
	name: string
	truncated: boolean
}

export interface OfficeConversionResult {
	pdfPath: string
	cacheHit: boolean
}
export interface ModelRef {
	providerID: string
	modelID: string
}

export interface ModelState {
	recent: ModelRef[]
	favorite: ModelRef[]
	variant: Record<string, string | undefined>
}

export interface UpdateState {
	status: "idle" | "checking" | "available" | "downloading" | "ready" | "error"
	version?: string
	releaseNotes?: string
	progress?: {
		percent: number
		bytesPerSecond: number
		transferred: number
		total: number
	}
	error?: string
	/** Whether the app can auto-install updates (false on unsigned macOS builds). */
	canAutoInstall: boolean
}

// ============================================================
// Git types
// ============================================================

export interface GitBranchInfo {
	current: string
	detached: boolean
	local: string[]
	remote: string[]
}

export interface GitStatusInfo {
	isClean: boolean
	staged: number
	modified: number
	untracked: number
	conflicted: number
	summary: string
}

export interface GitCheckoutResult {
	success: boolean
	error?: string
}

export interface GitStashResult {
	success: boolean
	stashed: boolean
	error?: string
}

export interface GitDiffStat {
	filesChanged: number
	insertions: number
	deletions: number
	files: { path: string; insertions: number; deletions: number }[]
}

export interface GitCommitResult {
	success: boolean
	commitHash?: string
	error?: string
}

export interface GitPushResult {
	success: boolean
	error?: string
}

export interface GitApplyResult {
	success: boolean
	filesApplied: string[]
	error?: string
}

// ============================================================
// Open-in-targets types
// ============================================================

export interface OpenInTarget {
	id: string
	label: string
	available: boolean
	/** Base64-encoded PNG icon data URL, resolved at runtime from the installed app. */
	iconDataUrl?: string
}

export interface OpenInTargetsResult {
	targets: OpenInTarget[]
	availableTargets: string[]
	preferredTarget: string | null
}

// ============================================================
// Server config types (shared between main process and renderer)
// ============================================================

/** Built-in local server, auto-managed by Elf via OpenCodeManager. */
export interface LocalServerConfig {
	id: "local"
	name: string
	type: "local"
	/** Hostname the local server binds to (default "127.0.0.1"). Use "0.0.0.0" to expose on the network. */
	hostname?: string
	/** Port the local server listens on (default 14096). */
	port?: number
	/** Whether a password is configured for the local server (stored in safeStorage). */
	hasPassword?: boolean
	/** Enable mDNS service discovery so this server is advertised on the local network. */
	mdns?: boolean
	/** Custom mDNS domain name (default "opencode.local"). Only used when mdns is enabled. */
	mdnsDomain?: string
}

/** Remote server reachable over HTTP(S). */
export interface RemoteServerConfig {
	id: string
	name: string
	type: "remote"
	/** Full base URL, e.g. "https://opencode.example.com:<port>" */
	url: string
	/** Basic Auth username (defaults to "opencode" if omitted). */
	username?: string
	/** Whether a password is stored in safeStorage (never stored in settings.json). */
	hasPassword?: boolean
}

/** SSH tunnel server (future -- type is defined now to avoid config migration later). */
export interface SshServerConfig {
	id: string
	name: string
	type: "ssh"
	sshHost: string
	sshPort?: number
	sshUser: string
	sshAuthMethod: "key" | "password" | "agent"
	sshKeyPath?: string
	/** Where OpenCode listens on the remote machine (default 127.0.0.1). */
	remoteHost?: string
	remotePort: number
	/** Basic Auth username for the OpenCode server (defaults to "opencode"). */
	username?: string
	hasPassword?: boolean
}

export type ServerConfig = LocalServerConfig | RemoteServerConfig | SshServerConfig

// ============================================================
// mDNS discovery types
// ============================================================

/** A server discovered via mDNS on the local network. */
export interface DiscoveredMdnsServer {
	/** Unique key derived from host:port. */
	id: string
	/** Service name from mDNS (e.g. "opencode-<port>"). */
	name: string
	/** Resolved hostname or IP address. */
	host: string
	/** Port the OpenCode server is listening on. */
	port: number
	/** IP addresses reported by the service. */
	addresses: string[]
}

/** The default built-in local server entry (defined in server-config.ts). */
export declare const DEFAULT_LOCAL_SERVER: LocalServerConfig

export interface ServerSettings {
	/** Ordered list of configured servers. The local server is always first. */
	servers: ServerConfig[]
	/** ID of the currently active server. */
	activeServerId: string
}

// ============================================================
// Settings types (shared between main process and renderer)
// ============================================================

export type CompletionNotificationMode = "off" | "unfocused" | "always"

export interface NotificationSettings {
	completionMode: CompletionNotificationMode
	permissions: boolean
	questions: boolean
	errors: boolean
	dockBadge: boolean
}

export interface ConnectionsSettings {
	catalogCachePath?: string
	managedConfigPath?: string
	managedConfigPaths?: string[]
	connectionRecordsPath?: string
}

export interface McpConnectionConfigMutationInput {
	name: string
	config: Record<string, unknown>
}

// ============================================================
// Firefly Cloud auth types
// ============================================================

export interface ElfAuthStateDto {
	hasToken: boolean
	elfUserId: string | null
	expiresAt: number | null
	issuer: string | null
	audience: string | null
}

export interface DeviceCodeUi {
	userCode: string
	verificationUriComplete: string
	expiresIn: number
}

export interface ElfAuthApi {
	getState(): Promise<ElfAuthStateDto | null>
	signIn(): Promise<DeviceCodeUi>
	poll(): Promise<ElfAuthStateDto | null>
	cancelSignIn(): Promise<void>
	signOut(): Promise<void>
	onChange(cb: (state: ElfAuthStateDto | null) => void): () => void
}

export interface FireflyRuntimeStatus {
	state: string
	runtimeId: string | null
	region: string | null
	healthy: boolean
	lastUpdated: string
}

export interface FireflyCloudApi {
	getRuntimeStatus(): Promise<FireflyRuntimeStatus>
	claimRuntime(): Promise<{ runtimeId: string; status: string }>
}

export type {
	McpCatalogBrowseInput,
	McpCatalogSearchInput,
	McpConnectionRecordSnapshot,
} from "../shared/mcp-connections-shared"

export interface AppSettings {
	notifications: NotificationSettings
	/** Whether the user prefers opaque (solid) windows. Read at window creation time. */
	opaqueWindows: boolean
	/** Server connection configuration. */
	servers: ServerSettings
	connections?: ConnectionsSettings
}

// ============================================================
// CLI install types
// ============================================================

export interface CliInstallResult {
	success: boolean
	error?: string
}

// ============================================================
// Onboarding types
// ============================================================

export interface OpenCodeCheckResult {
	installed: boolean
	version: string | null
	path: string | null
	compatible: boolean
	compatibility: "ok" | "too-old" | "too-new" | "blocked" | "unknown"
	message: string | null
}

/** Supported migration source providers. */
export type MigrationProvider = "claude-code" | "cursor" | "opencode"

/** Detection result for a single provider. */
export interface ProviderDetection {
	provider: MigrationProvider
	found: boolean
	label: string
	summary: string
	mcpServerCount: number
	agentCount: number
	commandCount: number
	ruleCount: number
	skillCount: number
	projectCount: number
	hasGlobalSettings: boolean
	hasPermissions: boolean
	hasHooks: boolean
	totalSessions: number
	totalMessages: number
}

export interface MigrationCategoryPreview {
	category: string
	itemCount: number
	files: MigrationFilePreview[]
}

export interface MigrationFilePreview {
	path: string
	status: "new" | "modified" | "skipped"
	lineCount: number
	content?: string
}

export interface MigrationPreview {
	categories: MigrationCategoryPreview[]
	warnings: string[]
	manualActions: string[]
	errors: string[]
	fileCount: number
	sessionCount: number
	sessionProjectCount: number
}

export interface MigrationResult {
	success: boolean
	filesWritten: string[]
	filesSkipped: string[]
	backupDir: string | null
	warnings: string[]
	manualActions: string[]
	errors: string[]
	/** Number of history sessions that were skipped as duplicates */
	historyDuplicatesSkipped: number
}

export interface MigrationProgress {
	phase: string
	current: number
	total: number
	duplicatesSkipped: number
}

export interface AppInfo {
	version: string
	isDev: boolean
}

export type WindowChromeTier = "liquid-glass" | "vibrancy" | "opaque"

// ============================================================
// Automation types
// ============================================================

export interface AutomationSchedule {
	rrule: string
	timezone: string
}

export type PermissionPreset = "default" | "allow-all" | "read-only"

export interface ExecutionConfig {
	/** Model to use in "providerID/modelID" format (e.g. "anthropic/claude-opus-4-5"). Defaults to server default. */
	model?: string
	/** Agent name to use (e.g. "build", "research"). Defaults to server default agent. */
	agent?: string
	/** Model variant name (e.g. "extended" for extended thinking). Defaults to model default. */
	variant?: string
	effort: "low" | "medium" | "high"
	timeout: number
	retries: number
	retryDelay: number
	parallelWorkspaces: boolean
	approvalPolicy: "never" | "auto-edit"
	/** Whether to run in an isolated git worktree (default: true) */
	useWorktree: boolean
	/** Permission preset controlling agent tool access */
	permissionPreset: PermissionPreset
}

export type AutomationStatus = "active" | "paused" | "archived"

export interface Automation {
	id: string
	name: string
	prompt: string
	status: AutomationStatus
	schedule: AutomationSchedule
	workspaces: string[]
	execution: ExecutionConfig
	nextRunAt: number | null
	lastRunAt: number | null
	runCount: number
	consecutiveFailures: number
	createdAt: number
	updatedAt: number
}

export type AutomationRunStatus =
	| "queued"
	| "running"
	| "pending_review"
	| "accepted"
	| "archived"
	| "failed"

export interface AutomationRun {
	id: string
	automationId: string
	workspace: string
	status: AutomationRunStatus
	attempt: number
	sessionId: string | null
	worktreePath: string | null
	startedAt: number | null
	completedAt: number | null
	timeoutAt: number | null
	resultTitle: string | null
	resultSummary: string | null
	resultHasActionable: boolean | null
	resultBranch: string | null
	resultPrUrl: string | null
	errorMessage: string | null
	archivedReason: string | null
	archivedAssistantMessage: string | null
	readAt: number | null
	createdAt: number
	updatedAt: number
}

export interface CreateAutomationInput {
	name: string
	prompt: string
	schedule: { rrule: string; timezone?: string }
	workspaces: string[]
	execution?: Partial<ExecutionConfig>
}

export interface UpdateAutomationInput {
	id: string
	name?: string
	prompt?: string
	status?: AutomationStatus
	schedule?: { rrule: string; timezone?: string }
	workspaces?: string[]
	execution?: Partial<ExecutionConfig>
}

export interface ElfAPI {
	/** The host platform: "darwin", "win32", or "linux". */
	platform: NodeJS.Platform
	getAppInfo: () => Promise<AppInfo>

	/** Subscribe to chrome tier notification (fired once on load). */
	onChromeTier: (callback: (tier: WindowChromeTier) => void) => () => void
	/** Get the current chrome tier (pull-based, avoids race with push event). */
	getChromeTier: () => Promise<WindowChromeTier>

	ensureOpenCode: () => Promise<OpenCodeServerInfo>
	getServerUrl: () => Promise<string | null>
	stopOpenCode: () => Promise<boolean>
	restartOpenCode: () => Promise<OpenCodeServerInfo>
	getActiveOpenCodeSessions: () => Promise<ActiveOpenCodeSessionsSnapshot>
	browserLanes: {
		list: () => Promise<BrowserLane[]>
		createRemote: (input: CreateRemoteBrowserLaneInput) => Promise<BrowserLane>
		ensure: (laneId: string) => Promise<BrowserLane>
		start: (laneId: string) => Promise<BrowserLane>
		stop: (laneId: string) => Promise<BrowserLane>
		restart: (laneId: string) => Promise<BrowserLane>
		resetProfile: (laneId: string) => Promise<BrowserLane>
		health: (laneId: string) => Promise<BrowserLaneHealth>
		navigate: (laneId: string, url: string) => Promise<BrowserLaneTabActionResult>
		listTabs: (laneId: string) => Promise<BrowserLaneTabsState>
		createTab: (
			laneId: string,
			input?: CreateBrowserLaneTabInput,
		) => Promise<BrowserLaneTabActionResult>
		activateTab: (laneId: string, tabId: string) => Promise<BrowserLaneTabActionResult>
		closeTab: (laneId: string, tabId: string) => Promise<BrowserLaneTabActionResult>
		navigateTab: (
			laneId: string,
			tabId: string,
			input: NavigateBrowserLaneTabInput,
		) => Promise<BrowserLaneTabActionResult>
	}
	palot: {
		getBrowserStateSnapshot: (sessionId: string) => Promise<BrowserStateSnapshot>
		publishBrowserAction: (input: { event: BrowserActionEvent }) => Promise<BrowserActionEvent>
		getBinding: (sessionId: string) => Promise<SessionBinding | null>
		setBinding: (binding: SessionBinding) => Promise<SessionBinding>
		releaseBinding: (sessionId: string) => Promise<SessionBinding | null>
		getUiStateSnapshot: () => Promise<PalotUiStateSnapshot>
		openSidePanel: (tab: SidePanelTabId) => Promise<PalotUiStateSnapshot>
		onOpenSidePanel: (callback: (payload: { tab: SidePanelTabId }) => void) => () => void
		onBrowserActions: (callback: (event: BrowserActionEvent) => void) => () => void
	}
	onActiveOpenCodeSessionsChanged: (
		callback: (snapshot: ActiveOpenCodeSessionsSnapshot) => void,
	) => () => void
	getModelState: () => Promise<ModelState>
	updateModelRecent: (model: ModelRef) => Promise<ModelState>

	// Credential storage (safeStorage-backed, passwords never leave main process in plain text)
	credential: {
		/** Store an encrypted password for a server. */
		store: (serverId: string, password: string) => Promise<void>
		/** Retrieve a decrypted password for a server (only returns to renderer for auth headers). */
		get: (serverId: string) => Promise<string | null>
		/** Delete a stored password. */
		delete: (serverId: string) => Promise<void>
	}

	/** Test connectivity to a remote OpenCode server. Returns null on success or an error message. */
	testServerConnection: (
		url: string,
		username?: string,
		password?: string,
	) => Promise<string | null>

	// mDNS discovery
	mdns: {
		/** Get the current list of discovered servers. */
		getDiscovered: () => Promise<DiscoveredMdnsServer[]>
		/** Subscribe to discovered server list changes. Returns an unsubscribe function. */
		onChanged: (callback: (servers: DiscoveredMdnsServer[]) => void) => () => void
	}

	// Auto-updater
	getUpdateState: () => Promise<UpdateState>
	checkForUpdates: () => Promise<void>
	downloadUpdate: () => Promise<void>
	installUpdate: () => Promise<void>
	/** Opens the GitHub release page for the current update version (fallback for unsigned macOS). */
	openReleasePage: () => Promise<void>
	onUpdateStateChanged: (callback: (state: UpdateState) => void) => () => void

	// Git operations
	git: {
		listBranches: (directory: string) => Promise<GitBranchInfo>
		getStatus: (directory: string) => Promise<GitStatusInfo>
		checkout: (directory: string, branch: string) => Promise<GitCheckoutResult>
		stashAndCheckout: (directory: string, branch: string) => Promise<GitStashResult>
		stashPop: (directory: string) => Promise<GitStashResult>
		getRoot: (directory: string) => Promise<string | null>
		diffStat: (directory: string) => Promise<GitDiffStat>
		commitAll: (directory: string, message: string) => Promise<GitCommitResult>
		push: (directory: string, remote?: string) => Promise<GitPushResult>
		createBranch: (directory: string, branchName: string) => Promise<GitCheckoutResult>
		applyToLocal: (worktreeDir: string, localDir: string) => Promise<GitApplyResult>
		applyDiffText: (localDir: string, diffText: string) => Promise<GitApplyResult>
		getRemoteUrl: (directory: string, remote?: string) => Promise<string | null>
	}

	// Window preferences (opaque windows / transparency)
	/** Get the persisted opaque windows preference from the main process. */
	getOpaqueWindows: () => Promise<boolean>
	/** Set the opaque windows preference and persist it in the main process. */
	setOpaqueWindows: (value: boolean) => Promise<{ success: boolean }>
	/** Relaunch the app (used after toggling transparency). */
	relaunch: () => Promise<void>

	// CLI install
	cli: {
		isInstalled: () => Promise<boolean>
		install: () => Promise<CliInstallResult>
		uninstall: () => Promise<CliInstallResult>
	}

	// Open in external app
	openIn: {
		getTargets: () => Promise<OpenInTargetsResult>
		open: (directory: string, targetId: string, persistPreferred?: boolean) => Promise<void>
		setPreferred: (targetId: string) => Promise<{ success: boolean }>
	}
	openExternal: (url: string) => Promise<void>
	clipboard: {
		readText: () => Promise<string>
		writeText: (text: string) => Promise<void>
	}

	// Native theme (syncs macOS glass tint to app color scheme)
	/** Set the native theme source ("light" | "dark" | "system") to control macOS glass tint. */
	setNativeTheme: (source: string) => Promise<void>

	// System accent color
	/** Get the system accent color as an 8-char hex RRGGBBAA string, or null if unavailable. */
	getAccentColor: () => Promise<string | null>
	/** Subscribe to system accent color changes. Returns an unsubscribe function. */
	onAccentColorChanged: (callback: (color: string) => void) => () => void

	// Directory picker
	pickDirectory: () => Promise<string | null>
	listDirectory: (directory: string) => Promise<FileSystemEntry[]>
	readDirectoryTree: (directory: string) => Promise<FileSystemEntry[]>
	gitStatus: (directory: string) => Promise<FileGitStatusResult>
	gitPulse: (directories: string[]) => Promise<RepoPulse[]>
	homeDir: () => Promise<string>
	detectProject: (filePath: string) => Promise<ProjectRun>
	listProjects: (rootDirectory?: string) => Promise<ProjectInfo[]>
	readFile: (filePath: string) => Promise<{ path: string; content: string }>
	readFilePreview: (filePath: string) => Promise<FilePreview>
	readTextFile: (filePath: string) => Promise<string>
	writeTextFile: (filePath: string, content: string) => Promise<void>
	deletePath: (filePath: string) => Promise<void>
	saveImageTemp: (data: string, extension: string) => Promise<string>
	convertOfficeToPdf: (filePath: string) => Promise<OfficeConversionResult>
	oracles: {
		list: () => Promise<OracleInfo[]>
		listTmuxSessions: () => Promise<TmuxSessionInfo[]>
		create: (identity: string, command?: string | null) => Promise<string>
		rename: (from: string, to: string) => Promise<string>
		delete: (identity: string, force?: boolean) => Promise<void>
		killTmuxSession: (socket: string, session: string) => Promise<void>
		appshot: (identity?: string | null) => Promise<string>
	}
	bridges: {
		list: () => Promise<BridgesResult>
		activity: (id: string, limit?: number) => Promise<BridgeActivityResult>
	}
	crm: {
		load: () => Promise<CrmStore>
		saveContact: (contact: Partial<CrmContact>) => Promise<string>
		deleteContact: (id: string) => Promise<void>
	}
	inbox: {
		listCustomers: () => Promise<Customer[]>
		customerThread: (handle: string, limit?: number) => Promise<InboxMessage[]>
		sendMessage: (channel: InboxChannel, to: string, text: string) => Promise<InboxSendResult>
	}
	pty: {
		spawnShell: (request: PtySpawnRequest) => Promise<number>
		spawnTerminal: (request: PtyTerminalSpawnRequest) => Promise<number>
		spawnOracle: (request: PtyOracleSpawnRequest) => Promise<number>
		spawnTmux: (request: PtyTmuxSpawnRequest) => Promise<number>
		write: (id: number, data: string) => Promise<void>
		resize: (id: number, cols: number, rows: number) => Promise<void>
		kill: (id: number) => Promise<void>
		onData: (callback: (event: PtyDataEvent) => void) => () => void
		onExit: (callback: (event: PtyExitEvent) => void) => () => void
	}
	// Fetch proxy (bypasses Chromium connection limits)
	fetch: (req: {
		url: string
		method: string
		headers: Record<string, string>
		body: string | null
	}) => Promise<{
		status: number
		statusText: string
		headers: Record<string, string>
		body: string | null
	}>

	// Notifications
	/** Subscribe to navigation events from native OS notification clicks. */
	onNotificationNavigate: (callback: (data: { sessionId: string }) => void) => () => void
	/** Dismiss any active notification for a session. */
	dismissNotification: (sessionId: string) => Promise<void>
	/** Update the dock badge / app badge count. */
	updateBadgeCount: (count: number) => Promise<void>

	// Settings
	/** Get the full app settings object. */
	getSettings: () => Promise<AppSettings>
	/** Update settings with a partial object (deep-merged). Returns the updated settings. */
	updateSettings: (partial: Record<string, unknown>) => Promise<AppSettings>
	/** V2 plugin authority — list/describe/state per V2 manifest. */
	plugins: {
		list: () => Promise<{
			appVersion: string
			plugins: Array<{
				pluginId: string
				displayName: string
				version: string
				trust: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
				status: "validated" | "installed" | "disabled" | "active" | "degraded" | "quarantined"
				manifestRevision: number
				appVersion: string
				requiredCapabilities: string[]
				defaultGrantedCapabilities: string[]
			}>
			summaries: Array<{
				pluginId: string
				panelCount: number
				widgetCount: number
				commandCount: number
				themeCount: number
				toolCount: number
			}>
		}>
		describe: (pluginId: string) => Promise<{
			entry: {
				pluginId: string
				displayName: string
				version: string
				trust: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
				status: "validated" | "installed" | "disabled" | "active" | "degraded" | "quarantined"
				manifestRevision: number
				appVersion: string
				requiredCapabilities: string[]
				defaultGrantedCapabilities: string[]
			} | null
			projection: {
				pluginId: string
				panelCount: number
				widgetCount: number
				commandCount: number
				themeCount: number
				toolCount: number
			} | null
			decision: {
				pluginId: string
				token: string
				granted: boolean
				reason: string
				reasonCode: string
				risk: "low" | "medium" | "high" | "critical"
				knownToHost: boolean
				grantedTokens: string[]
			}
		}>
		capabilities: (pluginId: string) => Promise<{
			state: {
				trust: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
				sessionScope: "session" | "project" | "app"
				grantedTokens: string[]
				loading?: boolean
				pluginDisabled?: boolean
				pluginQuarantined?: boolean
				pluginError?: { code: string; message: string } | null
			}
			decision: {
				pluginId: string
				token: string
				granted: boolean
				reason: string
				reasonCode: string
				risk: "low" | "medium" | "high" | "critical"
				knownToHost: boolean
				grantedTokens: string[]
			}
		}>
		panels: () => Promise<{
			appVersion: string
			items: Array<{
				pluginId: string
				contributionId: string
				projectedId: string
				title: string
				icon: string | null
				formFactor: "side-panel-tab" | "main-pane"
				hostSlot: "side-panel" | "main-pane"
				hostTarget: { kind: "side-panel" | "main-pane"; slot: "side-panel" | "main-pane" }
				defaultOn: boolean
				commandIds: string[]
				persistenceKey: string | null
				telemetryNamespace: string | null
				renderMode: "host-reconciler" | "declarative-props" | "iframe"
				declarativeSchemaRef: string | null
				iframeSandbox: string | null
				capabilityGates: Array<{
					token: string
					knownToHost: boolean
					granted: boolean
					risk: "low" | "medium" | "high" | "critical" | null
					source: "plugin" | "contribution"
					reason: string
				}>
				availability: {
					available: boolean
					state: "ready" | "loading" | "disabled" | "quarantined" | "error"
					reason: {
						code:
							| "available"
							| "loading"
							| "plugin-disabled"
							| "plugin-quarantined"
							| "plugin-error"
							| "plugin-capability-missing"
							| "contribution-capability-missing"
							| "reserved-command-prefix"
							| "host-capability-unknown"
						message: string
						hostCapabilityState: {
							trust: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
							sessionScope: "session" | "project" | "app"
							grantedTokens: string[]
							loading?: boolean
							pluginDisabled?: boolean
							pluginQuarantined?: boolean
							pluginError?: { code: string; message: string } | null
						}
						missingCapabilities: Array<{
							token: string
							knownToHost: boolean
							granted: boolean
							risk: "low" | "medium" | "high" | "critical" | null
							source: "plugin" | "contribution"
							reason: string
						}>
					} | null
				}
			}>
		}>
		widgets: () => Promise<{ appVersion: string; items: unknown[] }>
		commands: () => Promise<{ appVersion: string; items: unknown[] }>
		themes: () => Promise<{ appVersion: string; items: unknown[] }>
		tools: (pluginId?: string) => Promise<{
			appVersion: string
			tools: Array<{
				pluginId: string
				id: string
				title: string
				description: string
				scope: "session" | "project" | "app"
				requires: string[]
				timeoutMs: number
				preview: boolean
			}>
		}>
		refresh: () => Promise<{ appVersion: string; pluginCount: number }>
		invokeTool: (input: {
			pluginId: string
			toolId: string
			args: Record<string, unknown>
			sessionId?: string
		}) => Promise<{
			status: "completed" | "failed" | "denied" | "unavailable" | "queued" | "cancelled"
			pluginId: string
			commandId: string
			errorCode?: string
			errorMessage?: string
			data?: unknown
		}>
		setEnabled: (
			pluginId: string,
			enabled: boolean,
		) => Promise<{
			pluginId: string
			enabled: boolean
			quarantined: boolean
			quarantineDetail: string | null
			uiCrashCount: number
		}>
		reportPanelCrash: (
			pluginId: string,
			message: string,
		) => Promise<{
			pluginId: string
			enabled: boolean
			quarantined: boolean
			quarantineDetail: string | null
			uiCrashCount: number
		}>
		releaseQuarantine: (
			pluginId: string,
			note: string,
		) => Promise<{
			pluginId: string
			enabled: boolean
			quarantined: boolean
			quarantineDetail: string | null
			uiCrashCount: number
		}>
		invoke: (input: {
			pluginId: string
			commandId: string
			args: Record<string, unknown>
		}) => Promise<{
			status: "completed" | "failed" | "denied" | "unavailable" | "queued" | "cancelled"
			pluginId: string
			commandId: string
			errorCode?: string
			errorMessage?: string
			data?: unknown
		}>
		onChanged: (callback: (payload: { appVersion: string; pluginCount: number }) => void) => () => void
	}
	mcpConnections: {
		upsertConfig: (input: McpConnectionConfigMutationInput) => Promise<AppSettings>
		removeConfig: (name: string) => Promise<AppSettings>
		browseCatalog: (input: McpCatalogBrowseInput) => Promise<Record<string, unknown>>
		searchCatalog: (input: McpCatalogSearchInput) => Promise<Record<string, unknown>>
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
		}) => Promise<{ ok: true }>
		login: (name: string) => Promise<{ ok: true }>
		test: (name: string) => Promise<{ ok: boolean; output: string }>
		listRecords: () => Promise<McpConnectionRecordSnapshot[]>
	}
	/** Subscribe to settings changes pushed from the main process. */
	onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void

	// Onboarding
	// Automations
	automation: {
		list: () => Promise<Automation[]>
		get: (id: string) => Promise<Automation | null>
		create: (input: CreateAutomationInput) => Promise<Automation>
		update: (input: UpdateAutomationInput) => Promise<Automation | null>
		delete: (id: string) => Promise<boolean>
		runNow: (id: string) => Promise<boolean>
		listRuns: (automationId?: string) => Promise<AutomationRun[]>
		archiveRun: (runId: string) => Promise<boolean>
		acceptRun: (runId: string) => Promise<boolean>
		markRunRead: (runId: string) => Promise<boolean>
		previewSchedule: (rrule: string, timezone: string) => Promise<string[]>
	}
	/** Subscribe to automation run state changes. */
	onAutomationRunsUpdated: (callback: () => void) => () => void

	onboarding: {
		checkOpenCode: () => Promise<OpenCodeCheckResult>
		installOpenCode: () => Promise<{ success: boolean; error?: string }>
		onInstallOutput: (callback: (text: string) => void) => () => void
		/** Quick-detect all supported providers (Claude Code, Cursor, OpenCode). */
		detectProviders: () => Promise<ProviderDetection[]>
		/** Full scan of a specific provider's configuration. */
		scanProvider: (
			provider: MigrationProvider,
		) => Promise<{ detection: ProviderDetection; scanResult: unknown }>
		/** Dry-run migration preview for a provider. */
		previewMigration: (
			provider: MigrationProvider,
			scanResult: unknown,
			categories: string[],
		) => Promise<MigrationPreview>
		/** Execute migration (writes files with backup). */
		executeMigration: (
			provider: MigrationProvider,
			scanResult: unknown,
			categories: string[],
		) => Promise<MigrationResult>
		/** Subscribe to migration progress updates (history writing). */
		onMigrationProgress: (callback: (progress: MigrationProgress) => void) => () => void
		/** Restore the most recent migration backup. */
restoreBackup: () => Promise<{
			success: boolean
			restored: string[]
			removed: string[]
			errors: string[]
		}>
	}

	auth: ElfAuthApi
	cloud: FireflyCloudApi
}

declare global {
	interface Window {
		elf: ElfAPI
	}
}
