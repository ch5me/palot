import { cn } from "@ch5me/ch5-ui-web"
import { CheckCircle2, CircleDashed, Loader2, OctagonAlert } from "lucide-react"
import { memo } from "react"
import { z } from "zod"
import type { GenUiEntry } from "../registry"

const statusThinkingStepSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1),
	state: z.enum(["queued", "running", "done", "blocked"]).optional(),
})

export const statusThinkingCardPropsSchema = z.object({
	title: z.string().min(1),
	status: z.enum(["thinking", "running", "done", "blocked"]),
	detail: z.string().optional(),
	steps: z.array(statusThinkingStepSchema).min(1).max(8),
})

export type StatusThinkingCardProps = z.infer<typeof statusThinkingCardPropsSchema>

function statusLabel(status: StatusThinkingCardProps["status"]) {
	switch (status) {
		case "thinking":
			return "Thinking"
		case "running":
			return "Running"
		case "done":
			return "Done"
		case "blocked":
			return "Blocked"
	}
}

function StepIcon({ state }: { state: NonNullable<StatusThinkingCardProps["steps"][number]["state"]> }) {
	if (state === "done") return <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />
	if (state === "blocked") return <OctagonAlert className="size-4 text-destructive" aria-hidden="true" />
	if (state === "running") return <Loader2 className="size-4 animate-spin text-foreground" aria-hidden="true" />
	return <CircleDashed className="size-4 text-muted-foreground" aria-hidden="true" />
}

function StatusThinkingCardImpl({ title, status, detail, steps }: StatusThinkingCardProps) {
	return (
		<section className="my-2 w-full max-w-[520px] rounded-md border border-border/70 bg-background shadow-sm">
			<div className="border-b border-border/70 px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<h3 className="text-sm font-semibold text-foreground">{title}</h3>
					<span
						className={cn(
							"rounded-md border px-2 py-1 text-xs font-medium",
							status === "done" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
							status === "blocked" && "border-destructive/30 bg-destructive/10 text-destructive",
							(status === "thinking" || status === "running") &&
								"border-border bg-muted text-muted-foreground",
						)}
					>
						{statusLabel(status)}
					</span>
				</div>
				{detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
			</div>
			<ol className="divide-y divide-border/60">
				{steps.map((step) => {
					const state = step.state ?? "queued"
					return (
						<li key={step.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
							<StepIcon state={state} />
							<span className={state === "done" ? "text-muted-foreground line-through" : "text-foreground"}>
								{step.label}
							</span>
						</li>
					)
				})}
			</ol>
		</section>
	)
}

const StatusThinkingCard = memo(StatusThinkingCardImpl)

export const StatusThinkingCardEntry: GenUiEntry<StatusThinkingCardProps> = {
	name: "status_thinking_card",
	aliases: ["status-thinking-card", "thinking card", "status card", "progress card"],
	description: "Compact status card for multi-step agent work",
	presentation: "inline-artifact",
	scope: "generic",
	maturity: "beta",
	defaultPlacement: "inline",
	allowedPlacements: ["inline", "above-chat", "chat-inline-right"],
	sourcePackage: "@ch5me/remotion-experiences",
	storybookPath: "packages/web/remotion-experiences/src/spikes/StatusThinkingCard.stories.tsx",
	docsPath: "docs/genui-artifact-architecture.md",
	Component: StatusThinkingCard,
	props: statusThinkingCardPropsSchema,
	events: {},
	state: {},
	conflictPolicy: "agent-wins",
	example: {
		component: "status_thinking_card",
		props: {
			title: "Surface registry pass",
			status: "running",
			detail: "Scanning Storybook candidates and wiring safe entries.",
			steps: [
				{ id: "scan", label: "Inventory Storybook stories", state: "done" },
				{ id: "registry", label: "Register schema-safe components", state: "running" },
				{ id: "proof", label: "Run discovery smoke tests", state: "queued" },
			],
		},
	},
}
