import type { ReactNode } from "react"

/**
 * Transport seam for moving a mounted surface's live DOM between visible slots
 * without remounting. Implementations keep the host React tree alive across
 * attach/detach; only the destination container changes.
 *
 * The key invariant: {@link SurfaceTransport.detach} stops projecting a surface
 * into a slot but NEVER unmounts the host — the host lives in the hidden layer
 * and survives show/hide/zone-move.
 *
 * The first adapter is `ReversePortalTransport` (react-reverse-portal). A future
 * `NativeMoveBeforeTransport` (Element.prototype.moveBefore) is a progressive
 * enhancement behind feature detection.
 */
export interface SurfaceTransport {
	/** Allocate the transport-level node/handle for a surface. Idempotent per instanceId. */
	createNode(instanceId: string): void
	/** Remember the React element to render through the persistent host. */
	mount(instanceId: string, element: ReactNode): void
	/** Begin projecting the surface's live DOM into `container`. */
	attach(instanceId: string, container: HTMLElement): void
	/** Stop projecting into the current slot. Host stays mounted in the hidden layer. */
	detach(instanceId: string): void
	/** Tear down the node entirely. Only called on real eviction/destroy. */
	destroy(instanceId: string): void
}
