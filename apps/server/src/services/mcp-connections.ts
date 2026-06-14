import { execFile } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import type {
	McpCatalogBrowseInput,
	McpCatalogSearchInput,
	McpConnectionRecordSnapshot,
	McpConnectionRegisterInput,
} from "@ch5me/mcp-runtime-shared"
import { resolveMcporterCommand } from "./mcporter-cli"
import { resolveMcporterConfigPath, withMcporterConfig } from "./mcporter-config"

const execFileAsync = promisify(execFile)
const REGISTRY_BASE_URL = "https://registry.modelcontextprotocol.io"
const REFRESH_TTL_MS = 5 * 60 * 1000
const STALE_TTL_MS = 24 * 60 * 60 * 1000

interface RegistryApiResponse {
	servers?: Array<{
		server?: {
			name?: string
			description?: string
			repository?: { url?: string }
			remotes?: Array<{ type?: string; url?: string }>
			version?: string
		}
		metadata?: { updatedAt?: string }
	}>
	metadata?: {
		nextCursor?: string
		count?: number
	}
}

interface CacheEnvelope {
	queryKey: string
	storedAt: string
	freshness: "fresh" | "stale" | "offline_cache"
	expiresAt: string
	staleAt: string
	cursor?: { value: string; source: "registry" | "cache" } | null
}

interface CachePage {
	entries: Array<Record<string, unknown>>
	nextCursor?: { value: string; source: "registry" | "cache" } | null
	freshness: "fresh" | "stale" | "offline_cache"
	cache: CacheEnvelope
}

interface CacheSearch {
	query: string
	entries: Array<Record<string, unknown>>
	freshness: "fresh" | "stale" | "offline_cache"
	cache: CacheEnvelope
}

interface CatalogCacheFile {
	browse: Record<string, CachePage>
	search: Record<string, CacheSearch>
}

interface McporterConfigFile {
	mcpServers?: Record<string, Record<string, unknown>>
}

const STATUS_PRIORITY: Record<string, number> = {
	connected: 5,
	degraded: 4,
	configured: 3,
	needs_auth: 2,
	offline: 1,
}

const AUTH_STATE_PRIORITY: Record<string, number> = {
	authenticated: 4,
	not_required: 3,
	needs_auth: 2,
	expired: 1,
	failed: 0,
}

const RUNTIME_STATE_PRIORITY: Record<string, number> = {
	active: 4,
	degraded: 3,
	projected: 2,
	offline: 1,
	not_projected: 0,
}

const TEST_STATE_PRIORITY: Record<string, number> = {
	passing: 2,
	untested: 1,
	failing: 0,
}

function userDataDir() {
	return (
		process.env.ELF_MCP_STATE_DIR ?? path.join(process.env.HOME ?? ".", ".local", "share", "elf")
	)
}

function resolveConnectionRecordsPath() {
	return path.join(userDataDir(), "mcp-connection-records.json")
}

function resolveCatalogCachePath() {
	return path.join(userDataDir(), "mcp-catalog-cache.json")
}

