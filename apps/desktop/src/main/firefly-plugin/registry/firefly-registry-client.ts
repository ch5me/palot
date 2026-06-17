/**
 * Firefly Plugin Marketplace — Firefly gallery registry client (§6.2 D-C2)
 *
 * Adapts the `FireflyRegistryClient` interface to the CH5 firefly-cloud gallery
 * REST API. Mirrors the open-vsx-client pattern: factory, Zod-validated shapes,
 * injectable fetch, fail-fast on missing config.
 *
 * Gallery API contract (D-C2, §6.2):
 *   GET /firefly-plugin/gallery/:ns/:name/latest
 *     → FireflyGalleryPackageResponse
 *   GET /firefly-plugin/gallery/:ns/:name/:version
 *     → FireflyGalleryPackageResponse
 *
 * FireflyGalleryPackageResponse carries:
 *   - Standard version metadata (downloadUrl, sha256, version, …)
 *   - `signature`: the ServedSignatureMetadata (canonical manifest + signatureB64)
 *     for immediate client-side verification — bytes + signature served together.
 *
 * The client exposes `FireflyVersionMetadata extends RegistryVersionMetadata`
 * which adds `servedSignature: ServedSignatureMetadata | null` so the install
 * orchestrator can obtain BOTH the download URL and the registry signature in a
 * single round-trip.
 *
 * Base URL resolution (fail-fast, no silent fallback):
 *   1. Explicit `baseUrl` option.
 *   2. `FIREFLY_CLOUD_URL` environment variable.
 *   3. Neither → throws on first call (not at construction time, so the client
 *      can be constructed even when the URL is not yet known at module load).
 */

import { z } from "zod"
import type { FetchFn } from "./open-vsx-client"
import type { RegistryVersionMetadata } from "./open-vsx-client"
import type { ServedSignatureMetadata } from "../../../shared/firefly-plugin/registry-signature-contract"

// ---------------------------------------------------------------------------
// FireflyVersionMetadata — extends RegistryVersionMetadata with signature
// ---------------------------------------------------------------------------

/**
 * Version metadata returned by the firefly gallery. Extends the shared
 * `RegistryVersionMetadata` with `servedSignature`: the registry signature
 * served alongside the package metadata (D-C2 §6.2). The orchestrator feeds
 * this directly into `resolveDetachedSignature` as `registryMeta`.
 *
 * `servedSignature` is null only when the gallery explicitly omits it (e.g. an
 * unsigned dev package). A null value on a `kind:"firefly"` install will trigger
 * the `UnsignedInstallBlockedError` gate in the orchestrator.
 */
export interface FireflyVersionMetadata extends RegistryVersionMetadata {
	servedSignature: ServedSignatureMetadata | null
}

// ---------------------------------------------------------------------------
// FireflyRegistryClient interface
// ---------------------------------------------------------------------------

export interface FireflyRegistryClient {
	readonly registryId: string
	readonly kind: "firefly"
	readonly baseUrl: string

	/** Fetch metadata (+ signature) for a specific version. */
	getVersion(
		namespace: string,
		name: string,
		version: string,
	): Promise<FireflyVersionMetadata>

	/** Fetch metadata (+ signature) for the latest version. */
	getLatest(namespace: string, name: string): Promise<FireflyVersionMetadata>
}

// ---------------------------------------------------------------------------
// Zod schemas for gallery API responses
// ---------------------------------------------------------------------------

/**
 * Schema for the canonical signed manifest carried in gallery responses.
 * Must match `CanonicalSignedManifest` in registry-signature-contract.ts.
 */
const canonicalSignedManifestSchema = z
	.object({
		namespace: z.string().min(1).max(200),
		name: z.string().min(1).max(200),
		version: z.string().min(1).max(80),
		contentSha256: z.string().min(64).max(64),
		algorithm: z.literal("ed25519"),
		signedAt: z.string().min(1),
		publisherKeyId: z.string().min(1).max(200),
	})
	.strip()

/**
 * Schema for the `ServedSignatureMetadata` block embedded in gallery responses.
 */
const servedSignatureMetadataSchema = z
	.object({
		manifest: canonicalSignedManifestSchema,
		signatureB64: z.string().min(1),
	})
	.strip()

/**
 * Schema for a `GET /firefly-plugin/gallery/:ns/:name/:version` response.
 *
 * D-C2 contract (§6.2): the gallery serves bytes + signature metadata
 * together in a single response so the client can verify the signature before
 * downloading. The `downloadUrl` points to the actual package bytes.
 *
 * Required fields: namespace, name, version, downloadUrl.
 * `sha256` is the hex SHA-256 of the package bytes (integrity double-check).
 * `signature` carries the `ServedSignatureMetadata`; null for unsigned packages.
 */
