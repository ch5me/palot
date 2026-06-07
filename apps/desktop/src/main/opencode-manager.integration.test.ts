import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { mock, spyOn, test } from "bun:test"

const originalEnv = { ...process.env }

function setupTempXdg() {
	const root = mkdtempSync(path.join(tmpdir(), "elf-opencode-manager-"))
	process.env.XDG_CONFIG_HOME = path.join(root, "config")
	process.env.XDG_DATA_HOME = path.join(root, "data")
	return () => {
		rmSync(root, { recursive: true, force: true })
		for (const key of Object.keys(process.env)) {
			if (!(key in originalEnv)) delete process.env[key]
		}
		Object.assign(process.env, originalEnv)
	}
}

test("managed server spawn injects Palot plugin env and bridge transport", async () => {
	const cleanup = setupTempXdg()
	const originalFetch = globalThis.fetch
	const spawnCalls: Array<{
		command: string
		args: string[]
		options: { cwd?: string; env?: NodeJS.ProcessEnv; stdio?: string }
	}> = []

	const childProcess = await import("node:child_process")
	const spawnMock = spyOn(childProcess, "spawn").mockImplementation(
		(command: string, args: readonly string[], options?: { cwd?: string; env?: NodeJS.ProcessEnv; stdio?: string }) => {
			spawnCalls.push({ command, args: [...args], options: options ?? {} })
			return {
				pid: 4242,
				stdout: { on: () => undefined },
				stderr: { on: () => undefined },
				on: () => undefined,
				kill: () => true,
			} as unknown as ReturnType<typeof childProcess.spawn>
		},
	)
	const execFileMock = spyOn(childProcess, "execFile").mockImplementation(
		(
			_cmd: string,
			_args: readonly string[],
			callback: ((err: Error | null, stdout: string, stderr: string) => void) | undefined,
		) => {
			callback?.(null, "", "")
			return {} as ReturnType<typeof childProcess.execFile>
		},
	)
	mock.module("./shell-env", () => ({ waitForEnv: async () => undefined }))
	mock.module("./credential-store", () => ({ getCredential: () => null }))
	mock.module("./process-owner", () => ({
		getListeningProcessOwner: async () => null,
		isCurrentUser: () => true,
		isProcessAlive: () => false,
	}))
	mock.module("./notification-watcher", () => ({
		startNotificationWatcher: () => undefined,
		stopNotificationWatcher: () => undefined,
	}))

	globalThis.fetch = (async (input: string | URL | Request) => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
		if (url.includes("/session")) {
			return new Response(JSON.stringify([]), {
				status: 200,
				headers: { "content-type": "application/json" },
			})
		}
		throw new Error(`Unexpected fetch: ${url}`)
	}) as typeof fetch

	try {
		mock.module("electron", () => ({
			default: {
				BrowserWindow: { getAllWindows: () => [] },
				dialog: { showMessageBox: async () => ({ response: 0 }) },
			},
		}))
		const manager = await import("./opencode-manager")
		const server = await manager.ensureServer()
		assert.equal(server.managed, true)
		assert.equal(server.pid, 4242)
		assert.equal(spawnCalls.length, 1)
		const spawnCall = spawnCalls[0]
		assert.equal(spawnCall.command, "opencode")
		assert.ok(spawnCall.args.includes("serve"))
		assert.equal(spawnCall.options.stdio, "pipe")
		assert.ok(spawnCall.options.env?.OPENCODE_PLUGIN)
		assert.ok(
			spawnCall.options.env?.OPENCODE_PLUGIN?.includes(
				path.join("apps", "desktop", "src", "main", "palot-plugin-entry.js"),
			),
		)
		assert.ok(spawnCall.options.env?.PALOT_BRIDGE_URL)
		assert.ok(spawnCall.options.env?.PALOT_BRIDGE_TOKEN)

		const configPath = path.join(
			process.env.HOME ?? "",
			".config",
			"opencode",
			"opencode.jsonc",
		)
		assert.equal(spawnCall.options.cwd, process.env.HOME)
		const configText = await import("node:fs").then((fs) => fs.readFileSync(configPath, "utf-8"))
		assert.ok(configText.includes("palot-bridge.js"))
		assert.equal(manager.getServerUrl(), "http://127.0.0.1:4096")
	} finally {
		globalThis.fetch = originalFetch
		spawnMock.mockRestore()
		execFileMock.mockRestore()
		cleanup()
	}
})
