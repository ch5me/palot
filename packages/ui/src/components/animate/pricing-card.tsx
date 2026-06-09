"use client"

import {
	durations,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import NumberFlow from "@number-flow/react"
import { CheckIcon, MinusIcon, PlusIcon, UsersIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type * as React from "react"
import { useId, useState } from "react"

/** Stagger step for the feature reveal sequence, derived from duration tokens. */
const FEATURE_STAGGER_STEP = durations.fast / 4

export type PricingBillingCycle = "monthly" | "yearly"

export interface PricingCardPlan {
	/** Stable identifier, used for selection state. */
	id: string
	name: string
	/** Short qualifier rendered under the name (e.g. "for small teams"). */
	description?: string
	monthlyPrice: number
	yearlyPrice: number
	/** Feature bullets revealed when the plan is selected. */
	features?: string[]
}

export interface PricingCardProps extends Omit<React.ComponentProps<"div">, "onChange"> {
	plans: PricingCardPlan[]
	/** Heading shown above the billing toggle. */
	title?: string
	/** ISO 4217 currency code for price formatting. */
	currency?: string
	/** Optional pill rendered next to the yearly toggle (e.g. "20% off"). */
	yearlyBadge?: string
	defaultBillingCycle?: PricingBillingCycle
	/** Defaults to the first plan. */
	defaultPlanId?: string
	/** Render the per-seat stepper inside the selected plan. */
	showSeatSelector?: boolean
	/** Label for the seat stepper row. */
	seatLabel?: string
	/** Supporting line under the seat label. */
	seatHint?: string
	minSeatCount?: number
	defaultSeatCount?: number
	onBillingCycleChange?: (cycle: PricingBillingCycle) => void
	onPlanChange?: (planId: string) => void
	onSeatCountChange?: (count: number) => void
}

/**
 * Plan picker card: billing-cycle segmented toggle (shared layout indicator),
 * selectable plan rows with odometer price digits (NumberFlow), an expanding
 * feature panel, and an optional seat-count stepper.
 */
function PricingCard({
	className,
	plans,
	title = "Select a plan",
	currency = "USD",
	yearlyBadge,
	defaultBillingCycle = "monthly",
	defaultPlanId,
	showSeatSelector = false,
	seatLabel = "Seats",
	seatHint,
	minSeatCount = 1,
	defaultSeatCount = 1,
	onBillingCycleChange,
	onPlanChange,
	onSeatCountChange,
	...props
}: PricingCardProps) {
	const reducedMotion = useReducedMotion()
	const billingIndicatorId = useId()
	const [billingCycle, setBillingCycle] = useState<PricingBillingCycle>(defaultBillingCycle)
	const [selectedPlanId, setSelectedPlanId] = useState(defaultPlanId ?? plans[0]?.id)
	const [seatCount, setSeatCount] = useState(Math.max(minSeatCount, defaultSeatCount))

	const indicatorTransition = reducedMotion
		? reducedMotionTransition
		: semanticTransitions.indicator
	const panelTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.panel
	const revealTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.reveal

	const selectBillingCycle = (cycle: PricingBillingCycle) => {
		setBillingCycle(cycle)
		onBillingCycleChange?.(cycle)
	}

	const selectPlan = (planId: string) => {
		setSelectedPlanId(planId)
		onPlanChange?.(planId)
	}

	const changeSeatCount = (count: number) => {
		const next = Math.max(minSeatCount, count)
		setSeatCount(next)
		onSeatCountChange?.(next)
	}

	return (
		<div
			data-slot="card"
			className={cn(
				"bg-card text-card-foreground flex w-full max-w-md flex-col gap-6 rounded-2xl border p-4 shadow-xs sm:p-6",
				className,
			)}
			{...props}
		>
			<div className="flex flex-col gap-4">
				<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>

				<div
					data-slot="pricing-card-billing-toggle"
					role="radiogroup"
					aria-label="Billing cycle"
					className="bg-muted ring-border flex h-10 w-full rounded-xl p-1 ring-1"
				>
					{(["monthly", "yearly"] satisfies PricingBillingCycle[]).map((cycle) => {
						const isActive = billingCycle === cycle
						return (
							<button
								key={cycle}
								type="button"
								role="radio"
								aria-checked={isActive}
								onClick={() => selectBillingCycle(cycle)}
								className={cn(
									"focus-visible:ring-ring/50 relative flex h-full flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors duration-(--duration-normal) ease-(--ease-out) outline-none focus-visible:ring-[3px]",
									isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
								)}
							>
								{isActive && (
									<motion.span
										layoutId={`${billingIndicatorId}-billing-indicator`}
										transition={indicatorTransition}
										className="bg-background ring-border absolute inset-0 rounded-lg shadow-xs ring-1"
									/>
								)}
								<span className="relative z-10 capitalize">{cycle}</span>
								{cycle === "yearly" && yearlyBadge ? (
									<span className="bg-primary text-primary-foreground relative z-10 rounded-full px-1.5 py-0.5 text-xs font-semibold tracking-tight whitespace-nowrap uppercase">
										{yearlyBadge}
									</span>
								) : null}
							</button>
						)
					})}
				</div>
			</div>

			<div role="radiogroup" aria-label={title} className="flex flex-col gap-3">
				{plans.map((plan) => {
					const isSelected = selectedPlanId === plan.id
					const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice

					return (
						<div
							key={plan.id}
							data-slot="pricing-card-plan"
							data-selected={isSelected || undefined}
							role="radio"
							aria-checked={isSelected}
							tabIndex={0}
							onClick={() => selectPlan(plan.id)}
							onKeyDown={(event) => {
								if (event.target !== event.currentTarget) return
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault()
									selectPlan(plan.id)
								}
							}}
							className={cn(
								"bg-background focus-visible:ring-ring/50 relative cursor-pointer rounded-xl border p-5 transition-colors duration-(--duration-normal) ease-(--ease-out) outline-none focus-visible:ring-[3px]",
								isSelected ? "border-primary ring-primary ring-1" : "border-border",
							)}
						>
							<div className="flex items-start justify-between gap-4">
								<div className="flex gap-4">
									<span
										className={cn(
											"mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-(--duration-normal) ease-(--ease-out)",
											isSelected ? "border-primary" : "border-input",
										)}
									>
										<AnimatePresence initial={false}>
											{isSelected && (
												<motion.span
													initial={{ scale: 0 }}
													animate={{ scale: 1 }}
													exit={{ scale: 0 }}
													transition={indicatorTransition}
													className="bg-primary size-4 rounded-full"
												/>
											)}
										</AnimatePresence>
									</span>
									<div>
										<h3 className="text-lg leading-tight font-medium">{plan.name}</h3>
										{plan.description ? (
											<p className="text-muted-foreground text-sm">{plan.description}</p>
										) : null}
									</div>
								</div>
								<div className="text-right">
									<div className="text-xl font-medium">
										<NumberFlow value={price} format={{ style: "currency", currency }} />
									</div>
									<div className="text-muted-foreground text-xs">
										per {billingCycle === "monthly" ? "month" : "year"}
									</div>
								</div>
							</div>

							<AnimatePresence initial={false}>
								{isSelected && (
									<motion.div
										data-slot="pricing-card-plan-details"
										initial={{ height: 0, opacity: 0 }}
										animate={{ height: "auto", opacity: 1 }}
										exit={{ height: 0, opacity: 0 }}
										transition={panelTransition}
										className="w-full overflow-hidden"
									>
										<div className="flex flex-col gap-6 pt-6">
											{plan.features && plan.features.length > 0 ? (
												<ul className="flex flex-col gap-3.5">
													{plan.features.map((feature, index) => (
														<motion.li
															key={feature}
															initial={reducedMotion ? false : { opacity: 0, y: 5 }}
															animate={{ opacity: 1, y: 0 }}
															transition={{
																...revealTransition,
																delay: reducedMotion ? 0 : index * FEATURE_STAGGER_STEP,
															}}
															className="text-foreground/80 flex items-center gap-3 text-sm"
														>
															<CheckIcon
																aria-hidden="true"
																className="text-primary size-4 shrink-0"
															/>
															{feature}
														</motion.li>
													))}
												</ul>
											) : null}

											{showSeatSelector && (
												<>
													<div className="bg-border h-px" />
													<div className="flex items-center justify-between gap-4">
														<div className="flex items-center gap-3">
															<span className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-full">
																<UsersIcon
																	aria-hidden="true"
																	className="text-muted-foreground size-6"
																/>
															</span>
															<div className="flex flex-col">
																<span className="text-sm leading-none font-medium">
																	{seatLabel}
																</span>
																{seatHint ? (
																	<span className="text-muted-foreground mt-0.5 text-sm">
																		{seatHint}
																	</span>
																) : null}
															</div>
														</div>

														<div className="bg-muted flex items-center gap-4 rounded-xl border p-1.5">
															<button
																type="button"
																aria-label={`Decrease ${seatLabel}`}
																disabled={seatCount <= minSeatCount}
																onClick={(event) => {
																	event.stopPropagation()
																	changeSeatCount(seatCount - 1)
																}}
																className="text-muted-foreground hover:bg-background hover:text-foreground cursor-pointer rounded-lg p-1.5 transition-[color,background-color,box-shadow,scale] duration-(--duration-fast) ease-(--ease-out) hover:shadow-xs active:scale-95 disabled:pointer-events-none disabled:opacity-50 motion-reduce:active:scale-100"
															>
																<MinusIcon aria-hidden="true" className="size-3.5" />
															</button>
															<span className="w-4 text-center text-sm tabular-nums">
																<NumberFlow value={seatCount} />
															</span>
															<button
																type="button"
																aria-label={`Increase ${seatLabel}`}
																onClick={(event) => {
																	event.stopPropagation()
																	changeSeatCount(seatCount + 1)
																}}
																className="text-muted-foreground hover:bg-background hover:text-foreground cursor-pointer rounded-lg p-1.5 transition-[color,background-color,box-shadow,scale] duration-(--duration-fast) ease-(--ease-out) hover:shadow-xs active:scale-95 disabled:pointer-events-none disabled:opacity-50 motion-reduce:active:scale-100"
															>
																<PlusIcon aria-hidden="true" className="size-3.5" />
															</button>
														</div>
													</div>
												</>
											)}
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					)
				})}
			</div>
		</div>
	)
}

export { PricingCard }
