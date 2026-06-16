/**
 * Browser surface panel — V2 plugin panel component.
 *
 * Relocated from `src/renderer/components/side-panel/browser-panel.tsx`
 * as part of the browser surface V2 migration. Props satisfy
 * `PluginPanelProps` (`{ agent: Agent }`).
 */

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input } from "@ch5me/ch5-ui-web";
import {
	AlertTriangleIcon,
	EllipsisIcon,
	ExternalLinkIcon,
	GlobeIcon,
	LoaderCircleIcon,
	PlusIcon,
	RefreshCwIcon,
	RotateCcwIcon,
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
} from "../../../src/renderer/atoms/browser"
import {
	createRemoteBrowserLane,
	ELF_SERVER_BASE_URL,
	fetchBrowserLaneHealth,
	fetchBrowserLanes,
	isElectron,
	navigateBrowserLane,
	readHostClipboardText,
	restartBrowserLane,
	resetBrowserLaneProfile,
	startBrowserLane,
	writeHostClipboardText,
} from "../../../src/renderer/services/backend"
import {
	summarizeBrowserLaneHealth,
	type BrowserLaneSurfaceKind,
} from "../../../src/shared/browser-lanes"
import type { Agent, BrowserLane, BrowserLaneHealth } from "../../../src/renderer/lib/types"

interface BrowserPanelProps {
	agent: Agent
	className?: string
}

const FALLBACK_URL = "about:blank"
const USER_DEFAULT_URL = "https://example.com"
const STARTUP_HEALTH_POLL_INTERVAL_MS = 1000
const STARTUP_HEALTH_MAX_POLLS = 60

function defaultSurfaceKindForCreateForm(streamBackendUrl: string, cdpEndpoint: string): BrowserLaneSurfaceKind {
	return cdpEndpoint.trim() ? "selkies-stream" : streamBackendUrl.trim() ? "direct-iframe" : "selkies-stream"
}

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

