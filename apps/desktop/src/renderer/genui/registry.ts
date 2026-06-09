import type { ComponentType } from "react"
import { z } from "zod"
import { DagSparklineEntry } from "./components/dag-sparkline"
import { DecisionCardEntry } from "./components/decision-card"

export type ParsePropsResult<P> = { ok: true; props: P } | { ok: false; error: string }

export interface GenUiLegacyFence {
	fence: string
	parseBody: (body: string) => unknown
}

export type GenUiConflictPolicy = "agent-wins" | "human-wins" | "merge" | "ask"

export interface GenUiEntry<P = Record<string, unknown>> {
	name: string
	aliases: string[]
	description: string
	Component: ComponentType<P>
	props: z.ZodType<P>
	events: Record<string, z.ZodTypeAny>
	state: Record<string, z.ZodTypeAny>
	conflictPolicy?: GenUiConflictPolicy
	merge?: (humanValue: unknown, agentValue: unknown, field: string) => unknown
	legacyFences?: GenUiLegacyFence[]
	example: { component: string; props: unknown }
}

export interface GenUiCatalogItem {
	name: string
	one_line: string
	category: string
}

const DEFAULT_CATEGORY = "custom"
const CATEGORY_KEYWORDS: Record<string, string> = {
	dag: "diagram",
	graph: "diagram",
	diagram: "diagram",
	decision: "decision",
	form: "form",
	viewer: "viewer",
	layout: "layout",
}

function inferCategory(entry: GenUiEntry): string {
	const haystack = `${entry.name} ${entry.aliases.join(" ")} ${entry.description}`.toLowerCase()
	for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
		if (haystack.includes(keyword)) return category
	}
	return DEFAULT_CATEGORY
}

export function parseGenUiProps<P>(entry: GenUiEntry<P>, raw: unknown): ParsePropsResult<P> {
	const parsed = entry.props.safeParse(raw)
	if (parsed.success) {
		return { ok: true, props: parsed.data }
	}
	const firstIssue = parsed.error.issues[0]
	return { ok: false, error: firstIssue?.message ?? "Invalid props" }
}

export function getGenUiCatalogItems(): GenUiCatalogItem[] {
	return genUiEntries.map((entry) => ({
		name: entry.name,
		one_line: entry.description,
		category: inferCategory(entry),
	}))
}

export function getLegacyFenceEntries(): Array<{ entry: GenUiEntry; fence: GenUiLegacyFence }> {
	const legacyEntries: Array<{ entry: GenUiEntry; fence: GenUiLegacyFence }> = []
	for (const entry of genUiEntries) {
		for (const fence of entry.legacyFences ?? []) {
			legacyEntries.push({ entry, fence })
		}
	}
	return legacyEntries
}

export function describeGenUiEntry(name: string):
	| {
		entry: GenUiEntry
		catalog: GenUiCatalogItem
		schema: unknown
	  }
	| undefined {
	const entry = resolveGenUiEntry(name)
	if (!entry) return undefined
	let schema: unknown
	try {
		schema = entry.props.toJSONSchema?.({ unrepresentable: "any" })
	} catch {
		schema = { schemaPath: entry.name, description: entry.description }
	}
	return {
		entry,
		catalog: {
			name: entry.name,
			one_line: entry.description,
			category: inferCategory(entry),
		},
		schema: {
			props: schema,
			events: Object.fromEntries(
				Object.entries(entry.events).map(([key, value]) => [key, value.toJSONSchema?.({ unrepresentable: "any" }) ?? { type: "object" }]),
			),
			state: Object.fromEntries(
				Object.entries(entry.state).map(([key, value]) => [key, value.toJSONSchema?.({ unrepresentable: "any" }) ?? { type: "object" }]),
			),
			conflictPolicy: entry.conflictPolicy ?? "ask",
		},
	}
}

// biome-ignore lint/suspicious/noExplicitAny: registry heterogeneous by design.
const ENTRIES: GenUiEntry<any>[] = [DagSparklineEntry, DecisionCardEntry]

export const genUiEntries: ReadonlyArray<GenUiEntry> = ENTRIES

const byName = new Map<string, GenUiEntry>()
for (const entry of ENTRIES) {
	byName.set(entry.name.toLowerCase(), entry)
	for (const alias of entry.aliases) {
		const key = alias.toLowerCase()
		if (!byName.has(key)) byName.set(key, entry)
	}
}

export function resolveGenUiEntry(name: string): GenUiEntry | undefined {
	const raw = name.trim().toLowerCase()
	const direct = byName.get(raw)
	if (direct) return direct
	const dashed = raw.replace(/[\s_]+/g, "-")
	return byName.get(dashed)
}

export function buildGenUiCatalog(): string {
	const lines: string[] = []
	lines.push(
		"[Inline UI] You can render rich interactive components inline in your reply by emitting a ```genui code fence.",
		'The fence body is JSON: { "component": "<name>", "props": { ... } }. One component per fence; emit as many fences as you like.',
		"Only use a component when it genuinely helps the user. Available components:",
	)
	for (const item of getGenUiCatalogItems()) {
		lines.push(`\n• ${item.name} — ${item.one_line} [category=${item.category}]`)
	}
	return lines.join("\n")
}
