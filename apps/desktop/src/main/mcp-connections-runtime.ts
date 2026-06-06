import { execFile } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { app } from "electron"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import { createLogger } from "./logger"
import { upsertMcpConnectionConfig } from "./mcp-connections-config"
import { getServerUrl } from "./opencode-manager"
import { getSettings, updateSettings } from "./settings-store"

const log = createLogger("mcp-connections-runtime")
const execFileAsync = promisify(execFile)

interface McpConnectionActionInput {
	name: string
	transport: "remote-http" | "remote-sse" | "local-stdio"
	target: string
	scope?: "home" | "project"
	header?: string | null
	env?: Record<string, string>
	ownershipMode?: "local-only" | "cloud-only" | "handoff-derived"
	canonicalStore?: "local" | "gateway"
	restorePolicy?: "none" | "reproject_on_boot" | "reproject_and_reauth_if_needed"
	source?: "registry" | "curated" | "imported" | "manual"
	metadata?: Record<string, unknown>
}

function mcporterBin() {
	return "npx"
}

function mcporterArgs(args: string[]) {
	return ["-y", "mcporter", ...args]
}

function resolveConnectionRecordsPath() {
	const configuredPath = getSettings().connections?.connectionRecordsPath
	if (configuredPath) return configuredPath
	return path.join(app.getPath("userData"), "mcp-connection-records.json")
}

