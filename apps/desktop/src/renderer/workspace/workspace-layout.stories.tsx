/**
 * Workspace layout prototype — a SIMPLIFIED re-creation of the ch5-packages
 * "Shells/Workspace → Split Dock Example" story, rebuilt inside palot to settle
 * the overall desktop/web workspace shell before wiring real content.
 *
 * What this proves we understand (the layout skeleton, nothing more):
 *
 *   ┌──────────┬───────────────────────────────────────┬────────────┐
 *   │          │  Toolbar (title + dock toggles)        │            │
 *   │  Left    ├───────────────────────────────────────┤  Right     │
 *   │ sidebar  │                                        │  dock      │
 *   │ (Split   │         Main dock  (chat pane)         │ (Dockview) │
 *   │  Pane    │            Dockview instance           │            │
 *   │  left)   ├───────────────────────────────────────┤            │
 *   │          │  Bottom dock (Dockview instance)       │            │
 *   └──────────┴───────────────────────────────────────┴────────────┘
 *
 * Composition, identical in shape to the source:
 *   SplitPane(left)               → collapsible sidebar
 *     └ shell column              → toolbar + dock area
 *         └ SplitPane(right)      → collapsible right dock  (Dockview)
 *             └ SplitPane(bottom) → collapsible bottom dock (Dockview)
 *                 └ main          → main dock               (Dockview)
 *
 * The three Dockview instances (main / right / bottom) are independent but wired
 * by a tiny cross-zone drag bridge so a tab dragged out of one zone re-homes in
 * another — the defining behaviour of this shell.
 *
 * Deliberately omitted vs. the source: Motion-animated dock groups, the rich
 * AgentSidebar/AgentDetailChat scaffold, storybook-dark-mode wiring. Panels here
 * are flat placeholders so the story stays about LAYOUT, not content.
 */

