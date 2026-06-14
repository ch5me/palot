import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import {
	renderSessionWidgetRuntime,
	resolveSessionWidgetDescriptor,
	SESSION_WIDGET_REGISTRY,
} from "../../session-widget-registry"
import type { Agent } from "../../lib/types"
import {
	createReversePortalTransport,
	StablePanelHostAttachmentOutlet,
	StablePanelHostInPortal,
} from "./reverse-portal-transport"
import { applySplitDockTransfer, createSplitDockPlacementState } from "./split-dock-placement-state"
import type { ReversePortalTransportHandle } from "./reverse-portal-transport"
import { StablePanelHostRuntime } from "./stable-panel-host-runtime"
import type { StablePanelAttachmentTarget } from "./stable-panel-host-runtime"
import type { SplitDockPanelDescriptor } from "./split-dock-workspace-shell"
import type { SplitDockTransferRequest } from "./split-dock-transfer-bridge"

const SESSION_CHAT_PANEL = "session-chat"
const SESSION_WIDGETS_PANEL = "session-widgets"
const SESSION_SURFACE_PANEL = "session-surface"

interface AgentSplitDockAdapterOptions {
	agent: Agent
	chatContent: ReactNode
	sidePanelContent: ReactNode
	rightDockOpen: boolean
	bottomDockOpen: boolean
}

export interface AgentSplitDockAdapterResult {
	panels: SplitDockPanelDescriptor[]
	stableHosts: ReactNode
	handleTransfer: (request: SplitDockTransferRequest) => boolean
	proof: {
		chatMountCount: number
		chatRemountDetected: boolean
		chatAttachmentId: string
		chatZone: SplitDockPanelDescriptor["zone"]
		rightVisible: boolean
		bottomVisible: boolean
	}
}

interface StableDockHostConfig {
	panelId: string
	title: string
	defaultZone: SplitDockPanelDescriptor["zone"]
	content: ReactNode
	visible: boolean
	initialWidth?: number
	initialHeight?: number
	hostPolicy: "stable" | "remount-ok"
}

interface StableDockHostPlacementConfig extends StableDockHostConfig {
	zone: SplitDockPanelDescriptor["zone"]
}

export function useAgentSplitDockAdapters({
	agent,
	chatContent,
	sidePanelContent,
	rightDockOpen,
	bottomDockOpen,
}: AgentSplitDockAdapterOptions): AgentSplitDockAdapterResult {
	const runtime = useMemo(() => new StablePanelHostRuntime<ReversePortalTransportHandle>(), [])
	const transport = useMemo(() => createReversePortalTransport(), [])

	const configs = useMemo<StableDockHostConfig[]>(
		() => [
			{
				panelId: SESSION_CHAT_PANEL,
				title: "Chat",
				defaultZone: "main",
				content: chatContent,
				visible: true,
				hostPolicy: "stable",
			},
			{
				panelId: SESSION_WIDGETS_PANEL,
				title: "Session",
				defaultZone: "bottom",
				content: <SessionDockWidgets agent={agent} />,
				visible: bottomDockOpen,
				initialHeight: 196,
				hostPolicy: "remount-ok",
			},
			{
				panelId: SESSION_SURFACE_PANEL,
				title: "Surface",
				defaultZone: "right",
				content: sidePanelContent,
				visible: rightDockOpen,
				initialWidth: 392,
				hostPolicy: "stable",
			},
		],
		[agent, bottomDockOpen, chatContent, rightDockOpen, sidePanelContent],
	)

	const defaultPlacementState = useMemo(
		() => createSplitDockPlacementState(configs.map((config) => ({ id: config.panelId, zone: config.defaultZone }))),
		[agent.sessionId],
	)

	const [placementState, setPlacementState] = useState(defaultPlacementState)

	useEffect(() => {
		setPlacementState(defaultPlacementState)
	}, [defaultPlacementState])

	const configsWithPlacement = useMemo(
		(): StableDockHostPlacementConfig[] =>
			configs.map((config) => ({
				...config,
				zone: placementState.panelZones[config.panelId] ?? config.defaultZone,
			})),
		[configs, placementState.panelZones],
	)

	const stableConfigs = useMemo(
		() => configsWithPlacement.filter((config) => config.hostPolicy === "stable"),
		[configsWithPlacement],
	)

	const handleTransfer = useCallback((request: SplitDockTransferRequest) => {
		let accepted = false
		setPlacementState((currentState) => {
			const nextState = applySplitDockTransfer(currentState, request)
			if (!nextState) {
				return currentState
			}

			accepted = true
			return nextState
		})
		return accepted
	}, [])

	const hostSnapshots = useMemo(
		() => stableConfigs.map((config) => registerAndAttachHost(runtime, transport, agent.sessionId, config)),
		[agent.sessionId, runtime, stableConfigs, transport],
	)

	return useMemo(
		() => ({
			panels: configsWithPlacement.map((config) => ({
				id: config.panelId,
				title: config.title,
				zone: config.zone,
				component: config.panelId,
				content:
					config.hostPolicy === "stable" ? (
						<StablePanelHostAttachmentOutlet
							handle={runtime.getSnapshot(hostIdForPanel(agent.sessionId, config.panelId)).handle}
							attachmentId={attachmentIdForPanel(agent.sessionId, config.panelId, config.zone)}
						/>
					) : (
						config.content
					),
				initialWidth: config.initialWidth,
				initialHeight: config.initialHeight,
				protection: config.hostPolicy === "stable"
					? {
							protected: true,
							requiredZone: config.panelId === SESSION_CHAT_PANEL ? "main" : undefined,
					  }
					: undefined,
				transferPolicies: ["move"],
			})),
			stableHosts: (
				<>
					{hostSnapshots.map((snapshot, index) => (
						<StablePanelHostInPortal key={snapshot.hostId} handle={snapshot.handle}>
							{stableConfigs[index]?.content}
						</StablePanelHostInPortal>
					))}
				</>
			),
			handleTransfer,
			proof: {
				chatMountCount: runtime.getSnapshot(hostIdForPanel(agent.sessionId, SESSION_CHAT_PANEL)).mountCount,
				chatRemountDetected: runtime.getSnapshot(hostIdForPanel(agent.sessionId, SESSION_CHAT_PANEL)).remountDetected,
				chatAttachmentId: attachmentIdForPanel(
					agent.sessionId,
					SESSION_CHAT_PANEL,
					placementState.panelZones[SESSION_CHAT_PANEL] ?? "main",
				),
				chatZone: placementState.panelZones[SESSION_CHAT_PANEL] ?? "main",
				rightVisible: rightDockOpen,
				bottomVisible: bottomDockOpen,
			},
		}),
		[agent.sessionId, bottomDockOpen, configsWithPlacement, handleTransfer, hostSnapshots, placementState.panelZones, rightDockOpen, runtime, stableConfigs],
	)
}

