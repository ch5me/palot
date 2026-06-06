import type { OpenCodeMcpLocal, OpenCodeMcpRemote } from "@ch5me/elf-configconv"

export type McpConnectionSource = "registry" | "curated" | "imported" | "manual"

export type McpConnectionTransport = "remote-http" | "remote-sse" | "local-stdio"

export type McpConnectionOwnershipMode = "local-only" | "cloud-only" | "handoff-derived"

export type McpConnectionCanonicalStore = "local" | "gateway"

export type McpConnectionInstallState = "not_installed" | "installing" | "installed"

export type McpConnectionAuthState =
	| "unknown"
	| "not_required"
	| "needs_auth"
	| "authenticated"
	| "expired"
	| "failed"

export type McpConnectionRuntimeState =
	| "not_projected"
	| "projected"
	| "active"
	| "degraded"
	| "offline"

export type McpConnectionTestState = "untested" | "passing" | "failing"

export type McpConnectionStatus =
	| "connected"
	| "needs_auth"
	| "missing_env"
	| "degraded"
	| "offline"
	| "testing"
	| "installing"
	| "configured"

export type McpConnectionAuthComplexity =
	| "one_click"
	| "oauth"
	| "device_code"
	| "env_manual"
	| "local_command"

export type McpConnectionWriteRisk = "read_only" | "mixed" | "write_heavy"

export type McpConnectionRestorePolicy =
	| "none"
	| "reproject_on_boot"
	| "reproject_and_reauth_if_needed"

export type McpCredentialMode = "local-desktop" | "cloud-disposable" | "hybrid-handoff"

export type McpCallbackOwnership = "desktop-loopback" | "gateway-proxy" | "device-code" | "manual"

export type McpTokenSyncPolicy = "forbidden" | "one_shot_handoff_only"

export type McpTokenStorageSurface =
	| "electron-safe-storage"
	| "mcporter-home-vault"
	| "gateway-durable-vault"

export type McpCredentialRecoveryPolicy =
	| "local-only"
	| "cloud-restore"
	| "reauth-required"

export type McpToolMutability = "read" | "write" | "destructive"

export type McpToolApprovalMode = "none" | "required"

export type McpControlPlaneResponsibility =
	| "register"
	| "list"
	| "get"
	| "login"
	| "logout"
	| "test"
	| "call"
	| "status"

export type McpRuntimeExecutionChannel = "in_process" | "daemon" | "cli"

export type McpRuntimeExecutionPreference = "preferred" | "fallback"

export type McpControlPlaneMutability = "read" | "write" | "destructive"

export type McpControlPlaneApprovalMode = "none" | "required" | "required_if_mutating"

export type McpRuntimeMetaToolName = "mcp.search" | "mcp.describe" | "mcp.call" | "mcp.status"

export interface McpRuntimeExecutionPathDescriptor {
	channel: McpRuntimeExecutionChannel
	preference: McpRuntimeExecutionPreference
	description: string
}

export type McpCatalogFreshness = "fresh" | "stale" | "offline_cache"

export interface McpCatalogPageCursor {
	value: string
	source: "registry" | "cache"
}

export interface McpCatalogRegistryEntry {
	id: string
	name: string
	description?: string
	transport: McpConnectionTransport
	authComplexity: McpConnectionAuthComplexity
	upstreamUrl?: string
	docsUrl?: string
	tags: string[]
	toolCount?: number
	readToolCount?: number
	writeToolCount?: number
	registryVersion?: string
	raw: Record<string, unknown>
}

export interface McpCatalogCachePolicy {
	apiBaseUrl: string
	refreshTtlMs: number
	staleTtlMs: number
	negativeTtlMs: number
	strategy: "cursor_page_cache"
	fallbackMode: "serve_stale_on_fetch_failure"
}

export interface McpCatalogBackendServiceContract {
	serviceOwner: "main_process"
	rendererAccess: "typed_backend_helper"
	transport: "electron_ipc_or_http_proxy"
	queryKeyPrefix: "mcp-catalog"
	fetchLocation: "never_renderer_direct"
	browseMethod: "browseCatalog"
	searchMethod: "searchCatalog"
}

export interface McpCatalogCacheEnvelope {
	queryKey: string
	storedAt: string
	freshness: McpCatalogFreshness
	expiresAt: string
	staleAt: string
	cursor?: McpCatalogPageCursor | null
}

