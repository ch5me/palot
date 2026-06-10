import { execFile, spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { resolveMcporterCommand } from "./mcporter-cli"
import { resolveProjectMcporterConfigPath, withMcporterConfig } from "./mcporter-config"

const execFileAsync = promisify(execFile)
const AUTH_SESSION_TTL_MS = 10 * 60 * 1000

interface McpAuthSession {
	name: string
	startedAt: number
	status: "launching" | "waiting" | "completed" | "failed" | "expired"
	authorizeUrl: string | null
	message: string | null
	pid: number | null
	stateFile: string
}

interface McporterStatusResponse {
	counts?: {
		ok?: number
		auth?: number
		offline?: number
		http?: number
		error?: number
	}
	servers?: Array<{
		status?: string
		error?: string
		issue?: {
			rawMessage?: string
		}
	}>
}

function authStateDir() {
	return (
		process.env.ELF_MCP_AUTH_STATE_DIR ??
		path.join(process.env.HOME ?? ".", ".local", "state", "elf", "mcp-auth")
	)
}

function stateFileFor(name: string) {
	return path.join(authStateDir(), `${name}.json`)
}

function ensureDir(filePath: string) {
	const dir = path.dirname(filePath)
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function writeState(filePath: string, value: unknown) {
	ensureDir(filePath)
	const tmpPath = `${filePath}.tmp`
	fs.writeFileSync(tmpPath, JSON.stringify(value, null, "\t"), "utf-8")
	fs.renameSync(tmpPath, filePath)
}

function readState(filePath: string): McpAuthSession | null {
	if (!fs.existsSync(filePath)) return null
	return JSON.parse(fs.readFileSync(filePath, "utf-8")) as McpAuthSession
}

function isProcessAlive(pid: number | null): boolean {
	if (!pid || pid <= 0) return false
	try {
		process.kill(pid, 0)
		return true
	} catch {
		return false
	}
}

function safeUnlink(filePath: string) {
	if (!fs.existsSync(filePath)) return
	fs.unlinkSync(filePath)
}

function safeKill(pid: number | null) {
	if (!isProcessAlive(pid)) return
	try {
		process.kill(pid as number, "SIGTERM")
	} catch {}
}

function cleanupSessionArtifacts(session: Pick<McpAuthSession, "pid" | "stateFile" | "name">) {
	safeKill(session.pid)
	safeUnlink(session.stateFile)
	safeUnlink(path.join(authStateDir(), `runner-${session.name}.cjs`))
	safeUnlink(path.join(authStateDir(), `${session.name}.log`))
}

function isExpired(session: McpAuthSession): boolean {
	return Date.now() - session.startedAt > AUTH_SESSION_TTL_MS
}

export async function startMcpAuthSession(name: string) {
	const stateFile = stateFileFor(name)
	const logFile = path.join(authStateDir(), `${name}.log`)
	const existing = readState(stateFile)
	if (existing) {
		if (isExpired(existing)) {
			cleanupSessionArtifacts(existing)
			return {
				name,
				status: "expired",
				authorizeUrl: null,
				message: "Previous auth session expired. Start auth again.",
			}
		}
		if (
			(existing.status === "waiting" || existing.status === "launching") &&
			isProcessAlive(existing.pid)
		) {
			return {
				name,
				status: existing.status,
				authorizeUrl: existing.authorizeUrl,
				message: existing.message,
			}
		}
		cleanupSessionArtifacts(existing)
	}
	safeUnlink(logFile)

	const session: McpAuthSession = {
		name,
		startedAt: Date.now(),
		status: "launching",
		authorizeUrl: null,
		message: null,
		pid: null,
		stateFile,
	}
	writeState(stateFile, session)
	const configPath = resolveProjectMcporterConfigPath()
	const authCommand = resolveMcporterCommand(
		withMcporterConfig(["auth", name, "--no-browser"], configPath),
	)

	const runnerPath = path.join(authStateDir(), `runner-${name}.cjs`)
	fs.writeFileSync(
		runnerPath,
		[
			"const fs = require('node:fs')",
			"const path = require('node:path')",
			`const stateFile = ${JSON.stringify(stateFile)}`,
			`const logFile = ${JSON.stringify(logFile)}`,
			`const name = ${JSON.stringify(name)}`,
			`const configPath = ${JSON.stringify(configPath)}`,
			"const { spawn } = require('node:child_process')",
			"const ensureDir = (filePath) => { const dir = path.dirname(filePath); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) }",
			"const writeState = (value) => { ensureDir(stateFile); fs.writeFileSync(stateFile, JSON.stringify(value, null, '\t')) }",
			"const appendLog = (prefix, text) => { ensureDir(logFile); fs.appendFileSync(logFile, '[' + prefix + '] ' + text) }",
			"const sanitizeUrl = (value) => value.replace(/[)\\],.;]+$/g, '')",
			"const pickAuthorizeUrl = (urls) => urls.find((url) => !/^https?:\\/\\/(127\\.0\\.0\\.1|localhost)(:\\d+)?\\//i.test(url)) ?? urls[0] ?? null",
			"const extract = (text) => { const matches = Array.from(text.matchAll(/https?:\\/\\/\\S+/g)).map((match) => sanitizeUrl(match[0])); return pickAuthorizeUrl(matches) }",
			`const proc = spawn(${JSON.stringify(authCommand.file)}, ${JSON.stringify(authCommand.args)}, { stdio: ['ignore','pipe','pipe'], detached: false, env: { ...process.env, MCPO_CONFIG: configPath } })`,
			"let state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))",
			"state.pid = proc.pid; writeState(state)",
			"const handle = (prefix, chunk) => { const text = chunk.toString('utf-8'); appendLog(prefix, text); const url = extract(text); state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); if (url) { state.authorizeUrl = url; state.status = 'waiting'; state.message = 'Authorization URL ready'; } else if (/waiting for browser approval/i.test(text)) { state.status = 'waiting'; state.message = 'Waiting for browser approval'; } else if (state.status === 'launching') { const lastLine = text.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean).at(-1); if (lastLine) state.message = lastLine; } writeState(state) }",
			"proc.stdout.on('data', (chunk) => handle('stdout', chunk))",
			"proc.stderr.on('data', (chunk) => handle('stderr', chunk))",
			"proc.on('error', (error) => { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); state.status = 'failed'; state.message = error.message; writeState(state); fs.rmSync(__filename, { force: true }) })",
			"proc.on('exit', (code) => { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); state.status = code === 0 ? 'completed' : 'failed'; state.message = code === 0 ? 'Auth completed' : 'mcporter auth exited with code ' + String(code ?? -1); writeState(state); fs.rmSync(logFile, { force: true }); fs.rmSync(__filename, { force: true }) })",
		].join("; "),
		"utf-8",
	)
	const runner = spawn(process.execPath, [runnerPath], {
		cwd: process.cwd(),
		env: process.env,
		stdio: "ignore",
		detached: true,
	})
	runner.unref()

	for (let attempt = 0; attempt < 20; attempt += 1) {
		const current = readState(stateFile)
		if (current?.authorizeUrl || current?.status === "completed" || current?.status === "failed")
			break
		await new Promise((resolve) => setTimeout(resolve, 250))
	}
	const current = readState(stateFile) ?? session
	return {
		name,
		status: current.status,
		authorizeUrl: current.authorizeUrl,
		message: current.message,
	}
}

export async function getMcpAuthSessionStatus(name: string) {
	const session = readState(stateFileFor(name))
	if (!session) {
		return { name, status: "missing", authorizeUrl: null, message: null }
	}
	if (isExpired(session)) {
		cleanupSessionArtifacts(session)
		return { name, status: "expired", authorizeUrl: null, message: "Auth session expired" }
	}
	if (
		(session.status === "launching" || session.status === "waiting") &&
		!isProcessAlive(session.pid)
	) {
		session.status = "failed"
		session.message = session.message ?? "Auth helper exited unexpectedly"
		writeState(session.stateFile, session)
	}
	if (session.status === "completed") {
		try {
			const command = resolveMcporterCommand(
				withMcporterConfig(
					["list", name, "--status", "--json"],
					resolveProjectMcporterConfigPath(),
				),
			)
			const { stdout } = await execFileAsync(command.file, command.args)
			const parsed = JSON.parse(stdout) as McporterStatusResponse
			const first = parsed.servers?.[0]
			const okCount = parsed.counts?.ok ?? 0
			if (first?.status === "ok" || okCount > 0) {
				return {
					name,
					status: "completed",
					authorizeUrl: session.authorizeUrl,
					message: "Authenticated and verified",
				}
			}
			return {
				name,
				status: "failed",
				authorizeUrl: session.authorizeUrl,
				message:
					first?.issue?.rawMessage ??
					first?.error ??
					"Authentication finished, but verification failed",
			}
		} catch {
			return {
				name,
				status: session.status,
				authorizeUrl: session.authorizeUrl,
				message: session.message,
			}
		}
	}
	return {
		name,
		status: session.status,
		authorizeUrl: session.authorizeUrl,
		message: session.message,
	}
}
