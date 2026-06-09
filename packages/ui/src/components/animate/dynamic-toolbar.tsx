"use client"

import { useControllableState } from "@ch5me/elf-ui/hooks/use-controllable-state"
import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { HTMLMotionProps, Transition } from "motion/react"
import { motion, useReducedMotion } from "motion/react"
import * as React from "react"
import useMeasure from "react-use-measure"

/**
 * DynamicToolbar — a width-morphing toolbar with two panels. The primary
 * panel is visible by default; expanding slides in the secondary panel while
 * the container's width springs to match the active panel's measured size.
 *
 * Ported from uselayouts "dynamic-toolbar"; rebuilt on CH5 semantic tokens
 * (colors, radii, motion) with react-use-measure and lucide-react.
 */

type DynamicToolbarPanel = "primary" | "secondary"

type MeasureRef = ReturnType<typeof useMeasure>[0]

interface DynamicToolbarContextValue {
	expanded: boolean
	setExpanded: React.Dispatch<React.SetStateAction<boolean>>
	primaryRef: MeasureRef
	secondaryRef: MeasureRef
	/** Active transition for panel slide/width morph (instant when reduced motion). */
	panelTransition: Transition
	/** Active transition for press feedback (instant when reduced motion). */
	pressTransition: Transition
	/** Active transition for the icon blur crossfade (instant when reduced motion). */
	blurTransition: Transition
	reducedMotion: boolean
}

const DynamicToolbarContext = React.createContext<DynamicToolbarContextValue | null>(null)

function useDynamicToolbar(consumerName: string): DynamicToolbarContextValue {
	const context = React.useContext(DynamicToolbarContext)
	if (!context) {
		throw new Error(`\`${consumerName}\` must be used within \`DynamicToolbar\``)
	}
	return context
}

const DynamicToolbarPanelContext = React.createContext<DynamicToolbarPanel | null>(null)

interface DynamicToolbarProps
	extends Omit<HTMLMotionProps<"div">, "animate" | "initial" | "transition"> {
	/** Controlled expanded state (shows the secondary panel). */
	expanded?: boolean
	/** Initial expanded state when uncontrolled. */
	defaultExpanded?: boolean
	onExpandedChange?: (expanded: boolean) => void
}

function DynamicToolbar({
	expanded: expandedProp,
	defaultExpanded = false,
	onExpandedChange,
	className,
	children,
	...props
}: DynamicToolbarProps) {
	const reducedMotion = useReducedMotion() ?? false
	const [expanded, setExpanded] = useControllableState({
		prop: expandedProp,
		defaultProp: defaultExpanded,
		onChange: onExpandedChange,
	})
	const [primaryRef, primaryBounds] = useMeasure()
	const [secondaryRef, secondaryBounds] = useMeasure()

	// Snap (no animation) until the first real measurement has been painted,
	// so the toolbar doesn't visibly animate from "auto" on mount.
	const hasMeasurements = primaryBounds.width > 0
	const [isReady, setIsReady] = React.useState(false)
	React.useEffect(() => {
		if (hasMeasurements) setIsReady(true)
	}, [hasMeasurements])

	const animateTransitions = isReady && !reducedMotion
	const panelTransition = animateTransitions ? semanticTransitions.panel : reducedMotionTransition
	const pressTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.press
	const blurTransition = animateTransitions
		? { duration: durations.base, ease: easings.decelerate }
		: reducedMotionTransition

	const width = hasMeasurements ? (expanded ? secondaryBounds.width : primaryBounds.width) : "auto"

	const contextValue = React.useMemo<DynamicToolbarContextValue>(
		() => ({
			expanded,
			setExpanded,
			primaryRef,
			secondaryRef,
			panelTransition,
			pressTransition,
			blurTransition,
			reducedMotion,
		}),
		[
			expanded,
			setExpanded,
			primaryRef,
			secondaryRef,
			panelTransition,
			pressTransition,
			blurTransition,
			reducedMotion,
		],
	)

	return (
		<DynamicToolbarContext.Provider value={contextValue}>
			<motion.div
				data-slot="dynamic-toolbar"
				data-expanded={expanded ? "" : undefined}
				className={cn("relative h-14 overflow-hidden rounded-full border bg-muted", className)}
				initial={false}
				animate={{ width }}
				transition={panelTransition}
				{...props}
			>
				<motion.div
					data-slot="dynamic-toolbar-track"
					className="flex h-full"
					initial={false}
					animate={{ x: expanded ? -primaryBounds.width : 0 }}
					transition={panelTransition}
				>
					{children}
				</motion.div>
			</motion.div>
		</DynamicToolbarContext.Provider>
	)
}

