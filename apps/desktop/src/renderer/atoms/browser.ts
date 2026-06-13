import { atomWithStorage } from "jotai/utils"

const PERSISTED_KEY = "elf:browser-panel:last-url"
const MAX_HISTORY = 8
const DEFAULT_LANE_ID = "default"

export const lastBrowserUrlAtom = atomWithStorage<string>(PERSISTED_KEY, "about:blank")
export const activeBrowserLaneIdAtom = atomWithStorage<string>("elf:browser-panel:lane-id", DEFAULT_LANE_ID)

export const browserHistoryAtom = atomWithStorage<string[]>(PERSISTED_KEY + ":history", [])

export function pushBrowserHistory(current: string[], nextUrl: string): string[] {
	if (!nextUrl || nextUrl === "about:blank") return current
	if (current[0] === nextUrl) return current
	const filtered = current.filter((entry) => entry !== nextUrl)
	return [nextUrl, ...filtered].slice(0, MAX_HISTORY)
}

export function buildNavigableUrl(input: string): string | null {
	const trimmed = input.trim()
	if (!trimmed) return null
	if (
		trimmed === "about:blank" ||
		trimmed.startsWith("http://") ||
		trimmed.startsWith("https://") ||
		trimmed.startsWith("file://") ||
		trimmed.startsWith("about:") ||
		trimmed.startsWith("chrome:") ||
		trimmed.startsWith("devtools:")
	) {
		return trimmed
	}
	if (/\s/.test(trimmed)) return null
	if (!/^[\w.-]+/.test(trimmed)) return null
	return `https://${trimmed}`
}

interface BrowserLaneDisplayUrlInput {
	desktopStreamUrl?: string | null
	streamPath: string
	streamBackendUrl?: string | null
	surfaceKind?: "selkies-stream" | "direct-iframe"
}

interface BrowserLaneDisplayUrlOptions {
	isElectron: boolean
	backendBaseUrl?: string
}

export function buildBrowserLaneDisplayUrl(
	input: BrowserLaneDisplayUrlInput,
	options: BrowserLaneDisplayUrlOptions = { isElectron: true },
): string {
	if (input.surfaceKind === "direct-iframe" && input.desktopStreamUrl) {
		return input.desktopStreamUrl
	}
	if (options.isElectron && input.desktopStreamUrl) return input.desktopStreamUrl
	if (!options.isElectron && options.backendBaseUrl) {
		return new URL(input.streamPath, options.backendBaseUrl).toString()
	}
	return input.streamPath
}
