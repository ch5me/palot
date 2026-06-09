import { Button } from "@ch5me/elf-ui/components/button"
import { Textarea } from "@ch5me/elf-ui/components/textarea"
import { SendHorizontalIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { paneWriters } from "../../atoms/pane-bus"
import { useDraftActions, useDraftSnapshot } from "../../hooks/use-draft"
import type { Agent } from "../../lib/types"

interface NotesPanelProps {
	agent: Agent
	className?: string
}

const MAX_NOTE_LENGTH = 20_000

export function NotesPanel({ agent, className }: NotesPanelProps) {
	const draftKey = `notes:${agent.sessionId}`
	const draftSnapshot = useDraftSnapshot(draftKey)
	const { setDraft, clearDraft } = useDraftActions(draftKey)
	const [notes, setNotes] = useState(draftSnapshot)
	const [copying, setCopying] = useState(false)
	const [sending, setSending] = useState(false)

	const writer = useMemo(() => paneWriters.get(agent.sessionId) ?? null, [agent.sessionId])

	useEffect(() => {
		setNotes(draftSnapshot)
	}, [draftSnapshot])

	const trimmed = notes.trim()
	const summary = trimmed
		? `${trimmed.split("\n").filter((line) => line.trim().length > 0).length} note${trimmed.split("\n").filter((line) => line.trim().length > 0).length === 1 ? "" : "s"} captured for ${agent.project}.`
		: `No notes captured yet for ${agent.project}. Type below -- drafts autosave per session.`

	const handleCopyToClipboard = useCallback(async () => {
		if (!trimmed) return
		setCopying(true)
		try {
			await navigator.clipboard.writeText(notes)
			toast.success("Notes copied to clipboard")
		} catch {
			toast.error("Failed to copy notes to clipboard")
		} finally {
			setCopying(false)
		}
	}, [notes, trimmed])

	const handleSendToChat = useCallback(() => {
		if (!trimmed) {
			toast.error("Write something first before sending to chat")
			return
		}
		setSending(true)
		try {
			if (!writer) {
				toast.message("No active chat composer for this session", {
					description: "Open the chat composer for this session, then try again.",
				})
				return
			}
			writer(trimmed)
			toast.success("Notes inserted into chat composer")
		} finally {
			setSending(false)
		}
	}, [trimmed, writer])

	const handleClear = useCallback(() => {
		setNotes("")
		clearDraft()
		toast.message("Notes cleared")
	}, [clearDraft])

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Notes</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Capture operator notes, review follow-ups, and cut lines for this session. Drafts
					autosave per session and can be injected into the active chat composer.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
				<Textarea
					value={notes}
					onChange={(event) => {
						const next = event.target.value.slice(0, MAX_NOTE_LENGTH)
						setNotes(next)
						setDraft(next)
					}}
					placeholder="Write notes you want to keep visible while working this session."
					className="min-h-[220px] flex-1 resize-none"
					style={{ fieldSizing: "fixed" }}
				/>
				<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
					<span>{summary}</span>
					<span aria-label="character-count">
						{notes.length}/{MAX_NOTE_LENGTH}
					</span>
				</div>
				<div className="flex flex-wrap items-center justify-end gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleCopyToClipboard}
						disabled={!trimmed || copying}
					>
						{copying ? "Copying..." : "Copy to clipboard"}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleSendToChat}
						disabled={!trimmed || sending}
						title={
							writer
								? "Insert these notes into the active chat composer for this session"
								: "Open the chat composer for this session to enable"
						}
					>
						<SendHorizontalIcon className="size-3.5" aria-hidden="true" />
						{sending ? "Sending..." : "Send to chat"}
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleClear}
						disabled={!notes}
					>
						Clear
					</Button>
				</div>
				{!writer ? (
					<div className="rounded-md border border-dashed border-border bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
						Send to chat is ready, but no active chat composer is mounted for this
						session yet. Open the chat composer first, then come back to insert your
						notes.
					</div>
				) : null}
			</div>
		</div>
	)
}
