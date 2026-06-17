import type {
	Actor,
	BrowserActionEvent,
	BrowserActionStatus,
	BrowserActionTargetDescription,
	BrowserActionViewportCoords,
	StreamGeometrySnapshot,
} from "../preload/api"

export const BROWSER_ACTION_EVENT_VERSION = 1 as const
export const BROWSER_ACTION_EVENT_CONTRACT_CHECKSUM =
	"browser-action-event-v1-tool-request-runtime-ack" as const

export interface NormalizeBrowserActionEventInput {
	kind: BrowserActionEvent["kind"]
	sessionId: string
	laneId?: string | null
	source: BrowserActionEvent["source"]
	actor?: Actor | null
	sequence: number
	requestId?: string | null
	causationId?: string | null
	toolCallId?: string | null
	targetDescription?: BrowserActionTargetDescription | null
	viewportCoords?: BrowserActionViewportCoords | null
	streamGeometrySnapshot?: StreamGeometrySnapshot | null
	timestamp?: number
	durationMs?: number | null
	status: BrowserActionStatus
	errorCode?: BrowserActionEvent["errorCode"]
	errorMessage?: BrowserActionEvent["errorMessage"]
	button?: "left" | "middle" | "right"
	clickCount?: number
	text?: string
	caretConfidence?: "none" | "low" | "high"
	deltaX?: number
	deltaY?: number
	waitFor?: string
	url?: string
	magicBrowserSessionId?: string | null
	reason?: string | null
	toolName?: string
	argsSummary?: string | null
	resultSummary?: string | null
}

function buildBaseEvent(input: NormalizeBrowserActionEventInput) {
	return {
		id: `${input.sessionId}:${input.sequence}:${input.kind}`,
		sessionId: input.sessionId,
		laneId: input.laneId ?? null,
		source: input.source,
		actor: input.actor ?? null,
		sequence: input.sequence,
		requestId: input.requestId ?? null,
		causationId: input.causationId ?? null,
		toolCallId: input.toolCallId ?? null,
		targetDescription: input.targetDescription ?? null,
		viewportCoords: input.viewportCoords ?? null,
		streamGeometrySnapshot: input.streamGeometrySnapshot ?? null,
		timestamp: input.timestamp ?? Date.now(),
		durationMs: input.durationMs ?? null,
		status: input.status,
		errorCode: input.errorCode ?? null,
		errorMessage: input.errorMessage ?? null,
	}
}

export function normalizeBrowserActionEvent(
	input: NormalizeBrowserActionEventInput,
): BrowserActionEvent {
	const base = buildBaseEvent(input)
	switch (input.kind) {
		case "move":
			return { ...base, kind: "move" }
		case "click":
			return {
				...base,
				kind: "click",
				button: input.button ?? "left",
				clickCount: input.clickCount ?? 1,
			}
		case "type":
			return {
				...base,
				kind: "type",
				text: input.text ?? "",
				caretConfidence: input.caretConfidence ?? "none",
			}
		case "scroll":
			return {
				...base,
				kind: "scroll",
				deltaX: input.deltaX ?? 0,
				deltaY: input.deltaY ?? 0,
			}
		case "focus":
			return { ...base, kind: "focus" }
		case "hover":
			return { ...base, kind: "hover" }
		case "waitFor":
			return { ...base, kind: "waitFor", waitFor: input.waitFor ?? "" }
		case "navigate":
			return { ...base, kind: "navigate", url: input.url ?? "about:blank" }
		case "attachSession":
			return {
				...base,
				kind: "attachSession",
				magicBrowserSessionId: input.magicBrowserSessionId ?? null,
			}
		case "detachSession":
			return { ...base, kind: "detachSession", reason: input.reason ?? null }
		case "toolRequest":
			return {
				...base,
				kind: "toolRequest",
				toolName: input.toolName ?? "unknown",
				argsSummary: input.argsSummary ?? null,
			}
		case "toolResult":
			return {
				...base,
				kind: "toolResult",
				toolName: input.toolName ?? "unknown",
				resultSummary: input.resultSummary ?? null,
			}
		case "systemReconcile":
			return { ...base, kind: "systemReconcile", reason: input.reason ?? "" }
		case "humanTakeoverPaused":
			return { ...base, kind: "humanTakeoverPaused", reason: input.reason ?? null }
		case "humanTakeoverResumed":
			return { ...base, kind: "humanTakeoverResumed", reason: input.reason ?? null }
	}
}
