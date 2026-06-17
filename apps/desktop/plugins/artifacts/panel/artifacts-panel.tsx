import { useAtomValue, useSetAtom } from "jotai"
import { pinnedGenUiArtifactListFamily, pinGenUiArtifactAtom, sessionGenUiArtifactListFamily } from "@/atoms/genui-artifacts"
import type { Agent, GenUiArtifactPlacement } from "@/lib/types"
import { GenUiArtifactCard } from "@/components/genui/genui-artifact-card"

interface ArtifactsPanelProps {
	agent: Agent
	className?: string
}

export function ArtifactsPanel({ agent, className }: ArtifactsPanelProps) {
	const artifacts = useAtomValue(sessionGenUiArtifactListFamily(agent.sessionId))
	const pinnedArtifacts = useAtomValue(pinnedGenUiArtifactListFamily(agent.sessionId))
	const pinArtifact = useSetAtom(pinGenUiArtifactAtom)

	const handleTogglePin = (artifactId: string, placement: Exclude<GenUiArtifactPlacement, "inline">) => {
		const current = artifacts.find((artifact) => artifact.id === artifactId)
		if (!current) return
		pinArtifact({
			sessionId: agent.sessionId,
			artifactId,
			placement,
			pinned: !current.pin.pinned,
		})
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Artifacts</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Session-scoped GenUI artifacts for {agent.project}. Pin them to keep them visible while you work.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
				<div className="rounded-lg border border-border/70 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
					{artifacts.length} artifact{artifacts.length === 1 ? "" : "s"} total · {pinnedArtifacts.length} pinned
				</div>
				{artifacts.length === 0 ? (
					<div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
						No GenUI artifacts captured yet.
					</div>
				) : (
					artifacts.map((artifact) => (
						<GenUiArtifactCard
							key={artifact.id}
							artifact={artifact}
							onTogglePin={(placement) => handleTogglePin(artifact.id, placement)}
							showPropActions
						/>
					))
				)}
			</div>
		</div>
	)
}

export default ArtifactsPanel
