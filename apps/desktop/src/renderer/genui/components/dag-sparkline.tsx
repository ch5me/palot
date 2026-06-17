import { DagSparkline, type DagSparklineDirection, type DagSparklineProps } from "@ch5me/dag-sparkline";
import { cn } from "@ch5me/ch5-ui-web"
import { memo } from "react"
import { z } from "zod"
import type { GenUiEntry } from "../registry"

export const dagSparklinePropsSchema = z.object({
	nodes: z.array(
		z
			.object({
				id: z.string().min(1),
				label: z.string().optional(),
				tone: z.string().optional(),
			})
			.passthrough(),
	),
	edges: z.array(
		z
			.object({
				source: z.string().min(1),
				target: z.string().min(1),
				tone: z.string().optional(),
				animated: z.boolean().optional(),
			})
			.passthrough(),
	),
	dir: z.enum(["LR", "TB"] satisfies [DagSparklineDirection, DagSparklineDirection]).optional(),
	animate: z.enum(["none", "reveal", "flow"] satisfies [
		DagSparklineProps["animate"],
		DagSparklineProps["animate"],
		DagSparklineProps["animate"],
	]).optional(),
	height: z.number().finite().optional(),
	showLabels: z.boolean().optional(),
	className: z.string().optional(),
})

export type DagSparklineFenceProps = z.infer<typeof dagSparklinePropsSchema>

function parseLegacyDagFence(body: string): unknown {
	return JSON.parse(body)
}

function DagSparklineGenUiImpl({ className, ...props }: DagSparklineFenceProps) {
	return (
		<div
			className={cn(
				"my-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-muted-foreground",
				className,
			)}
		>
			<DagSparkline {...(props as DagSparklineProps)} />
		</div>
	)
}

const DagSparklineGenUi = memo(DagSparklineGenUiImpl)

export const DagSparklineEntry: GenUiEntry<DagSparklineFenceProps> = {
	name: "dag-sparkline",
	aliases: ["dag", "dag spark", "dag sparkline", "graph", "flow graph", "dependency graph"],
	description: "Render DAG with node + edge props",
	presentation: "inline-artifact",
	scope: "generic",
	maturity: "stable",
	defaultPlacement: "inline",
	allowedPlacements: ["inline", "chat-inline-right", "side-panel"],
	sourcePackage: "@ch5me/dag-sparkline",
	storybookPath: "packages/web/dag-sparkline/src/DagSpark.stories.tsx",
	docsPath: "docs/genui-artifact-architecture.md",
	Component: DagSparklineGenUi,
	props: dagSparklinePropsSchema,
	events: {},
	state: {},
	legacyFences: [{ fence: "dag", parseBody: parseLegacyDagFence }],
	example: {
		component: "dag-sparkline",
		props: {
			nodes: [
				{ id: "plan", label: "Plan" },
				{ id: "build", label: "Build" },
				{ id: "ship", label: "Ship" },
			],
			edges: [
				{ source: "plan", target: "build" },
				{ source: "build", target: "ship" },
			],
		},
	},
}
