import { Button, Tooltip, TooltipContent, TooltipTrigger } from "@ch5me/ch5-ui-web"
import type { SidePanelTabDef } from "../components/side-panel/side-panel-tabs"

/**
 * Spawn toolbar pinned to the top of the side-panel (right) dock zone. Surfaces
 * are no longer seeded as tabs by default — this icon row is the primary way to
 * spawn one on demand (Cmd+K is the other). Each button spawns its surface's dock
 * tab (or focuses it if already open).
 */
export function SideZoneToolbar({
	surfaces,
	openIds,
	activeId,
	onSpawn,
}: {
	/** Available utility surfaces for the active workspace, in canonical order. */
	surfaces: readonly SidePanelTabDef[]
	/** Surface ids that currently have a spawned dock tab. */
	openIds: ReadonlySet<string>
	/** The currently focused side-panel tab id, highlighted in the toolbar. */
	activeId: string | null
	onSpawn: (tab: SidePanelTabDef) => void
}) {
	if (surfaces.length === 0) return null
	return (
		<div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border/60 bg-muted/20 px-1.5 py-1">
			{surfaces.map((surface) => {
				const isOpen = openIds.has(surface.id)
				const isActive = isOpen && activeId === surface.id
				return (
					<Tooltip key={surface.id}>
						<TooltipTrigger
							render={
								<Button
									variant={isActive ? "secondary" : "ghost"}
									size="icon"
									aria-pressed={isOpen}
									onClick={() => onSpawn(surface)}
									className={`size-7 shrink-0 [&_svg]:size-3.5 ${
										isOpen ? "text-foreground" : "text-muted-foreground"
									}`}
								/>
							}
						>
							{surface.icon}
						</TooltipTrigger>
						<TooltipContent side="bottom">{isOpen ? `Focus ${surface.title}` : `Open ${surface.title}`}</TooltipContent>
					</Tooltip>
				)
			})}
		</div>
	)
}
