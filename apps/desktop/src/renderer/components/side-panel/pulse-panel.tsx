import { ActivityIcon, Clock3Icon, FolderKanbanIcon, GitBranchIcon } from "lucide-react"
import type { Agent } from "../../lib/types"

interface PulsePanelProps {
	agent: Agent
	className?: string
}

const pulseCards = [
	{
		label: "Status",
		icon: ActivityIcon,
		value: "Live session",
		detail: "Watch the current run state without leaving chat.",
	},
	{
		label: "Branch",
		icon: GitBranchIcon,
		value: "Worktree aware",
		detail: "Keeps branch context visible while reviewing actions.",
	},
	{
		label: "Project",
		icon: FolderKanbanIcon,
		value: "Session scoped",
		detail: "Shows signals for the active project only.",
	},
	{
		label: "Freshness",
		icon: Clock3Icon,
		value: "Realtime",
		detail: "Reserved for upcoming automation and orchestration telemetry.",
	},
] as const

export function PulsePanel({ agent, className }: PulsePanelProps) {
	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Pulse</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					A compact session heartbeat for {agent.project} and upcoming Firefly runtime signals.
				</p>
			</div>
			<div className="grid gap-3 px-4 py-4 md:grid-cols-2">
				{pulseCards.map(({ label, icon: Icon, value, detail }) => (
					<div key={label} className="rounded-xl border border-border/70 bg-muted/20 p-3">
						<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<Icon className="size-3.5" />
							{label}
						</div>
						<div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
					</div>
				))}
			</div>
			<div className="mt-auto border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
				Worktree: {agent.worktreeBranch ?? agent.branch}
			</div>
		</div>
	)
}
