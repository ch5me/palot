import type { Actor, BrowserActionEvent, BrowserLaneTabActionResult } from "../preload/api"
import type { DispatchBrowserToolInput } from "../shared/palot-bridge-schemas"
import { dispatchBrowserToolInputSchema } from "../shared/palot-bridge-schemas"
import type { BrowserLane } from "../shared/browser-lanes"
import {
	activateBrowserLaneTab,
	clickBrowserLane,
	closeBrowserLaneTab,
	createBrowserLane,
	createBrowserLaneTab,
	ensureBrowserLane,
	getBrowserLane,
	listBrowserLaneTabs,
	navigateBrowserLane,
	scrollBrowserLane,
	typeBrowserLane,
} from "./browser-lane-manager"
import { DEFAULT_BROWSER_LANE_ID } from "../shared/browser-lanes"
import { publishBrowserAction } from "./palot-browser-ipc"
import { attachLaneToBinding, ensureSessionBindingForSession } from "./palot-session-binding-store"
import { resolvePalotSessionBinding } from "./palot-resolver"
import { isStreamedLane } from "./firefly-plugin/browser-tool-handlers"
import {
	formatSnapshotToon,
	formatTabsToon,
	formatActionToon,
} from "./firefly-plugin/browser-tool-handlers"
import {
	clickText,
	clickSelector,
	snapshot,
	openSnapshot,
	typeSelector,
	evalExpr,
	tabs as mbTabs,
	documentText,
} from "./palot-magic-browser-engine"
import { ensureMagicBrowserSessionForBinding } from "./palot-magic-browser"

/**
 * Derive a stable cursor color for a session id. Deterministic hash so each
 * distinct session gets a visually distinct hue; color stays stable across
 * re-renders and event batches.
 */
function cursorColorForSession(sessionId: string): string {
	let hash = 0
	for (let i = 0; i < sessionId.length; i++) {
		hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0
	}
	return `hsl(${hash % 360} 80% 55%)`
}

/**
 * Build an Actor from a resolved session binding. When the binding has a
 * parentSessionId the session is a sub-agent (kind "sub"); otherwise it is the
 * root agent (kind "main"). Falls back to a main-kind actor when no binding is
 * available so the overlay always has something to render.
 *
 * @param sessionId - OpenCode session id (used as actor.id and for color hash).
 * @param parentSessionId - value from SessionBinding.parentSessionId; null/undefined = root session.
 */
export function actorForBinding(sessionId: string, parentSessionId: string | null | undefined): Actor {
	const kind = parentSessionId != null ? "sub" : "main"
	return {
		id: sessionId,
		displayName: kind === "sub" ? "Sub-agent" : "Agent",
		cursorColor: cursorColorForSession(sessionId),
		kind,
	}
}

function buildToolRequestEvent(input: DispatchBrowserToolInput, actor: Actor): BrowserActionEvent {
	return {
		id: `${input.sessionId}:${input.toolName}:toolRequest`,
		sessionId: input.sessionId,
		laneId: null,
		source: "tool_request",
		actor,
		sequence: 0,
		requestId: `${input.toolName}:${input.sessionId}`,
		causationId: null,
		toolCallId: null,
		targetDescription: null,
		viewportCoords: null,
		streamGeometrySnapshot: null,
		timestamp: Date.now(),
		durationMs: null,
		status: "queued",
		errorCode: null,
		errorMessage: null,
		kind: "toolRequest",
		toolName: input.toolName,
		argsSummary: JSON.stringify(input.args),
	}
}

function buildToolResultEvent(input: DispatchBrowserToolInput, summary: string, actor: Actor): BrowserActionEvent {
	return {
		id: `${input.sessionId}:${input.toolName}:toolResult`,
		sessionId: input.sessionId,
		laneId: null,
		source: "automation_runtime",
		actor,
		sequence: 0,
		requestId: `${input.toolName}:${input.sessionId}`,
		causationId: null,
		toolCallId: null,
		targetDescription: null,
		viewportCoords: null,
		streamGeometrySnapshot: null,
		timestamp: Date.now(),
		durationMs: null,
		status: "completed",
		errorCode: null,
		errorMessage: null,
		kind: "toolResult",
		toolName: input.toolName,
		resultSummary: summary,
	}
}

