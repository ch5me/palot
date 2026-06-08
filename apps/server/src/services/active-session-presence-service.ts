import type { ActiveOpenCodeSessionsSnapshot } from "./opencode-active-sessions"
import {
	buildActiveSessionSnapshotKey,
	getActiveOpenCodeSessions,
} from "./opencode-active-sessions"

const ACTIVE_PRESENCE_FAST_POLL_MS = 1000
const ACTIVE_PRESENCE_MEDIUM_POLL_MS = 2000
const ACTIVE_PRESENCE_STABLE_POLL_MS = 5000
const ACTIVE_PRESENCE_ERROR_BASE_POLL_MS = 1000
const ACTIVE_PRESENCE_ERROR_MAX_POLL_MS = 30_000
const ACTIVE_PRESENCE_DEFAULT_MAX_AGE_MS = 5000

export interface ActiveSessionPresenceListener {
	onSnapshot: (snapshot: ActiveOpenCodeSessionsSnapshot) => void
	onError?: (error: Error) => void
}

export interface ActiveSessionPresenceServiceDeps {
	collect?: (serverUrl: string) => Promise<ActiveOpenCodeSessionsSnapshot>
	now?: () => number
	setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
	clearTimer?: (timer: ReturnType<typeof setTimeout>) => void
	subscribeNative?: (
		serverUrl: string,
		onSnapshot: (snapshot: ActiveOpenCodeSessionsSnapshot) => void,
		onError: (error: Error) => void,
	) => (() => void) | null
}

interface ServerPresenceState {
	serverUrl: string
	listeners: Set<ActiveSessionPresenceListener>
	snapshot: ActiveOpenCodeSessionsSnapshot | null
	lastSnapshotKey: string | null
	lastRefreshAt: number
	pollPromise: Promise<ActiveOpenCodeSessionsSnapshot> | null
	timer: ReturnType<typeof setTimeout> | null
	sourceStarted: boolean
	nativeCleanup: (() => void) | null
	stablePolls: number
	consecutiveErrors: number
}

export function getActivePresencePollDelayMs(stablePolls: number): number {
	if (stablePolls <= 0) return ACTIVE_PRESENCE_FAST_POLL_MS
	if (stablePolls === 1) return ACTIVE_PRESENCE_MEDIUM_POLL_MS
	return ACTIVE_PRESENCE_STABLE_POLL_MS
}

export function getActivePresenceErrorPollDelayMs(consecutiveErrors: number): number {
	const exponent = Math.max(0, consecutiveErrors - 1)
	return Math.min(
		ACTIVE_PRESENCE_ERROR_MAX_POLL_MS,
		ACTIVE_PRESENCE_ERROR_BASE_POLL_MS * 2 ** exponent,
	)
}

/**
 * Future native path. OpenCode needs server-owned client lifecycle events before
 * Palot can remove local process scans. Expected event shapes:
 * client.connected, client.disconnected, client.session.selected.
 */
export function trySubscribeNativeOpenCodePresence(
	_serverUrl: string,
	_onSnapshot: (snapshot: ActiveOpenCodeSessionsSnapshot) => void,
	_onError: (error: Error) => void,
): (() => void) | null {
	return null
}

