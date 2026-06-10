"use client"

import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import type { Transition } from "motion/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type * as React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

/**
 * Shake-and-toss keyframes for the top card: it shudders in place, then gets
 * tossed up and tucked behind the deck. The `times` array keeps the original
 * choreography (shake for the first half, toss in the back half).
 */
const SHAKE_TIMES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1]
const SHAKE_SCALE = [1, 1.05, 1, 1.05, 1, 1, 0.9]
const SHAKE_X = [0, -12, 12, -12, 12, 0, 0]
const SHAKE_ROTATE = [0, -2, 2, -2, 2, 0, -5]
const TOSS_Y = [0, 0, 0, 0, 0, 0, -300]
const TOSS_ROTATE_X = [0, 0, 0, 0, 0, 0, 15]

/** Showcase-length keyframe run for the shake-and-toss sequence. */
const shakeTransition: Transition = {
	duration: durations.showcase,
	times: SHAKE_TIMES,
	ease: easings.decelerate,
}

/** The card re-stack happens once the toss finishes. */
const SHAKE_DURATION_MS = durations.showcase * 1000

/** Resting-deck geometry: each card behind the top one steps down and back. */
const STACK_OFFSET_Y = 15
const STACK_SCALE_STEP = 0.05
const STACK_TILT_STEP = 2

/** New cards rise into the back of the deck from below. */
const enterFrom = { scale: 0.7, opacity: 0, y: 40, rotateX: -20 }

/**
 * Sticky-note tone palette. Tints mix a Firefly accent into the card surface
 * (opaque, theme-aware) and darken/lighten the same accent against the
 * foreground for readable note text — no literal pastels.
 */
const shakeTestimonialNoteVariants = cva(
	cn(
		"absolute top-0 left-0 flex h-full w-full flex-col justify-between overflow-hidden",
		"transform-3d rounded-4xl border p-6 select-none md:p-8 lg:p-10",
		"border-[color-mix(in_srgb,currentColor_14%,transparent)] shadow-(--shadow-flat)",
		"transition-shadow duration-(--duration-relaxed) ease-(--ease-out) motion-reduce:transition-none",
	),
	{
		variants: {
			tone: {
				neutral: "bg-card text-card-foreground",
				primary:
					"bg-[color-mix(in_srgb,var(--ff-primary)_16%,var(--card))] text-[color-mix(in_srgb,var(--ff-primary)_55%,var(--foreground))]",
				indigo:
					"bg-[color-mix(in_srgb,var(--ff-indigo)_16%,var(--card))] text-[color-mix(in_srgb,var(--ff-indigo)_55%,var(--foreground))]",
				violet:
					"bg-[color-mix(in_srgb,var(--ff-violet)_16%,var(--card))] text-[color-mix(in_srgb,var(--ff-violet)_55%,var(--foreground))]",
				cyan: "bg-[color-mix(in_srgb,var(--ff-cyan)_16%,var(--card))] text-[color-mix(in_srgb,var(--ff-cyan)_55%,var(--foreground))]",
				warm: "bg-[color-mix(in_srgb,var(--ff-warm)_16%,var(--card))] text-[color-mix(in_srgb,var(--ff-warm)_55%,var(--foreground))]",
				success:
					"bg-[color-mix(in_srgb,var(--ff-success)_16%,var(--card))] text-[color-mix(in_srgb,var(--ff-success)_55%,var(--foreground))]",
			},
		},
		defaultVariants: {
			tone: "indigo",
		},
	},
)

export type ShakeTestimonialTone = NonNullable<
	VariantProps<typeof shakeTestimonialNoteVariants>["tone"]
>

/** Items without an explicit tone cycle through this palette by position. */
const TONE_CYCLE: readonly ShakeTestimonialTone[] = ["indigo", "violet", "cyan", "warm"]

export interface ShakeTestimonialItem {
	/** Stable identifier; drives keying as cards rotate through the deck. */
	id: string | number
	name: string
	/** Short qualifier under the name (e.g. "Head of Product, EcoStream"). */
	role?: string
	quote: string
	/** Avatar image URL; falls back to the person's initials when omitted. */
	avatarSrc?: string
	/** Note color; defaults to a stable per-item cycle through the palette. */
	tone?: ShakeTestimonialTone
}

export interface ShakeTestimonialCardProps extends React.ComponentProps<"div"> {
	items: ShakeTestimonialItem[]
	/**
	 * Auto-advance interval in milliseconds. Pass `0`/`null` to disable
	 * autoplay (clicking the deck still advances).
	 */
	autoAdvanceMs?: number | null
	/** How many cards of the deck stay visible behind the top one. */
	maxVisible?: number
	/** Accessible label for the click-to-advance top card. */
	nextLabel?: string
}

function initialsOf(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => word.charAt(0).toUpperCase())
		.join("")
}

/**
 * Testimonial deck of sticky-note cards: the top card shakes, then is tossed
 * over the back of the stack, revealing the next quote. Auto-plays on an
 * interval and advances on click/Enter/Space. Under reduced motion the deck
 * snaps between cards instead of animating.
 */
