import { z } from "zod"

import { PALOT_BRIDGE_DECISION_CARD_COMPONENT } from "./palot-bridge-manifest"

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

const BRIDGE_COMPONENT_SUMMARIES: Record<string, ComponentBindingSummary> = {
	decision_card: {
		name: PALOT_BRIDGE_DECISION_CARD_COMPONENT.component,
		props: PALOT_BRIDGE_DECISION_CARD_COMPONENT.props,
		events: PALOT_BRIDGE_DECISION_CARD_COMPONENT.events,
		state: PALOT_BRIDGE_DECISION_CARD_COMPONENT.state,
		conflictPolicy: PALOT_BRIDGE_DECISION_CARD_COMPONENT.conflictPolicy,
	},
}

export function summarizeComponentBindings(componentId: string): ComponentBindingSummary | undefined {
	return BRIDGE_COMPONENT_SUMMARIES[componentId]
}

export function summarizeZodComponentBindings(definition: {
	name: string
	props: z.ZodTypeAny
	events?: Record<string, z.ZodTypeAny>
	state?: Record<string, z.ZodTypeAny>
	conflictPolicy?: string
}): ComponentBindingSummary {
	return {
		name: definition.name,
		props: toJsonishSchema(definition.props),
		events: summarizeZodSchemaRecord(definition.events ?? {}),
		state: summarizeZodSchemaRecord(definition.state ?? {}),
		conflictPolicy: definition.conflictPolicy ?? "ask",
	}
}

export function summarizeZodSchema(schema: z.ZodTypeAny): unknown {
	return toJsonishSchema(schema)
}

export function summarizeZodSchemaRecord(record: Record<string, z.ZodTypeAny>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toJsonishSchema(value)]))
}
