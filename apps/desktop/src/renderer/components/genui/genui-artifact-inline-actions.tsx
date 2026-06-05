import { useSetAtom } from "jotai"
import { PinIcon } from "lucide-react"
import { pinGenUiArtifactAtom, unpinAllGenUiArtifactsForPlacementAtom } from "../../atoms/genui-artifacts"

interface GenUiArtifactInlineActionsProps {
	sessionId: string
	artifactId: string
}

export function GenUiArtifactInlineActions({ sessionId, artifactId }: GenUiArtifactInlineActionsProps) {
	const pinArtifact = useSetAtom(pinGenUiArtifactAtom)
	const unpinAllForPlacement = useSetAtom(unpinAllGenUiArtifactsForPlacementAtom)

	return (
		<div className="mb-1 flex justify-end">
			<button
				type="button"
				onClick={() => {
					unpinAllForPlacement({ sessionId, placement: "chat-inline-right" })
					pinArtifact({
						sessionId,
						artifactId,
						placement: "chat-inline-right",
						pinned: true,
					})
				}}
				className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
			>
				<PinIcon className="size-3" aria-hidden="true" />
				Pin
			</button>
		</div>
	)
}
