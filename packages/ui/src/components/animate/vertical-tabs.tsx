"use client"

import { useControllableState } from "@ch5me/elf-ui/hooks/use-controllable-state"
import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { Transition, Variants } from "motion/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type { ComponentProps, ReactNode } from "react"
import { useCallback, useEffect, useId, useState } from "react"

/**
 * VerticalTabs — a vertical tab rail (numbered triggers with an animated
 * left progress indicator and an expanding description) synchronized with a
 * content panel that slides vertically in the direction of travel.
 *
 * Ported from uselayouts "Vertical Tabs", re-expressed in CH5 semantic
 * motion tokens and design-system tokens. Pairs with `DiscreteTabs` to round
 * out animated tab coverage for settings/inspector panes.
 *
 * ```tsx
 * <VerticalTabs
 *   defaultValue="appearance"
 *   autoPlayInterval={5000}
 *   items={[
 *     { value: "appearance", label: "Appearance", description: "Theme & layout", content: <AppearancePane /> },
 *     { value: "shortcuts", label: "Shortcuts", description: "Keyboard bindings", content: <ShortcutsPane /> },
 *   ]}
 * />
 * ```
 */

const verticalTabsTriggerVariants = cva(
	"group/vertical-tabs-trigger relative flex items-start border-t border-border/50 text-left outline-none transition-colors duration-(--duration-relaxed) ease-(--ease-out) first:border-t-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none data-active:text-foreground [&:not([data-active])]:text-muted-foreground/60 [&:not([data-active])]:hover:text-foreground",
	{
		variants: {
			size: {
				sm: "gap-3 py-3 pl-3",
				default: "gap-4 py-5 pl-4",
				lg: "gap-4 py-6 pl-5",
			},
		},
		defaultVariants: {
			size: "default",
		},
	},
)

type VerticalTabsSize = NonNullable<VariantProps<typeof verticalTabsTriggerVariants>["size"]>

const labelSizeClasses: Record<VerticalTabsSize, string> = {
	sm: "text-base",
	default: "text-xl md:text-2xl",
	lg: "text-2xl md:text-3xl",
}

const descriptionSizeClasses: Record<VerticalTabsSize, string> = {
	sm: "text-xs",
	default: "text-xs md:text-sm",
	lg: "text-sm md:text-base",
}

/**
 * Panel slide: source used `y: spring(260, 32)` + `opacity: 0.4s` — the y
 * travel rides the semantic panel spring, the crossfade rides the `slow`
 * duration token with the `decelerate` easing token.
 */
const panelTransition: Transition = {
	y: semanticTransitions.panel,
	opacity: { duration: durations.slow, ease: easings.decelerate },
}

/**
 * Description reveal: source used `duration: 0.3, ease: [0.23, 1, 0.32, 1]` —
 * mapped to the `base` duration token + `iconiqSoft` easing token.
 */
const descriptionTransition: Transition = {
	duration: durations.base,
	ease: easings.iconiqSoft,
}

const panelVariants: Variants = {
	enter: (direction: number) => ({
		y: direction > 0 ? "-100%" : "100%",
		opacity: 0,
	}),
	center: { zIndex: 1, y: "0%", opacity: 1 },
	exit: (direction: number) => ({
		zIndex: 0,
		y: direction > 0 ? "100%" : "-100%",
		opacity: 0,
	}),
}

interface VerticalTabsItem {
	/** Stable identifier for this tab. */
	value: string
	/** Rail heading for this tab. */
	label: ReactNode
	/** Supporting copy revealed under the label while the tab is active. */
	description?: ReactNode
	/** Panel content shown while this tab is active. */
	content: ReactNode
}

