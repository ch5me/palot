"use client"

import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import type { HTMLMotionProps, Transition } from "motion/react"
import { motion, useReducedMotion } from "motion/react"
import type { ComponentProps, ReactNode } from "react"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

/**
 * DiscreteTabs — icon pill tabs where the active pill expands to reveal its
 * label (layout spring) while the label crossfades in with a soft blur.
 *
 * Ported from uselayouts "Discrete Tabs", re-expressed in CH5 semantic
 * motion tokens and design-system tokens.
 *
 * ```tsx
 * <DiscreteTabs defaultValue="inbox">
 *   <DiscreteTab value="inbox" icon={<InboxIcon />}>Inbox</DiscreteTab>
 *   <DiscreteTab value="planner" icon={<CalendarIcon />}>Planner</DiscreteTab>
 *   <DiscreteTab value="alerts" icon={<BellIcon />}>Alerts</DiscreteTab>
 * </DiscreteTabs>
 * ```
 */

const discreteTabsVariants = cva("flex w-fit items-center", {
	variants: {
		size: {
			sm: "gap-1",
			default: "gap-1.5",
			lg: "gap-2",
		},
	},
	defaultVariants: {
		size: "default",
	},
})

const discreteTabVariants = cva(
	"group/discrete-tab inline-flex cursor-pointer items-center overflow-hidden rounded-full bg-secondary font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-active:text-primary data-active:hover:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			size: {
				sm: "gap-1 p-2 text-xs data-active:px-3 [&_svg:not([class*='size-'])]:size-4",
				default: "gap-1.5 p-3 text-sm data-active:px-4 [&_svg:not([class*='size-'])]:size-5",
				lg: "gap-2 p-4 text-base data-active:px-5 [&_svg:not([class*='size-'])]:size-6",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

type DiscreteTabsSize = NonNullable<VariantProps<typeof discreteTabVariants>["size"]>

type DiscreteTabsContextValue = {
	value: string | undefined
	setValue: (value: string) => void
	/** False until the first user selection — suppresses the label fade on mount. */
	hasInteracted: boolean
	size: DiscreteTabsSize
}

const DiscreteTabsContext = createContext<DiscreteTabsContextValue | null>(null)

function useDiscreteTabsContext(): DiscreteTabsContextValue {
	const context = useContext(DiscreteTabsContext)
	if (!context) {
		throw new Error("DiscreteTab must be used within a DiscreteTabs root")
	}
	return context
}

type DiscreteTabsProps = ComponentProps<"div"> &
	VariantProps<typeof discreteTabsVariants> & {
		/** Controlled active tab value. */
		value?: string
		/** Uncontrolled initial active tab value. */
		defaultValue?: string
		onValueChange?: (value: string) => void
	}

function DiscreteTabs({
	className,
	size = "default",
	value: valueProp,
	defaultValue,
	onValueChange,
	children,
	...props
}: DiscreteTabsProps) {
	const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)
	const [hasInteracted, setHasInteracted] = useState(false)

	const value = valueProp !== undefined ? valueProp : uncontrolledValue

	const setValue = useCallback(
		(next: string) => {
			setHasInteracted(true)
			if (valueProp === undefined) setUncontrolledValue(next)
			onValueChange?.(next)
		},
		[valueProp, onValueChange],
	)

	const resolvedSize: DiscreteTabsSize = size ?? "default"
	const contextValue = useMemo(
		() => ({ value, setValue, hasInteracted, size: resolvedSize }),
		[value, setValue, hasInteracted, resolvedSize],
	)

	return (
		<div
			role="tablist"
			data-slot="discrete-tabs"
			data-size={resolvedSize}
			className={cn(discreteTabsVariants({ size: resolvedSize }), className)}
			{...props}
		>
			<DiscreteTabsContext.Provider value={contextValue}>{children}</DiscreteTabsContext.Provider>
		</div>
	)
}

/**
 * Label crossfade: source used `duration: 0.2, ease: [0.86, 0, 0.07, 1]` —
 * mapped to the `base` duration token + `expressive` easing token.
 */
const labelFadeTransition: Transition = {
	duration: durations.base,
	ease: easings.expressive,
}

type DiscreteTabProps = Omit<HTMLMotionProps<"button">, "children" | "value"> & {
	/** Value this tab represents within the DiscreteTabs root. */
	value: string
	/** Leading icon (lucide-react icon element), always visible. */
	icon?: ReactNode
	/** Label revealed when the tab is active. */
	children?: ReactNode
}

function DiscreteTab({
	value,
	icon,
	children,
	className,
	style,
	onClick,
	...props
}: DiscreteTabProps) {
	const { value: activeValue, setValue, hasInteracted, size } = useDiscreteTabsContext()
	const reducedMotion = useReducedMotion()
	const isActive = activeValue === value

	// Width changes (label appearing/disappearing) ride the semantic layout spring.
	const layoutTransition: Transition = reducedMotion
		? reducedMotionTransition
		: { layout: semanticTransitions.layout }

	return (
		<motion.button
			type="button"
			role="tab"
			aria-selected={isActive}
			data-slot="discrete-tab"
			data-active={isActive ? "" : undefined}
			layout
			transition={layoutTransition}
			onClick={(event) => {
				setValue(value)
				onClick?.(event)
			}}
			className={cn(discreteTabVariants({ size }), className)}
			// Pinned via style so the layout animation can correct the pill radius
			// mid-flight instead of distorting it.
			style={{ borderRadius: 9999, ...style }}
			{...props}
		>
			{icon ? (
				<motion.span
					layout
					transition={layoutTransition}
					data-slot="discrete-tab-icon"
					aria-hidden="true"
					className="flex shrink-0 items-center justify-center"
				>
					{icon}
				</motion.span>
			) : null}
			{isActive && (
				<motion.span
					layout
					data-slot="discrete-tab-label"
					className="inline-block whitespace-nowrap"
					initial={hasInteracted && !reducedMotion ? { opacity: 0, filter: "blur(4px)" } : false}
					animate={{ opacity: 1, filter: "blur(0px)" }}
					transition={
						reducedMotion
							? reducedMotionTransition
							: {
									layout: semanticTransitions.layout,
									opacity: labelFadeTransition,
									filter: labelFadeTransition,
								}
					}
				>
					{children}
				</motion.span>
			)}
		</motion.button>
	)
}

export type { DiscreteTabProps, DiscreteTabsProps, DiscreteTabsSize }
export { DiscreteTab, DiscreteTabs, discreteTabsVariants, discreteTabVariants }
