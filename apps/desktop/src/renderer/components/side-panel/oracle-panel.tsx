import { useMemo } from "react"
import { useAgents } from "../../hooks/use-agents"
import type { Agent } from "../../lib/types"

interface OraclePanelProps {
	agent: Agent
	className?: string
}

export function OraclePanel({ agent, className }: OraclePanelProps) {
	const agents = useAgents()
	const activeAgents = useMemo(
		() => agents.filter((item) => item.status === "running" || item.status === "waiting"),
		[agents],
	)
	const recentAgents = useMemo(
		() => agents.filter((item) => item.status !== "running" && item.status !== "waiting").slice(0, 8),
		[agents],
	)

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Oracle Roster</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Dense agent roster for {agent.project}. This is a side-panel proof before any broader orchestration dashboard exists.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				<section className="space-y-2">
					<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active</h4>
					{activeAgents.length > 0 ? (
						activeAgents.map((item) => (
							<div key={item.id} className="rounded-md border border-border px-3 py-2">
								<div className="text-sm font-medium text-foreground">{item.name}</div>
								<div className="mt-1 text-xs text-muted-foreground">{item.status} · {item.project}</div>
							</div>
						))
					) : (
						<div className="text-xs text-muted-foreground">No active agents right now.</div>
					)}
				</section>
				<section className="space-y-2">
					<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent</h4>
					{recentAgents.length > 0 ? (
						recentAgents.map((item) => (
							<div key={item.id} className="rounded-md border border-border px-3 py-2">
								<div className="text-sm font-medium text-foreground">{item.name}</div>
								<div className="mt-1 text-xs text-muted-foreground">{item.status} · {item.project}</div>
							</div>
						))
					) : (
						<div className="text-xs text-muted-foreground">No recent roster entries yet.</div>
					)}
				</section>
			</div>
		</div>
	)
}
