import { Component, lazy, Suspense, useMemo, type ComponentType, type ErrorInfo, type LazyExoticComponent, type ReactNode, useEffect } from "react";
/**
 * Firefly Plugin System V2 — catalog-served surface tabs (React layer)
 *
 * Builds renderable side-panel tabs from the plugin catalog projection:
 *   - `PLUGIN_PANEL_COMPONENTS`: host registry mapping a projected
 *     panel id to its lazily-imported React component (per-plugin lazy
 *     chunk — the panel code loads on first open, not at boot).
 *   - `PluginPanelBoundary`: per-plugin React error boundary. A throw
 *     in a plugin panel renders a typed fallback and reports the crash
 *     to main, where repeated crashes quarantine the plugin (same
 *     counter family as worker crashes). The shell and chat loop are
 *     never taken down by a panel render error.
 *   - `useCatalogSurfaceTabs`: hook returning `FireflySidePanelTab[]`
 *     derived solely from the catalog, ready to merge with the
 *     remaining hardcoded registry rows via `mergeSurfaceTabs`.
 *
 * Trust rule (plan §2.1): only `host-reconciler` panels from the
 * component registry render in-process — and the registry only ever
 * contains first-party built-ins. Other render modes are skipped
 * until their host surfaces land (declarative-props → Loom, iframe →
 * sandbox policy task).
 */

import { ActivityIcon, BookTextIcon, BoxesIcon, DatabaseIcon, FileDiffIcon, FilesIcon, PlugIcon, RectangleEllipsisIcon, Share2Icon, SquarePenIcon, TerminalSquareIcon, WandSparklesIcon, type LucideIcon } from "lucide-react"
import { Button } from "@ch5me/ch5-ui-web"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { ProjectedSidePanel } from "../shared/firefly-plugin/renderer-projection"
import type { FireflySidePanelTab } from "./firefly-surface-registry"
import {
	catalogPanelToTabDescriptor,
	type CatalogSurfaceTabDescriptor,
} from "./firefly-plugin-surface-merge"
import { createLogger } from "./lib/logger"
import type { Agent } from "./lib/types"

const log = createLogger("firefly-plugin-surfaces")

export interface PluginPanelProps {
	agent: Agent
}

/**
 * Host registry: projected panel id → lazily imported panel component.
 * A migrated surface adds exactly one entry here (and deletes its
 * `FIREFLY_SURFACE_REGISTRY` row). First-party built-ins only.
 */
export const PLUGIN_PANEL_COMPONENTS: Readonly<
	Record<string, LazyExoticComponent<ComponentType<PluginPanelProps>>>
> = {
	"firefly.built-in.surface.notes.notes": lazy(() => import("../../plugins/notes/panel/notes-panel")),
	"firefly.built-in.surface.review.review": lazy(() => import("../../plugins/review/panel/review-panel")),
	"firefly.built-in.surface.files.files": lazy(() => import("../../plugins/files/panel/files-panel")),
	"firefly.built-in.surface.artifacts.artifacts": lazy(() => import("../../plugins/artifacts/panel/artifacts-panel")),
	"firefly.built-in.surface.bridges.bridges": lazy(() => import("../../plugins/bridges/panel/bridges-panel")),
	"firefly.built-in.surface.pulse.pulse": lazy(() => import("../../plugins/pulse/panel/pulse-panel")),
	"firefly.built-in.surface.memory.memory": lazy(() => import("../../plugins/memory/panel/memory-panel")),
	"firefly.built-in.surface.editor.editor": lazy(() => import("../../plugins/editor/panel/editor-panel")),
	"firefly.built-in.surface.terminal.terminal": lazy(() => import("../../plugins/terminal/panel/terminal-panel")),
	"firefly.built-in.surface.claude.claude": lazy(() => import("../../plugins/claude/panel/claude-panel")),
	"firefly.built-in.surface.oracle.oracle": lazy(() => import("../../plugins/oracle/panel/oracle-panel")),
}

/** Manifest icon-name → Lucide component. Extend per migrated surface. */
const PANEL_ICONS: Readonly<Record<string, LucideIcon>> = {
	"activity": ActivityIcon,
	"book-text": BookTextIcon,
	"boxes": BoxesIcon,
	"database": DatabaseIcon,
	"file-diff": FileDiffIcon,
	"files": FilesIcon,
	"share-2": Share2Icon,
	"square-pen": SquarePenIcon,
	"terminal-square": TerminalSquareIcon,
	"rectangle-ellipsis": RectangleEllipsisIcon,
	"wand-sparkles": WandSparklesIcon,
}

function panelIcon(iconName: string | null): LucideIcon {
	if (iconName && PANEL_ICONS[iconName]) return PANEL_ICONS[iconName]
	return PlugIcon
}

// ---------------------------------------------------------------------------
// Error boundary (UI containment tier)
// ---------------------------------------------------------------------------

export interface PluginPanelCrashReport {
	pluginId: string
	projectedId: string
	message: string
}

export interface PluginPanelBoundaryProps {
	pluginId: string
	projectedId: string
	title: string
	/** Injectable for tests; defaults to the preload IPC reporter. */
	reportCrash?: (report: PluginPanelCrashReport) => void
	children: ReactNode
}