type DynamicToolbarPrimaryProps = React.ComponentProps<"div">

function DynamicToolbarPrimary({ className, children, ...props }: DynamicToolbarPrimaryProps) {
	const { primaryRef, expanded } = useDynamicToolbar("DynamicToolbarPrimary")
	return (
		<DynamicToolbarPanelContext.Provider value="primary">
			<div
				ref={primaryRef}
				data-slot="dynamic-toolbar-primary"
				// Off-canvas while expanded: keep it out of the tab order.
				inert={expanded ? true : undefined}
				className={cn("flex h-full shrink-0 items-center gap-1 p-1.5 pr-2 pl-3", className)}
				{...props}
			>
				{children}
			</div>
		</DynamicToolbarPanelContext.Provider>
	)
}

type DynamicToolbarSecondaryProps = React.ComponentProps<"div">

function DynamicToolbarSecondary({ className, children, ...props }: DynamicToolbarSecondaryProps) {
	const { secondaryRef, expanded } = useDynamicToolbar("DynamicToolbarSecondary")
	return (
		<DynamicToolbarPanelContext.Provider value="secondary">
			<div
				ref={secondaryRef}
				data-slot="dynamic-toolbar-secondary"
				// Hidden while collapsed: invisible AND out of the tab order.
				inert={expanded ? undefined : true}
				className={cn(
					"flex h-full shrink-0 items-center gap-1 p-1.5 pr-3 pl-2",
					expanded ? "relative" : "pointer-events-none absolute opacity-0",
					className,
				)}
				{...props}
			>
				{children}
			</div>
		</DynamicToolbarPanelContext.Provider>
	)
}

interface DynamicToolbarButtonProps extends React.ComponentProps<"button"> {
	/**
	 * Softly blur this button's content while its panel is inactive,
	 * echoing the panel crossfade. Purely decorative.
	 */
	blurWhenInactive?: boolean
}

function DynamicToolbarButton({
	className,
	blurWhenInactive = false,
	type = "button",
	children,
	...props
}: DynamicToolbarButtonProps) {
	const { expanded, blurTransition } = useDynamicToolbar("DynamicToolbarButton")
	const panel = React.useContext(DynamicToolbarPanelContext)
	const isPanelInactive = panel === "primary" ? expanded : panel === "secondary" ? !expanded : false
	const isBlurred = blurWhenInactive && isPanelInactive

	return (
		<button
			type={type}
			data-slot="dynamic-toolbar-button"
			className={cn(
				"rounded-md p-1 text-foreground transition-colors hover:bg-accent/50 hover:text-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
				className,
			)}
			{...props}
		>
			{blurWhenInactive ? (
				<motion.div
					initial={false}
					animate={{ filter: isBlurred ? "blur(1px)" : "blur(0px)" }}
					transition={blurTransition}
				>
					{children}
				</motion.div>
			) : (
				children
			)}
		</button>
	)
}

interface DynamicToolbarTriggerProps
	extends Omit<HTMLMotionProps<"button">, "children" | "transition"> {
	children?: React.ReactNode
}

function DynamicToolbarTrigger({
	className,
	children,
	onClick,
	...props
}: DynamicToolbarTriggerProps) {
	const { expanded, setExpanded, pressTransition, reducedMotion } =
		useDynamicToolbar("DynamicToolbarTrigger")
	const panel = React.useContext(DynamicToolbarPanelContext)
	// A trigger inside the primary panel expands; inside the secondary panel
	// it collapses; outside any panel it toggles.
	const nextExpanded = panel === "primary" ? true : panel === "secondary" ? false : !expanded

	return (
		<motion.button
			type="button"
			data-slot="dynamic-toolbar-trigger"
			aria-expanded={expanded}
			whileTap={reducedMotion ? undefined : { scale: 0.9 }}
			transition={pressTransition}
			onClick={(event) => {
				onClick?.(event)
				if (!event.defaultPrevented) setExpanded(nextExpanded)
			}}
			className={cn(
				"flex aspect-square h-full items-center justify-center rounded-full bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
				className,
			)}
			{...props}
		>
			{children ?? (nextExpanded ? <ChevronRightIcon /> : <ChevronLeftIcon />)}
		</motion.button>
	)
}

export type {
	DynamicToolbarButtonProps,
	DynamicToolbarPanel,
	DynamicToolbarPrimaryProps,
	DynamicToolbarProps,
	DynamicToolbarSecondaryProps,
	DynamicToolbarTriggerProps,
}
export {
	DynamicToolbar,
	DynamicToolbarButton,
	DynamicToolbarPrimary,
	DynamicToolbarSecondary,
	DynamicToolbarTrigger,
	useDynamicToolbar,
}
