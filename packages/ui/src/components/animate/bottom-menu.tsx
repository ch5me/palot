"use client"

import { useControllableState } from "@ch5me/elf-ui/hooks/use-controllable-state"
import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import type { LucideIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type * as React from "react"
import { useEffect, useRef } from "react"
import useMeasure from "react-use-measure"

/**
 * Shared floating "glass pill" chrome for the dock bar and the expanding
 * panel. Uses the palot glass recipe (popover surface at elevated glass
 * opacity + theme blur) so all three chrome tiers render it correctly —
 * never raw rgba + ad hoc backdrop-blur.
 */
const glassSurface =
	"text-popover-foreground rounded-2xl border bg-[color-mix(in_srgb,var(--popover)_var(--glass-elevated),transparent)] backdrop-blur-(--blur-lg)"

export interface BottomMenuItem {
	/** Stable id; becomes the menu `value` while this item's panel is open. */
	id: string
	/** Accessible name for the trigger (icon-only button). */
	label: string
	icon: LucideIcon
	/**
	 * Panel content revealed above the bar while this item is active. The
	 * panel auto-sizes to this content (give it an intrinsic width, e.g.
	 * `min-w-*`). Omit for plain action buttons that only fire `onSelect`.
	 */
	content?: React.ReactNode
	/** Called when the trigger is pressed (before the panel toggles). */
	onSelect?: () => void
}

export interface BottomMenuProps extends Omit<React.ComponentProps<"div">, "defaultValue"> {
	items: BottomMenuItem[]
	/** Active item id (controlled). `null` means closed. */
	value?: string | null
	/** Initially active item id (uncontrolled). */
	defaultValue?: string | null
	/** Fires with the new active item id, or `null` when the menu closes. */
	onValueChange?: (value: string | null) => void
}

/**
 * Floating dock / quick-actions pill. An icon bar that expands a glass panel
 * above itself, morphing the panel's width and height to fit the active
 * item's content (measured off-screen) and cross-fading between views.
 * Closes on outside click or Escape.
 */
function BottomMenu({
	items,
	value: valueProp,
	defaultValue = null,
	onValueChange,
	className,
	onKeyDown,
	...props
}: BottomMenuProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [measureRef, measuredBounds] = useMeasure()
	const reducedMotion = useReducedMotion()
	const [value, setValue] = useControllableState<string | null>({
		prop: valueProp,
		defaultProp: defaultValue,
		onChange: onValueChange,
	})

	const activeItem = items.find((item) => item.id === value && item.content != null) ?? null

	useEffect(() => {
		const handlePointerDown = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setValue(null)
			}
		}
		document.addEventListener("mousedown", handlePointerDown)
		return () => document.removeEventListener("mousedown", handlePointerDown)
	}, [setValue])

	// Panel open/close is an overlay enter/exit; the width/height morph
	// between views is a layout shift — each gets its semantic transition.
	const expandTransition = reducedMotion
		? reducedMotionTransition
		: {
				default: semanticTransitions.overlayEnter,
				width: semanticTransitions.layout,
				height: semanticTransitions.layout,
			}
	const collapseTransition = reducedMotion
		? reducedMotionTransition
		: semanticTransitions.overlayExit
	const viewSwapTransition = reducedMotion
		? reducedMotionTransition
		: { duration: durations.base, ease: easings.standard }

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Escape-key listener catches bubbled keydown from focusable children; the container itself is not interactive
		<div
			ref={containerRef}
			data-slot="bottom-menu"
			className={cn("relative flex flex-col items-center", className)}
			onKeyDown={(event) => {
				onKeyDown?.(event)
				if (event.key === "Escape") setValue(null)
			}}
			{...props}
		>
			{/* Off-screen copy of the active content, measured to drive the panel morph. */}
			<div
				ref={measureRef}
				aria-hidden="true"
				data-slot="bottom-menu-measure"
				className="pointer-events-none invisible absolute top-[-9999px] left-[-9999px]"
			>
				<div className="rounded-2xl border py-1">{activeItem?.content}</div>
			</div>

			<AnimatePresence mode="wait">
				{activeItem != null && (
					<motion.div
						key="panel"
						data-slot="bottom-menu-panel"
						initial={{ opacity: 0, scaleY: 0.9, scaleX: 0.95, height: 0, width: 0 }}
						animate={{
							opacity: 1,
							scaleY: 1,
							scaleX: 1,
							height: measuredBounds.height || "auto",
							width: measuredBounds.width || "auto",
						}}
						exit={{
							opacity: 0,
							scaleY: 0.9,
							scaleX: 0.95,
							height: 0,
							width: 0,
							transition: collapseTransition,
						}}
						transition={expandTransition}
						style={{ transformOrigin: "bottom center" }}
						className="absolute bottom-[calc(100%+0.5rem)] overflow-hidden"
					>
						<div data-slot="bottom-menu-panel-surface" className={glassSurface}>
							<AnimatePresence initial={false} mode="popLayout">
								<motion.div
									key={activeItem.id}
									data-slot="bottom-menu-panel-content"
									initial={{ opacity: 0, scale: 0.96, filter: "blur(12px)" }}
									animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
									exit={{ opacity: 0, scale: 0.95, filter: "blur(12px)" }}
									transition={viewSwapTransition}
									className="py-1"
								>
									{activeItem.content}
								</motion.div>
							</AnimatePresence>
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<nav
				data-slot="bottom-menu-bar"
				className={cn("z-10 flex items-center gap-1 p-1", glassSurface)}
			>
				{items.map((item) => {
					const isActive = item.id === value
					const Icon = item.icon
					return (
						<button
							key={item.id}
							type="button"
							data-slot="bottom-menu-trigger"
							data-active={isActive || undefined}
							aria-label={item.label}
							aria-expanded={item.content != null ? isActive : undefined}
							onClick={() => {
								item.onSelect?.()
								setValue(item.content != null && !isActive ? item.id : null)
							}}
							className={cn(
								"cursor-pointer rounded-xl p-3 transition-colors duration-(--duration-fast) ease-(--ease-out)",
								isActive
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
						>
							<Icon className="size-5" aria-hidden="true" />
						</button>
					)
				})}
			</nav>
		</div>
	)
}

export interface BottomMenuRowProps extends React.ComponentProps<"button"> {
	icon?: LucideIcon
}

/** Standard panel row: full-width quiet button with an optional leading icon. */
function BottomMenuRow({ icon: Icon, className, children, ...props }: BottomMenuRowProps) {
	return (
		<button
			type="button"
			data-slot="bottom-menu-row"
			className={cn(
				"group/bottom-menu-row flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-muted/80 hover:text-foreground",
				className,
			)}
			{...props}
		>
			{Icon ? (
				<Icon
					aria-hidden="true"
					className="size-5 text-muted-foreground transition-colors duration-(--duration-fast) ease-(--ease-out) group-hover/bottom-menu-row:text-foreground"
				/>
			) : null}
			{children}
		</button>
	)
}

export interface BottomMenuOption {
	value: string
	label: string
	icon?: LucideIcon
}

export interface BottomMenuOptionGroupProps
	extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
	options: BottomMenuOption[]
	/** Selected option value (controlled). */
	value?: string
	/** Initially selected option value (uncontrolled). */
	defaultValue?: string
	onValueChange?: (value: string) => void
}

/**
 * Segmented single-select row for panel content (the source component's
 * theme picker, generalized): one pill per option, selected option gets the
 * accent treatment.
 */
function BottomMenuOptionGroup({
	options,
	value: valueProp,
	defaultValue,
	onValueChange,
	className,
	...props
}: BottomMenuOptionGroupProps) {
	const [value, setValue] = useControllableState<string | undefined>({
		prop: valueProp,
		defaultProp: defaultValue,
		onChange: (next) => {
			if (next !== undefined) onValueChange?.(next)
		},
	})

	return (
		<div
			role="radiogroup"
			data-slot="bottom-menu-option-group"
			className={cn("flex items-center justify-between gap-1.5", className)}
			{...props}
		>
			{options.map((option) => {
				const isSelected = option.value === value
				const Icon = option.icon
				return (
					<button
						key={option.value}
						type="button"
						role="radio"
						aria-checked={isSelected}
						data-slot="bottom-menu-option"
						data-active={isSelected || undefined}
						onClick={() => setValue(option.value)}
						className={cn(
							"flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-(--duration-fast) ease-(--ease-out)",
							isSelected
								? "bg-accent text-accent-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
					>
						{Icon ? <Icon aria-hidden="true" className="size-4.5" /> : null}
						<span>{option.label}</span>
					</button>
				)
			})}
		</div>
	)
}

export { BottomMenu, BottomMenuOptionGroup, BottomMenuRow }