function ShakeTestimonialCard({
	className,
	items,
	autoAdvanceMs = 5000,
	maxVisible = 4,
	nextLabel = "Show next testimonial",
	...props
}: ShakeTestimonialCardProps) {
	const reducedMotion = useReducedMotion() ?? false
	const [headIndex, setHeadIndex] = useState(0)
	const [isShaking, setIsShaking] = useState(false)
	const isShakingRef = useRef(false)
	const tossTimeoutRef = useRef<number | null>(null)

	const count = items.length
	const interactive = count > 1

	/** Tones are assigned by each item's original position so they stay stable as the deck rotates. */
	const toneById = useMemo(() => {
		const map = new Map<ShakeTestimonialItem["id"], ShakeTestimonialTone>()
		items.forEach((item, index) => {
			map.set(item.id, item.tone ?? TONE_CYCLE[index % TONE_CYCLE.length] ?? "indigo")
		})
		return map
	}, [items])

	const orderedItems = useMemo(() => {
		if (count === 0) return []
		return items
			.map((_, offset) => items[(headIndex + offset) % count])
			.filter((item): item is ShakeTestimonialItem => item !== undefined)
	}, [items, headIndex, count])

	const advance = useCallback(() => {
		setHeadIndex((prev) => (count === 0 ? 0 : (prev + 1) % count))
	}, [count])

	const handleNext = useCallback(() => {
		if (count < 2 || isShakingRef.current) return
		if (reducedMotion) {
			advance()
			return
		}
		isShakingRef.current = true
		setIsShaking(true)
		tossTimeoutRef.current = window.setTimeout(() => {
			advance()
			isShakingRef.current = false
			setIsShaking(false)
		}, SHAKE_DURATION_MS)
	}, [advance, count, reducedMotion])

	useEffect(() => {
		if (!autoAdvanceMs || autoAdvanceMs <= 0 || count < 2) return
		const interval = window.setInterval(handleNext, autoAdvanceMs)
		return () => window.clearInterval(interval)
	}, [autoAdvanceMs, count, handleNext])

	useEffect(
		() => () => {
			if (tossTimeoutRef.current !== null) {
				window.clearTimeout(tossTimeoutRef.current)
			}
		},
		[],
	)

	if (count === 0) return null

	return (
		<div
			data-slot="shake-testimonial-card"
			className={cn("perspective-distant relative h-60 w-full max-w-md md:h-72 lg:h-80", className)}
			{...props}
		>
			<AnimatePresence mode="popLayout" initial={false}>
				{orderedItems.map((item, index) => {
					const isTop = index === 0
					const tossing = isTop && isShaking

					return (
						// Tinted decorative note — intentionally NOT data-slot="card"
						// so glass chrome tiers don't strip the tone tint.
						<motion.div
							key={item.id}
							data-slot="shake-testimonial-card-note"
							data-tone={toneById.get(item.id) ?? "indigo"}
							layout
							style={{
								zIndex: count - index,
								transformOrigin: "center center",
							}}
							initial={reducedMotion ? false : enterFrom}
							animate={
								tossing
									? {
											scale: SHAKE_SCALE,
											x: SHAKE_X,
											y: TOSS_Y,
											rotate: SHAKE_ROTATE,
											rotateX: TOSS_ROTATE_X,
											opacity: 1,
											transition: shakeTransition,
										}
									: {
											scale: 1 - index * STACK_SCALE_STEP,
											x: 0,
											y: index * STACK_OFFSET_Y,
											rotate: 0,
											rotateX: -index * STACK_TILT_STEP,
											opacity: index < maxVisible ? 1 : 0,
											transition: reducedMotion
												? reducedMotionTransition
												: semanticTransitions.layout,
										}
							}
							role={isTop && interactive ? "button" : undefined}
							tabIndex={isTop && interactive ? 0 : undefined}
							aria-label={isTop && interactive ? nextLabel : undefined}
							onClick={isTop && interactive ? handleNext : undefined}
							onKeyDown={
								isTop && interactive
									? (event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault()
												handleNext()
											}
										}
									: undefined
							}
							className={cn(
								shakeTestimonialNoteVariants({ tone: toneById.get(item.id) ?? "indigo" }),
								isTop &&
									interactive &&
									"focus-visible:ring-ring/50 cursor-pointer outline-none focus-visible:ring-[3px] hover:shadow-(--shadow-layered)",
							)}
						>
							<div className="flex flex-col gap-4 md:gap-6">
								<div className="flex items-center gap-3">
									<div
										data-slot="shake-testimonial-card-avatar"
										className="bg-background/50 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-(--ff-shadow-inner) lg:size-14 lg:rounded-2xl"
									>
										{item.avatarSrc ? (
											<img
												src={item.avatarSrc}
												alt=""
												loading="lazy"
												className="h-full w-full object-contain"
											/>
										) : (
											<span aria-hidden="true" className="text-sm font-semibold">
												{initialsOf(item.name)}
											</span>
										)}
									</div>

									<div className="flex flex-col justify-center">
										<h3 className="text-base leading-tight font-bold md:text-lg lg:text-xl">
											{item.name}
										</h3>
										{item.role ? (
											<p className="text-xs opacity-60 lg:text-sm">{item.role}</p>
										) : null}
									</div>
								</div>

								<blockquote className="text-lg leading-snug font-medium tracking-tight italic md:text-xl lg:text-2xl">
									&ldquo;{item.quote}&rdquo;
								</blockquote>
							</div>
						</motion.div>
					)
				})}
			</AnimatePresence>
		</div>
	)
}

export { ShakeTestimonialCard, shakeTestimonialNoteVariants }