export interface McpCatalogPage {
	entries: McpCatalogRegistryEntry[]
	nextCursor?: McpCatalogPageCursor | null
	freshness: McpCatalogFreshness
	cache: McpCatalogCacheEnvelope
}

export interface McpCatalogSearchResult {
	query: string
	entries: McpCatalogRegistryEntry[]
	freshness: McpCatalogFreshness
	cache: McpCatalogCacheEnvelope
}

export interface McpCatalogBrowseQuery {
	cursor?: McpCatalogPageCursor | null
	limit: number
}

export interface McpCatalogSearchQuery {
	query: string
	limit: number
}

export interface McpCatalogServiceResult<T> {
	data: T
	joined: McpCatalogJoinedEntry[]
}

export interface McpCuratedMetadata {
	serverId: string
	rank: number
	category: string
	whyRecommended: string
	authComplexity: McpConnectionAuthComplexity
	requiresGateway: boolean
	readToolHint?: string
	writeRisk: McpConnectionWriteRisk
	iconRef?: string
	docsUrl?: string
	manualOnly: boolean
	tags: string[]
	registryBacked: boolean
	sourceLabel: "registry" | "curated/manual"
}

export interface McpRecommendationPolicyEntry {
	serverId: string
	displayName: string
	category: string
	rationale: string
	tags: string[]
	authComplexity: McpConnectionAuthComplexity
	writeRisk: McpConnectionWriteRisk
	registryBacked: boolean
	sourceLabel: "registry" | "curated/manual"
}

export interface McpCatalogJoinedEntry {
	registry: McpCatalogRegistryEntry
	curated?: McpCuratedMetadata | null
	sourceOrder: "registry_first"
}

export interface McpCatalogServiceContract {
	backend: McpCatalogBackendServiceContract
	browseQuery: McpCatalogBrowseQuery
	searchQuery: McpCatalogSearchQuery
	browseResult: McpCatalogServiceResult<McpCatalogPage>
	searchResult: McpCatalogServiceResult<McpCatalogSearchResult>
}

export interface McpConfigMutationSeamProof {
	sdkSupportsMutation: false
	readSurface: "client.config.get"
	writeSurface: "main_process_managed_config_writer"
	runtimeRefresh: "client.global.dispose"
	rationale: string
}

export interface McporterAdapterContract {
	configAddCommand: "mcporter config add"
	configLoginCommand: "mcporter config login"
	authCommand: "mcporter auth"
	logoutCommand: "mcporter config logout"
	vaultSeedCommand: "mcporter vault set"
	testCommand: "mcporter list --status"
	transportScopes: Array<"project" | "home" | "ad_hoc_stdio">
	unsafeTokenImportPolicy: "gated"
}

export type McpNavigationSurface = "settings_connections" | "plugins_posture" | "session_runtime"

export interface McpNavigationPlacement {
	route: "/settings/connections"
	tabId: "connections"
	primarySurface: "settings_connections"
	secondarySurfaces: Array<"plugins_posture" | "session_runtime">
	pluginsPanelRole: "read_only_posture"
}

export interface McpConnectionProvenance {
	source: McpConnectionSource
	importedFrom?: string
	curated: boolean
	manualReason?: string
	registryVersion?: string
	editMode?: "copy_on_write" | "read_only" | "managed_in_place"
}

export interface McpCredentialArchitecture {
	mode: McpCredentialMode
	callbackOwnership: McpCallbackOwnership
	tokenStorageSurface: McpTokenStorageSurface
	recoveryPolicy: McpCredentialRecoveryPolicy
	tokenSyncPolicy: McpTokenSyncPolicy
	forbiddenSyncPatterns: string[]
	allowedHandoffDirections: Array<"local_to_cloud" | "cloud_to_local">
	hushTargets: Array<"runtime-dev" | "runtime-staging" | "runtime-production" | "none">
	gatewayPersistence: "required" | "not_required"
}

