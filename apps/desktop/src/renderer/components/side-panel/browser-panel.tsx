import { Button } from "@ch5me/elf-ui/components/button"
import { Input } from "@ch5me/elf-ui/components/input"
import {
	AlertTriangleIcon,
	ExternalLinkIcon,
	GlobeIcon,
	HistoryIcon,
	LoaderCircleIcon,
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
	fetchBrowserLaneHealth,
	fetchBrowserLanes,
	restartBrowserLane,
	resetBrowserLaneProfile,
} from "../../services/backend"
import { summarizeBrowserLaneHealth } from "../../../shared/browser-lanes"
import type { Agent, BrowserLane, BrowserLaneHealth } from "../../lib/types"

interface BrowserPanelProps {
	agent: Agent
	className?: string
}

const FALLBACK_URL = "about:blank"

export function BrowserPanel({ agent, className }: BrowserPanelProps) {
	const [persistedUrl, setPersistedUrl] = useAtom(lastBrowserUrlAtom)
	const [history, setHistory] = useAtom(browserHistoryAtom)
	const [activeLaneId, setActiveLaneId] = useAtom(activeBrowserLaneIdAtom)
	const [inputValue, setInputValue] = useState(persistedUrl || FALLBACK_URL)
	const [currentUrl, setCurrentUrl] = useState(persistedUrl || FALLBACK_URL)
	const [inputError, setInputError] = useState<string | null>(null)
	const [laneList, setLaneList] = useState<BrowserLane[]>([])
	const [laneHealth, setLaneHealth] = useState<BrowserLaneHealth | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [loadFailure, setLoadFailure] = useState<string | null>(null)

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
				if (selected) {
					setActiveLaneId(selected.id)
					const nextUrl = buildBrowserLaneDisplayUrl(selected)
					setCurrentUrl(nextUrl)
					setInputValue(nextUrl)
					setPersistedUrl(nextUrl)
					setHistory((current) => pushBrowserHistory(current, nextUrl))
				}
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [activeLaneId, setActiveLaneId, setHistory, setPersistedUrl])

	useEffect(() => {
		if (!activeLane) return
		let cancelled = false
		void fetchBrowserLaneHealth(activeLane.id).then((health) => {
			if (!cancelled) setLaneHealth(health)
		})
		const nextUrl = buildBrowserLaneDisplayUrl(activeLane)
		setCurrentUrl(nextUrl)
		setInputValue(nextUrl)
		setPersistedUrl(nextUrl)
		setHistory((current) => pushBrowserHistory(current, nextUrl))
		return () => {
			cancelled = true
		}
	}, [activeLane, setHistory, setPersistedUrl])

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
		await window.elf.openExternal(currentUrl)
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
				<form className="flex items-center gap-2" onSubmit={handleSubmit}>
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
						className="h-9 flex-1"
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
						disabled={currentUrl === FALLBACK_URL}
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
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
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
				</div>
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
								<Button type="button" variant="outline" size="sm" onClick={handleOpenExternal} disabled={currentUrl === FALLBACK_URL}>
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
