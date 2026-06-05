/**
 * Brand wordmark for "elf" -- panning gradient fill via @ch5me/effects.
 * Sizing is controlled by the caller's className (e.g. h-5 w-auto).
 */

import { GradientBrandText } from "@ch5me/effects/text"

export function ElfWordmark({ className }: { className?: string }) {
	return (
		<GradientBrandText
			className={className}
			style={{
				fontFamily: '"IBM Plex Mono", monospace',
				fontWeight: 600,
				letterSpacing: "-0.08em",
				lineHeight: 1,
			}}
		>
			elf
		</GradientBrandText>
	)
}
