import type { Agent } from "@/lib/types"

interface FolioCollectionsPanelProps {
	agent: Agent
}

/**
 * Folio › Collections page. A workspace-scoped side-panel tab that only renders
 * while the Folio nav-rail workspace is active (manifest `workspace`:
 * "firefly.folio.folio"). Placeholder surface for the upcoming collections view.
 */
export function FolioCollectionsPanel({ agent }: FolioCollectionsPanelProps) {
	return (
		<div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-4 text-center">
			<h3 className="text-sm font-medium text-foreground">Collections</h3>
			<p className="max-w-[280px] text-xs text-muted-foreground">
				Curated collections for {agent.project}. This workspace page is scoped to the Folio
				rail and renders only while the Folio workspace is active.
			</p>
		</div>
	)
}

export default FolioCollectionsPanel
