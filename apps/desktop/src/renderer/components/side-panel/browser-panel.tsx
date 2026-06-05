import { Button } from "@ch5me/elf-ui/components/button"
import { Input } from "@ch5me/elf-ui/components/input"
import {
	AlertTriangleIcon,
	ExternalLinkIcon,
	GlobeIcon,
	HistoryIcon,
	LoaderCircleIcon,
	PlusIcon,
	RefreshCwIcon,
	RotateCcwIcon,
	XIcon,
} from "lucide-react"
import { useAtom } from "jotai"
import React, { useEffect, useMemo, useState } from "react"
import {
	activeBrowserLaneIdAtom,
	browserHistoryAtom,
	buildBrowserLaneDisplayUrl,
	buildNavigableUrl,
	lastBrowserUrlAtom,
	pushBrowserHistory,
} from "../../atoms/browser"
import {
	createRemoteBrowserLane,
	fetchBrowserLaneHealth,
	fetchBrowserLanes,
	isElectron,
	restartBrowserLane,
	resetBrowserLaneProfile,
	startBrowserLane,
} from "../../services/backend"
import { summarizeBrowserLaneHealth } from "../../../shared/browser-lanes"
import type { Agent, BrowserLane, BrowserLaneHealth } from "../../lib/types"

interface BrowserPanelProps {
	agent: Agent
	className?: string
}

const FALLBACK_URL = "about:blank"
const USER_DEFAULT_URL = "https://example.com"

function pickInitialUserUrl(persisted: string | undefined): string {
	if (!persisted || persisted === FALLBACK_URL) return USER_DEFAULT_URL
	// Never seed the user input with a same-origin stream URL — those are iframe-only.
	if (/^https?:\/\/elf-browser-lane\.local\b/.test(persisted)) return USER_DEFAULT_URL
	return persisted
}

function isLikelyStreamUrl(url: string): boolean {
	if (!url) return false
	if (url === FALLBACK_URL) return true
	if (/^https?:\/\/elf-browser-lane\.local\b/.test(url)) return true
	return false
}

