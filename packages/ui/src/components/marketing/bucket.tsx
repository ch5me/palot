"use client"

import { useIsMobile } from "@ch5me/elf-ui/hooks/use-mobile"
import { durations, easings, reducedMotionTransition } from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { ShieldCheck, Sparkles, Users, Zap } from "lucide-react"
import type { Transition } from "motion/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { ComponentProps, CSSProperties, ReactNode } from "react"
import { useEffect, useId, useState } from "react"

/**
 * Bucket — a marketing hero where feature chips drop one-by-one into a
 * glassy, Figma-exported SVG bucket.
 *
 * Ported from uselayouts "Bucket". The decorative SVG art is preserved
 * verbatim (geometry, blurs, layered shadows), but its palette is lifted into
 * CSS custom properties with the original colors as defaults so the art can
 * be rethemed and stays dark-mode safe:
 *
 * - `--bucket-glass`          glass panel fill + inner highlight (default `#ffffff`)
 * - `--bucket-shadow-ambient` wide ambient drop shadow (default `#000000`)
 * - `--bucket-shadow-tint`    tinted contact shadows (default `#0b2067`)
 *
 * The bucket's front face uses the semantic `fill-card` token and the chip is
 * a token-styled card, so the non-art surfaces theme automatically. Chip
 * content is supplied via the `chips` prop (lucide icons); auto-cycling stops
 * entirely under reduced motion (chips render statically).
 *
 * ```tsx
 * <Bucket
 *   chips={[
 *     { id: "fast", title: "Fast and fluid", description: "Smooth at every step", icon: <Zap /> },
 *   ]}
 * />
 * ```
 */

const VIEWBOX = "0 0 655 352"
/** Backdrop blur behind each glass panel (from the source art). */
const GLASS_BACKDROP_BLUR = "blur(11.03px)"
/** Heavy backdrop blur inside the bucket well (from the source art). */
const WELL_BACKDROP_BLUR = "blur(60.03px)"

/** Identity alpha matrix used by the Figma export to isolate SourceAlpha. */
const SOURCE_ALPHA_MATRIX = "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"

const glassFillStyle: CSSProperties = { fill: "var(--bucket-glass, #ffffff)" }
const glassFloodStyle: CSSProperties = { floodColor: "var(--bucket-glass, #ffffff)" }
const ambientFloodStyle: CSSProperties = { floodColor: "var(--bucket-shadow-ambient, #000000)" }
const tintFloodStyle: CSSProperties = { floodColor: "var(--bucket-shadow-tint, #0b2067)" }

// Figma-exported bucket geometry (decorative art — keep verbatim).
const PATH_SCOOP_RIGHT =
	"M535.59 78.7427L487.973 42.8776L558.738 13.9516C562.902 12.2494 564.984 11.3984 567.143 11.5597C569.301 11.7211 571.233 12.8723 575.098 15.1747L590.22 24.1832C603.923 32.347 610.775 36.4289 610.372 42.0779C609.97 47.7269 602.609 50.7964 587.887 56.9354L535.59 78.7427Z"
const PATH_SCOOP_LEFT =
	"M123.116 79.1145L171.548 42.8776L97.2715 12.5164C94.8305 11.5186 93.61 11.0197 92.3446 11.1143C91.0793 11.2089 89.9465 11.8837 87.681 13.2334L56.155 32.0149C48.1832 36.7641 44.1973 39.1386 44.4205 42.4378C44.6438 45.737 48.9132 47.553 57.4522 51.1849L123.116 79.1145Z"
const PATH_TOP_BAR =
	"M487.973 42.8774L171.548 42.8775L123.116 79.1144L535.59 78.7424L487.973 42.8774Z"
const PATH_FLAP_LEFT = "M171.548 78.9088V42.8774L123.116 79.1144L171.548 78.9088Z"
const PATH_FLAP_RIGHT = "M487.973 78.9088V42.8774L536.404 79.1144L487.973 78.9088Z"
const PATH_FRONT_LIP =
	"M74.6011 164.033L123.116 79.1138L535.59 78.7419L581.532 164.469C588.006 176.55 591.243 182.59 588.568 187.06C585.892 191.529 579.039 191.529 565.333 191.529H90.5591C76.4759 191.529 69.4343 191.529 66.7781 186.953C64.1219 182.376 67.615 176.262 74.6011 164.033Z"
