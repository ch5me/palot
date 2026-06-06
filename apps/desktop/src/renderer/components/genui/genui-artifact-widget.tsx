import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import {
	pinnedGenUiArtifactListFamily,
	pinGenUiArtifactAtom,
	unpinAllGenUiArtifactsForPlacementAtom,
} from "../../atoms/genui-artifacts"
import type { Agent, GenUiArtifactPlacement } from "../../lib/types"
import { GenUiArtifactCard } from "./genui-artifact-card"

interface GenUiArtifactWidgetProps {
	agent: Agent
	placement: Exclude<GenUiArtifactPlacement, "inline">
}

export function GenUiArtifactWidget({ agent, placement }: GenUiArtifactWidgetProps) {
	const artifacts = useAtomValue(pinnedGenUiArtifactListFamily(agent.sessionId))
	const pinArtifact = useSetAtom(pinGenUiArtifactAtom)
	const unpinAllForPlacement = useSetAtom(unpinAllGenUiArtifactsForPlacementAtom)
	const visibleArtifacts = useMemo(
		() => artifacts.filter((artifact) => artifact.pin.placement === placement),
		[artifacts, placement],
	)

	if (visibleArtifacts.length === 0) {
		return null
	}

	return (
		<div className="space-y-2">
			{visibleArtifacts.map((artifact) => (
				<GenUiArtifactCard
					key={artifact.id}
					artifact={artifact}
					onTogglePin={() => {
						if (artifact.pin.pinned) {
							pinArtifact({
								sessionId: agent.sessionId,
								artifactId: artifact.id,
								placement,
								pinned: false,
							})
							return
						}
						unpinAllForPlacement({ sessionId: agent.sessionId, placement })
						pinArtifact({
							sessionId: agent.sessionId,
							artifactId: artifact.id,
							placement,
							pinned: true,
						})
					}}
				/>
			))}
		</div>
	)
}
