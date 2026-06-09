/**
 * Firefly Plugin System V2 — Plugins side-panel (V2-driven)
 *
 * Slice 5 surface migration: this panel reads from the V2 plugin
 * catalog (via `useFireflyPlugins()`) and renders one card per
 * registered plugin. It supersedes the hardcoded OpenCode-native
 * skills/commands/MCP view in `plugins-panel.tsx` for the V2 path.
 *
 * The legacy panel is preserved for OpenCode-native skills/commands
 * since those are sourced from the OpenCode server, not the V2
 * catalog. Side-by-side rendering is gated by feature flag.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangleIcon, Loader2Icon, PlugIcon, PowerIcon, PowerOffIcon, RefreshCwIcon, ShieldCheckIcon, ShieldOffIcon, SparklesIcon, UnlockIcon } from "lucide-react"

import {
	releasePluginQuarantine,
	setPluginEnabled,
	useFireflyPlugins,
	type FireflyPluginEntry,
	type FireflyPluginProjectionSummary,
} from "../../hooks/use-firefly-plugins"
import { Button } from "@ch5me/elf-ui/components/button"

interface V2PluginsPanelProps {
	agent: { sessionId: string; directory: string; project: string }
	className?: string
}

function findSummary(
	summaries: readonly FireflyPluginProjectionSummary[],
	pluginId: string,
): FireflyPluginProjectionSummary | null {
	return summaries.find((s) => s.pluginId === pluginId) ?? null
}

function StatusBadge({ status }: { status: FireflyPluginEntry["status"] }) {
	const tone =
		status === "active"
			? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
			: status === "quarantined"
				? "bg-destructive/15 text-destructive"
				: status === "degraded"
					? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
					: "bg-muted/40 text-muted-foreground"
	return (
		<span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${tone}`}>
			{status}
		</span>
	)
}

function TrustBadge({ trust }: { trust: FireflyPluginEntry["trust"] }) {
	const builtIn = trust === "built-in"
	return (
		<span
			className={
				builtIn
					? "inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
					: "inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
			}
		>
			{builtIn ? <ShieldCheckIcon className="size-2.5" aria-hidden="true" /> : <ShieldOffIcon className="size-2.5" aria-hidden="true" />}
			{trust}
		</span>
	)
}

function useV2PluginCatalog(agentDirectory: string) {
	const query = useFireflyPlugins()
	const invalidate = useQueryClient()
	const refresh = () => {
		void query.refetch()
		void invalidate.invalidateQueries({ queryKey: ["firefly-plugin", "list"] })
	}
	return { ...query, refresh, agentDirectory }
}

/**
 * Per-plugin operator lifecycle controls: enable/disable toggle and
 * release-quarantine. The host is the authority — buttons call the
 * existing `firefly-plugin:set-enabled` / `:release-quarantine` IPC and
 * the catalog list refetches from the new lifecycle overlay.
 */
function PluginLifecycleControls({
	plugin,
	onSettled,
}: {
	plugin: FireflyPluginEntry
	onSettled: () => void
}) {
	const toggle = useMutation({
		mutationFn: () => setPluginEnabled(plugin.pluginId, plugin.status === "disabled"),
		onSettled,
	})
	const release = useMutation({
		mutationFn: () => releasePluginQuarantine(plugin.pluginId, "operator release from plugins panel"),
		onSettled,
	})
	const busy = toggle.isPending || release.isPending
	const disabled = plugin.status === "disabled"
	return (
		<div className="flex shrink-0 items-center gap-1">
			{plugin.status === "quarantined" ? (
				<Button
					onClick={() => release.mutate()}
					disabled={busy}
					variant="outline"
					size="sm"
					type="button"
					data-testid={`v2-plugin-release-${plugin.pluginId}`}
					title="Release this plugin from quarantine"
				>
					{release.isPending ? (
						<Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
					) : (
						<UnlockIcon className="size-3.5" aria-hidden="true" />
					)}
					Release
				</Button>
			) : (
				<Button
					onClick={() => toggle.mutate()}
					disabled={busy}
					variant="outline"
					size="sm"
					type="button"
					data-testid={`v2-plugin-toggle-${plugin.pluginId}`}
					title={disabled ? "Enable this plugin" : "Disable this plugin"}
				>
					{toggle.isPending ? (
						<Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
					) : disabled ? (
						<PowerIcon className="size-3.5" aria-hidden="true" />
					) : (
						<PowerOffIcon className="size-3.5" aria-hidden="true" />
					)}
					{disabled ? "Enable" : "Disable"}
				</Button>
			)}
		</div>
	)
}

