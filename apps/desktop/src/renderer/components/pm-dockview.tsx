import { DockviewReact, type DockviewReadyEvent } from "dockview"
import { memo } from "react"
import { PmLiveDashboard } from "./pm-live-dashboard"

const PANEL_DENSE = "pm-dense-console"
const PANEL_LINEAGE = "pm-lineage"
const PANEL_AGENTS = "pm-agents"

const DenseConsolePanel = memo(function DenseConsolePanel() {
	return <PmLiveDashboard />
})

const LineagePanel = memo(function LineagePanel() {
	return (
		<div className="flex h-full items-center justify-center bg-white p-6 font-mono text-[11px] text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
			See the lineage strip at the top of the Dense Console panel. Individual pane splitting is a follow-up slice.
		</div>
	)
})

const AgentsPanel = memo(function AgentsPanel() {
	return (
		<div className="flex h-full items-center justify-center bg-white p-6 font-mono text-[11px] text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
			Background agents will be exposed as their own dockable panel in a follow-up slice.
		</div>
	)
})

function PmDockviewShellImpl({ onReady }: { onReady?: (event: DockviewReadyEvent) => void }) {
	function handleReady(event: DockviewReadyEvent) {
		if (event.api.panels.length === 0) {
			event.api.addPanel({
				id: PANEL_DENSE,
				title: "Dense Console",
				component: PANEL_DENSE,
			})
			event.api.addPanel({
				id: PANEL_AGENTS,
				title: "Side Agents",
				component: PANEL_AGENTS,
				position: { direction: "within", referencePanel: PANEL_DENSE },
				inactive: true,
			})
			event.api.addPanel({
				id: PANEL_LINEAGE,
				title: "Lineage",
				component: PANEL_LINEAGE,
				position: { direction: "within", referencePanel: PANEL_DENSE },
				inactive: true,
			})
		}
		onReady?.(event)
	}

	return (
		<div className="dockview-theme-light dark:dockview-theme-dark h-full w-full">
			<DockviewReact
				className="h-full w-full"
				components={{
					[PANEL_DENSE]: DenseConsolePanel,
					[PANEL_LINEAGE]: LineagePanel,
					[PANEL_AGENTS]: AgentsPanel,
				}}
				onReady={handleReady}
			/>
		</div>
	)
}

export const PmDockviewShell = memo(PmDockviewShellImpl)
