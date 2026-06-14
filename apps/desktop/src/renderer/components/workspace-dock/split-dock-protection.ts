import type { DockviewApi, IDockviewPanel } from "dockview"

export type SplitDockZone = "main" | "right" | "bottom"

export interface SplitDockPanelProtection {
	protected?: boolean
	requiredZone?: SplitDockZone
}

export interface SplitDockPanelProtectionContext {
	zone: SplitDockZone
	panel: IDockviewPanel
	api: DockviewApi
	protection?: SplitDockPanelProtection
}

export interface ProtectedPanelDragCheck {
	panelId: string
	protectedPanelIds: ReadonlySet<string>
	sourceZone: SplitDockZone
	sourceGroupPanelCount: number
}

export function shouldBlockProtectedPanelDrag({
	panelId,
	protectedPanelIds,
	sourceZone,
	sourceGroupPanelCount,
}: ProtectedPanelDragCheck): boolean {
	return protectedPanelIds.has(panelId) && sourceZone === "main" && sourceGroupPanelCount <= 1
}

export function canDragSplitDockPanel({
	zone,
	panel,
	api,
	protection,
}: SplitDockPanelProtectionContext): boolean {
	if (!protection?.protected) {
		return true
	}

	if (protection.requiredZone && protection.requiredZone !== zone) {
		return false
	}

	const protectedPanelIds = new Set(
		api.panels
			.filter((candidate) => candidate.id === panel.id)
			.map((candidate) => candidate.id),
	)

	return !shouldBlockProtectedPanelDrag({
		panelId: panel.id,
		protectedPanelIds,
		sourceZone: zone,
		sourceGroupPanelCount: panel.group.panels.length,
	})
}
