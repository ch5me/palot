import {
	Artifact,
	ArtifactAction,
	ArtifactActions,
	ArtifactContent,
	ArtifactDescription,
	ArtifactHeader,
	ArtifactTitle,
} from "@ch5me/elf-ui/components/ai-elements/artifact"
import { Badge } from "@ch5me/elf-ui/components/badge"
import { PinIcon, PinOffIcon } from "lucide-react"
import { useMemo } from "react"
import { GenUiBlock } from "../../genui/genui-renderer"
import type { GenUiArtifactPlacement, GenUiArtifactRecord } from "../../lib/types"

const PINNABLE_ARTIFACT_PLACEMENT_FALLBACK: Exclude<GenUiArtifactPlacement, "inline"> =
	"chat-inline-right"
import { GenUiArtifactPropActions } from "./genui-artifact-prop-actions"

interface GenUiArtifactCardProps {
	artifact: GenUiArtifactRecord
	onTogglePin?: (placement: Exclude<GenUiArtifactPlacement, "inline">) => void
	className?: string
	showPropActions?: boolean
}

function formatArtifactTime(timestamp: number): string {
	const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
	if (diffSeconds < 5) return "just now"
	if (diffSeconds < 60) return `${diffSeconds}s ago`
	const diffMinutes = Math.floor(diffSeconds / 60)
	if (diffMinutes < 60) return `${diffMinutes}m ago`
	const diffHours = Math.floor(diffMinutes / 60)
	if (diffHours < 24) return `${diffHours}h ago`
	const diffDays = Math.floor(diffHours / 24)
	return `${diffDays}d ago`
}

export function GenUiArtifactCard({
	artifact,
	onTogglePin,
	className,
	showPropActions = false,
}: GenUiArtifactCardProps) {
	const pinTooltip = artifact.pin.pinned ? "Unpin artifact" : "Pin artifact"
	const meta = useMemo(() => {
		const location = artifact.pin.pinned && artifact.pin.placement ? artifact.pin.placement : "inline"
		return `${artifact.id} · ${location} · ${formatArtifactTime(artifact.updatedAt)}`
	}, [artifact])

	return (
		<Artifact className={className} data-artifact-id={artifact.id}>
			<ArtifactHeader>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<ArtifactTitle className="truncate">{artifact.title}</ArtifactTitle>
						<Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wide">
							{artifact.component}
						</Badge>
					</div>
					<ArtifactDescription className="truncate text-[11px]">{meta}</ArtifactDescription>
				</div>
				{onTogglePin || showPropActions ? (
					<ArtifactActions>
						{showPropActions ? (
							<GenUiArtifactPropActions
								sessionId={artifact.source.sessionId}
								artifactId={artifact.id}
								component={artifact.component}
							/>
						) : null}
						{onTogglePin ? (
							<ArtifactAction
								tooltip={pinTooltip}
								label={pinTooltip}
								onClick={() =>
									onTogglePin(
										artifact.pin.placement === "inline"
											? PINNABLE_ARTIFACT_PLACEMENT_FALLBACK
											: (artifact.pin.placement ?? PINNABLE_ARTIFACT_PLACEMENT_FALLBACK),
									)
								}
								icon={artifact.pin.pinned ? PinOffIcon : PinIcon}
							/>
						) : null}
					</ArtifactActions>
				) : null}
			</ArtifactHeader>
			<ArtifactContent className="p-3">
				<GenUiBlock name={artifact.component} props={artifact.props} />
			</ArtifactContent>
		</Artifact>
	)
}
