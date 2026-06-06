import { createHash } from "node:crypto"
import type { SessionBinding } from "../preload/api"
import { getBrowserLane } from "./browser-lane-manager"
import {
	clearBindingViewerUrl,
	getBindingSecret,
	getBindingViewerUrl,
	setBindingSecret,
	setBindingViewerUrl,
} from "./palot-secret-cache"
import { getSessionBindingByOpenCodeSession, upsertSessionBinding } from "./palot-session-binding"

function buildMagicBrowserSessionId(bindingId: string): string {
	return `mb_${createHash("sha1").update(bindingId).digest("hex").slice(0, 12)}`
}

function buildViewerToken(bindingId: string): string {
	return `viewer_${createHash("sha1").update(`${bindingId}:viewer`).digest("hex").slice(0, 16)}`
}

function buildViewerUrl(laneId: string, token: string): string {
	return `http://elf-browser-lane.local/browser/${laneId}/?viewer=${token}`
}

export async function ensureMagicBrowserSessionForBinding(sessionId: string): Promise<SessionBinding | null> {
	const binding = getSessionBindingByOpenCodeSession(sessionId)
	if (!binding?.browserLaneId) return null
	const lane = await getBrowserLane(binding.browserLaneId)
	if (!lane) return null
	const magicBrowserSessionId = binding.magicBrowserSessionId ?? buildMagicBrowserSessionId(binding.id)
	const token = buildViewerToken(binding.id)
	setBindingSecret(binding.id, token)
	setBindingViewerUrl(binding.id, buildViewerUrl(binding.browserLaneId, token))
	return upsertSessionBinding({
		...binding,
		magicBrowserSessionId,
		status: binding.status === "released" ? "restored" : binding.status,
		releasedAt: null,
	})
}

export function getDerivedViewerUrlForBinding(sessionId: string): string | null {
	const binding = getSessionBindingByOpenCodeSession(sessionId)
	if (!binding) return null
	return getBindingViewerUrl(binding.id)
}

export function inspectBindingPersistenceSurface(sessionId: string): {
	binding: SessionBinding | null
	viewerUrl: string | null
	hasSecret: boolean
} {
	const binding = getSessionBindingByOpenCodeSession(sessionId)
	if (!binding) {
		return { binding: null, viewerUrl: null, hasSecret: false }
	}
	return {
		binding,
		viewerUrl: getBindingViewerUrl(binding.id),
		hasSecret: !!getBindingSecret(binding.id),
	}
}

export function clearMagicBrowserViewerState(sessionId: string): void {
	const binding = getSessionBindingByOpenCodeSession(sessionId)
	if (!binding) return
	clearBindingViewerUrl(binding.id)
}
