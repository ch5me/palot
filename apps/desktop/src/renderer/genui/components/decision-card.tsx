import { Button, Textarea, cn } from "@ch5me/ch5-ui-web";
import { memo, useMemo } from "react"
import { z } from "zod"
import type { GenUiEntry } from "../registry"

const decisionCardOptionSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
})

export const decisionCardPropsSchema = z.object({
	title: z.string().min(1),
	options: z.array(decisionCardOptionSchema).min(1),
	selected: z.string().nullable(),
	notes: z.string().optional(),
})

const decisionCardEvents = {
	submit: z.object({ optionId: z.string().min(1) }),
}

const decisionCardState = {
	notes: z.string(),
}

export type DecisionCardProps = z.infer<typeof decisionCardPropsSchema>

function DecisionCardImpl({
	title,
	options,
	selected,
	notes,
	onSelect,
	onSubmit,
	onNotesChange,
}: DecisionCardProps & {
	onSelect?: (optionId: string) => void
	onSubmit?: (payload: { optionId: string }) => void
	onNotesChange?: (value: string) => void
}) {
	const selectedLabel = useMemo(
		() => options.find((option) => option.id === selected)?.label ?? null,
		[options, selected],
	)

	return (
		<section className="my-2 w-full max-w-[520px] rounded-2xl border border-border/70 bg-gradient-to-br from-background via-muted/30 to-background p-4 shadow-sm">
			<div className="space-y-4">
				<div className="space-y-1">
					<p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Decision</p>
					<h3 className="font-serif text-xl leading-tight text-foreground">{title}</h3>
					{selectedLabel ? (
						<p className="text-sm text-muted-foreground">Selected: {selectedLabel}</p>
					) : null}
				</div>
				<div className="grid gap-2 sm:grid-cols-2">
					{options.map((option) => {
						const active = option.id === selected
						return (
							<button
								key={option.id}
								type="button"
								onClick={() => onSelect?.(option.id)}
								className={cn(
									"rounded-xl border px-3 py-3 text-left text-sm transition-colors",
									active
										? "border-foreground bg-foreground text-background"
										: "border-border/70 bg-background/80 text-foreground hover:border-foreground/40",
								)}
							>
								{option.label}
							</button>
						)
					})}
				</div>
				<div className="space-y-2">
					<p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">Notes</p>
					<Textarea
						value={notes ?? ""}
						onChange={(event) => onNotesChange?.(event.target.value)}
						placeholder="Capture local notes before agent round-trip"
						className="min-h-28 resize-y"
					/>
				</div>
				<Button
					type="button"
					onClick={() => selected && onSubmit?.({ optionId: selected })}
					disabled={!selected}
					className="w-full"
				>
					Submit decision
				</Button>
			</div>
		</section>
	)
}

const DecisionCard = memo(DecisionCardImpl)

export const DecisionCardEntry: GenUiEntry<DecisionCardProps> = {
	name: "decision_card",
	aliases: ["decision-card", "decision", "decision card"],
	description: "Interactive decision card with local notes state and submit signal",
	presentation: "inline-artifact",
	scope: "generic",
	maturity: "stable",
	defaultPlacement: "inline",
	allowedPlacements: ["inline", "chat-inline-right"],
	docsPath: "docs/genui-artifact-architecture.md",
	Component: DecisionCard,
	props: decisionCardPropsSchema,
	events: decisionCardEvents,
	state: decisionCardState,
	conflictPolicy: "ask",
	merge: (humanValue, agentValue, field) => {
		if (field === "notes") {
			return `${String(humanValue ?? "")} ${String(agentValue ?? "")}`.trim()
		}
		return agentValue
	},
	example: {
		component: "decision_card",
		props: {
			title: "Pick launch path",
			options: [
				{ id: "opt_a", label: "Private beta" },
				{ id: "opt_b", label: "Public launch" },
			],
			selected: null,
			notes: "",
		},
	},
}
