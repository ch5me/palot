"use client"

import { Button } from "@ch5me/elf-ui/components/button"
import { Input } from "@ch5me/elf-ui/components/input"
import {
	durations,
	reducedMotionTransition,
	semanticTransitions,
	springs,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { SearchIcon, XIcon } from "lucide-react"
import type { MotionStyle, Variants } from "motion/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type * as React from "react"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

/** Per-item entrance stagger step, derived from duration tokens (`fast / 4`). */
const STAGGER_OPEN_SECONDS = durations.fast / 4
/** Reverse (collapse) stagger step, slightly tighter (`fast / 8`). */
const STAGGER_CLOSE_SECONDS = durations.fast / 8
/** Delay before items sweep in, letting the overlay morph lead (`fast * 2/3`). */
const STAGGER_DELAY_SECONDS = (durations.fast * 2) / 3

/** Items sweep in from the bottom-right with a slight settle rotation. */
const sweepVariants: Variants = {
	hidden: { opacity: 0, x: 10, y: 15, rotate: 1 },
	visible: { opacity: 1, x: 0, y: 0, rotate: 0 },
}

type StackedListContextValue = {
	expanded: boolean
	setExpanded: (expanded: boolean) => void
	reducedMotion: boolean
}

const StackedListContext = createContext<StackedListContextValue | null>(null)

/**
 * Access the expand/collapse state of the surrounding `StackedList`, e.g. to
 * swap collapsed-bar summary content for expanded-state controls.
 */
function useStackedList(): StackedListContextValue {
	const context = useContext(StackedListContext)
	if (!context) {
		throw new Error("useStackedList must be used within <StackedList>")
	}
	return context
}

export interface StackedListProps extends React.ComponentProps<"div"> {
	/** Controlled expanded state of the overlay directory. */
	expanded?: boolean
	/** Initial expanded state when uncontrolled. */
	defaultExpanded?: boolean
	/** Called whenever the overlay expands or collapses. */
	onExpandedChange?: (expanded: boolean) => void
}

/**
 * Expandable list widget with a stacked layout: a primary list sits behind a
 * floating bottom bar (`StackedListOverlay`) that morphs into a full-height
 * directory panel. Suits notifications, queued messages, and agent-task
 * widgets.
 *
 * Compose: `StackedListBody` (primary content) + `StackedListOverlay`
 * (morphing panel) with `StackedListOverlayBar` / `StackedListOverlayContent`
 * inside. Lists animate via `StackedListGroup` + `StackedListItem`.
 */
function StackedList({
	className,
	expanded: expandedProp,
	defaultExpanded = false,
	onExpandedChange,
	...props
}: StackedListProps) {
	const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded)
	const expanded = expandedProp ?? uncontrolledExpanded
	const reducedMotion = useReducedMotion() ?? false

	const setExpanded = useCallback(
		(next: boolean) => {
			setUncontrolledExpanded(next)
			onExpandedChange?.(next)
		},
		[onExpandedChange],
	)

	const contextValue = useMemo(
		() => ({ expanded, setExpanded, reducedMotion }),
		[expanded, setExpanded, reducedMotion],
	)

	return (
		<StackedListContext.Provider value={contextValue}>
			{/* data-slot="card" so glass chrome tiers restyle this surface. */}
			<div
				data-slot="card"
				data-expanded={expanded || undefined}
				className={cn(
					"bg-card text-card-foreground relative isolate flex flex-col overflow-hidden rounded-4xl border",
					className,
				)}
				{...props}
			/>
		</StackedListContext.Provider>
	)
}

export type StackedListBodyProps = React.ComponentProps<"div">

/** Always-visible primary column behind the overlay (header, search, list). */
function StackedListBody({ className, ...props }: StackedListBodyProps) {
	return (
		<div
			data-slot="stacked-list-body"
			className={cn("flex min-h-0 flex-1 flex-col", className)}
			{...props}
		/>
	)
}

