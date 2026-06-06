import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

const mockExecFileAsync = mock(async () => ({ stdout: JSON.stringify({ servers: [{ status: "ok" }] }) }))
const mockUpsertConfig = mock(() => ({ notifications: { completionMode: "unfocused", permissions: true, questions: true, errors: true, dockBadge: true }, opaqueWindows: false, servers: { servers: [], activeServerId: "local" }, connections: {} }))
const mockGetServerUrl = mock(() => null)
const mockDispose = mock(async () => {})
const settingsState: {
	connections: {
		connectionRecordsPath?: string
	}
} = {
	connections: {},
}
const mockUpdateSettings = mock((partial: { connections?: { connectionRecordsPath?: string } }) => {
	if (partial.connections?.connectionRecordsPath) {
		settingsState.connections.connectionRecordsPath = partial.connections.connectionRecordsPath
	}
	return settingsState
})

mock.module("node:child_process", () => ({
	execFile: (
		_file: string,
		_args: string[],
		optionsOrCallback:
			| Record<string, unknown>
			| ((error: Error | null, stdout: string, stderr: string) => void),
		maybeCallback?: (error: Error | null, stdout: string, stderr: string) => void,
	) => {
		const callback =
			typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback
		if (!callback) {
			throw new Error("execFile callback missing in test stub")
		}
		mockExecFileAsync()
			.then((result) => callback(null, result.stdout, ""))
			.catch((error: Error) => callback(error, "", ""))
	},
}))

mock.module("electron", () => ({
	app: {
		getPath: () => "/tmp/palot-mcp-runtime-tests",
	},
}))

mock.module("./mcp-connections-config", () => ({
	upsertMcpConnectionConfig: mockUpsertConfig,
}))

mock.module("./opencode-manager", () => ({
	getServerUrl: mockGetServerUrl,
}))

mock.module("@opencode-ai/sdk/v2/client", () => ({
	createOpencodeClient: () => ({
		global: {
			dispose: mockDispose,
		},
	}),
}))

mock.module("./settings-store", () => ({
	getSettings: () => settingsState,
	updateSettings: mockUpdateSettings,
}))

const runtimeModule = await import("./mcp-connections-runtime")
const { listMcpConnectionRecords, registerMcpConnection } = runtimeModule

const fs = await import("node:fs")

const recordsPath = "/tmp/palot-mcp-runtime-tests/mcp-connection-records.json"

describe("mcp-connections-runtime", () => {
	beforeEach(() => {
		settingsState.connections.connectionRecordsPath = recordsPath
		fs.rmSync("/tmp/palot-mcp-runtime-tests", { recursive: true, force: true })
		mockExecFileAsync.mockReset()
		mockExecFileAsync.mockResolvedValue({ stdout: JSON.stringify({ servers: [{ status: "ok" }] }) })
		mockUpsertConfig.mockClear()
		mockGetServerUrl.mockReset()
		mockGetServerUrl.mockReturnValue(null)
		mockDispose.mockClear()
		mockUpdateSettings.mockClear()
	})

	afterEach(() => {
		fs.rmSync("/tmp/palot-mcp-runtime-tests", { recursive: true, force: true })
	})

	test("registerMcpConnection derives gateway defaults for cloud ownership", async () => {
		await registerMcpConnection({
			name: "github",
			transport: "remote-http",
			target: "https://example.com/mcp",
			ownershipMode: "cloud-only",
			source: "registry",
		})

		const [record] = listMcpConnectionRecords()
		expect(record.name).toBe("github")
		expect(record.ownershipMode).toBe("cloud-only")
		expect(record.canonicalStore).toBe("gateway")
		expect(record.restorePolicy).toBe("reproject_and_reauth_if_needed")
		expect(record.credentialMode).toBe("cloud-disposable")
		expect(record.scope).toBe("home")
		expect(record.status).toBe("configured")
		expect(record.runtimeState).toBe("projected")
		expect(record.metadata).toEqual({ source: "registry" })
		expect(record.projectedOpenCode).toEqual({ type: "remote", url: "https://example.com/mcp" })
		expect(mockUpsertConfig).toHaveBeenCalledWith({
			name: "github",
			config: { type: "remote", url: "https://example.com/mcp" },
		})
	})

	test("registerMcpConnection writes canonical ownership metadata to disk", async () => {
		await registerMcpConnection({
			name: "notion",
			transport: "remote-http",
			target: "https://notion.example/mcp",
			ownershipMode: "cloud-only",
			canonicalStore: "gateway",
			restorePolicy: "reproject_and_reauth_if_needed",
			source: "curated",
			metadata: { imported: true },
		})

		const rawRecords = fs.readFileSync(recordsPath, "utf-8")
		expect(rawRecords).toContain("\"canonicalStore\": \"gateway\"")
		expect(rawRecords).toContain("\"ownershipMode\": \"cloud-only\"")
		expect(rawRecords).toContain("\"restorePolicy\": \"reproject_and_reauth_if_needed\"")
		expect(rawRecords).toContain("\"credentialMode\": \"cloud-disposable\"")
		expect(rawRecords).toContain("\"source\": \"curated\"")

		const [record] = listMcpConnectionRecords()
		expect(record.ownershipMode).toBe("cloud-only")
		expect(record.canonicalStore).toBe("gateway")
		expect(record.restorePolicy).toBe("reproject_and_reauth_if_needed")
		expect(record.credentialMode).toBe("cloud-disposable")
		expect(record.status).toBe("configured")
		expect(record.runtimeState).toBe("projected")
		expect(record.authState).toBe("needs_auth")
		expect(record.metadata).toEqual({ source: "curated", imported: true })
		expect(record.projectedOpenCode).toEqual({ type: "remote", url: "https://notion.example/mcp" })
	})
})
