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
import { getBrowserLane } from "../browser-lane-manager"
import { resolvePalotSessionBinding } from "../palot-resolver"
import type { SurfaceContextFragment } from "../surface-context-compose"

export const BROWSER_TOOL_PREFIX = "plugin.firefly.built-in.surface.browser."

export interface WebToolDispatch {
	toolName: DispatchBrowserToolInput["toolName"]
	args: Record<string, unknown>
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

// Capability split by browser mode. The default iframe lane has no CDP, so DOM
// actions cannot run there — advertise that honestly in the projected context
// (fail-fast / no silent no-op) rather than letting the agent call a tool that
// silently does nothing.
const IFRAME_USABLE_TOOLS = ["web.open", "web.navigate", "web.tabs", "web.status"]
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
	const mode = lane?.surfaceKind === "selkies-stream" ? "streamed" : "iframe"
	const url = resolved.nonSecretSnapshot?.viewport?.currentUrl ?? "about:blank"
	const usable = mode === "streamed" ? [...IFRAME_USABLE_TOOLS, ...STREAMED_ONLY_TOOLS] : IFRAME_USABLE_TOOLS
	const lines = [`mode ${mode}`, `bound ${laneId ? "y" : "n"}`, `url ${url}`, `usable ${usable.join(",")}`]
	if (mode !== "streamed") {
		lines.push(`needs_streamed ${STREAMED_ONLY_TOOLS.join(",")}`)
	}
	return { surfaceId: "browser", label: "Browser", toon: lines.join("\n") }
}
