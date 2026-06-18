import type { ChildSession } from "@ch5me/agent-runtime-contracts"

export type MetaSessionReviewState =
	| "idle"
	| "approved"
	| "needs-approval"
	| "denied"
	| "blocked"

export interface MetaSessionReviewRow {
	childSessionId: string
	title: string
	runtimeKind: ChildSession["runtimeKind"]
	runtimeSessionId: string
	status: ChildSession["status"]
	reviewState: MetaSessionReviewState
	summary: string
	latestEventAt: string
}

export interface MetaSessionReviewEventItem {
	eventId: string
	childSessionId: string
	label: string
	detail: string
	tone: "neutral" | "success" | "warning" | "danger"
	occurredAt: string
}

export interface MetaSessionReviewModel {
	rows: MetaSessionReviewRow[]
	eventsByChildSessionId: Record<string, MetaSessionReviewEventItem[]>
}