function registerAndAttachHost(
	runtime: StablePanelHostRuntime<ReversePortalTransportHandle>,
	transport: ReturnType<typeof createReversePortalTransport>,
	sessionId: string,
	config: StableDockHostPlacementConfig,
) {
	const hostId = hostIdForPanel(sessionId, config.panelId)
	runtime.registerHost({
		hostId,
		transport,
		hiddenMode: "keep-attached",
		instrumentation: { mode: "remember" },
	})
	const snapshot = runtime.getSnapshot(hostId)
	if (snapshot.mountCount === 0) {
		runtime.recordMount(hostId)
	}

	return runtime.attachHost(hostId, attachmentTargetForPanel(sessionId, config))
}

function attachmentTargetForPanel(
	sessionId: string,
	config: StableDockHostPlacementConfig,
): StablePanelAttachmentTarget {
	return {
		attachmentId: attachmentIdForPanel(sessionId, config.panelId, config.zone),
		visible: config.visible,
		zoneId: config.zone,
	}
}

function hostIdForPanel(sessionId: string, panelId: string) {
	return `${sessionId}:host:${panelId}`
}

function attachmentIdForPanel(sessionId: string, panelId: string, zone: SplitDockPanelDescriptor["zone"]) {
	return `${sessionId}:attachment:${zone}:${panelId}`
}

function SessionDockWidgets({ agent }: { agent: Agent }) {
	return (
		<div className="grid h-full min-h-0 grid-cols-1 gap-3 overflow-auto p-3 lg:grid-cols-2">
			{Object.values(SESSION_WIDGET_REGISTRY).map((widget) => {
				const descriptor = resolveSessionWidgetDescriptor(widget, { agent })
				const Icon = descriptor.icon
				return (
					<div
						key={widget.id}
						className="min-h-0 overflow-hidden rounded-lg border border-border/40 bg-background/70"
					>
						<div className="flex h-8 items-center gap-2 border-b border-border/40 px-3">
							<Icon className="size-3.5 text-muted-foreground" />
							<p className="truncate text-xs font-medium text-foreground/80">{descriptor.title}</p>
						</div>
						<div className="h-[calc(100%-2rem)] min-h-0 overflow-auto p-2">
							{renderSessionWidgetRuntime(descriptor.runtime, { agent })}
						</div>
					</div>
				)
			})}
		</div>
	)
}