interface PluginPanelBoundaryState {
	crashed: boolean
	message: string | null
}

function defaultReportCrash(report: PluginPanelCrashReport): void {
	log.error("Plugin panel crashed", { ...report })
	void window.elf?.plugins
		.reportPanelCrash(report.pluginId, report.message)
		.catch(() => undefined)
}

/**
 * Per-plugin React error boundary. Contains the throw, reports it to
 * the host supervision layer, renders a typed fallback with a retry
 * affordance. The rest of the app keeps running.
 */
export class PluginPanelBoundary extends Component<
	PluginPanelBoundaryProps,
	PluginPanelBoundaryState
> {
	state: PluginPanelBoundaryState = { crashed: false, message: null }

	static getDerivedStateFromError(error: unknown): PluginPanelBoundaryState {
		return {
			crashed: true,
			message: error instanceof Error ? error.message : String(error),
		}
	}

	componentDidCatch(error: Error, _info: ErrorInfo): void {
		const report: PluginPanelCrashReport = {
			pluginId: this.props.pluginId,
			projectedId: this.props.projectedId,
			message: error.message,
		}
		;(this.props.reportCrash ?? defaultReportCrash)(report)
	}

	private readonly handleRetry = (): void => {
		this.setState({ crashed: false, message: null })
	}

	render(): ReactNode {
		if (!this.state.crashed) return this.props.children
		return (
			<div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 p-6 text-center">
				<div className="text-sm font-medium text-foreground">
					{this.props.title} crashed
				</div>
				<div className="max-w-[320px] text-xs text-muted-foreground">
					The {this.props.title} surface hit an error and was contained. The rest of
					the app is unaffected. Repeated crashes quarantine the plugin.
				</div>
				{this.state.message ? (
					<code className="max-w-[320px] truncate rounded bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
						{this.state.message}
					</code>
				) : null}
				<Button type="button" variant="outline" size="sm" onClick={this.handleRetry}>
					Restart surface
				</Button>
			</div>
		)
	}
}

// ---------------------------------------------------------------------------
// Catalog → renderable tabs
// ---------------------------------------------------------------------------

async function fetchCatalogPanels(): Promise<ProjectedSidePanel[]> {
	if (typeof window === "undefined" || !window.elf?.plugins) return []
	const result = await window.elf.plugins.panels()
	return result.items as ProjectedSidePanel[]
}

export function buildCatalogSurfaceTab(
	descriptor: CatalogSurfaceTabDescriptor,
	agent: Agent,
): FireflySidePanelTab | null {
	if (descriptor.renderMode !== "host-reconciler") {
		// declarative-props renders via Loom (wave 6); iframe needs the
		// sandbox policy task. Neither has a host surface yet.
		return null
	}
	const PanelComponent = PLUGIN_PANEL_COMPONENTS[descriptor.projectedId]
	if (!PanelComponent) {
		// Fail loud: a catalog-served panel without a registered
		// component is a build/registration bug, not a renderable tab.
		log.warn("Catalog panel has no registered component; skipping tab", {
			projectedId: descriptor.projectedId,
			pluginId: descriptor.pluginId,
		})
		return null
	}
	const Icon = panelIcon(descriptor.iconName)
	return {
		id: descriptor.id,
		lane: descriptor.lane,
		label: descriptor.title,
		icon: <Icon className="size-4" />,
		title: descriptor.title,
		availability: descriptor.available
			? { available: true }
			: { available: false, reason: descriptor.unavailableReason ?? "Unavailable" },
		commandIds: [...descriptor.commandIds],
		persistenceKey: descriptor.persistenceKey,
		telemetryNamespace: descriptor.telemetryNamespace,
		target: { kind: "side-panel", tab: descriptor.id },
		render: () => (
			<PluginPanelBoundary
				pluginId={descriptor.pluginId}
				projectedId={descriptor.projectedId}
				title={descriptor.title}
			>
				<Suspense
					fallback={
						<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
							Loading {descriptor.title}…
						</div>
					}
				>
					<PanelComponent agent={agent} />
				</Suspense>
			</PluginPanelBoundary>
		),
	}
}

/**
 * Catalog-served side-panel tabs for the current agent. Refetches when
 * main broadcasts a catalog change (enable/disable/quarantine/reload).
 */
export function useCatalogSurfaceTabs(agent: Agent | null): FireflySidePanelTab[] {
	const queryClient = useQueryClient()
	const { data: panels } = useQuery({
		queryKey: ["firefly-plugin", "surface-panels"],
		queryFn: fetchCatalogPanels,
		staleTime: 5_000,
	})

	useEffect(() => {
		if (typeof window === "undefined" || !window.elf?.plugins) return
		return window.elf.plugins.onChanged(() => {
			void queryClient.invalidateQueries({ queryKey: ["firefly-plugin"] })
		})
	}, [queryClient])

	return useMemo(() => {
		if (!agent || !panels) return []
		const tabs: FireflySidePanelTab[] = []
		for (const panel of panels) {
			const descriptor = catalogPanelToTabDescriptor(panel)
			if (!descriptor) continue
			const tab = buildCatalogSurfaceTab(descriptor, agent)
			if (tab) tabs.push(tab)
		}
		return tabs
	}, [agent, panels])
}
