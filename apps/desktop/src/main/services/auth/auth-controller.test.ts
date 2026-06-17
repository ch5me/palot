import { beforeEach, describe, expect, it, mock } from "bun:test"

// Capture what the device-auth-client receives so we can assert the clientId
// flows all the way from the caller into the device-code request body
// (CH5COMPAC4C-299: it used to arrive as `undefined`).
const requestDeviceCodeCalls: Array<{ clientId: string }> = []

mock.module("./device-auth-client", () => ({
	requestDeviceCode: mock(async (params: { clientId: string }) => {
		requestDeviceCodeCalls.push({ clientId: params.clientId })
		return {
			deviceCode: "dc-test",
			userCode: "ABCD-1234",
			verificationUri: "https://app.elf.dance/verify",
			verificationUriComplete: "https://app.elf.dance/verify?user_code=ABCD-1234",
			expiresIn: 600,
			interval: 3,
		}
	}),
	pollForApproval: mock(async () => {
		throw new Error("not exercised in this test")
	}),
	ExpiredTokenError: class ExpiredTokenError extends Error {},
	AccessDeniedError: class AccessDeniedError extends Error {},
}))

// Keep the token store inert — startSignIn does not touch persistence.
mock.module("./token-store", () => ({
	getOrCreateTokenStore: () => ({
		getState: async () => null,
		setState: async () => {},
		clearToken: async () => {},
	}),
}))

async function loadController() {
	return import("./auth-controller")
}

beforeEach(() => {
	requestDeviceCodeCalls.length = 0
})

describe("startSignIn clientId passthrough (CH5COMPAC4C-299)", () => {
	it("forwards the provided clientId into the device-code request", async () => {
		const { startSignIn } = await loadController()

		const ui = await startSignIn("firefly-desktop")

		expect(ui.userCode).toBe("ABCD-1234")
		expect(requestDeviceCodeCalls).toHaveLength(1)
		// The real client id reaches requestDeviceCode (and therefore the
		// `client_id` field of the POST body), not `undefined`.
		expect(requestDeviceCodeCalls[0]?.clientId).toBe("firefly-desktop")
	})

	it("trims surrounding whitespace before forwarding the clientId", async () => {
		const { startSignIn } = await loadController()

		await startSignIn("  firefly-desktop  ")

		expect(requestDeviceCodeCalls[0]?.clientId).toBe("firefly-desktop")
	})

	it("refuses to start sign-in when no clientId is supplied (regression guard)", async () => {
		const { startSignIn } = await loadController()

		// The old IPC handler passed `undefined` straight through, which the auth
		// host could 400 on silently. Now a missing/blank id fails fast and loud,
		// before any device-code request is made.
		await expect(startSignIn(undefined)).rejects.toThrow(/client id is required/i)
		await expect(startSignIn("   ")).rejects.toThrow(/client id is required/i)
		expect(requestDeviceCodeCalls).toHaveLength(0)
	})
})
