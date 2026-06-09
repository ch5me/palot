"use client"

import { Input } from "@ch5me/elf-ui/components/input"
import { reducedMotionTransition, semanticTransitions } from "@ch5me/elf-ui/lib/motion-tokens"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { CheckIcon, PencilIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { useRef, useState } from "react"

/** Distance the action button slides from behind the pill edge (px). */
const ACTION_BUTTON_TRAVEL = 50

export interface InlineEditProps {
	/** Current text value (controlled). */
	value: string
	/** Called on every keystroke while editing, and when Escape reverts the value. */
	onValueChange?: (value: string) => void
	/** Called with the final value when the user confirms (check button or Enter). */
	onSave?: (value: string) => void
	/** Called when the user cancels with Escape (after the value is reverted). */
	onCancel?: () => void
	/** Called when the field enters edit mode. */
	onEditStart?: () => void
	placeholder?: string
	disabled?: boolean
	/** Accessible label for the edit (pencil) button. */
	editLabel?: string
	/** Accessible label for the save (check) button. */
	saveLabel?: string
	/** Extra classes for the pill container. */
	className?: string
	/** Extra classes for the inner input. */
	inputClassName?: string
}

/**
 * Read <-> edit inline text field. Renders as a quiet read-only pill with a
 * pencil affordance; activating it focuses the input and slides in a confirm
 * (check) button. Enter saves, Escape reverts and cancels.
 */
function InlineEdit({
	value,
	onValueChange,
	onSave,
	onCancel,
	onEditStart,
	placeholder,
	disabled = false,
	editLabel = "Edit",
	saveLabel = "Save",
	className,
	inputClassName,
}: InlineEditProps) {
	const [isEditing, setIsEditing] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const valueBeforeEdit = useRef(value)
	const reducedMotion = useReducedMotion()

	const actionTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.indicator
	const layoutTransition = reducedMotion ? reducedMotionTransition : semanticTransitions.layout

	const startEditing = () => {
		if (disabled) return
		valueBeforeEdit.current = value
		setIsEditing(true)
		onEditStart?.()
		inputRef.current?.focus()
		inputRef.current?.select()
	}

	const save = () => {
		setIsEditing(false)
		onSave?.(value)
	}

	const cancel = () => {
		setIsEditing(false)
		onValueChange?.(valueBeforeEdit.current)
		onCancel?.()
	}

	return (
		<motion.div
			data-slot="inline-edit"
			data-editing={isEditing || undefined}
			layout
			transition={layoutTransition}
			className={cn(
				"bg-background relative flex items-center overflow-hidden rounded-full border transition-[box-shadow,border-color] duration-(--duration-fast) ease-(--ease-out)",
				isEditing ? "border-ring ring-ring/50 ring-3" : "border-input shadow-[var(--ff-shadow-sm)]",
				disabled && "pointer-events-none opacity-50",
				className,
			)}
		>
			<Input
				ref={inputRef}
				data-slot="inline-edit-input"
				value={value}
				onChange={(event) => onValueChange?.(event.target.value)}
				onKeyDown={(event) => {
					if (!isEditing) return
					if (event.key === "Enter") save()
					if (event.key === "Escape") cancel()
				}}
				readOnly={!isEditing}
				disabled={disabled}
				placeholder={placeholder}
				className={cn(
					"h-12 w-full min-w-32 rounded-full border-0 bg-transparent pr-12 pl-4 text-base shadow-none transition-colors duration-(--duration-fast) ease-(--ease-out) focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent",
					isEditing ? "text-foreground" : "text-muted-foreground",
					inputClassName,
				)}
			/>
			<AnimatePresence initial={false}>
				{isEditing ? (
					<motion.button
						key="save"
						type="button"
						data-slot="inline-edit-save"
						aria-label={saveLabel}
						layout="position"
						initial={{ x: ACTION_BUTTON_TRAVEL }}
						animate={{ x: 0 }}
						exit={{ x: ACTION_BUTTON_TRAVEL }}
						transition={actionTransition}
						onClick={save}
						className="bg-primary text-primary-foreground hover:bg-primary/90 absolute right-1 z-20 flex size-10 cursor-pointer items-center justify-center rounded-full border"
					>
						<CheckIcon className="size-5" aria-hidden="true" />
					</motion.button>
				) : (
					<motion.button
						key="edit"
						type="button"
						data-slot="inline-edit-trigger"
						aria-label={editLabel}
						layout="position"
						initial={{ x: ACTION_BUTTON_TRAVEL }}
						animate={{ x: 0 }}
						exit={{ x: ACTION_BUTTON_TRAVEL }}
						transition={actionTransition}
						onClick={startEditing}
						className="bg-card/80 text-muted-foreground hover:bg-card absolute right-1 flex size-10 cursor-pointer items-center justify-center rounded-full border"
					>
						<PencilIcon className="size-5" aria-hidden="true" />
					</motion.button>
				)}
			</AnimatePresence>
		</motion.div>
	)
}

export { InlineEdit }
