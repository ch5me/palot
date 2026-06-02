import { GlobeIcon, ExternalLinkIcon } from "lucide-react"
import type { Agent } from "../../lib/types"

interface BrowserPanelProps {
	agent: Agent
	className?: string
}

export function BrowserPanel({ agent, className }: BrowserPanelProps) {
	return (
		<div className={`flex h-full flex-col items-center justify-center gap-4 bg-background p-6 ${className ?? ""}`}>
			<GlobeIcon className="size-10 text-muted-foreground/40" />
			<div className="text-center">
				<h3 className="text-sm font-medium text-foreground">Inline Browser</h3>
				<p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
					Browse {agent.project} documentation, runtimes, and tools right here in the side panel.
				</p>
			</div>
			<div className="flex flex-col gap-2">
				<button
					type="button"
					className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<ExternalLinkIcon className="size-3" />
					Open project docs
				</button>
				<button
					type="button"
					className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<ExternalLinkIcon className="size-3" />
					Open in browser
				</button>
			</div>
			<p className="max-w-[260px] text-center text-[10px] text-muted-foreground/50">
				Full webview coming soon. This is a placeholder to verify the tab system works.
			</p>
		</div>
	)
}
