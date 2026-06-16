import { useLayoutEffect, useRef } from "react"
import { useSurfaceRegistry } from "./surface-host-provider"

const OUTLET_STYLE: React.CSSProperties = {
	position: "relative",
	width: "100%",
	height: "100%",
	minWidth: 0,
	minHeight: 0,
	overflow: "hidden",
}

export interface SurfaceOutletProps {
	/** Stable identity of the surface to project into this slot. */
	surfaceInstanceId: string
}

/**
 * A visible slot that projects an already-mounted surface (from the hidden host
 * layer) into the dock. On mount it attaches the surface to this container
 * (`registry.attachSlot`); on unmount it DETACHES (never destroys) so the host
 * survives the move. A `ResizeObserver` forwards slot resizes to the surface
 * controller. The surface's live DOM is projected via the transport's OutPortal.
 */
export function SurfaceOutlet({ surfaceInstanceId }: SurfaceOutletProps) {
	const registry = useSurfaceRegistry()
	const transport = registry.surfaceTransport
	const containerRef = useRef<HTMLDivElement | null>(null)
	// Subscribe so the projection re-renders when the surface's node appears.
	transport.useEntry(surfaceInstanceId)

	useLayoutEffect(() => {
		const el = containerRef.current
		if (!el) return

		registry.attachSlot(surfaceInstanceId, el)

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0]
			if (entry) registry.reportResize(surfaceInstanceId, entry.contentRect)
		})
		observer.observe(el)

		return () => {
			observer.disconnect()
			// DETACH, not destroy — the host stays mounted in the hidden layer.
			registry.detachSlot(surfaceInstanceId)
		}
	}, [registry, surfaceInstanceId])

	return (
		<div ref={containerRef} data-surface-outlet={surfaceInstanceId} style={OUTLET_STYLE}>
			{transport.renderProjection(surfaceInstanceId)}
		</div>
	)
}

/** Dockview panel params carrying the surface identity for the slot. */
export interface DockviewSurfaceSlotParams {
	surfaceInstanceId: string
}

/**
 * Thin Dockview panel component: reads `params.surfaceInstanceId` and renders a
 * {@link SurfaceOutlet}. The Dockview panel is purely a slot — moving it between
 * zones re-attaches the same host rather than recreating the surface.
 */
export function DockviewSurfaceSlot({ params }: { params: DockviewSurfaceSlotParams }) {
	return <SurfaceOutlet surfaceInstanceId={params.surfaceInstanceId} />
}
