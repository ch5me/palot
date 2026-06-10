"use client"

import { useControllableState } from "@ch5me/elf-ui/hooks/use-controllable-state"
import { reducedMotionTransition, semanticTransitions } from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { motion, useReducedMotion } from "motion/react"
import type { ComponentProps, KeyboardEvent } from "react"
import { useId } from "react"

/**
 * FolderInteraction — a decorative SVG folder that fans three document pages
 * out of its mouth when opened, while the glassy front flap hinges down.
 *
 * Ported from uselayouts "Folder Interaction", re-expressed in CH5 semantic
 * motion tokens. The artwork palette (a dark lavender folder with pale
 * lavender pages) is Figma-exported decorative art, so per the porting
 * contract its colors live in CSS custom properties (`--folder-interaction-*`)
 * defaulting to the original values — retheme via the `palette` prop or by
 * setting those variables in CSS.
 *
 * ```tsx
 * <FolderInteraction />
 * <FolderInteraction defaultOpen aria-label="Toggle project files" />
 * <FolderInteraction palette={{ pageFrom: "var(--ff-surface)" }} />
 * ```
 */

interface FolderInteractionPalette {
	/** Folder back/pocket fill. */
	back: string
	/** Inner glow (inset shadow color) of the folder pocket. */
	backGlow: string
	/** Front flap gradient start (top). */
	flapFrom: string
	/** Front flap gradient end (bottom). */
	flapTo: string
	/** Front flap stroke gradient start (top). */
	flapStrokeFrom: string
	/** Front flap stroke gradient end (bottom). */
	flapStrokeTo: string
	/** Page gradient start (top). */
	pageFrom: string
	/** Page gradient end (bottom). */
	pageTo: string
	/** Page text-line fill. */
	pageLine: string
}

/** Original uselayouts artwork colors (lavender-tinted dark folder, pale pages). */
const DEFAULT_PALETTE: FolderInteractionPalette = {
	back: "#18151B",
	backGlow: "rgba(79, 73, 85, 0.30)",
	flapFrom: "#2D2535",
	flapTo: "#2A2A2A",
	flapStrokeFrom: "#424242",
	flapStrokeTo: "#212121",
	pageFrom: "#E8E7F0",
	pageTo: "#DCDAE8",
	pageLine: "#CFCDE0",
}

interface FolderInteractionPagePose {
	closed: { rotate: number; x: number; y: number }
	open: { rotate: number; x: number; y: number }
	/** Elevated pages stack above their siblings and cast a heavier shadow. */
	elevated?: boolean
}

/** Default three-page fan: left and right tilt outward, center pops highest. */
const DEFAULT_PAGE_POSES: FolderInteractionPagePose[] = [
	{
		closed: { rotate: -3, x: -38, y: 2 },
		open: { rotate: -8, x: -70, y: -55 },
	},
	{
		closed: { rotate: 0, x: 0, y: 0 },
		open: { rotate: 1, x: 2, y: -75 },
		elevated: true,
	},
	{
		closed: { rotate: 3.5, x: 42, y: 1 },
		open: { rotate: 9, x: 75, y: -60 },
	},
]

interface FolderInteractionProps extends ComponentProps<"div"> {
	/** Controlled open state. */
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	/** Override the page fan poses (closed/open transform per page). */
	pages?: FolderInteractionPagePose[]
	/** Skeleton text rows drawn on each page. */
	pageLineRows?: number
	/** Override artwork colors; unset keys keep the original palette. */
	palette?: Partial<FolderInteractionPalette>
}