function BrowserPanel({ agent: _agent, className }: BrowserPanelProps) {
	const [persistedUrl, setPersistedUrl] = useAtom(lastBrowserUrlAtom)
	const [, setHistory] = useAtom(browserHistoryAtom)
	const [activeLaneId, setActiveLaneId] = useAtom(activeBrowserLaneIdAtom)
	const [inputValue, setInputValue] = useState(() => pickInitialUserUrl(persistedUrl))
	const [currentUrl, setCurrentUrl] = useState(() => pickInitialUserUrl(persistedUrl))
	const [inputError, setInputError] = useState<string | null>(null)
	const [laneList, setLaneList] = useState<BrowserLane[]>([])
	const [laneHealth, setLaneHealth] = useState<BrowserLaneHealth | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [loadFailure, setLoadFailure] = useState<string | null>(null)
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [createForm, setCreateForm] = useState<{
		id: string
		label: string
		surfaceKind: BrowserLaneSurfaceKind
		streamBackendUrl: string
		cdpEndpoint: string
		host: string
		profilePath: string
	}>({
		id: "",
		label: "",
		surfaceKind: "selkies-stream",
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
		return buildBrowserLaneDisplayUrl(activeLane, {
			isElectron,
			backendBaseUrl: ELF_SERVER_BASE_URL,
		})
	}, [activeLane])

	const healthSummary = useMemo(
		() => (laneHealth ? summarizeBrowserLaneHealth(laneHealth) : "No lane health yet"),
		[laneHealth],
	)

	const panelState = useMemo(() => {
		if (!activeLane) {
			return {
				title: "No browser lane ready",
				detail: "Create or start a browser lane to render the browser surface.",
				showFrame: false,
			}
		}
		if (!laneHealth) {
			return {
				title: "Checking browser lane",
				detail:
					activeLane.surfaceKind === "direct-iframe"
						? "Waiting for iframe reachability."
						: "Waiting for stream and CDP status.",
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
				title: activeLane.surfaceKind === "direct-iframe" ? "Iframe live" : "Stream live",
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
	const startupHealthPollAttemptsRef = React.useRef<Map<string, number>>(new Map())

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
		if (activeLane.surfaceKind === "direct-iframe") {
			const nextUrl = persistedUrl && persistedUrl !== FALLBACK_URL ? persistedUrl : streamUrl
			setCurrentUrl(nextUrl)
			setInputValue(nextUrl)
		}
		return () => {
			cancelled = true
		}
	}, [activeLane, persistedUrl, streamUrl])

	useEffect(() => {
		if (!activeLane) return
		if (activeLane.surfaceKind === "direct-iframe") return
		if (activeLane.mode !== "local" || activeLane.runtime !== "docker-chromium") return
		if (autoStartAttemptedRef.current.has(activeLane.id)) return
		const health = laneHealth
		if (!health) return
		if (health.status !== "profile-locked" && health.status !== "stopped") return
		autoStartAttemptedRef.current.add(activeLane.id)
		startupHealthPollAttemptsRef.current.delete(activeLane.id)
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

	useEffect(() => {
		if (!activeLane) return
		if (activeLane.surfaceKind === "direct-iframe") return
		if (activeLane.mode !== "local" || activeLane.runtime !== "docker-chromium") return
		if (!laneHealth) return
		if (laneHealth.status === "error") return
		if (laneHealth.stream.state === "ready" && laneHealth.cdp.state === "ready") {
			startupHealthPollAttemptsRef.current.delete(activeLane.id)
			return
		}
		const attempts = startupHealthPollAttemptsRef.current.get(activeLane.id) ?? 0
		if (attempts >= STARTUP_HEALTH_MAX_POLLS) return

		let cancelled = false
		const timeout = window.setTimeout(() => {
			startupHealthPollAttemptsRef.current.set(activeLane.id, attempts + 1)
			void fetchBrowserLaneHealth(activeLane.id)
				.then((health) => {
					if (cancelled) return
					setLaneHealth(health)
					if (health.stream.state === "ready") {
						setLoadFailure(null)
					}
				})
				.catch((error) => {
					if (cancelled) return
					setLoadFailure(error instanceof Error ? error.message : String(error))
				})
		}, STARTUP_HEALTH_POLL_INTERVAL_MS)

		return () => {
			cancelled = true
			window.clearTimeout(timeout)
		}
	}, [activeLane, laneHealth])

	const navigateToUrl = async (rawUrl: string) => {
		if (!activeLane) {
			setInputError("No browser lane is selected.")
			return
		}
		const nextUrl = buildNavigableUrl(rawUrl)
		if (!nextUrl) {
			setInputError(
				"Couldn't build a URL from that. Try https://example.com, example.com, or leave blank to reset.",
			)
			return
		}
		setInputError(null)
		setLoadFailure(null)
		setIsLoading(true)
		try {
			if (activeLane.surfaceKind === "direct-iframe") {
				setCurrentUrl(nextUrl)
				setInputValue(nextUrl)
				setPersistedUrl(nextUrl)
				setHistory((current) => pushBrowserHistory(current, nextUrl))
				const health = await fetchBrowserLaneHealth(activeLane.id)
				setLaneHealth(health)
				return
			}
			await navigateBrowserLane(activeLane.id, nextUrl)
			const navigatedUrl = nextUrl
			setCurrentUrl(navigatedUrl)
			setInputValue(navigatedUrl)
			setPersistedUrl(navigatedUrl)
			setHistory((current) => pushBrowserHistory(current, navigatedUrl))
			const health = await fetchBrowserLaneHealth(activeLane.id)
			setLaneHealth(health)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			setInputError(message)
			setLoadFailure(message)
		} finally {
			setIsLoading(false)
		}
	}

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		void navigateToUrl(inputValue)
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

	const handleRefresh = async () => {
		if (!activeLane) return
		startupHealthPollAttemptsRef.current.delete(activeLane.id)
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
		startupHealthPollAttemptsRef.current.delete(activeLane.id)
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
		startupHealthPollAttemptsRef.current.delete(activeLane.id)
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

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const data = event.data
			if (!data || typeof data !== "object") return
			if (data.type === "elf-browser-lane-clipboard-copy" && typeof data.text === "string") {
				void writeHostClipboardText(data.text)
			}
		}
		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	const handlePasteFromHost = async () => {
		const iframe = document.querySelector<HTMLIFrameElement>('iframe[title^="Browser lane "]')
		if (!iframe?.contentWindow) return
		const text = await readHostClipboardText()
		if (!text) return
		iframe.contentWindow.postMessage({ type: "elf-browser-lane-host-paste", text }, "*")
	}

	const handleCreateLane = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setCreateError(null)
		const id = createForm.id.trim()
		const label = createForm.label.trim() || id
		const streamBackendUrl = createForm.streamBackendUrl.trim()
		const cdpEndpoint = createForm.cdpEndpoint.trim() || null
		if (!id) {
			setCreateError("Lane id is required")
			return
		}
		if (!streamBackendUrl) {
			setCreateError(
				createForm.surfaceKind === "direct-iframe"
					? "Target URL is required"
					: "Stream backend URL is required",
			)
			return
		}
		setCreateBusy(true)
		try {
			const lane = await createRemoteBrowserLane({
				id,
				label,
				surfaceKind: createForm.surfaceKind,
				streamBackendUrl,
				cdpEndpoint,
				host: createForm.host.trim() || null,
				profilePath: createForm.profilePath.trim() || null,
			})
			setLaneList((current) => {
				const filtered = current.filter((entry) => entry.id !== lane.id)
				return [...filtered, lane]
			})
			setActiveLaneId(lane.id)
			setIsCreateOpen(false)

			setCreateForm({
				id: "",
				label: "",
				surfaceKind: "selkies-stream",
				streamBackendUrl: "",
				cdpEndpoint: "",
				host: "",
				profilePath: "",
			})
		} catch (error) {
			setCreateError(error instanceof Error ? error.message : String(error))
		} finally {
			setCreateBusy(false)
		}
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-2 py-1.5">
				<form className="flex items-center gap-1.5" onSubmit={handleSubmit}>
					<div className="min-w-0 shrink-0 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
						Browser
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => void handleRefresh()}
						className="size-7 shrink-0"
						aria-label="Refresh"
					>
						{isLoading ? (
							<LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
						) : (
							<RefreshCwIcon className="size-3.5" aria-hidden="true" />
						)}
					</Button>
					<Input
						value={inputValue}
						onChange={(event) => {
							setInputValue(event.target.value)
							if (inputError) setInputError(null)
						}}
						placeholder="Enter URL"
						className="h-8 min-w-0 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-1"
						aria-invalid={inputError != null}
						style={{
							// @ts-expect-error -- vendor-prefixed CSS property
							WebkitAppRegion: "no-drag",
						}}
					/>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={handleOpenExternal}
						className="size-7 shrink-0"
						disabled={!canOpenExternal}
						aria-label="Open in browser"
					>
						<ExternalLinkIcon className="size-3.5" aria-hidden="true" />
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-7 shrink-0"
									aria-label="Browser menu"
								/>
							}
						>
							<EllipsisIcon className="size-3.5" aria-hidden="true" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-64">
							<div className="px-2 py-1.5 text-[11px] text-muted-foreground">
								<div className="truncate font-medium text-foreground">{activeLane?.label ?? "No lane"}</div>
								<div className="truncate">{currentUrl || FALLBACK_URL}</div>
								{laneHealth ? <div className="mt-1 truncate">{panelState.title}: {panelState.detail}</div> : null}
							</div>
							<DropdownMenuSeparator />
							<div className="px-2 py-1.5">
								<label className="mb-1 block text-[11px] text-muted-foreground">Lane</label>
								<select
									value={activeLane?.id ?? activeLaneId}
									onChange={(event) => setActiveLaneId(event.target.value)}
									className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
								>
									{laneList.map((lane) => (
										<option key={lane.id} value={lane.id}>
											{lane.label}
										</option>
									))}
								</select>
							</div>
							<DropdownMenuItem onClick={() => void handleRestart()}>
								<RotateCcwIcon className="size-3.5" aria-hidden="true" />
								Restart lane
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => void handlePasteFromHost()}>
								Paste host clipboard
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => {
								setIsCreateOpen((value) => !value)
								setCreateError(null)
							}}>
								<PlusIcon className="size-3.5" aria-hidden="true" />
								{isCreateOpen ? "Hide new lane" : "New lane"}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={handleReset} disabled={currentUrl === FALLBACK_URL}>
								Reset URL
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => void handleResetProfile()}>
								Reset profile
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</form>
				{inputError ? (
					<div className="mt-1 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-[11px] text-destructive">
						<AlertTriangleIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
						<span>{inputError}</span>
					</div>
				) : null}
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-2 p-0">
				{isCreateOpen ? (
					<form
						onSubmit={handleCreateLane}
						className="mx-2 mt-2 flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-3 text-xs"
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
								<span className="text-[11px] text-muted-foreground">Surface kind</span>
								<select
									value={createForm.surfaceKind}
									onChange={(event) =>
										setCreateForm((form) => ({
											...form,
											surfaceKind: event.target.value as BrowserLaneSurfaceKind,
										}))
									}
									className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
								>
									<option value="selkies-stream">Selkies stream</option>
									<option value="direct-iframe">Direct iframe</option>
								</select>
							</label>
							<label className="flex flex-col gap-1 text-foreground sm:col-span-2">
								<span className="text-[11px] text-muted-foreground">
									{createForm.surfaceKind === "direct-iframe"
										? "Target URL (required)"
										: "Stream backend URL (required)"}
								</span>
								<Input
									value={createForm.streamBackendUrl}
									onChange={(event) =>
										setCreateForm((form) => ({
											...form,
											streamBackendUrl: event.target.value,
											surfaceKind: defaultSurfaceKindForCreateForm(
												event.target.value,
												form.cdpEndpoint,
											),
										}))
									}
									placeholder={
										createForm.surfaceKind === "direct-iframe"
											? "http://127.0.0.1:8077"
											: "http://host:3000"
									}
									className="h-8"
									required
								/>
							</label>
							<label className="flex flex-col gap-1 text-foreground">
								<span className="text-[11px] text-muted-foreground">CDP endpoint</span>
								<Input
									value={createForm.cdpEndpoint}
									onChange={(event) =>
										setCreateForm((form) => ({
											...form,
											cdpEndpoint: event.target.value,
											surfaceKind: defaultSurfaceKindForCreateForm(
												form.streamBackendUrl,
												event.target.value,
											),
										}))
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
				{loadFailure ? (
					<div className="mx-2 mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
						<div className="font-medium">Lane failed: {loadFailure}</div>
						<div className="mt-1 text-[11px] opacity-80">Use restart or refresh to recover stream state.</div>
					</div>
				) : null}
				<div
					className="min-h-0 flex-1 overflow-hidden border-y border-border bg-muted/20"
					style={{
						// @ts-expect-error -- vendor-prefixed CSS property
						WebkitAppRegion: "no-drag",
					}}
				>
					{activeLane && panelState.showFrame ? (
						<iframe
							src={activeLane.surfaceKind === "direct-iframe" ? currentUrl : streamUrl}
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

export default BrowserPanel
