import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { Session } from "@opencode-ai/sdk/v2/client"
import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"

const execFileAsync = promisify(execFile)
const PROCESS_START_GRACE_MS = 5 * 60 * 1000

export interface ActiveOpenCodeSessionPresence {
	sessionId: string
	directory: string
	pid: number
	source: "attach" | "inferred"
	command: string
}

export interface ActiveOpenCodeSessionsSnapshot {
	serverUrl: string
	clientCount: number
	sessionCount: number
	sessions: ActiveOpenCodeSessionPresence[]
	refreshedAt: number
}

interface ClientProcess {
	pid: number
	command: string
	directory: string
	startedAtMs: number
	sessionId?: string
	source: "attach" | "plain"
}

function tokenizeArgs(input: string): string[] {
	const matches = input.match(/"[^"]*"|'[^']*'|\S+/g)
	if (!matches) return []
	return matches.map((token) => {
		if (
			(token.startsWith('"') && token.endsWith('"')) ||
			(token.startsWith("'") && token.endsWith("'"))
		) {
			return token.slice(1, -1)
		}
		return token
	})
}

function readFlag(tokens: string[], name: string): string | undefined {
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i]
		if (token === name) return tokens[i + 1]
		if (token.startsWith(`${name}=`)) return token.slice(name.length + 1)
	}
	return undefined
}

function normalizeOrigin(value: string): string | null {
	try {
		const url = new URL(value)
		const port =
			url.port || (url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "")
		return `${url.protocol}//${url.hostname}${port ? `:${port}` : ""}`
	} catch {
		return null
	}
}

async function listClientProcesses(serverUrl: string): Promise<ClientProcess[]> {
	const targetOrigin = normalizeOrigin(serverUrl)
	if (!targetOrigin) {
		throw new Error(`Invalid OpenCode server URL: ${serverUrl}`)
	}

	const { stdout } = await execFileAsync("ps", ["-axo", "pid=,lstart=,command=", "-ww"])
	const processes: ClientProcess[] = []

	for (const line of stdout.split("\n")) {
		const match = line.match(
			/^\s*(\d+)\s+([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.*)$/,
		)
		if (!match) continue

		const pid = Number(match[1])
		const startedAtMs = Date.parse(match[2])
		const command = match[3]
		if (!Number.isFinite(startedAtMs)) continue
		const firstSpace = command.indexOf(" ")
		const executable = firstSpace === -1 ? command : command.slice(0, firstSpace)
		if (executable !== "opencode" && !executable.endsWith("/opencode")) continue

		const rest = firstSpace === -1 ? "" : command.slice(firstSpace + 1).trim()
		if (!rest) continue

		const tokens = tokenizeArgs(rest)
		if (tokens.length === 0) continue

		const subcommand = tokens[0]
		if (subcommand === "serve" || subcommand === "run") continue

		if (subcommand === "attach") {
			const attachTarget = normalizeOrigin(tokens[1] ?? "")
			if (attachTarget !== targetOrigin) continue

			const sessionId = readFlag(tokens, "--session")
			const directory = readFlag(tokens, "--dir")
			if (!sessionId || !directory) continue

			processes.push({
				pid,
				command,
				directory,
				startedAtMs,
				sessionId,
				source: "attach",
			})
			continue
		}

		const directory = tokens.find((token) => token.startsWith("/"))
		if (!directory) continue

		processes.push({
			pid,
			command,
			directory,
			startedAtMs,
			source: "plain",
		})
	}

	return processes
}

async function listRecentRootSessions(
	serverUrl: string,
	directory: string,
	limit: number,
): Promise<Session[]> {
	try {
		const client = createOpencodeClient({ baseUrl: serverUrl, directory })
		const result = await client.session.list({ roots: true, limit })
		return (result.data as Session[]) ?? []
	} catch {
		return []
	}
}

export async function getActiveOpenCodeSessions(
	serverUrl: string,
): Promise<ActiveOpenCodeSessionsSnapshot> {
	const processes = await listClientProcesses(serverUrl)
	const exactSessions = new Map<string, ActiveOpenCodeSessionPresence>()
	const exactSessionIdsByDirectory = new Map<string, Set<string>>()
	const inferredNeeds = new Map<string, ClientProcess[]>()

	for (const process of processes) {
		if (process.source === "attach" && process.sessionId) {
			exactSessions.set(process.sessionId, {
				sessionId: process.sessionId,
				directory: process.directory,
				pid: process.pid,
				source: "attach",
				command: process.command,
			})

			const existing = exactSessionIdsByDirectory.get(process.directory) ?? new Set<string>()
			existing.add(process.sessionId)
			exactSessionIdsByDirectory.set(process.directory, existing)
			continue
		}

		const existing = inferredNeeds.get(process.directory) ?? []
		existing.push(process)
		inferredNeeds.set(process.directory, existing)
	}

	const inferredBatches = await Promise.all(
		Array.from(inferredNeeds.entries()).map(async ([directory, processes]) => {
			const claimed = exactSessionIdsByDirectory.get(directory) ?? new Set<string>()
			const limit = Math.max(processes.length + claimed.size + 5, 10)
			const sessions = await listRecentRootSessions(serverUrl, directory, limit)
			const remaining = sessions.filter((session) => !claimed.has(session.id))
			const next: ActiveOpenCodeSessionPresence[] = []

			for (const process of [...processes].sort((a, b) => b.startedAtMs - a.startedAtMs)) {
				if (remaining.length === 0) break

				const bounded = remaining.filter(
					(session) => session.time.created <= process.startedAtMs + PROCESS_START_GRACE_MS,
				)
				const chosen = bounded[0]
				if (!chosen) continue

				next.push({
					sessionId: chosen.id,
					directory,
					pid: process.pid,
					source: "inferred",
					command: process.command,
				})

				const index = remaining.findIndex((session) => session.id === chosen.id)
				if (index >= 0) remaining.splice(index, 1)
			}

			return next
		}),
	)

	const uniqueSessions = new Map<string, ActiveOpenCodeSessionPresence>()
	for (const entry of exactSessions.values()) uniqueSessions.set(entry.sessionId, entry)
	for (const batch of inferredBatches) {
		for (const entry of batch) {
			if (!uniqueSessions.has(entry.sessionId)) {
				uniqueSessions.set(entry.sessionId, entry)
			}
		}
	}

	return {
		serverUrl,
		clientCount: processes.length,
		sessionCount: uniqueSessions.size,
		sessions: Array.from(uniqueSessions.values()),
		refreshedAt: Date.now(),
	}
}
