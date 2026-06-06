import fs from "node:fs"
import path from "node:path"
import { app, net } from "electron"
import type { AppSettings } from "../preload/api"
import type {
	McpCatalogBrowseQuery,
	McpCatalogCacheEnvelope,
	McpCatalogJoinedEntry,
	McpCatalogPage,
	McpCatalogPageCursor,
	McpCatalogRegistryEntry,
	McpCatalogSearchQuery,
	McpCatalogSearchResult,
	McpCatalogServiceResult,
	McpCuratedMetadata,
} from "../renderer/lib/mcp-connections"
import { createLogger } from "./logger"
import { getSettings, updateSettings } from "./settings-store"

const log = createLogger("mcp-catalog-service")
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
		_meta?: {
			"io.modelcontextprotocol.registry/official"?: {
				updatedAt?: string
			}
		}
	}>
	metadata?: {
		nextCursor?: string
		count?: number
	}
}

interface CatalogCacheFile {
	browse: Record<string, McpCatalogPage>
	search: Record<string, McpCatalogSearchResult>
}

function resolveCatalogCachePath(settings: AppSettings): string {
	const configuredPath = settings.connections?.catalogCachePath
	if (configuredPath) return configuredPath
	return path.join(app.getPath("userData"), "mcp-catalog-cache.json")
}

function readCache(cachePath: string): CatalogCacheFile {
	if (!fs.existsSync(cachePath)) {
		return { browse: {}, search: {} }
	}
	const raw = fs.readFileSync(cachePath, "utf-8")
	const parsed = JSON.parse(raw) as CatalogCacheFile
	return {
		browse: parsed.browse ?? {},
		search: parsed.search ?? {},
	}
}

function writeCache(cachePath: string, cache: CatalogCacheFile): void {
	const dir = path.dirname(cachePath)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
	const tmpPath = `${cachePath}.tmp`
	fs.writeFileSync(tmpPath, JSON.stringify(cache, null, "\t"), "utf-8")
	fs.renameSync(tmpPath, cachePath)
}

function createCacheEnvelope(queryKey: string, cursor?: McpCatalogPageCursor | null): McpCatalogCacheEnvelope {
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

function envelopeFreshness(envelope: McpCatalogCacheEnvelope): "fresh" | "stale" | "offline_cache" {
	const now = Date.now()
	if (now <= new Date(envelope.expiresAt).getTime()) return "fresh"
	if (now <= new Date(envelope.staleAt).getTime()) return "stale"
	return "offline_cache"
}

function normalizeTransport(server: {
	remotes?: Array<{ type?: string; url?: string }>
} | null | undefined): McpCatalogRegistryEntry["transport"] {
	const remoteType = server?.remotes?.[0]?.type
	if (remoteType === "streamable-http") return "remote-http"
	if (remoteType === "sse") return "remote-sse"
	return "remote-http"
}

function normalizeRegistryEntries(payload: RegistryApiResponse): McpCatalogRegistryEntry[] {
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
			raw: item as Record<string, unknown>,
		}
	})
}

function curatedEntries(entries: McpCatalogRegistryEntry[]): McpCatalogJoinedEntry[] {
	const normalizedIds = new Map(entries.map((entry) => [entry.id.toLowerCase(), entry.id]))
	const curatedByServerId = new Map<string, McpCuratedMetadata>([
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
		curated: curatedByServerId.get(entry.id) ?? null,
		sourceOrder: "registry_first",
	}))
}

async function fetchRegistry(query: URLSearchParams): Promise<RegistryApiResponse> {
	const response = await net.fetch(`${REGISTRY_BASE_URL}/v0/servers?${query.toString()}`, {
		method: "GET",
		signal: AbortSignal.timeout(10000),
	})
	if (!response.ok) {
		throw new Error(`Registry fetch failed: ${response.status} ${response.statusText}`)
	}
	return (await response.json()) as RegistryApiResponse
}

export async function browseCatalog(
	query: McpCatalogBrowseQuery,
): Promise<McpCatalogServiceResult<McpCatalogPage>> {
	const settings = getSettings()
	const cachePath = resolveCatalogCachePath(settings)
	const cache = readCache(cachePath)
	const queryKey = `mcp-catalog:browse:${query.limit}:${query.cursor?.value ?? "first"}`
	const cached = cache.browse[queryKey]

	try {
		const params = new URLSearchParams({ limit: String(query.limit) })
		if (query.cursor?.value) params.set("cursor", query.cursor.value)
		const payload = await fetchRegistry(params)
		const page: McpCatalogPage = {
			entries: normalizeRegistryEntries(payload),
			nextCursor: payload.metadata?.nextCursor
				? { value: payload.metadata.nextCursor, source: "registry" }
				: null,
			freshness: "fresh",
			cache: createCacheEnvelope(queryKey, query.cursor ?? null),
		}
		cache.browse[queryKey] = page
		writeCache(cachePath, cache)
		updateSettings({ connections: { catalogCachePath: cachePath } })
		return { data: page, joined: curatedEntries(page.entries) }
	} catch (error) {
		log.warn("Browse catalog falling back to cache", { error })
		if (!cached) {
			throw error
		}
		const freshness = envelopeFreshness(cached.cache)
		return {
			data: { ...cached, freshness, cache: { ...cached.cache, freshness } },
			joined: curatedEntries(cached.entries),
		}
	}
}

export async function searchCatalog(
	query: McpCatalogSearchQuery,
): Promise<McpCatalogServiceResult<McpCatalogSearchResult>> {
	const settings = getSettings()
	const cachePath = resolveCatalogCachePath(settings)
	const cache = readCache(cachePath)
	const queryKey = `mcp-catalog:search:${query.query}:${query.limit}`
	const cached = cache.search[queryKey]

	try {
		const params = new URLSearchParams({ limit: String(query.limit), search: query.query })
		const payload = await fetchRegistry(params)
		const result: McpCatalogSearchResult = {
			query: query.query,
			entries: normalizeRegistryEntries(payload),
			freshness: "fresh",
			cache: createCacheEnvelope(queryKey),
		}
		cache.search[queryKey] = result
		writeCache(cachePath, cache)
		updateSettings({ connections: { catalogCachePath: cachePath } })
		return { data: result, joined: curatedEntries(result.entries) }
	} catch (error) {
		log.warn("Search catalog falling back to cache", { error })
		if (!cached) {
			throw error
		}
		const freshness = envelopeFreshness(cached.cache)
		return {
			data: { ...cached, freshness, cache: { ...cached.cache, freshness } },
			joined: curatedEntries(cached.entries),
		}
	}
}
