import {
	NavSidebarShell,
	type NavSidebarAgent,
	type NavSidebarProject,
	type NavSidebarSectionId,
	type NavSidebarTabId,
} from "@ch5me/elf-ui/components/nav-sidebar-shell"
import { SidebarProvider } from "@ch5me/elf-ui/components/sidebar"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { BlocksIcon, CopyIcon } from "lucide-react"
import { useState } from "react"

const tabs = [
	{ id: "built-in" as const, label: "Palot", icon: BlocksIcon },
	{ id: "built-in-duplicate" as const, label: "Folio", icon: CopyIcon },
]

const agents: NavSidebarAgent[] = [
	{
		id: "ses-shell",
		name: "Shell coverage",
		status: "running",
		project: "Palot",
		projectSlug: "palot",
		sessionId: "ses-shell",
		agentType: "build",
		modelID: "gpt-5",
	},
	{
		id: "ses-proof",
		name: "Render proof",
		status: "waiting",
		project: "Storybook",
		projectSlug: "storybook",
		sessionId: "ses-proof",
		agentType: "verify",
		modelID: "claude-sonnet-4",
	},
	{
		id: "ses-audit",
		name: "Coverage audit",
		status: "degraded",
		project: "Palot",
		projectSlug: "palot",
		sessionId: "ses-audit",
		agentType: "scan",
		modelID: "gemini-2.5-pro",
	},
]

const projects: NavSidebarProject[] = [
	{
		id: "palot",
		name: "Palot",
		slug: "palot",
		directory: "/Users/hassoncs/src/ch5/palot",
		agents: [agents[0], agents[2]],
		hasMore: true,
	},
	{
		id: "storybook",
		name: "Storybook",
		slug: "storybook",
		directory: "/Users/hassoncs/src/ch5/palot/packages/storybook",
		agents: [agents[1]],
	},
]

const initialSections: Record<NavSidebarSectionId, boolean> = {
	active: true,
	pinned: true,
	recent: true,
	pm: false,
	projects: true,
}

function NavSidebarShellExample() {
	const [activeTab, setActiveTab] = useState<NavSidebarTabId>("built-in")
	const [sectionsOpen, setSectionsOpen] = useState(initialSections)
	const [selectedSessionId, setSelectedSessionId] = useState("ses-shell")

	return (
		<SidebarProvider defaultOpen embedded>
			<div className="flex h-[720px] w-[360px] overflow-hidden rounded-3xl border bg-sidebar">
				<NavSidebarShell
					tabs={tabs}
					activeTab={activeTab}
					onTabChange={setActiveTab}
					serverConnected
					hasContent
					showAutomations
					activeSessions={agents.slice(0, 2)}
					pinnedSessions={[agents[0]]}
					recentSessions={agents.slice(1)}
					pmSessions={[agents[2]]}
					projects={projects}
					sectionsOpen={sectionsOpen}
					onSectionOpenChange={(section, open) =>
						setSectionsOpen((current) => ({ ...current, [section]: open }))
					}
					onSessionSelect={(agent) => setSelectedSessionId(agent.id)}
					onSessionRename={() => undefined}
					onSessionDelete={() => undefined}
					onTogglePinnedSession={() => undefined}
					onForkSession={() => undefined}
					onNewSession={() => undefined}
					onProjectManager={() => undefined}
					onAutomations={() => undefined}
					onOpenCommandPalette={() => undefined}
					onAddProject={() => undefined}
					onProjectSelect={() => undefined}
					onProjectLoadMore={() => undefined}
					onSettings={() => undefined}
					selectedSessionId={selectedSessionId}
					serverSummary={{ label: "localhost:4096", connected: true }}
				/>
			</div>
		</SidebarProvider>
	)
}

const meta = {
	title: "Foundations/Navigation/NavSidebarShell",
	component: NavSidebarShell,
	render: () => <NavSidebarShellExample />,
	parameters: {
		layout: "centered",
	},
} satisfies Meta<typeof NavSidebarShell>

export default meta

type Story = StoryObj

export const Default: Story = {}
