import { SplitPane } from "@ch5me/workspace"
import {
	DockviewReact,
	type DockviewApi,
	type DockviewReadyEvent,
	type IDockviewPanelProps,
} from "dockview"
import { type FunctionComponent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import {
	canDragSplitDockPanel,
	type SplitDockPanelProtection,
	type SplitDockZone,
} from "./split-dock-protection"
import {
	createSplitDockDragPayload,
	hasSplitDockDragMime,
	parseSplitDockDragPayload,
	serializeSplitDockDragPayload,
	SPLIT_DOCK_DRAG_MIME,
	type SplitDockTransferPolicy,
	type SplitDockTransferRequest,
	validateSplitDockTransferPayload,
} from "./split-dock-transfer-bridge"

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
	transferPolicies?: readonly SplitDockTransferPolicy[]
}

export interface SplitDockWorkspaceShellProps {
	panels: SplitDockPanelDescriptor[]
	rightDockOpen: boolean
	bottomDockOpen: boolean
	rightDockWidth?: number
	onRightDockOpenChange?: (open: boolean) => void
	onBottomDockOpenChange?: (open: boolean) => void
	onTransfer?: (request: SplitDockTransferRequest) => boolean
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
	onTransfer,
}: SplitDockWorkspaceShellProps) {
	const panelsByZone = useMemo(() => groupPanelsByZone(panels), [panels])

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
			registerSplitDockBridge(
				zone,
				event.api,
				panelDescriptorsById,
				onTransfer,
				onRightDockOpenChange,
				onBottomDockOpenChange,
			)
			reconcileZonePanels(event.api, panelsByZone[zone])
		},
		[onBottomDockOpenChange, onRightDockOpenChange, onTransfer, panelDescriptorsById, panelsByZone],
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
	const allowedPanelIds = new Set(panels.map((panel) => panel.id))
	for (const panel of [...api.panels]) {
		if (allowedPanelIds.has(panel.id)) {
			continue
		}

		panel.api.close()
	}

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
	panelDescriptorsById: Map<string, SplitDockPanelDescriptor>,
	onTransfer?: (request: SplitDockTransferRequest) => boolean,
	onRightDockOpenChange?: (open: boolean) => void,
	onBottomDockOpenChange?: (open: boolean) => void,
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

		const payload = createSplitDockDragPayload({
			id: descriptor.id,
			zone,
			transferPolicies: descriptor.transferPolicies,
		})
		if (!payload) {
			event.nativeEvent.preventDefault()
			return
		}

		event.nativeEvent.dataTransfer?.setData(SPLIT_DOCK_DRAG_MIME, serializeSplitDockDragPayload(payload))
	})

	api.onUnhandledDragOverEvent((event) => {
		if (!(event.nativeEvent instanceof DragEvent)) {
			return
		}

		if (!hasSplitDockDragMime(event.nativeEvent)) {
			return
		}

		const raw = event.nativeEvent.dataTransfer?.getData(SPLIT_DOCK_DRAG_MIME)
		if (!raw) {
			return
		}

		const payload = parseSplitDockDragPayload(raw)
		if (
			!payload ||
			!validateSplitDockTransferPayload({
				payload,
				targetZone: zone,
				descriptorsById: panelDescriptorsById,
				targetPanelId: event.group?.activePanel?.id,
				targetPosition: normalizeDropPosition(event),
			})
		) {
			return
		}

		event.accept()
	})

	api.onDidDrop((event) => {
		if (!(event.nativeEvent instanceof DragEvent)) {
			return
		}

		const raw = event.nativeEvent.dataTransfer?.getData(SPLIT_DOCK_DRAG_MIME)
		if (!raw) {
			return
		}

		const payload = parseSplitDockDragPayload(raw)
		if (!payload) {
			return
		}

		const request = validateSplitDockTransferPayload({
			payload,
			targetZone: zone,
			descriptorsById: panelDescriptorsById,
			targetPanelId: event.group?.activePanel?.id,
			targetPosition: normalizeDropPosition(event),
		})
		if (!request) {
			return
		}

		if (!onTransfer?.(request)) {
			return
		}

		if (request.targetZone === "right") {
			onRightDockOpenChange?.(true)
		}

		if (request.targetZone === "bottom") {
			onBottomDockOpenChange?.(true)
		}
	})
}

function normalizeDropPosition(event: { position?: string }):
	| "left"
	| "right"
	| "top"
	| "bottom"
	| undefined {
	return event.position === "left" || event.position === "right" || event.position === "top" || event.position === "bottom"
		? event.position
		: undefined
}
