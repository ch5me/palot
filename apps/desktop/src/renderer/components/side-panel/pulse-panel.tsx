import { useAtomValue } from "jotai"
import {
	AlertTriangleIcon,
	BotIcon,
	BrainIcon,
	Clock3Icon,
	DollarSignIcon,
	GitBranchIcon,
	HashIcon,
	MessageSquareIcon,
	WrenchIcon,
	ZapIcon,
} from "lucide-react"
import { sessionMetricsFamily } from "../../atoms/derived/session-metrics"
import { automationsAtom } from "../../atoms/automations"
import type { Agent } from "../../lib/types"

interface PulsePanelProps {
	agent: Agent
	className?: string
}

export function PulsePanel({ agent, className }: PulsePanelProps) {
	const metrics = useAtomValue(sessionMetricsFamily(agent.sessionId))
	const automations = useAtomValue(automationsAtom)
	const isActive = metrics.activeStartMs !== null
	const primaryModel = metrics.modelDistributionDisplay[0]
	const activeAutomations = automations.filter((a) => a.status === "active")
	const runningAutomations = automations.filter((a) => a.nextRunAt === null && a.status === "active")
	const pulseCards = [
		{
			label: "Work Time",
			icon: Clock3Icon,
			value: metrics.workTime,
			detail: isActive ? "Session Active" : "Session Idle",
		},
		{
			label: "Cost",
			icon: DollarSignIcon,
			value: metrics.cost,
			detail: metrics.assistantMessageCount > 0 ? `${metrics.assistantMessageCount} model runs` : "No model runs yet",
		},
		{
			label: "Tokens",
			icon: HashIcon,
			value: metrics.tokens,
			detail: `${metrics.userMessageCount} user messages`,
		},
		{
			label: "Exchanges",
			icon: MessageSquareIcon,
			value: String(metrics.exchangeCount),
			detail: `${metrics.assistantMessageCount} assistant responses`,
		},
		{
			label: "Model",
			icon: BrainIcon,
			value: primaryModel?.name ?? "None",
			detail: primaryModel ? `${primaryModel.count} runs` : "No model data yet",
		},
		{
			label: "Cache",
			icon: ZapIcon,
			value: metrics.cacheEfficiencyFormatted,
			detail: metrics.tokensRaw > 0 ? "Prompt cache efficiency" : "No cache activity yet",
		},
		{
			label: "Errors",
			icon: AlertTriangleIcon,
			value: String(metrics.errorCount),
			detail: metrics.retryCount > 0 ? `${metrics.retryCount} retries` : "No retries logged",
		},
		{
			label: "Tools",
			icon: WrenchIcon,
			value: String(metrics.toolCallCount),
			detail: metrics.toolCallCount > 0 ? "Tool calls recorded" : "No tool calls yet",
		},
		{
			label: "Automations",
			icon: BotIcon,
			value: String(activeAutomations.length),
			detail: runningAutomations.length > 0
				? `${runningAutomations.length} running now`
				: activeAutomations.length > 0
					? `${activeAutomations.length} scheduled`
					: "No automations configured",
		},
	] as const

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-medium text-foreground">Pulse</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							A compact session heartbeat for {agent.project} and upcoming Firefly runtime signals.
						</p>
					</div>
					<div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
						<span className={`size-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
						{isActive ? "Session Active" : "Session Idle"}
					</div>
				</div>
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
			<div className="mt-auto flex items-center gap-2 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
				<GitBranchIcon className="size-3.5" />
				<span>Worktree: {agent.worktreeBranch ?? agent.branch}</span>
			</div>
		</div>
	)
}
