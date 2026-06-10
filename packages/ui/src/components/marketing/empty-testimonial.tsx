"use client"

import { useControllableState } from "@ch5me/elf-ui/hooks/use-controllable-state"
import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { PlusIcon } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import type { ComponentProps, KeyboardEvent, ReactNode } from "react"
import { useState } from "react"

/**
 * Testimonial empty state (ported from uselayouts "empty testimonial").
 *
 * A playful folder sits in the middle of the empty state; clicking it (or
 * focusing it and pressing Enter/Space) tilts the front flap open and three
 * placeholder testimonial pages spring out of the back. The heading carries a
 * highlighted pill with an accent that pulses while hovered, and a dashed
 * call-to-action pill invites the first testimonial.
 */

/** Scatter poses for the three placeholder pages inside the folder. */
const FOLDER_PAGES = [
	{
		id: "left",
		closed: { rotate: -3, x: -38, y: 2 },
		open: { rotate: -8, x: -70, y: -75 },
		className: "z-10",
	},
	{
		id: "center",
		closed: { rotate: 0, x: 0, y: 0 },
		open: { rotate: 1, x: 2, y: -95 },
		className: "z-20",
	},
	{
		id: "right",
		closed: { rotate: 3.5, x: 42, y: 1 },
		open: { rotate: 9, x: 75, y: -80 },
		className: "z-10",
	},
] as const

interface EmptyTestimonialProps extends Omit<ComponentProps<"div">, "title"> {
	/** Heading text shown before the highlighted pill. */
	title?: ReactNode
	/** Text inside the highlighted heading pill. */
	highlight?: ReactNode
	/** Accent (emoji or node) inside the pill; pulses while the pill is hovered. */
	highlightAccent?: ReactNode
	/** Primary empty-state line under the folder. */
	description?: ReactNode
	/** Secondary, muted line under the description. */
	hint?: ReactNode
	/** Call-to-action label. Pass `null` to hide the action entirely. */
	actionLabel?: ReactNode
	/** When set, the action renders as a link opening in a new tab. */
	actionHref?: string
	/** Called when the action button is pressed (ignored when `actionHref` is set). */
	onAction?: () => void
	/** Controlled folder open state. */
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
}

/** Placeholder testimonial page: a card of muted skeleton lines. */
function FolderPage() {
	return (
		<div className="size-full rounded-xl border bg-linear-to-b from-card to-muted/40 p-4">
			<div className="flex flex-col gap-2">
				<div className="h-1.5 w-full rounded-full bg-muted" />
				{FOLDER_PAGE_LINE_KEYS.map((key) => (
					<div key={key} className="flex gap-2">
						<div className="h-1.5 flex-1 rounded-full bg-muted" />
						<div className="h-1.5 flex-1 rounded-full bg-muted" />
					</div>
				))}
			</div>
		</div>
	)
}

const FOLDER_PAGE_LINE_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const

