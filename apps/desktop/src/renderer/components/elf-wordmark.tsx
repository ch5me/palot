/**
 * Inline SVG wordmark for "elf" -- renders at currentColor, no font dependency.
 *
 * The viewBox is cropped to the cap-height-to-baseline range (y 257..333) so that
 * the SVG's center-line matches the visual center of adjacent text. The "p" descender
 * overflows below and is shown via overflow-visible / overflow:visible.
 */
export function ElfWordmark({ className }: { className?: string }) {
	return (
		<div className={className} aria-hidden="true">
			<div
				style={{
					fontFamily: '"IBM Plex Mono", monospace',
					fontWeight: 600,
					letterSpacing: "-0.08em",
					lineHeight: 1,
				}}
			>
				elf
			</div>
		</div>
	)
}
