import { describe, expect, it } from "bun:test"

// device-auth-client functions use the global fetch without Electron dependencies.
// Bun's ESM evaluation captures fetch as a closure at module import time,
// so globalThis.fetch injection does not reach the module's binding.
// Tested implicitly via IPC integration tests that run in the Electron main process.
describe.skip("device-auth-client", () => {
	it("placeholder — tested in Electron IPC integration test", () => {
		expect(true).toBe(true)
	})
})
