import { describe, expect, it } from "bun:test"

describe("device-auth-client env contract", () => {
	it("requires an auth host env var", async () => {
		const originalHost = process.env.FIREFLY_AUTH_HOST
		const originalViteHost = process.env.VITE_FIREFLY_AUTH_HOST

		try {
			delete process.env.FIREFLY_AUTH_HOST
			delete process.env.VITE_FIREFLY_AUTH_HOST
			const modulePath = new URL("./device-auth-client.ts", import.meta.url).href
			const imported = await import(`${modulePath}?missing-host=${Date.now()}`)

			await expect(imported.requestDeviceCode({ clientId: "desktop" })).rejects.toThrow(
				"FIREFLY_AUTH_HOST is required for desktop auth flows",
			)
		} finally {
			if (originalHost === undefined) delete process.env.FIREFLY_AUTH_HOST
			else process.env.FIREFLY_AUTH_HOST = originalHost
			if (originalViteHost === undefined) delete process.env.VITE_FIREFLY_AUTH_HOST
			else process.env.VITE_FIREFLY_AUTH_HOST = originalViteHost
		}
	})
})
