#!/usr/bin/env bun

import { Database } from "bun:sqlite"
import os from "node:os"
import path from "node:path"

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
}

const DB_PATH = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db")
const DEFAULT_MESSAGE_LIMIT = 5
const DEFAULT_PART_LIMIT = 12

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
	return bits.join(" ")
}

function printSessionTree(db: Database, sessionId: string, indent = ""): void {
	const session = db
		.query<SessionRow, [string]>(
			"select id, project_id, parent_id, title, directory, time_created, time_updated from session where id = ?1",
		)
		.get(sessionId)

	if (!session) {
		console.log(`${indent}${sessionId} MISSING`)
		return
	}

	console.log(
		`${indent}${session.id} title=${JSON.stringify(session.title)} updated=${formatTime(session.time_updated)}`,
	)

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
		printSessionTree(db, child.id, `${indent}  `)
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
	printSessionTree(db, sessionId)
}