import {
	DockviewReact,
	type DockviewApi,
	type DockviewReadyEvent,
	type IDockviewPanelProps,
	positionToDirection,
	themeDark,
} from "dockview-react"
import { type CSSProperties, useCallback, useRef, useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { SplitPane } from "@ch5me/workspace"
import { WS_TOKENS } from "@ch5me/workspace/theme"

import "@ch5me/workspace/theme/css"
import "dockview/dist/styles/dockview.css"

// ─── Layout constants ────────────────────────────────────────────────────────
const SIDEBAR_WIDTH = 240
const RIGHT_DOCK_WIDTH = 320
const BOTTOM_DOCK_HEIGHT = 220
const DRAG_MIME = "application/x-palot-panel"

type DockZone = "main" | "right" | "bottom"

type PanelDescriptor = {
	id: string
	title: string
	body: string[]
}

// Seed content per zone. `body` is just placeholder rows — the point is layout.
const PANELS: Record<string, PanelDescriptor> = {
	chat: { id: "chat", title: "Chat", body: ["You: lay out the workspace", "Agent: sidebar + docks wired"] },
	inspector: { id: "inspector", title: "Inspector", body: ["State", "Files", "Memory"] },
	context: { id: "context", title: "Context", body: ["Prompt", "Tools", "Notes"] },
	timeline: { id: "timeline", title: "Timeline", body: ["Queued prompt", "Tool call", "Checkpoint"] },
	runs: { id: "runs", title: "Runs", body: ["run-1042 active", "run-1041 done"] },
}

const ZONE_SEED: Record<DockZone, string[]> = {
	main: ["chat"],
	right: ["inspector", "context"],
	bottom: ["timeline", "runs"],
}

// ─── Story ───────────────────────────────────────────────────────────────────
const meta = {
	title: "Workspace/Layout",
	parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta
type Story = StoryObj

export const SplitDockLayout: Story = {
	name: "Split Dock Layout",
	render: () => <WorkspaceLayoutDemo />,
}

function WorkspaceLayoutDemo() {
	const [rightOpen, setRightOpen] = useState(true)
	const [bottomOpen, setBottomOpen] = useState(true)

	// One Dockview api per zone, wired into the cross-zone drag bridge on ready.
	const apisRef = useRef<Partial<Record<DockZone, DockviewApi>>>({})
	const onZoneReady = useCallback((zone: DockZone, event: DockviewReadyEvent) => {
		apisRef.current[zone] = event.api
		seedZone(event.api, zone)
		registerDragBridge(zone, event.api, apisRef)
	}, [])

	return (
		<div style={storyStyle}>
			<style>{dockviewThemeCss}</style>
			<SplitPane
				side="left"
				defaultPanelWidth={SIDEBAR_WIDTH}
				minPanelWidth={200}
				maxPanelWidth={340}
				panel={<Sidebar />}
				handleAriaLabel="Resize sidebar"
			>
				<div style={shellStyle}>
					<Toolbar
						rightOpen={rightOpen}
						bottomOpen={bottomOpen}
						onToggleRight={() => setRightOpen((open) => !open)}
						onToggleBottom={() => setBottomOpen((open) => !open)}
					/>
					<div style={dockAreaStyle}>
						<SplitPane
							side="right"
							open={rightOpen}
							onOpenChange={setRightOpen}
							defaultPanelWidth={RIGHT_DOCK_WIDTH}
							minPanelWidth={220}
							maxPanelWidth={520}
							handleAriaLabel="Resize right dock"
							panel={<DockSurface zone="right" onReady={onZoneReady} />}
						>
							<SplitPane
								side="bottom"
								open={bottomOpen}
								onOpenChange={setBottomOpen}
								defaultPanelWidth={BOTTOM_DOCK_HEIGHT}
								minPanelWidth={120}
								maxPanelWidth={420}
								collapseThreshold={44}
								collapsePreviewLabel="Release to hide bottom dock"
								handleAriaLabel="Resize bottom dock"
								panel={<DockSurface zone="bottom" onReady={onZoneReady} />}
							>
								<DockSurface zone="main" onReady={onZoneReady} />
							</SplitPane>
						</SplitPane>
					</div>
				</div>
			</SplitPane>
		</div>
	)
}

// ─── Dockview surface (one independent instance per zone) ──────────────────────
const dockComponents = { panel: PanelView }

function DockSurface({
	zone,
	onReady,
}: {
	zone: DockZone
	onReady: (zone: DockZone, event: DockviewReadyEvent) => void
}) {
	return (
		<div className="palot-dockview" style={dockFrameStyle}>
			<DockviewReact
				components={dockComponents}
				theme={{ ...themeDark, tabAnimation: "smooth" as const }}
				noPanelsOverlay="watermark"
				watermarkComponent={() => <EmptyZone zone={zone} />}
				onReady={(event) => onReady(zone, event)}
			/>
		</div>
	)
}

function seedZone(api: DockviewApi, zone: DockZone) {
	for (const panelId of ZONE_SEED[zone]) {
		if (!api.getPanel(panelId)) {
			api.addPanel({ id: panelId, title: PANELS[panelId].title, component: "panel" })
		}
	}
	// Keep the main chat pane from being dragged out when it is the last panel.
	if (zone === "main") {
		api.onWillDragPanel((event) => {
			if (event.panel.id === "chat" && event.panel.group.panels.length === 1) {
				event.nativeEvent.preventDefault()
			}
		})
	}
}

// ─── Cross-zone drag bridge ────────────────────────────────────────────────────
// Each instance tags its dragged panel with a MIME payload; every instance
// accepts that payload on drop, re-creates the panel locally, and closes the
// original in its source zone.
function registerDragBridge(
	zone: DockZone,
	api: DockviewApi,
	apisRef: { current: Partial<Record<DockZone, DockviewApi>> },
) {
	api.onWillDragPanel((event) => {
		if (!(event.nativeEvent instanceof DragEvent)) return
		event.nativeEvent.dataTransfer?.setData(
			DRAG_MIME,
			JSON.stringify({ id: event.panel.id, title: event.panel.title, sourceZone: zone }),
		)
	})

	api.onUnhandledDragOverEvent((event) => {
		if (
			event.nativeEvent instanceof DragEvent &&
			Array.from(event.nativeEvent.dataTransfer?.types ?? []).includes(DRAG_MIME)
		) {
			event.accept()
		}
	})

	api.onDidDrop((event) => {
		if (!(event.nativeEvent instanceof DragEvent)) return
		const payload = parseDragPayload(event.nativeEvent)
		if (!payload || payload.sourceZone === zone) return

		if (!api.getPanel(payload.id)) {
			api.addPanel({
				id: payload.id,
				title: payload.title,
				component: "panel",
				position: event.group
					? { referenceGroup: event.group, direction: positionToDirection(event.position) }
					: undefined,
			})
		}
		apisRef.current[payload.sourceZone]?.getPanel(payload.id)?.api.close()
	})
}

function parseDragPayload(
	event: DragEvent,
): { id: string; title: string; sourceZone: DockZone } | null {
	const raw = event.dataTransfer?.getData(DRAG_MIME)
	if (!raw) return null
	try {
		const parsed = JSON.parse(raw)
		if (typeof parsed.id === "string" && typeof parsed.title === "string" && parsed.id in PANELS) {
			return parsed
		}
	} catch {
		// ignore malformed payloads
	}
	return null
}

// ─── Placeholder views ─────────────────────────────────────────────────────────
function PanelView(props: IDockviewPanelProps) {
	const descriptor = PANELS[props.api.id]
	return (
		<div style={panelBodyStyle}>
			{(descriptor?.body ?? ["—"]).map((line) => (
				<div key={line} style={panelRowStyle}>
					<span style={panelDotStyle} />
					{line}
				</div>
			))}
		</div>
	)
}

function EmptyZone({ zone }: { zone: DockZone }) {
	return (
		<div style={emptyZoneStyle}>
			{zone === "main" ? "Main pane" : `Drag tabs here · ${zone} dock`}
		</div>
	)
}

function Sidebar() {
	return (
		<div style={sidebarStyle}>
			<div style={sidebarBrandStyle}>PALOT</div>
			<div style={sidebarLabelStyle}>Agents</div>
			{["Research", "Coder", "Reviewer", "Deploy"].map((item, index) => (
				<div
					key={item}
					style={{
						...sidebarItemStyle,
						background: index === 1 ? WS_TOKENS.accentBg : "transparent",
						color: index === 1 ? WS_TOKENS.accentText : WS_TOKENS.textSecondary,
					}}
				>
					{item}
				</div>
			))}
		</div>
	)
}

function Toolbar({
	rightOpen,
	bottomOpen,
	onToggleRight,
	onToggleBottom,
}: {
	rightOpen: boolean
	bottomOpen: boolean
	onToggleRight: () => void
	onToggleBottom: () => void
}) {
	return (
		<div style={toolbarStyle}>
			<div style={toolbarTitleStyle}>Workspace</div>
			<div style={toolbarActionsStyle}>
				<button
					type="button"
					aria-pressed={bottomOpen}
					onClick={onToggleBottom}
					style={toggleStyle(bottomOpen)}
				>
					Bottom
				</button>
				<button
					type="button"
					aria-pressed={rightOpen}
					onClick={onToggleRight}
					style={toggleStyle(rightOpen)}
				>
					Right
				</button>
			</div>
		</div>
	)
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const storyStyle: CSSProperties = {
	background: WS_TOKENS.bg,
	color: WS_TOKENS.textPrimary,
	fontFamily: WS_TOKENS.fontMono,
	height: "100vh",
	width: "100%",
}

const shellStyle: CSSProperties = {
	background: WS_TOKENS.canvas,
	display: "flex",
	flexDirection: "column",
	height: "100%",
	minWidth: 0,
}

const dockAreaStyle: CSSProperties = {
	flex: 1,
	minHeight: 0,
	minWidth: 0,
	overflow: "hidden",
}

const dockFrameStyle: CSSProperties = {
	height: "100%",
	minHeight: 0,
	minWidth: 0,
	overflow: "hidden",
	width: "100%",
}

const sidebarStyle: CSSProperties = {
	background: WS_TOKENS.panel,
	boxSizing: "border-box",
	display: "flex",
	flexDirection: "column",
	gap: 6,
	height: "100%",
	padding: 14,
}

const sidebarBrandStyle: CSSProperties = {
	borderBottom: `1px solid ${WS_TOKENS.border}`,
	fontSize: 18,
	fontWeight: 800,
	paddingBottom: 12,
}

const sidebarLabelStyle: CSSProperties = {
	color: WS_TOKENS.textMuted,
	fontSize: 10,
	fontWeight: 700,
	paddingTop: 8,
	textTransform: "uppercase",
}

const sidebarItemStyle: CSSProperties = {
	borderRadius: 8,
	fontSize: 12,
	fontWeight: 700,
	padding: "8px 10px",
}

const toolbarStyle: CSSProperties = {
	alignItems: "center",
	background: WS_TOKENS.panel,
	borderBottom: `1px solid ${WS_TOKENS.border}`,
	boxSizing: "border-box",
	display: "flex",
	flexShrink: 0,
	height: 52,
	justifyContent: "space-between",
	padding: "0 16px",
}

const toolbarTitleStyle: CSSProperties = {
	fontSize: 13,
	fontWeight: 800,
}

const toolbarActionsStyle: CSSProperties = {
	display: "flex",
	gap: 8,
}

function toggleStyle(active: boolean): CSSProperties {
	return {
		background: active ? WS_TOKENS.accentBg : "transparent",
		border: `1px solid ${active ? WS_TOKENS.accentBorder : WS_TOKENS.border}`,
		borderRadius: 8,
		color: active ? WS_TOKENS.accentText : WS_TOKENS.textSecondary,
		cursor: "pointer",
		fontFamily: WS_TOKENS.fontMono,
		fontSize: 11,
		fontWeight: 700,
		padding: "5px 10px",
	}
}

const panelBodyStyle: CSSProperties = {
	alignContent: "start",
	background: WS_TOKENS.canvas,
	boxSizing: "border-box",
	display: "grid",
	gap: 8,
	height: "100%",
	overflow: "auto",
	padding: 14,
}

const panelRowStyle: CSSProperties = {
	alignItems: "center",
	background: WS_TOKENS.panelMuted,
	border: `1px solid ${WS_TOKENS.border}`,
	borderRadius: 8,
	color: WS_TOKENS.textSecondary,
	display: "flex",
	fontSize: 12,
	gap: 8,
	padding: "9px 11px",
}

const panelDotStyle: CSSProperties = {
	background: WS_TOKENS.accent,
	borderRadius: 999,
	flexShrink: 0,
	height: 6,
	width: 6,
}

const emptyZoneStyle: CSSProperties = {
	alignItems: "center",
	color: WS_TOKENS.textMuted,
	display: "flex",
	fontSize: 11,
	height: "100%",
	justifyContent: "center",
}

// Bridge the workspace --ws-* tokens into Dockview's chrome variables so the
// dock tabs/separators match the rest of the shell.
const dockviewThemeCss = `
	.palot-dockview, .palot-dockview .dv-dockview {
		height: 100%;
		width: 100%;
		--dv-background-color: var(--ws-panel);
		--dv-paneview-active-outline-color: var(--ws-accent);
		--dv-tabs-and-actions-container-background-color: var(--ws-panel);
		--dv-activegroup-visiblepanel-tab-background-color: var(--ws-panel-raised);
		--dv-activegroup-hiddenpanel-tab-background-color: var(--ws-panel);
		--dv-inactivegroup-visiblepanel-tab-background-color: var(--ws-panel-muted);
		--dv-inactivegroup-hiddenpanel-tab-background-color: var(--ws-panel);
		--dv-activegroup-visiblepanel-tab-color: var(--ws-text-primary);
		--dv-activegroup-hiddenpanel-tab-color: var(--ws-text-secondary);
		--dv-separator-border: var(--ws-border);
	}
	.palot-dockview .dv-tab { font-family: var(--ws-font-mono); }
`
