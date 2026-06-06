import type { BrowserActionEvent } from "../../../preload/api"
import type { BrowserActionOverlayState } from "../../atoms/browser-actions"
import { BROWSER_DRIFT_TOLERANCE_PX, calculateDriftPx } from "../../../shared/browser-geometry"

interface BrowserCursorOverlayProps {
	events: BrowserActionEvent[]
	overlayState: BrowserActionOverlayState
	sessionId: string
}

function formatActionLabel(event: BrowserActionEvent | null): string {
	if (!event) return "No browser actions yet"
	switch (event.kind) {
		case "click":
			return `Click · ${event.button}`
		case "type":
			return `Type · ${event.text}`
		case "scroll":
			return `Scroll · ${event.deltaY}`
		case "humanTakeoverPaused":
			return "Human takeover paused"
		case "humanTakeoverResumed":
			return "Human takeover resumed"
		default:
			return event.kind
	}
}

function buildCursorClasses(event: BrowserActionEvent | null, frozen: boolean): string {
	const base = `absolute left-0 top-0 h-4 w-4 rounded-full border-2 border-foreground bg-background/90 shadow transition-transform duration-150 ${frozen ? "opacity-70" : "opacity-100"}`
	if (!event) return base
	if (event.kind === "hover") return `${base} ring-2 ring-blue-400/50`
	if (event.kind === "click") return `${base} scale-110`
	return base
}

export function BrowserCursorOverlay({ events, overlayState, sessionId }: BrowserCursorOverlayProps) {
	const latestEvent = events.at(-1) ?? overlayState.lastEvent
	const cursorStyle = latestEvent?.viewportCoords
		? {
				transform: `translate3d(${latestEvent.viewportCoords.x}px, ${latestEvent.viewportCoords.y}px, 0)`,
			}
		: undefined
	if (overlayState.activeSessionId && overlayState.activeSessionId !== sessionId) {
		return <div className="hidden" />
	}

	const previousEvent = events.length > 1 ? events.at(-2) ?? null : null
	const drift =
		latestEvent?.viewportCoords && previousEvent?.viewportCoords
			? calculateDriftPx(latestEvent.viewportCoords, previousEvent.viewportCoords)
			: 0
	const showDriftBadge = overlayState.showDriftBadge || drift > BROWSER_DRIFT_TOLERANCE_PX
	const logEvents = events.slice(-8)

	return (
		<div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
			<div className="absolute left-3 top-3 rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
				{formatActionLabel(latestEvent)}
			</div>
			{overlayState.showBestEffortBadge ? (
				<div className="absolute right-3 top-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700">
					Best-effort overlay
				</div>
			) : null}
			{overlayState.showHumanControlBadge ? (
				<div className="absolute right-3 top-10 rounded-md border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-700">
					Human in control
				</div>
			) : null}
			{showDriftBadge ? (
				<div className="absolute right-3 top-[4.25rem] rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-700">
					Drift detected
				</div>
			) : null}
			<div className={buildCursorClasses(latestEvent, overlayState.frozen)} style={cursorStyle} />
			{latestEvent?.kind === "click" && latestEvent.viewportCoords ? (
				<div
					className="absolute left-0 top-0 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/40 bg-foreground/5"
					style={{
						transform: `translate3d(${latestEvent.viewportCoords.x}px, ${latestEvent.viewportCoords.y}px, 0)`,
					}}
				/>
			) : null}
			{latestEvent?.kind === "type" && latestEvent.viewportCoords ? (
				<div
					className="absolute left-0 top-0 rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[10px] text-foreground shadow-sm"
					style={{
						transform: `translate3d(${latestEvent.viewportCoords.x + 12}px, ${latestEvent.viewportCoords.y - 12}px, 0)`,
					}}
				>
					{latestEvent.text || "Typing"}
				</div>
			) : null}
			{latestEvent?.kind === "scroll" ? (
				<div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center text-[10px] font-medium text-muted-foreground">
					Scroll {latestEvent.deltaY > 0 ? "down" : "up"}
				</div>
			) : null}
			<div className="absolute bottom-3 left-3 max-h-28 w-64 overflow-auto rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
				{logEvents.length === 0 ? (
					<div>No action log yet</div>
				) : (
					logEvents.map((event) => (
						<div key={`${event.id}:${event.sequence}`} className="truncate">
							{event.sequence}. {formatActionLabel(event)}
						</div>
					))
				)}
			</div>
		</div>
	)
}
