import { Button } from "@ch5me/palot-ui/components/button"
import { Input } from "@ch5me/palot-ui/components/input"
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	ExternalLinkIcon,
	GlobeIcon,
	LoaderCircleIcon,
	RefreshCwIcon,
} from "lucide-react"
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
		type: "did-start-loading" | "did-stop-loading" | "did-navigate" | "did-navigate-in-page",
		listener: EventListenerOrEventListenerObject,
	) => void
	removeEventListener: (
		type: "did-start-loading" | "did-stop-loading" | "did-navigate" | "did-navigate-in-page",
		listener: EventListenerOrEventListenerObject,
	) => void
}

interface WebviewNavigationEvent extends Event {
	url: string
}

const FALLBACK_URL = "about:blank"

function isElectron(): boolean {
	return typeof window !== "undefined" && "palot" in window
}

function normalizeUrl(input: string): string {
	const trimmed = input.trim()
	if (!trimmed) return FALLBACK_URL
	if (
		trimmed === FALLBACK_URL ||
		trimmed.startsWith("http://") ||
		trimmed.startsWith("https://") ||
		trimmed.startsWith("file://") ||
		trimmed.startsWith("about:")
	) {
		return trimmed
	}
	return `https://${trimmed}`
}

export function BrowserPanel({ agent, className }: BrowserPanelProps) {
	const initialUrl = useMemo(() => FALLBACK_URL, [])
	const webviewRef = useRef<ElectronWebview | null>(null)
	const [inputValue, setInputValue] = useState(initialUrl)
	const [currentUrl, setCurrentUrl] = useState(initialUrl)
	const [isLoading, setIsLoading] = useState(false)
	const [canGoBack, setCanGoBack] = useState(false)
	const [canGoForward, setCanGoForward] = useState(false)

	const syncNavState = useCallback(() => {
		const webview = webviewRef.current
		if (!webview) return
		setCanGoBack(webview.canGoBack())
		setCanGoForward(webview.canGoForward())
		setCurrentUrl(webview.src || FALLBACK_URL)
	}, [])

	const loadUrl = useCallback(
		(rawUrl: string) => {
			const nextUrl = normalizeUrl(rawUrl)
			setInputValue(nextUrl)
			setCurrentUrl(nextUrl)
			const webview = webviewRef.current
			if (webview && webview.src !== nextUrl) {
				webview.src = nextUrl
			}
		},
		[],
	)

	useEffect(() => {
		const webview = webviewRef.current
		if (!webview) return

		const handleDidStartLoading = () => {
			setIsLoading(true)
			syncNavState()
		}
		const handleDidStopLoading = () => {
			setIsLoading(false)
			syncNavState()
		}
		const handleDidNavigate = (event: Event) => {
			const nextUrl = (event as WebviewNavigationEvent).url ?? webview.src ?? FALLBACK_URL
			setInputValue(nextUrl)
			setCurrentUrl(nextUrl)
			syncNavState()
		}

		webview.addEventListener("did-start-loading", handleDidStartLoading)
		webview.addEventListener("did-stop-loading", handleDidStopLoading)
		webview.addEventListener("did-navigate", handleDidNavigate)
		webview.addEventListener("did-navigate-in-page", handleDidNavigate)
		syncNavState()

		return () => {
			webview.removeEventListener("did-start-loading", handleDidStartLoading)
			webview.removeEventListener("did-stop-loading", handleDidStopLoading)
			webview.removeEventListener("did-navigate", handleDidNavigate)
			webview.removeEventListener("did-navigate-in-page", handleDidNavigate)
		}
	}, [syncNavState])

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		loadUrl(inputValue)
	}

	const handleOpenExternal = async () => {
		if (!isElectron()) return
		await window.palot.openExternal(currentUrl)
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
		webview.reload()
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Inline Browser</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Browse {agent.project} docs, tools, and local references without leaving Palot.
				</p>
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
						onChange={(event) => setInputValue(event.target.value)}
						placeholder="Enter URL"
						className="h-9 flex-1"
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
						disabled={!isElectron()}
					>
						<ExternalLinkIcon className="size-4" aria-hidden="true" />
						Open in browser
					</Button>
				</form>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<GlobeIcon className="size-3.5" aria-hidden="true" />
					<span className="truncate">{currentUrl || FALLBACK_URL}</span>
				</div>
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
