import { z } from "zod"
import { describeGenUiEntry } from "../../renderer/genui/registry"

export interface ComponentBindingSummary {
	name: string
	props: unknown
	events: Record<string, unknown>
	state: Record<string, unknown>
	conflictPolicy: string
}

function toJsonishSchema(schema: z.ZodTypeAny): unknown {
	try {
		return schema.toJSONSchema?.({ unrepresentable: "any" }) ?? { type: "object" }
	} catch {
		return { type: "object" }
	}
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

export function summarizeZodSchema(schema: z.ZodTypeAny): unknown {
	return toJsonishSchema(schema)
}

export function summarizeZodSchemaRecord(record: Record<string, z.ZodTypeAny>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toJsonishSchema(value)]))
}
