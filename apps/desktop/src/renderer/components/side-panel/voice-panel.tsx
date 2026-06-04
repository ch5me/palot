import { useMemo, useState } from "react"
import { Button } from "@ch5me/elf-ui/components/button"
import { MicIcon } from "lucide-react"
import type { Agent } from "../../lib/types"
import { paneWriters } from "../../atoms/pane-bus"
import { VoiceButton } from "../chat/voice-button"

interface VoicePanelProps {
	agent: Agent
	className?: string
}

export function VoicePanel({ agent, className }: VoicePanelProps) {
	const [lastTranscript, setLastTranscript] = useState<string | null>(null)
	const writer = useMemo(() => paneWriters.get(agent.sessionId) ?? null, [agent.sessionId])

	const handleTranscript = (text: string) => {
		setLastTranscript(text)
		writer?.(text)
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Voice</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Input-first voice lane for {agent.project}. Dictation inserts transcripts into the active chat input for this session.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				<section className="rounded-lg border border-border px-3 py-3">
					<div className="flex items-center justify-between gap-3">
						<div>
							<h4 className="text-sm font-medium text-foreground">Voice input</h4>
							<p className="mt-1 text-xs text-muted-foreground">
								Use the mic to dictate into this session's active chat composer.
							</p>
						</div>
						<VoiceButton onTranscript={handleTranscript} />
					</div>
				</section>
				<section className="rounded-lg border border-border px-3 py-3 text-xs text-muted-foreground">
					<div className="flex items-start gap-2">
						<MicIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
						<div className="space-y-2">
							<p>Mic denied, missing hardware, or offline Whisper all surface explicit inline errors from the same dictation control.</p>
							<p>{writer ? "This session has an active chat target ready for transcript insertion." : "No active chat target is mounted for this session yet. Open the chat composer first."}</p>
						</div>
					</div>
				</section>
				{lastTranscript ? (
					<section className="rounded-lg border border-border bg-muted/20 px-3 py-3 text-xs text-foreground">
						<div className="font-medium text-foreground">Last transcript</div>
						<p className="mt-2 whitespace-pre-wrap leading-relaxed">{lastTranscript}</p>
						<div className="mt-3">
							<Button type="button" variant="outline" size="sm" onClick={() => writer?.(lastTranscript)} disabled={!writer}>
								Insert again
							</Button>
						</div>
					</section>
				) : null}
				<section className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
					Text-to-speech and richer device/mic routing stay deferred until a concrete outbound voice lane exists.
				</section>
			</div>
		</div>
	)
}
