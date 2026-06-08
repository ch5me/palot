const revisionBySession = new Map<string, number>()

export function getSessionRevision(sessionId: string): number {
	return revisionBySession.get(sessionId) ?? 0
}

export function setSessionRevision(sessionId: string, revision: number): number {
	if (!Number.isInteger(revision) || revision < 0) {
		throw new Error("Revision must be a non-negative integer")
	}
	revisionBySession.set(sessionId, revision)
	return revision
}

export function nextSessionRevision(sessionId: string): number {
	const next = getSessionRevision(sessionId) + 1
	revisionBySession.set(sessionId, next)
	return next
}

export function clearSessionRevision(sessionId: string): void {
	revisionBySession.delete(sessionId)
}
