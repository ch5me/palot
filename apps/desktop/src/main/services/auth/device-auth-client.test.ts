import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test"

const mockFetch = Object.assign(vi.fn<typeof fetch>(), {
	preconnect: () => {},
}) as unknown as ReturnType<typeof vi.fn<typeof fetch>> & typeof fetch

async function loadClient() {
	return import("./device-auth-client")
}

beforeEach(() => {
	mockFetch.mockReset()
	delete process.env.FIREFLY_AUTH_HOST
	delete process.env.VITE_FIREFLY_AUTH_HOST
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe("requestDeviceCode", () => {
	it("POSTs to /api/device-auth/codes with client_id", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					deviceCode: "dc-123",
					userCode: "ABCD-1234",
					verificationUri: "https://auth.elf.dance/verify",
					verificationUriComplete: "https://auth.elf.dance/verify?user_code=ABCD-1234",
					expiresIn: 600,
					interval: 3,
				}),
				{ status: 200, headers: { "content-type": "application/json" } }
			)
		)

		const { requestDeviceCode } = await loadClient()
		const result = await requestDeviceCode({
			clientId: "test-client",
			scope: "openid",
			fetchImpl: mockFetch,
		})

		expect(result.deviceCode).toBe("dc-123")
		expect(result.userCode).toBe("ABCD-1234")
		expect(result.expiresIn).toBe(600)
		expect(mockFetch).toHaveBeenCalledTimes(1)

		const [url, init] = mockFetch.mock.calls[0]
		expect(url).toContain("/api/device-auth/codes")
		expect(init?.method).toBe("POST")
		const body = JSON.parse(init?.body as string)
		expect(body.client_id).toBe("test-client")
		expect(body.scope).toBe("openid")
	})
})

describe("pollForApproval", () => {
	it("polls until token received", async () => {
		mockFetch
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ error: "authorization_pending" }), {
					status: 400,
					headers: { "content-type": "application/json" },
				})
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						accessToken: "test-token",
						refreshToken: "test-refresh",
						expiresIn: 3600,
						elfUserId: "user-123",
						issuer: "https://auth.elf.dance",
						audience: "https://api.elf.dance",
					}),
					{ status: 200, headers: { "content-type": "application/json" } }
				)
			)

		const { pollForApproval } = await loadClient()
		const result = await pollForApproval({
			deviceCode: "dc-123",
			intervalSec: 0,
			expiresAtSec: Math.floor(Date.now() / 1000) + 60,
			fetchImpl: mockFetch,
		})

		expect(result.accessToken).toBe("test-token")
		expect(result.elfUserId).toBe("user-123")
		expect(mockFetch).toHaveBeenCalledTimes(2)
	})

	it("throws ExpiredTokenError on expired_token", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ error: "expired_token" }), {
				status: 400,
				headers: { "content-type": "application/json" },
			})
		)

		const { pollForApproval, ExpiredTokenError } = await loadClient()
		await expect(
			pollForApproval({
				deviceCode: "dc-123",
				intervalSec: 0,
				expiresAtSec: Math.floor(Date.now() / 1000) + 60,
				fetchImpl: mockFetch,
			})
		).rejects.toThrow(ExpiredTokenError)
	})

	it("throws AccessDeniedError on access_denied", async () => {
		mockFetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ error: "access_denied" }), {
				status: 400,
				headers: { "content-type": "application/json" },
			})
		)

		const { pollForApproval, AccessDeniedError } = await loadClient()
		await expect(
			pollForApproval({
				deviceCode: "dc-123",
				intervalSec: 0,
				expiresAtSec: Math.floor(Date.now() / 1000) + 60,
				fetchImpl: mockFetch,
			})
		).rejects.toThrow(AccessDeniedError)
	})
})
