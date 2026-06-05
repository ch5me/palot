import { useSetAtom } from "jotai"
import { PaletteIcon } from "lucide-react"
import { patchGenUiArtifactPropsAtom } from "../../atoms/genui-artifacts"

interface GenUiArtifactPropActionsProps {
	sessionId: string
	artifactId: string
	component: string
}

export function GenUiArtifactPropActions({
	sessionId,
	artifactId,
	component,
}: GenUiArtifactPropActionsProps) {
	const patchArtifactProps = useSetAtom(patchGenUiArtifactPropsAtom)

	if (component !== "dag-sparkline") {
		return null
	}

	return (
		<button
			type="button"
			onClick={() => {
				patchArtifactProps({
					sessionId,
					artifactId,
					propsPatch: {
						showLabels: true,
						animate: "flow",
					},
				})
			}}
			className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
		>
			<PaletteIcon className="size-3" aria-hidden="true" />
			Tweak
		</button>
	)
}
