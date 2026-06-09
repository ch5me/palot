"use client"

import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import type { HTMLMotionProps, Transition } from "motion/react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"
import type { ComponentProps, ReactNode } from "react"
import { Children, createContext, useContext, useId, useMemo } from "react"

/**
 * AnimatedCollection — a collection whose items morph between "list", "card"
 * and "pack" (stacked deck) views with shared-element layout transitions.
 * Item media resizes/repositions across views, item text crossfades out when
 * the collection packs up, and an optional caption reveals under the pack.
 *
 * Ported from uselayouts "Animated Collection", re-expressed in CH5 semantic
 * motion tokens and design-system tokens. Directly reusable for sessions /
 * attachments / queue lists that need animated reflow.
 *
 * ```tsx
 * const [view, setView] = useState<AnimatedCollectionView>("list")
 *
 * <AnimatedCollection view={view}>
 *   <AnimatedCollectionViewToggle value={view} onValueChange={setView} />
 *   <AnimatedCollectionList>
 *     {items.map((item, index) => (
 *       <AnimatedCollectionItem key={item.id} index={index}>
 *         <AnimatedCollectionItemMedia>
 *           <img src={item.image} alt={item.title} />
 *         </AnimatedCollectionItemMedia>
 *         <AnimatedCollectionItemContent>
 *           <div className="flex min-w-0 flex-col gap-0.5">
 *             <h3 className="truncate text-sm font-medium">{item.title}</h3>
 *             <span className="text-xs text-muted-foreground">{item.subtitle}</span>
 *           </div>
 *         </AnimatedCollectionItemContent>
 *       </AnimatedCollectionItem>
 *     ))}
 *   </AnimatedCollectionList>
 *   <AnimatedCollectionCaption>Bundle unlocked</AnimatedCollectionCaption>
 * </AnimatedCollection>
 * ```
 */

type AnimatedCollectionView = "list" | "card" | "pack"

type AnimatedCollectionPackTransform = {
	rotate: number
	x: number
	y: number
}

/**
 * Default fanned-deck placement: items alternate left/right of the stack
 * center, with deeper pairs fanning slightly further out.
 */
function defaultPackTransform(index: number): AnimatedCollectionPackTransform {
	const direction = index % 2 === 0 ? -1 : 1
	const layer = Math.floor(index / 2)
	return {
		rotate: direction * ((index % 2 === 0 ? 12 : 6) + layer * 2),
		x: direction * (25 + layer * 6),
		y: direction * (5 + layer * 3),
	}
}

type AnimatedCollectionContextValue = {
	view: AnimatedCollectionView
	/** Number of items in the nearest AnimatedCollectionList (0 outside one). */
	itemCount: number
	packTransform: (index: number, itemCount: number) => AnimatedCollectionPackTransform
}

const AnimatedCollectionContext = createContext<AnimatedCollectionContextValue | null>(null)

function useAnimatedCollectionContext(component: string): AnimatedCollectionContextValue {
	const context = useContext(AnimatedCollectionContext)
	if (!context) {
		throw new Error(`${component} must be used within an AnimatedCollection root`)
	}
	return context
}

function useLayoutMorphTransition(): Transition {
	const reducedMotion = useReducedMotion()
	// All view morphs (container reflow, item reposition, media resize) ride
	// the semantic layout spring; reduced motion snaps to the final state.
	return reducedMotion ? reducedMotionTransition : semanticTransitions.layout
}

type AnimatedCollectionProps = ComponentProps<"div"> & {
	/** Active view mode (controlled by the caller). */
	view?: AnimatedCollectionView
	/** Override the fanned-deck placement of items in the "pack" view. */
	packTransform?: (index: number, itemCount: number) => AnimatedCollectionPackTransform
}

function AnimatedCollection({
	className,
	view = "list",
	packTransform = defaultPackTransform,
	children,
	...props
}: AnimatedCollectionProps) {
	const contextValue = useMemo(() => ({ view, itemCount: 0, packTransform }), [view, packTransform])

	return (
		<div
			data-slot="animated-collection"
			data-view={view}
			className={cn("relative flex w-full flex-col gap-6", className)}
			{...props}
		>
			<AnimatedCollectionContext.Provider value={contextValue}>
				<LayoutGroup>{children}</LayoutGroup>
			</AnimatedCollectionContext.Provider>
		</div>
	)
}