export function V2PluginsPanel({ agent, className }: V2PluginsPanelProps) {
	const catalog = useV2PluginCatalog(agent.directory)
	const fallback = useQuery({
		queryKey: ["firefly-plugin", "v2-panel-fallback", agent.directory],
		queryFn: async (): Promise<never> => {
			throw new Error("V2 plugin catalog unavailable")
		},
		enabled: false,
	})

	const plugins = catalog.data?.plugins ?? []
	const summaries = catalog.data?.summaries ?? []
	const appVersion = catalog.data?.appVersion ?? "unknown"

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="flex items-center gap-2">
							<PlugIcon className="size-4 text-foreground" aria-hidden="true" />
							<h3 className="text-sm font-medium text-foreground">Plugins (V2)</h3>
							<SparklesIcon className="size-3 text-muted-foreground" aria-hidden="true" />
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Host-side plugin catalog · app {appVersion} · {plugins.length} plugin{plugins.length === 1 ? "" : "s"} for {agent.project}
						</p>
					</div>
					<Button onClick={catalog.refresh} variant="outline" size="sm" type="button">
						<RefreshCwIcon className="size-4" aria-hidden="true" />
						Refresh
					</Button>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 py-4">
				{catalog.isLoading ? (
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
						Loading V2 plugin catalog…
					</div>
				) : catalog.isError ? (
					<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
						<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						<div>
							V2 plugin catalog failed to load. Falling back to legacy view.
							<br />
							<span className="text-[10px] text-muted-foreground">{String(fallback.error ?? catalog.error ?? "")}</span>
						</div>
					</div>
				) : plugins.length === 0 ? (
					<div className="rounded-md border border-dashed border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
						No V2 plugins registered. Add manifests under{" "}
						<code className="rounded bg-muted/40 px-1 py-0.5 font-mono">apps/desktop/src/shared/firefly-plugin/</code> to surface them here.
					</div>
				) : (
					<ul className="space-y-2" data-testid="v2-plugins-list">
						{plugins.map((plugin) => {
							const summary = findSummary(summaries, plugin.pluginId)
							return (
								<li
									key={plugin.pluginId}
									data-testid={`v2-plugin-row-${plugin.pluginId}`}
									className="rounded-md border border-border bg-card px-3 py-2"
								>
									<div className="flex items-start justify-between gap-2">
										<div className="space-y-1">
											<div className="flex items-center gap-2">
												<span className="font-mono text-xs font-medium text-foreground">{plugin.displayName}</span>
												<span className="text-[10px] text-muted-foreground">v{plugin.version}</span>
												<TrustBadge trust={plugin.trust} />
												<StatusBadge status={plugin.status} />
											</div>
											<div className="font-mono text-[10px] text-muted-foreground">{plugin.pluginId}</div>
										</div>
										<PluginLifecycleControls plugin={plugin} onSettled={catalog.refresh} />
									</div>
									{plugin.statusDetail ? (
										<div
											className="mt-1 flex items-start gap-1 text-[10px] text-destructive"
											data-testid={`v2-plugin-status-detail-${plugin.pluginId}`}
										>
											<AlertTriangleIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
											{plugin.statusDetail}
										</div>
									) : null}
									{summary ? (
										<dl className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
											<div>
												<dt className="inline">panels: </dt>
												<dd className="inline font-mono text-foreground">{summary.panelCount}</dd>
											</div>
											<div>
												<dt className="inline">widgets: </dt>
												<dd className="inline font-mono text-foreground">{summary.widgetCount}</dd>
											</div>
											<div>
												<dt className="inline">commands: </dt>
												<dd className="inline font-mono text-foreground">{summary.commandCount}</dd>
											</div>
											<div>
												<dt className="inline">themes: </dt>
												<dd className="inline font-mono text-foreground">{summary.themeCount}</dd>
											</div>
											<div>
												<dt className="inline">tools: </dt>
												<dd className="inline font-mono text-foreground">{summary.toolCount}</dd>
											</div>
										</dl>
									) : null}
									{plugin.requiredCapabilities.length > 0 || plugin.defaultGrantedCapabilities.length > 0 ? (
										<details className="mt-2 text-[10px] text-muted-foreground">
											<summary className="cursor-pointer text-foreground">Capabilities</summary>
											<div className="mt-1 space-y-0.5">
												<div>
													<span className="uppercase tracking-wide">requires:</span>{" "}
													<span className="font-mono">{plugin.requiredCapabilities.join(", ") || "—"}</span>
												</div>
												<div>
													<span className="uppercase tracking-wide">granted:</span>{" "}
													<span className="font-mono">{plugin.defaultGrantedCapabilities.join(", ") || "—"}</span>
												</div>
											</div>
										</details>
									) : null}
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</div>
	)
}
