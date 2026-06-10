import { AlertTriangleIcon, Loader2Icon } from "lucide-react"
import { Suspense, type ComponentType, lazy, useMemo } from "react"

import type { Agent } from "../../lib/types"
import { useFireflyPluginPanels } from "../../hooks/use-firefly-plugin-panels"

interface PluginPanelBoundaryProps {
	pluginId: string
	contributionId: string
	hostComponent: ComponentType<{ agent: Agent; className?: string }>
	hostLazyImport?: () => Promise<{ default: ComponentType<{ agent: Agent; className?: string }> }>
	agent: Agent
	className?: string
}

function BoundaryFallback({ message }: { message: string }) {
	return (
		<div className="flex h-full min-h-0 items-center justify-center px-4 text-center text-xs text-muted-foreground">
			{message}
		</div>
	)
}

export function PluginPanelBoundary({
	pluginId,
	contributionId,
	hostComponent: HostComponent,
	hostLazyImport,
	agent,
	className,
}: PluginPanelBoundaryProps) {
	const panelQuery = useFireflyPluginPanels()
	const projectedPanel = panelQuery.data?.items.find(
		(item) => item.pluginId === pluginId && item.contributionId === contributionId,
	)

	const LazyHostComponent = useMemo(
		() => (hostLazyImport ? lazy(hostLazyImport) : null),
		[hostLazyImport],
	)

	if (panelQuery.isLoading) {
		return (
			<div className="flex h-full min-h-0 items-center justify-center gap-2 text-xs text-muted-foreground">
				<Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
				Loading plugin surface…
			</div>
		)
	}

	if (panelQuery.isError) {
		return <BoundaryFallback message="Plugin surface catalog unavailable." />
	}

	if (!projectedPanel) {
		return <BoundaryFallback message="Plugin surface is not registered in the catalog." />
	}

	if (!projectedPanel.availability.available) {
		return (
			<div className="flex h-full min-h-0 items-center justify-center px-4 text-center text-xs text-muted-foreground">
				<div className="space-y-2">
					<div className="flex items-center justify-center gap-2 text-foreground">
						<AlertTriangleIcon className="size-4" aria-hidden="true" />
						<span>Plugin surface unavailable</span>
					</div>
					<div>{projectedPanel.availability.reason?.message ?? "Host blocked this surface."}</div>
				</div>
			</div>
		)
	}

	if (LazyHostComponent) {
		return (
			<Suspense fallback={<BoundaryFallback message="Loading plugin surface chunk…" />}>
				<LazyHostComponent agent={agent} className={className} />
			</Suspense>
		)
	}

	return <HostComponent agent={agent} className={className} />
}
