import { beforeEach, describe, expect, it, mock } from "bun:test"
import fs from "node:fs"

const mockGetPath = mock(() => "/tmp/elf-user-data")
const mockDecrypt = mock(async (value: Buffer) => value.toString("utf8"))
const mockEncrypt = mock(async (value: string) => Buffer.from(value, "utf8"))

mock.module("electron", () => ({
	app: {
		getPath: mockGetPath,
	},
}))

mock.module("./vault", () => ({
	encrypt: mockEncrypt,
	decrypt: mockDecrypt,
}))

const persistedState = {
	accessToken: "token-123",
	refreshToken: null,
	expiresAt: 0,
	elfUserId: "user-1",
	issuer: "issuer",
	audience: "audience",
}

describe("createElfTokenStore", () => {
	beforeEach(async () => {
		mockGetPath.mockReset()
		mockGetPath.mockReturnValue("/tmp/elf-user-data")
		mockDecrypt.mockReset()
		mockDecrypt.mockImplementation(async (value: Buffer) => value.toString("utf8"))
		mockEncrypt.mockReset()
		mockEncrypt.mockImplementation(async (value: string) => Buffer.from(value, "utf8"))
		const mod = await import("./token-store")
		mod.resetTokenStoreForTests()
	})

	it("clears expired persisted state before returning auth header", async () => {
		const existsSpy = mock((path: string) => path === "/tmp/elf-user-data/auth-state.bin")
		const readSpy = mock(() => Buffer.from(JSON.stringify(persistedState), "utf8"))
		const unlinkSpy = mock(() => undefined)
		const mkdirSpy = mock(() => undefined)
		const writeSpy = mock(() => undefined)
		const renameSpy = mock(() => undefined)

		const originalExistsSync = fs.existsSync
		const originalReadFileSync = fs.readFileSync
		const originalUnlinkSync = fs.unlinkSync
		const originalMkdirSync = fs.mkdirSync
		const originalWriteFileSync = fs.writeFileSync
		const originalRenameSync = fs.renameSync

		fs.existsSync = existsSpy as typeof fs.existsSync
		fs.readFileSync = readSpy as typeof fs.readFileSync
		fs.unlinkSync = unlinkSpy as typeof fs.unlinkSync
		fs.mkdirSync = mkdirSpy as typeof fs.mkdirSync
		fs.writeFileSync = writeSpy as typeof fs.writeFileSync
		fs.renameSync = renameSpy as typeof fs.renameSync

		const realNow = Date.now
		Date.now = () => 2_000_000

		try {
			const { createElfTokenStore } = await import("./token-store")
			const store = createElfTokenStore()
			const header = await store.getAuthHeader()
			const state = await store.getState()

			expect(header).toBeNull()
			expect(state).toBeNull()
			expect(unlinkSpy).toHaveBeenCalledTimes(1)
		} finally {
			fs.existsSync = originalExistsSync
			fs.readFileSync = originalReadFileSync
			fs.unlinkSync = originalUnlinkSync
			fs.mkdirSync = originalMkdirSync
			fs.writeFileSync = originalWriteFileSync
			fs.renameSync = originalRenameSync
			Date.now = realNow
		}
	})
})
