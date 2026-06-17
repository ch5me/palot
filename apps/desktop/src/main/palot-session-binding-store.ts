import type { Event } from "../renderer/lib/types"
import type { SessionBinding } from "../preload/api"
import {
	createSessionBinding,
	getSessionBindingByOpenCodeSession,
	listSessionBindings,
	releaseSessionBinding,
	upsertSessionBinding,
} from "./palot-session-binding"

export function attachLaneToBinding(sessionId: string, browserLaneId: string): SessionBinding | null {
	const existing = getSessionBindingByOpenCodeSession(sessionId)
	if (!existing) return null
	return upsertSessionBinding({
		...existing,
		browserLaneId,
		status: existing.status === "unbound" || existing.status === "attaching" ? "attaching" : existing.status,
	})
}

export function ensureSessionBindingForSession(input: {
	sessionId: string
	browserLaneId?: string | null
}): SessionBinding {
	const existing = getSessionBindingByOpenCodeSession(input.sessionId)
	if (existing) {
		if (existing.status === "released") {
			return upsertSessionBinding({
				...existing,
				status: "restored",
				releasedAt: null,
			})
		}
		return existing
	}
	return upsertSessionBinding(
		createSessionBinding({
			openCodeSessionId: input.sessionId,
			browserLaneId: input.browserLaneId ?? null,
			status: "attaching",
		}),
	)
}

export function markSessionBindingAttached(sessionId: string): SessionBinding | null {
	const existing = getSessionBindingByOpenCodeSession(sessionId)
	if (!existing) return null
	return upsertSessionBinding({
		...existing,
		status: "attached",
		releasedAt: null,
	})
}

export function releaseBindingForSession(sessionId: string): SessionBinding | null {
	return releaseSessionBinding(sessionId)
}

export function reconcileBindingsWithActiveSessions(activeSessionIds: string[]): SessionBinding[] {
	const activeSet = new Set(activeSessionIds)
	const bindings = listSessionBindings()
	const updated: SessionBinding[] = []
	for (const binding of bindings) {
		if (activeSet.has(binding.openCodeSessionId)) {
			if (binding.status === "released") {
				updated.push(
					upsertSessionBinding({
						...binding,
						status: "restored",
						releasedAt: null,
					}),
				)
			} else {
				updated.push(binding)
			}
			continue
		}
		if (binding.status !== "released") {
			const released = releaseSessionBinding(binding.openCodeSessionId)
			if (released) updated.push(released)
		}
	}
	return updated
}

export function applyBindingLifecycleEvent(event: Event): SessionBinding | null {
	switch (event.type) {
		case "session.created": {
			const sessionId = event.properties.info.id
			return ensureSessionBindingForSession({ sessionId })
		}
		case "session.updated": {
			const sessionId = event.properties.info.id
			return markSessionBindingAttached(sessionId)
		}
		case "session.idle": {
			const sessionId = event.properties.sessionID
			return markSessionBindingAttached(sessionId)
		}
		case "session.status": {
			if (event.properties.status.type !== "idle") return null
			const sessionId = event.properties.sessionID
			return markSessionBindingAttached(sessionId)
		}
		case "session.deleted": {
			const sessionId = event.properties.info.id
			return releaseBindingForSession(sessionId)
		}
		default:
			return null
	}
}
