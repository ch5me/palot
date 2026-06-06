import type { SessionBindingSecretRecord } from "../preload/api"

const secretCache = new Map<string, SessionBindingSecretRecord>()
const viewerUrlCache = new Map<string, string>()

export function setBindingSecret(bindingId: string, viewerAuthToken: string): SessionBindingSecretRecord {
	const record: SessionBindingSecretRecord = {
		bindingId,
		viewerAuthToken,
		updatedAt: Date.now(),
	}
	secretCache.set(bindingId, record)
	return record
}

export function getBindingSecret(bindingId: string): SessionBindingSecretRecord | null {
	return secretCache.get(bindingId) ?? null
}

export function clearBindingSecret(bindingId: string): boolean {
	return secretCache.delete(bindingId)
}

export function setBindingViewerUrl(bindingId: string, viewerUrl: string): void {
	viewerUrlCache.set(bindingId, viewerUrl)
}

export function getBindingViewerUrl(bindingId: string): string | null {
	return viewerUrlCache.get(bindingId) ?? null
}

export function clearBindingViewerUrl(bindingId: string): boolean {
	return viewerUrlCache.delete(bindingId)
}

export function clearAllBindingSecrets(): void {
	secretCache.clear()
	viewerUrlCache.clear()
}
