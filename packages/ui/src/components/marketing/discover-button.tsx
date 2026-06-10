"use client"

import { Input } from "@ch5me/elf-ui/components/input"
import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { FlameIcon, HeartIcon, SearchIcon, XIcon } from "lucide-react"
import type { Transition } from "motion/react"
import { motion, useReducedMotion } from "motion/react"
import type * as React from "react"
import { useId, useRef, useState } from "react"

/**
 * DiscoverButton — a floating discover/filter bar made of two pills: a search
 * pill that morphs from an icon button into a full-width input, and a tab
 * pill whose active tab carries a shared-layout highlight bubble. Expanding
 * the search collapses the tabs into a close button.
 *
 * Ported from uselayouts "Discover Button", re-expressed in CH5 semantic
 * design + motion tokens (dark-mode safe, reduced-motion = instant).
 *
 * ```tsx
 * <DiscoverButton
 *   tabs={[
 *     { id: "popular", label: "Popular", icon: FlameIcon },
 *     { id: "favorites", label: "Favorites", icon: HeartIcon },
 *   ]}
 *   onSearchValueChange={setQuery}
 * />
 * ```
 */

type DiscoverButtonTab = {
	/** Stable identity used for selection state. */
	id: string
	/** Tab label text. */
	label: string
	/** Leading lucide icon; filled with the current color while active. */
	icon: LucideIcon
}

const DEFAULT_TABS: readonly DiscoverButtonTab[] = [
	{ id: "popular", label: "Popular", icon: FlameIcon },
	{ id: "favorites", label: "Favorites", icon: HeartIcon },
]

type DiscoverButtonProps = Omit<React.ComponentProps<"div">, "onChange"> & {
	/** Tabs shown in the trailing pill. */
	tabs?: readonly DiscoverButtonTab[]
	/** Controlled active tab id. */
	value?: string
	/** Uncontrolled initial active tab id (defaults to the first tab). */
	defaultValue?: string
	onValueChange?: (value: string) => void
	/** Controlled search-expanded state. */
	searchExpanded?: boolean
	/** Uncontrolled initial search-expanded state. */
	defaultSearchExpanded?: boolean
	onSearchExpandedChange?: (expanded: boolean) => void
	/** Controlled search input value. */
	searchValue?: string
	/** Uncontrolled initial search input value. */
	defaultSearchValue?: string
	onSearchValueChange?: (value: string) => void
	searchPlaceholder?: string
}

