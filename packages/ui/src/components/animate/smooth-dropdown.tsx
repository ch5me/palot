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
import { EllipsisIcon } from "lucide-react"
import type { Transition } from "motion/react"
import { motion, useReducedMotion } from "motion/react"
import type * as React from "react"
import { useEffect, useId, useRef, useState } from "react"
import useMeasure from "react-use-measure"

/**
 * IMPORTANT: the base-ui `DropdownMenu` (`components/dropdown-menu.tsx`)
 * stays the canonical accessible menu — full roving focus, typeahead,
 * portal/positioning, submenu support. Reach for it first.
 *
 * `SmoothDropdown` is the decorative alternative ported from uselayouts'
 * smooth-dropdown: a self-contained trigger that morphs in place from a
 * square icon button into the open menu (one continuous surface, spring
 * width/height, staggered item slide-in, shared layout hover highlight).
 * Use it where that in-place morph is the point (e.g. an avatar/overflow
 * button in chrome) and the menu is a small flat list of actions. It carries
 * basic keyboard handling (Escape close, arrow/Home/End focus, outside
 * click), not the full menu a11y surface.
 */

/** Collapsed trigger is a `size-10` square; the morph animates from this. */
const TRIGGER_SIZE_PX = 40
/** Per-item entrance stagger step, derived from duration tokens (`fast / 8`). */
const STAGGER_STEP_SECONDS = durations.fast / 8
/** Delay before the menu content fades in behind the morph (`fast / 2`). */
const CONTENT_DELAY_SECONDS = durations.fast / 2

export interface SmoothDropdownItem {
	/** Stable id; reported via `onValueChange` when the item is selected. */
	id: string
	label: string
	icon?: LucideIcon
	/** Renders with destructive styling (e.g. logout / delete). */
	destructive?: boolean
	/** Close the menu when this item is selected. Defaults to false. */
	closeOnSelect?: boolean
	/** Called when this item is selected (in addition to `onValueChange`). */
	onSelect?: () => void
}

export interface SmoothDropdownSeparator {
	type: "separator"
	id: string
}

export type SmoothDropdownEntry = (SmoothDropdownItem & { type?: "item" }) | SmoothDropdownSeparator

function isSeparator(entry: SmoothDropdownEntry): entry is SmoothDropdownSeparator {
	return entry.type === "separator"
}

export interface SmoothDropdownProps
	extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
	items: SmoothDropdownEntry[]
	/** Open state (controlled). */
	open?: boolean
	/** Initial open state (uncontrolled). */
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	/** Selected item id (controlled); the highlight rests on it. */
	value?: string | null
	/** Initially selected item id (uncontrolled). */
	defaultValue?: string | null
	/** Fires with the selected item id when an item is chosen. */
	onValueChange?: (value: string) => void
	/** Icon shown on the collapsed trigger. */
	triggerIcon?: LucideIcon
	/** Accessible name for the collapsed trigger. */
	triggerLabel?: string
	/** Width of the open menu in px. */
	openWidth?: number
}

/**
 * In-place morphing dropdown. The collapsed icon button and the open menu are
 * the same animated surface; opening springs the width/height out from the
 * top-right corner while items slide in with a small stagger. A shared layout
 * highlight (background fill + left bar) follows hover and rests on the
 * selected item. Closes on outside click or Escape.
 */
