/**
 * Firefly Plugin System V2 — Open VSX registry client (read-only, §7)
 *
 * Read-only search + version + download-VSIX against the public Open VSX
 * v3 API (https://open-vsx.org/api). No auth needed (public API).
 *
 * This is NOT firefly-cloud. The client adapts the `RegistryClient`
 * interface from design §7 to the Open VSX REST API shape.
 *
 * API reference: https://open-vsx.org/v3/api-docs
 *
 * Supported operations (read-only, Phase 1 scope):
 *   - search(query, options)           — search extensions by keyword/category
 *   - getVersion(namespace, name, ver) — fetch metadata for one version
 *   - getLatest(namespace, name)       — fetch latest version metadata
 *
 * The client does not implement download-VSIX (that returns a URL from
 * `getVersion`; callers fetch it directly with a plain HTTP GET). This
 * avoids coupling the client to the package store.
 *
 * All types are Zod-validated at the network boundary. Unknown extra fields
 * from the API are stripped (`.strip()`) so the client never bleeds
 * API-shape changes into callers.
 */

import { z } from "zod"

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Default base URL for the public Open VSX API. */
export const OPEN_VSX_BASE_URL = "https://open-vsx.org/api"

// ---------------------------------------------------------------------------
// RegistryClient interface (design §7 — adapter contract)
// ---------------------------------------------------------------------------

/**
 * Search options for `RegistryClient.search`.
 */
export interface RegistrySearchOptions {
	/** Free-text query (extension name, publisher, keyword). */
	query?: string
	/** Category filter (e.g. "Themes"). */
	category?: string
	/** Max number of results (default: 18, max: 100 per Open VSX docs). */
	size?: number
	/** Offset for pagination (default: 0). */
	offset?: number
	/** Sort order: "relevance" | "downloadCount" | "rating" | "timestamp". */
	sortBy?: "relevance" | "downloadCount" | "rating" | "timestamp"
	/** Sort order direction: "asc" | "desc". */
	sortOrder?: "asc" | "desc"
}

/**
 * A single search result entry.
 */
export interface RegistrySearchEntry {
	namespace: string
	name: string
	displayName: string | null
	description: string | null
	version: string
	timestamp: string | null
	averageRating: number | null
	downloadCount: number | null
	iconUrl: string | null
	files: Record<string, string>
}

/**
 * Result of a registry search.
 */
export interface RegistrySearchResult {
	offset: number
	totalSize: number
	extensions: RegistrySearchEntry[]
}

/**
 * Metadata for one extension version.
 */
export interface RegistryVersionMetadata {
	namespace: string
	name: string
	displayName: string | null
	description: string | null
	version: string
	timestamp: string | null
	engines: Record<string, string>
	categories: string[]
	tags: string[]
	license: string | null
	homepage: string | null
	repository: string | null
	bugs: string | null
	/** URL to download the VSIX file. */
	downloadUrl: string | null
	/** SHA-256 of the VSIX file when provided by the registry. */
	sha256: string | null
	iconUrl: string | null
	readme: string | null
	changelog: string | null
	files: Record<string, string>
	/** Raw `contributes` from the extension's package.json, if available. */
	contributes: Record<string, unknown> | null
}

/**
 * The RegistryClient interface (design §7 — read-only subset for Phase 1).
 * The rest of the client only knows `RegistryClient` — adding a registry is
 * one adapter.
 */
export interface RegistryClient {
	readonly registryId: string
	readonly kind: "open-vsx"
	readonly baseUrl: string

	/** Search extensions by keyword or category. */
	search(options?: RegistrySearchOptions): Promise<RegistrySearchResult>

	/** Fetch metadata for a specific version of an extension. */
	getVersion(
		namespace: string,
		name: string,
		version: string,
	): Promise<RegistryVersionMetadata>

	/** Fetch metadata for the latest version of an extension. */
	getLatest(namespace: string, name: string): Promise<RegistryVersionMetadata>
}

// ---------------------------------------------------------------------------
// Zod schemas for Open VSX API responses
// ---------------------------------------------------------------------------

const openVsxFileMapSchema = z.record(z.string(), z.string()).default({})

const openVsxSearchEntrySchema = z
	.object({
		namespace: z.string().min(1).max(200),
		name: z.string().min(1).max(200),
		displayName: z.string().max(200).nullable().optional(),
		description: z.string().max(2000).nullable().optional(),
		version: z.string().min(1).max(80),
		timestamp: z.string().nullable().optional(),
		averageRating: z.number().nullable().optional(),
		downloadCount: z.number().nullable().optional(),
		files: openVsxFileMapSchema,
	})
	.strip()

const openVsxSearchResponseSchema = z
	.object({
		offset: z.number().int().nonnegative().default(0),
		totalSize: z.number().int().nonnegative().default(0),
		extensions: z.array(openVsxSearchEntrySchema).default([]),
	})
	.strip()

const openVsxVersionSchema = z
	.object({
		namespace: z.string().min(1).max(200),
		name: z.string().min(1).max(200),
		displayName: z.string().max(200).nullable().optional(),
		description: z.string().max(2000).nullable().optional(),
		version: z.string().min(1).max(80),
		timestamp: z.string().nullable().optional(),
		engines: z.record(z.string(), z.string()).default({}),
		categories: z.array(z.string()).default([]),
		tags: z.array(z.string()).default([]),
		license: z.string().max(40).nullable().optional(),
		homepage: z.string().nullable().optional(),
		repository: z.record(z.string(), z.unknown()).nullable().optional(),
		bugs: z.record(z.string(), z.unknown()).nullable().optional(),
		files: openVsxFileMapSchema,
		contributes: z.record(z.string(), z.unknown()).nullable().optional(),
	})
	.strip()

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown when the Open VSX API returns a non-2xx response.
 */
