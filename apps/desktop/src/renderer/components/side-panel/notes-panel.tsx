import { Button } from "@ch5me/palot-ui/components/button"
import { Textarea } from "@ch5me/palot-ui/components/textarea"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { useDraft, useDraftActions } from "../../hooks/use-draft"
import type { Agent } from "../../lib/types"

interface NotesPanelProps {
	agent: Agent
	className?: string
}

export function NotesPanel({ agent, className }: NotesPanelProps) {
	const draftKey = `notes:${agent.sessionId}`
	const notes = useDraft(draftKey)
	const { setDraft, clearDraft } = useDraftActions(draftKey)
	const [copying, setCopying] = useState(false)
	const summary = useMemo(() => {
		if (!notes.trim()) return "No notes captured yet."
		const lines = notes
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean)
		return `${lines.length} note${lines.length === 1 ? "" : "s"} captured for ${agent.project}.`
	}, [agent.project, notes])

	const handleSendToAI = async () => {
		if (!notes.trim()) return
		setCopying(true)
		try {
			await navigator.clipboard.writeText(notes)
			toast.success("Notes copied to clipboard — paste into chat with Cmd+V")
		} catch {
			toast.error("Failed to copy notes to clipboard")
		} finally {
			setCopying(false)
		}
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Notes</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Capture operator notes, review follow-ups, and cut lines for this session.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
				<Textarea
					value={notes}
					onChange={(event) => setDraft(event.target.value)}
					placeholder="Write notes you want to keep visible while working this session."
					className="min-h-[220px] flex-1 resize-none"
				/>
				<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
					<span>{summary}</span>
					<div className="flex gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleSendToAI}
							disabled={!notes.trim() || copying}
						>
							Send to AI
						</Button>
						<Button type="button" variant="outline" size="sm" onClick={clearDraft}>Clear</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
