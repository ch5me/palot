import { SplitPane } from "@ch5me/workspace"
import {
	type DockviewApi,
	DockviewReact,
	type DockviewReadyEvent,
	type IDockviewPanelProps,
} from "dockview-react"
import { type CSSProperties, type ReactNode, useCallback, useRef, useState } from "react"
import "dockview/dist/styles/dockview.css"

import { useSurfaceRegistry } from "../surface-host/surface-host-provider"
import { DockviewSurfaceSlot } from "../surface-host/surface-outlet"
import type { DockPanelRecord, DockZone } from "../surface-host/types"
import {
	applyCrossZoneDrop,
	type DockApiRegistry,
	type DockDragDescriptor,
	type DockMoveHandler,
	dataTransferHasDockDrag,
	registerDockDragBridge,
	SURFACE_SLOT_COMPONENT,
} from "./dock-drag-bridge"
import {
	DOCK_THEME_CSS,
	dockEmptyLineStyle,
	dockEmptyPlaceholderStyle,
	dockEmptyTitleStyle,
	dockZoneFrameStyle,
	getDockTheme,
	getDockThemeClass,
} from "./dock-theme"

const RIGHT_ZONE_WIDTH = 320
const BOTTOM_ZONE_HEIGHT = 220

/** One surface panel to seed into the dock on first ready. */
export interface DockSeedPanel {
	/** Stable surface identity (e.g. "chat:session-a:view-main"). Also used as the dock panel id. */
	instanceId: string
	surfaceType: string
	title: string
	zone: DockZone
}

export interface DockShellProps {
	/** Surfaces to seed imperatively in each zone's `onReady` (mirrors the story). */
	seedPanels: readonly DockSeedPanel[]
	isDarkMode: boolean
	/** Whether the right zone is shown. Defaults to open. */
	rightZoneOpen?: boolean
	/** Fired when the right zone is collapsed/expanded (toggle or drag-to-collapse). */
	onRightZoneOpenChange?: (open: boolean) => void
	/** Whether the bottom zone is shown. Defaults to open. */
	bottomZoneOpen?: boolean
	onBottomZoneOpenChange?: (open: boolean) => void
	/**
	 * Pinned above the right (side-panel) zone's Dockview surface. Hosts the spawn
	 * toolbar so it stays visible even when no side tabs are open.
	 */
	rightZoneHeader?: ReactNode
	/**
	 * Receives each zone's {@link DockviewApi} as it becomes ready, so a later
	 * persistence phase can call `toJSON`/`fromJSON` per zone. Called once per zone.
	 */
	onZoneApiReady?: (zone: DockZone, api: DockviewApi) => void
}

/**
 * The palot dock shell. Renders three independent Dockview zones (main / right /
 * bottom) inside nested {@link SplitPane} frames, wired together by the cross-zone
 * native-DnD bridge. Each Dockview panel is a {@link DockviewSurfaceSlot} — a
 * lightweight slot that projects an already-mounted surface from the Surface Host
 * Registry. Moving a panel between zones re-attaches the host and records the zone
 * change via `registry.recordDockMove`; it NEVER recreates the surface.
 *
 * This is vendored from the `@ch5me/workspace` `SplitDockExample` story (the
 * package exports no dock component). Heavy content lifetime is owned by the
 * registry, not Dockview — see migration plan §3.
 */
