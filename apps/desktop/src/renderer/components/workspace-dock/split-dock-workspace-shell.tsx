import { SplitPane } from "@ch5me/workspace"
import {
	DockviewReact,
	type DockviewApi,
	type DockviewReadyEvent,
	type IDockviewPanelProps,
	positionToDirection,
} from "dockview"
import { type FunctionComponent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	canDragSplitDockPanel,
	type SplitDockPanelProtection,
	type SplitDockZone,
} from "./split-dock-protection"

const SPLIT_DOCK_DRAG_MIME = "application/x-palot-split-dock-panel"
const RIGHT_DOCK_WIDTH = 392
const BOTTOM_DOCK_HEIGHT = 196

export interface SplitDockPanelDescriptor {
	id: string
	title: string
	zone: SplitDockZone
	component: string
	content: ReactNode
	initialWidth?: number
	initialHeight?: number
	protection?: SplitDockPanelProtection
}

export interface SplitDockWorkspaceShellProps {
	panels: SplitDockPanelDescriptor[]
	rightDockOpen: boolean
	bottomDockOpen: boolean
	rightDockWidth?: number
	onRightDockOpenChange?: (open: boolean) => void
	onBottomDockOpenChange?: (open: boolean) => void
}

interface SplitDockDragPayload {
	id: string
	title: string
	component: string
	sourceZone: SplitDockZone
}

interface ZoneDockSurfaceProps {
	zone: SplitDockZone
	panels: SplitDockPanelDescriptor[]
	components: Record<string, FunctionComponent<IDockviewPanelProps>>
	onReady: (zone: SplitDockZone, event: DockviewReadyEvent) => void
}

export function SplitDockWorkspaceShell({
	panels,
	rightDockOpen,
	bottomDockOpen,
	rightDockWidth = RIGHT_DOCK_WIDTH,
	onRightDockOpenChange,
	onBottomDockOpenChange,
}: SplitDockWorkspaceShellProps) {
	const panelsByZone = useMemo(() => groupPanelsByZone(panels), [panels])
	const dockApisRef = useRef<Partial<Record<SplitDockZone, DockviewApi>>>({})

	const panelDescriptorsById = useMemo(() => {
		const entries = panels.map((panel) => [panel.id, panel] as const)
		return new Map(entries)
	}, [panels])

	const components = useMemo<Record<string, FunctionComponent<IDockviewPanelProps>>>(() => {
		return Object.fromEntries(
			panels.map((panel) => [
				panel.component,
				function SplitDockPanel() {
					return <div className="h-full min-h-0 min-w-0 overflow-hidden bg-background">{panel.content}</div>
				},
			]),
		)
	}, [panels])

	const handleReady = useCallback(
		(zone: SplitDockZone, event: DockviewReadyEvent) => {
			dockApisRef.current[zone] = event.api
			registerSplitDockBridge(zone, event.api, dockApisRef, panelDescriptorsById)
			reconcileZonePanels(event.api, panelsByZone[zone])
		},
		[panelDescriptorsById, panelsByZone],
	)

	return (
		<div data-slot="split-dock-workspace" className="h-full min-h-0 min-w-0 overflow-hidden">
			<SplitPane
				side="right"
				open={rightDockOpen}
				onOpenChange={onRightDockOpenChange}
				defaultPanelWidth={rightDockWidth}
				minPanelWidth={280}
				maxPanelWidth={760}
				handleAriaLabel="Resize workspace right dock"
				panel={
					<ZoneDockSurface
						zone="right"
						panels={panelsByZone.right}
						components={components}
						onReady={handleReady}
					/>
				}
			>
				<SplitPane
					side="bottom"
					open={bottomDockOpen}
					onOpenChange={onBottomDockOpenChange}
					defaultPanelWidth={BOTTOM_DOCK_HEIGHT}
					minPanelWidth={140}
					maxPanelWidth={420}
					collapseThreshold={44}
					collapsePreviewLabel="Release to hide bottom dock"
					handleAriaLabel="Resize workspace bottom dock"
					panel={
						<ZoneDockSurface
							zone="bottom"
							panels={panelsByZone.bottom}
							components={components}
							onReady={handleReady}
						/>
					}
				>
					<ZoneDockSurface
						zone="main"
						panels={panelsByZone.main}
						components={components}
						onReady={handleReady}
					/>
				</SplitPane>
			</SplitPane>
		</div>
	)
}

