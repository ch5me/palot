import type { Agent } from "../../lib/types"

interface ClaudePanelProps {
	agent: Agent
	className?: string
}

export function ClaudePanel({ agent, className }: ClaudePanelProps) {
	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Claude Code</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Compatibility and import lane for teams coming from Claude Code into {agent.project}.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				<section className="rounded-lg border border-border px-3 py-3">
					<h4 className="text-sm font-medium text-foreground">Migration</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						Elf already supports Claude Code migration, preview, backup, and restore through onboarding and Setup.
					</p>
				</section>
				<section className="rounded-lg border border-border px-3 py-3">
					<h4 className="text-sm font-medium text-foreground">Compatibility</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						Use this lane to understand what gets imported, how commands/agents/rules translate, and where to rerun the flow.
					</p>
				</section>
				<section className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
					A live Claude Code runtime inside Elf is intentionally deferred. OpenCode remains the single interactive coding lane.
				</section>
			</div>
		</div>
	)
}