function ensureDir(filePath: string) {
	const dir = path.dirname(filePath)
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function writeJson(filePath: string, value: unknown) {
	ensureDir(filePath)
	const tmpPath = `${filePath}.tmp`
	fs.writeFileSync(tmpPath, JSON.stringify(value, null, "\t"), "utf-8")
	fs.renameSync(tmpPath, filePath)
}

function readJson<T>(filePath: string, fallback: T): T {
	if (!fs.existsSync(filePath)) return fallback
	return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
}

function normalizeTarget(target: string): string {
	const trimmed = target.trim()
	if (!trimmed) return trimmed
	try {
		const url = new URL(trimmed)
		url.hostname = url.hostname.toLowerCase()
		url.hash = ""
		if (url.pathname !== "/" && url.pathname.endsWith("/")) {
			url.pathname = url.pathname.slice(0, -1)
		}
		return url.toString()
	} catch {
		return trimmed.replace(/\/+$/g, "")
	}
}

function resolveConnectionIdentity(
	input: Pick<McpConnectionRecordSnapshot, "name" | "target" | "transport">,
) {
	if (input.transport === "local-stdio") {
		return `local:${input.target.trim()}`
	}
	if (input.target.trim()) {
		return `remote:${normalizeTarget(input.target)}`
	}
	return `name:${input.name.trim().toLowerCase()}`
}

function resolveMcporterConfigIdentity(name: string, config: Record<string, unknown>) {
	if (typeof config.command === "string" && config.command.trim()) {
		return `local:${config.command.trim()}`
	}
	if (typeof config.baseUrl === "string" && config.baseUrl.trim()) {
		return `remote:${normalizeTarget(config.baseUrl)}`
	}
	return `name:${name.trim().toLowerCase()}`
}

function parseTimestamp(value?: string | null) {
	if (!value) return 0
	const parsed = Date.parse(value)
	return Number.isFinite(parsed) ? parsed : 0
}

function compareConnectionRecords(a: McpConnectionRecordSnapshot, b: McpConnectionRecordSnapshot) {
	const healthyDelta = parseTimestamp(b.lastHealthyAt) - parseTimestamp(a.lastHealthyAt)
	if (healthyDelta !== 0) return healthyDelta
	const testDelta = parseTimestamp(b.lastTestAt) - parseTimestamp(a.lastTestAt)
	if (testDelta !== 0) return testDelta
	const statusDelta =
		(STATUS_PRIORITY[b.status ?? ""] ?? -1) - (STATUS_PRIORITY[a.status ?? ""] ?? -1)
	if (statusDelta !== 0) return statusDelta
	const authDelta =
		(AUTH_STATE_PRIORITY[b.authState ?? ""] ?? -1) - (AUTH_STATE_PRIORITY[a.authState ?? ""] ?? -1)
	if (authDelta !== 0) return authDelta
	const runtimeDelta =
		(RUNTIME_STATE_PRIORITY[b.runtimeState ?? ""] ?? -1) -
		(RUNTIME_STATE_PRIORITY[a.runtimeState ?? ""] ?? -1)
	if (runtimeDelta !== 0) return runtimeDelta
	const testStateDelta =
		(TEST_STATE_PRIORITY[b.testState ?? ""] ?? -1) - (TEST_STATE_PRIORITY[a.testState ?? ""] ?? -1)
	if (testStateDelta !== 0) return testStateDelta
	const nameLengthDelta = a.name.length - b.name.length
	if (nameLengthDelta !== 0) return nameLengthDelta
	return a.name.localeCompare(b.name)
}

function normalizeConnectionRecords(records: Record<string, McpConnectionRecordSnapshot>) {
	const deduped = new Map<string, McpConnectionRecordSnapshot>()
	for (const record of Object.values(records).sort(compareConnectionRecords)) {
		const identity = resolveConnectionIdentity(record)
		if (!deduped.has(identity)) {
			deduped.set(identity, record)
		}
	}
	const normalized = Object.fromEntries(
		Array.from(deduped.values())
			.sort(compareConnectionRecords)
			.map((record) => [record.name, record]),
	)
	return {
		changed: JSON.stringify(records) !== JSON.stringify(normalized),
		records: normalized,
	}
}

function compareMcporterEntries(
	[aName, aConfig]: [string, Record<string, unknown>],
	[bName, bConfig]: [string, Record<string, unknown>],
) {
	const aAuth = typeof aConfig.auth === "string" ? aConfig.auth.length : 0
	const bAuth = typeof bConfig.auth === "string" ? bConfig.auth.length : 0
	if (aAuth !== bAuth) return bAuth - aAuth
	const aRemote = typeof aConfig.baseUrl === "string" ? 1 : 0
	const bRemote = typeof bConfig.baseUrl === "string" ? 1 : 0
	if (aRemote !== bRemote) return bRemote - aRemote
	const aLocal = typeof aConfig.command === "string" ? 1 : 0
	const bLocal = typeof bConfig.command === "string" ? 1 : 0
	if (aLocal !== bLocal) return bLocal - aLocal
	const nameLengthDelta = aName.length - bName.length
	if (nameLengthDelta !== 0) return nameLengthDelta
	return aName.localeCompare(bName)
}

function normalizeMcporterServers(servers: Record<string, Record<string, unknown>>) {
	const deduped = new Map<string, [string, Record<string, unknown>]>()
	for (const entry of Object.entries(servers).sort(compareMcporterEntries)) {
		const identity = resolveMcporterConfigIdentity(entry[0], entry[1])
		if (!deduped.has(identity)) {
			deduped.set(identity, entry)
		}
	}
	return Object.fromEntries(Array.from(deduped.values()).sort(compareMcporterEntries))
}

function persistConnectionRecord(record: McpConnectionRecordSnapshot) {
	const filePath = resolveConnectionRecordsPath()
	const existing = readJson<{ records?: Record<string, McpConnectionRecordSnapshot> }>(filePath, {})
	const records = existing.records ?? {}
	const nextIdentity = resolveConnectionIdentity(record)
	for (const [name, existingRecord] of Object.entries(records)) {
		if (name === record.name) continue
		if (resolveConnectionIdentity(existingRecord) === nextIdentity) {
			delete records[name]
		}
	}
	const previous = records[record.name]
	records[record.name] = {
		...previous,
		...record,
		metadata: {
			...(previous?.metadata ?? {}),
			...(record.metadata ?? {}),
		},
	}
	const normalized = normalizeConnectionRecords(records)
	writeJson(filePath, { records: normalized.records })
}

export function listMcpConnectionRecords(): McpConnectionRecordSnapshot[] {
	const parsed = readJson<{ records?: Record<string, McpConnectionRecordSnapshot> }>(
		resolveConnectionRecordsPath(),
		{},
	)
	const normalized = normalizeConnectionRecords(parsed.records ?? {})
	if (normalized.changed) {
		writeJson(resolveConnectionRecordsPath(), { records: normalized.records })
	}
	return Object.values(normalized.records).map((record) => ({
		...record,
		displayName:
			typeof record.displayName === "string" && record.displayName.trim().length > 0
				? record.displayName
				: typeof record.metadata?.displayName === "string" &&
						record.metadata.displayName.trim().length > 0
					? record.metadata.displayName
					: record.name,
	}))
}

function buildMcporterServerConfig(input: McpConnectionRegisterInput): Record<string, unknown> {
	if (input.transport === "local-stdio") {
		return { command: input.target }
	}

	const authComplexity =
		typeof input.metadata?.authComplexity === "string" ? input.metadata.authComplexity : null
	const usesOAuth =
		authComplexity === "oauth" ||
		input.name === "notion" ||
		input.target.includes("mcp.notion.com/mcp")

	return usesOAuth ? { baseUrl: input.target, auth: "oauth" } : { baseUrl: input.target }
}

function upsertMcporterConfig(scope: string, name: string, config: Record<string, unknown>) {
	const filePath = resolveMcporterConfigPath(scope)
	const current = readJson<McporterConfigFile>(filePath, {})
	const mcpServers = { ...(current.mcpServers ?? {}) }
	mcpServers[name] = {
		...(mcpServers[name] ?? {}),
		...config,
	}
	writeJson(filePath, { ...current, mcpServers: normalizeMcporterServers(mcpServers) })
}

export async function registerMcpConnection(
	input: McpConnectionRegisterInput,
): Promise<{ ok: true }> {
	const ownershipMode = input.ownershipMode ?? "local-only"
	const canonicalStore =
		input.canonicalStore ?? (ownershipMode === "cloud-only" ? "gateway" : "local")
	const restorePolicy =
		input.restorePolicy ??
		(canonicalStore === "gateway" ? "reproject_and_reauth_if_needed" : "reproject_on_boot")
	const credentialMode =
		ownershipMode === "cloud-only"
			? "cloud-disposable"
			: ownershipMode === "handoff-derived"
				? "hybrid-handoff"
				: "local-desktop"
	const scope = input.scope ?? (canonicalStore === "gateway" ? "home" : "project")
	const mcporterConfig = buildMcporterServerConfig(input)
	upsertMcporterConfig(scope, input.name, mcporterConfig)
	const projectedOpenCode =
		input.transport === "local-stdio"
			? { type: "local", command: [input.target] }
			: { type: "remote", url: input.target }
	persistConnectionRecord({
		name: input.name,
		transport: input.transport,
		target: input.target,
		scope,
		ownershipMode,
		authState: input.transport === "local-stdio" ? "not_required" : "needs_auth",
		canonicalStore,
		restorePolicy,
		testState: "untested",
		status: "configured",
		runtimeState: "projected",
		credentialMode,
		projectedOpenCode,
		metadata: {
			source: input.source ?? "manual",
			...(input.metadata ?? {}),
		},
		lastTestAt: null,
		lastHealthyAt: null,
		lastError: null,
	})
	return { ok: true }
}

export async function loginMcpConnection(name: string): Promise<{ ok: true }> {
	const existing = listMcpConnectionRecords().find((record) => record.name === name)
	if (!existing) {
		throw new Error(`Unknown MCP connection: ${name}`)
	}
	return { ok: true }
}

export async function testMcpConnection(name: string): Promise<{ ok: boolean; output: string }> {
	const existing = listMcpConnectionRecords().find((record) => record.name === name)
	const configPath = resolveMcporterConfigPath(existing?.scope ?? "project")
	const command = resolveMcporterCommand(
		withMcporterConfig(["list", name, "--status", "--json"], configPath),
	)
	const { stdout } = await execFileAsync(command.file, command.args)
	const now = new Date().toISOString()
	const parsed = JSON.parse(stdout) as { servers?: Array<{ status?: string; error?: string }> }
	const first = parsed.servers?.[0]
	const ok = first?.status === "ok"
	persistConnectionRecord({
		name,
		transport: existing?.transport ?? "remote-http",
		target: existing?.target ?? name,
		scope: existing?.scope ?? "project",
		ownershipMode: existing?.ownershipMode ?? "local-only",
		authState: ok ? "authenticated" : "failed",
		canonicalStore: existing?.canonicalStore ?? "local",
		restorePolicy: existing?.restorePolicy ?? "reproject_on_boot",
		testState: ok ? "passing" : "failing",
		status: ok ? "connected" : "degraded",
		runtimeState: ok ? "active" : "degraded",
		credentialMode: existing?.credentialMode,
		projectedOpenCode: existing?.projectedOpenCode ?? null,
		metadata: existing?.metadata,
		lastTestAt: now,
		lastHealthyAt: ok ? now : null,
		lastError: ok ? null : (first?.error ?? "Probe failed"),
	})
	return { ok, output: stdout }
}

function createCacheEnvelope(
	queryKey: string,
	cursor?: { value: string; source: "registry" | "cache" } | null,
): CacheEnvelope {
	const now = new Date()
	return {
		queryKey,
		storedAt: now.toISOString(),
		freshness: "fresh",
		expiresAt: new Date(now.getTime() + REFRESH_TTL_MS).toISOString(),
		staleAt: new Date(now.getTime() + STALE_TTL_MS).toISOString(),
		cursor: cursor ?? null,
	}
}

function envelopeFreshness(envelope: CacheEnvelope): "fresh" | "stale" | "offline_cache" {
	const now = Date.now()
	if (now <= new Date(envelope.expiresAt).getTime()) return "fresh"
	if (now <= new Date(envelope.staleAt).getTime()) return "stale"
	return "offline_cache"
}

async function fetchRegistry(query: URLSearchParams): Promise<RegistryApiResponse> {
	const response = await fetch(`${REGISTRY_BASE_URL}/v0/servers?${query.toString()}`, {
		method: "GET",
		signal: AbortSignal.timeout(10000),
	})
	if (!response.ok) {
		throw new Error(`Registry fetch failed: ${response.status} ${response.statusText}`)
	}
	return (await response.json()) as RegistryApiResponse
}

function normalizeTransport(
	server: { remotes?: Array<{ type?: string; url?: string }> } | null | undefined,
) {
	const remoteType = server?.remotes?.[0]?.type
	if (remoteType === "streamable-http") return "remote-http"
	if (remoteType === "sse") return "remote-sse"
	return "remote-http"
}

function normalizeRegistryEntries(payload: RegistryApiResponse): Array<Record<string, unknown>> {
	return (payload.servers ?? []).map((item) => {
		const server = item.server ?? {}
		const repoUrl = server.repository?.url
		return {
			id: server.name ?? "unknown",
			name: server.name ?? "unknown",
			description: server.description,
			transport: normalizeTransport(server),
			authComplexity: "oauth",
			upstreamUrl: server.remotes?.[0]?.url,
			docsUrl: repoUrl,
			tags: repoUrl?.includes("github") ? ["github"] : [],
			toolCount: 0,
			readToolCount: 0,
			writeToolCount: 0,
			registryVersion: server.version,
			raw: item,
		}
	})
}

function curatedEntries(entries: Array<Record<string, unknown>>) {
	const normalizedIds = new Map(
		entries.map((entry) => [String(entry.id).toLowerCase(), String(entry.id)]),
	)
	const curatedByServerId = new Map<string, Record<string, unknown>>([
		[
			normalizedIds.get("ai.smithery/smithery-notion") ?? "ai.smithery/smithery-notion",
			{
				serverId: normalizedIds.get("ai.smithery/smithery-notion") ?? "ai.smithery/smithery-notion",
				rank: 2,
				category: "Knowledge",
				whyRecommended: "Search workspace docs and project notes from one MCP connection.",
				authComplexity: "oauth",
				requiresGateway: false,
				readToolHint: "Search workspace docs and project specs.",
				writeRisk: "mixed",
				manualOnly: false,
				tags: ["docs", "wiki", "notes"],
				registryBacked: true,
				sourceLabel: "registry",
			},
		],
		[
			normalizedIds.get("postgres") ?? "postgres",
			{
				serverId: normalizedIds.get("postgres") ?? "postgres",
				rank: 8,
				category: "Data",
				whyRecommended: "Inspect production-safe database state with explicit credentials.",
				authComplexity: "env_manual",
				requiresGateway: false,
				readToolHint: "Run safe read queries first.",
				writeRisk: "mixed",
				manualOnly: false,
				tags: ["sql", "database", "inspection"],
				registryBacked: true,
				sourceLabel: "registry",
			},
		],
	])
	return entries.map((entry) => ({
		registry: entry,
		curated: curatedByServerId.get(String(entry.id)) ?? null,
		sourceOrder: "registry_first",
	}))
}

export async function browseCatalog(query: McpCatalogBrowseInput) {
	const cachePath = resolveCatalogCachePath()
	const cache = readJson<CatalogCacheFile>(cachePath, { browse: {}, search: {} })
	const queryKey = `mcp-catalog:browse:${query.limit}:${query.cursor?.value ?? "first"}`
	const cached = cache.browse[queryKey]
	try {
		const params = new URLSearchParams({ limit: String(query.limit) })
		if (query.cursor?.value) params.set("cursor", query.cursor.value)
		const payload = await fetchRegistry(params)
		const page: CachePage = {
			entries: normalizeRegistryEntries(payload),
			nextCursor: payload.metadata?.nextCursor
				? { value: payload.metadata.nextCursor, source: "registry" }
				: null,
			freshness: "fresh",
			cache: createCacheEnvelope(queryKey, query.cursor ?? null),
		}
		cache.browse[queryKey] = page
		writeJson(cachePath, cache)
		return { data: page, joined: curatedEntries(page.entries) }
	} catch (error) {
		if (!cached) throw error
		const freshness = envelopeFreshness(cached.cache)
		return {
			data: { ...cached, freshness, cache: { ...cached.cache, freshness } },
			joined: curatedEntries(cached.entries),
		}
	}
}

export async function searchCatalog(query: McpCatalogSearchInput) {
	const cachePath = resolveCatalogCachePath()
	const cache = readJson<CatalogCacheFile>(cachePath, { browse: {}, search: {} })
	const queryKey = `mcp-catalog:search:${query.query}:${query.limit}`
	const cached = cache.search[queryKey]
	try {
		const params = new URLSearchParams({ limit: String(query.limit), search: query.query })
		const payload = await fetchRegistry(params)
		const result: CacheSearch = {
			query: query.query,
			entries: normalizeRegistryEntries(payload),
			freshness: "fresh",
			cache: createCacheEnvelope(queryKey),
		}
		cache.search[queryKey] = result
		writeJson(cachePath, cache)
		return { data: result, joined: curatedEntries(result.entries) }
	} catch (error) {
		if (!cached) throw error
		const freshness = envelopeFreshness(cached.cache)
		return {
			data: { ...cached, freshness, cache: { ...cached.cache, freshness } },
			joined: curatedEntries(cached.entries),
		}
	}
}