const FLAP_PATH =
	"M104.615 0.350494L33.1297 0.838776C32.7542 0.841362 32.3825 0.881463 32.032 0.918854C31.6754 0.956907 31.3392 0.992086 31.0057 0.992096H31.0047C30.6871 0.99235 30.3673 0.962051 30.0272 0.929596C29.6927 0.897686 29.3384 0.863802 28.9803 0.866119L13.2693 0.967682H13.2527L13.2352 0.969635C13.1239 0.981406 13.0121 0.986674 12.9002 0.986237H9.91388C8.33299 0.958599 6.76052 1.22345 5.27423 1.76651H5.27325C4.33579 2.11246 3.48761 2.66213 2.7879 3.37393L2.49689 3.68839L2.492 3.69424C1.62667 4.73882 1.00023 5.96217 0.656067 7.27725C0.653324 7.28773 0.654065 7.29886 0.652161 7.30948C0.3098 8.62705 0.257231 10.0048 0.499817 11.3446L12.2147 114.399L12.2156 114.411L12.2176 114.423C12.6046 116.568 13.7287 118.508 15.3934 119.902C17.058 121.297 19.1572 122.056 21.3231 122.049V122.05H215.379C217.76 122.02 220.064 121.192 221.926 119.698V119.697C223.657 118.384 224.857 116.485 225.305 114.35L225.307 114.339L235.914 53.3798L235.968 53.1093L235.97 53.0985L235.971 53.0888C236.134 51.8978 236.044 50.685 235.705 49.5321C235.307 48.1669 234.63 46.9005 233.717 45.8144L233.383 45.4296C232.58 44.5553 231.614 43.8449 230.539 43.3398C229.311 42.7628 227.971 42.4685 226.616 42.4774H146.746C144.063 42.4705 141.423 41.8004 139.056 40.5263C136.691 39.2522 134.671 37.4127 133.175 35.1689L113.548 5.05948L113.544 5.05362L113.539 5.04776C112.545 3.65165 111.238 2.51062 109.722 1.72061C108.266 0.886502 106.627 0.422235 104.952 0.365143V0.364166L104.633 0.350494H104.615Z"

