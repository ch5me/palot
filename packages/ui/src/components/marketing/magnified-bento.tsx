"use client"

import { durations, easings } from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import {
	BarChart3Icon,
	BotIcon,
	CloudIcon,
	CodeIcon,
	CpuIcon,
	DatabaseIcon,
	LinkIcon,
	LockIcon,
	NetworkIcon,
	RotateCcwIcon,
	SearchIcon,
	SettingsIcon,
	SmartphoneIcon,
	UsersIcon,
	ZapIcon,
} from "lucide-react"
import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react"
import type { ComponentProps, CSSProperties, ReactNode } from "react"
import { useRef } from "react"

/**
 * MagnifiedBento — a bento marketing card with three marquee rows of feature
 * chips and a draggable magnifying-glass lens. The glass circle reveals a
 * magnified, emphasized copy of whatever chips pass underneath it.
 *
 * Ported from uselayouts "Magnified Bento", re-expressed in CH5 design and
 * semantic motion tokens. Chip rows, copy, marquee speed, and the lens
 * artwork palette are all prop-driven.
 *
 * ```tsx
 * <MagnifiedBento
 *   title="Explore every capability"
 *   rows={[[{ id: "search", label: "Search", icon: SearchIcon }], ...]}
 * />
 * ```
 */

interface MagnifiedBentoChip {
	/** Stable identifier, used for marquee copy keys. */
	id: string
	label: string
	icon?: LucideIcon
}

/**
 * Decorative lens artwork palette (Figma-exported SVG gray ramp). Defaults to
 * the original art colors via CSS custom properties; override per theme.
 */
interface MagnifiedBentoLensPalette {
	/** Light rim highlight. */
	rim?: string
	/** Mid rim shade. */
	rimShade?: string
	/** Dark ring stroke around the glass. */
	rimStroke?: string
	/** Handle body. */
	handle?: string
	/** Handle highlight bevel. */
	handleShade?: string
	/** Translucent glass glare overlay. */
	glare?: string
}

interface MagnifiedBentoProps extends Omit<ComponentProps<"div">, "title"> {
	/** Heading under the marquee area. */
	title?: ReactNode
	/** Supporting copy under the heading. */
	description?: ReactNode
	/** Chip rows; each row marquees, alternating direction per row. */
	rows?: MagnifiedBentoChip[][]
	/** Rendered size (px) of the lens artwork. */
	lensSize?: number
	/** Seconds for one full marquee loop of a row. */
	marqueeDuration?: number
	lensPalette?: MagnifiedBentoLensPalette
}

const DEFAULT_ROWS: MagnifiedBentoChip[][] = [
	[
		{ id: "search", icon: SearchIcon, label: "Search" },
		{ id: "collaboration", icon: UsersIcon, label: "Collaboration" },
		{ id: "integrations", icon: NetworkIcon, label: "Integrations" },
		{ id: "automation", icon: BotIcon, label: "Automation" },
		{ id: "version-history", icon: RotateCcwIcon, label: "Version History" },
	],
	[
		{ id: "configuration", icon: SettingsIcon, label: "Configuration" },
		{ id: "compute", icon: CpuIcon, label: "Compute" },
		{ id: "developer-api", icon: CodeIcon, label: "Developer API" },
		{ id: "analytics", icon: BarChart3Icon, label: "Analytics" },
		{ id: "realtime", icon: ZapIcon, label: "Realtime" },
	],
	[
		{ id: "webhooks", icon: LinkIcon, label: "Webhooks" },
		{ id: "mobile", icon: SmartphoneIcon, label: "Mobile" },
		{ id: "cloud-sync", icon: CloudIcon, label: "Cloud Sync" },
		{ id: "storage", icon: DatabaseIcon, label: "Storage" },
		{ id: "security", icon: LockIcon, label: "Security" },
	],
]

/** Slow ambient drift: 25 ambient beats per marquee loop (source feel: 25s linear). */
const DEFAULT_MARQUEE_DURATION = durations.ambient * 25

/** Each row renders three copies of its chips so the -33.333% loop is seamless. */
const MARQUEE_COPIES = [0, 1, 2] as const

/**
 * Lens artwork geometry, as fractions of the rendered lens size. Derived from
 * the source art (92px lens → 30px glass radius, glass center 10px up-left of
 * the artwork center, 60px glare circle inset 6px).
 */
const GLASS_RADIUS_RATIO = 30 / 92
const GLASS_CENTER_OFFSET_RATIO = 10 / 92
const GLARE_SIZE_RATIO = 60 / 92
const GLARE_INSET_RATIO = 6 / 92

type LensPaletteStyle = CSSProperties & Record<`--magnified-bento-lens-${string}`, string>

