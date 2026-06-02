import { DatabaseIcon, HistoryIcon, SparklesIcon } from "lucide-react"
import type { Agent } from "../../lib/types"

interface MemoryPanelProps {
	agent: Agent
	className?: string
}

const memorySeeds = [
	"Pin durable project facts here before they become chat archaeology.",
	"Stage future memory integrations behind this surface instead of inventing new top-level routes.",
	"Keep renderer-only scaffolding here; backend-connected memory retrieval can attach later.",
] as const

export function MemoryPanel({ agent, className }: MemoryPanelProps) {
	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Memory</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Staging surface for durable Firefly memory cues in {agent.project}.
				</p>
			</div>
			<div className="flex flex-1 flex-col gap-3 px-4 py-4">
				<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
					<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<DatabaseIcon className="size-3.5" />
						Memory substrate
					</div>
					<p className="mt-2 text-sm text-foreground">
						No remote memory contract wired yet. This tab proves placement, gating, and shell fit now.
					</p>
				</div>
				<div className="rounded-xl border border-border/70 bg-background p-3">
					<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<HistoryIcon className="size-3.5" />
						Planned uses
					</div>
					<ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">
						{memorySeeds.map((seed) => (
							<li key={seed} className="flex gap-2">
								<SparklesIcon className="mt-0.5 size-3 shrink-0 text-foreground/60" />
								<span>{seed}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	)
}
