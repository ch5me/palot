import { Button } from "@ch5me/elf-ui/components/button"
import { Input } from "@ch5me/elf-ui/components/input"
import {
	AlertTriangleIcon,
	ArrowLeftIcon,
	ArrowRightIcon,
	ExternalLinkIcon,
	GlobeIcon,
	HistoryIcon,
	LoaderCircleIcon,
	RefreshCwIcon,
	XIcon,
} from "lucide-react"
import { useAtom, useAtomValue } from "jotai"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { activeFireflyProfileAtom } from "../../atoms/preferences"
import { browserHistoryAtom, buildNavigableUrl, lastBrowserUrlAtom, pushBrowserHistory } from "../../atoms/browser"
import type { Agent } from "../../lib/types"

interface BrowserPanelProps {
	agent: Agent
	className?: string
}

type ElectronWebview = HTMLElement & {
	src: string
	canGoBack: () => boolean
	canGoForward: () => boolean
	goBack: () => void
	goForward: () => void
	reload: () => void
	stop: () => void
	addEventListener: (
		type:
			| "did-start-loading"
			| "did-stop-loading"
			| "did-navigate"
			| "did-navigate-in-page"
			| "did-fail-load"
			| "did-finish-load",
		listener: EventListenerOrEventListenerObject,
	) => void
	removeEventListener: (
		type:
			| "did-start-loading"
			| "did-stop-loading"
			| "did-navigate"
			| "did-navigate-in-page"
			| "did-fail-load"
			| "did-finish-load",
		listener: EventListenerOrEventListenerObject,
	) => void
}

interface WebviewNavigationEvent extends Event {
	url: string
}

interface WebviewFailureEvent extends Event {
	errorCode: number
	errorDescription: string
	validatedURL: string
	isMainFrame: boolean
}

const FALLBACK_URL = "about:blank"

function isElectron(): boolean {
	return typeof window !== "undefined" && "elf" in window
}

