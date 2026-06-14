import { Button } from "@ch5me/elf-ui/components/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@ch5me/elf-ui/components/dropdown-menu"
import { Input } from "@ch5me/elf-ui/components/input"
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
	buildBrowserPanelSurfaceUrl,
	buildNavigableUrl,
	getBrowserPanelNavigationStrategy,
	lastBrowserUrlAtom,
	pushBrowserHistory,
} from "../../atoms/browser"
import {
	createBrowserLane,
	ELF_SERVER_BASE_URL,
	fetchPalotSessionBinding,
	fetchBrowserLaneHealth,
	fetchBrowserLanes,
	isElectron,
	navigateBrowserLane,
	readHostClipboardText,
	restartBrowserLane,
	resetBrowserLaneProfile,
	startBrowserLane,
	writeHostClipboardText,
} from "../../services/backend"
import {
	summarizeBrowserLaneHealth,
} from "../../../shared/browser-lanes"
import {
	createDefaultBrowserPanelFormState,
	getBrowserPanelCreateFormViewModel,
} from "./browser-panel-form"
import { selectBrowserPanelLane } from "./browser-panel-selection"
import {
	getBrowserPanelActionLabels,
	getBrowserPanelFailureHint,
	getBrowserPanelState,
} from "./browser-panel-view-model"
import type { SessionBinding } from "../../../preload/api"
import type { Agent, BrowserLane, BrowserLaneHealth } from "../../lib/types"

interface BrowserPanelProps {
	agent: Agent
	className?: string
}

const FALLBACK_URL = "about:blank"
const USER_DEFAULT_URL = "https://example.com"
const STARTUP_HEALTH_POLL_INTERVAL_MS = 1000
const STARTUP_HEALTH_MAX_POLLS = 60

