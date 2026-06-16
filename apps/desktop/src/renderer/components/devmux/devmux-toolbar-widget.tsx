/**
 * DevMux Toolbar — inline widget rendered in the `above-chat` zone.
 *
 * Host-bundled React component for the `firefly.built-in.devmux-toolbar`
 * plugin. It reads the active project's DevMux services and drives them
 * entirely through host commands (`devmux-list` / `devmux-status` /
 * `devmux-launch` / `devmux-open-external`) over the firefly-plugin invoke
 * IPC — it never imports a Node library. All the privileged work happens in
 * the main process behind the `host:devmux.*` capability tokens.
 *
 * The surrounding card chrome (border, "DevMux" title, drag handle) is
 * provided by SessionWidgetCard; this component renders only the body.
 *
 * Behaviour: lists declared services with a live running dot; clicking a
 * service reveals "In app" (embedded iframe) and "Browser" (system browser)
 * actions; both ensure the service is running first. If the project has no
 * devmux config (or the host bridge is unavailable, e.g. the web build where
 * window.elf is absent), the widget renders nothing.
 */

import { useCallback, useEffect, useState } from "react"
import { cn } from "@ch5me/ch5-ui-web"
import { ExternalLink, Loader2, MonitorPlay, RefreshCw, X } from "lucide-react"

import { invokePluginCommand } from "../../hooks/use-firefly-plugins"
import type { Agent } from "../../lib/types"

const PLUGIN_ID = "firefly.built-in.devmux-toolbar"

interface DevmuxServiceSummary {
	name: string
	description: string | null
	command: string
	port: number | null
	dashboard: boolean
	dependsOn: string[]
}

interface DevmuxServiceRuntime {
	name: string
	healthy: boolean
	managedByDevmux: boolean
	port: number | null
	url: string | null
}

interface DevmuxListData {
	project: string
	configRoot: string
	services: DevmuxServiceSummary[]
}

interface DevmuxStatusData {
	services: DevmuxServiceRuntime[]
}

interface DevmuxEnsureData {
	service: string
	startedByUs: boolean
	url: string | null
}

async function invoke(commandId: string, args: Record<string, unknown>) {
	return invokePluginCommand({ pluginId: PLUGIN_ID, commandId, args })
}

function statusDotClass(runtime: DevmuxServiceRuntime | undefined): string {
	if (runtime?.healthy) return "bg-emerald-500"
	if (runtime?.managedByDevmux) return "bg-amber-400 animate-pulse"
	return "bg-muted-foreground/40"
}

function statusTitle(runtime: DevmuxServiceRuntime | undefined): string {
	if (runtime?.healthy) return "running"
	if (runtime?.managedByDevmux) return "starting"
	return "stopped"
}