export function BrowserPanel({ agent, className }: BrowserPanelProps) {
	const [persistedUrl, setPersistedUrl] = useAtom(lastBrowserUrlAtom)
	const [history, setHistory] = useAtom(browserHistoryAtom)
	const profileId = useAtomValue(activeFireflyProfileAtom).id
	const initialUrl = useMemo(() => persistedUrl || FALLBACK_URL, [persistedUrl])
	const webviewRef = useRef<ElectronWebview | null>(null)
	const [inputValue, setInputValue] = useState(initialUrl)
	const [currentUrl, setCurrentUrl] = useState(initialUrl)
	const [isLoading, setIsLoading] = useState(false)
	const [canGoBack, setCanGoBack] = useState(false)
	const [canGoForward, setCanGoForward] = useState(false)
	const [inputError, setInputError] = useState<string | null>(null)
	const [loadFailure, setLoadFailure] = useState<{ code: number; description: string; url: string } | null>(null)

	const syncNavState = useCallback(() => {
		const webview = webviewRef.current
		if (!webview) return
		setCanGoBack(webview.canGoBack())
		setCanGoForward(webview.canGoForward())
		const liveUrl = webview.src || FALLBACK_URL
		setCurrentUrl(liveUrl)
	}, [])

	const loadUrl = useCallback(
		(rawUrl: string) => {
			const nextUrl = buildNavigableUrl(rawUrl)
			if (!nextUrl) {
				setInputError(
					"Couldn't build a URL from that. Try https://example.com, example.com, or leave blank to reset.",
				)
				return
			}
			setInputError(null)
			setInputValue(nextUrl)
			setCurrentUrl(nextUrl)
			setLoadFailure(null)
			const webview = webviewRef.current
			if (webview && webview.src !== nextUrl) {
				webview.src = nextUrl
			}
			setPersistedUrl(nextUrl)
			setHistory((current) => pushBrowserHistory(current, nextUrl))
		},
		[setHistory, setPersistedUrl],
	)

	useEffect(() => {
		const webview = webviewRef.current
		if (!webview) return

		const handleDidStartLoading = () => {
			setIsLoading(true)
			setLoadFailure(null)
			syncNavState()
		}
		const handleDidStopLoading = () => {
			setIsLoading(false)
			syncNavState()
		}
		const handleDidFinishLoad = () => {
			setIsLoading(false)
			syncNavState()
		}
		const handleDidNavigate = (event: Event) => {
			const nextUrl = (event as WebviewNavigationEvent).url ?? webview.src ?? FALLBACK_URL
			setInputValue(nextUrl)
			setCurrentUrl(nextUrl)
			setPersistedUrl(nextUrl)
			setHistory((current) => pushBrowserHistory(current, nextUrl))
			syncNavState()
		}
		const handleDidFailLoad = (event: Event) => {
			const detail = event as WebviewFailureEvent
			setIsLoading(false)
			setLoadFailure({
				code: detail.errorCode,
				description: detail.errorDescription || "Unknown load error",
				url: detail.validatedURL || webview.src || FALLBACK_URL,
			})
		}

		webview.addEventListener("did-start-loading", handleDidStartLoading)
		webview.addEventListener("did-stop-loading", handleDidStopLoading)
		webview.addEventListener("did-finish-load", handleDidFinishLoad)
		webview.addEventListener("did-navigate", handleDidNavigate)
		webview.addEventListener("did-navigate-in-page", handleDidNavigate)
		webview.addEventListener("did-fail-load", handleDidFailLoad)
		syncNavState()

		return () => {
			webview.removeEventListener("did-start-loading", handleDidStartLoading)
			webview.removeEventListener("did-stop-loading", handleDidStopLoading)
			webview.removeEventListener("did-finish-load", handleDidFinishLoad)
			webview.removeEventListener("did-navigate", handleDidNavigate)
			webview.removeEventListener("did-navigate-in-page", handleDidNavigate)
			webview.removeEventListener("did-fail-load", handleDidFailLoad)
		}
	}, [setHistory, setPersistedUrl, syncNavState])

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		loadUrl(inputValue)
	}

	const handleOpenExternal = async () => {
		if (!isElectron()) return
		await window.elf.openExternal(currentUrl)
	}

	const handleGoBack = () => {
		const webview = webviewRef.current
		if (!webview || !webview.canGoBack()) return
		webview.goBack()
	}

	const handleGoForward = () => {
		const webview = webviewRef.current
		if (!webview || !webview.canGoForward()) return
		webview.goForward()
	}

	const handleRefresh = () => {
		const webview = webviewRef.current
		if (!webview) return
		setLoadFailure(null)
		webview.reload()
	}

	const handleReset = () => {
		setInputValue(FALLBACK_URL)
		setCurrentUrl(FALLBACK_URL)
		setInputError(null)
		setLoadFailure(null)
		setPersistedUrl(FALLBACK_URL)
		const webview = webviewRef.current
		if (webview) {
			webview.src = FALLBACK_URL
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
				<form className="flex items-center gap-2" onSubmit={handleSubmit}>
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={handleGoBack}
						disabled={!canGoBack}
						className="shrink-0"
						aria-label="Go back"
					>
						<ArrowLeftIcon className="size-4" aria-hidden="true" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={handleGoForward}
						disabled={!canGoForward}
						className="shrink-0"
						aria-label="Go forward"
					>
						<ArrowRightIcon className="size-4" aria-hidden="true" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						onClick={handleRefresh}
						className="shrink-0"
						aria-label="Refresh"
					>
						{isLoading ? (
							<LoaderCircleIcon className="size-4 animate-spin" aria-hidden="true" />
						) : (
							<RefreshCwIcon className="size-4" aria-hidden="true" />
						)}
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
						disabled={!isElectron() || currentUrl === FALLBACK_URL}
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
						<div className="font-medium">
							Load failed: {loadFailure.description} ({loadFailure.code})
						</div>
						<div className="mt-1 break-all text-[11px] opacity-80">{loadFailure.url}</div>
					</div>
				) : null}
				<div
					className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/20"
					style={{
						// @ts-expect-error -- vendor-prefixed CSS property
						WebkitAppRegion: "no-drag",
					}}
				>
					{isElectron() ? (
						React.createElement("webview", {
							ref: (node: Element | null) => {
								webviewRef.current = node as ElectronWebview | null
							},
							src: initialUrl,
							className: "h-full w-full",
							autosize: true,
							partition: `persist:elf-browser-${profileId}`,
						}) as React.ReactNode
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
							<GlobeIcon className="size-10 text-muted-foreground/40" aria-hidden="true" />
							<div>
								<p className="text-sm font-medium text-foreground">Inline browser needs Electron</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Inline webview unavailable in browser-only dev mode.
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