export interface McpConnectionRecord {
	id: string
	serverId: string
	source: McpConnectionSource
	transport: McpConnectionTransport
	ownershipMode: McpConnectionOwnershipMode
	canonicalStore: McpConnectionCanonicalStore
	credentialMode: McpCredentialMode
	installState: McpConnectionInstallState
	authState: McpConnectionAuthState
	runtimeState: McpConnectionRuntimeState
	testState: McpConnectionTestState
	status: McpConnectionStatus
	provenance: McpConnectionProvenance
	restorePolicy: McpConnectionRestorePolicy
	credentialArchitecture?: McpCredentialArchitecture | null
	lastTestAt?: string | null
	lastError?: string | null
	lastHealthyAt?: string | null
	registryEntry?: McpCatalogRegistryEntry | null
	curatedMetadata?: McpCuratedMetadata | null
	projectedOpenCode?: OpenCodeMcpLocal | OpenCodeMcpRemote | null
	metadata: Record<string, unknown>
}

export interface McpProjectionTarget {
	openCode: OpenCodeMcpLocal | OpenCodeMcpRemote | null
	mcporter: {
		serverId: string
		transport: McpConnectionTransport
		ownershipMode: McpConnectionOwnershipMode
		canonicalStore: McpConnectionCanonicalStore
	}
}

export interface McpToolDescriptor {
	serverId: string
	toolName: string
	description?: string
	mutability: McpToolMutability
	approval: McpToolApprovalMode
	inputSchema?: Record<string, unknown>
	outputSchema?: Record<string, unknown>
	tags: string[]
}

export interface McpControlPlaneOperationDescriptor {
	responsibility: McpControlPlaneResponsibility
	owner: "mcporter_control_plane" | "opencode_runtime_projection"
	mutability: McpControlPlaneMutability
	approval: McpControlPlaneApprovalMode
	preferredPath: McpRuntimeExecutionPathDescriptor
	fallbackPath?: McpRuntimeExecutionPathDescriptor
	writesCanonicalStore: boolean
	writesRuntimeProjection: boolean
}

export interface McpControlPlaneRegisterInput {
	serverId: string
	transport: McpConnectionTransport
	ownershipMode: McpConnectionOwnershipMode
	canonicalStore: McpConnectionCanonicalStore
	source: McpConnectionSource
	projectedOpenCode?: OpenCodeMcpLocal | OpenCodeMcpRemote | null
	metadata?: Record<string, unknown>
}

export interface McpControlPlaneRegisterResult {
	record: McpConnectionRecord
	projection: McpProjectionTarget
}

export interface McpControlPlaneListQuery {
	canonicalStore?: McpConnectionCanonicalStore
	ownershipMode?: McpConnectionOwnershipMode
	status?: McpConnectionStatus
	includeProjected?: boolean
}

export interface McpControlPlaneGetQuery {
	id?: string
	serverId?: string
}

export interface McpControlPlaneAuthCommand {
	serverId: string
	ownershipMode?: McpConnectionOwnershipMode
	reason?: string
}

export interface McpControlPlaneTestCommand {
	serverId: string
	toolName?: string
	arguments?: Record<string, unknown>
}

export interface McpControlPlaneCallCommand {
	serverId: string
	toolName: string
	arguments?: Record<string, unknown>
	approvalMode?: McpToolApprovalMode
}

export interface McpControlPlaneStatusQuery {
	serverId: string
	includeTooling?: boolean
}

export interface McpControlPlaneStatusResult {
	record: McpConnectionRecord
	projection: McpProjectionTarget
	availableTools?: McpToolDescriptor[]
}

export type McpConnectionAction =
	| "retry_auth"
	| "open_env_setup"
	| "reconnect_runtime"
	| "reprobe"
	| "review_permissions"
	| "none"

export interface McpNormalizedConnectionStatus {
	status: McpConnectionStatus
	label: string
	description: string
	action: McpConnectionAction
	requiresAttention: boolean
}

export interface McpControlPlaneContract {
	register: McpControlPlaneOperationDescriptor
	list: McpControlPlaneOperationDescriptor
	get: McpControlPlaneOperationDescriptor
	login: McpControlPlaneOperationDescriptor
	logout: McpControlPlaneOperationDescriptor
	test: McpControlPlaneOperationDescriptor
	call: McpControlPlaneOperationDescriptor
	status: McpControlPlaneOperationDescriptor
}

