import { createLogger } from "../lib/logger"
import type { Ch5PmSignalRow } from "./types"

const log = createLogger("ch5pm-dashboard-actions")

interface ReopenResponse {
	ok?: boolean
	error?: string
	workspace?: string
	surface?: string
}

async function postJson<T>(baseUrl: string, path: string, payload: unknown): Promise<T> {
	const response = await fetch(`${baseUrl}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	})
	const data = (await response.json().catch(() => ({}))) as T
	if (!response.ok) {
		throw new Error(
			(data as { error?: string }).error ?? `${path} failed: HTTP ${response.status}`,
		)
	}
	return data
}

export async function reopenClosedSession(
	baseUrl: string,
	row: Ch5PmSignalRow,
): Promise<{ openedIn: string }> {
	const payload = await postJson<ReopenResponse>(baseUrl, "/closed-session/reopen", {
		ticketId: row.ticketId ?? "",
		sessionId: row.sessionId ?? "",
	})
	if (payload.ok === false) {
		throw new Error(payload.error ?? "Failed to reopen closed session")
	}
	const openedIn = payload.workspace
		? `${payload.workspace}${payload.surface ? ` / ${payload.surface}` : ""}`
		: "CMUX"
	log.info("Reopened closed CH5PM session", {
		ticketId: row.ticketId,
		sessionId: row.sessionId,
		openedIn,
	})
	return { openedIn }
}