export function DockShell({
	seedPanels,
	isDarkMode,
	rightZoneOpen = true,
	onRightZoneOpenChange,
	bottomZoneOpen = true,
	onBottomZoneOpenChange,
	rightZoneHeader,
	onZoneApiReady,
}: DockShellProps) {
	const registry = useSurfaceRegistry()
	const zoneApisRef = useRef<DockApiRegistry["current"]>({})

	const handleZoneMove = useCallback(
		(descriptor: DockDragDescriptor, targetZone: DockZone) => {
			registry.recordDockMove(descriptor.dockPanelId, targetZone)
		},
		[registry],
	)

	const handleZoneReady = useCallback(
		(zone: DockZone, event: DockviewReadyEvent) => {
			const { api } = event
			zoneApisRef.current[zone] = api
			registerDockDragBridge(zone, api, zoneApisRef, handleZoneMove)
			seedZonePanels(api, registry, zone, seedPanels)
			onZoneApiReady?.(zone, api)
		},
		[registry, seedPanels, handleZoneMove, onZoneApiReady],
	)

	return (
		<div style={dockShellRootStyle}>
			<style>{DOCK_THEME_CSS}</style>
			<SplitPane
				side="right"
				open={rightZoneOpen}
				onOpenChange={onRightZoneOpenChange}
				defaultPanelWidth={RIGHT_ZONE_WIDTH}
				minPanelWidth={220}
				maxPanelWidth={520}
				collapseThreshold={44}
				collapsePreviewLabel="Release to hide right dock"
				handleAriaLabel="Resize right dock zone"
				panel={
					<div style={rightZoneWithHeaderStyle}>
						{rightZoneHeader}
						<div style={rightZoneBodyStyle}>
							<DockZoneSurface
								zone="right"
								isDarkMode={isDarkMode}
								apisRef={zoneApisRef}
								onMove={handleZoneMove}
								onReady={(event) => handleZoneReady("right", event)}
							/>
						</div>
					</div>
				}
			>
				<SplitPane
					side="bottom"
					open={bottomZoneOpen}
					onOpenChange={onBottomZoneOpenChange}
					defaultPanelWidth={BOTTOM_ZONE_HEIGHT}
					minPanelWidth={140}
					maxPanelWidth={420}
					collapseThreshold={44}
					collapsePreviewLabel="Release to hide bottom dock"
					handleAriaLabel="Resize bottom dock zone"
					panel={
						<DockZoneSurface
							zone="bottom"
							isDarkMode={isDarkMode}
							apisRef={zoneApisRef}
							onMove={handleZoneMove}
							onReady={(event) => handleZoneReady("bottom", event)}
						/>
					}
				>
					<DockZoneSurface
						zone="main"
						isDarkMode={isDarkMode}
						apisRef={zoneApisRef}
						onMove={handleZoneMove}
						onReady={(event) => handleZoneReady("main", event)}
					/>
				</SplitPane>
			</SplitPane>
		</div>
	)
}

/** A single Dockview instance for one zone, themed via the workspace tokens. */
function DockZoneSurface({
	zone,
	isDarkMode,
	apisRef,
	onMove,
	onReady,
}: {
	zone: DockZone
	isDarkMode: boolean
	apisRef: DockApiRegistry
	onMove: DockMoveHandler
	onReady: (event: DockviewReadyEvent) => void
}) {
	const apiRef = useRef<DockviewApi | null>(null)
	const [isEmpty, setIsEmpty] = useState(true)

	const handleReady = useCallback(
		(event: DockviewReadyEvent) => {
			apiRef.current = event.api
			const sync = () => setIsEmpty(event.api.panels.length === 0)
			sync()
			event.api.onDidLayoutChange(sync)
			onReady(event)
		},
		[onReady],
	)

	return (
		<div className={getDockThemeClass(isDarkMode)} style={dockZoneFrameStyle}>
			<DockviewReact
				className={`palot-dock palot-dock-${zone}`}
				components={DOCK_COMPONENTS}
				noPanelsOverlay="watermark"
				theme={getDockTheme(isDarkMode)}
				watermarkComponent={() => <DockEmptyPlaceholder zone={zone} />}
				onReady={handleReady}
			/>
			{/* Empty Dockview instances reject panels dragged from another instance
			    (Dockview's root drop target checks viewId), so an empty zone can't
			    catch a cross-zone tab via the normal bridge. This transparent overlay
			    accepts the bridge's drag payload directly and re-homes the panel. */}
			{isEmpty ? (
				<div
					style={emptyZoneDropOverlayStyle}
					onDragOver={(event) => {
						if (!dataTransferHasDockDrag(event.dataTransfer)) {
							return
						}
						event.preventDefault()
						event.dataTransfer.dropEffect = "move"
					}}
					onDrop={(event) => {
						if (!dataTransferHasDockDrag(event.dataTransfer)) {
							return
						}
						event.preventDefault()
						const api = apiRef.current
						if (api) {
							applyCrossZoneDrop(zone, api, apisRef, onMove, event.dataTransfer)
						}
					}}
				/>
			) : null}
		</div>
	)
}

