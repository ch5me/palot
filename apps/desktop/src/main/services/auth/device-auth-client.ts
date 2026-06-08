const AUTH_HOST =
	process.env.FIREFLY_AUTH_HOST ??
	process.env.VITE_FIREFLY_AUTH_HOST ??
	"auth.elf.dance"

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

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
	const res = await fetch(`${AUTH_HOST}${path}`, {
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

async function get<T>(path: string): Promise<T> {
	const res = await fetch(`${AUTH_HOST}${path}`)

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
				const err = new Error(`device-auth ${path} returned ${res.status} ${JSON.stringify(body)}`)
				// @ts-ignore - attach discriminator for pollForApproval's catch
				;(err as unknown as { code: string }).code = "authorization_pending"
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
}): Promise<DeviceCodeResponse> {
	return post<DeviceCodeResponse>("/api/device-auth/codes", {
		client_id: params.clientId,
		...(params.scope ? { scope: params.scope } : {}),
	})
}

export async function pollForApproval(params: {
	deviceCode: string
	intervalSec?: number
	expiresAtSec?: number
	signal?: AbortSignal
}): Promise<TokenResponse> {
	const intervalMs = (params.intervalSec ?? 3) * 1000
	const deadline = params.expiresAtSec ? params.expiresAtSec * 1000 : Date.now() + 600_000

	while (!params.signal?.aborted && Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, intervalMs))

		try {
			const result = await get<TokenResponse>(`/api/device-auth/codes/${params.deviceCode}`)
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
// No deny endpoint on the cloud side — if one is added, wire it here.
}
