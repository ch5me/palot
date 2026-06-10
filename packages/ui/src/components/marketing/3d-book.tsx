"use client"

import { springs } from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { useMotionValue, useMotionValueEvent, useReducedMotion, useSpring } from "motion/react"
import type { ComponentProps, PointerEvent, ReactNode } from "react"
import { useRef, useState } from "react"

interface Book3DProps extends Omit<ComponentProps<"div">, "title"> {
	/** Cover title rendered along the bottom edge of the front cover. */
	title?: ReactNode
	/** Content revealed on the inside of the front cover once the book opens. */
	insideContent?: ReactNode
	/** Number of fanning inner pages. */
	pageCount?: number
	/** Classes for the decorative band across the top of the cover. */
	accentClassName?: string
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

/**
 * Interactive 3D book whose cover and pages fan open as the pointer moves
 * toward its spine (left side opens, right side closes). Pointer tracking is
 * smoothed with a snap-feel spring; releasing or leaving lets the book spring
 * shut. With reduced motion the book tracks the pointer instantly instead.
 */
function Book3D({
	title = "Notebook",
	insideContent,
	pageCount = 15,
	accentClassName,
	className,
	...props
}: Book3DProps) {
	const bookRef = useRef<HTMLDivElement>(null)
	const [isDragging, setIsDragging] = useState(false)
	const reducedMotion = useReducedMotion()

	const rawProgress = useMotionValue(0)
	// Cursor tracking should feel immediate, not drifty — `stiff` keeps the
	// source's direct-follow feel while smoothing pointer jitter.
	const springProgress = useSpring(rawProgress, springs.stiff)
	// Reduced motion = instant: track the raw value, skip the spring entirely.
	const progress = reducedMotion ? rawProgress : springProgress

	useMotionValueEvent(progress, "change", (latest) => {
		bookRef.current?.style.setProperty("--book-progress", String(latest))
	})

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (!bookRef.current) return

		const rect = bookRef.current.getBoundingClientRect()
		const bookCenterX = rect.left + rect.width / 2

		// Pointer distance from the book's center, normalized to -1..1.
		const distanceFromCenter = (event.clientX - bookCenterX) / (rect.width / 2)

		// Left side (negative) = open (1), right side (positive) = closed (0).
		rawProgress.set(clamp01(lerp(1, 0, (distanceFromCenter + 1) / 2)))
	}

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		setIsDragging(true)
		handlePointerMove(event)
	}

	const handlePointerUp = () => {
		setIsDragging(false)
		rawProgress.set(0)
	}

	const handlePointerLeave = () => {
		// Close the book when the pointer leaves (unless mid-drag on touch).
		if (!isDragging) {
			rawProgress.set(0)
		}
	}

	const pages = Array.from({ length: Math.max(0, Math.floor(pageCount)) }, (_, index) => index + 1)

	return (
		<div
			data-slot="book-3d"
			className={cn("flex h-full w-full items-center justify-center", className)}
			{...props}
		>
			<div
				ref={bookRef}
				data-slot="book-3d-book"
				className="h-48 w-32 translate-x-16 touch-none will-change-transform md:h-72 md:w-52 md:translate-x-24"
				onPointerMove={handlePointerMove}
				onPointerDown={handlePointerDown}
				onPointerUp={handlePointerUp}
				onPointerLeave={handlePointerLeave}
				style={{
					perspective: "1500px",
					transformStyle: "preserve-3d",
				}}
			>
				{/* Back cover (underneath all pages) */}
				<div
					data-slot="book-3d-back-cover"
					className="absolute h-48 w-32 rounded-lg border-2 md:h-72 md:w-52 md:rounded-2xl"
					style={{
						transformStyle: "preserve-3d",
						transformOrigin: "left",
						background:
							"radial-gradient(var(--muted) 0 1px, var(--background) 1px 100%) 0 0 / 4px 4px",
						boxShadow: "var(--ff-shadow-md)",
						zIndex: 1,
					}}
				/>

				{/* Pages — all the same size, fanning at different rotations */}
				{pages.map((page) => (
					<div
						key={page}
						data-slot="book-3d-page"
						className="absolute h-48 w-32 rounded-lg border bg-background md:h-72 md:w-52 md:rounded-2xl"
						style={{
							transformStyle: "preserve-3d",
							transformOrigin: "left",
							transform: `rotateY(calc(var(--book-progress, 0) * ${-(page + 1) * 10}deg))`,
							zIndex: 50 + page,
							backfaceVisibility: "visible",
						}}
					/>
				))}

				{/* Front cover */}
				<div
					data-slot="book-3d-front-cover"
					className="absolute h-48 w-32 overflow-hidden bg-muted md:h-72 md:w-52"
					style={{
						transformStyle: "preserve-3d",
						transformOrigin: "left center",
						transform: "rotateY(calc(var(--book-progress, 0) * -165deg))",
						boxShadow: "var(--ff-shadow-sm)",
						borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
						zIndex: 200,
					}}
				>
					{/* Cover lighting overlay (inset edge shadows + sheen) */}
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 z-30"
						style={{
							borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
							boxShadow:
								"0 0 0 0.85px color-mix(in srgb, var(--foreground) 10%, transparent) inset, 2px 0 1px 0 color-mix(in srgb, var(--foreground) 10%, transparent) inset, -1.5px 0 1px 0 color-mix(in srgb, var(--foreground) 10%, transparent) inset, 0 2px 2px 0 color-mix(in srgb, var(--background) 60%, transparent) inset, 0 8px 16px 0 color-mix(in srgb, var(--foreground) 5%, transparent)",
						}}
					/>

					{/* Accent band across the top of the cover */}
					<div
						data-slot="book-3d-accent"
						className={cn(
							"absolute top-0 right-0 left-0 z-10 h-[40%] bg-primary p-1.5 pl-2 md:p-3 md:pl-4",
							accentClassName,
						)}
					/>

					{/* Spine edge */}
					<div className="absolute top-0 bottom-0 left-0 z-30 flex w-2 flex-row justify-end md:w-3.5">
						<div className="h-full w-0.5 bg-background/25" />
						<div className="h-full w-0.5 bg-foreground/15" />
					</div>

					{/* Title */}
					<div
						data-slot="book-3d-title"
						className="pointer-events-none absolute right-1.5 bottom-1.5 left-3 z-20 text-sm font-medium text-muted-foreground/30 select-none md:left-6 md:text-2xl"
						style={{
							textShadow: "0 0 2px var(--background)",
							backfaceVisibility: "hidden",
						}}
					>
						{title}
					</div>

					{/* Inside of the front cover (visible once opened) */}
					{insideContent != null && (
						<div
							data-slot="book-3d-inside"
							className="absolute top-1/2 right-1/2 text-center text-xs font-semibold text-primary md:text-base"
							style={{
								transform: "translate(50%, -50%) rotateY(180deg) scaleX(-1)",
								backfaceVisibility: "hidden",
							}}
						>
							{insideContent}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

export type { Book3DProps }
export { Book3D }
