import type { Ch5PmDashboardState, Ch5PmSnapshotTicketRow } from "./ch5pm-dashboard/types"
import type { PmSnapshotBundle, PmTicketCard } from "./project-manager-types"

export interface PmProjectRouteCandidate {
	name: string
	directory: string
	slug: string
}

export interface PmSessionRouteCandidate {
	id: string
	sessionId: string
	projectSlug: string
}

export interface ResolvePmTicketProjectSlugOptions {
	projects: PmProjectRouteCandidate[]
	sessions: PmSessionRouteCandidate[]
	fallbackProjectSlug?: string
}

function readSnapshotTickets(rows: unknown): Ch5PmSnapshotTicketRow[] {
	if (!Array.isArray(rows)) return []
	return rows as Ch5PmSnapshotTicketRow[]
}

export function getPmSnapshotBundle(state: Ch5PmDashboardState): PmSnapshotBundle {
	const snapshot = state.snapshot
	return {
		activeTickets: readSnapshotTickets(snapshot?.activeTickets),
		queueTickets: readSnapshotTickets(snapshot?.queueTickets),
		blockedTickets: readSnapshotTickets(snapshot?.blockedTickets),
	}
}

export function mapSnapshotBundleToCards(bundle: PmSnapshotBundle): PmTicketCard[] {
	return [
		...bundle.activeTickets.map((ticket) => mapTicketRowToCard(ticket, "active")),
		...bundle.queueTickets.map((ticket) => mapTicketRowToCard(ticket, "queued")),
		...bundle.blockedTickets.map((ticket) => mapTicketRowToCard(ticket, "blocked")),
	]
}

export function resolvePmTicketProjectSlug(
	card: PmTicketCard,
	options: ResolvePmTicketProjectSlugOptions,
): string | undefined {
	if (card.sessionId) {
		const session = options.sessions.find(
			(candidate) => candidate.id === card.sessionId || candidate.sessionId === card.sessionId,
		)
		if (session?.projectSlug) return session.projectSlug
	}

	const projectSlugByKey = new Map<string, string>()
	for (const project of options.projects) {
		addProjectRouteKey(projectSlugByKey, project.name, project.slug)
		addProjectRouteKey(projectSlugByKey, directoryName(project.directory), project.slug)
	}

	const ticketKeys = [card.source.repo, card.source.projectName, card.source.projectIdentifier]
	for (const key of ticketKeys) {
		const slug = lookupProjectRouteKey(projectSlugByKey, key)
		if (slug) return slug
	}

	return options.fallbackProjectSlug
}

function mapTicketRowToCard(
	ticket: Ch5PmSnapshotTicketRow,
	status: PmTicketCard["status"],
): PmTicketCard {
	return {
		id: ticket.ticketId ?? ticket.id ?? crypto.randomUUID(),
		kind: "ticket",
		status,
		title: ticket.name ?? ticket.title ?? ticket.ticketId ?? "Untitled PM ticket",
		caption: buildCaption(ticket, status),
		meta: [ticket.ticketId, ticket.repo, ticket.boxId, ticket.slotId].filter(
			(value): value is string => typeof value === "string" && value.length > 0,
		),
		sessionId: ticket.sessionId,
		planeUrl: ticket.planeUrl,
		ticketId: ticket.ticketId,
		source: ticket,
	}
}

function buildCaption(ticket: Ch5PmSnapshotTicketRow, status: PmTicketCard["status"]): string {
	if (status === "blocked") {
		return ticket.classification ? `Blocked · ${ticket.classification}` : "Blocked"
	}
	if (status === "queued") {
		return ticket.priority ? `Queued · ${ticket.priority}` : "Queued"
	}
	return ticket.classification ? `Active · ${ticket.classification}` : "Active"
}

function addProjectRouteKey(map: Map<string, string>, key: string | undefined, slug: string): void {
	const normalized = normalizeProjectRouteKey(key)
	if (normalized) map.set(normalized, slug)
}

function lookupProjectRouteKey(
	map: Map<string, string>,
	key: string | undefined,
): string | undefined {
	const normalized = normalizeProjectRouteKey(key)
	return normalized ? map.get(normalized) : undefined
}

function normalizeProjectRouteKey(key: string | undefined): string | undefined {
	const normalized = key?.trim().toLowerCase()
	return normalized || undefined
}

function directoryName(directory: string): string | undefined {
	return directory.split("/").filter(Boolean).pop()
}
