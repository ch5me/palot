import { Button } from "@ch5me/elf-ui/components/button"
import { Input } from "@ch5me/elf-ui/components/input"
import {
	Terminal,
	TerminalContent,
	TerminalCopyButton,
	TerminalHeader,
	TerminalTitle,
} from "@ch5me/elf-ui/components/ai-elements/terminal"
import { useState } from "react"
import type { Agent } from "../../lib/types"
import { useAgentActions, useServerConnection } from "../../hooks/use-server"

interface TerminalPanelProps {
	agent: Agent
	className?: string
}

export function TerminalPanel({ agent, className }: TerminalPanelProps) {
	const { url } = useServerConnection()
	const { sendPrompt } = useAgentActions()
	const [commandInput, setCommandInput] = useState("")
	const [submitting, setSubmitting] = useState(false)
	const attachCommand = `opencode attach ${url ?? "http://127.0.0.1:4096"} --session ${agent.sessionId} --dir ${agent.worktreePath ?? agent.directory}`
	const output = [
		`project: ${agent.project}`,
		`directory: ${agent.directory}`,
		agent.worktreePath ? `worktree: ${agent.worktreePath}` : null,
		agent.worktreeBranch ? `branch: ${agent.worktreeBranch}` : null,
		"",
		"attach command:",
		attachCommand,
	].filter(Boolean).join("\n")

	const handleSubmit = async () => {
		const trimmed = commandInput.trim()
		if (!trimmed || submitting) return
		setSubmitting(true)
		try {
			await sendPrompt(agent.directory, agent.sessionId, `/bash ${trimmed}`)
			setCommandInput("")
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Terminal</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Proof shell for terminal workflows. PTY runtime is deferred; attach stays the first real path.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
				<Terminal output={output} className="min-h-0 flex-1">
					<TerminalHeader>
						<TerminalTitle>Session terminal</TerminalTitle>
						<TerminalCopyButton />
					</TerminalHeader>
					<TerminalContent className="min-h-[240px] flex-1" />
				</Terminal>
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap gap-2">
						<Button type="button" variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(attachCommand)}>
							Copy attach command
						</Button>
					</div>
					<div className="flex gap-2">
						<Input
							value={commandInput}
							onChange={(event) => setCommandInput(event.target.value)}
							placeholder="Run a bash command through the active session"
							className="h-9 flex-1"
						/>
						<Button type="button" variant="outline" size="sm" disabled={!commandInput.trim() || submitting} onClick={() => void handleSubmit()}>
							{submitting ? "Running..." : "Run"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
