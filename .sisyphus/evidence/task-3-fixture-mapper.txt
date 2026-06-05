import type { Ch5PmDashboardState, Ch5PmSnapshotTicketRow } from "./ch5pm-dashboard/types"
import type { PmSnapshotBundle, PmTicketCard } from "./project-manager-types"

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