export function createActiveSessionPresenceService(deps: ActiveSessionPresenceServiceDeps = {}) {
	const states = new Map<string, ServerPresenceState>()
	const collect = deps.collect ?? getActiveOpenCodeSessions
	const now = deps.now ?? Date.now
	const setTimer = deps.setTimer ?? setTimeout
	const clearTimer = deps.clearTimer ?? clearTimeout
	const subscribeNative = deps.subscribeNative ?? trySubscribeNativeOpenCodePresence

	const getState = (serverUrl: string): ServerPresenceState => {
		const existing = states.get(serverUrl)
		if (existing) return existing

		const state: ServerPresenceState = {
			serverUrl,
			listeners: new Set(),
			snapshot: null,
			lastSnapshotKey: null,
			lastRefreshAt: 0,
			pollPromise: null,
			timer: null,
			sourceStarted: false,
			nativeCleanup: null,
			stablePolls: 0,
			consecutiveErrors: 0,
		}
		states.set(serverUrl, state)
		return state
	}

	const emitSnapshot = (
		state: ServerPresenceState,
		snapshot: ActiveOpenCodeSessionsSnapshot,
	): void => {
		for (const listener of state.listeners) {
			try {
				listener.onSnapshot(snapshot)
			} catch {}
		}
	}

	const emitError = (state: ServerPresenceState, error: Error): void => {
		for (const listener of state.listeners) {
			try {
				listener.onError?.(error)
			} catch {}
		}
	}

	const scheduleNext = (state: ServerPresenceState): void => {
		if (!state.sourceStarted || state.nativeCleanup || state.listeners.size === 0) return
		if (state.timer) clearTimer(state.timer)

		const delayMs =
			state.consecutiveErrors > 0
				? getActivePresenceErrorPollDelayMs(state.consecutiveErrors)
				: getActivePresencePollDelayMs(state.stablePolls)

		state.timer = setTimer(() => {
			state.timer = null
			void refreshNow(state.serverUrl).catch(() => {})
		}, delayMs)
	}

	const refreshNow = async (
		serverUrl: string,
		options: { emitIfUnchanged?: boolean } = {},
	): Promise<ActiveOpenCodeSessionsSnapshot> => {
		const state = getState(serverUrl)
		if (state.pollPromise) return state.pollPromise

		state.pollPromise = (async () => {
			try {
				const snapshot = await collect(serverUrl)
				const nextKey = buildActiveSessionSnapshotKey(snapshot)
				const changed = nextKey !== state.lastSnapshotKey

				state.snapshot = snapshot
				state.lastSnapshotKey = nextKey
				state.lastRefreshAt = now()
				state.consecutiveErrors = 0
				state.stablePolls = changed ? 0 : state.stablePolls + 1

				if (changed || options.emitIfUnchanged) {
					emitSnapshot(state, snapshot)
				}

				return snapshot
			} catch (error) {
				const nextError = error instanceof Error ? error : new Error(String(error))
				state.consecutiveErrors += 1
				emitError(state, nextError)
				throw nextError
			} finally {
				state.pollPromise = null
				scheduleNext(state)
			}
		})()

		return state.pollPromise
	}

	const startSource = (state: ServerPresenceState): void => {
		if (state.sourceStarted) return
		state.sourceStarted = true

		const nativeCleanup = subscribeNative(
			state.serverUrl,
			(snapshot) => {
				state.snapshot = snapshot
				state.lastSnapshotKey = buildActiveSessionSnapshotKey(snapshot)
				state.lastRefreshAt = now()
				state.consecutiveErrors = 0
				state.stablePolls = 0
				emitSnapshot(state, snapshot)
			},
			(error) => emitError(state, error),
		)

		if (nativeCleanup) {
			state.nativeCleanup = nativeCleanup
			void refreshNow(state.serverUrl, { emitIfUnchanged: !state.snapshot }).catch(() => {})
			return
		}

		void refreshNow(state.serverUrl, { emitIfUnchanged: !state.snapshot }).catch(() => {})
	}

	const stopSource = (state: ServerPresenceState): void => {
		if (state.timer) {
			clearTimer(state.timer)
			state.timer = null
		}
		state.nativeCleanup?.()
		state.nativeCleanup = null
		state.sourceStarted = false
		state.stablePolls = 0
		state.consecutiveErrors = 0
	}

	return {
		async getSnapshot(
			serverUrl: string,
			options: { maxAgeMs?: number } = {},
		): Promise<ActiveOpenCodeSessionsSnapshot> {
			const state = getState(serverUrl)
			const maxAgeMs = options.maxAgeMs ?? ACTIVE_PRESENCE_DEFAULT_MAX_AGE_MS
			if (state.snapshot && now() - state.lastRefreshAt <= maxAgeMs) {
				return state.snapshot
			}

			return refreshNow(serverUrl, { emitIfUnchanged: false })
		},
		refreshNow,
		subscribe(serverUrl: string, listener: ActiveSessionPresenceListener): () => void {
			const state = getState(serverUrl)
			state.listeners.add(listener)

			if (state.snapshot) {
				listener.onSnapshot(state.snapshot)
			}

			startSource(state)

			return () => {
				state.listeners.delete(listener)
				if (state.listeners.size === 0) stopSource(state)
			}
		},
		stop(serverUrl: string): void {
			const state = states.get(serverUrl)
			if (!state) return
			stopSource(state)
			state.listeners.clear()
		},
		stopAll(): void {
			for (const state of states.values()) {
				stopSource(state)
				state.listeners.clear()
			}
		},
	}
}

export const activeSessionPresenceService = createActiveSessionPresenceService()
