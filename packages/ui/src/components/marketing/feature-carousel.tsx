"use client"

import { useControllableState } from "@ch5me/elf-ui/hooks/use-controllable-state"
import {
	reducedMotionTransition,
	semanticTransitions,
	springs,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { ComponentProps, ReactNode } from "react"
import { useCallback, useEffect, useState } from "react"

/**
 * FeatureCarousel — a marketing feature showcase pairing a vertical wheel of
 * feature chips on a primary-colored rail with a stacked image-card deck that
 * rotates in sync. Auto-plays through the features (pausing on hover) and
 * supports direct selection by clicking a chip.
 *
 * Ported from uselayouts "Feature Carousel", re-expressed in CH5 semantic
 * motion tokens and design-system tokens (the brand-blue accent maps to the
 * `primary` token pair).
 *
 * ```tsx
 * <FeatureCarousel
 *   statusLabel="Live session"
 *   items={[
 *     {
 *       id: "analytics",
 *       label: "Real-time analytics",
 *       description: "Insights at your fingertips, updated in real-time.",
 *       image: "/features/analytics.jpg",
 *       icon: ChartSplineIcon,
 *     },
 *   ]}
 * />
 * ```
 */

/** Vertical rhythm (px) of one chip row in the rail wheel. */
const RAIL_ITEM_HEIGHT = 64

/** Wraps `v` into the half-open range [min, max) — circular wheel distance. */
const wrap = (min: number, max: number, v: number) => {
	const rangeSize = max - min
	return ((((v - min) % rangeSize) + rangeSize) % rangeSize) + min
}

type CardStatus = "active" | "prev" | "next" | "hidden"

interface FeatureCarouselItem {
	/** Stable identifier for this feature. */
	id: string
	/** Short feature name shown in the rail chip and the card badge. */
	label: string
	/** Supporting copy shown over the active card. */
	description: ReactNode
	/** Image source for this feature's card. */
	image: string
	/** Alt text for the card image. Defaults to `label`. */
	imageAlt?: string
	/** Icon rendered inside the rail chip. */
	icon?: LucideIcon
}

interface FeatureCarouselProps extends Omit<ComponentProps<"div">, "children"> {
	items: FeatureCarouselItem[]
	/** Controlled active item index. */
	index?: number
	/** Uncontrolled initial active item index. */
	defaultIndex?: number
	onIndexChange?: (index: number) => void
	/**
	 * Milliseconds between auto-advances; `0` disables auto-play. Auto-play
	 * pauses while the rail is hovered and is fully disabled when the user
	 * prefers reduced motion.
	 */
	autoPlayInterval?: number
	/**
	 * Optional status indicator (e.g. "Live session") shown in the corner of
	 * the active card. Hidden when omitted.
	 */
	statusLabel?: ReactNode
	/** Extra classes for the chip rail column. */
	railClassName?: string
	/** Extra classes for the card stage column. */
	stageClassName?: string
}

function FeatureCarousel({
	className,
	items,
	index: indexProp,
	defaultIndex = 0,
	onIndexChange,
	autoPlayInterval = 3000,
	statusLabel,
	railClassName,
	stageClassName,
	...props
}: FeatureCarouselProps) {
	const reducedMotion = useReducedMotion()
	const [activeIndex, setActiveIndex] = useControllableState({
		prop: indexProp,
		defaultProp: defaultIndex,
		onChange: onIndexChange,
	})
	const [isPaused, setIsPaused] = useState(false)

	const itemCount = items.length

	// Reduced motion must stop the ambient auto-advance loop entirely.
	const autoPlayEnabled = autoPlayInterval > 0 && itemCount > 1 && !reducedMotion

	const goNext = useCallback(() => {
		setActiveIndex((current) => (current + 1) % itemCount)
	}, [setActiveIndex, itemCount])

	useEffect(() => {
		if (!autoPlayEnabled || isPaused) return
		const interval = setInterval(goNext, autoPlayInterval)
		return () => clearInterval(interval)
	}, [autoPlayEnabled, isPaused, autoPlayInterval, goNext])

	// Rail wheel drift: source used a soft 90/22/1 spring — the `lazy` spring
	// token ("slow drifts") preserves that unhurried wheel feel.
	const railTransition = reducedMotion ? reducedMotionTransition : springs.lazy
	// Card swap is a panel slide by role; `panel` (240/22/0.78) matches the
	// source's 260/25/0.8 feel.
	const cardTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.panel

	const getCardStatus = (index: number): CardStatus => {
		const wrapped = wrap(-(itemCount / 2), itemCount / 2, index - activeIndex)
		if (wrapped === 0) return "active"
		if (wrapped === -1) return "prev"
		if (wrapped === 1) return "next"
		return "hidden"
	}

	if (itemCount === 0) return null

	return (
		<div
			data-slot="feature-carousel"
			className={cn("mx-auto w-full max-w-7xl md:p-8", className)}
			{...props}
		>
			<div className="relative flex min-h-[600px] flex-col overflow-hidden rounded-4xl border border-border/40 lg:aspect-video lg:flex-row">
				<div
					data-slot="feature-carousel-rail"
					className={cn(
						"relative z-30 flex min-h-[350px] w-full flex-col items-start justify-center overflow-hidden bg-primary px-8 md:min-h-[450px] md:px-16 lg:h-full lg:w-2/5 lg:pl-16",
						railClassName,
					)}
				>
					{/* Fade the wheel into the rail color at the top and bottom edges. */}
					<div
						aria-hidden="true"
						className="absolute inset-x-0 top-0 z-40 h-12 bg-linear-to-b from-primary via-primary/80 to-transparent md:h-20 lg:h-16"
					/>
					<div
						aria-hidden="true"
						className="absolute inset-x-0 bottom-0 z-40 h-12 bg-linear-to-t from-primary via-primary/80 to-transparent md:h-20 lg:h-16"
					/>

					<div className="relative z-20 flex size-full items-center justify-center lg:justify-start">
						{items.map((item, index) => {
							const isActive = index === activeIndex
							const wrappedDistance = wrap(-(itemCount / 2), itemCount / 2, index - activeIndex)
							const Icon = item.icon

							return (
								<motion.div
									key={item.id}
									style={{ height: RAIL_ITEM_HEIGHT, width: "fit-content" }}
									animate={{
										y: wrappedDistance * RAIL_ITEM_HEIGHT,
										opacity: 1 - Math.abs(wrappedDistance) * 0.25,
									}}
									transition={railTransition}
									className="absolute flex items-center justify-start"
								>
									<button
										type="button"
										data-slot="feature-carousel-chip"
										data-active={isActive ? "" : undefined}
										aria-current={isActive ? "true" : undefined}
										onClick={() => setActiveIndex(index)}
										onMouseEnter={() => setIsPaused(true)}
										onMouseLeave={() => setIsPaused(false)}
										className={cn(
											"relative flex items-center gap-4 rounded-full border px-6 py-3.5 text-left whitespace-nowrap outline-none transition-[background-color,border-color,color] duration-(--duration-relaxed) ease-(--ease-out) focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none md:px-10 md:py-5 lg:px-8 lg:py-4",
											isActive
												? "z-10 border-primary-foreground bg-primary-foreground text-primary"
												: "border-primary-foreground/20 bg-transparent text-primary-foreground/60 hover:border-primary-foreground/40 hover:text-primary-foreground",
										)}
									>
										{Icon && (
											<span
												aria-hidden="true"
												className={cn(
													"flex items-center justify-center transition-colors duration-(--duration-relaxed) ease-(--ease-out) motion-reduce:transition-none",
													isActive ? "text-primary" : "text-primary-foreground/40",
												)}
											>
												<Icon className="size-4.5" strokeWidth={2} />
											</span>
										)}

										<span className="text-sm font-normal tracking-tight uppercase">
											{item.label}
										</span>
									</button>
								</motion.div>
							)
						})}
					</div>
				</div>

				<div
					data-slot="feature-carousel-stage"
					className={cn(
						"relative flex min-h-[500px] flex-1 items-center justify-center overflow-hidden border-t border-border/20 bg-secondary/30 px-6 py-16 md:min-h-[600px] md:px-12 md:py-24 lg:h-full lg:border-t-0 lg:border-l lg:px-10 lg:py-16",
						stageClassName,
					)}
				>
					<div className="relative flex aspect-4/5 w-full max-w-[420px] items-center justify-center">
						{items.map((item, index) => {
							const status = getCardStatus(index)
							const isActive = status === "active"
							const isPrev = status === "prev"
							const isNext = status === "next"

							return (
								<motion.div
									key={item.id}
									data-slot="feature-carousel-card"
									data-status={status}
									initial={false}
									animate={{
										x: isActive ? 0 : isPrev ? -100 : isNext ? 100 : 0,
										scale: isActive ? 1 : isPrev || isNext ? 0.85 : 0.7,
										opacity: isActive ? 1 : isPrev || isNext ? 0.4 : 0,
										rotate: isPrev ? -3 : isNext ? 3 : 0,
										zIndex: isActive ? 20 : isPrev || isNext ? 10 : 0,
										pointerEvents: isActive ? "auto" : "none",
									}}
									transition={cardTransition}
									className="absolute inset-0 origin-center overflow-hidden rounded-3xl border-4 border-background bg-background md:rounded-4xl md:border-8"
								>
									<img
										src={item.image}
										alt={item.imageAlt ?? item.label}
										draggable={false}
										className={cn(
											"size-full object-cover transition-[filter] duration-(--duration-relaxed) ease-(--ease-out) motion-reduce:transition-none",
											isActive ? "blur-0 grayscale-0" : "blur-[2px] brightness-75 grayscale",
										)}
									/>

									<AnimatePresence>
										{isActive && (
											<motion.div
												data-slot="feature-carousel-caption"
												initial={reducedMotion ? false : { opacity: 0, y: 20 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{
													opacity: 0,
													y: reducedMotion ? 0 : 10,
													transition: reducedMotion
														? reducedMotionTransition
														: semanticTransitions.exit,
												}}
												transition={
													reducedMotion ? reducedMotionTransition : semanticTransitions.enter
												}
												// Fixed black scrim over imagery (theme-independent, like overlay scrims).
												className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-end bg-linear-to-t from-black/90 via-black/40 to-transparent p-10 pt-32"
											>
												<div
													data-slot="feature-carousel-badge"
													className="mb-3 w-fit rounded-full border border-border/50 bg-background px-4 py-1.5 text-xs font-normal tracking-[0.2em] uppercase text-foreground shadow-[var(--ff-shadow-lg)]"
												>
													{index + 1} • {item.label}
												</div>
												<p className="text-xl leading-tight font-normal tracking-tight text-white drop-shadow-[var(--ff-shadow-drop)] md:text-2xl">
													{item.description}
												</p>
											</motion.div>
										)}
									</AnimatePresence>

									{statusLabel != null && (
										<div
											data-slot="feature-carousel-status"
											className={cn(
												"absolute top-8 left-8 flex items-center gap-3 transition-opacity duration-(--duration-relaxed) ease-(--ease-out) motion-reduce:transition-none",
												isActive ? "opacity-100" : "opacity-0",
											)}
										>
											{/* White-on-imagery indicator (theme-independent). */}
											<div className="size-2 rounded-full bg-white text-white shadow-[0_0_10px_currentColor]" />
											<span className="font-mono text-xs font-normal tracking-[0.3em] uppercase text-white/80">
												{statusLabel}
											</span>
										</div>
									)}
								</motion.div>
							)
						})}
					</div>
				</div>
			</div>
		</div>
	)
}

export type { FeatureCarouselItem, FeatureCarouselProps }
export { FeatureCarousel }
