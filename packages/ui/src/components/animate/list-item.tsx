"use client"

import {
	durations,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { CheckIcon } from "lucide-react"
import type { Transition } from "motion/react"
import { LayoutGroup, motion, useReducedMotion } from "motion/react"
import type * as React from "react"
import { createContext, useContext, useId } from "react"

/** Per-row entrance stagger step, derived from duration tokens (`fast / 4`). */
const STAGGER_STEP_SECONDS = durations.fast / 4

type AnimatedListContextValue = {
	/** Shared framer `layoutId` so the selection highlight morphs between rows. */
	highlightId: string
}

const AnimatedListContext = createContext<AnimatedListContextValue | null>(null)

function useAnimatedList(): AnimatedListContextValue {
	const context = useContext(AnimatedListContext)
	if (!context) {
		throw new Error("AnimatedListItem must be used within <AnimatedList>")
	}
	return context
}

export interface AnimatedListProps extends React.ComponentProps<"div"> {
	/** Accessible label for the listbox. */
	"aria-label"?: string
}

/**
 * Selectable list whose rows share one animated selection highlight: when the
 * selected row changes, the highlight morphs to the new row instead of
 * blinking on/off. Rows enter with a small staggered slide-up.
 *
 * Compose with `AnimatedListItem` (one per row) and, optionally,
 * `AnimatedListItemIndicator` for a radio-style animated check.
 */
function AnimatedList({ className, children, ...props }: AnimatedListProps) {
	const highlightId = useId()

	return (
		<AnimatedListContext.Provider value={{ highlightId }}>
			<LayoutGroup id={highlightId}>
				<div
					role="listbox"
					data-slot="animated-list"
					className={cn("flex w-full flex-col gap-1", className)}
					{...props}
				>
					{children}
				</div>
			</LayoutGroup>
		</AnimatedListContext.Provider>
	)
}

export interface AnimatedListItemProps
	extends Omit<React.ComponentProps<typeof motion.div>, "children"> {
	/** Marks this row as the current selection; the shared highlight animates to it. */
	selected?: boolean
	/** Row position, used to derive the staggered entrance delay. */
	index?: number
	children?: React.ReactNode
}

/**
 * One selectable row. Pass `selected` for exactly one row in the list; click
 * handling stays with the caller (spread `onClick`/`onKeyDown` as usual).
 */
function AnimatedListItem({
	className,
	selected = false,
	index = 0,
	transition,
	children,
	...props
}: AnimatedListItemProps) {
	const { highlightId } = useAnimatedList()
	const reducedMotion = useReducedMotion()

	const enterTransition: Transition = reducedMotion
		? reducedMotionTransition
		: (transition ?? { ...semanticTransitions.enter, delay: index * STAGGER_STEP_SECONDS })

	return (
		<motion.div
			role="option"
			aria-selected={selected}
			data-slot="animated-list-item"
			data-selected={selected || undefined}
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={enterTransition}
			className={cn(
				"text-foreground group/animated-list-item relative isolate flex cursor-default items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors duration-(--duration-fast) ease-(--ease-out) outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
				selected ? "text-accent-foreground" : "hover:bg-muted/50",
				className,
			)}
			{...props}
		>
			{selected ? (
				<motion.span
					aria-hidden="true"
					layoutId={highlightId}
					data-slot="animated-list-item-highlight"
					transition={reducedMotion ? reducedMotionTransition : semanticTransitions.indicator}
					className="bg-accent absolute inset-0 -z-10 rounded-lg"
				/>
			) : null}
			{children}
		</motion.div>
	)
}

export interface AnimatedListItemIndicatorProps extends React.ComponentProps<"span"> {
	/** Mirrors the row's `selected` state; fills with an animated check when true. */
	selected?: boolean
}

/**
 * Radio-style trailing indicator: an outlined circle that fills with the
 * primary color and pops in a check when selected.
 */
function AnimatedListItemIndicator({
	className,
	selected = false,
	...props
}: AnimatedListItemIndicatorProps) {
	const reducedMotion = useReducedMotion()

	return (
		<span
			data-slot="animated-list-item-indicator"
			data-selected={selected || undefined}
			className={cn(
				"relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border-2",
				selected ? "border-transparent" : "border-input",
				className,
			)}
			{...props}
		>
			{selected ? (
				<motion.span
					aria-hidden="true"
					data-slot="animated-list-item-indicator-check"
					initial={{ opacity: 0, scale: 0.5 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={reducedMotion ? reducedMotionTransition : semanticTransitions.indicator}
					className="bg-primary text-primary-foreground absolute inset-0 flex items-center justify-center rounded-full"
				>
					<CheckIcon className="size-4" />
				</motion.span>
			) : null}
		</span>
	)
}

export { AnimatedList, AnimatedListItem, AnimatedListItemIndicator }
