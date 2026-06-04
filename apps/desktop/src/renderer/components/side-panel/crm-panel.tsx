import type { Agent } from "../../lib/types"

interface CrmPanelProps {
	agent: Agent
	className?: string
}

export function CrmPanel({ agent, className }: CrmPanelProps) {
	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Contacts / CRM</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Unified relationship surface for people, conversation context, and next actions around {agent.project}.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				<section className="rounded-lg border border-border px-3 py-3">
					<h4 className="text-sm font-medium text-foreground">People</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						Future contact records, message peers, and operator-known stakeholders will gather here.
					</p>
				</section>
				<section className="rounded-lg border border-border px-3 py-3">
					<h4 className="text-sm font-medium text-foreground">Relationship context</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						Use this lane for lightweight relationship memory before any deeper CRM backend exists.
					</p>
				</section>
				<section className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
					CRM domain logic is intentionally deferred until a real data source or connector arrives.
				</section>
			</div>
		</div>
	)
}
