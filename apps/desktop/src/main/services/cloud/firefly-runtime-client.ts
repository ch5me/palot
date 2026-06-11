/**
 * Firefly Cloud runtime client — first end-to-end consumer of the cloud seam.
 *
 * The cloud auth contract already supports a `tokenStore` (see
 * `firefly-cloud/packages/client` tokenStore support, commit b1caa47ae).
 * This module is the palot desktop app's first real consumer of that seam:
 * it calls the firefly cloud runtime endpoints using the locally stored
 * OAuth bearer token and threads the ElfTokenStore through every request.
 *
 * Endpoints exercised here:
 *   - GET <apiUrl>/runtime/status — fetch current runtime provisioning status
 *   - POST <apiUrl>/runtime/claim  — claim a runtime for this elf user
 *
 * The apiUrl must be supplied via `FIREFLY_API_URL` (runtime) or
 * `VITE_FIREFLY_API_URL` (build-time).
 *
 * Token is never returned to the renderer: only a serializable runtime
 * status snapshot is exposed via IPC.
 */

import { createLogger } from "../../logger"
import { getOrCreateTokenStore } from "../auth/token-store"

const log = createLogger("cloud/runtime-client")

function resolveApiUrl(override?: string): string {
	const configured = override ?? process.env.FIREFLY_API_URL ?? process.env.VITE_FIREFLY_API_URL
	if (!configured) {
		throw new Error(
			"FIREFLY_API_URL is required. Set it to the canonical Firefly API origin (for example https://api.staging.elf.dance).",
		)
	}
	const trimmed = configured.trim()
	if (!trimmed) {
		throw new Error("FIREFLY_API_URL is set but empty")
	}
	const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
	return normalized.replace(/\/+$/, "")
}

export interface FireflyRuntimeProvisioningStatus {
	state: string
	runtimeId: string | null
	region: string | null
	healthy: boolean
	lastUpdated: string
}

export interface FireflyRuntimeClientOptions {
	apiUrl?: string
	fetchImpl?: typeof fetch
	signal?: AbortSignal
}

export async function getFireflyRuntimeProvisioningStatus(
	options: FireflyRuntimeClientOptions = {},
): Promise<FireflyRuntimeProvisioningStatus> {
	const apiUrl = resolveApiUrl(options.apiUrl)
	const tokenStore = getOrCreateTokenStore()
	const authHeader = await tokenStore.getAuthHeader()

	if (!authHeader) {
		throw new Error(
			"getFireflyRuntimeProvisioningStatus: not signed in. Call auth:sign-in first.",
		)
	}

	const fetchImpl = options.fetchImpl ?? globalThis.fetch
	const response = await fetchImpl(`${apiUrl}/runtime/status`, {
		method: "GET",
		headers: {
			Authorization: authHeader,
			Accept: "application/json",
		},
		signal: options.signal ?? AbortSignal.timeout(10_000),
	})

	if (!response.ok) {
		log.warn("Cloud runtime status non-2xx", {
			apiUrl,
			status: response.status,
			statusText: response.statusText,
		})
		throw new Error(
			`Firefly runtime status failed: ${response.status} ${response.statusText}`,
		)
	}

	const body = (await response.json()) as {
		state?: string
		runtimeId?: string | null
		region?: string | null
		healthy?: boolean
		lastUpdated?: string
	}

	return {
		state: body.state ?? "unknown",
		runtimeId: body.runtimeId ?? null,
		region: body.region ?? null,
		healthy: body.healthy ?? false,
		lastUpdated: body.lastUpdated ?? new Date().toISOString(),
	}
}

export async function claimFireflyRuntime(
	options: FireflyRuntimeClientOptions = {},
): Promise<{ runtimeId: string; status: string }> {
	const apiUrl = resolveApiUrl(options.apiUrl)
	const tokenStore = getOrCreateTokenStore()
	const authHeader = await tokenStore.getAuthHeader()

	if (!authHeader) {
		throw new Error("claimFireflyRuntime: not signed in. Call auth:sign-in first.")
	}

	const fetchImpl = options.fetchImpl ?? globalThis.fetch
	const response = await fetchImpl(`${apiUrl}/runtime/claim`, {
		method: "POST",
		headers: {
			Authorization: authHeader,
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({ source: "firefly-desktop" }),
		signal: options.signal ?? AbortSignal.timeout(15_000),
	})

	if (!response.ok) {
		log.warn("Cloud runtime claim non-2xx", {
			apiUrl,
			status: response.status,
			statusText: response.statusText,
		})
		throw new Error(
			`Firefly runtime claim failed: ${response.status} ${response.statusText}`,
		)
	}

	const body = (await response.json()) as { runtimeId: string; status: string }
	return body
}
