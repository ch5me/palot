import type { Agent } from "@/lib/types"

interface FolioLibraryPanelProps {
	agent: Agent
}

/**
 * Folio › Library page. A workspace-scoped side-panel tab that only renders
 * while the Folio nav-rail workspace is active (manifest `workspace`:
 * "firefly.folio.folio"). Placeholder surface for the upcoming library view.
 */
export function FolioLibraryPanel({ agent }: FolioLibraryPanelProps) {
	return (
		<div className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-4 text-center">
			<h3 className="text-sm font-medium text-foreground">Library</h3>
			<p className="max-w-[280px] text-xs text-muted-foreground">
				Your Folio library for {agent.project}. This workspace page is scoped to the Folio
				rail and is the proving ground for workspace-scoped plugin pages.
			</p>
		</div>
	)
}

export default FolioLibraryPanel