export interface StackedListGroupProps
	extends Omit<React.ComponentProps<typeof motion.div>, "children"> {
	/** Whether items are shown; drives the staggered sweep in/out. */
	open?: boolean
	children?: React.ReactNode
}

/**
 * Stagger container for `StackedListItem`s. Defaults to open; pass
 * `open={expanded}` (from `useStackedList`) inside the overlay so items sweep
 * in as the panel expands and retreat as it collapses.
 */
function StackedListGroup({ className, open = true, ...props }: StackedListGroupProps) {
	const { reducedMotion } = useStackedList()

	return (
		<motion.div
			data-slot="stacked-list-group"
			initial={false}
			animate={open ? "visible" : "hidden"}
			variants={
				reducedMotion
					? undefined
					: {
							visible: {
								transition: {
									staggerChildren: STAGGER_OPEN_SECONDS,
									delayChildren: STAGGER_DELAY_SECONDS,
								},
							},
							hidden: {
								transition: {
									staggerChildren: STAGGER_CLOSE_SECONDS,
									staggerDirection: -1,
								},
							},
						}
			}
			className={cn("space-y-0.5", className)}
			{...props}
		/>
	)
}

export interface StackedListItemProps
	extends Omit<React.ComponentProps<typeof motion.div>, "children"> {
	children?: React.ReactNode
}

/** One row. Sweeps in/out with the surrounding `StackedListGroup` stagger. */
function StackedListItem({ className, style, transition, ...props }: StackedListItemProps) {
	const { reducedMotion } = useStackedList()

	return (
		<motion.div
			data-slot="stacked-list-item"
			variants={sweepVariants}
			transition={reducedMotion ? reducedMotionTransition : (transition ?? springs.snappy)}
			style={{ originX: 1, originY: 1, ...style }}
			className={cn(
				"group/stacked-list-item border-border/40 flex items-center border-b py-4 first:pt-0 last:border-0",
				className,
			)}
			{...props}
		/>
	)
}

const stackedListTagVariants = cva(
	"flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs tracking-tight uppercase whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
	{
		variants: {
			tone: {
				neutral: "bg-muted text-muted-foreground border-border",
				primary:
					"bg-(--ff-primary-soft) text-(--ff-primary) border-[color-mix(in_srgb,var(--ff-primary)_28%,transparent)]",
				warm: "bg-(--ff-warm-soft) text-(--ff-warm) border-[color-mix(in_srgb,var(--ff-warm)_28%,transparent)]",
				success:
					"bg-(--ff-success-soft) text-(--ff-success) border-[color-mix(in_srgb,var(--ff-success)_28%,transparent)]",
				cyan: "bg-(--ff-cyan-soft) text-(--ff-cyan) border-[color-mix(in_srgb,var(--ff-cyan)_28%,transparent)]",
				indigo:
					"bg-(--ff-indigo-soft) text-(--ff-indigo) border-[color-mix(in_srgb,var(--ff-indigo)_28%,transparent)]",
				violet:
					"bg-[color-mix(in_srgb,var(--ff-violet)_14%,transparent)] text-(--ff-violet) border-[color-mix(in_srgb,var(--ff-violet)_28%,transparent)]",
				danger:
					"bg-(--ff-danger-soft) text-(--ff-danger) border-[color-mix(in_srgb,var(--ff-danger)_28%,transparent)]",
			},
		},
		defaultVariants: {
			tone: "neutral",
		},
	},
)

export type StackedListTagProps = React.ComponentProps<"div"> &
	VariantProps<typeof stackedListTagVariants>

/**
 * Category pill (role/status/kind) using the Firefly token palette instead of
 * literal pastels. Put a lucide icon before the label if desired.
 */
