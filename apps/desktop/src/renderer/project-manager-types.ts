import type { Ch5PmSnapshotTicketRow } from "./ch5pm-dashboard/types"
import type { Agent } from "./lib/types"

export type PmCardStatus = "pending" | "assigned" | "active" | "queued" | "blocked"

export interface PmPendingSubmission {
	id: string
	projectDirectory: string
	projectName: string
	projectSlug: string
	prompt: string
	createdAt: number
	status: "pending" | "assigned" | "failed"
	assignedSessionId?: string
	error?: string
}

export interface PmAssignment {
	sessionId: string
	projectDirectory: string
	projectSlug: string
	projectName: string
	sessionTitle: string
}

export interface PmTicketCard {
	id: string
	kind: "ticket"
	status: Extract<PmCardStatus, "active" | "queued" | "blocked">
	title: string
	caption: string
	meta: string[]
	sessionId?: string
	planeUrl?: string
	ticketId?: string
	source: Ch5PmSnapshotTicketRow
}

export interface PmSessionCard {
	id: string
	kind: "session"
	status: Extract<PmCardStatus, "assigned">
	title: string
	caption: string
	meta: string[]
	sessionId: string
	projectSlug: string
	projectDirectory: string
	projectName: string
}

export interface PmPendingCard {
	id: string
	kind: "pending"
	status: Extract<PmCardStatus, "pending">
	title: string
	caption: string
	meta: string[]
	projectSlug: string
	projectDirectory: string
	projectName: string
}

export type PmCard = PmPendingCard | PmSessionCard | PmTicketCard

export interface PmSnapshotBundle {
	activeTickets: Ch5PmSnapshotTicketRow[]
	queueTickets: Ch5PmSnapshotTicketRow[]
	blockedTickets: Ch5PmSnapshotTicketRow[]
}

export interface PmOverviewStats {
	activeSessions: number
	pendingIntakes: number
	activeTickets: number
	queuedTickets: number
	blockedTickets: number
}

export function createPendingSubmission(args: {
	projectDirectory: string
	projectName: string
	projectSlug: string
	prompt: string
}): PmPendingSubmission {
	return {
		id: crypto.randomUUID(),
		projectDirectory: args.projectDirectory,
		projectName: args.projectName,
		projectSlug: args.projectSlug,
		prompt: args.prompt,
		createdAt: Date.now(),
		status: "pending",
	}
}

export function toPendingCard(submission: PmPendingSubmission): PmPendingCard {
	return {
		id: submission.id,
		kind: "pending",
		status: "pending",
		title: trimPrompt(submission.prompt),
		caption: "Assigning PM lane",
		meta: [submission.projectName, formatAge(submission.createdAt)],
		projectSlug: submission.projectSlug,
		projectDirectory: submission.projectDirectory,
		projectName: submission.projectName,
	}
}

export function toSessionCard(assignment: PmAssignment, agent?: Agent | null): PmSessionCard {
	return {
		id: assignment.sessionId,
		kind: "session",
		status: "assigned",
		title: assignment.sessionTitle,
		caption: agent?.currentActivity ?? "Fresh PM session",
		meta: [assignment.projectName, agent?.status ?? "idle"],
		sessionId: assignment.sessionId,
		projectSlug: assignment.projectSlug,
		projectDirectory: assignment.projectDirectory,
		projectName: assignment.projectName,
	}
}

function trimPrompt(prompt: string): string {
	const normalized = prompt.trim()
	if (normalized.length <= 80) return normalized
	return `${normalized.slice(0, 77)}...`
}

function formatAge(createdAt: number): string {
	const elapsedMs = Math.max(0, Date.now() - createdAt)
	const seconds = Math.floor(elapsedMs / 1000)
	if (seconds < 60) return "just now"
	const minutes = Math.floor(seconds / 60)
	if (minutes < 60) return `${minutes}m ago`
	const hours = Math.floor(minutes / 60)
	return `${hours}h ago`
}