type AnimatedCollectionListProps = Omit<HTMLMotionProps<"div">, "children"> & {
	/**
	 * Item count used for pack stacking order. Defaults to counting direct
	 * children — pass explicitly when items are wrapped in fragments.
	 */
	itemCount?: number
	children?: ReactNode
}

function AnimatedCollectionList({
	className,
	itemCount,
	children,
	...props
}: AnimatedCollectionListProps) {
	const context = useAnimatedCollectionContext("AnimatedCollectionList")
	const layoutTransition = useLayoutMorphTransition()
	const count = itemCount ?? Children.count(children)
	const listContextValue = useMemo(() => ({ ...context, itemCount: count }), [context, count])

	return (
		<motion.div
			data-slot="animated-collection-list"
			data-view={context.view}
			role="list"
			layout
			transition={layoutTransition}
			className={cn(
				"relative w-full",
				context.view === "list" && "flex flex-col gap-4",
				context.view === "card" && "grid grid-cols-2 gap-4",
				context.view === "pack" && "flex h-64 items-center justify-center",
				className,
			)}
			{...props}
		>
			<AnimatedCollectionContext.Provider value={listContextValue}>
				{children}
			</AnimatedCollectionContext.Provider>
		</motion.div>
	)
}

type AnimatedCollectionItemProps = HTMLMotionProps<"div"> & {
	/** Position of this item within the list (drives pack fanning/stacking). */
	index: number
}

function AnimatedCollectionItem({
	className,
	index,
	style,
	children,
	...props
}: AnimatedCollectionItemProps) {
	const { view, itemCount, packTransform } = useAnimatedCollectionContext("AnimatedCollectionItem")
	const layoutTransition = useLayoutMorphTransition()

	const packed = view === "pack"
	const target = packed ? packTransform(index, itemCount) : { rotate: 0, x: 0, y: 0 }

	return (
		<motion.div
			data-slot="animated-collection-item"
			data-view={view}
			role="listitem"
			layout
			animate={target}
			transition={layoutTransition}
			className={cn(
				"relative flex items-center",
				view === "list" && "w-full flex-row gap-4",
				view === "card" && "w-full flex-col items-start gap-3",
				view === "pack" && "absolute size-56 justify-center",
				className,
			)}
			// Earlier items sit on top of the pack (the deck fans out from the
			// first item); outside the pack every item shares one layer.
			style={{ zIndex: packed ? Math.max(itemCount - index, 1) : 1, ...style }}
			{...props}
		>
			{children}
		</motion.div>
	)
}

function AnimatedCollectionItemMedia({ className, children, ...props }: HTMLMotionProps<"div">) {
	const { view } = useAnimatedCollectionContext("AnimatedCollectionItemMedia")
	const layoutTransition = useLayoutMorphTransition()

	return (
		<motion.div
			data-slot="animated-collection-item-media"
			data-view={view}
			layout
			transition={layoutTransition}
			className={cn(
				"relative shrink-0 overflow-hidden border border-border/50 bg-muted",
				"[&_img]:block [&_img]:size-full [&_img]:object-cover [&_video]:size-full [&_video]:object-cover",
				view === "list" && "size-16 rounded-2xl",
				view === "card" && "aspect-square w-full rounded-4xl shadow-[var(--ff-shadow-sm)]",
				view === "pack" && "size-full rounded-4xl shadow-[var(--ff-shadow-xl)]",
				className,
			)}
			{...props}
		>
			{children}
		</motion.div>
	)
}

/**
 * Info crossfade: source used `duration: 0.1, ease: "linear"` — mapped to the
 * `fast` duration token + `linear` easing token.
 */
const contentFadeTransition: Transition = {
	duration: durations.fast,
	ease: easings.linear,
}

