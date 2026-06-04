import type { Agent } from "../../lib/types"

interface StudioPanelProps {
	agent: Agent
	className?: string
}

export function StudioPanel({ agent, className }: StudioPanelProps) {
	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Studio / Office</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Document and office-preview lane for {agent.project}. This is a proof shell before any route-level workspace promotion.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				<section className="rounded-lg border border-border px-3 py-3">
					<h4 className="text-sm font-medium text-foreground">Preview workflows</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						Future docs, PDFs, slides, and office-adjacent review flows can gather here without forcing a dedicated workspace yet.
					</p>
				</section>
				<section className="rounded-lg border border-border px-3 py-3">
					<h4 className="text-sm font-medium text-foreground">Creation notes</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						If richer document creation or multi-document work becomes central, Studio can graduate into its own route-level workspace.
					</p>
				</section>
				<section className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
					Office-specific runtime logic is intentionally deferred until a concrete preview or creation workflow needs it.
				</section>
			</div>
		</div>
	)
}