async function dispatchTabsAction(
	laneId: string,
	args: Record<string, unknown>,
): Promise<BrowserLaneTabActionResult | ReturnType<typeof listBrowserLaneTabs>> {
	switch (args.action) {
		case "open":
			return await createBrowserLaneTab(laneId, { url: (args.url as string | undefined) ?? "about:blank" })
		case "close":
			return await closeBrowserLaneTab(laneId, String(args.tabId ?? ""))
		case "activate":
			return await activateBrowserLaneTab(laneId, String(args.tabId ?? ""))
		case "list":
		case undefined:
			return await listBrowserLaneTabs(laneId)
		default:
			return await listBrowserLaneTabs(laneId)
	}
}

/**
 * Dispatch a browser tool through the Magic Browser engine (streamed lane mode).
 * Returns a TOON-formatted resultSummary string for agent consumption.
 *
 * Called only when the bound lane is confirmed streamed (has CDP). The session
 * must already have a Magic Browser session id (ensured by
 * `ensureMagicBrowserSessionForBinding` before calling this function).
 */
async function dispatchStreamedTool(
	input: DispatchBrowserToolInput,
	magicBrowserSessionId: string,
): Promise<string> {
	const { toolName, args } = input
	switch (toolName) {
		case "browser_navigate":
		case "browser_open": {
			const url = String(args.url ?? "about:blank")
			const result = await openSnapshot(magicBrowserSessionId, url)
			return formatSnapshotToon(result)
		}
		case "browser_click": {
			// Prefer text-click, then selector, then coordinates via eval
			const text = typeof args.text === "string" ? args.text : null
			const selector = typeof args.selector === "string" ? args.selector : null
			if (text) {
				const result = await clickText(magicBrowserSessionId, text)
				return formatActionToon("click", result)
			}
			if (selector) {
				const result = await clickSelector(magicBrowserSessionId, selector)
				return formatActionToon("click", result)
			}
			// Coordinate click via eval
			const x = Number(args.x ?? 0)
			const y = Number(args.y ?? 0)
			const result = await evalExpr(
				magicBrowserSessionId,
				`(function(){var el=document.elementFromPoint(${x},${y});if(el)el.click();return{x:${x},y:${y},hit:!!el}})()`,
			)
			return formatActionToon("click", result)
		}
		case "browser_type": {
			const selector = typeof args.selector === "string" ? args.selector : null
			const text = String(args.text ?? "")
			const submit = args.submit === true
			if (selector) {
				const typed = await typeSelector(magicBrowserSessionId, selector, text)
				if (submit) {
					await evalExpr(magicBrowserSessionId, `document.querySelector(${JSON.stringify(selector)})?.form?.submit()`)
				}
				return formatActionToon("type", typed)
			}
			// No selector: fill focused element via eval
			const result = await evalExpr(
				magicBrowserSessionId,
				`(function(){var el=document.activeElement||document.body;if(el&&'value'in el){el.value=${JSON.stringify(text)};el.dispatchEvent(new Event('input',{bubbles:true}));}return{ok:true}})()`,
			)
			return formatActionToon("type", result)
		}
		case "browser_scroll": {
			const deltaX = typeof args.deltaX === "number" ? args.deltaX : 0
			const rawDeltaY =
				typeof args.deltaY === "number"
					? args.deltaY
					: args.direction === "up"
						? -Math.abs(Number(args.amount ?? 400))
						: Math.abs(Number(args.amount ?? 400))
			const result = await evalExpr(
				magicBrowserSessionId,
				`window.scrollBy(${deltaX},${rawDeltaY})`,
			)
			return formatActionToon("scroll", result)
		}
		case "browser_tabs": {
			// tabs list/open/close/activate — route through MB tabs verb (list) or lane CDP for mutations
			const action = args.action ?? "list"
			if (action === "list") {
				const result = await mbTabs(magicBrowserSessionId)
				return formatTabsToon(result)
			}
			// For open/close/activate we fall through to the iframe path (tab mutations go via lane CDP)
			// The lane id is not passed here — handled by the caller shimming back to dispatchTabsAction
			return `tabs_${action}: not_supported_in_streamed_mode — use web.navigate for navigation`
		}
		case "browser_status": {
			const result = await snapshot(magicBrowserSessionId)
			return formatSnapshotToon(result)
		}
		case "browser_read": {
			const rawText = await documentText(magicBrowserSessionId)
			return formatSnapshotToon(rawText)
		}
		default:
			return `unsupported_streamed_tool: ${toolName}`
	}
}

