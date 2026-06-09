import { describeGenUiEntry } from "../../renderer/genui/registry"

export interface ComponentBindingSummary {
	name: string
	props: unknown
	events: Record<string, unknown>
	state: Record<string, unknown>
	conflictPolicy: string
}

export function summarizeComponentBindings(name: string): ComponentBindingSummary | undefined {
	const described = describeGenUiEntry(name)
	if (!described) return undefined
	const schema = described.schema as {
		props?: unknown
		events?: Record<string, unknown>
		state?: Record<string, unknown>
		conflictPolicy?: string
	}
	return {
		name: described.entry.name,
		props: schema.props ?? {},
		events: schema.events ?? {},
		state: schema.state ?? {},
		conflictPolicy: schema.conflictPolicy ?? "ask",
	}
}
