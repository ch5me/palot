import { z } from "zod"

export type ComponentPresentation = "inline-artifact" | "chat-widget" | "side-panel" | "main-pane" | "webview"
export type ComponentScope = "generic" | "ch5-internal" | "lab"
export type ComponentMaturity = "stable" | "beta" | "alpha" | "internal"
export type ComponentPlacement = "inline" | "above-chat" | "chat-inline-right" | "side-panel" | "main-pane"

const dagSparklinePropsSchema = z.object({
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
	dir: z.enum(["LR", "TB"]).optional(),
	animate: z.enum(["none", "reveal", "flow"]).optional(),
	height: z.number().finite().optional(),
	showLabels: z.boolean().optional(),
	className: z.string().optional(),
})

const decisionCardPropsSchema = z.object({
	title: z.string().min(1),
	options: z.array(
		z.object({
			id: z.string().min(1),
			label: z.string().min(1),
		}),
	),
	selected: z.string().nullable(),
	notes: z.string().optional(),
})

const statusThinkingCardPropsSchema = z.object({
	title: z.string().min(1),
	status: z.enum(["thinking", "running", "done", "blocked"]),
	detail: z.string().optional(),
	steps: z
		.array(
			z.object({
				id: z.string().min(1),
				label: z.string().min(1),
				state: z.enum(["queued", "running", "done", "blocked"]).optional(),
			}),
		)
		.min(1)
		.max(8),
})

export interface ComponentCatalogEntry {
	name: string
	one_line: string
	category: string
	presentation: ComponentPresentation
	scope: ComponentScope
	maturity: ComponentMaturity
	defaultPlacement: ComponentPlacement
	allowedPlacements: ComponentPlacement[]
	sourcePackage?: string
	storybookPath?: string
	docsPath?: string
	propsSchema: z.ZodTypeAny
	example: { component: string; props: unknown }
}

const COMPONENT_CATALOG: ComponentCatalogEntry[] = [
	{
		name: "dag-sparkline",
		one_line: "Render DAG with node + edge props",
		category: "diagram",
		presentation: "inline-artifact",
		scope: "generic",
		maturity: "stable",
		defaultPlacement: "inline",
		allowedPlacements: ["inline", "chat-inline-right", "side-panel"],
		sourcePackage: "@ch5me/dag-sparkline",
		storybookPath: "packages/web/dag-sparkline/src/DagSpark.stories.tsx",
		docsPath: "docs/genui-artifact-architecture.md",
		propsSchema: dagSparklinePropsSchema,
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
	},
	{
		name: "decision_card",
		one_line: "Interactive decision card with local notes state and submit signal",
		category: "decision",
		presentation: "inline-artifact",
		scope: "generic",
		maturity: "stable",
		defaultPlacement: "inline",
		allowedPlacements: ["inline", "chat-inline-right"],
		docsPath: "docs/genui-artifact-architecture.md",
		propsSchema: decisionCardPropsSchema,
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
	},
	{
		name: "status_thinking_card",
		one_line: "Compact status card for multi-step agent work",
		category: "custom",
		presentation: "inline-artifact",
		scope: "generic",
		maturity: "beta",
		defaultPlacement: "inline",
		allowedPlacements: ["inline", "above-chat", "chat-inline-right"],
		sourcePackage: "@ch5me/remotion-experiences",
		storybookPath: "packages/web/remotion-experiences/src/spikes/StatusThinkingCard.stories.tsx",
		docsPath: "docs/genui-artifact-architecture.md",
		propsSchema: statusThinkingCardPropsSchema,
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
	},
]

export function getComponentCatalogItems(): ComponentCatalogEntry[] {
	return [...COMPONENT_CATALOG]
}

export function describeComponentCatalogEntry(name: string): ComponentCatalogEntry | undefined {
	return COMPONENT_CATALOG.find((entry) => entry.name === name)
}