const PATH_BOX =
	"M512.766 79.1595L147.766 79.1624C136.453 79.1625 130.796 79.1626 127.281 82.6773C123.766 86.192 123.766 91.8488 123.766 103.162V327.159C123.766 338.473 123.766 344.13 127.281 347.645C130.796 351.159 136.453 351.159 147.766 351.159H512.766C524.08 351.159 529.737 351.159 533.252 347.645C536.766 344.13 536.766 338.473 536.766 327.159V103.159C536.766 91.8457 536.766 86.1888 533.252 82.6741C529.737 79.1594 524.08 79.1594 512.766 79.1595Z"

type DropShadowLayerProps = {
	dy: number
	blur: number
	floodStyle: CSSProperties
	floodOpacity: number
	/** Result of the previous layer to blend over. */
	in2: string
	/** Unique (per filter) result name for this layer's shadow silhouette. */
	shapeResult: string
	/** Result name this layer publishes for the next one. */
	result: string
}

/**
 * One Figma "drop shadow" filter layer, with the colorize step expressed as a
 * `feFlood` so the shadow color can resolve from a CSS variable (the export's
 * `feColorMatrix` colorization cannot).
 */
function BucketDropShadowLayer({
	dy,
	blur,
	floodStyle,
	floodOpacity,
	in2,
	shapeResult,
	result,
}: DropShadowLayerProps) {
	return (
		<>
			<feColorMatrix
				in="SourceAlpha"
				type="matrix"
				values={SOURCE_ALPHA_MATRIX}
				result="hardAlpha"
			/>
			<feOffset dy={dy} />
			<feGaussianBlur stdDeviation={blur} />
			<feComposite in2="hardAlpha" operator="out" result={shapeResult} />
			<feFlood style={floodStyle} floodOpacity={floodOpacity} />
			<feComposite in2={shapeResult} operator="in" />
			<feBlend mode="normal" in2={in2} result={result} />
		</>
	)
}

/** The Figma inner-highlight layer (soft glass glow along the top edge). */
function BucketInnerHighlightLayer({ in2, result }: { in2: string; result: string }) {
	return (
		<>
			<feColorMatrix
				in="SourceAlpha"
				type="matrix"
				values={SOURCE_ALPHA_MATRIX}
				result="hardAlpha"
			/>
			<feOffset dy={5.51362} />
			<feGaussianBlur stdDeviation={1.83787} />
			<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" result="innerShape" />
			<feFlood style={glassFloodStyle} floodOpacity={0.36} />
			<feComposite in2="innerShape" operator="in" />
			<feBlend mode="normal" in2={in2} result={result} />
		</>
	)
}

type GlassShadowFilterProps = {
	id: string
	x: number
	y: number
	width: number
	height: number
}

/**
 * The export's repeated "dddi" filter (three drop shadows + inner highlight),
 * deduplicated; only the filter region differs per glass piece.
 */
function BucketGlassShadowFilter({ id, x, y, width, height }: GlassShadowFilterProps) {
	return (
		<filter
			id={id}
			x={x}
			y={y}
			width={width}
			height={height}
			filterUnits="userSpaceOnUse"
			colorInterpolationFilters="sRGB"
		>
			<feFlood floodOpacity="0" result="BackgroundImageFix" />
			<BucketDropShadowLayer
				dy={33.3087}
				blur={22.2058}
				floodStyle={ambientFloodStyle}
				floodOpacity={0.03}
				in2="BackgroundImageFix"
				shapeResult="dropShape1"
				result="dropShadow1"
			/>
			<BucketDropShadowLayer
				dy={1.27808}
				blur={1.27808}
				floodStyle={tintFloodStyle}
				floodOpacity={0.14}
				in2="dropShadow1"
				shapeResult="dropShape2"
				result="dropShadow2"
			/>
			<BucketDropShadowLayer
				dy={8.94656}
				blur={4.47328}
				floodStyle={tintFloodStyle}
				floodOpacity={0.05}
				in2="dropShadow2"
				shapeResult="dropShape3"
				result="dropShadow3"
			/>
			<feBlend mode="normal" in="SourceGraphic" in2="dropShadow3" result="shape" />
			<BucketInnerHighlightLayer in2="shape" result="innerHighlight" />
		</filter>
	)
}

