import type { ReactNode } from "react"
import type { SidePanelTabId } from "../../atoms/ui"
import type { Agent } from "../../lib/types"

// ============================================================
// Side Panel Tab Registry
// ============================================================

/** Context passed to tab availability checks and render functions */
export interface SidePanelTabContext {
	agent: Agent
}

/** Definition of a single side panel tab */
export interface SidePanelTabDef {
	id: SidePanelTabId
	label: string
	icon: ReactNode
	/** Whether this tab should appear for the given session */
	isAvailable: (ctx: SidePanelTabContext) => boolean
	/** Render the tab's content */
	render: (ctx: SidePanelTabContext) => ReactNode
}
