import { SwarmScene } from "@ch5me/effects/particles"
import { ElfWordmark } from "./elf-wordmark"

interface ElfHeroProps {
	className?: string
}

export function ElfHero({ className }: ElfHeroProps) {
	return (
		<SwarmScene
			className={className}
			style={{ width: 280, height: 140, display: "flex" }}
			curlStrength={1.3}
			noiseScale={0.8}
			speed={2.2}
			pointSize={9}
			opacity={0.7}
			colorCore="#fb923c"
			colorEdge="#8b5cf6"
			cameraDistance={4}
		>
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
				<ElfWordmark className="h-20 w-auto text-6xl text-foreground" />
			</div>
		</SwarmScene>
	)
}