export interface McpRuntimeMetaToolDescriptor {
	name: McpRuntimeMetaToolName
	optional: boolean
	purpose: string
	mutability: McpToolMutability
	approval: McpToolApprovalMode
	preferredPath: McpRuntimeExecutionPathDescriptor
	fallbackPath?: McpRuntimeExecutionPathDescriptor
}

export interface McpRuntimeSearchRequest {
	query: string
	serverIds?: string[]
	limit?: number
	includeOffline?: boolean
}

export interface McpRuntimeSearchResultItem {
	serverId: string
	toolName: string
	description?: string
	mutability: McpToolMutability
	approval: McpToolApprovalMode
	tags: string[]
}

export interface McpRuntimeDescribeRequest {
	serverId: string
	toolName: string
}

export interface McpRuntimeDescribeResult {
	tool: McpToolDescriptor
	preferredPath: McpRuntimeExecutionPathDescriptor
	fallbackPath?: McpRuntimeExecutionPathDescriptor
}

export interface McpRuntimeCallRequest {
	serverId: string
	toolName: string
	arguments?: Record<string, unknown>
}

export interface McpRuntimeStatusRequest {
	serverIds?: string[]
}

export interface McpRuntimeToolContract {
	search: McpRuntimeMetaToolDescriptor
	describe: McpRuntimeMetaToolDescriptor
	call: McpRuntimeMetaToolDescriptor
	status?: McpRuntimeMetaToolDescriptor
}

export const MCP_CONTROL_PLANE_CONTRACT: McpControlPlaneContract = {
	register: {
		responsibility: "register",
		owner: "mcporter_control_plane",
		mutability: "write",
		approval: "required",
		preferredPath: {
			channel: "daemon",
			preference: "preferred",
			description: "Long-lived MCPorter daemon registers canonical connector state and projects runtime config.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "MCPorter CLI performs one-shot registration when daemon path unavailable.",
		},
		writesCanonicalStore: true,
		writesRuntimeProjection: true,
	},
	list: {
		responsibility: "list",
		owner: "mcporter_control_plane",
		mutability: "read",
		approval: "none",
		preferredPath: {
			channel: "daemon",
			preference: "preferred",
			description: "Daemon returns canonical connection inventory with cached status.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI snapshots canonical inventory for bounded reads.",
		},
		writesCanonicalStore: false,
		writesRuntimeProjection: false,
	},
	get: {
		responsibility: "get",
		owner: "mcporter_control_plane",
		mutability: "read",
		approval: "none",
		preferredPath: {
			channel: "daemon",
			preference: "preferred",
			description: "Daemon resolves one connection plus projection metadata without boot-wide schema hydration.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI reads one connection contract when daemon path unavailable.",
		},
		writesCanonicalStore: false,
		writesRuntimeProjection: false,
	},
	login: {
		responsibility: "login",
		owner: "mcporter_control_plane",
		mutability: "write",
		approval: "required",
		preferredPath: {
			channel: "daemon",
			preference: "preferred",
			description: "Daemon owns auth handshake, token durability, and canonical auth state updates.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI drives OAuth or manual auth flow when daemon orchestration unavailable.",
		},
		writesCanonicalStore: true,
		writesRuntimeProjection: false,
	},
	logout: {
		responsibility: "logout",
		owner: "mcporter_control_plane",
		mutability: "destructive",
		approval: "required",
		preferredPath: {
			channel: "daemon",
			preference: "preferred",
			description: "Daemon revokes local auth material and updates canonical posture.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI clears auth material when daemon path unavailable.",
		},
		writesCanonicalStore: true,
		writesRuntimeProjection: false,
	},
	test: {
		responsibility: "test",
		owner: "mcporter_control_plane",
		mutability: "read",
		approval: "none",
		preferredPath: {
			channel: "in_process",
			preference: "preferred",
			description: "Renderer or main-process runtime probes health through compact MCPorter test surface.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI performs bounded health probe when runtime test surface unavailable.",
		},
		writesCanonicalStore: false,
		writesRuntimeProjection: false,
	},
	call: {
		responsibility: "call",
		owner: "opencode_runtime_projection",
		mutability: "write",
		approval: "required_if_mutating",
		preferredPath: {
			channel: "in_process",
			preference: "preferred",
			description: "Projected OpenCode runtime executes selected tool call through compact wrapper path.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI call path remains bounded fallback, not default runtime contract.",
		},
		writesCanonicalStore: false,
		writesRuntimeProjection: false,
	},
	status: {
		responsibility: "status",
		owner: "mcporter_control_plane",
		mutability: "read",
		approval: "none",
		preferredPath: {
			channel: "daemon",
			preference: "preferred",
			description: "Daemon aggregates canonical, auth, and runtime posture for status reads.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI returns point-in-time status snapshot when daemon path unavailable.",
		},
		writesCanonicalStore: false,
		writesRuntimeProjection: false,
	},
}

