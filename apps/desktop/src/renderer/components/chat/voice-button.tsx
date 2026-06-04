import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2Icon, MicIcon, SquareIcon } from "lucide-react"
import { dictateCancel, dictateStart, dictateStop } from "../../lib/voice"

type Phase = "idle" | "recording" | "transcribing"

function formatElapsed(seconds: number): string {
	const minutes = Math.floor(seconds / 60)
	const remainder = seconds % 60
	return `${minutes}:${remainder.toString().padStart(2, "0")}`
}

export function VoiceButton({ onTranscript }: { onTranscript: (text: string) => void }) {
	const [phase, setPhase] = useState<Phase>("idle")
	const [elapsed, setElapsed] = useState(0)
	const [error, setError] = useState<string | null>(null)
	const heldRef = useRef(false)
	const holdTimer = useRef<number | null>(null)
	const startedAt = useRef<number | null>(null)
	const phaseRef = useRef<Phase>("idle")
	phaseRef.current = phase

	useEffect(() => {
		if (phase !== "recording") {
			return
		}
		setElapsed(0)
		const started = Date.now()
		const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250)
		return () => window.clearInterval(timer)
	}, [phase])

	useEffect(() => {
		if (!error) {
			return
		}
		const timer = window.setTimeout(() => setError(null), 4000)
		return () => window.clearTimeout(timer)
	}, [error])

	const begin = useCallback(async () => {
		if (phaseRef.current !== "idle") {
			return
		}
		setError(null)
		try {
			await dictateStart()
			setPhase("recording")
		} catch (err) {
			setError(String(err))
			setPhase("idle")
		}
	}, [])

	const finish = useCallback(async () => {
		if (phaseRef.current !== "recording") {
			return
		}
		setPhase("transcribing")
		try {
			const text = await dictateStop()
			if (text) {
				onTranscript(text)
			} else {
				setError("nothing transcribed")
			}
		} catch (err) {
			setError(String(err))
		} finally {
			setPhase("idle")
		}
	}, [onTranscript])

	const abort = useCallback(async () => {
		if (phaseRef.current !== "recording") {
			return
		}
		setPhase("idle")
		try {
			await dictateCancel()
		} catch {
			// best effort
		}
	}, [])

	useEffect(() => {
		if (phase !== "recording") {
			return
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault()
				void abort()
			}
		}
		window.addEventListener("keydown", onKeyDown)
		return () => window.removeEventListener("keydown", onKeyDown)
	}, [phase, abort])

	const onPointerDown = useCallback(() => {
		if (phaseRef.current !== "idle") {
			return
		}
		heldRef.current = false
		startedAt.current = Date.now()
		if (holdTimer.current) {
			window.clearTimeout(holdTimer.current)
		}
		holdTimer.current = window.setTimeout(() => {
			heldRef.current = true
		}, 350)
		void begin()
	}, [begin])

	const onPointerUp = useCallback(() => {
		if (holdTimer.current) {
			window.clearTimeout(holdTimer.current)
			holdTimer.current = null
		}
		const wasHold = heldRef.current && startedAt.current && Date.now() - startedAt.current >= 350
		heldRef.current = false
		startedAt.current = null
		if (wasHold && phaseRef.current === "recording") {
			void finish()
		}
	}, [finish])

	const onClick = useCallback(() => {
		if (phaseRef.current === "recording" && !heldRef.current) {
			void finish()
		}
	}, [finish])

	if (phase === "recording") {
		return (
			<button
				type="button"
				onPointerUp={onPointerUp}
				onClick={onClick}
				title="stop dictation (Esc to cancel)"
				className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-destructive/20"
			>
				<span className="relative flex h-2 w-2">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
					<span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
				</span>
				<span className="font-mono tabular-nums text-[12px]">{formatElapsed(elapsed)}</span>
				<SquareIcon className="size-3 fill-current text-muted-foreground" aria-hidden="true" />
			</button>
		)
	}

	if (phase === "transcribing") {
		return (
			<div className="flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
				<Loader2Icon className="size-3 animate-spin text-primary" aria-hidden="true" />
				<span>transcribing…</span>
			</div>
		)
	}

	return (
		<div className="relative flex items-center">
			<button
				type="button"
				onPointerDown={onPointerDown}
				onPointerUp={onPointerUp}
				title="dictate (click to start, hold to talk)"
				className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
			>
				<MicIcon className="size-3.5" aria-hidden="true" />
			</button>
			{error ? (
				<div className="absolute right-0 top-full z-50 mt-1 max-w-[220px] whitespace-normal rounded-md border border-destructive/40 bg-popover px-2 py-1 text-[11px] text-destructive shadow-lg">
					{error}
				</div>
			) : null}
		</div>
	)
}