function AnimatedCollectionItemContent({ className, children, ...props }: HTMLMotionProps<"div">) {
	const { view } = useAnimatedCollectionContext("AnimatedCollectionItemContent")
	const reducedMotion = useReducedMotion()

	return (
		<AnimatePresence mode="popLayout" initial={false}>
			{view !== "pack" && (
				<motion.div
					data-slot="animated-collection-item-content"
					data-view={view}
					layout
					initial={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
					animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
					exit={{ opacity: 0, scale: 0.9, filter: "blur(4px)" }}
					transition={reducedMotion ? reducedMotionTransition : contentFadeTransition}
					className={cn(
						"flex min-w-0 flex-1 items-center justify-between",
						view === "card" && "w-full px-1",
						className,
					)}
					{...props}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

/**
 * Caption reveal: source used `duration: 0.3, delay: 0.1, ease` defaults —
 * mapped to the `base` duration + `decelerate` easing, with the delay derived
 * from the `fast` duration token. Exit rides the semantic exit transition.
 */
const captionEnterTransition: Transition = {
	duration: durations.base,
	delay: durations.fast / 1.5,
	ease: easings.decelerate,
}

function AnimatedCollectionCaption({ className, children, ...props }: HTMLMotionProps<"div">) {
	const { view } = useAnimatedCollectionContext("AnimatedCollectionCaption")
	const reducedMotion = useReducedMotion()

	return (
		<AnimatePresence>
			{view === "pack" && (
				<motion.div
					data-slot="animated-collection-caption"
					layout
					initial={{ opacity: 0, y: 10, filter: "blur(5px)" }}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					exit={{
						opacity: 0,
						y: 5,
						filter: "blur(5px)",
						transition: reducedMotion ? reducedMotionTransition : semanticTransitions.exit,
					}}
					transition={reducedMotion ? reducedMotionTransition : captionEnterTransition}
					className={cn("relative z-0 text-center", className)}
					{...props}
				>
					{children}
				</motion.div>
			)}
		</AnimatePresence>
	)
}

type AnimatedCollectionViewToggleOption = {
	value: AnimatedCollectionView
	label: ReactNode
	/** Leading icon (lucide-react icon element). */
	icon?: ReactNode
}

const defaultViewToggleOptions: AnimatedCollectionViewToggleOption[] = [
	{ value: "list", label: "List" },
	{ value: "card", label: "Card" },
	{ value: "pack", label: "Pack" },
]

type AnimatedCollectionViewToggleProps = Omit<ComponentProps<"div">, "onChange"> & {
	/** Active view (controlled). */
	value: AnimatedCollectionView
	onValueChange: (view: AnimatedCollectionView) => void
	options?: AnimatedCollectionViewToggleOption[]
}

function AnimatedCollectionViewToggle({
	className,
	value,
	onValueChange,
	options = defaultViewToggleOptions,
	...props
}: AnimatedCollectionViewToggleProps) {
	const reducedMotion = useReducedMotion()
	const indicatorLayoutId = useId()
	const indicatorTransition = reducedMotion
		? reducedMotionTransition
		: semanticTransitions.indicator

	return (
		<div
			role="tablist"
			data-slot="animated-collection-view-toggle"
			className={cn("flex w-fit items-center rounded-full border bg-muted p-1", className)}
			{...props}
		>
			{options.map((option) => {
				const isActive = option.value === value
				return (
					<button
						key={option.value}
						type="button"
						role="tab"
						aria-selected={isActive}
						data-slot="animated-collection-view-toggle-item"
						data-active={isActive ? "" : undefined}
						onClick={() => onValueChange(option.value)}
						className={cn(
							"relative inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
							isActive
								? "text-primary-foreground"
								: "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
						)}
					>
						{isActive && (
							<motion.span
								layoutId={indicatorLayoutId}
								data-slot="animated-collection-view-toggle-indicator"
								aria-hidden="true"
								className="absolute inset-0 rounded-full bg-primary shadow-[var(--ff-shadow-md)]"
								transition={indicatorTransition}
							/>
						)}
						<span className="relative z-10 flex items-center gap-2">
							{option.icon ? (
								<span aria-hidden="true" className="flex shrink-0 items-center justify-center">
									{option.icon}
								</span>
							) : null}
							{option.label}
						</span>
					</button>
				)
			})}
		</div>
	)
}

export type {
	AnimatedCollectionItemProps,
	AnimatedCollectionListProps,
	AnimatedCollectionPackTransform,
	AnimatedCollectionProps,
	AnimatedCollectionView,
	AnimatedCollectionViewToggleOption,
	AnimatedCollectionViewToggleProps,
}
export {
	AnimatedCollection,
	AnimatedCollectionCaption,
	AnimatedCollectionItem,
	AnimatedCollectionItemContent,
	AnimatedCollectionItemMedia,
	AnimatedCollectionList,
	AnimatedCollectionViewToggle,
}