function StackedListTag({ className, tone = "neutral", ...props }: StackedListTagProps) {
	return (
		<div
			data-slot="stacked-list-tag"
			data-tone={tone}
			className={cn(stackedListTagVariants({ tone, className }))}
			{...props}
		/>
	)
}

const stackedListStatusDotVariants = cva("inline-block size-2 shrink-0 rounded-full", {
	variants: {
		tone: {
			neutral: "bg-muted-foreground",
			success: "bg-(--ff-success)",
			warm: "bg-(--ff-warm)",
			danger: "bg-(--ff-danger)",
		},
	},
	defaultVariants: {
		tone: "neutral",
	},
})

export type StackedListStatusDotProps = React.ComponentProps<"span"> &
	VariantProps<typeof stackedListStatusDotVariants>

/** Tiny presence/status dot (online, busy, failed) using Firefly tones. */
function StackedListStatusDot({
	className,
	tone = "neutral",
	...props
}: StackedListStatusDotProps) {
	return (
		<span
			data-slot="stacked-list-status-dot"
			data-tone={tone}
			className={cn(stackedListStatusDotVariants({ tone, className }))}
			{...props}
		/>
	)
}

export type StackedListSearchInputProps = React.ComponentProps<typeof Input>

/** Search field with a leading icon, styled for the stacked-list surfaces. */
function StackedListSearchInput({ className, ...props }: StackedListSearchInputProps) {
	return (
		<div data-slot="stacked-list-search" className="relative">
			<SearchIcon className="text-muted-foreground/60 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
			<Input className={cn("bg-muted/40 h-10 rounded-xl border-none pl-9", className)} {...props} />
		</div>
	)
}

export interface StackedListOverlayProps
	extends Omit<React.ComponentProps<typeof motion.div>, "children" | "animate" | "initial"> {
	/** Height of the collapsed bottom bar, in px. */
	collapsedHeight?: number
	/** Gap between the collapsed bar and the container edges, in px. */
	collapsedInset?: number
	/** Gap between the expanded panel and the container edges, in px. */
	expandedInset?: number
	children?: React.ReactNode
}

/**
 * The floating panel that morphs between a compact bottom bar and a
 * near-full-size directory. Clicking (or Enter/Space on) the collapsed bar
 * expands it; render `StackedListOverlayClose` inside the bar to collapse.
 */
function StackedListOverlay({
	className,
	style,
	transition,
	collapsedHeight = 68,
	collapsedInset = 20,
	expandedInset = 10,
	onClick,
	onKeyDown,
	...props
}: StackedListOverlayProps) {
	const { expanded, setExpanded, reducedMotion } = useStackedList()

	const overlayStyle = {
		"--stacked-list-bar-height": `${collapsedHeight}px`,
		...style,
	} as MotionStyle

	return (
		// data-slot="popover-content" so glass chrome tiers treat this floating
		// panel as an elevated surface (tinted + backdrop-blurred).
		<motion.div
			data-slot="popover-content"
			data-expanded={expanded || undefined}
			initial={false}
			animate={{
				height: expanded ? `calc(100% - ${expandedInset * 2}px)` : collapsedHeight,
				width: expanded
					? `calc(100% - ${expandedInset * 2}px)`
					: `calc(100% - ${collapsedInset * 2}px)`,
				bottom: expanded ? expandedInset : collapsedInset,
				left: expanded ? expandedInset : collapsedInset,
			}}
			transition={
				reducedMotion ? reducedMotionTransition : (transition ?? semanticTransitions.panel)
			}
			role={expanded ? undefined : "button"}
			tabIndex={expanded ? undefined : 0}
			aria-expanded={expanded ? undefined : false}
			onClick={(event) => {
				onClick?.(event)
				if (!expanded) {
					setExpanded(true)
				}
			}}
			onKeyDown={(event) => {
				onKeyDown?.(event)
				if (!expanded && (event.key === "Enter" || event.key === " ")) {
					event.preventDefault()
					setExpanded(true)
				}
			}}
			style={overlayStyle}
			className={cn(
				"bg-popover text-popover-foreground absolute z-50 flex flex-col overflow-hidden border shadow-(--shadow-layered)",
				// Radius morphs via CSS so the values stay radius tokens; framer
				// handles the geometry. Reduced motion snaps the corners too.
				"transition-[border-radius] duration-(--duration-relaxed) ease-(--ease-out) motion-reduce:transition-none",
				expanded ? "rounded-4xl" : "cursor-pointer rounded-3xl",
				className,
			)}
			{...props}
		/>
	)
}