function DiscoverButton({
	className,
	tabs = DEFAULT_TABS,
	value: valueProp,
	defaultValue,
	onValueChange,
	searchExpanded: searchExpandedProp,
	defaultSearchExpanded = false,
	onSearchExpandedChange,
	searchValue: searchValueProp,
	defaultSearchValue = "",
	onSearchValueChange,
	searchPlaceholder = "Search",
	...props
}: DiscoverButtonProps) {
	const reducedMotion = useReducedMotion()
	const bubbleLayoutId = useId()
	const inputRef = useRef<HTMLInputElement>(null)

	const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? tabs[0]?.id)
	const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultSearchExpanded)
	const [uncontrolledSearchValue, setUncontrolledSearchValue] = useState(defaultSearchValue)

	const activeTab = valueProp !== undefined ? valueProp : uncontrolledValue
	const isSearchExpanded =
		searchExpandedProp !== undefined ? searchExpandedProp : uncontrolledExpanded
	const searchValue = searchValueProp !== undefined ? searchValueProp : uncontrolledSearchValue

	const setActiveTab = (next: string) => {
		if (valueProp === undefined) setUncontrolledValue(next)
		onValueChange?.(next)
	}

	const setSearchExpanded = (next: boolean) => {
		if (searchExpandedProp === undefined) setUncontrolledExpanded(next)
		onSearchExpandedChange?.(next)
		if (next) {
			// Focus once the input has begun revealing.
			requestAnimationFrame(() => inputRef.current?.focus())
		}
	}

	// Pill width/flex morphs are layout shifts -> semantic layout spring.
	const layoutTransition: Transition = reducedMotion
		? reducedMotionTransition
		: semanticTransitions.layout
	// Source crossfades used `duration: 0.2` -> `base` duration token.
	const crossfadeTransition: Transition = reducedMotion
		? reducedMotionTransition
		: { duration: durations.base, ease: easings.standard }
	// Active-tab highlight bubble is a state indicator -> indicator spring.
	const bubbleTransition: Transition = reducedMotion
		? reducedMotionTransition
		: semanticTransitions.indicator

	return (
		<div
			className={cn("flex items-center gap-3", className)}
			data-slot="discover-button"
			{...props}
		>
			{/* Search pill: icon button that morphs into a full-width input. */}
			<motion.div
				className={cn(
					"relative flex h-14 cursor-pointer items-center overflow-hidden rounded-full bg-card px-4 text-card-foreground shadow-[var(--shadow-layered)]",
					isSearchExpanded && "flex-1",
				)}
				data-slot="discover-button-search"
				layout
				onClick={() => {
					if (!isSearchExpanded) setSearchExpanded(true)
				}}
				transition={layoutTransition}
			>
				<button
					aria-expanded={isSearchExpanded}
					aria-label="Expand search"
					className="flex shrink-0 cursor-pointer items-center justify-center text-foreground outline-none"
					data-slot="discover-button-search-trigger"
					type="button"
				>
					<SearchIcon aria-hidden="true" className="size-6" />
				</button>
				<motion.div
					animate={{
						width: isSearchExpanded ? "auto" : "0px",
						opacity: isSearchExpanded ? 1 : 0,
						filter: isSearchExpanded ? "blur(0px)" : "blur(4px)",
						marginLeft: isSearchExpanded ? "12px" : "0px",
					}}
					className="flex items-center overflow-hidden"
					data-slot="discover-button-search-field"
					initial={false}
					transition={layoutTransition}
				>
					<Input
						aria-label={searchPlaceholder}
						className="w-full border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
						onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
							if (searchValueProp === undefined) setUncontrolledSearchValue(event.target.value)
							onSearchValueChange?.(event.target.value)
						}}
						onClick={(event: React.MouseEvent<HTMLInputElement>) => event.stopPropagation()}
						placeholder={searchPlaceholder}
						ref={inputRef}
						tabIndex={isSearchExpanded ? 0 : -1}
						type="text"
						value={searchValue}
					/>
				</motion.div>
			</motion.div>

			{/* Tab pill: collapses into a close button while search is expanded. */}
			<motion.div
				className="relative flex h-14 items-center overflow-hidden rounded-full bg-card text-card-foreground shadow-[var(--shadow-layered)]"
				data-slot="discover-button-tabs"
				layout
				transition={layoutTransition}
			>
				{/* Clipping wrapper: collapses to a square close target (3.5rem = h-14). */}
				<motion.div
					animate={{ width: isSearchExpanded ? "3.5rem" : "auto" }}
					className="relative flex h-full items-center overflow-hidden"
					initial={false}
					transition={layoutTransition}
				>
					{/* Tabs group: stays in place, gets clipped from the right. */}
					<motion.div
						animate={{
							opacity: isSearchExpanded ? 0 : 1,
							filter: isSearchExpanded ? "blur(4px)" : "blur(0px)",
							width: "auto",
						}}
						className="flex items-center whitespace-nowrap"
						initial={false}
						role="tablist"
						transition={crossfadeTransition}
					>
						<div className="flex items-center gap-2 px-1.5">
							{tabs.map((tab) => {
								const isActive = activeTab === tab.id
								return (
									<button
										aria-selected={isActive}
										className={cn(
											"relative flex cursor-pointer items-center gap-2 rounded-full px-6 py-3 outline-none transition-colors",
											isActive
												? "text-accent-foreground"
												: "text-muted-foreground hover:text-foreground",
										)}
										data-active={isActive ? "" : undefined}
										data-slot="discover-button-tab"
										key={tab.id}
										onClick={() => setActiveTab(tab.id)}
										role="tab"
										tabIndex={isSearchExpanded ? -1 : 0}
										type="button"
									>
										{isActive && (
											<motion.span
												className="absolute inset-0 z-0 rounded-full bg-accent"
												data-slot="discover-button-tab-bubble"
												layoutId={bubbleLayoutId}
												transition={bubbleTransition}
											/>
										)}
										<tab.icon
											aria-hidden="true"
											className={cn("relative z-10 size-5", isActive && "fill-current")}
										/>
										<span className="relative z-10 font-mono font-semibold text-sm uppercase">
											{tab.label}
										</span>
									</button>
								)
							})}
						</div>
					</motion.div>

					{/* Close button: layered over the collapsed tabs. */}
					<motion.div
						animate={{
							opacity: isSearchExpanded ? 1 : 0,
							filter: isSearchExpanded ? "blur(0px)" : "blur(4px)",
						}}
						className="absolute inset-0 flex items-center justify-center"
						data-slot="discover-button-close"
						initial={false}
						style={{ pointerEvents: isSearchExpanded ? "auto" : "none" }}
						transition={crossfadeTransition}
					>
						<button
							aria-label="Close search"
							className="shrink-0 cursor-pointer text-foreground outline-none"
							onClick={() => setSearchExpanded(false)}
							tabIndex={isSearchExpanded ? 0 : -1}
							type="button"
						>
							<XIcon aria-hidden="true" className="size-6" />
						</button>
					</motion.div>
				</motion.div>
			</motion.div>
		</div>
	)
}

export type { DiscoverButtonProps, DiscoverButtonTab }
export { DiscoverButton }
