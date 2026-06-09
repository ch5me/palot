import { z } from "zod"

function toJsonishSchema(schema: z.ZodTypeAny): unknown {
	try {
		return schema.toJSONSchema?.({ unrepresentable: "any" }) ?? { type: "object" }
	} catch {
		return { type: "object" }
	}
}

export interface ComponentBindingSummary {
	name: string
	props: unknown
	events: Record<string, unknown>
	state: Record<string, unknown>
	conflictPolicy: string
}

export function summarizeComponentBindings(definition: {
	name: string
	props: z.ZodTypeAny
	events: Record<string, z.ZodTypeAny>
	state: Record<string, z.ZodTypeAny>
	conflictPolicy?: string
}): ComponentBindingSummary {
	return {
		name: definition.name,
		props: toJsonishSchema(definition.props),
		events: Object.fromEntries(Object.entries(definition.events).map(([key, value]) => [key, toJsonishSchema(value)])),
		state: Object.fromEntries(Object.entries(definition.state).map(([key, value]) => [key, toJsonishSchema(value)])),
		conflictPolicy: definition.conflictPolicy ?? "ask",
	}
}

export function summarizeZodSchema(schema: z.ZodTypeAny): unknown {
	return toJsonishSchema(schema)
}

export function summarizeZodSchemaRecord(record: Record<string, z.ZodTypeAny>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toJsonishSchema(value)]))
}