type GlassPanelProps = {
	path: string
	filterId: string
	clipId?: string
	fillOpacity: number
	/** Filter/foreignObject region (matches the export's filter region). */
	x: number
	y: number
	width: number
	height: number
}

/**
 * One glass piece of the bucket: an optional backdrop-blur layer clipped to
 * the piece, plus the filtered glass path itself.
 */
function BucketGlassPanel({
	path,
	filterId,
	clipId,
	fillOpacity,
	x,
	y,
	width,
	height,
}: GlassPanelProps) {
	return (
		<>
			{clipId ? (
				<foreignObject x={x} y={y} width={width} height={height}>
					<div
						style={{
							backdropFilter: GLASS_BACKDROP_BLUR,
							WebkitBackdropFilter: GLASS_BACKDROP_BLUR,
							clipPath: `url(#${clipId})`,
							height: "100%",
							width: "100%",
						}}
					/>
				</foreignObject>
			) : null}
			<g filter={`url(#${filterId})`}>
				<path
					d={path}
					style={glassFillStyle}
					fillOpacity={fillOpacity}
					shapeRendering="crispEdges"
				/>
			</g>
		</>
	)
}

type BucketChip = {
	id: string | number
	title: ReactNode
	description?: ReactNode
	/** Leading icon (lucide-react icon element). */
	icon?: ReactNode
}

const defaultChips: BucketChip[] = [
	{
		id: "secure",
		title: "Secure by default",
		description: "Best practices built in",
		icon: <ShieldCheck />,
	},
	{
		id: "fast",
		title: "Fast and fluid",
		description: "Smooth at every step",
		icon: <Zap />,
	},
	{
		id: "everyone",
		title: "Made for everyone",
		description: "Accessible out of the box",
		icon: <Users />,
	},
	{
		id: "details",
		title: "Thoughtful details",
		description: "Polished, high-end feel",
		icon: <Sparkles />,
	},
]

/**
 * Chip drop-in: source used a 0.5s ease-in-out-quad tween — mapped to the
 * `showcase` duration token + `standard` easing.
 */
const chipEnterTransition: Transition = {
	duration: durations.showcase,
	ease: easings.standard,
}

/**
 * Chip fall into the bucket: source used a 0.8s tween — derived as 2x the
 * `slow` duration token to preserve the unhurried drop.
 */
const chipExitTransition: Transition = {
	duration: durations.slow * 2,
	ease: easings.standard,
}

type BucketProps = Omit<ComponentProps<"div">, "children"> & {
	/** Chips cycled into the bucket. Defaults to a generic feature set. */
	chips?: BucketChip[]
	/** Milliseconds each chip lingers before dropping into the bucket. */
	cycleInterval?: number
	/** Pause the auto-cycling (also paused automatically under reduced motion). */
	paused?: boolean
}

