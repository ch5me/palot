/**
 * Unit tests for the exported installArgsSchema (C1 — install contract).
 *
 * The schema is module-level and exported, so it can be tested without
 * constructing any Electron IPC handlers.
 *
 * Mocks must be declared before the dynamic import so Bun hoists them correctly.
 */
import { describe, expect, mock, test } from "bun:test"

// Mock Electron before importing the module under test.
// BrowserWindow and app are needed by transitive imports.
mock.module("electron", () => ({
	ipcMain: { handle: () => {} },
	app: { getPath: () => "/tmp", isPackaged: false, on: () => {} },
	BrowserWindow: {
		getAllWindows: () => [],
		fromWebContents: () => null,
	},
}))

// Mock the heavy host-authority chain — the test only exercises the schema.
mock.module("./host-authority", () => ({
	ElectronHostAuthority: class {},
}))

const { installArgsSchema } = await import("./ipc")

describe("installArgsSchema — open-vsx member", () => {
	test("valid input parses", () => {
		const result = installArgsSchema.parse({
			kind: "open-vsx",
			namespace: "acme",
			name: "my-ext",
			version: "1.0.0",
		})
		expect(result.kind).toBe("open-vsx")
	})

	test("consentedCapabilities present → retained", () => {
		const result = installArgsSchema.parse({
			kind: "open-vsx",
			namespace: "acme",
			name: "my-ext",
			consentedCapabilities: ["fs:write"],
		})
		expect(result.consentedCapabilities).toEqual(["fs:write"])
	})

	test("consentedCapabilities absent → undefined", () => {
		const result = installArgsSchema.parse({
			kind: "open-vsx",
			namespace: "acme",
			name: "my-ext",
		})
		expect(result.consentedCapabilities).toBeUndefined()
	})

	test("non-string element in consentedCapabilities is rejected", () => {
		expect(() =>
			installArgsSchema.parse({
				kind: "open-vsx",
				namespace: "acme",
				name: "my-ext",
				consentedCapabilities: [42],
			}),
		).toThrow()
	})
})

describe("installArgsSchema — local-vsix member", () => {
	test("valid input parses", () => {
		const result = installArgsSchema.parse({
			kind: "local-vsix",
			vsixPath: "/tmp/my-ext.vsix",
		})
		expect(result.kind).toBe("local-vsix")
	})

	test("consentedCapabilities present → retained", () => {
		const result = installArgsSchema.parse({
			kind: "local-vsix",
			vsixPath: "/tmp/my-ext.vsix",
			consentedCapabilities: ["net:http"],
		})
		expect(result.consentedCapabilities).toEqual(["net:http"])
	})

	test("consentedCapabilities absent → undefined", () => {
		const result = installArgsSchema.parse({
			kind: "local-vsix",
			vsixPath: "/tmp/my-ext.vsix",
		})
		expect(result.consentedCapabilities).toBeUndefined()
	})

	test("non-string element in consentedCapabilities is rejected", () => {
		expect(() =>
			installArgsSchema.parse({
				kind: "local-vsix",
				vsixPath: "/tmp/my-ext.vsix",
				consentedCapabilities: [null],
			}),
		).toThrow()
	})
})

describe("installArgsSchema — firefly member", () => {
	test("valid firefly input parses", () => {
		const result = installArgsSchema.parse({
			kind: "firefly",
			namespace: "ch5",
			name: "code-ext",
			version: "2.1.0",
		})
		expect(result.kind).toBe("firefly")
	})

	test("firefly + consentedCapabilities parses and retains", () => {
		const result = installArgsSchema.parse({
			kind: "firefly",
			namespace: "ch5",
			name: "code-ext",
			consentedCapabilities: ["fs:write", "net:http"],
		})
		expect(result.consentedCapabilities).toEqual(["fs:write", "net:http"])
	})

	test("firefly consentedCapabilities absent → undefined", () => {
		const result = installArgsSchema.parse({
			kind: "firefly",
			namespace: "ch5",
			name: "code-ext",
		})
		expect(result.consentedCapabilities).toBeUndefined()
	})

	test("non-string element in firefly consentedCapabilities is rejected", () => {
		expect(() =>
			installArgsSchema.parse({
				kind: "firefly",
				namespace: "ch5",
				name: "code-ext",
				consentedCapabilities: [{ bad: true }],
			}),
		).toThrow()
	})
})

describe("installArgsSchema — unknown kind rejected", () => {
	test("unknown kind throws", () => {
		expect(() =>
			installArgsSchema.parse({
				kind: "unknown-registry",
				namespace: "acme",
				name: "my-ext",
			}),
		).toThrow()
	})
})
