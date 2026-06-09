"use client"

import { Button } from "@ch5me/elf-ui/components/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@ch5me/elf-ui/components/card"
import { useControllableState } from "@ch5me/elf-ui/hooks/use-controllable-state"
import { reducedMotionTransition, semanticTransitions } from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import type { Variants } from "motion/react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import * as React from "react"
import useMeasure from "react-use-measure"

interface MultiStepFormStep {
	/** Heading shown in the wizard header while this step is active. */
	title: React.ReactNode
	/** Supporting copy shown under the title. */
	description?: React.ReactNode
	/** The step's body — form fields, summary, anything. */
	content: React.ReactNode
	/**
	 * Optional gate run before advancing past this step, e.g.
	 * `() => form.trigger(["project-name", "due-date"])` with react-hook-form.
	 * Return (or resolve) `false` to keep the user on this step.
	 */
	validate?: () => boolean | Promise<boolean>
}

interface MultiStepFormProps extends Omit<React.ComponentProps<typeof Card>, "children"> {
	steps: MultiStepFormStep[]
	/** Controlled active step index. */
	step?: number
	/** Uncontrolled initial step index. */
	defaultStep?: number
	onStepChange?: (step: number) => void
	/** Called when the last step's primary action passes validation. */
	onComplete?: () => void
	backLabel?: React.ReactNode
	nextLabel?: React.ReactNode
	completeLabel?: React.ReactNode
}

const stepVariants: Variants = {
	initial: (direction: number) => ({ x: `${110 * direction}%`, opacity: 0 }),
	active: { x: "0%", opacity: 1 },
	exit: (direction: number) => ({ x: `${-110 * direction}%`, opacity: 0 }),
}

/**
 * Animated wizard: measured-height step container, directional slide
 * transitions, per-step validation gates, and progress dots. Step content is
 * caller-owned, so it composes with any form library (or none).
 */
function MultiStepForm({
	className,
	steps,
	step: stepProp,
	defaultStep = 0,
	onStepChange,
	onComplete,
	backLabel = "Back",
	nextLabel = "Continue",
	completeLabel = "Finish",
	...props
}: MultiStepFormProps) {
	const reducedMotion = useReducedMotion()
	const [step, setStep] = useControllableState({
		prop: stepProp,
		defaultProp: defaultStep,
		onChange: onStepChange,
	})
	const [direction, setDirection] = React.useState(1)
	const [contentRef, bounds] = useMeasure()

	const stepCount = steps.length
	const activeIndex = Math.min(Math.max(step, 0), Math.max(stepCount - 1, 0))
	const activeStep = steps[activeIndex]
	const isLastStep = activeIndex === stepCount - 1

	const slideTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.panel
	const layoutTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.layout

	if (!activeStep) return null

	const goBack = () => {
		if (activeIndex === 0) return
		setDirection(-1)
		setStep(activeIndex - 1)
	}

	const goNext = async () => {
		const valid = (await activeStep.validate?.()) ?? true
		if (!valid) return
		if (isLastStep) {
			onComplete?.()
			return
		}
		setDirection(1)
		setStep(activeIndex + 1)
	}

	return (
		<Card
			data-slot="multi-step-form"
			className={cn("w-full gap-0 overflow-hidden py-0", className)}
			{...props}
		>
			<motion.div layout transition={layoutTransition}>
				<CardHeader
					data-slot="multi-step-form-header"
					className="flex flex-row items-start justify-between gap-4 px-6 py-4"
				>
					<div className="flex flex-col gap-1">
						<CardTitle className="text-xl">{activeStep.title}</CardTitle>
						{activeStep.description != null && (
							<CardDescription>{activeStep.description}</CardDescription>
						)}
					</div>
					<div
						data-slot="multi-step-form-progress"
						role="progressbar"
						aria-label="Form progress"
						aria-valuemin={1}
						aria-valuemax={stepCount}
						aria-valuenow={activeIndex + 1}
						className="flex items-center gap-1.5 pt-1"
					>
						{steps.map((_, index) => (
							<div
								key={index}
								className={cn(
									"h-2 rounded-full transition-[width,background-color] duration-[var(--duration-relaxed)] ease-[var(--ease-out)] motion-reduce:transition-none",
									index === activeIndex ? "bg-primary w-8" : "bg-primary/20 w-2",
								)}
							/>
						))}
					</div>
				</CardHeader>

				<motion.div
					animate={{ height: bounds.height > 0 ? bounds.height : "auto" }}
					transition={layoutTransition}
					className="relative overflow-hidden"
				>
					<div ref={contentRef}>
						<CardContent data-slot="multi-step-form-content" className="relative px-6 py-2">
							<AnimatePresence mode="popLayout" initial={false} custom={direction}>
								<motion.div
									key={activeIndex}
									custom={direction}
									variants={stepVariants}
									initial="initial"
									animate="active"
									exit="exit"
									transition={slideTransition}
									className="w-full"
								>
									{activeStep.content}
								</motion.div>
							</AnimatePresence>
						</CardContent>
					</div>
				</motion.div>

				<CardFooter
					data-slot="multi-step-form-footer"
					className="flex items-center justify-between border-t px-6 py-4"
				>
					<Button type="button" variant="secondary" onClick={goBack} disabled={activeIndex === 0}>
						<ChevronLeftIcon />
						{backLabel}
					</Button>
					<Button type="button" onClick={goNext}>
						{isLastStep ? (
							<>
								{completeLabel}
								<CheckIcon />
							</>
						) : (
							<>
								{nextLabel}
								<ChevronRightIcon />
							</>
						)}
					</Button>
				</CardFooter>
			</motion.div>
		</Card>
	)
}

export type { MultiStepFormProps, MultiStepFormStep }
export { MultiStepForm }
