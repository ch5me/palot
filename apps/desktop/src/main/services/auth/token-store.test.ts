import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const userDataPath = "/tmp/palot-token-store-tests"
const authStatePath = `${userDataPath}/auth-state.bin`
const fsState = new Map<string, Buffer>()
const mockEncrypt = mock(async (plaintext: string) => Buffer.from(plaintext, "utf-8"))
const mockDecrypt = mock(async (ciphertext: Buffer) => ciphertext.toString("utf-8"))

mock.module("electron", () => ({
	app: {
		getPath: () => userDataPath,
	},
}))

mock.module("./vault", () => ({
	encrypt: mockEncrypt,
	decrypt: mockDecrypt,
}))

mock.module("node:fs", () => ({
	default: {
		existsSync: (target: string) => {
			if (target === userDataPath) return true
			return fsState.has(target)
		},
		readFileSync: (target: string) => {
			const value = fsState.get(target)
			if (!value) throw new Error(`ENOENT: ${target}`)
			return Buffer.from(value)
		},
		writeFileSync: (target: string, data: Buffer | string) => {
			fsState.set(target, Buffer.isBuffer(data) ? Buffer.from(data) : Buffer.from(data, "utf-8"))
		},
		renameSync: (from: string, to: string) => {
			const value = fsState.get(from)
			if (!value) throw new Error(`ENOENT: ${from}`)
			fsState.set(to, value)
			fsState.delete(from)
		},
		unlinkSync: (target: string) => {
			fsState.delete(target)
		},
		mkdirSync: () => {},
	},
}))

const tokenStoreModule = await import("./token-store")
const { createElfTokenStore, resetTokenStoreForTests } = tokenStoreModule

describe("token-store", () => {
	beforeEach(() => {
		fsState.clear()
		mockEncrypt.mockClear()
		mockDecrypt.mockClear()
		resetTokenStoreForTests()
	})

	afterEach(() => {
		resetTokenStoreForTests()
	})

	it("drops expired state loaded from disk before exposing it", async () => {
		fsState.set(
			authStatePath,
			Buffer.from(
				JSON.stringify({
					accessToken: "expired-access",
					refreshToken: "expired-refresh",
					expiresAt: Math.floor(Date.now() / 1000) - 5,
					elfUserId: "elf-user",
					issuer: "issuer",
					audience: "audience",
				}),
				"utf-8",
			),
		)

		const store = createElfTokenStore()
		expect(await store.getState()).toBeNull()
		expect(await store.getAuthHeader()).toBeNull()
		expect(fsState.has(authStatePath)).toBe(false)
	})

	it("evicts an expired in-memory cache entry on the next read", async () => {
		const store = createElfTokenStore()
		await store.setState({
			accessToken: "still-valid",
			refreshToken: "refresh",
			expiresAt: Math.floor(Date.now() / 1000) + 60,
			elfUserId: "elf-user",
			issuer: "issuer",
			audience: "audience",
		})

		const realNow = Date.now
		Date.now = () => realNow() + 120_000
		try {
			expect(await store.getState()).toBeNull()
			expect(await store.getAuthHeader()).toBeNull()
			expect(fsState.has(authStatePath)).toBe(false)
		} finally {
			Date.now = realNow
		}
	})

	it("refuses to persist already-expired state", async () => {
		const store = createElfTokenStore()
		await store.setState({
			accessToken: "already-expired",
			refreshToken: null,
			expiresAt: Math.floor(Date.now() / 1000) - 1,
			elfUserId: "elf-user",
			issuer: "issuer",
			audience: "audience",
		})

		expect(await store.getState()).toBeNull()
		expect(fsState.has(authStatePath)).toBe(false)
	})
})
