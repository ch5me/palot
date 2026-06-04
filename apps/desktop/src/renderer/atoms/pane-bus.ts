import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import type { Event } from "../lib/types"

export type PaneBusScope =
	| { type: "global" }
	| { type: "session"; sessionId: string }
	| { type: "project"; directory: string }

export interface PaneBusRecord {
	event: Event
	revision: number
	receivedAt: number
}

function normalizeDirectory(directory: string): string {
	return directory.trim()
}

export function paneBusScopeKey(scope: PaneBusScope): string {
	switch (scope.type) {
		case "global":
			return "global"
		case "session":
			return `session:${scope.sessionId}`
		case "project":
			return `project:${normalizeDirectory(scope.directory)}`
	}
}

function collectScopeKeys(event: Event): string[] {
	const keys = new Set<string>([paneBusScopeKey({ type: "global" })])
	const properties = event.properties as Record<string, unknown>
	const sessionId =
		typeof properties.sessionID === "string"
			? properties.sessionID
			: typeof properties.sessionId === "string"
				? properties.sessionId
				: typeof properties.requestID === "string" && typeof properties.sessionID === "string"
					? properties.sessionID
					: null
	if (sessionId) {
		keys.add(paneBusScopeKey({ type: "session", sessionId }))
	}

	const directory =
		typeof properties.directory === "string"
			? properties.directory
			: typeof properties.info === "object" && properties.info !== null && "directory" in properties.info
				? typeof (properties.info as { directory?: unknown }).directory === "string"
					? ((properties.info as { directory: string }).directory)
					: null
				: null
	if (directory) {
		keys.add(paneBusScopeKey({ type: "project", directory }))
	}

	const part = typeof properties.part === "object" && properties.part !== null ? properties.part as Record<string, unknown> : null
	if (part) {
		if (typeof part.sessionID === "string") {
			keys.add(paneBusScopeKey({ type: "session", sessionId: part.sessionID }))
		}
		if (typeof part.directory === "string") {
			keys.add(paneBusScopeKey({ type: "project", directory: part.directory }))
		}
	}

	return [...keys]
}

export const paneBusFamily = atomFamily((_scopeKey: string) => atom<PaneBusRecord | null>(null))

export const publishPaneBusEventAtom = atom(null, (get, set, event: Event) => {
	for (const scopeKey of collectScopeKeys(event)) {
		const current = get(paneBusFamily(scopeKey))
		set(paneBusFamily(scopeKey), {
			event,
			revision: (current?.revision ?? 0) + 1,
			receivedAt: Date.now(),
		})
	}
})
