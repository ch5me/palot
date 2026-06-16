import { Button, Input } from "@ch5me/ch5-ui-web";
import {
	Terminal,
	TerminalContent,
	TerminalCopyButton,
	TerminalHeader,
	TerminalTitle,
} from "@ch5me/agent-ui-web"
import { useEffect, useMemo, useRef, useState } from "react"
import { DEFAULT_LOCAL_SERVER_PORT } from "../../../src/shared/server-config"
import { paneSubmitters, paneWriters } from "../../../src/renderer/atoms/pane-bus"
import type { Agent } from "../../../src/renderer/lib/types"
import {
	killPty,
	onPtyData,
	onPtyExit,
	resizePty,
	spawnPtyTerminal,
	writePty,
} from "../../../src/renderer/services/backend"
import { useServerConnection } from "../../../src/renderer/hooks/use-server"

interface TerminalPanelProps {
	agent: Agent
	className?: string
}

const DEFAULT_ROWS = 24
const DEFAULT_COLS = 80

function estimateTerminalSize(element: HTMLElement | null): { cols: number; rows: number } {
	if (!element) {
		return { cols: DEFAULT_COLS, rows: DEFAULT_ROWS }
	}
	const rect = element.getBoundingClientRect()
	return {
		cols: Math.max(40, Math.floor(rect.width / 8.2)),
		rows: Math.max(12, Math.floor(rect.height / 20)),
	}
}

function terminalSessionName(agent: Agent): string {
	return `${agent.projectSlug}-${agent.sessionId}`
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48)
}

export function TerminalPanel({ agent, className }: TerminalPanelProps) {
	const { url } = useServerConnection()
	const outputRef = useRef<HTMLDivElement | null>(null)
	const sessionRef = useRef<number | null>(null)
	const [output, setOutput] = useState("")
	const [commandInput, setCommandInput] = useState("")
	const [submitting, setSubmitting] = useState(false)
	const [starting, setStarting] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [exited, setExited] = useState<{ exitCode: number; signal?: number } | null>(null)

	const attachCommand = useMemo(
		() =>
			`opencode attach ${url ?? `http://127.0.0.1:${DEFAULT_LOCAL_SERVER_PORT}`} --session ${agent.sessionId} --dir ${agent.worktreePath ?? agent.directory}`,
		[url, agent.sessionId, agent.worktreePath, agent.directory],
	)

	useEffect(() => {
		let alive = true
		setStarting(true)
		setError(null)
		setExited(null)
		setOutput("")

		const removeDataListener = onPtyData((event) => {
			if (event.id !== sessionRef.current) {
				return
			}
			setOutput((current) => current + event.data)
		})
		const removeExitListener = onPtyExit((event) => {
			if (event.id !== sessionRef.current) {
				return
			}
			setExited({ exitCode: event.exitCode, signal: event.signal })
			sessionRef.current = null
		})

		const start = async () => {
			try {
				const initialSize = estimateTerminalSize(outputRef.current)
				const sessionId = await spawnPtyTerminal({
					name: terminalSessionName(agent),
					command: null,
					cwd: agent.worktreePath ?? agent.directory,
					cols: initialSize.cols,
					rows: initialSize.rows,
				})
				if (!alive) {
					await killPty(sessionId).catch(() => {})
					return
				}
				sessionRef.current = sessionId
				paneWriters.set(agent.sessionId, (text) => {
					setCommandInput((current) => `${current}${text}`)
				})
				paneSubmitters.set(agent.sessionId, (text) => {
					void writePty(sessionId, `${text}\n`)
				})
			} catch (err) {
				if (!alive) {
					return
				}
				setError(err instanceof Error ? err.message : "Failed to start terminal session")
			} finally {
				if (alive) {
					setStarting(false)
				}
			}
		}

		void start()

		const observer = new ResizeObserver(() => {
			const sessionId = sessionRef.current
			if (!sessionId) {
				return
			}
			const nextSize = estimateTerminalSize(outputRef.current)
			void resizePty(sessionId, nextSize.cols, nextSize.rows).catch(() => {})
		})
		if (outputRef.current) {
			observer.observe(outputRef.current)
		}

		return () => {
			alive = false
			observer.disconnect()
			paneWriters.delete(agent.sessionId)
			paneSubmitters.delete(agent.sessionId)
			removeDataListener()
			removeExitListener()
			const sessionId = sessionRef.current
			sessionRef.current = null
			if (sessionId) {
				void killPty(sessionId).catch(() => {})
			}
		}
	}, [agent.sessionId, agent.projectSlug, agent.worktreePath, agent.directory])

	const handleSubmit = async () => {
		const sessionId = sessionRef.current
		const trimmed = commandInput.trim()
		if (!sessionId || !trimmed || submitting) {
			return
		}
		setSubmitting(true)
		try {
			await writePty(sessionId, `${trimmed}\n`)
			setCommandInput("")
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to send command")
		} finally {
			setSubmitting(false)
		}
	}

	const footerLines = [
		`project: ${agent.project}`,
		`directory: ${agent.directory}`,
		agent.worktreePath ? `worktree: ${agent.worktreePath}` : null,
		agent.worktreeBranch ? `branch: ${agent.worktreeBranch}` : null,
		error ? `error: ${error}` : null,
		exited ? `session exited: ${exited.exitCode}${exited.signal ? ` signal ${exited.signal}` : ""}` : null,
	].filter(Boolean)

	const displayOutput = [output, footerLines.length > 0 ? `\n${footerLines.join("\n")}` : null]
		.filter(Boolean)
		.join("")

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Terminal</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Live PTY lane for {agent.project}. Detaches through the Electron seam and keeps tmux-backed sessions reattachable.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
				<div ref={outputRef} className="min-h-0 flex-1">
					<Terminal output={displayOutput} isStreaming={starting || submitting} className="h-full min-h-0 flex-1">
						<TerminalHeader>
							<TerminalTitle>Session terminal</TerminalTitle>
							<TerminalCopyButton />
						</TerminalHeader>
						<TerminalContent className="h-full min-h-[240px] flex-1" />
					</Terminal>
				</div>
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(attachCommand)}>
							Copy attach command
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={!sessionRef.current}
							onClick={() => {
								const sessionId = sessionRef.current
								if (sessionId) {
									void writePty(sessionId, "echo hi\n")
								}
							}}
						>
							Send `echo hi`
						</Button>
					</div>
					<div className="flex gap-2">
						<Input
							value={commandInput}
							onChange={(event) => setCommandInput(event.target.value)}
							placeholder="Run a shell command in this PTY"
							className="h-9 flex-1"
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault()
									void handleSubmit()
								}
							}}
						/>
						<Button type="button" variant="outline" size="sm" disabled={!commandInput.trim() || submitting || starting} onClick={() => void handleSubmit()}>
							{submitting ? "Running..." : "Run"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default TerminalPanel
