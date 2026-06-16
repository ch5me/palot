/**
 * Surface Host object model.
 *
 * The Surface Host Registry keeps heavy React/DOM surfaces MOUNTED by stable
 * identity (see {@link SurfaceInstance.instanceId}). A Dockview panel is only a
 * lightweight slot that ATTACHES to an already-mounted host; moving or revealing
 * a panel never recreates the host. These types describe that durable model,
 * kept separate from Dockview's own ephemeral layout state.
 */

/**
 * Visibility of a surface relative to the dock.
 * - `visible`: attached to a slot the user can currently see.
 * - `hidden`: mounted and alive in the hidden host layer, not currently shown.
 * - `detached`: no slot is currently projecting it (still mounted in the host).
 */
export type SurfaceVisibility = "visible" | "hidden" | "detached"

/** Dock zones the host owns. Plugins contribute panels into these; they do not mint zones. */
export type DockZone = "main" | "right" | "bottom"

/**
 * Semantic scroll anchor for virtualized/scroll-heavy surfaces. Stored
 * semantically rather than as raw `scrollTop` because content heights change
 * after async loads (images, code, diffs).
 */
export type ScrollAnchor =
	| { mode: "pinned-to-bottom" }
	| { mode: "anchored-message"; messageId: string; offsetPx: number }
	| { mode: "scroll-top"; top: number }

/**
 * A durable, app-owned surface. Mounted exactly once into the hidden host layer
 * and projected into zero or more visible slots over its lifetime.
 */
export interface SurfaceInstance {
	/** Stable identity key, e.g. "chat:session-a:view-main". NEVER a Dockview panel id. */
	instanceId: string
	type: "chat" | "editor" | "terminal" | "browser" | (string & {})
	title: string
	createdAt: number
	/** Number of slots currently requesting this surface stay alive/attached. */
	retainCount: number
	visibility: SurfaceVisibility
	lastFocusedAt?: number
	/**
	 * Timestamp (ms, injected clock) at which the surface became detached/hidden
	 * with retainCount === 0. Set by detachSlot when the retain count drops to zero;
	 * cleared by attachSlot / getOrCreate when the surface is re-attached. Used by
	 * the eviction sweep to enforce destroyAfterHiddenMs policies.
	 */
	hiddenAt?: number
	/** Semantic scroll position, restored on attach. */
	scroll?: ScrollAnchor
	/** Opaque per-surface focus target identifier. */
	focusTarget?: string
	layout?: { width: number; height: number; dpr: number }
}

/**
 * A Dockview panel record. Dockview owns `dockPanelId` and `zone` (ephemeral
 * layout); the app owns `surfaceInstanceId` (durable identity). A tab move
 * updates `zone` ONLY — it must never recreate the {@link SurfaceInstance}.
 */
export interface DockPanelRecord {
	/** Dockview-owned, ephemeral. */
	dockPanelId: string
	zone: DockZone
	surfaceInstanceId: string
	surfaceType: string
	title: string
}
