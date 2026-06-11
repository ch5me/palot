import { NavSidebarTabs } from "./nav-sidebar-tabs"
import type { Agent, SidebarProject } from "../lib/types"

interface AppSidebarContentProps {
	agents: Agent[]
	projects: SidebarProject[]
	onOpenCommandPalette: () => void
	onAddProject?: () => void
	onRenameSession?: (agent: Agent, title: string) => Promise<void>
	onDeleteSession?: (agent: Agent) => Promise<void>
	onTogglePinnedSession?: (agent: Agent, pinned: boolean) => Promise<void>
	onForkSession?: (agent: Agent) => Promise<void>
	serverConnected: boolean
}

export function AppSidebarContent(props: AppSidebarContentProps) {
	return <NavSidebarTabs {...props} />
}
