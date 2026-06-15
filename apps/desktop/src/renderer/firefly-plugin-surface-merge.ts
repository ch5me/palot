/**
 * Firefly Plugin System V2 — surface cutover seam (pure logic)
 *
 * The migration seam that lets side-panel surfaces move from the
 * hardcoded `FIREFLY_SURFACE_REGISTRY` to the plugin catalog ONE AT A
 * TIME with zero UX change: the renderer consumes a merged view of
 *   catalog-projected panels  ∪  remaining hardcoded registry rows
 * where a catalog-served surface wins over a registry row with the
 * same tab id, and ordering follows the canonical tab order.
 *
 * Pure module: no React, no IPC — unit-testable. The React layer
 * (`firefly-plugin-surfaces.tsx`) builds renderable tabs on top.
 */

import type { ProjectedSidePanel } from "../shared/firefly-plugin/renderer-projection"
import type { FireflySurfaceLane } from "./firefly-surface-registry"
import type { SidePanelTabId } from "./atoms/ui"

/**
 * Canonical visual order of side-panel tabs. Mirrors the registry
 * order at cutover time so a migrated surface keeps its position.
 */
export const SIDE_PANEL_TAB_ORDER: readonly SidePanelTabId[] = [
	"review",
	"browser",
	"notes",
	"pulse",
	"artifacts",
	"memory",
	"files",
	"terminal",
	"editor",
	"plugins",
	"bridges",
	"crm",
	"studio",
	"voice",
	"oracle",
	"claude",
	"ch5pm",
	"pdf-review",
]

const KNOWN_TAB_IDS = new Set<string>(SIDE_PANEL_TAB_ORDER)

export function isKnownSidePanelTabId(value: string): value is SidePanelTabId {
	return KNOWN_TAB_IDS.has(value)
}

/**
 * A catalog panel that can slot into the typed side-panel tab system.
 * `null` when the panel is not a side-panel tab, or its contribution
 * id is outside the (still static) `SidePanelTabId` union — dynamic
 * tab ids are a later-slice concern, stated openly.
 */
export interface CatalogSurfaceTabDescriptor {
	readonly id: SidePanelTabId
	readonly lane: FireflySurfaceLane
	readonly pluginId: string
	readonly projectedId: string
	readonly title: string
	readonly iconName: string | null
	readonly available: boolean
	readonly unavailableReason: string | null
	readonly commandIds: readonly string[]
	readonly persistenceKey: string
	readonly telemetryNamespace: string
	readonly renderMode: "host-reconciler" | "declarative-props" | "iframe"
}

function laneForCatalogPanel(panel: ProjectedSidePanel): FireflySurfaceLane {
	if (panel.hostTarget.kind !== "side-panel") {
		return "utility"
	}

	return panel.hostTarget.slot === "main-pane" ? "document" : "utility"
}

export function catalogPanelToTabDescriptor(
	panel: ProjectedSidePanel,
): CatalogSurfaceTabDescriptor | null {
	if (panel.formFactor !== "side-panel-tab") return null
	if (!isKnownSidePanelTabId(panel.contributionId)) return null
	return {
		id: panel.contributionId,
		lane: laneForCatalogPanel(panel),
		pluginId: panel.pluginId,
		projectedId: panel.projectedId,
		title: panel.title,
		iconName: panel.icon,
		available: panel.availability.available,
		unavailableReason: panel.availability.reason?.message ?? null,
		commandIds: panel.commandIds,
		persistenceKey: panel.persistenceKey ?? `side-panel.${panel.contributionId}`,
		telemetryNamespace: panel.telemetryNamespace ?? `firefly.surface.${panel.contributionId}`,
		renderMode: panel.renderMode,
	}
}

/**
 * Merge catalog-served tabs with the remaining hardcoded registry
 * tabs. Catalog wins on id collision (a surface mid-migration must
 * render exactly once, from the catalog). Output order follows
 * `SIDE_PANEL_TAB_ORDER`; ids outside the canonical list keep their
 * relative input order at the end.
 */
export function mergeSurfaceTabs<T extends { id: SidePanelTabId }>(
	registryTabs: readonly T[],
	catalogTabs: readonly T[],
): T[] {
	const byId = new Map<SidePanelTabId, T>()
	for (const tab of registryTabs) byId.set(tab.id, tab)
	for (const tab of catalogTabs) byId.set(tab.id, tab)

	const orderIndex = new Map<string, number>(SIDE_PANEL_TAB_ORDER.map((id, index) => [id, index]))
	return [...byId.values()].sort((a, b) => {
		const ai = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER
		const bi = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER
		return ai - bi
	})
}
