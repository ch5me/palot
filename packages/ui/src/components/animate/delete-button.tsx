"use client"

import {
	durations,
	easings,
	reducedMotionTransition,
	semanticTransitions,
} from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { Undo2Icon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useEffect, useId, useRef, useState } from "react"

/**
 * Two-stage destructive action button (ported from uselayouts "delete button").
 *
 * Idle state shows a solid destructive pill; pressing it arms a countdown and
 * morphs the pill into a soft "cancel" state with an undo icon and a live
 * counter. If the countdown reaches zero, `onConfirm` fires and the button
 * returns to idle; pressing again while armed cancels and fires `onCancel`.
 */

/** Per-character cascade step, derived from the `fast` duration token (~6ms). */
const CHAR_STAGGER = durations.fast / 24

interface DeleteButtonProps {
	/** Label shown in the idle (not yet armed) state. */
	label?: string
	/** Label shown while the countdown is running. */
	cancelLabel?: string
	/** Seconds the user has to cancel before `onConfirm` fires. */
	countdownSeconds?: number
	/** Called when the countdown reaches zero without being cancelled. */
	onConfirm?: () => void
	/** Called when the user cancels a pending delete. */
	onCancel?: () => void
	disabled?: boolean
	className?: string
}

function CharacterCascade({ text, reduced }: { text: string; reduced: boolean }) {
	return (
		<>
			{text.split("").map((char, index) => (
				<motion.span
					key={`${char}-${index}`}
					initial={reduced ? false : { y: 20, opacity: 0, scale: 0.3 }}
					animate={{ y: 0, opacity: 1, scale: 1 }}
					exit={reduced ? { opacity: 0 } : { y: -20, opacity: 0, scale: 0.3 }}
					transition={
						reduced
							? reducedMotionTransition
							: {
									duration: durations.base,
									delay: index * CHAR_STAGGER,
									ease: easings.expressive,
								}
					}
					className="inline-block whitespace-pre"
				>
					{char}
				</motion.span>
			))}
		</>
	)
}