interface VerticalTabsProps
	extends Omit<ComponentProps<"div">, "children">,
		VariantProps<typeof verticalTabsTriggerVariants> {
	items: VerticalTabsItem[]
	/** Controlled active tab value. */
	value?: string
	/** Uncontrolled initial active tab value. Defaults to the first item. */
	defaultValue?: string
	onValueChange?: (value: string) => void
	/**
	 * Milliseconds between auto-advances; `0` (default) disables auto-play.
	 * Auto-play pauses while the panel is hovered and is fully disabled when
	 * the user prefers reduced motion.
	 */
	autoPlayInterval?: number
	/** Show the previous/next controls overlaying the panel. */
	showControls?: boolean
	/** Show the `/01`-style index column in the rail. */
	showIndex?: boolean
	/** Extra classes for the rail (tablist) column. */
	listClassName?: string
	/** Extra classes for the panel viewport, e.g. to override `aspect-4/3`. */
	panelClassName?: string
}

function VerticalTabs({
	className,
	items,
	value: valueProp,
	defaultValue,
	onValueChange,
	autoPlayInterval = 0,
	showControls = true,
	showIndex = true,
	size = "default",
	listClassName,
	panelClassName,
	...props
}: VerticalTabsProps) {
	const reducedMotion = useReducedMotion()
	const baseId = useId()
	const [value, setValue] = useControllableState({
		prop: valueProp,
		defaultProp: defaultValue ?? items[0]?.value ?? "",
		onChange: onValueChange,
	})
	const [direction, setDirection] = useState(1)
	const [isPaused, setIsPaused] = useState(false)

	const resolvedSize: VerticalTabsSize = size ?? "default"
	const itemCount = items.length
	const activeIndex = Math.max(
		items.findIndex((item) => item.value === value),
		0,
	)
	const activeItem = items[activeIndex]

	// Reduced motion must stop the ambient auto-advance loop entirely.
	const autoPlayEnabled = autoPlayInterval > 0 && itemCount > 1 && !reducedMotion

	const selectIndex = useCallback(
		(index: number, nextDirection?: number) => {
			const item = items[index]
			if (!item || index === activeIndex) return
			setDirection(nextDirection ?? (index > activeIndex ? 1 : -1))
			setValue(item.value)
		},
		[items, activeIndex, setValue],
	)

	const goNext = useCallback(() => {
		selectIndex((activeIndex + 1) % itemCount, 1)
	}, [selectIndex, activeIndex, itemCount])

	const goPrev = useCallback(() => {
		selectIndex((activeIndex - 1 + itemCount) % itemCount, -1)
	}, [selectIndex, activeIndex, itemCount])

	useEffect(() => {
		if (!autoPlayEnabled || isPaused) return
		const interval = setInterval(goNext, autoPlayInterval)
		return () => clearInterval(interval)
	}, [autoPlayEnabled, isPaused, autoPlayInterval, goNext])

	if (!activeItem) return null

	const panelId = `${baseId}-panel`
	const tabId = (itemValue: string) => `${baseId}-tab-${itemValue}`

	return (
		<div
			data-slot="vertical-tabs"
			data-size={resolvedSize}
			className={cn("grid items-start gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]", className)}
			{...props}
		>
			<div
				role="tablist"
				aria-orientation="vertical"
				data-slot="vertical-tabs-list"
				className={cn("flex flex-col", listClassName)}
			>
				{items.map((item, index) => {
					const isActive = index === activeIndex
					return (
						<button
							key={item.value}
							type="button"
							role="tab"
							id={tabId(item.value)}
							aria-selected={isActive}
							aria-controls={panelId}
							data-slot="vertical-tabs-trigger"
							data-active={isActive ? "" : undefined}
							onClick={() => {
								selectIndex(index)
								setIsPaused(false)
							}}
							className={cn(verticalTabsTriggerVariants({ size: resolvedSize }))}
						>
							<div
								aria-hidden="true"
								data-slot="vertical-tabs-indicator"
								className="absolute inset-y-0 left-0 w-0.5 bg-muted"
							>
								{isActive &&
									(autoPlayEnabled ? (
										// Auto-play progress fill: duration is data (the
										// configured interval), easing is the `linear` token.
										<motion.div
											key={`progress-${activeIndex}-${isPaused}`}
											className="absolute top-0 left-0 w-full origin-top bg-primary"
											initial={{ height: "0%" }}
											animate={{ height: isPaused ? "0%" : "100%" }}
											transition={{
												duration: autoPlayInterval / 1000,
												ease: easings.linear,
											}}
										/>
									) : (
										<motion.div
											className="absolute top-0 left-0 w-full origin-top bg-primary"
											initial={{ height: "0%" }}
											animate={{ height: "100%" }}
											transition={
												reducedMotion ? reducedMotionTransition : semanticTransitions.indicator
											}
										/>
									))}
							</div>

							{showIndex && (
								<span
									aria-hidden="true"
									data-slot="vertical-tabs-index"
									className="mt-1 text-xs font-medium tabular-nums opacity-50"
								>
									/{String(index + 1).padStart(2, "0")}
								</span>
							)}

							<div className="flex flex-1 flex-col gap-1">
								<span
									data-slot="vertical-tabs-label"
									className={cn("font-normal tracking-tight", labelSizeClasses[resolvedSize])}
								>
									{item.label}
								</span>

								<AnimatePresence mode="wait">
									{isActive && item.description != null && (
										<motion.div
											initial={{ opacity: 0, height: 0 }}
											animate={{ opacity: 1, height: "auto" }}
											exit={{ opacity: 0, height: 0 }}
											transition={reducedMotion ? reducedMotionTransition : descriptionTransition}
											className="overflow-hidden"
										>
											<p
												data-slot="vertical-tabs-description"
												className={cn(
													"max-w-sm pb-1 leading-relaxed font-normal text-muted-foreground",
													descriptionSizeClasses[resolvedSize],
												)}
											>
												{item.description}
											</p>
										</motion.div>
									)}
								</AnimatePresence>
							</div>
						</button>
					)
				})}
			</div>

			<div
				role="tabpanel"
				id={panelId}
				aria-labelledby={tabId(activeItem.value)}
				data-slot="vertical-tabs-panel"
				onMouseEnter={() => setIsPaused(true)}
				onMouseLeave={() => setIsPaused(false)}
				className={cn(
					"relative aspect-4/3 overflow-hidden rounded-3xl border border-border/40 bg-muted/30",
					panelClassName,
				)}
			>
				<AnimatePresence initial={false} custom={direction} mode="popLayout">
					<motion.div
						key={activeItem.value}
						custom={direction}
						variants={panelVariants}
						initial="enter"
						animate="center"
						exit="exit"
						transition={reducedMotion ? reducedMotionTransition : panelTransition}
						data-slot="vertical-tabs-panel-content"
						className="absolute inset-0 size-full"
					>
						{activeItem.content}
					</motion.div>
				</AnimatePresence>

				{showControls && itemCount > 1 && (
					<>
						<div
							aria-hidden="true"
							data-slot="vertical-tabs-scrim"
							className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1/3 bg-linear-to-t from-(--ff-overlay)/40 via-transparent to-transparent"
						/>
						<div
							data-slot="vertical-tabs-controls"
							className="absolute right-4 bottom-4 z-20 flex gap-2"
						>
							<button
								type="button"
								aria-label="Previous tab"
								onClick={goPrev}
								className="flex size-10 items-center justify-center rounded-full border border-border/50 bg-background/80 text-foreground outline-none backdrop-blur-(--blur-md) transition-[background-color,scale] duration-(--duration-fast) ease-(--ease-out) hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-90 motion-reduce:transition-none"
							>
								<ChevronLeftIcon className="size-5" />
							</button>
							<button
								type="button"
								aria-label="Next tab"
								onClick={goNext}
								className="flex size-10 items-center justify-center rounded-full border border-border/50 bg-background/80 text-foreground outline-none backdrop-blur-(--blur-md) transition-[background-color,scale] duration-(--duration-fast) ease-(--ease-out) hover:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-90 motion-reduce:transition-none"
							>
								<ChevronRightIcon className="size-5" />
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	)
}

export type { VerticalTabsItem, VerticalTabsProps, VerticalTabsSize }
export { VerticalTabs, verticalTabsTriggerVariants }
