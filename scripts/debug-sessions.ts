#!/usr/bin/env bun

import { Database } from "bun:sqlite"
import { execFile } from "node:child_process"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

interface SessionRow {
	id: string
	project_id: string | null
	parent_id: string | null
	title: string | null
	directory: string | null
	time_created: number
	time_updated: number
}

interface MessageRow {
	id: string
	data: string
}

interface PartRow {
	id: string
	message_id: string
	data: string
}

interface ParsedMessage {
	role?: string
	agent?: string
	finish?: string
	tokens?: Record<string, unknown>
	time?: {
		created?: number
		completed?: number
	}
}

interface ParsedPart {
	type?: string
	reason?: string
	tool?: string
	state?: {
		status?: string
		metadata?: Record<string, unknown>
	}
	time?: {
		created?: number
		completed?: number
	}
}

interface ActiveSessionSnapshot {
	serverUrl: string
	clientCount: number
	sessionCount: number
	sessions: Array<{
		sessionId: string
		directory: string
		pid: number
		source: "attach" | "inferred"
		command: string
	}>
	refreshedAt: number
}

const DB_PATH = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db")
const DEFAULT_MESSAGE_LIMIT = 5
const DEFAULT_PART_LIMIT = 12
const DEFAULT_OPENCODE_PORT = 14096
const DEFAULT_SERVER_URL =
	process.env.OPENCODE_SERVER_URL || `http://127.0.0.1:${DEFAULT_OPENCODE_PORT}`
const execFileAsync = promisify(execFile)

function formatTime(ts?: number): string {
	if (!ts) return "-"
	return new Date(ts).toISOString()
}

function parseJson<T>(value: string): T | null {
	try {
		return JSON.parse(value) as T
	} catch {
		return null
	}
}

function isZeroTokenStub(message: ParsedMessage | null): boolean {
	if (!message) return false
	if (message.role !== "assistant") return false
	if (message.time?.completed) return false
	const tokens = message.tokens ?? {}
	return (
		(tokens.input === 0 || tokens.input === undefined) &&
		(tokens.output === 0 || tokens.output === undefined) &&
		(tokens.reasoning === 0 || tokens.reasoning === undefined)
	)
}

function summarizeMessage(row: MessageRow): string {
	const parsed = parseJson<ParsedMessage>(row.data)
	if (!parsed) return `${row.id} invalid-json`
	const bits = [
		row.id,
		parsed.role ?? "unknown-role",
		parsed.agent ?? "unknown-agent",
		`created=${formatTime(parsed.time?.created)}`,
		`completed=${formatTime(parsed.time?.completed)}`,
		`finish=${parsed.finish ?? "-"}`,
	]
	if (isZeroTokenStub(parsed)) bits.push("ZERO_TOKEN_STUB")
	return bits.join(" ")
}

function summarizePart(row: PartRow): string {
	const parsed = parseJson<ParsedPart>(row.data)
	if (!parsed) return `${row.id} invalid-json`
	const bits = [row.id, parsed.type ?? "unknown-type"]
	if (parsed.reason) bits.push(`reason=${parsed.reason}`)
	if (parsed.tool) bits.push(`tool=${parsed.tool}`)
	if (parsed.state?.status) bits.push(`status=${parsed.state.status}`)
	if (parsed.time?.created) bits.push(`created=${formatTime(parsed.time.created)}`)
	return bits.join(" ")
}

function formatFreshnessDelta(
	sessionUpdatedAt: number,
	latestActivityAt: number | null,
): string | null {
	if (!latestActivityAt || latestActivityAt <= sessionUpdatedAt) return null
	return `${Math.round((latestActivityAt - sessionUpdatedAt) / 1000)}s`
}

function getLatestCompletedMessageTime(db: Database, sessionId: string): number | null {
	const rows = db
		.query<MessageRow, [string]>(
			"select id, data from message where session_id = ?1 order by time_created desc limit 20",
		)
		.all(sessionId)
	let latest: number | null = null
	for (const row of rows) {
		const parsed = parseJson<ParsedMessage>(row.data)
		const completed = parsed?.time?.completed
		if (completed && (!latest || completed > latest)) latest = completed
	}
	return latest
}

function getLatestPartTime(db: Database, sessionId: string): number | null {
	const rows = db
		.query<PartRow, [string]>(
			"select id, message_id, data from part where session_id = ?1 order by time_created desc limit 50",
		)
		.all(sessionId)
	let latest: number | null = null
	for (const row of rows) {
		const parsed = parseJson<ParsedPart>(row.data)
		const created = parsed?.time?.created
		if (created && (!latest || created > latest)) latest = created
	}
	return latest
}

