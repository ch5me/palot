/**
 * Browser surface — V2 agent tool mapping + context projector.
 *
 * The `web.*` action tools declared in `plugins/browser/manifest.ts` route to
 * the existing browser-lane automation path (`palot-browser-dispatcher.ts`),
 * which already publishes actor-tagged action-bus events the cursor overlay
 * animates. This module owns the pure mapping (V2 tool id → legacy dispatcher
 * toolName) and the surface context projector; `dispatch.ts` does the actual
 * `registerHostTool` / `registerHostContextProjector` wiring so the `ok`/`err`
 * helpers and registries stay in one place.
 *
 * The dispatcher is imported dynamically at call time inside the handlers (see
 * `dispatch.ts`) to keep the module graph acyclic.
 */

import type { DispatchBrowserToolInput } from "../../shared/palot-bridge-schemas"
import type { BrowserLane } from "../../shared/browser-lanes"
import { getBrowserLane } from "../browser-lane-manager"
import { resolvePalotSessionBinding } from "../palot-resolver"
import type { SurfaceContextFragment } from "../surface-context-compose"

export const BROWSER_TOOL_PREFIX = "plugin.firefly.built-in.surface.browser."

export interface WebToolDispatch {
	toolName: DispatchBrowserToolInput["toolName"]
	args: Record<string, unknown>
}

/**
 * A streamed lane is one that has CDP access — either a selkies-stream
 * (docker-chromium) lane or any remote-attached lane that exposes a cdpEndpoint.
 * Direct-iframe lanes have no CDP and can only navigate.
 */
export function isStreamedLane(lane: BrowserLane): boolean {
	return lane.surfaceKind === "selkies-stream" || !!lane.cdpEndpoint
}

/**
 * Map a V2 browser action tool id to the existing dispatcher's legacy toolName
 * + args. Returns `null` for tool ids that are not lane-dispatch actions (e.g.
 * `web.read`, handled directly by the caller).
 */
export function resolveWebToolDispatch(
	toolId: string,
	args: Record<string, unknown>,
): WebToolDispatch | null {
	const short = toolId.startsWith(BROWSER_TOOL_PREFIX) ? toolId.slice(BROWSER_TOOL_PREFIX.length) : toolId
	switch (short) {
		case "navigate":
			return { toolName: "browser_navigate", args: { url: args.url } }
		case "click":
			return { toolName: "browser_click", args }
		case "type":
			return { toolName: "browser_type", args }
		case "scroll":
			return { toolName: "browser_scroll", args }
		case "tabs":
			return { toolName: "browser_tabs", args }
		case "status":
			return { toolName: "browser_status", args: {} }
		default:
			return null
	}
}

// ---------------------------------------------------------------------------
// TOON formatters — compact agent-readable summaries (AXI: 3-4 fields max,
// truncate big text with a (truncated, N chars) hint + next-step suggestion).
// ---------------------------------------------------------------------------

const TOON_TEXT_LIMIT = 800

function toonTruncate(text: string): string {
	if (text.length <= TOON_TEXT_LIMIT) return text
	return `${text.slice(0, TOON_TEXT_LIMIT)} (truncated, ${text.length} chars — use web.read q=<topic> to narrow)`
}

/**
 * Format a magic-browser snapshot/documentText result as a compact TOON string.
 * Input is the parsed CLI JSON (shape varies by verb, so we duck-type the
 * fields we care about).
 */
export function formatSnapshotToon(raw: unknown): string {
	if (!raw || typeof raw !== "object") return String(raw ?? "no content")
	const r = raw as Record<string, unknown>
	const url = typeof r.url === "string" ? r.url : null
	const title = typeof r.title === "string" ? r.title : null
	const text = typeof r.text === "string" ? r.text : typeof r.content === "string" ? r.content : null
	const parts: string[] = []
	if (url) parts.push(`url ${url}`)
	if (title) parts.push(`title ${title}`)
	if (text) parts.push(toonTruncate(text))
	return parts.length > 0 ? parts.join("\n") : JSON.stringify(raw).slice(0, TOON_TEXT_LIMIT)
}

/**
 * Format magic-browser extractLinks result (array of {url, text} or plain strings).
 */
export function formatLinksToon(raw: unknown): string {
	if (!Array.isArray(raw)) return `links: ${String(raw)}`
	const items = raw.slice(0, 20).map((item) => {
		if (typeof item === "string") return item
		if (item && typeof item === "object") {
			const { url, text } = item as Record<string, unknown>
			return text ? `${text} → ${url}` : String(url)
		}
		return String(item)
	})
	const suffix = raw.length > 20 ? `\n(${raw.length - 20} more)` : ""
	return `links (${raw.length})\n${items.join("\n")}${suffix}`
}

/**
 * Format magic-browser tabs result as TOON.
 */
export function formatTabsToon(raw: unknown): string {
	if (!Array.isArray(raw)) return `tabs: ${String(raw)}`
	const items = raw.slice(0, 10).map((tab) => {
		if (!tab || typeof tab !== "object") return String(tab)
		const t = tab as Record<string, unknown>
		return `[${t.id ?? "?"}] ${t.title ?? t.url ?? "untitled"}`
	})
	return `tabs (${raw.length})\n${items.join("\n")}`
}

/**
 * Format a generic magic-browser action result (click/type/scroll/fill/eval)
 * as TOON — just surface status and the verb.
 */
export function formatActionToon(verb: string, raw: unknown): string {
	if (!raw || typeof raw !== "object") return `${verb}: ok`
	const r = raw as Record<string, unknown>
	const status = typeof r.status === "string" ? r.status : "ok"
	const msg = typeof r.message === "string" ? ` — ${r.message}` : ""
	return `${verb} ${status}${msg}`
}

// Capability split by browser mode. The default iframe lane has no CDP, so DOM
// actions cannot run there — advertise that honestly in the projected context
// (fail-fast / no silent no-op) rather than letting the agent call a tool that
// silently does nothing.
const IFRAME_USABLE_TOOLS = ["web.open", "web.navigate", "web.tabs", "web.status", "web.mode"]
const STREAMED_ONLY_TOOLS = ["web.click", "web.type", "web.scroll", "web.read"]

/**
 * Browser surface context projector — the live state the agent reads each turn:
 * current mode (iframe vs streamed), whether a lane is bound, the current URL,
 * and which `web.*` tools are usable in this mode.
 */
export async function buildBrowserSurfaceFragment(
	sessionId: string | null,
): Promise<SurfaceContextFragment | null> {
	if (!sessionId) return null
	const resolved = resolvePalotSessionBinding(sessionId)
	const laneId = resolved.binding?.browserLaneId ?? null
	const lane = laneId ? await getBrowserLane(laneId) : null
	const mode = lane && isStreamedLane(lane) ? "streamed" : "iframe"
	const url = resolved.nonSecretSnapshot?.viewport?.currentUrl ?? "about:blank"
	const usable = mode === "streamed" ? [...IFRAME_USABLE_TOOLS, ...STREAMED_ONLY_TOOLS] : IFRAME_USABLE_TOOLS
	const lines = [`mode ${mode}`, `bound ${laneId ? "y" : "n"}`, `url ${url}`, `usable ${usable.join(",")}`]
	if (mode !== "streamed") {
		lines.push(`needs_streamed ${STREAMED_ONLY_TOOLS.join(",")}`)
	}
	return { surfaceId: "browser", label: "Browser", toon: lines.join("\n") }
}
