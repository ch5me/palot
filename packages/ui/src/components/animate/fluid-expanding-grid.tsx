"use client"

import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { LayoutGroup, motion, useReducedMotion } from "motion/react"
import type { ComponentProps, CSSProperties, KeyboardEvent } from "react"
import { useId, useState } from "react"

interface FluidExpandingGridItem {
	id: string
	title: string
	subtitle?: string
	src: string
	/** Image alt text. Defaults to the item title. */
	alt?: string
}

interface FluidExpandingGridProps extends ComponentProps<"div"> {
	/**
	 * Items for the two-row grid (3 or 4 items; extras are ignored).
	 * The first two fill the top row, the rest fill the bottom row.
	 */
	items: FluidExpandingGridItem[]
}

interface RowLayout {
	top: string[]
	bottom: string[]
}

/**
 * A two-row media grid where clicking a tile expands it to span its full row
 * with a FLIP layout transition; the displaced neighbor fluidly reflows into
 * the other row. A row's lone tile is always the expanded one.
 */
function FluidExpandingGrid({ items, className, ...props }: FluidExpandingGridProps) {
	const reducedMotion = useReducedMotion()
	const layoutGroupId = useId()
	const [rows, setRows] = useState<RowLayout>(() => {
		const ids = items.slice(0, 4).map((item) => item.id)
		return { top: ids.slice(0, 2), bottom: ids.slice(2, 4) }
	})

	// The source's signature "fluid" spring is a soft, well-damped layout morph —
	// `reveal` preserves that feel; the snappier `layout` token would harden it.
	const layoutTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.reveal

	const handleExpand = (id: string) => {
		setRows((current) => {
			const inTop = current.top.includes(id)
			if (!inTop && !current.bottom.includes(id)) return current
			const row = inTop ? current.top : current.bottom
			// Already expanded (a lone tile spans its row).
			if (row.length === 1) return current
			const neighbor = row.find((itemId) => itemId !== id)
			if (neighbor === undefined) return current
			if (inTop) {
				return {
					top: [id],
					bottom: [neighbor, ...current.bottom.filter((itemId) => itemId !== neighbor)].slice(0, 2),
				}
			}
			return {
				top: [neighbor, ...current.top.filter((itemId) => itemId !== neighbor)].slice(0, 2),
				bottom: [id],
			}
		})
	}

	const handleItemKeyDown = (event: KeyboardEvent<HTMLDivElement>, id: string) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault()
			handleExpand(id)
		}
	}

	const visibleItems = items.filter(
		(item) => rows.top.includes(item.id) || rows.bottom.includes(item.id),
	)

	return (
		<div
			data-slot="fluid-expanding-grid"
			className={cn("relative h-[340px] w-full sm:h-[540px]", className)}
			{...props}
		>
			<LayoutGroup id={layoutGroupId}>
				<motion.div
					layout
					className="grid size-full grid-cols-2 grid-rows-2 gap-6"
					transition={layoutTransition}
				>
					{visibleItems.map((item) => {
						const inTop = rows.top.includes(item.id)
						const row = inTop ? rows.top : rows.bottom
						const isExpanded = row.length === 1 && row[0] === item.id
						const placement: CSSProperties = {
							gridRow: inTop ? 1 : 2,
							gridColumn: isExpanded ? "1 / span 2" : row.indexOf(item.id) === 0 ? "1" : "2",
						}

						return (
							<motion.div
								key={item.id}
								layoutId={`${layoutGroupId}-${item.id}`}
								data-slot="fluid-expanding-grid-item"
								data-expanded={isExpanded ? "" : undefined}
								role="button"
								tabIndex={0}
								aria-expanded={isExpanded}
								aria-label={`Expand: ${item.title}`}
								onClick={() => handleExpand(item.id)}
								onKeyDown={(event) => handleItemKeyDown(event, item.id)}
								style={placement}
								className={cn(
									"group relative size-full cursor-pointer rounded-4xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
									isExpanded ? "z-30" : "z-10",
								)}
								transition={{ layout: layoutTransition }}
							>
								<motion.div
									layoutId={`${layoutGroupId}-${item.id}-mask-wrapper`}
									className="absolute inset-0 overflow-hidden rounded-4xl bg-muted"
									transition={layoutTransition}
								>
									<motion.img
										src={item.src}
										alt={item.alt ?? item.title}
										draggable={false}
										className="pointer-events-none absolute inset-0 size-full select-none object-cover"
										initial={false}
										animate={{ objectPosition: isExpanded ? "center 35%" : "center 50%" }}
										transition={
											reducedMotion
												? reducedMotionTransition
												: { duration: durations.ambient, ease: easings.standard }
										}
									/>
									{/* Fixed black scrim over imagery (theme-independent, like overlay scrims). */}
									<motion.div
										layoutId={`${layoutGroupId}-${item.id}-mask`}
										className="absolute inset-0 bg-black"
										initial={false}
										animate={{ opacity: isExpanded ? 0 : 0.2 }}
										transition={
											reducedMotion
												? reducedMotionTransition
												: { duration: durations.showcase, ease: easings.standard }
										}
									/>
								</motion.div>

								<motion.div
									layout="position"
									className="pointer-events-none absolute inset-0 z-10 flex select-none flex-col justify-end p-6 text-white"
									transition={layoutTransition}
								>
									<motion.div
										layout="position"
										className="overflow-hidden"
										transition={layoutTransition}
									>
										<motion.h3
											layout="position"
											className="mb-1 font-medium text-2xl tracking-tight sm:text-3xl"
											transition={layoutTransition}
										>
											{item.title}
										</motion.h3>
										{item.subtitle ? (
											<motion.p
												layout="position"
												className="whitespace-nowrap text-white/80 text-xs sm:text-sm"
												transition={layoutTransition}
											>
												{item.subtitle}
											</motion.p>
										) : null}
									</motion.div>
								</motion.div>

								<motion.div
									layoutId={`${layoutGroupId}-${item.id}-overlay`}
									className="pointer-events-none absolute inset-0 rounded-4xl bg-linear-to-t from-black/50 to-60% to-transparent"
									transition={layoutTransition}
								/>
								<motion.div
									layoutId={`${layoutGroupId}-${item.id}-border`}
									className="pointer-events-none absolute inset-0 rounded-4xl border border-white/10 transition-colors duration-[var(--duration-relaxed)] ease-[var(--ease-out)] group-hover:border-white/20 motion-reduce:transition-none"
									transition={layoutTransition}
								/>
							</motion.div>
						)
					})}
				</motion.div>
			</LayoutGroup>
		</div>
	)
}

export type { FluidExpandingGridItem, FluidExpandingGridProps }
export { FluidExpandingGrid }