function Bucket({
	className,
	style,
	chips = defaultChips,
	cycleInterval = 2000,
	paused = false,
	...props
}: BucketProps) {
	const [items, setItems] = useState(chips)
	const isMobile = useIsMobile()
	const reducedMotion = useReducedMotion() ?? false

	// Sanitized for safe use inside url(#...) filter/clip references.
	const uid = useId().replace(/[^a-zA-Z0-9-]/g, "")
	const filterBoxInnerId = `${uid}-filter-box-inner`
	const filterScoopRightId = `${uid}-filter-scoop-right`
	const filterScoopLeftId = `${uid}-filter-scoop-left`
	const filterTopBarId = `${uid}-filter-top-bar`
	const filterFlapLeftId = `${uid}-filter-flap-left`
	const filterFlapRightId = `${uid}-filter-flap-right`
	const filterFrontLipId = `${uid}-filter-front-lip`
	const clipScoopRightId = `${uid}-clip-scoop-right`
	const clipScoopLeftId = `${uid}-clip-scoop-left`
	const clipTopBarId = `${uid}-clip-top-bar`
	const clipFlapLeftId = `${uid}-clip-flap-left`
	const clipWellId = `${uid}-clip-well`
	const gradientTopBarId = `${uid}-gradient-top-bar`

	useEffect(() => {
		setItems(chips)
	}, [chips])

	// Ambient marketing loop: fully stopped under reduced motion (policy:
	// reduced = instant/static, infinite loops must stop).
	useEffect(() => {
		if (paused || reducedMotion || chips.length <= 1) {
			return
		}
		const interval = setInterval(() => {
			setItems((prev) => {
				const [first, ...rest] = prev
				return first ? [...rest, first] : prev
			})
		}, cycleInterval)
		return () => clearInterval(interval)
	}, [paused, reducedMotion, cycleInterval, chips.length])

	const activeChip = items[0]

	return (
		<div
			data-slot="bucket"
			className={cn("relative isolate w-full max-w-[655px]", className)}
			style={{ aspectRatio: "655/352", ...style }}
			{...props}
		>
			{/* Back layer: glass scoops, top bar and side flaps. */}
			<svg
				width="100%"
				height="100%"
				viewBox={VIEWBOX}
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="absolute inset-0 z-0"
				aria-hidden="true"
			>
				<BucketGlassPanel
					path={PATH_SCOOP_RIGHT}
					filterId={filterScoopRightId}
					clipId={clipScoopRightId}
					fillOpacity={0.42}
					x={443.561}
					y={-10.5141}
					width={211.24}
					height={166.977}
				/>
				<BucketGlassPanel
					path={PATH_SCOOP_LEFT}
					filterId={filterScoopLeftId}
					clipId={clipScoopLeftId}
					fillOpacity={0.42}
					x={0}
					y={-10.9516}
					width={215.96}
					height={167.786}
				/>
				{/* Top bar uses a glass gradient instead of a flat fill. */}
				<foreignObject x={78.7048} y={20.823} width={501.297} height={136.012}>
					<div
						style={{
							backdropFilter: GLASS_BACKDROP_BLUR,
							WebkitBackdropFilter: GLASS_BACKDROP_BLUR,
							clipPath: `url(#${clipTopBarId})`,
							height: "100%",
							width: "100%",
						}}
					/>
				</foreignObject>
				<g filter={`url(#${filterTopBarId})`}>
					<path
						d={PATH_TOP_BAR}
						fill={`url(#${gradientTopBarId})`}
						fillOpacity={0.72}
						shapeRendering="crispEdges"
					/>
				</g>
				<BucketGlassPanel
					path={PATH_FLAP_LEFT}
					filterId={filterFlapLeftId}
					clipId={clipFlapLeftId}
					fillOpacity={0.32}
					x={78.7048}
					y={20.823}
					width={137.255}
					height={136.012}
				/>
				<BucketGlassPanel
					path={PATH_FLAP_RIGHT}
					filterId={filterFlapRightId}
					fillOpacity={0.32}
					x={443.561}
					y={20.823}
					width={137.255}
					height={136.012}
				/>
				<defs>
					<filter
						id={filterBoxInnerId}
						x={123.766}
						y={79.1595}
						width={413}
						height={275.676}
						filterUnits="userSpaceOnUse"
						colorInterpolationFilters="sRGB"
					>
						<feFlood floodOpacity="0" result="BackgroundImageFix" />
						<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
						<BucketInnerHighlightLayer in2="shape" result="innerHighlight" />
					</filter>
					<BucketGlassShadowFilter
						id={filterScoopRightId}
						x={443.561}
						y={-10.5141}
						width={211.24}
						height={166.977}
					/>
					<BucketGlassShadowFilter
						id={filterScoopLeftId}
						x={0}
						y={-10.9516}
						width={215.96}
						height={167.786}
					/>
					<BucketGlassShadowFilter
						id={filterTopBarId}
						x={78.7048}
						y={20.823}
						width={501.297}
						height={136.012}
					/>
					<BucketGlassShadowFilter
						id={filterFlapLeftId}
						x={78.7048}
						y={20.823}
						width={137.255}
						height={136.012}
					/>
					<BucketGlassShadowFilter
						id={filterFlapRightId}
						x={443.561}
						y={20.823}
						width={137.255}
						height={136.012}
					/>
					<BucketGlassShadowFilter
						id={filterFrontLipId}
						x={21.477}
						y={56.6875}
						width={612.444}
						height={212.562}
					/>
					<clipPath id={clipScoopRightId} transform="translate(-443.561 10.5141)">
						<path d={PATH_SCOOP_RIGHT} />
					</clipPath>
					<clipPath id={clipScoopLeftId} transform="translate(0 10.9516)">
						<path d={PATH_SCOOP_LEFT} />
					</clipPath>
					<clipPath id={clipTopBarId} transform="translate(-78.7048 -20.823)">
						<path d={PATH_TOP_BAR} />
					</clipPath>
					<clipPath id={clipFlapLeftId} transform="translate(-78.7048 -20.823)">
						<path d={PATH_FLAP_LEFT} />
					</clipPath>
					<clipPath id={clipWellId}>
						<rect x={123.766} y={0} width={413} height={352} />
					</clipPath>
					<linearGradient
						id={gradientTopBarId}
						x1={329.353}
						y1={42.8774}
						x2={329.353}
						y2={79.1144}
						gradientUnits="userSpaceOnUse"
					>
						<stop style={{ stopColor: "var(--bucket-glass, #ffffff)" }} stopOpacity={0.4} />
						<stop
							offset={1}
							style={{ stopColor: "var(--bucket-glass, #ffffff)" }}
							stopOpacity={0.2}
						/>
					</linearGradient>
				</defs>
			</svg>

			{/* Middle layer: the chip dropping toward the bucket. */}
			<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
				<div
					className="relative flex h-full w-full items-center justify-center"
					style={{ paddingBottom: "65%" }}
				>
					<AnimatePresence mode="popLayout">
						{activeChip ? (
							<motion.div
								key={activeChip.id}
								data-slot="bucket-chip"
								initial={
									reducedMotion ? false : { y: isMobile ? -70 : -100, opacity: 0, scale: 0.8 }
								}
								animate={{ y: 0, opacity: 1, scale: isMobile || reducedMotion ? 1 : 1.25 }}
								exit={{
									y: isMobile ? 100 : 130,
									scale: 0.8,
									transition: reducedMotion ? reducedMotionTransition : chipExitTransition,
								}}
								transition={reducedMotion ? reducedMotionTransition : chipEnterTransition}
								className="bg-card text-card-foreground pointer-events-auto absolute z-10 flex w-[240px] origin-bottom items-center gap-2 rounded-full border p-2 shadow-[var(--ff-shadow-sm)]"
							>
								{activeChip.icon ? (
									<span
										aria-hidden="true"
										className="bg-muted-foreground/10 text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5 [&_svg]:shrink-0"
									>
										{activeChip.icon}
									</span>
								) : null}
								<span className="flex min-w-0 flex-col gap-0.5">
									<span className="text-foreground truncate text-sm leading-none font-medium">
										{activeChip.title}
									</span>
									{activeChip.description ? (
										<span className="text-muted-foreground truncate text-xs">
											{activeChip.description}
										</span>
									) : null}
								</span>
							</motion.div>
						) : null}
					</AnimatePresence>
				</div>
			</div>

			{/* Front layer: bucket box + blurred front lip the chip falls behind. */}
			<svg
				width="100%"
				height="100%"
				viewBox={VIEWBOX}
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
				style={{ transform: "translate3d(0, 0, 0)" }}
				aria-hidden="true"
			>
				<g filter={`url(#${filterBoxInnerId})`}>
					<path d={PATH_BOX} className="fill-card" />
				</g>
				<g clipPath={`url(#${clipWellId})`}>
					<foreignObject x={0} y={0} width={655} height={352}>
						<div
							style={{
								backdropFilter: WELL_BACKDROP_BLUR,
								WebkitBackdropFilter: WELL_BACKDROP_BLUR,
								height: "100%",
								width: "100%",
								background: "color-mix(in srgb, var(--bucket-glass, #ffffff) 1%, transparent)",
								clipPath: `path('${PATH_FRONT_LIP}')`,
							}}
						/>
					</foreignObject>
				</g>
				<g filter={`url(#${filterFrontLipId})`}>
					<path
						d={PATH_FRONT_LIP}
						style={glassFillStyle}
						fillOpacity={0.42}
						shapeRendering="crispEdges"
					/>
				</g>
			</svg>
		</div>
	)
}

export type { BucketChip, BucketProps }
export { Bucket, defaultChips as defaultBucketChips }