function ZoneDockSurface({ zone, panels, components, onReady }: ZoneDockSurfaceProps) {
	const [readyEvent, setReadyEvent] = useState<DockviewReadyEvent | null>(null)

	const handleReady = useCallback(
		(event: DockviewReadyEvent) => {
			setReadyEvent(event)
			onReady(zone, event)
		},
		[onReady, zone],
	)

	useEffect(() => {
		if (!readyEvent) {
			return
		}

		reconcileZonePanels(readyEvent.api, panels)
	}, [panels, readyEvent])

	return (
		<div className="dockview-theme-light dark:dockview-theme-dark h-full min-h-0 min-w-0 bg-background">
			<DockviewReact
				className="h-full w-full"
				components={components}
				noPanelsOverlay="watermark"
				onReady={handleReady}
			/>
		</div>
	)
}

function groupPanelsByZone(panels: SplitDockPanelDescriptor[]): Record<SplitDockZone, SplitDockPanelDescriptor[]> {
	return {
		main: panels.filter((panel) => panel.zone === "main"),
		right: panels.filter((panel) => panel.zone === "right"),
		bottom: panels.filter((panel) => panel.zone === "bottom"),
	}
}

function reconcileZonePanels(api: DockviewApi, panels: SplitDockPanelDescriptor[]) {
	for (const panel of panels) {
		if (api.getPanel(panel.id)) {
			continue
		}

		api.addPanel({
			id: panel.id,
			title: panel.title,
			component: panel.component,
			initialWidth: panel.initialWidth,
			initialHeight: panel.initialHeight,
		})
	}
}

function registerSplitDockBridge(
	zone: SplitDockZone,
	api: DockviewApi,
	apisRef: { current: Partial<Record<SplitDockZone, DockviewApi>> },
	panelDescriptorsById: Map<string, SplitDockPanelDescriptor>,
) {
	api.onWillDragPanel((event) => {
		if (!(event.nativeEvent instanceof DragEvent)) {
			return
		}

		const descriptor = panelDescriptorsById.get(event.panel.id)
		if (!descriptor) {
			return
		}

		if (
			!canDragSplitDockPanel({
				zone,
				panel: event.panel,
				api,
				protection: descriptor.protection,
			})
		) {
			event.nativeEvent.preventDefault()
			return
		}

		event.nativeEvent.dataTransfer?.setData(
			SPLIT_DOCK_DRAG_MIME,
			JSON.stringify({
				id: descriptor.id,
				title: descriptor.title,
				component: descriptor.component,
				sourceZone: zone,
			}),
		)
	})

	api.onUnhandledDragOverEvent((event) => {
		if (!hasSplitDockDragData(event.nativeEvent)) {
			return
		}

		event.accept()
	})

	api.onDidDrop((event) => {
		if (!(event.nativeEvent instanceof DragEvent)) {
			return
		}

		const payload = parseSplitDockDragData(event.nativeEvent, panelDescriptorsById)
		if (!payload || payload.sourceZone === zone) {
			return
		}

		const descriptor = panelDescriptorsById.get(payload.id)
		if (!descriptor) {
			return
		}

		if (descriptor.protection?.requiredZone && descriptor.protection.requiredZone !== zone) {
			return
		}

		if (!api.getPanel(payload.id)) {
			api.addPanel({
				id: payload.id,
				title: payload.title,
				component: payload.component,
				position: event.group
					? {
							referenceGroup: event.group,
							direction: positionToDirection(event.position),
						}
					: undefined,
			})
		}

		const sourceApi = apisRef.current[payload.sourceZone]
		sourceApi?.getPanel(payload.id)?.api.close()
	})
}

function hasSplitDockDragData(event: DragEvent | PointerEvent) {
	return event instanceof DragEvent && Array.from(event.dataTransfer?.types ?? []).includes(SPLIT_DOCK_DRAG_MIME)
}

function parseSplitDockDragData(
	event: DragEvent,
	panelDescriptorsById: Map<string, SplitDockPanelDescriptor>,
): SplitDockDragPayload | null {
	const raw = event.dataTransfer?.getData(SPLIT_DOCK_DRAG_MIME)
	if (!raw) {
		return null
	}

	try {
		const parsed = JSON.parse(raw) as Partial<SplitDockDragPayload>
		if (
			typeof parsed.id !== "string" ||
			typeof parsed.title !== "string" ||
			typeof parsed.component !== "string" ||
			!isSplitDockZone(parsed.sourceZone) ||
			!panelDescriptorsById.has(parsed.id)
		) {
			return null
		}

		return {
			id: parsed.id,
			title: parsed.title,
			component: parsed.component,
			sourceZone: parsed.sourceZone,
		}
	} catch {
		return null
	}
}

function isSplitDockZone(value: unknown): value is SplitDockZone {
	return value === "main" || value === "right" || value === "bottom"
}