const fireflyGalleryPackageResponseSchema = z
	.object({
		namespace: z.string().min(1).max(200),
		name: z.string().min(1).max(200),
		version: z.string().min(1).max(80),
		displayName: z.string().max(200).nullable().optional(),
		description: z.string().max(2000).nullable().optional(),
		timestamp: z.string().nullable().optional(),
		engines: z.record(z.string(), z.string()).default({}),
		categories: z.array(z.string()).default([]),
		tags: z.array(z.string()).default([]),
		license: z.string().max(40).nullable().optional(),
		homepage: z.string().nullable().optional(),
		repository: z.string().nullable().optional(),
		bugs: z.string().nullable().optional(),
		/** Direct download URL for the package bytes (.fpk / .vsix). */
		downloadUrl: z.string().min(1),
		/** Hex SHA-256 of the package bytes. */
		sha256: z.string().nullable().optional(),
		iconUrl: z.string().nullable().optional(),
		/** Served signature metadata (canonical manifest + signatureB64). Null for unsigned. */
		signature: servedSignatureMetadataSchema.nullable().optional(),
	})
	.strip()

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * Thrown when the firefly gallery API returns a non-2xx response.
 */
export class FireflyGalleryApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly endpoint: string,
		message: string,
	) {
		super(`Firefly gallery API error ${status} at ${endpoint}: ${message}`)
		this.name = "FireflyGalleryApiError"
	}
}

/**
 * Thrown when no base URL is configured for the firefly gallery (fail-fast,
 * CH5 #9: no silent fallback to a default URL that may not exist).
 */
export class FireflyGalleryUrlMissingError extends Error {
	constructor() {
		super(
			"Firefly gallery base URL is not configured. " +
				"Set FIREFLY_CLOUD_URL or pass baseUrl to createFireflyRegistryClient.",
		)
		this.name = "FireflyGalleryUrlMissingError"
	}
}

// ---------------------------------------------------------------------------
// Client options
// ---------------------------------------------------------------------------

export interface FireflyRegistryClientOptions {
	/**
	 * Explicit base URL for the firefly gallery (e.g. `https://api.ch5.ai`).
	 * When omitted, `FIREFLY_CLOUD_URL` env var is used. Neither → fail-fast.
	 */
	baseUrl?: string
	/**
	 * Injectable fetch function. Defaults to the global `fetch`.
	 * Pass a fake in tests to avoid real network calls.
	 */
	fetch?: FetchFn
	/** Registry id for provenance tracking. Default: "firefly". */
	registryId?: string
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a firefly gallery registry client.
 *
 * Mirrors `createOpenVsxClient` in structure. The client resolves the base URL
 * lazily (on first API call) so construction never throws; the fail-fast error
 * fires only when a call is actually attempted without a configured URL.
 *
 * @example
 * ```ts
 * const client = createFireflyRegistryClient({ baseUrl: "https://api.ch5.ai" })
 * const meta = await client.getLatest("ch5", "code-assist")
 * // meta.servedSignature carries the CanonicalSignedManifest + signatureB64
 * ```
 */
export function createFireflyRegistryClient(
	options: FireflyRegistryClientOptions = {},
): FireflyRegistryClient {
	const fetchFn: FetchFn = options.fetch ?? ((url, init) => fetch(url, init))
	const registryId = options.registryId ?? "firefly"

	function resolveBaseUrl(): string {
		const raw = options.baseUrl ?? process.env["FIREFLY_CLOUD_URL"]
		if (!raw) throw new FireflyGalleryUrlMissingError()
		return raw.replace(/\/+$/, "")
	}

	async function apiFetch(endpoint: string): Promise<unknown> {
		const baseUrl = resolveBaseUrl()
		const url = `${baseUrl}${endpoint}`
		const response = await fetchFn(url)
		if (!response.ok) {
			const body = await response.text().catch(() => "")
			throw new FireflyGalleryApiError(
				response.status,
				endpoint,
				body || `HTTP ${response.status}`,
			)
		}
		return response.json()
	}

	function mapResponse(
		raw: z.infer<typeof fireflyGalleryPackageResponseSchema>,
	): FireflyVersionMetadata {
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
			repository: raw.repository ?? null,
			bugs: raw.bugs ?? null,
			downloadUrl: raw.downloadUrl,
			sha256: raw.sha256 ?? null,
			iconUrl: raw.iconUrl ?? null,
			readme: null,
			changelog: null,
			files: {},
			contributes: null,
			servedSignature: raw.signature ?? null,
		}
	}

	return {
		registryId,
		kind: "firefly",
		get baseUrl() {
			// Resolve lazily so construction does not throw when URL is missing.
			// Accessing .baseUrl before a call may throw — documented.
			return resolveBaseUrl()
		},

		async getVersion(
			namespace: string,
			name: string,
			version: string,
		): Promise<FireflyVersionMetadata> {
			const endpoint = `/firefly-plugin/gallery/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
			const raw = await apiFetch(endpoint)
			const parsed = fireflyGalleryPackageResponseSchema.parse(raw)
			return mapResponse(parsed)
		},

		async getLatest(namespace: string, name: string): Promise<FireflyVersionMetadata> {
			const endpoint = `/firefly-plugin/gallery/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/latest`
			const raw = await apiFetch(endpoint)
			const parsed = fireflyGalleryPackageResponseSchema.parse(raw)
			return mapResponse(parsed)
		},
	}
}
