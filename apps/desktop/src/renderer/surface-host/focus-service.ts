/**
 * Explicit focus coordination for surfaces. Browser focus does NOT survive DOM
 * moves between dock zones, so each surface registers how to focus its primary
 * input and how to save/restore focus state. Callers request focus by stable
 * instance id and a reason (telemetry/debug), never by poking the DOM directly.
 */

export interface FocusRequestOptions {
	/** Why focus is being requested, e.g. "tab-activated", "command-open". */
	reason: string
}

/** Per-surface focus capabilities, registered when a surface mounts. */
export interface SurfaceFocusHandlers {
	/** Move focus to the surface's primary interactive element. */
	focusPrimary(reason: string): void
	/** Capture current focus state before a move/hide. */
	saveFocusState(): void
	/** Restore previously captured focus state after a move/show. */
	restoreFocusState(): void
}

class FocusService {
	private readonly handlers = new Map<string, SurfaceFocusHandlers>()

	/** Register focus handlers for a surface. Returns an unregister fn. */
	register(instanceId: string, handlers: SurfaceFocusHandlers): () => void {
		this.handlers.set(instanceId, handlers)
		return () => {
			// Only remove if still the same handler set (guards StrictMode re-register).
			if (this.handlers.get(instanceId) === handlers) {
				this.handlers.delete(instanceId)
			}
		}
	}

	/** Focus a surface's primary element, if it has registered handlers. */
	requestFocus(instanceId: string, options: FocusRequestOptions): void {
		this.handlers.get(instanceId)?.focusPrimary(options.reason)
	}

	/** Save a surface's focus state ahead of a move/hide. */
	saveFocusState(instanceId: string): void {
		this.handlers.get(instanceId)?.saveFocusState()
	}

	/** Restore a surface's focus state after a move/show. */
	restoreFocusState(instanceId: string): void {
		this.handlers.get(instanceId)?.restoreFocusState()
	}
}

/** App-wide singleton focus service. */
export const focusService = new FocusService()