export type StackedListOverlayBarProps = React.ComponentProps<"div">

/** The always-visible header row of the overlay (summary + actions). */
function StackedListOverlayBar({ className, ...props }: StackedListOverlayBarProps) {
	const { expanded } = useStackedList()

	return (
		<div
			data-slot="stacked-list-overlay-bar"
			className={cn(
				"flex h-(--stacked-list-bar-height) shrink-0 items-center justify-between px-3 transition-colors duration-(--duration-fast) ease-(--ease-out)",
				expanded ? "border-border/40 border-b" : "hover:bg-muted/20",
				className,
			)}
			{...props}
		/>
	)
}

export type StackedListOverlayCloseProps = React.ComponentProps<typeof Button>

/** Collapse button for the expanded overlay; renders nothing while collapsed. */
function StackedListOverlayClose({
	className,
	onClick,
	children,
	...props
}: StackedListOverlayCloseProps) {
	const { expanded, setExpanded } = useStackedList()

	if (!expanded) {
		return null
	}

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label="Collapse"
			className={cn(
				"bg-muted/60 text-muted-foreground hover:text-foreground rounded-xl transition-transform duration-(--duration-fast) ease-(--ease-out) active:scale-90 motion-reduce:transition-none",
				className,
			)}
			onClick={(event) => {
				onClick?.(event)
				event.stopPropagation()
				setExpanded(false)
			}}
			{...props}
		>
			{children ?? <XIcon />}
		</Button>
	)
}

export type StackedListOverlayContentProps = React.ComponentProps<"div">

/** Scrollable region of the overlay below the bar. */
function StackedListOverlayContent({ className, ...props }: StackedListOverlayContentProps) {
	return (
		<div
			data-slot="stacked-list-overlay-content"
			className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
			{...props}
		/>
	)
}

export interface StackedListOverlayRevealProps
	extends Omit<
		React.ComponentProps<typeof motion.div>,
		"children" | "animate" | "initial" | "exit"
	> {
	children?: React.ReactNode
}

/**
 * Mounts its children only while the overlay is expanded, with a soft
 * drop-in/out — used for the overlay's own search row or toolbars.
 */
function StackedListOverlayReveal({
	className,
	transition,
	...props
}: StackedListOverlayRevealProps) {
	const { expanded, reducedMotion } = useStackedList()

	return (
		<AnimatePresence>
			{expanded ? (
				<motion.div
					data-slot="stacked-list-overlay-reveal"
					initial={reducedMotion ? false : { opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={
						reducedMotion
							? { opacity: 0, transition: reducedMotionTransition }
							: { opacity: 0, y: -8, transition: semanticTransitions.exit }
					}
					transition={
						reducedMotion
							? reducedMotionTransition
							: (transition ?? semanticTransitions.overlayEnter)
					}
					className={className}
					{...props}
				/>
			) : null}
		</AnimatePresence>
	)
}

export {
	StackedList,
	StackedListBody,
	StackedListGroup,
	StackedListItem,
	StackedListOverlay,
	StackedListOverlayBar,
	StackedListOverlayClose,
	StackedListOverlayContent,
	StackedListOverlayReveal,
	StackedListSearchInput,
	StackedListStatusDot,
	StackedListTag,
	stackedListStatusDotVariants,
	stackedListTagVariants,
	useStackedList,
}