export const MCP_RUNTIME_META_TOOL_CONTRACT: McpRuntimeToolContract = {
	search: {
		name: "mcp.search",
		optional: false,
		purpose: "Search compact tool catalog across connected MCP servers without hydrating full schemas.",
		mutability: "read",
		approval: "none",
		preferredPath: {
			channel: "in_process",
			preference: "preferred",
			description: "In-process runtime searches cached tool summaries only.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI search path for bounded catalog lookups.",
		},
	},
	describe: {
		name: "mcp.describe",
		optional: false,
		purpose: "Hydrate one tool contract on demand, including mutability and approval metadata.",
		mutability: "read",
		approval: "none",
		preferredPath: {
			channel: "in_process",
			preference: "preferred",
			description: "In-process runtime resolves one tool descriptor lazily.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI describe path for single-tool introspection.",
		},
	},
	call: {
		name: "mcp.call",
		optional: false,
		purpose: "Execute one selected MCP tool through runtime projection instead of full schema injection.",
		mutability: "write",
		approval: "required",
		preferredPath: {
			channel: "in_process",
			preference: "preferred",
			description: "In-process runtime executes selected tool with approval-aware guardrails.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI call path for environments without long-lived runtime surface.",
		},
	},
	status: {
		name: "mcp.status",
		optional: true,
		purpose: "Return compact readiness and auth posture for selected connections when caller needs runtime status.",
		mutability: "read",
		approval: "none",
		preferredPath: {
			channel: "daemon",
			preference: "preferred",
			description: "Daemon status read avoids broad runtime hydration.",
		},
		fallbackPath: {
			channel: "cli",
			preference: "fallback",
			description: "CLI status snapshot when daemon path unavailable.",
		},
	},
}

export function deriveMcpConnectionStatus(record: Pick<
	McpConnectionRecord,
	"installState" | "authState" | "runtimeState" | "testState" | "metadata"
>): McpConnectionStatus {
	if (record.installState === "installing") return "installing"
	if (record.runtimeState === "offline") return "offline"
	if (record.metadata.missingEnv === true) return "missing_env"
	if (record.authState === "needs_auth" || record.authState === "expired") return "needs_auth"
	if (record.runtimeState === "degraded") return "degraded"
	if (record.testState === "failing") return "testing"
	if (record.runtimeState === "active" && record.authState === "authenticated") return "connected"
	return "configured"
}

export function normalizeMcpConnectionStatus(record: Pick<
	McpConnectionRecord,
	"installState" | "authState" | "runtimeState" | "testState" | "metadata"
>): McpNormalizedConnectionStatus {
	const status = deriveMcpConnectionStatus(record)
	switch (status) {
		case "missing_env":
			return {
				status,
				label: "Missing environment",
				description: "Required local environment or config is missing before auth/runtime can succeed.",
				action: "open_env_setup",
				requiresAttention: true,
			}
		case "needs_auth":
			return {
				status,
				label: "Needs auth",
				description: "Connection is known but requires auth or token refresh before use.",
				action: "retry_auth",
				requiresAttention: true,
			}
		case "offline":
			return {
				status,
				label: "Offline",
				description: "Projected runtime cannot be reached at all.",
				action: "reconnect_runtime",
				requiresAttention: true,
			}
		case "degraded":
			return {
				status,
				label: "Degraded",
				description: "Runtime exists, but health or test probe is failing non-fatally.",
				action: "reprobe",
				requiresAttention: true,
			}
		case "testing":
			return {
				status,
				label: "Testing failed",
				description: "Safe probe did not succeed; inspect diagnostic evidence before promotion to active.",
				action: "reprobe",
				requiresAttention: true,
			}
		case "installing":
			return {
				status,
				label: "Installing",
				description: "Connection is being registered or projected.",
				action: "none",
				requiresAttention: false,
			}
		case "connected":
			return {
				status,
				label: "Connected",
				description: "Auth and runtime are healthy enough for active use.",
				action: "none",
				requiresAttention: false,
			}
		default:
			return {
				status,
				label: "Configured",
				description: "Connection is configured but not yet proven healthy.",
				action: "reprobe",
				requiresAttention: false,
			}
	}
}