async function provisionDefaultLaneForSession(sessionId: string): Promise<string> {
	// Ensure the session has a binding first.
	ensureSessionBindingForSession({ sessionId })
	// Lazily create the default direct-iframe lane if it doesn't exist yet.
	await createBrowserLane({
		id: DEFAULT_BROWSER_LANE_ID,
		label: "Default",
		mode: "remote",
		runtime: "remote-attached",
		surfaceKind: "direct-iframe",
		streamBackendUrl: null,
		cdpEndpoint: null,
		host: null,
	}).catch(() => {
		// Lane may already exist — that is fine, ensureBrowserLane will verify it.
	})
	const lane = await ensureBrowserLane(DEFAULT_BROWSER_LANE_ID)
	// Attach the lane to the session binding.
	const updated = attachLaneToBinding(sessionId, lane.id)
	if (!updated) {
		throw new Error(`no_session_binding: session ${sessionId} has no binding to attach lane to`)
	}
	return lane.id
}

export async function dispatchBrowserTool(input: DispatchBrowserToolInput): Promise<{ status: string; resultSummary: string }> {
	const parsedInput = dispatchBrowserToolInputSchema.parse(input)
	let resolved = resolvePalotSessionBinding(parsedInput.sessionId)

	// Lazy lane auto-provision: if no lane is bound yet, ensure the default
	// direct-iframe lane and attach it to this session before continuing.
	if (!resolved.binding?.browserLaneId) {
		let provisionedLaneId: string
		try {
			provisionedLaneId = await provisionDefaultLaneForSession(parsedInput.sessionId)
		} catch (err) {
			return {
				status: "failed",
				resultSummary: err instanceof Error ? err.message : "lane_provision_failed",
			}
		}
		resolved = resolvePalotSessionBinding(parsedInput.sessionId)
		if (!resolved.binding?.browserLaneId) {
			return {
				status: "failed",
				resultSummary: `lane_bind_failed: provisioned lane ${provisionedLaneId} but binding was not updated`,
			}
		}
	}
	// browser_set_mode: handled before the streamed/iframe routing split since it
	// changes which lane is bound and may start/stop the Magic Browser session.
	if (parsedInput.toolName === "browser_set_mode") {
		const mode = parsedInput.args.mode as "iframe" | "streamed" | undefined
		if (mode !== "iframe" && mode !== "streamed") {
			return { status: "failed", resultSummary: `invalid_mode: expected iframe or streamed, got ${JSON.stringify(mode)}` }
		}
		if (mode === "iframe") {
			// Switch to direct-iframe: ensure the default iframe lane exists and bind it.
			await createBrowserLane({
				id: DEFAULT_BROWSER_LANE_ID,
				label: "Default",
				mode: "remote",
				runtime: "remote-attached",
				surfaceKind: "direct-iframe",
				streamBackendUrl: null,
				cdpEndpoint: null,
				host: null,
			}).catch(() => { /* already exists */ })
			const iframeLane = await ensureBrowserLane(DEFAULT_BROWSER_LANE_ID)
			const updated = attachLaneToBinding(parsedInput.sessionId, iframeLane.id)
			if (!updated) {
				return { status: "failed", resultSummary: "no_binding: cannot switch mode without an active session binding" }
			}
			return { status: "completed", resultSummary: `mode iframe bound ${iframeLane.id}` }
		}
		// mode === "streamed": we cannot provision docker-chromium without the docker
		// runtime being available. Fail fast with a typed error naming the precondition.
		// A real streamed lane is created externally (via docker or a remote CDP attach)
		// and its id/cdpEndpoint are set in the registry before calling this.
		// For now, fail fast: the agent must switch via the host dock UI or a pre-existing
		// remote-attached lane with a cdpEndpoint.
		return {
			status: "failed",
			resultSummary:
				"needs_streamed_lane: no streamed lane is available; start a docker-chromium lane or attach a remote CDP lane first, then switch mode",
		}
	}

	// Build actor from the resolved binding so the overlay renders the correct
	// kind ("sub" vs "main") and display name for this session.
	const actor: Actor = actorForBinding(
		parsedInput.sessionId,
		resolved.binding?.parentSessionId ?? null,
	)

	await publishBrowserAction({ event: buildToolRequestEvent(parsedInput, actor) })

	// Determine if the bound lane is streamed (has CDP). Route accordingly.
	const lane: BrowserLane | null = await getBrowserLane(resolved.binding.browserLaneId)
	const streamed = !!lane && isStreamedLane(lane)

	let resultSummary = "queued"

	if (streamed) {
		// Streamed path: ensure a Magic Browser session exists, then dispatch
		// through the engine. All DOM-touching tools go here.
		const updatedBinding = await ensureMagicBrowserSessionForBinding(parsedInput.sessionId)
		const mbSessionId = updatedBinding?.magicBrowserSessionId ?? resolved.binding.magicBrowserSessionId
		if (!mbSessionId) {
			resultSummary = "needs_streamed_mode: lane is streamed but magic-browser session could not be created"
		} else {
			resultSummary = await dispatchStreamedTool(parsedInput, mbSessionId)
		}
	} else {
		// Iframe path: keep existing raw-lane-CDP behavior intact.
		if (parsedInput.toolName === "browser_status") {
			const snap = resolvePalotSessionBinding(parsedInput.sessionId)
			resultSummary = JSON.stringify({
				status: snap.binding?.status ?? "unbound",
				viewerUrl: snap.nonSecretSnapshot?.viewerUrl ?? null,
				currentUrl: snap.nonSecretSnapshot?.viewport?.currentUrl ?? null,
			})
		} else if (parsedInput.toolName === "browser_navigate" || parsedInput.toolName === "browser_open") {
			const result = await navigateBrowserLane(
				resolved.binding.browserLaneId,
				String(parsedInput.args.url ?? "about:blank"),
			)
			resultSummary = JSON.stringify(result)
		} else if (parsedInput.toolName === "browser_tabs") {
			const result = await dispatchTabsAction(resolved.binding.browserLaneId, parsedInput.args)
			resultSummary = JSON.stringify(result)
		} else if (parsedInput.toolName === "browser_click") {
			await clickBrowserLane(resolved.binding.browserLaneId, {
				x: Number(parsedInput.args.x ?? 0),
				y: Number(parsedInput.args.y ?? 0),
				button: parsedInput.args.button as "left" | "middle" | "right" | undefined,
				clickCount: parsedInput.args.clickCount as number | undefined,
			})
			resultSummary = JSON.stringify({ status: "completed", action: "click" })
		} else if (parsedInput.toolName === "browser_type") {
			await typeBrowserLane(resolved.binding.browserLaneId, {
				text: String(parsedInput.args.text ?? ""),
				submit: parsedInput.args.submit as boolean | undefined,
			})
			resultSummary = JSON.stringify({ status: "completed", action: "type" })
		} else if (parsedInput.toolName === "browser_scroll") {
			await scrollBrowserLane(resolved.binding.browserLaneId, {
				deltaX: parsedInput.args.deltaX as number | undefined,
				deltaY:
					typeof parsedInput.args.deltaY === "number"
						? parsedInput.args.deltaY
						: parsedInput.args.direction === "up"
							? -Math.abs(Number(parsedInput.args.amount ?? 400))
							: Math.abs(Number(parsedInput.args.amount ?? 400)),
			})
			resultSummary = JSON.stringify({ status: "completed", action: "scroll" })
		} else if (parsedInput.toolName === "browser_read") {
			// Iframe lane has no CDP: fail fast naming the precondition.
			resultSummary =
				"needs_streamed_mode: web.read requires the streamed browser engine; the iframe lane cannot read DOM. Use web.mode mode=streamed to switch."
		}
	}

	await publishBrowserAction({ event: buildToolResultEvent(parsedInput, resultSummary, actor) })
	return {
		status: streamed ? "completed" : "queued",
		resultSummary,
	}
}
