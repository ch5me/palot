import { createLogger } from "../../logger"

const log = createLogger("auth/device-auth-client")

function normalizeAuthBaseUrl(value: string): string {
	const trimmed = value.trim()
	if (!trimmed) {
		throw new Error("FIREFLY_AUTH_HOST is set but empty")
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed.replace(/\/+$/, "")
	}
	return `https://${trimmed.replace(/\/+$/, "")}`
}

// Contract: auth entry lives on app host, not a separate auth subdomain.
// See docs/company/service-topology-env-contract.md (ch5-company repo).
// Staging override: FIREFLY_AUTH_HOST=https://staging.app.elf.dance
function resolveAuthBaseUrl(): string {
	const configured = process.env.FIREFLY_AUTH_HOST ?? process.env.VITE_FIREFLY_AUTH_HOST ?? "https://app.elf.dance"
	return normalizeAuthBaseUrl(configured)
}

export interface DeviceCodeResponse {
	deviceCode: string
	userCode: string
	verificationUri: string
	verificationUriComplete: string
	expiresIn: number
	interval: number
}

export interface TokenResponse {
	accessToken: string
	refreshToken: string | null
	expiresIn: number
	elfUserId: string
	issuer: string
	audience: string
}

export class ExpiredTokenError extends Error {
	constructor() {
		super("Device code expired")
		this.name = "ExpiredTokenError"
	}
}

export class AccessDeniedError extends Error {
	constructor() {
		super("Access denied by user")
		this.name = "AccessDeniedError"
	}
}

export class SlowDownError extends Error {
	constructor(public readonly retryAfterSec: number) {
		super(`Slow down — retry after ${retryAfterSec}s`)
		this.name = "SlowDownError"
	}
}

async function post<T>(
	path: string,
	body: Record<string, unknown>,
	fetchImpl: typeof fetch = globalThis.fetch
): Promise<T> {
	const authBaseUrl = resolveAuthBaseUrl()
	const res = await fetchImpl(`${authBaseUrl}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }

		if (res.status === 400) {
			if (err.error === "authorization_pending") return res.json() as Promise<T>
		}

		throw new Error(`device-auth ${path} failed: ${res.status} ${JSON.stringify(err)}`)
	}

	return res.json() as T
}

async function get<T>(path: string, fetchImpl: typeof fetch = globalThis.fetch): Promise<T> {
	const authBaseUrl = resolveAuthBaseUrl()
	const res = await fetchImpl(`${authBaseUrl}${path}`)

	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }))

		if (res.status === 400) {
			const code = (body as { error?: string }).error
			if (code === "expired_token") throw new ExpiredTokenError()
			if (code === "access_denied") throw new AccessDeniedError()
			if (code === "slow_down") {
				const retryAfter = Number((body as { retry_after?: number }).retry_after ?? 5)
				throw new SlowDownError(retryAfter)
			}
			if (code === "authorization_pending") {
				const err = new Error(`device-auth ${path} returned ${res.status} ${JSON.stringify(body)}`) as Error & {
					code?: string
				}
				err.code = "authorization_pending"
				throw err
			}
		}

		throw new Error(`device-auth ${path} failed: ${res.status} ${JSON.stringify(body)}`)
	}

	return res.json() as T
}

export async function requestDeviceCode(params: {
	clientId: string
	scope?: string
	fetchImpl?: typeof fetch
}): Promise<DeviceCodeResponse> {
	return post<DeviceCodeResponse>(
		"/api/device-auth/codes",
		{
			client_id: params.clientId,
			...(params.scope ? { scope: params.scope } : {}),
		},
		params.fetchImpl
	)
}

export async function pollForApproval(params: {
	deviceCode: string
	intervalSec?: number
	/**
	 * How long, in seconds *from now*, the device code stays valid before
	 * polling gives up. This is a relative TTL, NOT an absolute epoch
	 * deadline — `pollForApproval` computes the wall-clock deadline itself so
	 * callers cannot get the units wrong. Defaults to 600s (10 minutes).
	 */
	expiresInSec?: number
	signal?: AbortSignal
	fetchImpl?: typeof fetch
}): Promise<TokenResponse> {
	const intervalMs = (params.intervalSec ?? 3) * 1000
	const ttlSec = params.expiresInSec ?? 600
	const deadline = Date.now() + ttlSec * 1000
	const fetchImpl = params.fetchImpl ?? globalThis.fetch

	while (!params.signal?.aborted && Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, intervalMs))

		try {
			const result = await get<TokenResponse>(
				`/api/device-auth/codes/${params.deviceCode}`,
				fetchImpl
			)
			return result
		} catch (err) {
			if (err instanceof AccessDeniedError || err instanceof ExpiredTokenError) throw err

			// authorization_pending is not an error — it's the expected interim state during polling.
			const typed = err as { code?: string }
			if (typed.code === "authorization_pending") continue

			if (err instanceof SlowDownError) {
				await new Promise((r) => setTimeout(r, err.retryAfterSec * 1000))
				continue
			}

			throw err
		}
	}

	throw new ExpiredTokenError()
}

export async function deny(_deviceCode: string): Promise<void> {
	log.debug("No deny endpoint on cloud side; skipping device-code denial")
}