function EmptyTestimonial({
	title = "Wall of",
	highlight = "Love",
	highlightAccent = "\u{1F496}",
	description = "No testimonials yet",
	hint = "Be the first one to add a testimonial",
	actionLabel = "Add Testimonial",
	actionHref,
	onAction,
	open,
	defaultOpen = false,
	onOpenChange,
	className,
	...props
}: EmptyTestimonialProps) {
	const [isOpen, setIsOpen] = useControllableState({
		prop: open,
		defaultProp: defaultOpen,
		onChange: onOpenChange,
	})
	const [isAccentHovered, setIsAccentHovered] = useState(false)
	const reduced = useReducedMotion() ?? false

	// Pages sliding out of the folder + the flap tilt are panel-style motion.
	const folderTransition = reduced ? reducedMotionTransition : semanticTransitions.panel

	const toggleFolder = () => setIsOpen((current) => !current)
	const handleFolderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			toggleFolder()
		}
	}

	const actionClasses =
		"group/empty-testimonial-action flex cursor-pointer items-center gap-3 rounded-full border border-dashed border-muted-foreground/30 bg-background px-6 py-3 transition-colors duration-(--duration-relaxed) ease-(--ease-out) hover:border-primary hover:bg-primary/5"
	const actionContent = (
		<>
			<span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
				<PlusIcon aria-hidden="true" className="size-4" strokeWidth={3} />
			</span>
			<span className="text-sm font-medium text-foreground transition-colors duration-(--duration-relaxed) ease-(--ease-out) group-hover/empty-testimonial-action:text-primary">
				{actionLabel}
			</span>
		</>
	)

	return (
		<div
			data-slot="empty-testimonial"
			data-state={isOpen ? "open" : "closed"}
			className={cn("flex w-full flex-col items-center justify-center px-4 py-24", className)}
			{...props}
		>
			<div className="mb-20 text-center">
				<h2 className="text-3xl font-medium tracking-tight text-foreground md:text-4xl lg:text-5xl">
					{title}{" "}
					<motion.span
						data-slot="empty-testimonial-highlight"
						onHoverStart={() => setIsAccentHovered(true)}
						onHoverEnd={() => setIsAccentHovered(false)}
						className="relative inline-flex cursor-default items-center gap-2 rounded-2xl border border-primary/10 bg-primary/5 px-4 py-1 text-primary transition-colors duration-(--duration-relaxed) ease-(--ease-out) hover:border-primary/20 hover:bg-primary/10"
					>
						{highlight}
						<motion.span
							aria-hidden="true"
							animate={isAccentHovered && !reduced ? { scale: [1, 1.1, 1] } : { scale: 1 }}
							transition={
								reduced
									? reducedMotionTransition
									: isAccentHovered
										? {
												duration: durations.ambient,
												repeat: Number.POSITIVE_INFINITY,
												ease: easings.standard,
											}
										: { duration: durations.fast, ease: easings.decelerate }
							}
							className="inline-block"
						>
							{highlightAccent}
						</motion.span>
					</motion.span>
				</h2>
			</div>

			<div
				data-slot="empty-testimonial-folder"
				role="button"
				tabIndex={0}
				aria-expanded={isOpen}
				aria-label={isOpen ? "Close testimonial folder" : "Open testimonial folder"}
				onClick={toggleFolder}
				onKeyDown={handleFolderKeyDown}
				className="group relative mb-12 h-52 w-80 cursor-pointer outline-none"
			>
				<div className="relative mx-auto flex h-full w-[87.5%] justify-center overflow-visible rounded-xl border bg-muted">
					{FOLDER_PAGES.map((page) => (
						<motion.div
							key={page.id}
							data-slot="empty-testimonial-page"
							initial={false}
							animate={isOpen ? page.open : page.closed}
							transition={folderTransition}
							className={cn(
								"absolute top-2 h-fit w-32 rounded-xl shadow-[var(--ff-shadow-lg)]",
								page.className,
							)}
						>
							<FolderPage />
						</motion.div>
					))}
				</div>

				<motion.div
					data-slot="empty-testimonial-flap"
					animate={{ rotateX: isOpen ? -35 : 0 }}
					transition={folderTransition}
					className="absolute inset-x-0 -bottom-px z-30 flex h-44 origin-bottom items-center justify-center overflow-visible rounded-3xl"
				>
					<div className="relative size-full">
						<svg
							aria-hidden="true"
							className="size-full overflow-visible"
							viewBox="0 0 235 121"
							fill="none"
							preserveAspectRatio="none"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M104.615 0.350494L33.1297 0.838776C32.7542 0.841362 32.3825 0.881463 32.032 0.918854C31.6754 0.956907 31.3392 0.992086 31.0057 0.992096H31.0047C30.6871 0.99235 30.3673 0.962051 30.0272 0.929596C29.6927 0.897686 29.3384 0.863802 28.9803 0.866119L13.2693 0.967682H13.2527L13.2352 0.969635C13.1239 0.981406 13.0121 0.986674 12.9002 0.986237H9.91388C8.33299 0.958599 6.76052 1.22345 5.27423 1.76651H5.27325C4.33579 2.11246 3.48761 2.66213 2.7879 3.37393L2.49689 3.68839L2.492 3.69424C1.62667 4.73882 1.00023 5.96217 0.656067 7.27725C0.653324 7.28773 0.654065 7.29886 0.652161 7.30948C0.3098 8.62705 0.257231 10.0048 0.499817 11.3446L12.2147 114.399L12.2156 114.411L12.2176 114.423C12.6046 116.568 13.7287 118.508 15.3934 119.902C17.058 121.297 19.1572 122.056 21.3231 122.049V122.05H215.379C217.76 122.02 220.064 121.192 221.926 119.698V119.697C223.657 118.384 224.857 116.485 225.305 114.35L225.307 114.339L235.914 53.3798L235.968 53.1093L235.97 53.0985L235.971 53.0888C236.134 51.8978 236.044 50.685 235.705 49.5321C235.307 48.1669 234.63 46.9005 233.717 45.8144L233.383 45.4296C232.58 44.5553 231.614 43.8449 230.539 43.3398C229.311 42.7628 227.971 42.4685 226.616 42.4774H146.746C144.063 42.4705 141.423 41.8004 139.056 40.5263C136.691 39.2522 134.671 37.4127 133.175 35.1689L113.548 5.05948L113.544 5.05362L113.539 5.04776C112.545 3.65165 111.238 2.51062 109.722 1.72061C108.266 0.886502 106.627 0.422235 104.952 0.365143V0.364166L104.633 0.350494H104.615Z"
								fill="var(--card)"
								stroke="var(--border)"
								strokeWidth="1.5"
							/>
						</svg>

						<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-8">
							<div className="mb-2.5 flex gap-11">
								<div className="size-2.5 rounded-full bg-muted-foreground/40" />
								<div className="size-2.5 rounded-full bg-muted-foreground/40" />
							</div>
							<div className="h-1 w-9 rounded-full bg-muted-foreground/40" />
						</div>
					</div>
				</motion.div>
			</div>

			<div className="space-y-4 text-center">
				<p className="text-xl tracking-tight text-foreground">
					{description}
					{hint != null && (
						<>
							<br />
							<span className="text-lg text-muted-foreground">{hint}</span>
						</>
					)}
				</p>
				{actionLabel != null && (
					<div className="flex flex-col items-center gap-4">
						{actionHref != null ? (
							<a
								data-slot="empty-testimonial-action"
								href={actionHref}
								target="_blank"
								rel="noopener noreferrer"
								className={actionClasses}
							>
								{actionContent}
							</a>
						) : (
							<button
								data-slot="empty-testimonial-action"
								type="button"
								onClick={onAction}
								className={actionClasses}
							>
								{actionContent}
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	)
}

export type { EmptyTestimonialProps }
export { EmptyTestimonial }
