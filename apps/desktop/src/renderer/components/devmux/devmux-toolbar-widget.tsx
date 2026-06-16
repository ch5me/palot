/**
 * DevMux Toolbar — inline widget rendered in the `above-chat` zone.
 *
 * Host-bundled React component for the `firefly.built-in.devmux-toolbar`
 * plugin. It reads the active project's DevMux services and drives them
 * through the renderer DevMux client (`services/devmux.ts`), which transparently
 * uses the firefly-plugin IPC in Electron and the `/api/devmux/*` server route
 * in the web build. The widget itself never imports a Node library.
 *
 * The surrounding card chrome (border, "DevMux" title, drag handle) is
 * provided by SessionWidgetCard; this component renders only the body.
 *
 * Behaviour: lists declared services with a live running dot; clicking a
 * service reveals "In app" (hands the URL to the Browser side-panel surface via
 * `useOpenInBrowserPanel` — plugin → surface communication) and "Browser"
 * (system browser) actions; both ensure the service is running first. If the
 * project has no devmux config (or the host is unreachable), it renders nothing.
 */

import { useCallback, useEffect, useState } from "react"
import { cn } from "@ch5me/ch5-ui-web"
import { ExternalLink, Loader2, MonitorPlay, RefreshCw } from "lucide-react"

import { openExternalUrl } from "../../services/backend"
import {
	type DevmuxServiceRuntime,
	type DevmuxServiceSummary,
	ensureService,
	listServices,
	statusAll,
} from "../../services/devmux"
import { useOpenInBrowserPanel } from "../side-panel/open-in-browser-panel"
import type { Agent } from "../../lib/types"

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
	const [note, setNote] = useState<string | null>(null)
	const openInBrowserPanel = useOpenInBrowserPanel()

	const refreshStatus = useCallback(async () => {
		try {
			const entries = await statusAll(projectDir)
			const map: Record<string, DevmuxServiceRuntime> = {}
			for (const entry of entries) map[entry.name] = entry
			setRuntime(map)
		} catch {
			// Host unreachable; leave the last known status in place.
		}
	}, [projectDir])

	useEffect(() => {
		let cancelled = false
		setServices(null)
		setHidden(false)
		setSelected(null)
		setRuntime({})
		void (async () => {
			try {
				const list = await listServices(projectDir)
				if (cancelled) return
				setServices(list)
				void refreshStatus()
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
				const result = await ensureService(projectDir, service)
				void refreshStatus()
				if (!result.url) {
					setNote(`${service} is running but exposes no URL (no port).`)
					return
				}
				if (target === "embed") {
					await openInBrowserPanel(result.url, `devmux-${service}`, service)
				} else {
					await openExternalUrl(result.url)
				}
				setSelected(null)
			} catch (cause) {
				setNote(cause instanceof Error ? cause.message : `Could not start ${service}`)
			} finally {
				setBusy((prev) => ({ ...prev, [service]: false }))
			}
		},
		[projectDir, refreshStatus, openInBrowserPanel],
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
		</div>
	)
}
