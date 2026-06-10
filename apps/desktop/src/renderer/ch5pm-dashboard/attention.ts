import type {
	Ch5PmAttentionItem,
	Ch5PmAttentionPriority,
	Ch5PmAttentionQueue,
} from "./types"

/**
 * Pure helpers for the AskHuman attention queue panel (CH5COMPAC4C-305).
 * Kept free of React/DOM so they are directly unit-testable.
 */

const PRIORITY_RANK: Record<Ch5PmAttentionPriority, number> = {
	p0: 0,
	p1: 1,
	p2: 2,
}

/**
 * Display order: p0 first, then p1, then p2; newest first within a
 * priority. The daemon already returns open items newest-first, so the
 * sort only needs to be stable on priority.
 */
export function orderAttentionItems(
	items: readonly Ch5PmAttentionItem[],
): Ch5PmAttentionItem[] {
	return [...items].sort(
		(a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
	)
}

/**
 * Open items to render: optimistically-removed ids filtered out, then
 * priority-ordered. `hiddenIds` holds items answered/dismissed locally
 * that the next poll has not yet dropped from the snapshot.
 */
export function visibleAttentionItems(
	queue: Ch5PmAttentionQueue | undefined,
	hiddenIds: ReadonlySet<string>,
): Ch5PmAttentionItem[] {
	if (!queue) return []
	return orderAttentionItems(queue.open.filter((item) => !hiddenIds.has(item.id)))
}

/**
 * Extract a human-readable error from a daemon mutation failure body.
 * Handles both `{ ok: false, error }` (404/409/422 typed errors, 502
 * proxy errors) and the PartialMutationResult envelope whose failure
 * detail lives in `steps[].reason` (422 body validation).
 */
export function extractAttentionErrorMessage(payload: unknown, fallback: string): string {
	if (typeof payload === "object" && payload !== null) {
		const record = payload as Record<string, unknown>
		if (typeof record.error === "string" && record.error.length > 0) {
			return record.error
		}
		if (Array.isArray(record.steps)) {
			for (const step of record.steps) {
				if (typeof step === "object" && step !== null) {
					const reason = (step as Record<string, unknown>).reason
					if (typeof reason === "string" && reason.length > 0) {
						return reason
					}
				}
			}
		}
	}
	return fallback
}

/** Mutation failure carrying the upstream HTTP status (404/409/422/502). */
export class Ch5PmAttentionActionError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message)
		this.name = "Ch5PmAttentionActionError"
	}
}

/** Compact age like the dashboard's fmtAge, but from epoch milliseconds. */
export function fmtAttentionAge(epochMs: number, nowMs: number = Date.now()): string {
	const sec = Math.max(0, Math.floor((nowMs - epochMs) / 1000))
	if (sec < 60) return `${sec}s`
	const min = Math.floor(sec / 60)
	if (min < 60) return `${min}m`
	const hr = Math.floor(min / 60)
	if (hr < 48) return `${hr}h`
	return `${Math.floor(hr / 24)}d`
}