function FolderInteraction({
	open,
	defaultOpen = false,
	onOpenChange,
	pages = DEFAULT_PAGE_POSES,
	pageLineRows = 8,
	palette,
	className,
	style,
	"aria-label": ariaLabel = "Toggle folder",
	...props
}: FolderInteractionProps) {
	const [isOpen, setIsOpen] = useControllableState({
		prop: open,
		defaultProp: defaultOpen,
		onChange: onOpenChange,
	})
	const reducedMotion = useReducedMotion()
	const uid = useId()
	const flapFillId = `${uid}-flap-fill`
	const flapStrokeId = `${uid}-flap-stroke`
	const flapBlurClipId = `${uid}-flap-blur-clip`

	const resolvedPalette = { ...DEFAULT_PALETTE, ...palette }
	const paletteVars: Record<`--${string}`, string> = {
		"--folder-interaction-back": resolvedPalette.back,
		"--folder-interaction-back-glow": resolvedPalette.backGlow,
		"--folder-interaction-flap-from": resolvedPalette.flapFrom,
		"--folder-interaction-flap-to": resolvedPalette.flapTo,
		"--folder-interaction-flap-stroke-from": resolvedPalette.flapStrokeFrom,
		"--folder-interaction-flap-stroke-to": resolvedPalette.flapStrokeTo,
		"--folder-interaction-page-from": resolvedPalette.pageFrom,
		"--folder-interaction-page-to": resolvedPalette.pageTo,
		"--folder-interaction-page-line": resolvedPalette.pageLine,
	}

	// Pages fan out of the folder mouth — a content reveal (source springs
	// clustered around stiffness 160-190 / damping 21-24, nearest semantic
	// role+values = `reveal`). The flap hinge is a panel motion.
	const pageTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.reveal
	const flapTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.panel

	const toggle = () => setIsOpen((current) => !current)
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			toggle()
		}
	}

	return (
		<div
			data-slot="folder-interaction"
			data-open={isOpen ? "" : undefined}
			role="button"
			tabIndex={0}
			aria-expanded={isOpen}
			aria-label={ariaLabel}
			onClick={toggle}
			onKeyDown={handleKeyDown}
			className={cn(
				"relative h-52 w-80 cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
				className,
			)}
			style={{ ...paletteVars, ...style }}
			{...props}
		>
			<div
				data-slot="folder-interaction-back"
				className="relative mx-auto flex h-full w-[87.5%] items-center justify-center rounded-md"
				style={{
					background: "var(--folder-interaction-back)",
					boxShadow: "0px 0px 15.7px 16px var(--folder-interaction-back-glow) inset",
				}}
			>
				{pages.map((page, index) => (
					<motion.div
						key={`page-${index}`}
						data-slot="folder-interaction-page"
						initial={false}
						animate={isOpen ? page.open : page.closed}
						transition={pageTransition}
						className={cn(
							"absolute top-2 h-fit w-32 rounded-xl",
							page.elevated
								? "z-20 shadow-[var(--ff-shadow-lg)]"
								: "z-10 shadow-[var(--ff-shadow-md)]",
						)}
					>
						<FolderInteractionPageArt lineRows={pageLineRows} />
					</motion.div>
				))}
			</div>

			<motion.div
				data-slot="folder-interaction-flap"
				initial={false}
				animate={{ rotateX: isOpen ? -40 : 0 }}
				transition={flapTransition}
				className="absolute -bottom-px -left-px -right-px z-20 flex h-44 origin-bottom items-center justify-center overflow-visible rounded-3xl"
			>
				<svg
					aria-hidden="true"
					className="size-full overflow-visible"
					viewBox="0 0 235 121"
					fill="none"
					preserveAspectRatio="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<foreignObject x="-13" y="-13" width="262.4" height="148.4">
						<div
							style={{
								backdropFilter: "blur(var(--blur-sm))",
								clipPath: `url(#${flapBlurClipId})`,
								height: "100%",
								width: "100%",
							}}
						/>
					</foreignObject>
					<path
						d={FLAP_PATH}
						fill={`url(#${flapFillId})`}
						fillOpacity="0.3"
						stroke={`url(#${flapStrokeId})`}
						strokeWidth="0.7"
					/>
					<defs>
						<clipPath id={flapBlurClipId} transform="translate(13 13)">
							<path d={FLAP_PATH} />
						</clipPath>
						<linearGradient
							id={flapFillId}
							x1="114.7"
							y1="0.700104"
							x2="114.7"
							y2="121.7"
							gradientUnits="userSpaceOnUse"
						>
							<stop style={{ stopColor: "var(--folder-interaction-flap-from)" }} />
							<stop offset="1" style={{ stopColor: "var(--folder-interaction-flap-to)" }} />
						</linearGradient>
						<linearGradient
							id={flapStrokeId}
							x1="114.7"
							y1="0.700104"
							x2="114.7"
							y2="121.7"
							gradientUnits="userSpaceOnUse"
						>
							<stop
								stopOpacity="0.04"
								style={{ stopColor: "var(--folder-interaction-flap-stroke-from)" }}
							/>
							<stop
								offset="1"
								stopOpacity="0.3"
								style={{ stopColor: "var(--folder-interaction-flap-stroke-to)" }}
							/>
						</linearGradient>
					</defs>
				</svg>
			</motion.div>
		</div>
	)
}

/** Skeleton document page: a title bar plus two-column text-line rows. */
function FolderInteractionPageArt({ lineRows }: { lineRows: number }) {
	const lineStyle = { background: "var(--folder-interaction-page-line)" }

	return (
		<div
			data-slot="folder-interaction-page-art"
			className="size-full rounded-xl p-3 shadow-[var(--ff-shadow-lg)] sm:p-4"
			style={{
				background:
					"linear-gradient(to bottom, var(--folder-interaction-page-from), var(--folder-interaction-page-to))",
			}}
		>
			<div className="flex flex-col gap-1.5 sm:gap-2">
				<div className="h-1 w-full rounded-full sm:h-1.5" style={lineStyle} />
				{Array.from({ length: lineRows }).map((_, rowIndex) => (
					<div key={`row-${rowIndex}`} className="flex gap-1.5 sm:gap-2">
						<div className="h-1 flex-1 rounded-full sm:h-1.5" style={lineStyle} />
						<div className="h-1 flex-1 rounded-full sm:h-1.5" style={lineStyle} />
					</div>
				))}
			</div>
		</div>
	)
}

export type { FolderInteractionPagePose, FolderInteractionPalette, FolderInteractionProps }
export { FolderInteraction }