async function fetchActiveSessionSnapshot(
	serverUrl: string,
): Promise<ActiveSessionSnapshot | null> {
	try {
		const response = await fetch(`${serverUrl}/opencode/active-sessions`)
		if (!response.ok) return null
		return (await response.json()) as ActiveSessionSnapshot
	} catch {
		return null
	}
}

async function fetchSessionStatusMap(
	serverUrl: string,
	directory: string | null,
): Promise<Record<string, string> | null> {
	if (!directory) return null
	const script = [
		'import { createClient } from "@opencode-ai/sdk"',
		`const client = createClient({ baseUrl: ${JSON.stringify(serverUrl)}, directory: ${JSON.stringify(directory)} })`,
		"const result = await client.session.status()",
		"console.log(JSON.stringify(result.data ?? {}))",
	].join("; ")
	try {
		const { stdout } = await execFileAsync("bunx", ["tsx", "-e", script], {
			cwd: path.resolve(import.meta.dir, ".."),
		})
		const raw = JSON.parse(stdout.trim()) as Record<string, { type?: string }>
		const next: Record<string, string> = {}
		for (const [sessionId, value] of Object.entries(raw)) {
			next[sessionId] = value?.type ?? "unknown"
		}
		return next
	} catch {
		return null
	}
}

async function printSessionTree(db: Database, sessionId: string, indent = ""): Promise<void> {
	const session = db
		.query<SessionRow, [string]>(
			"select id, project_id, parent_id, title, directory, time_created, time_updated from session where id = ?1",
		)
		.get(sessionId)

	if (!session) {
		console.log(`${indent}${sessionId} MISSING`)
		return
	}

	const latestMessageCompletedAt = getLatestCompletedMessageTime(db, sessionId)
	const latestPartAt = getLatestPartTime(db, sessionId)
	const canonicalActivityAt = Math.max(
		session.time_updated,
		latestMessageCompletedAt ?? 0,
		latestPartAt ?? 0,
	)
	const freshnessDelta = formatFreshnessDelta(session.time_updated, canonicalActivityAt)
	const activeSnapshot = await fetchActiveSessionSnapshot(DEFAULT_SERVER_URL)
	const activePresence =
		activeSnapshot?.sessions.find((entry) => entry.sessionId === sessionId) ?? null
	const statusMap = await fetchSessionStatusMap(DEFAULT_SERVER_URL, session.directory)
	const statusType = statusMap?.[sessionId] ?? "unknown"

	console.log(
		`${indent}${session.id} title=${JSON.stringify(session.title)} updated=${formatTime(session.time_updated)}`,
	)
	console.log(
		`${indent}  sync status=${statusType} activePresence=${activePresence ? activePresence.source : "none"} canonicalActivity=${formatTime(canonicalActivityAt)}`,
	)
	if (freshnessDelta) {
		console.log(
			`${indent}  drift stale-recency session.updated=${formatTime(session.time_updated)} canonicalDelta=${freshnessDelta}`,
		)
	}
	if (activePresence && activePresence.directory !== session.directory) {
		console.log(
			`${indent}  drift attached-but-unhydrated presenceDir=${activePresence.directory} sessionDir=${session.directory}`,
		)
	}

	const messages = db
		.query<MessageRow, [string, number]>(
			"select id, data from message where session_id = ?1 order by time_created desc limit ?2",
		)
		.all(sessionId, DEFAULT_MESSAGE_LIMIT)
	for (const message of messages) {
		console.log(`${indent}  msg ${summarizeMessage(message)}`)
	}

	const parts = db
		.query<PartRow, [string, number]>(
			"select id, message_id, data from part where session_id = ?1 order by time_created desc limit ?2",
		)
		.all(sessionId, DEFAULT_PART_LIMIT)
	for (const part of parts) {
		const summary = summarizePart(part)
		if (
			summary.includes("step-start") ||
			summary.includes("step-finish") ||
			summary.includes("tool") ||
			summary.includes("status=")
		) {
			console.log(`${indent}  part ${summary}`)
		}
	}

	const children = db
		.query<SessionRow, [string]>(
			"select id, project_id, parent_id, title, directory, time_created, time_updated from session where parent_id = ?1 order by time_created asc",
		)
		.all(sessionId)
	for (const child of children) {
		await printSessionTree(db, child.id, `${indent}  `)
	}
}

const sessionIds = process.argv.slice(2)
if (sessionIds.length === 0) {
	console.error("Usage: bun scripts/debug-sessions.ts <session-id> [session-id...]")
	process.exit(1)
}

const db = new Database(DB_PATH, { readonly: true })
console.log(`DB ${DB_PATH}`)
for (const sessionId of sessionIds) {
	console.log(`\nSESSION ${sessionId}`)
	await printSessionTree(db, sessionId)
}
