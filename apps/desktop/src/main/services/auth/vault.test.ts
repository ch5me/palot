import { beforeEach, describe, expect, it, vi } from "bun:test"

// Top-level mock — Bun test hoists vi.mock but only at the module level, not inside beforeEach.
const mockSafeStorage = {
	isEncryptionAvailable: vi.fn(),
	encryptString: vi.fn(),
	decryptString: vi.fn(),
	encryptStringAsync: vi.fn(),
	decryptStringAsync: vi.fn(),
	getSelectedStorageBackend: vi.fn(),
}

vi.mock("electron", () => ({
	safeStorage: mockSafeStorage,
}))

let classifyBackend: () => ReturnType<typeof import("./vault").classifyBackend>
let assertProductionSafe: () => void
let encrypt: (p: string) => Promise<Buffer>
let decrypt: (c: Buffer) => Promise<string>

beforeEach(async () => {
	mockSafeStorage.isEncryptionAvailable.mockReset().mockReturnValue(true)
	mockSafeStorage.encryptString.mockReset().mockReturnValue(Buffer.from("encrypted-sync"))
	mockSafeStorage.decryptString.mockReset().mockReturnValue("decrypted-sync")
	mockSafeStorage.encryptStringAsync.mockReset().mockResolvedValue(Buffer.from("encrypted-async"))
	mockSafeStorage.decryptStringAsync.mockReset().mockResolvedValue("decrypted-async")
	mockSafeStorage.getSelectedStorageBackend.mockReset().mockReturnValue("os_keyring")

	// Dynamic re-import so each test gets fresh module evaluation with current mocks
	const vault = await import("./vault")
	classifyBackend = vault.classifyBackend
	assertProductionSafe = vault.assertProductionSafe
	encrypt = vault.encrypt
	decrypt = vault.decrypt
})

describe("classifyBackend", () => {
	it("returns os_keyring when configured", () => {
		mockSafeStorage.getSelectedStorageBackend.mockReturnValue("os_keyring")
		expect(classifyBackend()).toBe("os_keyring")
	})

	it("returns basic_text when keyring is absent", () => {
		mockSafeStorage.getSelectedStorageBackend.mockReturnValue("basic_text")
		expect(classifyBackend()).toBe("basic_text")
	})

	it("returns os_keyring for any non-basic_text backend", () => {
		mockSafeStorage.getSelectedStorageBackend.mockReturnValue("magic_backend")
		expect(classifyBackend()).toBe("os_keyring")
	})
})

describe("assertProductionSafe", () => {
	it("throws in production with basic_text backend", () => {
		mockSafeStorage.getSelectedStorageBackend.mockReturnValue("basic_text")
		const prev = process.env.NODE_ENV
		process.env.NODE_ENV = "production"
		try {
			expect(assertProductionSafe).toThrow()
		} finally {
			process.env.NODE_ENV = prev
		}
	})

	it("warns but does not throw in development with basic_text", () => {
		mockSafeStorage.getSelectedStorageBackend.mockReturnValue("basic_text")
		const prev = process.env.NODE_ENV
		process.env.NODE_ENV = "development"
		try {
			expect(assertProductionSafe).not.toThrow()
		} finally {
			process.env.NODE_ENV = prev
		}
	})

	it("does not throw in production with os_keyring", () => {
		mockSafeStorage.getSelectedStorageBackend.mockReturnValue("os_keyring")
		const prev = process.env.NODE_ENV
		process.env.NODE_ENV = "production"
		try {
			expect(assertProductionSafe).not.toThrow()
		} finally {
			process.env.NODE_ENV = prev
		}
	})
})

describe("encrypt", () => {
	it("calls async method when available", async () => {
		await encrypt("hello world")
		expect(mockSafeStorage.encryptStringAsync).toHaveBeenCalledWith("hello world")
		expect(mockSafeStorage.encryptString).not.toHaveBeenCalled()
	})

	it("falls back to sync when async is absent", async () => {
		const original = mockSafeStorage.encryptStringAsync
		// @ts-expect-error intentional absence for fallback test
		mockSafeStorage.encryptStringAsync = undefined

		const result = await encrypt("hello world")
		expect(mockSafeStorage.encryptString).toHaveBeenCalledWith("hello world")
		expect(result).toEqual(Buffer.from("encrypted-sync"))

		mockSafeStorage.encryptStringAsync = original
	})

	it("refuses to encrypt in production with basic_text backend", async () => {
		mockSafeStorage.getSelectedStorageBackend.mockReturnValue("basic_text")
		const prev = process.env.NODE_ENV
		process.env.NODE_ENV = "production"
		try {
			await expect(encrypt("hello")).rejects.toThrow()
		} finally {
			process.env.NODE_ENV = prev
		}
	})
})

describe("decrypt", () => {
	it("calls async method when available", async () => {
		const buf = Buffer.from("encrypted-async")
		await decrypt(buf)
		expect(mockSafeStorage.decryptStringAsync).toHaveBeenCalledWith(buf)
		expect(mockSafeStorage.decryptString).not.toHaveBeenCalled()
	})

	it("falls back to sync when async is absent", async () => {
		const original = mockSafeStorage.decryptStringAsync
		// @ts-expect-error intentional absence for fallback test
		mockSafeStorage.decryptStringAsync = undefined

		const buf = Buffer.from("encrypted-sync")
		const result = await decrypt(buf)
		expect(mockSafeStorage.decryptString).toHaveBeenCalledWith(buf)
		expect(result).toBe("decrypted-sync")

		mockSafeStorage.decryptStringAsync = original
	})
})