function persistConnectionRecord(record: {
	name: string
	transport: string
	target: string
	scope: string
	ownershipMode?: string
	authState?: string
	canonicalStore?: string
	restorePolicy?: string
	testState?: string
	status?: string
	runtimeState?: string
	credentialMode?: string
	projectedOpenCode?: Record<string, unknown> | null
	metadata?: Record<string, unknown>
	lastTestAt?: string | null
	lastHealthyAt?: string | null
	lastError?: string | null
}) {
	const filePath = resolveConnectionRecordsPath()
	const existing = fs.existsSync(filePath)
		? (JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<string, unknown>)
		: {}
	const records = ((existing.records as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>
	const previous = (records[record.name] as Record<string, unknown> | undefined) ?? undefined
	records[record.name] = {
		...previous,
		...record,
		metadata: {
			...(((previous?.metadata as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>),
			...((record.metadata ?? {}) as Record<string, unknown>),
		},
	}
	const dir = path.dirname(filePath)
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true })
	}
	const tmpPath = `${filePath}.tmp`
	fs.writeFileSync(tmpPath, JSON.stringify({ records }, null, "\t"), "utf-8")
	fs.renameSync(tmpPath, filePath)
	updateSettings({ connections: { connectionRecordsPath: filePath } })
}

export function listMcpConnectionRecords(): Array<{
	name: string
	transport: string
	target: string
	scope: string
	ownershipMode?: string
	authState?: string
	canonicalStore?: string
	restorePolicy?: string
	testState?: string
	status?: string
	runtimeState?: string
	credentialMode?: string
	projectedOpenCode?: Record<string, unknown> | null
	metadata?: Record<string, unknown>
	lastTestAt?: string | null
	lastHealthyAt?: string | null
	lastError?: string | null
}> {
	const filePath = resolveConnectionRecordsPath()
	if (!fs.existsSync(filePath)) return []
	const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as { records?: Record<string, unknown> }
	const records = parsed.records ?? {}
	return Object.values(records) as Array<{
		name: string
		transport: string
		target: string
		scope: string
		ownershipMode?: string
		authState?: string
		canonicalStore?: string
		restorePolicy?: string
		testState?: string
		status?: string
		runtimeState?: string
		credentialMode?: string
		projectedOpenCode?: Record<string, unknown> | null
		metadata?: Record<string, unknown>
		lastTestAt?: string | null
		lastHealthyAt?: string | null
		lastError?: string | null
	}>
}

export async function registerMcpConnection(input: McpConnectionActionInput): Promise<{ ok: true }> {
	const ownershipMode = input.ownershipMode ?? "local-only"
	const canonicalStore = input.canonicalStore ?? (ownershipMode === "cloud-only" ? "gateway" : "local")
	const restorePolicy =
		input.restorePolicy ??
		(canonicalStore === "gateway" ? "reproject_and_reauth_if_needed" : "reproject_on_boot")
	const credentialMode =
		ownershipMode === "cloud-only"
			? "cloud-disposable"
			: ownershipMode === "handoff-derived"
				? "hybrid-handoff"
				: "local-desktop"
	const scope = input.scope ?? (canonicalStore === "gateway" ? "home" : "project")
	const args = ["config", "add", input.name]
	if (input.transport === "local-stdio") {
		args.push("--command", input.target)
	} else {
		args.push("--url", input.target)
		args.push("--transport", input.transport === "remote-sse" ? "sse" : "http")
	}
	args.push("--scope", scope)
	if (input.header) {
		args.push("--header", input.header)
	}
	if (input.env) {
		for (const [key, value] of Object.entries(input.env)) {
			args.push("--env", `${key}=${value}`)
		}
	}
	await execFileAsync(mcporterBin(), mcporterArgs(args))
	const projectedOpenCode =
		input.transport === "local-stdio"
			? { type: "local", command: [input.target] }
			: { type: "remote", url: input.target }
	persistConnectionRecord({
		name: input.name,
		transport: input.transport,
		target: input.target,
		scope,
		ownershipMode,
		authState: input.transport === "local-stdio" ? "not_required" : "needs_auth",
		canonicalStore,
		restorePolicy,
		testState: "untested",
		status: "configured",
		runtimeState: "projected",
		credentialMode,
		projectedOpenCode,
		metadata: {
			source: input.source ?? "manual",
			...((input.metadata ?? {}) as Record<string, unknown>),
		},
		lastTestAt: null,
		lastHealthyAt: null,
		lastError: null,
	})
	upsertMcpConnectionConfig({
		name: input.name,
		config: projectedOpenCode,
	})
	const serverUrl = getServerUrl()
	if (serverUrl) {
		const client = createOpencodeClient({ baseUrl: serverUrl })
		await client.global.dispose()
	}
	log.info("Registered MCP connection", { name: input.name, ownershipMode, canonicalStore, restorePolicy })
	return { ok: true }
}

export async function loginMcpConnection(name: string): Promise<{ ok: true }> {
	await execFileAsync(mcporterBin(), mcporterArgs(["config", "login", name, "--no-browser"]))
	log.info("Started MCP login", { name })
	return { ok: true }
}

export async function testMcpConnection(name: string): Promise<{ ok: boolean; output: string }> {
	const existing = listMcpConnectionRecords().find((record) => record.name === name)
	const { stdout } = await execFileAsync(mcporterBin(), mcporterArgs(["list", name, "--status", "--json"]))
	const now = new Date().toISOString()
	const parsed = JSON.parse(stdout) as { servers?: Array<{ status?: string; error?: string }> }
	const first = parsed.servers?.[0]
	const ok = first?.status === "ok"
	persistConnectionRecord({
		name,
		transport: existing?.transport ?? "remote-http",
		target: existing?.target ?? name,
		scope: existing?.scope ?? "project",
		ownershipMode: existing?.ownershipMode ?? "local-only",
		authState: ok ? "authenticated" : "failed",
		canonicalStore: existing?.canonicalStore ?? "local",
		restorePolicy: existing?.restorePolicy ?? "reproject_on_boot",
		testState: ok ? "passing" : "failing",
		status: ok ? "connected" : "degraded",
		runtimeState: ok ? "active" : "degraded",
		credentialMode: existing?.credentialMode,
		projectedOpenCode: existing?.projectedOpenCode ?? null,
		metadata: existing?.metadata,
		lastTestAt: now,
		lastHealthyAt: ok ? now : null,
		lastError: ok ? null : first?.error ?? "Probe failed",
	})
	return { ok, output: stdout }
}
