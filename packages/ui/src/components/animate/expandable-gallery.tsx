"use client"

import { Button } from "@ch5me/elf-ui/components/button"
import { useControllableState } from "@ch5me/elf-ui/hooks/use-controllable-state"
import { useOutsideClick } from "@ch5me/elf-ui/hooks/use-outside-click"
import { reducedMotionTransition, semanticTransitions } from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { ArrowLeftIcon } from "lucide-react"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"
import type { ComponentProps, KeyboardEvent, ReactNode } from "react"
import { useCallback, useId, useRef } from "react"

interface ExpandableGalleryItem {
	id: string
	src: string
	alt: string
	/** Rotation (degrees) in the collapsed stack. Defaults cycle through a scatter. */
	rotation?: number
	/** Horizontal offset (px) in the collapsed stack. */
	x?: number
	/** Vertical offset (px) in the collapsed stack. */
	y?: number
	/** Stacking order in the collapsed stack. Defaults to item order. */
	zIndex?: number
}

interface ExpandableGalleryProps extends ComponentProps<"div"> {
	items: ExpandableGalleryItem[]
	/** Controlled expanded state. */
	expanded?: boolean
	defaultExpanded?: boolean
	onExpandedChange?: (expanded: boolean) => void
	/** How many leading items appear in the collapsed stack. */
	stackCount?: number
	/** Label for the collapse control shown while expanded. */
	collapseLabel?: ReactNode
	/** Rendered below the collapsed stack (heading, call to action, ...). Fades out on expand. */
	children?: ReactNode
}

/** Default scatter poses for the collapsed stack, cycled by index. */
const STACK_POSES = [
	{ rotation: -15, x: -90, y: 10 },
	{ rotation: -3, x: -10, y: -15 },
	{ rotation: 12, x: 75, y: 5 },
] as const

const FALLBACK_POSE = { rotation: 0, x: 0, y: 0 }

/**
 * A stacked photo pile that expands into a grid with a shared-element layout
 * transition. Click the stack (or focus it and press Enter/Space) to expand;
 * click outside or use the collapse control to return to the stack.
 */
function ExpandableGallery({
	items,
	expanded,
	defaultExpanded = false,
	onExpandedChange,
	stackCount = 3,
	collapseLabel = "Back",
	className,
	children,
	...props
}: ExpandableGalleryProps) {
	const [isExpanded, setIsExpanded] = useControllableState({
		prop: expanded,
		defaultProp: defaultExpanded,
		onChange: onExpandedChange,
	})
	const reducedMotion = useReducedMotion()
	const layoutGroupId = useId()
	const containerRef = useRef<HTMLDivElement>(null)

	const handleOutsideClick = useCallback(() => {
		setIsExpanded((current) => (current ? false : current))
	}, [setIsExpanded])
	useOutsideClick(containerRef, handleOutsideClick)

	// Shared-element grid<->stack morph reads as a content reveal, not a hard
	// layout snap — `reveal` preserves the source's soft spring feel.
	const layoutTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.reveal

	const expand = () => {
		if (!isExpanded) setIsExpanded(true)
	}
	const handleItemKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!isExpanded && (event.key === "Enter" || event.key === " ")) {
			event.preventDefault()
			setIsExpanded(true)
		}
	}

	return (
		<div
			data-slot="expandable-gallery"
			data-expanded={isExpanded ? "" : undefined}
			className={cn(
				"relative flex w-full flex-col items-center overflow-hidden px-4 md:px-8",
				className,
			)}
			{...props}
		>
			<LayoutGroup id={layoutGroupId}>
				<div className="mx-auto flex w-full max-w-6xl flex-col items-center">
					<div className="mb-2 flex h-12 w-full items-center justify-between px-4">
						<AnimatePresence>
							{isExpanded && (
								<motion.div
									key="collapse-control"
									className="z-50"
									initial={reducedMotion ? false : { opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									exit={{
										opacity: 0,
										x: reducedMotion ? 0 : -10,
										transition: reducedMotion ? reducedMotionTransition : semanticTransitions.exit,
									}}
									transition={reducedMotion ? reducedMotionTransition : semanticTransitions.enter}
								>
									<Button
										data-slot="expandable-gallery-collapse"
										variant="ghost"
										onClick={() => setIsExpanded(false)}
									>
										<ArrowLeftIcon />
										{collapseLabel}
									</Button>
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					<motion.div
						ref={containerRef}
						layout
						data-slot="expandable-gallery-items"
						className={cn(
							"relative w-full",
							isExpanded
								? "grid grid-cols-2 gap-6 px-4 md:gap-8 lg:grid-cols-3"
								: "flex flex-col items-center justify-start pt-4",
						)}
						transition={layoutTransition}
					>
						<div
							className={cn(
								"relative",
								isExpanded ? "contents" : "mb-8 flex h-[28rem] w-full items-center justify-center",
							)}
						>
							{items.map((item, index) => {
								const isStacked = index < stackCount
								if (!isStacked && !isExpanded) return null

								const pose = STACK_POSES[index % STACK_POSES.length] ?? FALLBACK_POSE
								const rotation = item.rotation ?? pose.rotation
								const x = item.x ?? pose.x
								const y = item.y ?? pose.y
								const zIndex = item.zIndex ?? (index + 1) * 10

								return (
									<motion.div
										key={item.id}
										layoutId={`expandable-gallery-item-${item.id}`}
										layout
										data-slot="expandable-gallery-item"
										role={isExpanded ? undefined : "button"}
										tabIndex={isExpanded ? undefined : 0}
										aria-label={isExpanded ? undefined : `Expand gallery: ${item.alt}`}
										initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
										animate={{
											opacity: 1,
											scale: 1,
											rotate: isExpanded ? 0 : rotation,
											x: isExpanded ? 0 : x,
											y: isExpanded ? 0 : y,
											zIndex: isExpanded ? 10 : zIndex,
										}}
										transition={layoutTransition}
										whileHover={
											reducedMotion
												? undefined
												: isExpanded
													? { scale: 1.02 }
													: {
															scale: 1.05,
															y: y - 15,
															rotate: rotation * 0.8,
															zIndex: 50,
															transition: semanticTransitions.hover,
														}
										}
										className={cn(
											"overflow-hidden border-4 border-background bg-muted",
											isExpanded
												? "relative aspect-square rounded-3xl shadow-[var(--ff-shadow-lg)] md:rounded-4xl"
												: "absolute size-44 cursor-pointer rounded-3xl shadow-[var(--ff-shadow-xl)] md:size-60 md:rounded-4xl",
										)}
										onClick={expand}
										onKeyDown={handleItemKeyDown}
									>
										<motion.div
											layoutId={`expandable-gallery-image-${item.id}`}
											layout="position"
											className="relative size-full"
											transition={layoutTransition}
										>
											<img
												src={item.src}
												alt={item.alt}
												draggable={false}
												loading={isStacked ? "eager" : "lazy"}
												className="pointer-events-none size-full select-none object-cover"
											/>
										</motion.div>
									</motion.div>
								)
							})}
						</div>

						<AnimatePresence>
							{!isExpanded && children && (
								<motion.div
									key="collapsed-content"
									data-slot="expandable-gallery-content"
									initial={false}
									exit={{
										opacity: 0,
										transition: reducedMotion ? reducedMotionTransition : semanticTransitions.exit,
									}}
									className="max-w-2xl text-center"
								>
									{children}
								</motion.div>
							)}
						</AnimatePresence>
					</motion.div>
				</div>
			</LayoutGroup>
		</div>
	)
}

export type { ExpandableGalleryItem, ExpandableGalleryProps }
export { ExpandableGallery }