function lensPaletteStyle(palette: MagnifiedBentoLensPalette | undefined): LensPaletteStyle {
	const style: LensPaletteStyle = {}
	if (palette?.rim) style["--magnified-bento-lens-rim"] = palette.rim
	if (palette?.rimShade) style["--magnified-bento-lens-rim-shade"] = palette.rimShade
	if (palette?.rimStroke) style["--magnified-bento-lens-rim-stroke"] = palette.rimStroke
	if (palette?.handle) style["--magnified-bento-lens-handle"] = palette.handle
	if (palette?.handleShade) style["--magnified-bento-lens-handle-shade"] = palette.handleShade
	if (palette?.glare) style["--magnified-bento-lens-glare"] = palette.glare
	return style
}

function MagnifiedBento({
	className,
	title = "Explore every capability",
	description = "Drag the lens across the moving wall of features to bring any capability into focus.",
	rows = DEFAULT_ROWS,
	lensSize = 92,
	marqueeDuration = DEFAULT_MARQUEE_DURATION,
	lensPalette,
	...props
}: MagnifiedBentoProps) {
	const reducedMotion = useReducedMotion()
	const containerRef = useRef<HTMLDivElement>(null)
	const lensX = useMotionValue(0)
	const lensY = useMotionValue(0)

	const glassRadius = lensSize * GLASS_RADIUS_RATIO
	const glassOffset = lensSize * GLASS_CENTER_OFFSET_RATIO

	// Both layers track the glass circle: the reveal layer is clipped TO it,
	// the base layer is masked AWAY from it. Mask colors are alpha-only.
	const clipPath = useMotionTemplate`circle(${glassRadius}px at calc(50% + ${lensX}px - ${glassOffset}px) calc(50% + ${lensY}px - ${glassOffset}px))`
	const inverseMask = useMotionTemplate`radial-gradient(circle ${glassRadius}px at calc(50% + ${lensX}px - ${glassOffset}px) calc(50% + ${lensY}px - ${glassOffset}px), transparent 100%, black 100%)`

	// Continuous ambient marquee; reduced motion stops the loop entirely.
	const marqueeAnimate = (rowIndex: number) =>
		reducedMotion ? undefined : { x: rowIndex % 2 === 0 ? ["0%", "-33.333%"] : ["-33.333%", "0%"] }
	const marqueeTransition = {
		duration: marqueeDuration,
		ease: easings.linear,
		repeat: Number.POSITIVE_INFINITY,
	}

	const renderRow = (row: MagnifiedBentoChip[], rowIndex: number, variant: "base" | "reveal") => (
		<motion.div
			key={`row-${variant}-${row.map((chip) => chip.id).join(".")}`}
			className="flex w-max gap-4"
			animate={marqueeAnimate(rowIndex)}
			transition={marqueeTransition}
		>
			{MARQUEE_COPIES.flatMap((copy) =>
				row.map((chip) => {
					const ChipIcon = chip.icon
					return variant === "base" ? (
						<div
							key={`${chip.id}-${copy}`}
							data-slot="magnified-bento-chip"
							className="flex w-fit items-center gap-2 whitespace-nowrap rounded-full border border-border/50 bg-background/50 p-2 px-3 text-muted-foreground text-xs backdrop-blur-sm"
						>
							{ChipIcon ? <ChipIcon className="size-3.5" aria-hidden /> : null}
							<span>{chip.label}</span>
						</div>
					) : (
						<div
							key={`${chip.id}-${copy}-reveal`}
							data-slot="magnified-bento-chip-magnified"
							className="ml-6 flex w-fit scale-125 items-center gap-2 whitespace-nowrap rounded-full border border-primary/20 bg-background p-2 px-3 text-foreground text-xs shadow-[var(--shadow-flat)]"
						>
							{ChipIcon ? <ChipIcon className="size-3.5 text-primary" aria-hidden /> : null}
							<span className="font-medium text-primary">{chip.label}</span>
						</div>
					)
				}),
			)}
		</motion.div>
	)

	return (
		<div
			data-slot="magnified-bento"
			className={cn("not-prose flex w-full items-center justify-center p-4 sm:p-6", className)}
			{...props}
		>
			<div
				data-slot="card"
				className="group relative w-full max-w-[420px] overflow-hidden rounded-3xl border bg-card p-1.5 text-card-foreground shadow-[var(--shadow-glassy)] transition-transform duration-[var(--duration-relaxed)] ease-[var(--ease-out)] hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:rounded-4xl sm:p-2"
			>
				<div
					ref={containerRef}
					data-slot="magnified-bento-stage"
					className="relative h-[200px] w-full overflow-hidden rounded-2xl bg-muted/30 sm:h-[240px] sm:rounded-3xl"
				>
					<div className="relative flex h-full w-full flex-col items-center justify-center">
						{/* Base layer: the glass circle is masked out from underneath the lens. */}
						<motion.div
							style={{ WebkitMaskImage: inverseMask, maskImage: inverseMask }}
							className="flex h-full w-full flex-col justify-center gap-4"
						>
							{rows.map((row, rowIndex) => renderRow(row, rowIndex, "base"))}
						</motion.div>

						{/* Reveal layer: a magnified emphasized copy, clipped to the glass circle. */}
						<motion.div
							aria-hidden
							className="pointer-events-none absolute inset-0 z-10 flex select-none flex-col justify-center gap-4"
							style={{ clipPath }}
						>
							{rows.map((row, rowIndex) => renderRow(row, rowIndex, "reveal"))}
						</motion.div>

						{/* Draggable lens. */}
						<motion.div
							data-slot="magnified-bento-lens"
							className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 z-40 cursor-grab drop-shadow-[var(--ff-shadow-drop)] active:cursor-grabbing"
							drag
							dragMomentum={false}
							dragConstraints={containerRef}
							style={{ x: lensX, y: lensY }}
						>
							<div className="relative" style={lensPaletteStyle(lensPalette)}>
								<MagnifyingLens size={lensSize} />
								<div
									className="pointer-events-none absolute rounded-full"
									style={{
										top: lensSize * GLARE_INSET_RATIO,
										left: lensSize * GLARE_INSET_RATIO,
										width: lensSize * GLARE_SIZE_RATIO,
										height: lensSize * GLARE_SIZE_RATIO,
										// Decorative glass glare; part of the lens artwork palette.
										background: "var(--magnified-bento-lens-glare, rgb(255 255 255 / 0.1))",
									}}
								/>
							</div>
						</motion.div>
					</div>

					{/* Edge fades so the marquee dissolves into the card surface. */}
					<div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-1/4 bg-linear-to-r from-card to-transparent" />
					<div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-1/4 bg-linear-to-l from-card to-transparent" />
				</div>

				<div data-slot="magnified-bento-content" className="p-4 px-4 pb-6 sm:p-6 sm:pb-8">
					<h3 className="font-medium text-foreground text-xl tracking-tight">{title}</h3>
					<p className="mt-2 text-muted-foreground text-sm leading-relaxed">{description}</p>
				</div>
			</div>
		</div>
	)
}