/**
 * Seed the zone's surface panels on first ready. Each panel is added as a
 * `surface-slot` carrying its stable `surfaceInstanceId`, and registered with the
 * Surface Host Registry's dock panel table so future moves update the zone only.
 * Idempotent: panels already present are skipped (e.g. StrictMode re-ready).
 */
function seedZonePanels(
	api: DockviewApi,
	registry: ReturnType<typeof useSurfaceRegistry>,
	zone: DockZone,
	seedPanels: readonly DockSeedPanel[],
): void {
	for (const seed of seedPanels) {
		if (seed.zone !== zone) {
			continue
		}
		if (!api.getPanel(seed.instanceId)) {
			api.addPanel({
				id: seed.instanceId,
				title: seed.title,
				component: SURFACE_SLOT_COMPONENT,
				params: { surfaceInstanceId: seed.instanceId, surfaceType: seed.surfaceType },
			})
		}
		const record: DockPanelRecord = {
			dockPanelId: seed.instanceId,
			zone,
			surfaceInstanceId: seed.instanceId,
			surfaceType: seed.surfaceType,
			title: seed.title,
		}
		registry.registerDockPanel(record)
	}

	// Protect the main zone: never let its last panel be dragged out, which would
	// leave the session with no chat/working surface. Mirrors the SplitDockExample.
	if (zone === "main") {
		api.onWillDragPanel((event) => {
			if (event.panel.group.panels.length === 1) {
				event.nativeEvent.preventDefault()
			}
		})
	}
}

/** Dockview component map: a single slot component for every surface panel. */
const DOCK_COMPONENTS = {
	[SURFACE_SLOT_COMPONENT]: (props: IDockviewPanelProps<{ surfaceInstanceId: string }>) => (
		<DockviewSurfaceSlot params={props.params} />
	),
}

function DockEmptyPlaceholder({ zone }: { zone: DockZone }) {
	const label =
		zone === "main"
			? "Main dock"
			: zone === "right"
				? "Open a tab from the toolbar above"
				: "Drag tabs here for bottom work"

	return (
		<div style={dockEmptyPlaceholderStyle}>
			<div style={dockEmptyTitleStyle}>{label}</div>
			<div style={dockEmptyLineStyle} />
		</div>
	)
}

const dockShellRootStyle: CSSProperties = {
	flex: 1,
	minHeight: 0,
	minWidth: 0,
	overflow: "hidden",
}

// Right zone = optional pinned header (spawn toolbar) stacked above the Dockview
// surface. The body flexes to fill remaining height so the dock never collapses.
const rightZoneWithHeaderStyle: CSSProperties = {
	display: "flex",
	flexDirection: "column",
	height: "100%",
	minHeight: 0,
	minWidth: 0,
}

const rightZoneBodyStyle: CSSProperties = {
	flex: 1,
	minHeight: 0,
	minWidth: 0,
	position: "relative",
}

// Transparent full-area drop catcher for an EMPTY zone. Sits above Dockview's
// watermark (z-index 1) so cross-zone drags land here; removed once the zone has
// a panel (Dockview's own group drop target then handles drops).
const emptyZoneDropOverlayStyle: CSSProperties = {
	inset: 0,
	position: "absolute",
	zIndex: 5,
}