export function BrowserPanel({ agent, className }: BrowserPanelProps) {
	const [persistedUrl, setPersistedUrl] = useAtom(lastBrowserUrlAtom)
	const [history, setHistory] = useAtom(browserHistoryAtom)
	const [activeLaneId, setActiveLaneId] = useAtom(activeBrowserLaneIdAtom)
	const [inputValue, setInputValue] = useState(() => pickInitialUserUrl(persistedUrl))
	const [currentUrl, setCurrentUrl] = useState(() => pickInitialUserUrl(persistedUrl))
	const [inputError, setInputError] = useState<string | null>(null)
	const [laneList, setLaneList] = useState<BrowserLane[]>([])
	const [laneHealth, setLaneHealth] = useState<BrowserLaneHealth | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [loadFailure, setLoadFailure] = useState<string | null>(null)
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [createForm, setCreateForm] = useState({
		id: "",
		label: "",
		streamBackendUrl: "",
		cdpEndpoint: "",
		host: "",
		profilePath: "",
	})
	const [createError, setCreateError] = useState<string | null>(null)
	const [createBusy, setCreateBusy] = useState(false)

	const activeLane = useMemo(
		() => laneList.find((lane) => lane.id === activeLaneId) ?? laneList[0] ?? null,
		[laneList, activeLaneId],
	)

	const streamUrl = useMemo(() => {
		if (!activeLane) return FALLBACK_URL
		return buildBrowserLaneDisplayUrl(activeLane)
	}, [activeLane])

	const healthSummary = useMemo(
		() => (laneHealth ? summarizeBrowserLaneHealth(laneHealth) : "No lane health yet"),
		[laneHealth],
	)

	const panelState = useMemo(() => {
		if (!activeLane) {
			return {
				title: "No browser lane ready",
				detail: "Create or start a browser lane to render streamed browser surface.",
				showFrame: false,
			}
		}
		if (!laneHealth) {
			return {
				title: "Checking browser lane",
				detail: "Waiting for stream and CDP status.",
				showFrame: false,
			}
		}
		if (loadFailure) {
			return {
				title: "Lane request failed",
				detail: loadFailure,
				showFrame: false,
			}
		}
		if (laneHealth.stream.state === "ready") {
			return {
				title: "Stream live",
				detail: healthSummary,
				showFrame: true,
			}
		}
		if (laneHealth.cdp.state === "ready") {
			return {
				title: "CDP alive, stream missing",
				detail: "Restart or refresh lane route. Automation can connect but panel stream is stale.",
				showFrame: false,
			}
		}
		if (laneHealth.status === "profile-locked") {
			return {
				title: "Profile waiting",
				detail: laneHealth.message,
				showFrame: false,
			}
		}
		if (laneHealth.status === "error") {
			return {
				title: "Browser lane broken",
				detail: laneHealth.message,
				showFrame: false,
			}
		}
		return {
			title: "Browser lane not visible yet",
			detail: healthSummary,
			showFrame: false,
		}
	}, [activeLane, healthSummary, laneHealth, loadFailure])

	useEffect(() => {
		let cancelled = false
		setIsLoading(true)
		void fetchBrowserLanes()
			.then((lanes) => {
				if (cancelled) return
				setLaneList(lanes)
				const selected = lanes.find((lane) => lane.id === activeLaneId) ?? lanes[0] ?? null
				if (selected && selected.id !== activeLaneId) {
					setActiveLaneId(selected.id)
				}
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [activeLaneId, setActiveLaneId])

	const autoStartAttemptedRef = React.useRef<Set<string>>(new Set())

	useEffect(() => {
		if (!activeLane) return
		let cancelled = false
		void fetchBrowserLaneHealth(activeLane.id).then((health) => {
			if (cancelled) return
			setLaneHealth(health)
			if (
				health.status === "profile-locked" ||
				(health.status === "stopped" && activeLane.mode === "local" && activeLane.runtime === "docker-chromium")
			) {
				autoStartAttemptedRef.current.delete(activeLane.id)
			}
		})
		return () => {
			cancelled = true
		}
	}, [activeLane])

	useEffect(() => {
		if (!activeLane) return
		if (activeLane.mode !== "local" || activeLane.runtime !== "docker-chromium") return
		if (autoStartAttemptedRef.current.has(activeLane.id)) return
		const health = laneHealth
		if (!health) return
		if (health.status !== "profile-locked" && health.status !== "stopped") return
		autoStartAttemptedRef.current.add(activeLane.id)
		setLoadFailure(null)
		setIsLoading(true)
		let cancelled = false
		void startBrowserLane(activeLane.id)
			.then(async () => {
				if (cancelled) return
				const health = await fetchBrowserLaneHealth(activeLane.id)
				if (cancelled) return
				setLaneHealth(health)
			})
			.catch((error) => {
				if (cancelled) return
				autoStartAttemptedRef.current.delete(activeLane.id)
				setLoadFailure(error instanceof Error ? error.message : String(error))
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [activeLane, laneHealth])

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const nextUrl = buildNavigableUrl(inputValue)
		if (!nextUrl) {
			setInputError(
				"Couldn't build a URL from that. Try https://example.com, example.com, or leave blank to reset.",
			)
			return
		}
		setInputError(null)
		setCurrentUrl(nextUrl)
		setPersistedUrl(nextUrl)
		setHistory((current) => pushBrowserHistory(current, nextUrl))
	}

	const handleOpenExternal = async () => {
		if (!canOpenExternal) return
		try {
			if (isElectron && "elf" in window) {
				await window.elf.openExternal(currentUrl)
				return
			}
			const opened = window.open(currentUrl, "_blank", "noopener,noreferrer")
			if (!opened) {
				setInputError("Browser blocked opening a new tab.")
			}
		} catch (error) {
			setInputError(error instanceof Error ? error.message : String(error))
		}
	}

	const loadUrl = (rawUrl: string) => {
		const nextUrl = buildNavigableUrl(rawUrl)
		if (!nextUrl) {
			setInputError(
				"Couldn't build a URL from that. Try https://example.com, example.com, or leave blank to reset.",
			)
			return
		}
		setInputError(null)
		setCurrentUrl(nextUrl)
		setPersistedUrl(nextUrl)
		setHistory((current) => pushBrowserHistory(current, nextUrl))
	}

	const handleRefresh = async () => {
		if (!activeLane) return
		setLoadFailure(null)
		setIsLoading(true)
		try {
			await fetchBrowserLaneHealth(activeLane.id).then((health) => setLaneHealth(health))
		} catch (error) {
			setLoadFailure(error instanceof Error ? error.message : String(error))
		} finally {
			setIsLoading(false)
		}
	}

	const handleRestart = async () => {
		if (!activeLane) return
		setLoadFailure(null)
		setIsLoading(true)
		try {
			await restartBrowserLane(activeLane.id)
			const health = await fetchBrowserLaneHealth(activeLane.id)
			setLaneHealth(health)
		} catch (error) {
			setLoadFailure(error instanceof Error ? error.message : String(error))
		} finally {
			setIsLoading(false)
		}
	}

	const handleResetProfile = async () => {
		if (!activeLane) return
		setLoadFailure(null)
		setIsLoading(true)
		try {
			await resetBrowserLaneProfile(activeLane.id)
			const health = await fetchBrowserLaneHealth(activeLane.id)
			setLaneHealth(health)
		} catch (error) {
			setLoadFailure(error instanceof Error ? error.message : String(error))
		} finally {
			setIsLoading(false)
		}
	}

	const handleReset = () => {
		setInputValue(FALLBACK_URL)
		setCurrentUrl(FALLBACK_URL)
		setInputError(null)
		setLoadFailure(null)
		setPersistedUrl(FALLBACK_URL)
	}

	const canOpenExternal = useMemo(() => {
		if (!currentUrl) return false
		if (isLikelyStreamUrl(currentUrl)) return false
		return true
	}, [currentUrl])

	const handleCreateLane = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setCreateError(null)
		const id = createForm.id.trim()
		const label = createForm.label.trim() || id
		const streamBackendUrl = createForm.streamBackendUrl.trim()
		if (!id) {
			setCreateError("Lane id is required")
			return
		}
		if (!streamBackendUrl) {
			setCreateError("Stream backend URL is required")
			return
		}
		setCreateBusy(true)
		try {
			const lane = await createRemoteBrowserLane({
				id,
				label,
				streamBackendUrl,
				cdpEndpoint: createForm.cdpEndpoint.trim() || null,
				host: createForm.host.trim() || null,
				profilePath: createForm.profilePath.trim() || null,
			})
			setLaneList((current) => {
				const filtered = current.filter((entry) => entry.id !== lane.id)
				return [...filtered, lane]
			})
			setActiveLaneId(lane.id)
			setIsCreateOpen(false)
			setCreateForm({ id: "", label: "", streamBackendUrl: "", cdpEndpoint: "", host: "", profilePath: "" })
		} catch (error) {
			setCreateError(error instanceof Error ? error.message : String(error))
		} finally {
			setCreateBusy(false)
		}
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-medium text-foreground">Inline Browser</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							Browse {agent.project} docs, tools, and local references without leaving Elf.
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleReset}
						disabled={currentUrl === FALLBACK_URL}
					>
						<XIcon className="size-4" aria-hidden="true" />
						Reset
					</Button>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
				<form className="flex flex-wrap items-center gap-2" onSubmit={handleSubmit}>
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={() => void handleRefresh()}
						className="shrink-0"
						aria-label="Refresh"
					>
						{isLoading ? (
							<LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
						) : (
							<RefreshCwIcon className="size-4" aria-hidden="true" />
						)}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={() => void handleRestart()}
						className="shrink-0"
						aria-label="Restart lane"
					>
						<RotateCcwIcon className="size-4" aria-hidden="true" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void handleResetProfile()}
						className="shrink-0"
					>
						Reset profile
					</Button>
					<Input
						value={inputValue}
						onChange={(event) => {
							setInputValue(event.target.value)
							if (inputError) setInputError(null)
						}}
						placeholder="Enter URL (https://example.com)"
						className="h-9 min-w-0 flex-1 basis-52"
						aria-invalid={inputError != null}
						style={{
							// @ts-expect-error -- vendor-prefixed CSS property
							WebkitAppRegion: "no-drag",
						}}
					/>
					<Button type="submit" variant="outline" className="shrink-0">
						Go
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={handleOpenExternal}
						className="shrink-0"
						disabled={!canOpenExternal}
					>
						<ExternalLinkIcon className="size-4" aria-hidden="true" />
						Open in browser
					</Button>
				</form>
				{inputError ? (
					<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
						<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						<span>{inputError}</span>
					</div>
				) : null}
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<GlobeIcon className="size-3.5" aria-hidden="true" />
					<span className="truncate">{currentUrl || FALLBACK_URL}</span>
				</div>
				<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<span>Lane:</span>
					<select
						value={activeLane?.id ?? activeLaneId}
						onChange={(event) => setActiveLaneId(event.target.value)}
						className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
					>
						{laneList.map((lane) => (
							<option key={lane.id} value={lane.id}>
								{lane.label}
							</option>
						))}
					</select>
					{laneHealth ? <span>{laneHealth.status}</span> : null}
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							setIsCreateOpen((value) => !value)
							setCreateError(null)
						}}
						className="h-7 px-2"
						aria-expanded={isCreateOpen}
					>
						<PlusIcon className="size-3.5" aria-hidden="true" />
						New lane
					</Button>
				</div>
				{isCreateOpen ? (
					<form
						onSubmit={handleCreateLane}
						className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-3 text-xs"
					>
						<div className="font-medium text-foreground">Register remote browser lane</div>
						<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
							<label className="flex flex-col gap-1 text-foreground">
								<span className="text-[11px] text-muted-foreground">ID (required)</span>
								<Input
									value={createForm.id}
									onChange={(event) => setCreateForm((form) => ({ ...form, id: event.target.value }))}
									placeholder="prod-stream"
									className="h-8"
									required
								/>
							</label>
							<label className="flex flex-col gap-1 text-foreground">
								<span className="text-[11px] text-muted-foreground">Label</span>
								<Input
									value={createForm.label}
									onChange={(event) => setCreateForm((form) => ({ ...form, label: event.target.value }))}
									placeholder="Prod stream"
									className="h-8"
								/>
							</label>
							<label className="flex flex-col gap-1 text-foreground sm:col-span-2">
								<span className="text-[11px] text-muted-foreground">Stream backend URL (required)</span>
								<Input
									value={createForm.streamBackendUrl}
									onChange={(event) =>
										setCreateForm((form) => ({ ...form, streamBackendUrl: event.target.value }))
									}
									placeholder="http://host:3000"
									className="h-8"
									required
								/>
							</label>
							<label className="flex flex-col gap-1 text-foreground">
								<span className="text-[11px] text-muted-foreground">CDP endpoint</span>
								<Input
									value={createForm.cdpEndpoint}
									onChange={(event) =>
										setCreateForm((form) => ({ ...form, cdpEndpoint: event.target.value }))
									}
									placeholder="http://host:9222"
									className="h-8"
								/>
							</label>
							<label className="flex flex-col gap-1 text-foreground">
								<span className="text-[11px] text-muted-foreground">Host</span>
								<Input
									value={createForm.host}
									onChange={(event) => setCreateForm((form) => ({ ...form, host: event.target.value }))}
									placeholder="stream.example.com"
									className="h-8"
								/>
							</label>
							<label className="flex flex-col gap-1 text-foreground sm:col-span-2">
								<span className="text-[11px] text-muted-foreground">Profile path</span>
								<Input
									value={createForm.profilePath}
									onChange={(event) =>
										setCreateForm((form) => ({ ...form, profilePath: event.target.value }))
									}
									placeholder="~/.local/share/elf/browser-profiles/remote"
									className="h-8"
								/>
							</label>
						</div>
						{createError ? (
							<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-destructive">
								<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
								<span>{createError}</span>
							</div>
						) : null}
						<div className="flex justify-end gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => {
									setIsCreateOpen(false)
									setCreateError(null)
								}}
								disabled={createBusy}
							>
								Cancel
							</Button>
							<Button type="submit" variant="outline" size="sm" disabled={createBusy}>
								{createBusy ? "Registering..." : "Register lane"}
							</Button>
						</div>
					</form>
				) : null}
				{laneHealth ? (
					<div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
						<div className="font-medium text-foreground">{panelState.title}</div>
						<div className="mt-1">{panelState.detail}</div>
						<div className="mt-1 flex flex-wrap gap-3">
							<span>Stream: {laneHealth.stream.state}</span>
							<span>CDP: {laneHealth.cdp.state}</span>
							{activeLane?.mode === "remote" ? <span>Mode: remote</span> : null}
						</div>
					</div>
				) : null}
				{history.length > 1 ? (
					<div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
						<HistoryIcon className="size-3" aria-hidden="true" />
						<span>Recent:</span>
						{history.slice(0, 5).map((entry) => (
							<button
								key={entry}
								type="button"
								className="rounded-md border border-border/60 px-2 py-0.5 transition-colors hover:bg-muted hover:text-foreground"
								onClick={() => loadUrl(entry)}
							>
								{entry}
							</button>
						))}
					</div>
				) : null}
				{loadFailure ? (
					<div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
						<div className="font-medium">Lane failed: {loadFailure}</div>
						<div className="mt-1 text-[11px] opacity-80">Use restart or refresh to recover stream state.</div>
					</div>
				) : null}
				<div
					className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/20"
					style={{
						// @ts-expect-error -- vendor-prefixed CSS property
						WebkitAppRegion: "no-drag",
					}}
				>
					{activeLane && panelState.showFrame ? (
						<iframe
							src={streamUrl}
							title={`Browser lane ${activeLane.label}`}
							className="h-full w-full rounded-lg border-0 bg-background"
						/>
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
							<GlobeIcon className="size-10 text-muted-foreground/40" aria-hidden="true" />
							<div>
								<p className="text-sm font-medium text-foreground">{panelState.title}</p>
								<p className="mt-1 text-xs text-muted-foreground">{panelState.detail}</p>
							</div>
							<div className="flex flex-wrap justify-center gap-2">
								<Button type="button" variant="outline" size="sm" onClick={() => void handleRefresh()}>
									Refresh route
								</Button>
								<Button type="button" variant="outline" size="sm" onClick={() => void handleRestart()}>
									Restart lane
								</Button>
								<Button type="button" variant="outline" size="sm" onClick={handleOpenExternal} disabled={!canOpenExternal}>
									Open diagnostics
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
