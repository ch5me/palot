import type { ChildSession, PolicyVerdict, RuntimeEvent, RuntimeEventPage } from "@ch5me/agent-runtime-contracts"
import type {
	MetaSessionReviewEventItem,
	MetaSessionReviewModel,
	MetaSessionReviewRow,
	MetaSessionReviewState,
} from "../shared/palot-meta-session-review-contract"

function compareOccurredAtDescending(left: { occurredAt: string }, right: { occurredAt: string }): number {
	return right.occurredAt.localeCompare(left.occurredAt)
}

function describePolicyVerdict(verdict: PolicyVerdict): {
	label: string
	detail: string
	tone: MetaSessionReviewEventItem["tone"]
	reviewState: MetaSessionReviewState
} {
	if (verdict.decision === "allow") {
		const grantedBy =
			"adapterDispatchPermission" in verdict ? verdict.adapterDispatchPermission.grantedBy : null
		return {
			label: "Approved",
			detail: grantedBy ? `Granted by ${grantedBy}` : verdict.reason,
			tone: "success",
			reviewState: "approved",
		}
	}

	if (verdict.decision === "ask") {
		return {
			label: "Needs approval",
			detail: verdict.reason,
			tone: "warning",
			reviewState: "needs-approval",
		}
	}

	return {
		label: "Denied",
		detail: verdict.reason,
		tone: "danger",
		reviewState: "denied",
	}
}

export function renderMetaSessionReviewEvent(event: RuntimeEvent): MetaSessionReviewEventItem {
	switch (event.type) {
		case "policy": {
			const description = describePolicyVerdict(event.verdict)
			return {
				eventId: event.eventId,
				childSessionId: event.childSessionId,
				label: description.label,
				detail: description.detail,
				tone: description.tone,
				occurredAt: event.occurredAt,
			}
		}
		case "session.status":
			return {
				eventId: event.eventId,
				childSessionId: event.childSessionId,
				label: `Status: ${event.status}`,
				detail: `Runtime ${event.runtimeStatus}`,
				tone: event.status === "blocked" ? "warning" : "neutral",
				occurredAt: event.occurredAt,
			}
		case "blocker":
			return {
				eventId: event.eventId,
				childSessionId: event.childSessionId,
				label: event.blocker.message,
				detail: event.blocker.details ?? event.blocker.code,
				tone: event.blocker.retryable ? "warning" : "danger",
				occurredAt: event.occurredAt,
			}
		case "artifact":
			return {
				eventId: event.eventId,
				childSessionId: event.childSessionId,
				label: event.label,
				detail: `${event.artifactKind} artifact`,
				tone: "neutral",
				occurredAt: event.occurredAt,
			}
		case "message":
		default:
			return {
				eventId: event.eventId,
				childSessionId: event.childSessionId,
				label: event.role === "assistant" ? "Assistant" : event.role === "tool" ? "Tool" : "System",
				detail: event.text,
				tone: "neutral",
				occurredAt: event.occurredAt,
			}
	}
}

function deriveReviewState(child: ChildSession, events: RuntimeEvent[]): MetaSessionReviewState {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index]
		if (!event) continue
		if (event.type === "policy") {
			return describePolicyVerdict(event.verdict).reviewState
		}
	}
	if (child.status === "blocked") return "blocked"
	return "idle"
}

function deriveStatus(child: ChildSession, events: RuntimeEvent[]): ChildSession["status"] {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index]
		if (event?.type === "session.status") return event.status
	}
	return child.status
}

function deriveSummary(child: ChildSession, events: RuntimeEvent[]): string {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index]
		if (!event) continue
		if (event.type === "policy") return describePolicyVerdict(event.verdict).detail
		if (event.type === "message") return event.text
		if (event.type === "blocker") return event.blocker.message
	}
	return `${child.runtimeKind} child ${child.runtimeSessionId}`
}

function deriveLatestEventAt(child: ChildSession, events: RuntimeEvent[]): string {
	const latestEvent = [...events].sort(compareOccurredAtDescending)[0]
	return latestEvent?.occurredAt ?? child.lastEventAt ?? child.lastHeartbeatAt ?? child.createdAt
}

export function buildMetaSessionReviewModel(input: {
	children: ChildSession[]
	eventPagesByChildSessionId: Record<string, RuntimeEventPage | undefined>
}): MetaSessionReviewModel {
	const rows = input.children
		.map((child) => {
			const events = input.eventPagesByChildSessionId[child.id]?.events ?? []
			return {
				childSessionId: child.id,
				title: child.title,
				runtimeKind: child.runtimeKind,
				runtimeSessionId: child.runtimeSessionId,
				status: deriveStatus(child, events),
				reviewState: deriveReviewState(child, events),
				summary: deriveSummary(child, events),
				latestEventAt: deriveLatestEventAt(child, events),
			} satisfies MetaSessionReviewRow
		})
		.sort((left, right) => right.latestEventAt.localeCompare(left.latestEventAt))

	const eventsByChildSessionId = Object.fromEntries(
		input.children.map((child) => {
			const page = input.eventPagesByChildSessionId[child.id]
			const rendered = [...(page?.events ?? [])]
				.sort(compareOccurredAtDescending)
				.map((event) => renderMetaSessionReviewEvent(event))
			return [child.id, rendered]
		}),
	)

	return {
		rows,
		eventsByChildSessionId,
	}
}