/**
 * Decorative magnifying-glass artwork (Figma export). The gray ramp lives in
 * CSS custom properties defaulting to the original colors, so themes can
 * re-tint the lens without touching the paths.
 */
function MagnifyingLens({ size = 92 }: { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 512 512"
			fill="none"
			role="img"
			aria-label="Magnifying glass"
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="M365.424 335.392L342.24 312.192L311.68 342.736L334.88 365.936L365.424 335.392Z"
				fill="var(--magnified-bento-lens-rim-shade, #B0BDC6)"
			/>
			<path
				d="M358.08 342.736L334.88 319.552L319.04 335.392L342.24 358.584L358.08 342.736Z"
				fill="var(--magnified-bento-lens-rim, #DFE9EF)"
			/>
			<path
				d="M352.368 321.808L342.752 312.192L312.208 342.752L321.824 352.36L352.368 321.808Z"
				fill="var(--magnified-bento-lens-rim-shade, #B0BDC6)"
			/>
			<path
				d="M332 332C260 404 142.4 404 69.6001 332C-2.3999 260 -2.3999 142.4 69.6001 69.6C141.6 -3.20003 259.2 -2.40002 332 69.6C404.8 142.4 404.8 260 332 332ZM315.2 87.2C252 24 150.4 24 88.0001 87.2C24.8001 150.4 24.8001 252 88.0001 314.4C151.2 377.6 252.8 377.6 315.2 314.4C377.6 252 377.6 150.4 315.2 87.2Z"
				fill="var(--magnified-bento-lens-rim, #DFE9EF)"
			/>
			<path
				d="M319.2 319.2C254.4 384 148.8 384 83.2001 319.2C18.4001 254.4 18.4001 148.8 83.2001 83.2C148 18.4 253.6 18.4 319.2 83.2C384 148.8 384 254.4 319.2 319.2ZM310.4 92C250.4 32 152 32 92.0001 92C32.0001 152 32.0001 250.4 92.0001 310.4C152 370.4 250.4 370.4 310.4 310.4C370.4 250.4 370.4 152 310.4 92Z"
				fill="var(--magnified-bento-lens-rim-stroke, #7A858C)"
			/>
			<path
				d="M484.104 428.784L373.8 318.472L318.36 373.912L428.672 484.216L484.104 428.784Z"
				fill="var(--magnified-bento-lens-handle, #333333)"
			/>
			<path
				d="M471.664 441.224L361.344 330.928L330.8 361.48L441.12 471.76L471.664 441.224Z"
				fill="var(--magnified-bento-lens-handle-shade, #575B5E)"
			/>
			<path
				d="M495.2 423.2C504 432 432.8 504 423.2 495.2L417.6 489.6C408.8 480.8 480 408.8 489.6 417.6L495.2 423.2Z"
				fill="var(--magnified-bento-lens-rim-shade, #B0BDC6)"
			/>
			<path
				d="M483.2 435.2C492 444 444.8 492 435.2 483.2L429.6 477.6C420.8 468.8 468 420.8 477.6 429.6L483.2 435.2Z"
				fill="var(--magnified-bento-lens-rim, #DFE9EF)"
			/>
		</svg>
	)
}

export type { MagnifiedBentoChip, MagnifiedBentoLensPalette, MagnifiedBentoProps }
export { MagnifiedBento, MagnifyingLens }
