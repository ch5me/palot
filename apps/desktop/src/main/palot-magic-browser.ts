import { createHash } from "node:crypto"
import type { BrowserLane } from "../shared/browser-lanes"
import type { SessionBinding } from "../preload/api"
import { getBrowserLane } from "./browser-lane-manager"
import { createLogger } from "./logger"
import {
	clearBindingViewerUrl,
	getBindingSecret,
	getBindingViewerUrl,
	setBindingSecret,
	setBindingViewerUrl,
} from "./palot-secret-cache"
import { getSessionBindingByOpenCodeSession, upsertSessionBinding } from "./palot-session-binding"
import {
	startRemoteCdpSession as defaultStartRemoteCdpSession,
	stopSession as defaultStopSession,
} from "./palot-magic-browser-engine"

const log = createLogger("palot-magic-browser")

/**
 * Injectable seams for tests. Defaults wire the real lane manager, binding
 * store, and Magic Browser engine; tests pass fakes to exercise the streamed /
 * iframe / re-attach routing without filesystem or CLI side effects.
 */
export interface EnsureMagicBrowserDeps {
	getBinding?: (sessionId: string) => SessionBinding | null
	getLane?: (laneId: string) => Promise<BrowserLane | null>
	persistBinding?: (binding: SessionBinding) => SessionBinding
	startRemoteCdpSession?: typeof defaultStartRemoteCdpSession
	stopSession?: typeof defaultStopSession
}

/**
 * Main-only record of which lane CDP endpoint a persisted Magic Browser session
 * was created against. The CDP url is immutable per Magic Browser session, so a
 * lane restart (new CDP port) makes the stored session stale and we must
 * re-attach. Kept here (in-memory, main process) rather than in the persisted
 * binding JSON because CDP endpoints are a secret-class transport detail that
 * must never enter persisted binding JSON, tool output, or renderer state.
 */
const sessionCdpEndpointByBinding = new Map<string, string>()

function buildViewerToken(bindingId: string): string {
	return `viewer_${createHash("sha1").update(`${bindingId}:viewer`).digest("hex").slice(0, 16)}`
}

function buildViewerUrl(laneId: string, token: string): string {
	return `http://elf-browser-lane.local/browser/${laneId}/?viewer=${token}`
}

/**
 * A streamed lane is one Magic Browser can drive over CDP: selkies-stream
 * (docker-chromium) OR any remote-attached lane that exposes a cdpEndpoint.
 * Direct-iframe lanes have no CDP surface and never get a Magic Browser session.
 */
function isStreamedLane(lane: BrowserLane): boolean {
	return lane.surfaceKind === "selkies-stream" || !!lane.cdpEndpoint
}

/**
 * Ensure a Magic Browser session exists for a session's bound lane.
 *
 * - Streamed lane: start a real remote-cdp Magic Browser session against the
 *   lane's CDP endpoint and persist the returned UUID. If the lane's CDP
 *   endpoint changed since the stored session was created (lane restart), stop
 *   the stale session and start a fresh one (P2.3 re-attach).
 * - Direct-iframe lane: do NOT start a Magic Browser session (navigate-only).
 */
export async function ensureMagicBrowserSessionForBinding(
	sessionId: string,
	deps: EnsureMagicBrowserDeps = {},
): Promise<SessionBinding | null> {
	const getBinding = deps.getBinding ?? getSessionBindingByOpenCodeSession
	const getLane = deps.getLane ?? getBrowserLane
	const persistBinding = deps.persistBinding ?? upsertSessionBinding
	const startSession = deps.startRemoteCdpSession ?? defaultStartRemoteCdpSession
	const stopSessionFn = deps.stopSession ?? defaultStopSession

	const binding = getBinding(sessionId)
	if (!binding?.browserLaneId) return null
	const lane = await getLane(binding.browserLaneId)
	if (!lane) return null

	const token = buildViewerToken(binding.id)
	setBindingSecret(binding.id, token)
	setBindingViewerUrl(binding.id, buildViewerUrl(binding.browserLaneId, token))

	if (!isStreamedLane(lane)) {
		// Direct-iframe lane: navigate-only, no Magic Browser session.
		if (binding.magicBrowserSessionId) {
			await safeStopSession(binding.id, binding.magicBrowserSessionId, stopSessionFn)
		}
		return persistBinding({
			...binding,
			magicBrowserSessionId: null,
			status: binding.status === "released" ? "restored" : binding.status,
			releasedAt: null,
		})
	}

	if (!lane.cdpEndpoint) {
		throw new Error(
			`Streamed browser lane "${lane.id}" has no cdpEndpoint; cannot start a Magic Browser session.`,
		)
	}

	const magicBrowserSessionId = await ensureRemoteSession(
		binding,
		lane.id,
		lane.cdpEndpoint,
		lane.health.stream.url,
		startSession,
		stopSessionFn,
	)

	return persistBinding({
		...binding,
		magicBrowserSessionId,
		status: binding.status === "released" ? "restored" : binding.status,
		releasedAt: null,
	})
}

/**
 * Return the live Magic Browser session id for the binding, recreating it if the
 * lane's CDP endpoint changed (lane restart). Starts one if none exists yet.
 */
async function ensureRemoteSession(
	binding: SessionBinding,
	laneId: string,
	cdpEndpoint: string,
	liveUrl: string | null,
	startSession: typeof defaultStartRemoteCdpSession,
	stopSessionFn: typeof defaultStopSession,
): Promise<string> {
	const existingSessionId = binding.magicBrowserSessionId
	const boundEndpoint = sessionCdpEndpointByBinding.get(binding.id)
	const endpointUnchanged = existingSessionId && boundEndpoint === cdpEndpoint

	if (existingSessionId && endpointUnchanged) {
		return existingSessionId
	}

	if (existingSessionId && !endpointUnchanged) {
		// Lane restarted (new CDP port) or we lost the endpoint record: the stored
		// session is stale. Detach it before starting a fresh one.
		log.info("Magic Browser lane CDP endpoint changed; re-attaching session", {
			bindingId: binding.id,
			laneId,
			previousEndpoint: boundEndpoint ?? null,
			nextEndpoint: cdpEndpoint,
		})
		await safeStopSession(binding.id, existingSessionId, stopSessionFn)
	}

	const { magicBrowserSessionId } = await startSession({
		laneId,
		cdpEndpoint,
		liveUrl,
		knowledgeMode: "local-only",
	})
	sessionCdpEndpointByBinding.set(binding.id, cdpEndpoint)
	log.info("Started Magic Browser session", { bindingId: binding.id, laneId })
	return magicBrowserSessionId
}

/** Detach a Magic Browser session, swallowing errors (detach is best-effort). */
async function safeStopSession(
	bindingId: string,
	magicBrowserSessionId: string,
	stopSessionFn: typeof defaultStopSession,
): Promise<void> {
	try {
		await stopSessionFn(magicBrowserSessionId)
	} catch (error) {
		log.warn("Failed to stop stale Magic Browser session", {
			bindingId,
			magicBrowserSessionId,
			error: error instanceof Error ? error.message : String(error),
		})
	}
	sessionCdpEndpointByBinding.delete(bindingId)
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
	sessionCdpEndpointByBinding.delete(binding.id)
}

/** Test-only: clear the in-memory CDP-endpoint tracking between cases. */
export function __resetMagicBrowserSessionTracking(): void {
	sessionCdpEndpointByBinding.clear()
}
