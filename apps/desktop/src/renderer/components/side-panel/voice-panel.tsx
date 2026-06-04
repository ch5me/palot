import type { Agent } from "../../lib/types"

interface VoicePanelProps {
	agent: Agent
	className?: string
}

export function VoicePanel({ agent, className }: VoicePanelProps) {
	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Voice</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Input-first voice lane for {agent.project}. This is a proof shell before any recording or speech runtime exists.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				<section className="rounded-lg border border-border px-3 py-3">
					<h4 className="text-sm font-medium text-foreground">Voice input</h4>
					<p className="mt-1 text-xs text-muted-foreground">
						Future microphone selection, capture, and transcription controls can gather here once a real voice runtime is chosen.
					</p>
				</section>
				<section className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
					Recording, STT, and TTS are intentionally deferred until a concrete voice backend and product lane exist.
				</section>
			</div>
		</div>
	)
}
