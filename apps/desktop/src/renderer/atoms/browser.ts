import { atomWithStorage } from "jotai/utils"

const PERSISTED_KEY = "elf:browser-panel:last-url"
const MAX_HISTORY = 8

export const lastBrowserUrlAtom = atomWithStorage<string>(PERSISTED_KEY, "about:blank")

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
