import { useSyncExternalStore } from "react"

/**
 * Live-props bridge for dock surfaces.
 *
 * The Surface Host Registry mounts each surface's React tree exactly ONCE (in the
 * hidden host layer, a different React subtree from `AgentDetail`). A surface's
 * `render()` thunk therefore captures a frozen snapshot of any closed-over props —
 * passing `chatTurns` directly would freeze the chat at its first value.
 *
 * This bridge decouples surface props from the render-once mount: the owner
 * component (`AgentDetail`) publishes the latest props per surface identity every
 * render, and the surface component subscribes via `useSyncExternalStore`, so the
 * already-mounted surface re-renders with fresh props without remounting and
 * without losing live state (scroll, focus, in-flight work).
 *
 * Props are keyed by stable surface `instanceId` so multiple live surfaces (e.g.
 * two chat sessions side by side) each track their own props.
 */
class SurfacePropBridge {
	private readonly props = new Map<string, unknown>()
	private readonly listeners = new Map<string, Set<() => void>>()

	/** Publish the latest props for a surface. Notifies subscribers only on change. */
	publish<T>(instanceId: string, value: T): void {
		if (this.props.get(instanceId) === value) return
		this.props.set(instanceId, value)
		const set = this.listeners.get(instanceId)
		if (set) for (const listener of set) listener()
	}

	getSnapshot<T>(instanceId: string): T | undefined {
		return this.props.get(instanceId) as T | undefined
	}

	subscribe(instanceId: string, listener: () => void): () => void {
		let set = this.listeners.get(instanceId)
		if (!set) {
			set = new Set()
			this.listeners.set(instanceId, set)
		}
		set.add(listener)
		return () => {
			set.delete(listener)
		}
	}
}

/** Process-wide bridge instance. One registry of live surface props. */
export const surfacePropBridge = new SurfacePropBridge()

/**
 * Subscribe to the latest published props for a surface identity. Returns
 * `undefined` until the owner first publishes. Use inside a surface component
 * mounted by the host layer to keep props live across re-renders.
 */
export function useSurfaceProps<T>(instanceId: string): T | undefined {
	return useSyncExternalStore(
		(listener) => surfacePropBridge.subscribe(instanceId, listener),
		() => surfacePropBridge.getSnapshot<T>(instanceId),
	)
}
