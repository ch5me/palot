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
import { ArrowRightIcon, ChevronsUpDownIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type * as React from "react"
import { useState } from "react"

/**
 * Per-letter stagger step, derived from the `fast` duration token
 * (fast / 10 = 15ms per letter) — no magic numbers.
 */
const PLACEHOLDER_LETTER_STAGGER = durations.fast / 10

type MorphingInputMode = {
	/** Stable identity for AnimatePresence keying. */
	id: string
	/** Placeholder text revealed letter-by-letter when this mode is active. */
	placeholder: string
	/** Icon shown in the mode trigger while this mode is active. */
	icon: LucideIcon
}

function AnimatedPlaceholder({ text }: { text: string }) {
	const reducedMotion = useReducedMotion()

	if (reducedMotion) {
		// Reduced motion = instant: render the final state directly.
		return <span className="inline-flex overflow-hidden">{text}</span>
	}

	return (
		<motion.span className="inline-flex overflow-hidden">
			{text.split("").map((letter, index) => (
				<motion.span
					animate={{ opacity: 1, rotateX: "0deg", y: 0, filter: "blur(0px)" }}
					className="inline-block will-change-transform"
					exit={{ opacity: 0, rotateX: "-80deg", y: -8, filter: "blur(3px)" }}
					initial={{ opacity: 0, rotateX: "80deg", y: 8, filter: "blur(3px)" }}
					key={`${text}-${index}`}
					transition={{
						...semanticTransitions.reveal,
						delay: PLACEHOLDER_LETTER_STAGGER * index,
					}}
				>
					{letter === " " ? " " : letter}
				</motion.span>
			))}
		</motion.span>
	)
}

type MorphingInputProps = Omit<
	React.ComponentProps<"div">,
	"onChange" | "onSubmit" | "defaultValue"
> & {
	/** Input modes cycled by the leading trigger. Must contain at least one entry. */
	modes: readonly MorphingInputMode[]
	/** Controlled input value. */
	value?: string
	/** Uncontrolled initial input value. */
	defaultValue?: string
	onValueChange?: (value: string) => void
	/** Fires when the leading trigger cycles to a new mode. */
	onModeChange?: (mode: MorphingInputMode) => void
	/** Fires on the trailing submit button or Enter. */
	onSubmit?: (value: string, mode: MorphingInputMode) => void
	disabled?: boolean
}

function MorphingInput({
	className,
	modes,
	value: valueProp,
	defaultValue = "",
	onValueChange,
	onModeChange,
	onSubmit,
	disabled,
	...props
}: MorphingInputProps) {
	const reducedMotion = useReducedMotion()
	const [activeIndex, setActiveIndex] = useState(0)
	const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)

	const value = valueProp ?? uncontrolledValue
	const activeMode = modes.length > 0 ? modes[activeIndex % modes.length] : undefined

	const cycleMode = () => {
		if (modes.length < 2) return
		const nextIndex = (activeIndex + 1) % modes.length
		setActiveIndex(nextIndex)
		const nextMode = modes[nextIndex]
		if (nextMode) onModeChange?.(nextMode)
	}

	const handleSubmit = () => {
		if (activeMode) onSubmit?.(value, activeMode)
	}

	return (
		<div
			className={cn("flex w-full items-center rounded-full bg-muted p-1", className)}
			data-slot="morphing-input"
			{...props}
		>
			{activeMode ? (
				<motion.button
					aria-label="Switch input mode"
					className="flex cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-full bg-background p-2.5 shadow-[var(--shadow-flat)] disabled:pointer-events-none disabled:opacity-50"
					data-slot="morphing-input-mode-trigger"
					disabled={disabled || modes.length < 2}
					onClick={cycleMode}
					transition={reducedMotion ? reducedMotionTransition : semanticTransitions.press}
					type="button"
					whileTap={reducedMotion ? undefined : { scale: 0.9 }}
				>
					<AnimatePresence initial={false} mode="popLayout">
						<motion.div
							animate={{ filter: "blur(0px)", opacity: 1 }}
							className="flex items-center justify-center gap-1"
							exit={{ filter: "blur(5px)", opacity: 0 }}
							initial={{ opacity: 0, filter: "blur(5px)" }}
							key={activeMode.id}
							transition={
								reducedMotion
									? reducedMotionTransition
									: { ease: easings.standard, duration: durations.expressive }
							}
						>
							<activeMode.icon className="size-5 text-foreground" />
						</motion.div>
					</AnimatePresence>
					{modes.length > 1 && <ChevronsUpDownIcon className="size-3 text-muted-foreground" />}
				</motion.button>
			) : null}
			<div className="relative min-w-0 flex-1" data-slot="morphing-input-field">
				{!value && activeMode && (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 flex items-center overflow-hidden bg-transparent pl-1.5"
					>
						<AnimatePresence initial={false} mode="popLayout">
							<motion.div
								className="whitespace-nowrap text-sm text-muted-foreground"
								key={activeMode.id}
							>
								<AnimatedPlaceholder text={activeMode.placeholder} />
							</motion.div>
						</AnimatePresence>
					</div>
				)}
				<Input
					aria-label={activeMode?.placeholder}
					className="border-0 bg-transparent px-1.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
					disabled={disabled}
					onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
						if (valueProp === undefined) setUncontrolledValue(event.target.value)
						onValueChange?.(event.target.value)
					}}
					onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
						if (event.key === "Enter") handleSubmit()
					}}
					type="text"
					value={value}
				/>
			</div>
			<motion.button
				aria-label="Submit"
				className="flex cursor-pointer items-center justify-center self-stretch rounded-full bg-background px-3 py-2.5 shadow-[var(--shadow-flat)] disabled:pointer-events-none disabled:opacity-50"
				data-slot="morphing-input-submit"
				disabled={disabled}
				onClick={handleSubmit}
				transition={reducedMotion ? reducedMotionTransition : semanticTransitions.press}
				type="button"
				whileTap={reducedMotion ? undefined : { scale: 0.95 }}
			>
				<ArrowRightIcon className="size-4 text-foreground" />
			</motion.button>
		</div>
	)
}

export type { MorphingInputMode, MorphingInputProps }
export { AnimatedPlaceholder, MorphingInput }
