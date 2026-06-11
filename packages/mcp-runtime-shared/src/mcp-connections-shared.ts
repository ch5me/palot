export type McpConnectionSource = "registry" | "curated" | "imported" | "manual"
export type McpConnectionTransport = "remote-http" | "remote-sse" | "local-stdio"
export type McpConnectionOwnershipMode = "local-only" | "cloud-only" | "handoff-derived"
export type McpConnectionCanonicalStore = "local" | "gateway"
export type McpConnectionRestorePolicy = "none" | "reproject_on_boot" | "reproject_and_reauth_if_needed"

export interface McpCatalogBrowseInput {
	cursor?: { value: string; source: "registry" | "cache" } | null
	limit: number
}

export interface McpCatalogSearchInput {
	query: string
	limit: number
}

export interface McpConnectionRegisterInput {
	name: string
	transport: McpConnectionTransport
	target: string
	ownershipMode?: McpConnectionOwnershipMode
	canonicalStore?: McpConnectionCanonicalStore
	restorePolicy?: McpConnectionRestorePolicy
	source?: McpConnectionSource
	scope?: "home" | "project"
	metadata?: Record<string, unknown>
}

export interface McpConnectionRecordSnapshot {
	name: string
	displayName?: string
	transport: string
	target: string
	scope: string
	ownershipMode?: string
	authState?: string
	canonicalStore?: string
	restorePolicy?: string
	testState?: string
	status?: string
	runtimeState?: string
	credentialMode?: string
	projectedOpenCode?: Record<string, unknown> | null
	metadata?: Record<string, unknown>
	lastTestAt?: string | null
	lastHealthyAt?: string | null
	lastError?: string | null
}
