import { z } from "zod"

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

const COMPONENT_CATALOG = [
	{
		name: "dag-sparkline",
		one_line: "Render DAG with node + edge props",
		category: "diagram",
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
] as const

export type ComponentCatalogEntry = (typeof COMPONENT_CATALOG)[number]

export function getComponentCatalogItems(): ComponentCatalogEntry[] {
	return [...COMPONENT_CATALOG]
}

export function describeComponentCatalogEntry(name: string): ComponentCatalogEntry | undefined {
	return COMPONENT_CATALOG.find((entry) => entry.name === name)
}
