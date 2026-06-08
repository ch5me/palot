import { describe, expect, it } from "bun:test"

// Token-store uses electron.main and node:fs — cannot run in bun test environment.
// These functions are tested via the Electron main-process IPC integration test.
describe.skip("token-store", () => {
	it("placeholder — tested in Electron IPC integration test", () => {
		expect(true).toBe(true)
	})
})
