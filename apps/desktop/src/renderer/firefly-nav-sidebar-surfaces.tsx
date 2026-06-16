/**
 * Firefly Plugin System V2 — catalog-served nav-sidebar tabs (React layer)
 *
 * The left-rail twin of `firefly-plugin-surfaces.tsx`. Builds renderable
 * nav-sidebar tabs from the plugin catalog's `navSidebars` projection:
 *   - `NAV_SIDEBAR_COMPONENTS`: host registry mapping a projected
 *     nav-sidebar id to its lazily-imported React body (per-plugin lazy
 *     chunk — the body loads on first selection, not at boot).
 *   - `useCatalogNavSidebarTabs`: hook returning `NavSidebarCatalogTab[]`
 *     derived solely from the catalog, ready to merge with the built-in
 *     "Palot" tab in `nav-sidebar-tabs.tsx`.
 *
 * Trust rule mirrors panels (plan §2.1): only `host-reconciler`
 * nav-sidebars from the component registry render in-process, and the
 * registry only ever contains first-party built-ins. A plugin body
 * crash is contained by the shared `PluginPanelBoundary` and reported to
 * the host supervision layer — the rail and chat loop never go down.
 */

import { lazy, Suspense, useEffect, useMemo, type ComponentType, type LazyExoticComponent, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { ProjectedNavSidebar } from "../shared/firefly-plugin/renderer-projection"
import { panelIcon, PluginPanelBoundary } from "./firefly-plugin-surfaces"
import { fireflyPluginBridge } from "./hooks/use-firefly-plugins"
import { createLogger } from "./lib/logger"

const log = createLogger("firefly-nav-sidebar-surfaces")

/**
 * Nav-sidebar bodies are app-global (not per-session), so unlike panels
 * they take no `agent`. Kept as an explicit type so a future host prop
 * (e.g. navigation handle) has one place to land.
 */
export type PluginNavSidebarProps = Record<string, never>

/**
 * Host registry: projected nav-sidebar id → lazily imported body. A new
 * left-rail workspace adds exactly one entry here. First-party only.
 */
export const NAV_SIDEBAR_COMPONENTS: Readonly<
	Record<string, LazyExoticComponent<ComponentType<PluginNavSidebarProps>>>
> = {
	"firefly.folio.folio": lazy(() => import("../../plugins/folio/nav/folio-sidebar")),
}

export interface NavSidebarCatalogTab {
	readonly id: string
	readonly label: string
	readonly icon: LucideIcon
	readonly order: number
	readonly pluginId: string
	readonly renderBody: () => ReactNode
}

async function fetchCatalogNavSidebars(): Promise<ProjectedNavSidebar[]> {
	if (typeof window === "undefined") return []
	const result = await fireflyPluginBridge().navSidebars()
	// The IPC-serialized items are the projection minus host-only
	// family/contract fields (unused downstream); cross-cast to the
	// projection shape consumers expect, matching the panels path.
	return result.items as unknown as ProjectedNavSidebar[]
}

export function buildCatalogNavSidebarTab(nav: ProjectedNavSidebar): NavSidebarCatalogTab | null {
	if (nav.renderMode !== "host-reconciler") {
		// declarative-props renders via Loom (wave 6); no host surface yet.
		return null
	}
	const Body = NAV_SIDEBAR_COMPONENTS[nav.projectedId]
	if (!Body) {
		// Fail loud: a catalog-served nav-sidebar without a registered
		// body is a build/registration bug, not a renderable tab.
		log.warn("Catalog nav sidebar has no registered component; skipping tab", {
			projectedId: nav.projectedId,
			pluginId: nav.pluginId,
		})
		return null
	}
	return {
		id: nav.projectedId,
		label: nav.title,
		icon: panelIcon(nav.icon),
		order: nav.order,
		pluginId: nav.pluginId,
		renderBody: () => (
			<PluginPanelBoundary
				pluginId={nav.pluginId}
				projectedId={nav.projectedId}
				title={nav.title}
			>
				<Suspense
					fallback={
						<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
							Loading {nav.title}…
						</div>
					}
				>
					<Body />
				</Suspense>
			</PluginPanelBoundary>
		),
	}
}

/**
 * Catalog-served nav-sidebar tabs, sorted by manifest `order`. Refetches
 * when main broadcasts a catalog change (enable/disable/quarantine/reload).
 */
export function useCatalogNavSidebarTabs(): NavSidebarCatalogTab[] {
	const queryClient = useQueryClient()
	const { data: navSidebars } = useQuery({
		queryKey: ["firefly-plugin", "surface-nav-sidebars"],
		queryFn: fetchCatalogNavSidebars,
		staleTime: 5_000,
	})

	useEffect(() => {
		if (typeof window === "undefined") return
		return fireflyPluginBridge().onChanged(() => {
			void queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
		})
	}, [queryClient])

	return useMemo(() => {
		if (!navSidebars) return []
		const tabs: NavSidebarCatalogTab[] = []
		for (const nav of navSidebars) {
			if (!nav.availability.available) continue
			const tab = buildCatalogNavSidebarTab(nav)
			if (tab) tabs.push(tab)
		}
		return tabs.sort((a, b) => a.order - b.order)
	}, [navSidebars])
}