export class OpenVsxApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly endpoint: string,
		message: string,
	) {
		super(`Open VSX API error ${status} at ${endpoint}: ${message}`)
		this.name = "OpenVsxApiError"
	}
}

// ---------------------------------------------------------------------------
// Injectable fetch (for tests)
// ---------------------------------------------------------------------------

/**
 * Minimal fetch interface — mirrors the global `fetch` signature for the
 * subset the client uses. Injected in tests to avoid real HTTP calls.
 */
export interface FetchFn {
	(url: string, init?: { signal?: AbortSignal }): Promise<{
		ok: boolean
		status: number
		json(): Promise<unknown>
		text(): Promise<string>
	}>
}

// ---------------------------------------------------------------------------
// Client implementation
// ---------------------------------------------------------------------------

/**
 * Options for `createOpenVsxClient`.
 */
export interface OpenVsxClientOptions {
	/** Override the base URL (default: `OPEN_VSX_BASE_URL`). */
	baseUrl?: string
	/**
	 * Injectable fetch implementation. Defaults to the global `fetch`.
	 * Pass a fake in tests to avoid real network calls.
	 */
	fetch?: FetchFn
	/** Registry id used for provenance tracking. Default: "open-vsx". */
	registryId?: string
}

/**
 * Create a read-only Open VSX registry client.
 *
 * @example
 * ```ts
 * const client = createOpenVsxClient()
 * const results = await client.search({ query: "One Dark Pro", category: "Themes" })
 * const version = await client.getLatest("zhuangtongfa", "material-theme")
 * ```
 */
export function createOpenVsxClient(options: OpenVsxClientOptions = {}): RegistryClient {
	const baseUrl = (options.baseUrl ?? OPEN_VSX_BASE_URL).replace(/\/+$/, "")
	const fetchFn: FetchFn = options.fetch ?? ((url, init) => fetch(url, init))
	const registryId = options.registryId ?? "open-vsx"

	async function apiFetch(endpoint: string): Promise<unknown> {
		const url = `${baseUrl}${endpoint}`
		const response = await fetchFn(url)
		if (!response.ok) {
			const body = await response.text().catch(() => "")
			throw new OpenVsxApiError(response.status, endpoint, body || `HTTP ${response.status}`)
		}
		return response.json()
	}

	function mapSearchEntry(raw: z.infer<typeof openVsxSearchEntrySchema>): RegistrySearchEntry {
		return {
			namespace: raw.namespace,
			name: raw.name,
			displayName: raw.displayName ?? null,
			description: raw.description ?? null,
			version: raw.version,
			timestamp: raw.timestamp ?? null,
			averageRating: raw.averageRating ?? null,
			downloadCount: raw.downloadCount ?? null,
			iconUrl: raw.files["icon"] ?? null,
			files: raw.files,
		}
	}

	function mapVersionMetadata(
		raw: z.infer<typeof openVsxVersionSchema>,
	): RegistryVersionMetadata {
		const repoStr =
			typeof raw.repository === "object" && raw.repository !== null
				? String((raw.repository as Record<string, unknown>)["url"] ?? "")
				: null
		const bugsStr =
			typeof raw.bugs === "object" && raw.bugs !== null
				? String((raw.bugs as Record<string, unknown>)["url"] ?? "")
				: null

		return {
			namespace: raw.namespace,
			name: raw.name,
			displayName: raw.displayName ?? null,
			description: raw.description ?? null,
			version: raw.version,
			timestamp: raw.timestamp ?? null,
			engines: raw.engines,
			categories: raw.categories,
			tags: raw.tags,
			license: raw.license ?? null,
			homepage: raw.homepage ?? null,
			repository: repoStr || null,
			bugs: bugsStr || null,
			downloadUrl: raw.files["download"] ?? null,
			sha256: raw.files["sha256"] ?? null,
			iconUrl: raw.files["icon"] ?? null,
			readme: raw.files["readme"] ?? null,
			changelog: raw.files["changelog"] ?? null,
			files: raw.files,
			contributes: raw.contributes ?? null,
		}
	}

	return {
		registryId,
		kind: "open-vsx",
		baseUrl,

		async search(opts: RegistrySearchOptions = {}): Promise<RegistrySearchResult> {
			const params = new URLSearchParams()
			if (opts.query) params.set("query", opts.query)
			if (opts.category) params.set("category", opts.category)
			if (opts.size !== undefined) params.set("size", String(Math.min(opts.size, 100)))
			if (opts.offset !== undefined) params.set("offset", String(opts.offset))
			if (opts.sortBy) params.set("sortBy", opts.sortBy)
			if (opts.sortOrder) params.set("sortOrder", opts.sortOrder)

			const qs = params.toString()
			const endpoint = `/v2/-/search${qs ? `?${qs}` : ""}`
			const raw = await apiFetch(endpoint)
			const parsed = openVsxSearchResponseSchema.parse(raw)
			return {
				offset: parsed.offset,
				totalSize: parsed.totalSize,
				extensions: parsed.extensions.map(mapSearchEntry),
			}
		},

		async getVersion(
			namespace: string,
			name: string,
			version: string,
		): Promise<RegistryVersionMetadata> {
			const endpoint = `/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
			const raw = await apiFetch(endpoint)
			const parsed = openVsxVersionSchema.parse(raw)
			return mapVersionMetadata(parsed)
		},

		async getLatest(namespace: string, name: string): Promise<RegistryVersionMetadata> {
			const endpoint = `/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/latest`
			const raw = await apiFetch(endpoint)
			const parsed = openVsxVersionSchema.parse(raw)
			return mapVersionMetadata(parsed)
		},
	}
}
