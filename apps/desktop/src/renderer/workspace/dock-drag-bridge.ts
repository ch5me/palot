import { type DockviewApi, positionToDirection } from "dockview-react"
import type { DockZone } from "../surface-host/types"

/**
 * Cross-zone native drag-and-drop bridge, vendored from the `@ch5me/workspace`
 * `SplitDockExample` story. palot's dock is three independent Dockview instances
 * (one per zone). Dockview only moves panels WITHIN an instance, so to drag a
 * tab from one zone to another we serialize a descriptor onto the native
 * `DragEvent` (MIME `application/x-ch5-panel`), accept the unhandled drag in the
 * target instance, then add the panel there and close it in the source.
 *
 * Crucially, the moved panel is re-created as the SAME slot component
 * (`surface-slot`) carrying the SAME `surfaceInstanceId`, so the underlying
 * surface host is re-attached, never recreated (migration plan §3 North Star).
 */
export const DOCK_DRAG_MIME = "application/x-ch5-panel"

/** Dockview component key for the surface slot. Single component for every panel. */
export const SURFACE_SLOT_COMPONENT = "surface-slot"

/**
 * Serialized payload carried on the native DragEvent during a cross-zone move.
 * Everything needed to recreate the slot panel in the target zone and close it
 * in the source, with no surface recreation.
 */
export interface DockDragDescriptor {
	dockPanelId: string
	title: string
	surfaceInstanceId: string
	surfaceType: string
	sourceZone: DockZone
}

/** A ref-like holder of the per-zone Dockview apis (the source instance closer). */
export interface DockApiRegistry {
	current: Partial<Record<DockZone, DockviewApi>>
}

/** Callback fired after a panel lands in a new zone so the registry can record the move. */
export type DockMoveHandler = (descriptor: DockDragDescriptor, targetZone: DockZone) => void

/**
 * Wire the cross-zone bridge onto one zone's Dockview api. Called once per zone
 * in its `onReady`. `apisRef` lets the drop handler reach the source instance to
 * close the original panel; `onMove` reports the landing zone to the registry.
 */
export function registerDockDragBridge(
	zone: DockZone,
	api: DockviewApi,
	apisRef: DockApiRegistry,
	onMove: DockMoveHandler,
): void {
	api.onWillDragPanel((event) => {
		if (!(event.nativeEvent instanceof DragEvent)) {
			return
		}
		const descriptor = readPanelDescriptor(event.panel.id, api, zone)
		if (!descriptor) {
			return
		}
		event.nativeEvent.dataTransfer?.setData(DOCK_DRAG_MIME, JSON.stringify(descriptor))
	})

	api.onUnhandledDragOverEvent((event) => {
		if (hasDockDragData(event.nativeEvent)) {
			event.accept()
		}
	})

	api.onDidDrop((event) => {
		if (!(event.nativeEvent instanceof DragEvent)) {
			return
		}
		const descriptor = parseDockDragData(event.nativeEvent)
		if (!descriptor || descriptor.sourceZone === zone) {
			return
		}

		if (!api.getPanel(descriptor.dockPanelId)) {
			api.addPanel({
				id: descriptor.dockPanelId,
				title: descriptor.title,
				component: SURFACE_SLOT_COMPONENT,
				params: { surfaceInstanceId: descriptor.surfaceInstanceId },
				position: event.group
					? {
							referenceGroup: event.group,
							direction: positionToDirection(event.position),
						}
					: undefined,
			})
		}

		// Close the original panel in the source zone (host stays mounted).
		apisRef.current[descriptor.sourceZone]?.getPanel(descriptor.dockPanelId)?.api.close()
		onMove(descriptor, zone)
	})
}

/**
 * Build the drag descriptor for a panel from the live Dockview panel params.
 * Returns null when the panel is not a surface slot (e.g. missing params).
 */
function readPanelDescriptor(
	dockPanelId: string,
	api: DockviewApi,
	zone: DockZone,
): DockDragDescriptor | null {
	const panel = api.getPanel(dockPanelId)
	if (!panel) {
		return null
	}
	const params = panel.params as { surfaceInstanceId?: unknown; surfaceType?: unknown } | undefined
	const surfaceInstanceId = params?.surfaceInstanceId
	if (typeof surfaceInstanceId !== "string") {
		return null
	}
	return {
		dockPanelId,
		title: panel.title ?? dockPanelId,
		surfaceInstanceId,
		surfaceType: typeof params?.surfaceType === "string" ? params.surfaceType : "",
		sourceZone: zone,
	}
}

function hasDockDragData(event: DragEvent | PointerEvent): boolean {
	return event instanceof DragEvent && dataTransferHasDockDrag(event.dataTransfer)
}

/** True when a DataTransfer carries a cross-zone dock-panel payload. */
export function dataTransferHasDockDrag(dataTransfer: DataTransfer | null): boolean {
	return !!dataTransfer && Array.from(dataTransfer.types).includes(DOCK_DRAG_MIME)
}

function parseDockDragData(event: DragEvent): DockDragDescriptor | null {
	return parseDockDragDescriptor(event.dataTransfer?.getData(DOCK_DRAG_MIME) ?? null)
}

function parseDockDragDescriptor(raw: string | null): DockDragDescriptor | null {
	if (!raw) {
		return null
	}
	try {
		const parsed = JSON.parse(raw) as Partial<DockDragDescriptor>
		if (
			typeof parsed.dockPanelId !== "string" ||
			typeof parsed.title !== "string" ||
			typeof parsed.surfaceInstanceId !== "string" ||
			typeof parsed.surfaceType !== "string" ||
			!isDockZone(parsed.sourceZone)
		) {
			return null
		}
		return parsed as DockDragDescriptor
	} catch {
		return null
	}
}

/**
 * Apply a cross-zone drop from a raw DataTransfer (used by the empty-zone drop
 * overlay). Dockview's own root drop target refuses panels dragged from another
 * instance, so an EMPTY zone — which has no group drop target to fall back on —
 * can't receive a tab. This re-homes the panel exactly like {@link
 * registerDockDragBridge}'s `onDidDrop`: re-create the same slot here, close the
 * original in its source zone (the surface host stays mounted), record the move.
 */
export function applyCrossZoneDrop(
	zone: DockZone,
	api: DockviewApi,
	apisRef: DockApiRegistry,
	onMove: DockMoveHandler,
	dataTransfer: DataTransfer,
): void {
	const descriptor = parseDockDragDescriptor(dataTransfer.getData(DOCK_DRAG_MIME))
	if (!descriptor || descriptor.sourceZone === zone) {
		return
	}
	if (!api.getPanel(descriptor.dockPanelId)) {
		api.addPanel({
			id: descriptor.dockPanelId,
			title: descriptor.title,
			component: SURFACE_SLOT_COMPONENT,
			params: { surfaceInstanceId: descriptor.surfaceInstanceId },
		})
	}
	apisRef.current[descriptor.sourceZone]?.getPanel(descriptor.dockPanelId)?.api.close()
	onMove(descriptor, zone)
}

function isDockZone(value: unknown): value is DockZone {
	return value === "main" || value === "right" || value === "bottom"
}