export function createMcpProjectionTarget(record: Pick<
	McpConnectionRecord,
	| "serverId"
	| "transport"
	| "ownershipMode"
	| "canonicalStore"
	| "projectedOpenCode"
>): McpProjectionTarget {
	return {
		openCode: record.projectedOpenCode ?? null,
		mcporter: {
			serverId: record.serverId,
			transport: record.transport,
			ownershipMode: record.ownershipMode,
			canonicalStore: record.canonicalStore,
		},
	}
}

export function createMcpCredentialArchitecture(
	mode: McpCredentialMode,
): McpCredentialArchitecture {
	if (mode === "local-desktop") {
		return {
			mode,
			callbackOwnership: "desktop-loopback",
			tokenStorageSurface: "electron-safe-storage",
			recoveryPolicy: "local-only",
			tokenSyncPolicy: "forbidden",
			forbiddenSyncPatterns: [
				"live bidirectional refresh-token sync",
				"gateway mirroring of local-only desktop secrets",
			],
			allowedHandoffDirections: ["local_to_cloud"],
			hushTargets: ["none"],
			gatewayPersistence: "not_required",
		}
	}

	if (mode === "cloud-disposable") {
		return {
			mode,
			callbackOwnership: "gateway-proxy",
			tokenStorageSurface: "gateway-durable-vault",
			recoveryPolicy: "cloud-restore",
			tokenSyncPolicy: "forbidden",
			forbiddenSyncPatterns: [
				"live bidirectional refresh-token sync",
				"desktop callback dependency for disposable cloud restore",
			],
			allowedHandoffDirections: ["cloud_to_local"],
			hushTargets: ["runtime-dev", "runtime-staging", "runtime-production"],
			gatewayPersistence: "required",
		}
	}

	return {
		mode,
		callbackOwnership: "device-code",
		tokenStorageSurface: "mcporter-home-vault",
		recoveryPolicy: "reauth-required",
		tokenSyncPolicy: "one_shot_handoff_only",
		forbiddenSyncPatterns: [
			"live bidirectional refresh-token sync",
			"shared refresh chain owned by local and cloud at same time",
		],
		allowedHandoffDirections: ["local_to_cloud", "cloud_to_local"],
		hushTargets: ["runtime-dev", "runtime-staging", "runtime-production"],
		gatewayPersistence: "required",
	}
}

export function normalizeMcpConnectionRecord(input: {
	id: string
	serverId: string
	source: McpConnectionSource
	transport: McpConnectionTransport
	ownershipMode: McpConnectionOwnershipMode
	canonicalStore: McpConnectionCanonicalStore
	credentialMode: McpCredentialMode
	installState: McpConnectionInstallState
	authState: McpConnectionAuthState
	runtimeState: McpConnectionRuntimeState
	testState: McpConnectionTestState
	provenance: McpConnectionProvenance
	restorePolicy: McpConnectionRestorePolicy
	credentialArchitecture?: McpCredentialArchitecture | null
	lastTestAt?: string | null
	lastError?: string | null
	lastHealthyAt?: string | null
	registryEntry?: McpCatalogRegistryEntry | null
	curatedMetadata?: McpCuratedMetadata | null
	projectedOpenCode?: OpenCodeMcpLocal | OpenCodeMcpRemote | null
	metadata?: Record<string, unknown>
}): McpConnectionRecord {
	const metadata = input.metadata ?? {}
	const status = deriveMcpConnectionStatus({
		installState: input.installState,
		authState: input.authState,
		runtimeState: input.runtimeState,
		testState: input.testState,
		metadata,
	})

	return {
		...input,
		status,
		credentialArchitecture:
			input.credentialArchitecture ?? createMcpCredentialArchitecture(input.credentialMode),
		registryEntry: input.registryEntry ?? null,
		curatedMetadata: input.curatedMetadata ?? null,
		projectedOpenCode: input.projectedOpenCode ?? null,
		metadata,
	}
}