function SmoothDropdown({
	items,
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	value: valueProp,
	defaultValue = null,
	onValueChange,
	triggerIcon: TriggerIcon = EllipsisIcon,
	triggerLabel = "Open menu",
	openWidth = 220,
	className,
	onKeyDown,
	...props
}: SmoothDropdownProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const [contentRef, contentBounds] = useMeasure()
	const reducedMotion = useReducedMotion()
	const highlightId = useId()
	const barId = useId()
	const menuId = useId()

	const [open, setOpen] = useControllableState<boolean>({
		prop: openProp,
		defaultProp: defaultOpen,
		onChange: onOpenChange,
	})
	const [hoveredId, setHoveredId] = useState<string | null>(null)
	const [value, setValue] = useControllableState<string | null>({
		prop: valueProp,
		defaultProp: defaultValue,
		onChange: (next) => {
			if (next != null) onValueChange?.(next)
		},
	})

	useEffect(() => {
		if (!open) return
		const handlePointerDown = (event: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener("mousedown", handlePointerDown)
		return () => document.removeEventListener("mousedown", handlePointerDown)
	}, [open, setOpen])

	// Move focus into the menu when it opens (next frame, once items exist).
	useEffect(() => {
		if (!open) return
		const frame = requestAnimationFrame(() => {
			getItemButtons(menuRef.current)[0]?.focus()
		})
		return () => cancelAnimationFrame(frame)
	}, [open])

	const close = (refocusTrigger: boolean) => {
		setOpen(false)
		if (refocusTrigger) triggerRef.current?.focus()
	}

	const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (
			event.key !== "ArrowDown" &&
			event.key !== "ArrowUp" &&
			event.key !== "Home" &&
			event.key !== "End"
		) {
			return
		}
		const buttons = getItemButtons(menuRef.current)
		if (buttons.length === 0) return
		event.preventDefault()
		const active = document.activeElement
		const currentIndex = active instanceof HTMLButtonElement ? buttons.indexOf(active) : -1
		const nextIndex =
			event.key === "Home"
				? 0
				: event.key === "End"
					? buttons.length - 1
					: event.key === "ArrowDown"
						? (currentIndex + 1) % buttons.length
						: (currentIndex - 1 + buttons.length) % buttons.length
		buttons[nextIndex]?.focus()
	}

	// The square→menu morph is a width/height layout shift; the shared hover
	// highlight is an active-state marker — each gets its semantic transition.
	const morphTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.layout
	const fadeTransition: Transition = reducedMotion
		? reducedMotionTransition
		: { duration: durations.fast, ease: easings.standard }
	const contentTransition: Transition = reducedMotion
		? reducedMotionTransition
		: {
				duration: durations.base,
				ease: easings.standard,
				delay: open ? CONTENT_DELAY_SECONDS : 0,
			}
	const indicatorTransition = reducedMotion
		? reducedMotionTransition
		: semanticTransitions.indicator
	const itemTransition = (index: number): Transition =>
		reducedMotion
			? reducedMotionTransition
			: {
					delay: open ? CONTENT_DELAY_SECONDS + index * STAGGER_STEP_SECONDS : 0,
					duration: durations.fast,
					ease: easings.iconiqSoft,
				}

	const openHeight = Math.max(TRIGGER_SIZE_PX, Math.ceil(contentBounds.height))

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Escape-key listener catches bubbled keydown from the focusable trigger/menu items; the container itself is not interactive
		<div
			ref={containerRef}
			data-slot="smooth-dropdown"
			data-open={open || undefined}
			className={cn("relative size-10", className)}
			onKeyDown={(event) => {
				onKeyDown?.(event)
				if (event.key === "Escape" && open) {
					event.stopPropagation()
					close(true)
				}
			}}
			{...props}
		>
			<motion.div
				data-slot="smooth-dropdown-surface"
				initial={false}
				animate={{
					width: open ? openWidth : TRIGGER_SIZE_PX,
					height: open ? openHeight : TRIGGER_SIZE_PX,
				}}
				transition={morphTransition}
				className="bg-popover text-popover-foreground absolute top-0 right-0 origin-top-right overflow-hidden rounded-xl border shadow-(--shadow-layered)"
			>
				{/* Collapsed trigger — fades out as the surface morphs open. */}
				<motion.button
					ref={triggerRef}
					type="button"
					data-slot="smooth-dropdown-trigger"
					aria-haspopup="menu"
					aria-expanded={open}
					aria-controls={menuId}
					aria-label={triggerLabel}
					initial={false}
					animate={{ opacity: open ? 0 : 1, scale: open ? 0.8 : 1 }}
					transition={fadeTransition}
					onClick={() => setOpen(true)}
					className="text-muted-foreground absolute inset-0 flex cursor-pointer items-center justify-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					style={{ pointerEvents: open ? "none" : "auto" }}
					tabIndex={open ? -1 : 0}
				>
					<TriggerIcon aria-hidden="true" className="size-6" />
				</motion.button>

				{/* Menu content — measured to drive the surface height. */}
				<div ref={contentRef}>
					<motion.div
						ref={menuRef}
						id={menuId}
						role="menu"
						aria-hidden={!open}
						data-slot="smooth-dropdown-content"
						initial={false}
						animate={{ opacity: open ? 1 : 0 }}
						transition={contentTransition}
						onKeyDown={handleMenuKeyDown}
						className="flex flex-col gap-0.5 p-2"
						style={{ pointerEvents: open ? "auto" : "none" }}
					>
						{items.map((entry, index) => {
							if (isSeparator(entry)) {
								return (
									<motion.div
										key={entry.id}
										role="separator"
										data-slot="smooth-dropdown-separator"
										initial={false}
										animate={{ opacity: open ? 1 : 0 }}
										transition={itemTransition(index)}
										className="bg-border my-1.5 h-px"
									/>
								)
							}

							// The shared highlight follows hover/focus and rests on
							// the selected item when nothing is hovered (source feel).
							const showIndicator = hoveredId ? hoveredId === entry.id : value === entry.id

							return (
								<SmoothDropdownItemButton
									key={entry.id}
									item={entry}
									selected={value === entry.id}
									showIndicator={showIndicator}
									open={open}
									highlightId={highlightId}
									barId={barId}
									transition={itemTransition(index)}
									indicatorTransition={indicatorTransition}
									onHoverChange={(hovered) => {
										setHoveredId((current) =>
											hovered ? entry.id : current === entry.id ? null : current,
										)
									}}
									onSelect={() => {
										setValue(entry.id)
										entry.onSelect?.()
										if (entry.closeOnSelect) close(true)
									}}
								/>
							)
						})}
					</motion.div>
				</div>
			</motion.div>
		</div>
	)
}

