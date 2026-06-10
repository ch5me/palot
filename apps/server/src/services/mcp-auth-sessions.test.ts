import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"
import { getMcpAuthSessionStatus } from "./mcp-auth-sessions"

test("expired auth session returns expired and cleans stale artifacts", async () => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-auth-test-"))
	process.env.ELF_MCP_AUTH_STATE_DIR = dir
	const stateFile = path.join(dir, "expired.json")
	const runnerFile = path.join(dir, "runner-expired.cjs")
	const logFile = path.join(dir, "expired.log")
	fs.writeFileSync(
		stateFile,
		JSON.stringify({
			name: "expired",
			startedAt: Date.now() - 11 * 60 * 1000,
			status: "waiting",
			authorizeUrl: "https://example.com/auth",
			message: "Waiting",
			pid: null,
			stateFile,
		}),
	)
	fs.writeFileSync(runnerFile, "runner")
	fs.writeFileSync(logFile, "log")

	const result = await getMcpAuthSessionStatus("expired")
	assert.equal(result.status, "expired")
	assert.equal(fs.existsSync(stateFile), false)
	assert.equal(fs.existsSync(runnerFile), false)
	assert.equal(fs.existsSync(logFile), false)
})