export function buildDirectIframeHealth(url: string, reachable: boolean): BrowserLaneHealth {
	const checkedAt = Date.now()
	const cleared = url === FALLBACK_URL
	return {
		status: cleared ? "stopped" : reachable ? "running" : "error",
		stream: {
			url: cleared ? null : url,
			checkedAt,
			state: cleared ? "unknown" : reachable ? "ready" : "failed",
			error: cleared || reachable ? null : "Target URL unreachable",
		},
		cdp: {
			url: null,
			checkedAt,
			state: "not-applicable",
			error: null,
		},
		message: cleared ? "Target cleared" : reachable ? "Direct iframe ready" : "Direct iframe unreachable or not configured",
	}
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

export function BrowserPanel({ agent: _agent, className }: BrowserPanelProps) {
	const [persistedUrl, setPersistedUrl] = useAtom(lastBrowserUrlAtom)
	const [, setHistory] = useAtom(browserHistoryAtom)
	const [activeLaneId, setActiveLaneId] = useAtom(activeBrowserLaneIdAtom)
	const [inputValue, setInputValue] = useState(() => pickInitialUserUrl(persistedUrl))
	const [currentUrl, setCurrentUrl] = useState(() => pickInitialUserUrl(persistedUrl))
	const [inputError, setInputError] = useState<string | null>(null)
	const [laneList, setLaneList] = useState<BrowserLane[]>([])
	const [laneHealth, setLaneHealth] = useState<BrowserLaneHealth | null>(null)
	const [sessionBinding, setSessionBinding] = useState<SessionBinding | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [loadFailure, setLoadFailure] = useState<string | null>(null)
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [createForm, setCreateForm] = useState(createDefaultBrowserPanelFormState)
	const [createError, setCreateError] = useState<string | null>(null)
	const [createBusy, setCreateBusy] = useState(false)
	const [frameNonce, setFrameNonce] = useState(0)
	const [directIframeHealth, setDirectIframeHealth] = useState<BrowserLaneHealth | null>(null)

	const activeLane = useMemo(
		() =>
			selectBrowserPanelLane({
				lanes: laneList,
				activeLaneId,
				binding: sessionBinding,
			}),
		[laneList, activeLaneId, sessionBinding],
	)

	const streamUrl = useMemo(() => {
		if (!activeLane) return FALLBACK_URL
		return buildBrowserPanelSurfaceUrl(activeLane, {
			isElectron,
			backendBaseUrl: ELF_SERVER_BASE_URL,
		})
	}, [activeLane])

	const effectiveLaneHealth = useMemo(() => {
		if (!activeLane || activeLane.surfaceKind !== "direct-iframe") return laneHealth
		if (currentUrl === FALLBACK_URL) return directIframeHealth
		const persistedTargetUrl = activeLane.targetUrl ?? FALLBACK_URL
		if (currentUrl !== persistedTargetUrl) return directIframeHealth
		return directIframeHealth ?? laneHealth
	}, [activeLane, currentUrl, directIframeHealth, laneHealth])

	const healthSummary = useMemo(
		() => (effectiveLaneHealth ? summarizeBrowserLaneHealth(effectiveLaneHealth) : "No lane health yet"),
		[effectiveLaneHealth],
	)

	const actionLabels = useMemo(() => getBrowserPanelActionLabels(activeLane), [activeLane])
	const failureHint = useMemo(() => getBrowserPanelFailureHint(activeLane), [activeLane])
	const createFormView = useMemo(() => getBrowserPanelCreateFormViewModel(createForm), [createForm])

	const panelState = useMemo(
		() => getBrowserPanelState({ activeLane, laneHealth: effectiveLaneHealth, loadFailure, healthSummary }),
		[activeLane, effectiveLaneHealth, healthSummary, loadFailure],
	)

	useEffect(() => {
		let cancelled = false
		void fetchPalotSessionBinding(_agent.sessionId).then((binding) => {
			if (cancelled) return
			setSessionBinding(binding)
		})
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
	}, [_agent.sessionId, activeLaneId, setActiveLaneId])

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
				(health.status === "stopped" && activeLane.runtimeOwnership === "managed-local")
			) {
				autoStartAttemptedRef.current.delete(activeLane.id)
			}
		})
		if (activeLane.surfaceKind === "direct-iframe") {
			const nextUrl = persistedUrl && persistedUrl !== FALLBACK_URL ? persistedUrl : streamUrl
			setCurrentUrl(nextUrl)
			setInputValue(nextUrl)
			setDirectIframeHealth(nextUrl === FALLBACK_URL ? buildDirectIframeHealth(nextUrl, false) : null)
		}
		return () => {
			cancelled = true
		}
	}, [activeLane, persistedUrl, streamUrl])

	useEffect(() => {
		if (!activeLane) return
		if (activeLane.surfaceKind === "direct-iframe") return
		if (activeLane.runtimeOwnership !== "managed-local") return
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
		if (activeLane.runtimeOwnership !== "managed-local") return
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
			if (getBrowserPanelNavigationStrategy(activeLane.surfaceKind) === "direct-url") {
				setCurrentUrl(nextUrl)
				setInputValue(nextUrl)
				setPersistedUrl(nextUrl)
				setHistory((current) => pushBrowserHistory(current, nextUrl))
				setLaneHealth(buildDirectIframeHealth(nextUrl, false))
				setDirectIframeHealth(buildDirectIframeHealth(nextUrl, false))
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
			if (activeLane.surfaceKind === "direct-iframe") {
				const nextHealth = buildDirectIframeHealth(currentUrl, false)
				setFrameNonce((current) => current + 1)
				setLaneHealth(nextHealth)
				setDirectIframeHealth(nextHealth)
				return
			}
			await fetchBrowserLaneHealth(activeLane.id).then((health) => setLaneHealth(health))
		} catch (error) {
			setLoadFailure(error instanceof Error ? error.message : String(error))
		} finally {
			setIsLoading(false)
		}
	}

	const handleRestart = async () => {
		if (!activeLane) return
		if (activeLane.runtimeOwnership !== "managed-local") return
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
		if (activeLane.runtimeOwnership !== "managed-local") return
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
		const clearedHealth = buildDirectIframeHealth(FALLBACK_URL, false)
		setInputValue(FALLBACK_URL)
		setCurrentUrl(FALLBACK_URL)
		setInputError(null)
		setLoadFailure(null)
		setPersistedUrl(FALLBACK_URL)
		setLaneHealth(clearedHealth)
		setDirectIframeHealth(clearedHealth)
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
		const targetUrl = createForm.targetUrl.trim()
		const streamBackendUrl = createForm.streamBackendUrl.trim()
		const cdpEndpoint = createForm.cdpEndpoint.trim() || null
		const runtimeOwnership = createFormView.runtimeOwnership
		const deploymentLocation = createFormView.deploymentLocation
		if (!id) {
			setCreateError("Lane id is required")
			return
		}
		if (createForm.surfaceKind === "direct-iframe" && !targetUrl) {
			setCreateError("Target URL is required")
			return
		}
		if (createForm.surfaceKind === "selkies-stream" && !streamBackendUrl) {
			setCreateError("Stream backend URL is required")
			return
		}
		setCreateBusy(true)
		try {
			const lane = await createBrowserLane({
				id,
				label,
				surfaceKind: createForm.surfaceKind,
				runtimeOwnership,
				targetUrl: createForm.surfaceKind === "direct-iframe" ? targetUrl : null,
				streamBackendUrl: createForm.surfaceKind === "direct-iframe" ? null : streamBackendUrl,
				cdpEndpoint,
				deploymentLocation,
				host: null,
				profilePath: null,
			})
			setLaneList((current) => {
				const filtered = current.filter((entry) => entry.id !== lane.id)
				return [...filtered, lane]
			})
			setActiveLaneId(lane.id)
			setIsCreateOpen(false)

			setCreateForm(createDefaultBrowserPanelFormState())
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
							<DropdownMenuItem onClick={() => void handleRestart()} disabled={!actionLabels.canRestartManagedLane}>
								<RotateCcwIcon className="size-3.5" aria-hidden="true" />
								{actionLabels.restartLabel}
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
							<DropdownMenuItem onClick={() => void handleResetProfile()} disabled={!actionLabels.canResetManagedProfile}>
								{actionLabels.resetProfileLabel}
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
						<div className="font-medium text-foreground">Configure browser lane</div>
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
											surfaceKind: event.target.value as typeof form.surfaceKind,
										}))
									}
									className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
								>
									<option value="selkies-stream">Selkies stream</option>
									<option value="direct-iframe">Direct iframe</option>
								</select>
							</label>
							<label className="flex flex-col gap-1 text-foreground sm:col-span-2">
								<span className="text-[11px] text-muted-foreground">Runtime ownership</span>
								<select
									value={createFormView.runtimeOwnership}
									onChange={(event) =>
										setCreateForm((form) => ({
											...form,
											runtimeOwnership: event.target.value as typeof form.runtimeOwnership,
										}))
									}
									className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
								>
									{createFormView.runtimeOwnershipOptions.map((option) => (
										<option key={option} value={option}>
											{option === "attached" ? "Attach to existing runtime" : "Managed local runtime"}
										</option>
									))}
								</select>
							</label>
							{createFormView.showDeploymentLocation ? (
								<label className="flex flex-col gap-1 text-foreground sm:col-span-2">
									<span className="text-[11px] text-muted-foreground">Deployment location</span>
									<select
										value={createForm.deploymentLocation}
										onChange={(event) =>
											setCreateForm((form) => ({
												...form,
												deploymentLocation: event.target.value as typeof form.deploymentLocation,
											}))
										}
										className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
									>
										<option value="remote">Remote</option>
										<option value="local">Local</option>
										<option value="unknown">Unknown</option>
									</select>
								</label>
							) : (
								<div className="sm:col-span-2 rounded-md border border-border/60 bg-background/50 px-2 py-2 text-[11px] text-muted-foreground">
									Managed local lanes always run on the local machine and fill runtime details automatically.
								</div>
							)}
							<label className="flex flex-col gap-1 text-foreground sm:col-span-2">
								<span className="text-[11px] text-muted-foreground">
									{createFormView.showTargetUrl
										? "Target URL (required)"
										: createFormView.runtimeOwnership === "managed-local"
											? "Initial page URL (optional)"
											: "Stream backend URL (required)"}
								</span>
								<Input
									value={createFormView.showTargetUrl ? createForm.targetUrl : createForm.streamBackendUrl}
									onChange={(event) =>
										setCreateForm((form) =>
											createFormView.showTargetUrl
												? { ...form, targetUrl: event.target.value }
												: { ...form, streamBackendUrl: event.target.value },
										)
									}
									placeholder={
										createFormView.showTargetUrl
											? "http://127.0.0.1:8077"
											: createFormView.runtimeOwnership === "managed-local"
												? "https://example.com"
												: "http://host:3000"
									}
									className="h-8"
									required={createFormView.showTargetUrl || createFormView.runtimeOwnership === "attached"}
								/>
							</label>
							{createFormView.showCdpEndpoint ? (
								<label className="flex flex-col gap-1 text-foreground sm:col-span-2">
									<span className="text-[11px] text-muted-foreground">CDP endpoint (optional)</span>
									<Input
										value={createForm.cdpEndpoint}
										onChange={(event) =>
											setCreateForm((form) => ({ ...form, cdpEndpoint: event.target.value }))
										}
										placeholder="http://host:9223"
										className="h-8"
									/>
								</label>
							) : null}
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
						<div className="mt-1 text-[11px] opacity-80">{failureHint}</div>
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
							key={activeLane.surfaceKind === "direct-iframe" ? `${activeLane.id}:${frameNonce}` : activeLane.id}
							src={activeLane.surfaceKind === "direct-iframe" ? currentUrl : streamUrl}
							title={`Browser lane ${activeLane.label}`}
							className="h-full w-full rounded-lg border-0 bg-background"
							onLoad={() => {
								if (activeLane.surfaceKind !== "direct-iframe") return
								const nextHealth = buildDirectIframeHealth(currentUrl, true)
								setLoadFailure(null)
								setLaneHealth(nextHealth)
								setDirectIframeHealth(nextHealth)
							}}
							onError={() => {
								if (activeLane.surfaceKind !== "direct-iframe") return
								const nextHealth = buildDirectIframeHealth(currentUrl, false)
								setLoadFailure("The embedded target could not be reached.")
								setLaneHealth(nextHealth)
								setDirectIframeHealth(nextHealth)
							}}

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
									{actionLabels.refreshLabel}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => void handleRestart()}
									disabled={!actionLabels.canRestartManagedLane}
								>
									{actionLabels.restartLabel}
								</Button>
								<Button type="button" variant="outline" size="sm" onClick={handleOpenExternal} disabled={!canOpenExternal}>
									{actionLabels.openExternalLabel}
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
