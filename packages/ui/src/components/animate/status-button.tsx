"use client"

import { Button } from "@ch5me/elf-ui/components/button"
import { Spinner } from "@ch5me/elf-ui/components/spinner"
import {
	reducedMotionTransition,
	semanticTransitions,
	springs,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { CheckIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import type * as React from "react"

export type StatusButtonStatus = "idle" | "loading" | "success"

export interface StatusButtonProps extends Omit<React.ComponentProps<typeof Button>, "children"> {
	/** Current submit state (controlled). The caller owns the state machine. */
	status?: StatusButtonStatus
	/** Label shown while idle (e.g. "Save", "Submit"). */
	idleLabel: string
	/** Label shown while loading; falls back to `idleLabel`. */
	loadingLabel?: string
	/** Label shown on success; falls back to `idleLabel`. */
	successLabel?: string
	/** Extra classes for the outer wrapper (the button + indicator group). */
	containerClassName?: string
}

/**
 * Submit/save button with animated idle -> loading -> success states:
 * character-level label morphing plus a floating status badge that swaps a
 * spinner for a check. The button disables itself outside `idle` so duplicate
 * submissions are impossible; drive `status` from your async action.
 */
function StatusButton({
	status = "idle",
	idleLabel,
	loadingLabel,
	successLabel,
	containerClassName,
	className,
	disabled,
	...props
}: StatusButtonProps) {
	const reducedMotion = useReducedMotion()

	const label =
		status === "loading"
			? (loadingLabel ?? idleLabel)
			: status === "success"
				? (successLabel ?? idleLabel)
				: idleLabel

	// Per-character pop + reflow; stiff per the S>=500 mechanical mapping.
	const charTransition = reducedMotion ? reducedMotionTransition : springs.stiff
	const indicatorTransition = reducedMotion
		? reducedMotionTransition
		: semanticTransitions.indicator
	const exitTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.exit

	return (
		<div
			data-slot="status-button"
			data-status={status}
			className={cn("group relative inline-flex", containerClassName)}
		>
			<Button
				aria-busy={status === "loading"}
				disabled={disabled || status !== "idle"}
				className={cn(
					"relative h-12 min-w-36 rounded-full px-8 text-base font-medium transition-colors duration-(--duration-relaxed) ease-(--ease-out) disabled:opacity-100",
					status !== "idle" &&
						"bg-muted text-muted-foreground border-muted shadow-[var(--ff-shadow-sm)] hover:bg-muted",
					className,
				)}
				{...props}
			>
				<span aria-live="polite" className="sr-only">
					{label}
				</span>
				<span aria-hidden="true" className="flex items-center justify-center">
					<AnimatePresence mode="popLayout" initial={false}>
						{label.split("").map((char, index) => (
							<motion.span
								key={`${char}-${index}`}
								layout
								initial={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
								animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
								exit={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
								transition={charTransition}
								className="inline-block whitespace-pre"
							>
								{char}
							</motion.span>
						))}
					</AnimatePresence>
				</span>
			</Button>

			<span
				aria-hidden="true"
				data-slot="status-button-indicator"
				className="pointer-events-none absolute -top-1 -right-1 z-10"
			>
				<AnimatePresence mode="wait">
					{status !== "idle" && (
						<motion.span
							initial={{ opacity: 0, scale: 0, x: -8, filter: "blur(4px)" }}
							animate={{ opacity: 1, scale: 1, x: 0, filter: "blur(0px)" }}
							exit={{ opacity: 0, scale: 0, x: -8, filter: "blur(4px)" }}
							transition={indicatorTransition}
							className={cn(
								"ring-background flex size-6 items-center justify-center overflow-visible rounded-full ring-3",
								status === "success"
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground",
							)}
						>
							<AnimatePresence mode="popLayout">
								{status === "loading" && (
									<motion.span
										key="loader"
										initial={{ opacity: 1 }}
										animate={{ opacity: 1 }}
										exit={{ scale: 0, opacity: 0 }}
										transition={exitTransition}
										className="absolute inset-0 flex items-center justify-center"
									>
										<Spinner className="size-4 motion-reduce:animate-none" />
									</motion.span>
								)}
								{status === "success" && (
									<motion.span
										key="check"
										initial={{ scale: 0, opacity: 0, filter: "blur(4px)" }}
										animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
										exit={{ scale: 0, opacity: 0, filter: "blur(4px)" }}
										transition={indicatorTransition}
										className="absolute inset-0 flex items-center justify-center"
									>
										<CheckIcon className="size-4" />
									</motion.span>
								)}
							</AnimatePresence>
						</motion.span>
					)}
				</AnimatePresence>
			</span>
		</div>
	)
}

export { StatusButton }