interface SmoothDropdownItemButtonProps {
	item: SmoothDropdownItem
	selected: boolean
	/** Whether the shared layout highlight currently sits on this item. */
	showIndicator: boolean
	open: boolean
	highlightId: string
	barId: string
	transition: Transition
	indicatorTransition: Transition
	onHoverChange: (hovered: boolean) => void
	onSelect: () => void
}

function SmoothDropdownItemButton({
	item,
	selected,
	showIndicator,
	open,
	highlightId,
	barId,
	transition,
	indicatorTransition,
	onHoverChange,
	onSelect,
}: SmoothDropdownItemButtonProps) {
	const Icon = item.icon

	return (
		<motion.button
			type="button"
			role="menuitem"
			data-slot="smooth-dropdown-item"
			data-selected={selected || undefined}
			data-destructive={item.destructive || undefined}
			initial={false}
			animate={{ opacity: open ? 1 : 0, x: open ? 0 : 8 }}
			transition={transition}
			onClick={onSelect}
			onMouseEnter={() => onHoverChange(true)}
			onMouseLeave={() => onHoverChange(false)}
			onFocus={() => onHoverChange(true)}
			onBlur={() => onHoverChange(false)}
			tabIndex={open ? 0 : -1}
			className={cn(
				"relative isolate flex cursor-pointer items-center gap-3 rounded-lg py-2 pl-3 text-left text-sm transition-colors duration-(--duration-fast) ease-(--ease-out) outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
				item.destructive
					? cn("text-muted-foreground", showIndicator && "text-destructive")
					: selected || showIndicator
						? "text-foreground"
						: "text-muted-foreground",
			)}
		>
			{/* Shared hover/selection highlight morphs between items. */}
			{showIndicator && (
				<>
					<motion.span
						aria-hidden="true"
						layoutId={highlightId}
						data-slot="smooth-dropdown-item-highlight"
						transition={indicatorTransition}
						className={cn(
							"absolute inset-0 -z-10 rounded-lg",
							item.destructive ? "bg-destructive/10" : "bg-muted",
						)}
					/>
					<motion.span
						aria-hidden="true"
						layoutId={barId}
						data-slot="smooth-dropdown-item-bar"
						transition={indicatorTransition}
						className={cn(
							"absolute top-0 bottom-0 left-0 my-auto h-5 w-[3px] rounded-full",
							item.destructive ? "bg-destructive" : "bg-foreground",
						)}
					/>
				</>
			)}
			{Icon ? <Icon aria-hidden="true" className="relative z-10 size-4.5" /> : null}
			<span className="relative z-10 font-medium">{item.label}</span>
		</motion.button>
	)
}

function getItemButtons(menu: HTMLDivElement | null): HTMLButtonElement[] {
	if (!menu) return []
	return Array.from(menu.querySelectorAll<HTMLButtonElement>('[data-slot="smooth-dropdown-item"]'))
}

export { SmoothDropdown }