export function DevmuxToolbarWidget({ agent }: { agent: Agent }) {
	const projectDir = agent.projectDirectory
	const [services, setServices] = useState<DevmuxServiceSummary[] | null>(null)
	const [hidden, setHidden] = useState(false)
	const [runtime, setRuntime] = useState<Record<string, DevmuxServiceRuntime>>({})
	const [busy, setBusy] = useState<Record<string, boolean>>({})
	const [selected, setSelected] = useState<string | null>(null)
	const [embed, setEmbed] = useState<{ service: string; url: string } | null>(null)
	const [note, setNote] = useState<string | null>(null)

	const refreshStatus = useCallback(async () => {
		try {
			const res = await invoke("devmux-status", { projectDir })
			if (res.status === "completed") {
				const data = res.data as DevmuxStatusData
				const map: Record<string, DevmuxServiceRuntime> = {}
				for (const entry of data.services) map[entry.name] = entry
				setRuntime(map)
			}
		} catch {
			// Host bridge unavailable; leave the last known status in place.
		}
	}, [projectDir])

	useEffect(() => {
		let cancelled = false
		setServices(null)
		setHidden(false)
		setEmbed(null)
		setSelected(null)
		setRuntime({})
		void (async () => {
			try {
				const res = await invoke("devmux-list", { projectDir })
				if (cancelled) return
				if (res.status === "completed") {
					const data = res.data as DevmuxListData
					setServices(data.services)
					void refreshStatus()
				} else {
					setHidden(true)
				}
			} catch {
				if (!cancelled) setHidden(true)
			}
		})()
		return () => {
			cancelled = true
		}
	}, [projectDir, refreshStatus])

	useEffect(() => {
		if (!services || services.length === 0) return
		const id = setInterval(() => {
			void refreshStatus()
		}, 5000)
		return () => clearInterval(id)
	}, [services, refreshStatus])

	const launch = useCallback(
		async (service: string, target: "embed" | "external") => {
			setBusy((prev) => ({ ...prev, [service]: true }))
			setNote(null)
			try {
				const res = await invoke("devmux-launch", { projectDir, service })
				if (res.status !== "completed") {
					setNote(res.errorMessage ?? `Could not start ${service}`)
					return
				}
				const data = res.data as DevmuxEnsureData
				void refreshStatus()
				if (!data.url) {
					setNote(`${service} is running but exposes no URL (no port).`)
					return
				}
				if (target === "embed") {
					setEmbed({ service, url: data.url })
				} else {
					const open = await invoke("devmux-open-external", { url: data.url })
					if (open.status !== "completed") {
						setNote(open.errorMessage ?? "Could not open in browser")
					}
				}
				setSelected(null)
			} catch (cause) {
				setNote(cause instanceof Error ? cause.message : `Could not start ${service}`)
			} finally {
				setBusy((prev) => ({ ...prev, [service]: false }))
			}
		},
		[projectDir, refreshStatus],
	)

	if (hidden || !services || services.length === 0) return null

	return (
		<div className="flex flex-col gap-2 text-sm">
			<div className="flex flex-wrap items-center gap-1.5">
				{services.map((service) => {
					const live = runtime[service.name]
					const isBusy = busy[service.name]
					const isOpen = selected === service.name
					return (
						<div key={service.name} className="flex items-center">
							<button
								type="button"
								title={`${statusTitle(live)} — ${service.description ?? service.command}`}
								onClick={() => setSelected(isOpen ? null : service.name)}
								className={cn(
									"flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors",
									isOpen
										? "border-border bg-muted"
										: "border-border/50 bg-muted/40 hover:bg-muted",
								)}
							>
								{isBusy ? (
									<Loader2 className="size-3 animate-spin text-amber-500" />
								) : (
									<span className={cn("size-2 rounded-full", statusDotClass(live))} />
								)}
								<span className="text-foreground">{service.name}</span>
								{service.port ? (
									<span className="text-[11px] text-muted-foreground">:{service.port}</span>
								) : null}
							</button>

							{isOpen ? (
								<div className="ml-1 flex items-center gap-1">
									<button
										type="button"
										disabled={isBusy}
										onClick={() => void launch(service.name, "embed")}
										className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-2 py-1 text-xs text-foreground/80 hover:bg-muted disabled:opacity-50"
									>
										<MonitorPlay className="size-3" /> In app
									</button>
									<button
										type="button"
										disabled={isBusy}
										onClick={() => void launch(service.name, "external")}
										className="flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-2 py-1 text-xs text-foreground/80 hover:bg-muted disabled:opacity-50"
									>
										<ExternalLink className="size-3" /> Browser
									</button>
								</div>
							) : null}
						</div>
					)
				})}

				<button
					type="button"
					title="Refresh status"
					onClick={() => void refreshStatus()}
					className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<RefreshCw className="size-3.5" />
				</button>
			</div>

			{note ? <div className="text-[11px] text-amber-600 dark:text-amber-400">{note}</div> : null}

			{embed ? (
				<div className="overflow-hidden rounded-md border border-border/50">
					<div className="flex items-center gap-2 border-b border-border/40 bg-muted/40 px-2 py-1 text-xs">
						<span className="text-foreground/80">{embed.service}</span>
						<span className="truncate text-muted-foreground">{embed.url}</span>
						<button
							type="button"
							title="Open in browser"
							onClick={() => void invoke("devmux-open-external", { url: embed.url })}
							className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							<ExternalLink className="size-3.5" />
						</button>
						<button
							type="button"
							title="Close preview"
							onClick={() => setEmbed(null)}
							className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
						>
							<X className="size-3.5" />
						</button>
					</div>
					<iframe
						title={`${embed.service} preview`}
						src={embed.url}
						className="h-[420px] w-full border-0 bg-white"
					/>
				</div>
			) : null}
		</div>
	)
}
