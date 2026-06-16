import { useSurfaceRegistry } from "./surface-host-provider"

/**
 * Visually-hidden but DOM-connected style for the host layer. The subtree must
 * stay connected (not `display:none` on the whole layer in a way that detaches
 * measurement) so that hidden surfaces keep their layout/measurement context.
 * Individual InPortal hosts are off-screen until projected into a visible slot.
 */
const HIDDEN_LAYER_STYLE: React.CSSProperties = {
	position: "absolute",
	width: 0,
	height: 0,
	overflow: "hidden",
	// Keep it out of the layout/paint flow but still attached to the document.
	pointerEvents: "none",
	contain: "strict",
	left: "-99999px",
	top: 0,
}

/**
 * Renders, OUTSIDE any dock/split tree, one `InPortal` host per live surface so
 * each surface's React tree mounts exactly once and persists for the surface's
 * whole lifetime. Surfaces are projected into visible slots via `SurfaceOutlet`;
 * detaching a slot stops projection but leaves the host mounted here.
 *
 * Mount this once near the app root (a sibling of the dock shell), inside the
 * {@link SurfaceHostProvider}.
 */
export function HiddenSurfaceHostLayer() {
	const registry = useSurfaceRegistry()
	const transport = registry.surfaceTransport
	const instanceIds = transport.useEntries()

	return (
		<div aria-hidden="true" data-surface-host-layer="" style={HIDDEN_LAYER_STYLE}>
			{instanceIds.map((instanceId) => (
				<SurfaceHostNode key={instanceId} instanceId={instanceId} />
			))}
		</div>
	)
}

/**
 * One persistent InPortal host. Subscribes to its transport entry so the host
 * re-renders when the surface's mounted element first becomes available, then
 * stays mounted regardless of which slot (if any) is projecting it.
 */
function SurfaceHostNode({ instanceId }: { instanceId: string }) {
	const registry = useSurfaceRegistry()
	const transport = registry.surfaceTransport
	// Subscribe so the host renders once the element is mounted.
	transport.useEntry(instanceId)
	return <>{transport.renderHost(instanceId)}</>
}
