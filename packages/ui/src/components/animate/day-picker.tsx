"use client"

import {
	durations,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useId, useState } from "react"

const DEFAULT_OPTIONS: readonly string[] = ["Daily", "Weekly", "Monthly", "Yearly"]
const DEFAULT_DAY_LABELS: readonly string[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export interface DayPickerProps {
	/** Static label shown on the left of the control. */
	label?: string
	/** Frequency options shown when the picker is expanded. */
	options?: readonly string[]
	/** Selected option (controlled). */
	value?: string
	/** Initial option (uncontrolled). Defaults to the first option. */
	defaultValue?: string
	/** Called when an option is selected. */
	onValueChange?: (value: string) => void
	/** Labels for the day strip. */
	dayLabels?: readonly string[]
	/** Selected day index (controlled). */
	day?: number
	/** Initial day index (uncontrolled). */
	defaultDay?: number
	/** Called when a day is selected. */
	onDayChange?: (day: number) => void
	/** The option that reveals the day strip while picking. Defaults to "Weekly". */
	dayStripOption?: string
	/** Accessible label for the confirm (check) button. */
	confirmLabel?: string
	/** Extra classes for the outer card. */
	className?: string
}

/**
 * Animated frequency + day-of-week picker. Collapses into a compact summary
 * pill and expands in place into an option row (with a layoutId selection
 * ring); choosing the day-strip option reveals a staggered strip of days.
 */
function DayPicker({
	label = "Frequency",
	options = DEFAULT_OPTIONS,
	value: valueProp,
	defaultValue,
	onValueChange,
	dayLabels = DEFAULT_DAY_LABELS,
	day: dayProp,
	defaultDay = 1,
	onDayChange,
	dayStripOption = "Weekly",
	confirmLabel = "Confirm",
	className,
}: DayPickerProps) {
	const id = useId()
	const reducedMotion = useReducedMotion()

	const [internalValue, setInternalValue] = useState(defaultValue ?? options[0] ?? "")
	const value = valueProp ?? internalValue
	const [internalDay, setInternalDay] = useState(defaultDay)
	const day = dayProp ?? internalDay

	const [isOptionOpen, setIsOptionOpen] = useState(false)
	const [isDayStripOpen, setIsDayStripOpen] = useState(true)

	const layoutTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.layout
	const indicatorTransition = reducedMotion
		? reducedMotionTransition
		: semanticTransitions.indicator
	const panelTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.panel
	const enterTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.enter
	const staggerStep = reducedMotion ? 0 : durations.fast / 4

	const selectOption = (next: string) => {
		if (valueProp === undefined) setInternalValue(next)
		onValueChange?.(next)
	}

	const selectDay = (next: number) => {
		if (dayProp === undefined) setInternalDay(next)
		onDayChange?.(next)
	}

	const selectedDayLabel = dayLabels[day]
	const triggerText =
		value === dayStripOption && selectedDayLabel ? `${value}, ${selectedDayLabel}` : value

	return (
		<motion.div
			data-slot="day-picker"
			layout
			transition={layoutTransition}
			className={cn(
				"bg-muted flex w-full max-w-xs flex-col gap-1.5 overflow-hidden rounded-3xl p-1.5 text-sm font-medium shadow-[var(--ff-shadow-lg)]",
				className,
			)}
		>
			<div className="relative flex items-center justify-between">
				<motion.div
					data-slot="day-picker-label"
					layout
					animate={{ filter: isOptionOpen ? "blur(8px)" : "blur(0px)" }}
					transition={layoutTransition}
					className="text-muted-foreground flex h-full items-center justify-center px-3 py-2"
				>
					{label}
				</motion.div>
				{isOptionOpen ? (
					<div className="absolute flex h-full w-full justify-between gap-2">
						<motion.div
							data-slot="day-picker-options"
							className="relative flex w-full items-center justify-between rounded-3xl"
						>
							<motion.div
								layout
								transition={layoutTransition}
								layoutId={`${id}-pill`}
								className="bg-background absolute h-full w-full rounded-3xl"
							/>
							<div className="flex justify-between px-1">
								{options.map((option) => (
									<motion.button
										key={option}
										type="button"
										data-slot="day-picker-option"
										data-selected={value === option || undefined}
										layout
										initial={{ filter: "blur(8px)", opacity: 0 }}
										animate={{ filter: "blur(0px)", opacity: 1 }}
										transition={enterTransition}
										onClick={() => {
											selectOption(option)
											setIsDayStripOpen(true)
										}}
										className={cn(
											"text-muted-foreground relative cursor-pointer rounded-3xl px-2 py-1 transition-colors duration-(--duration-relaxed) ease-(--ease-out)",
											value === option && "text-foreground",
										)}
									>
										{value === option && (
											<motion.div
												layoutId={`${id}-option-indicator`}
												transition={indicatorTransition}
												className="bg-secondary absolute inset-0 h-full w-full rounded-3xl"
											/>
										)}
										<span className="relative z-10">{option}</span>
									</motion.button>
								))}
							</div>
						</motion.div>
						<AnimatePresence>
							<motion.button
								key="confirm"
								type="button"
								data-slot="day-picker-confirm"
								aria-label={confirmLabel}
								layoutId={`${id}-action`}
								onClick={() => {
									setIsOptionOpen(false)
									setIsDayStripOpen(false)
								}}
								initial={{ filter: "blur(1px)", opacity: 0.6 }}
								animate={{ filter: "blur(0px)", opacity: 1 }}
								exit={{ filter: "blur(1px)", opacity: 0.6 }}
								transition={layoutTransition}
								style={{ borderRadius: "var(--radius-3xl)" }}
								className="bg-primary text-primary-foreground flex h-full cursor-pointer items-center justify-center px-2.5"
							>
								<CheckIcon className="size-4" aria-hidden="true" />
							</motion.button>
						</AnimatePresence>
					</div>
				) : (
					<motion.button
						type="button"
						data-slot="day-picker-trigger"
						aria-expanded={false}
						onClick={() => setIsOptionOpen(true)}
						className="relative flex w-fit cursor-pointer items-center rounded-full"
					>
						<motion.div
							layout
							transition={layoutTransition}
							layoutId={`${id}-pill`}
							className="bg-background absolute h-full w-full rounded-3xl"
						/>
						<motion.div
							initial={false}
							layoutId={`${id}-value-${value}`}
							className="text-foreground relative pl-3"
						>
							{triggerText}
						</motion.div>
						<AnimatePresence initial={false}>
							<motion.div
								key="chevron"
								layoutId={`${id}-action`}
								className="text-muted-foreground flex h-fit w-fit items-center justify-center py-2.5 pr-3 pl-2"
							>
								<ChevronsUpDownIcon className="size-3.5 -rotate-90" aria-hidden="true" />
							</motion.div>
						</AnimatePresence>
					</motion.button>
				)}
			</div>
			<AnimatePresence mode="popLayout">
				{isDayStripOpen && value === dayStripOption && (
					<motion.div
						data-slot="day-picker-days"
						initial={{ opacity: 0, y: -10, filter: "blur(8px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
						transition={panelTransition}
						className="bg-background text-muted-foreground flex justify-between overflow-hidden rounded-full px-2 py-1"
					>
						{dayLabels.map((dayLabel, index) => (
							<motion.button
								key={dayLabel}
								type="button"
								data-slot="day-picker-day"
								data-selected={index === day || undefined}
								layout
								initial={{ filter: "blur(8px)", opacity: 0 }}
								animate={{ filter: "blur(0px)", opacity: 1 }}
								exit={{ filter: "blur(8px)", opacity: 0 }}
								transition={{ ...enterTransition, delay: index * staggerStep }}
								onClick={() => selectDay(index)}
								className={cn(
									"relative cursor-pointer rounded-3xl px-2 py-1 transition-colors duration-(--duration-relaxed) ease-(--ease-out)",
									index === day ? "text-foreground" : "text-muted-foreground",
								)}
							>
								<span className="relative z-10">{dayLabel}</span>
								{index === day && (
									<motion.div
										layoutId={`${id}-day-indicator`}
										transition={indicatorTransition}
										className="bg-secondary absolute inset-0 h-full w-full rounded-3xl"
									/>
								)}
							</motion.button>
						))}
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	)
}

export { DayPicker }