function DeleteButton({
	label = "Delete",
	cancelLabel = "Cancel",
	countdownSeconds = 10,
	onConfirm,
	onCancel,
	disabled = false,
	className,
}: DeleteButtonProps) {
	const [isConfirming, setIsConfirming] = useState(false)
	const [count, setCount] = useState(countdownSeconds)
	const [isAnimating, setIsAnimating] = useState(false)
	const reduced = useReducedMotion() ?? false
	const layoutGroup = useId()

	const onConfirmRef = useRef(onConfirm)
	useEffect(() => {
		onConfirmRef.current = onConfirm
	}, [onConfirm])

	const lockTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	useEffect(() => () => clearTimeout(lockTimerRef.current), [])

	useEffect(() => {
		if (!isConfirming) return
		if (count === 0) {
			setIsConfirming(false)
			onConfirmRef.current?.()
			return
		}
		const timer = setTimeout(() => setCount((current) => current - 1), 1000)
		return () => clearTimeout(timer)
	}, [isConfirming, count])

	const handleToggle = (next: boolean) => {
		if (isAnimating || disabled) return
		if (!reduced) {
			setIsAnimating(true)
			// Release the click lock once the layout morph settles (slow token).
			lockTimerRef.current = setTimeout(() => setIsAnimating(false), durations.slow * 1000)
		}
		setIsConfirming(next)
		if (next) setCount(countdownSeconds)
		else onCancel?.()
	}

	const sharedButtonClasses =
		"inline-flex items-center justify-center overflow-hidden rounded-full text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-destructive/30 disabled:pointer-events-none disabled:opacity-50 select-none"

	return (
		<AnimatePresence mode="popLayout" initial={false}>
			{!isConfirming ? (
				<motion.button
					key="delete"
					type="button"
					data-slot="delete-button"
					data-state="idle"
					layoutId={`${layoutGroup}-button`}
					onClick={() => handleToggle(true)}
					disabled={disabled}
					whileTap={reduced ? undefined : { scale: 0.95 }}
					initial={reduced ? false : { filter: "blur(1px)", opacity: 1 }}
					animate={{ filter: "blur(0px)", opacity: 1 }}
					exit={reduced ? { opacity: 0 } : { filter: "blur(1px)", opacity: 0 }}
					transition={
						reduced
							? reducedMotionTransition
							: {
									layout: semanticTransitions.layout,
									scale: semanticTransitions.press,
									filter: { duration: durations.fast, ease: easings.standard },
									opacity: { duration: durations.base, ease: easings.decelerate },
								}
					}
					className={cn(
						sharedButtonClasses,
						"bg-destructive px-4 py-2 text-destructive-foreground",
						className,
					)}
				>
					<motion.span
						layoutId={`${layoutGroup}-label`}
						className="flex"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={reduced ? reducedMotionTransition : { duration: durations.fast }}
					>
						<CharacterCascade text={label} reduced={reduced} />
					</motion.span>
				</motion.button>
			) : (
				<motion.button
					key="cancel"
					type="button"
					data-slot="delete-button"
					data-state="confirming"
					layoutId={`${layoutGroup}-button`}
					onClick={() => handleToggle(false)}
					disabled={disabled}
					whileTap={reduced ? undefined : { scale: 0.95 }}
					initial={reduced ? false : { filter: "blur(1px)", opacity: 0 }}
					animate={{ filter: "blur(0px)", opacity: 1 }}
					exit={reduced ? { opacity: 0 } : { filter: "blur(1px)", opacity: 0 }}
					transition={
						reduced
							? reducedMotionTransition
							: {
									layout: semanticTransitions.layout,
									scale: semanticTransitions.press,
									filter: { duration: durations.base, ease: easings.standard },
									opacity: { duration: durations.base, ease: easings.accelerate },
								}
					}
					className={cn(
						sharedButtonClasses,
						"gap-2 bg-destructive/10 py-1.5 pr-1.5 pl-1.5 text-destructive",
						className,
					)}
				>
					<motion.span
						initial={reduced ? false : { opacity: 0, scale: 0.5 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
						transition={
							reduced
								? reducedMotionTransition
								: {
										duration: durations.base,
										ease: easings.decelerate,
										// Icon pops in one beat after the morph starts (fast/3).
										delay: durations.fast / 3,
									}
						}
						className="flex shrink-0 items-center justify-center rounded-full bg-destructive p-1.5 text-destructive-foreground"
					>
						<Undo2Icon aria-hidden="true" className="size-4" />
					</motion.span>

					<motion.span
						layoutId={`${layoutGroup}-label`}
						className="flex"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={reduced ? reducedMotionTransition : { duration: durations.fast }}
					>
						<CharacterCascade text={cancelLabel} reduced={reduced} />
					</motion.span>

					<motion.span
						initial={reduced ? false : { opacity: 0, scale: 0.5 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
						transition={
							reduced
								? reducedMotionTransition
								: {
										duration: durations.base,
										ease: easings.decelerate,
										// Counter pops in two beats after the morph starts (2·fast/3).
										delay: (durations.fast * 2) / 3,
									}
						}
						className="relative flex min-w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-destructive px-3 py-1.5 font-semibold text-destructive-foreground tabular-nums"
					>
						{/* Invisible static copy keeps the pill sized while digits swap. */}
						<span aria-hidden="true" className="invisible">
							{count}
						</span>
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.span
								key={count}
								initial={reduced ? false : { opacity: 0, y: 10, scale: 0.8 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								exit={reduced ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.8 }}
								transition={reduced ? reducedMotionTransition : semanticTransitions.indicator}
								className="absolute"
							>
								{count}
							</motion.span>
						</AnimatePresence>
					</motion.span>
				</motion.button>
			)}
		</AnimatePresence>
	)
}

export type { DeleteButtonProps }
export { DeleteButton }
