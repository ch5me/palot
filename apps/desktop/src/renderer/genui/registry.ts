import type { ComponentType } from "react"
import { DagSparklineEntry } from "./components/dag-sparkline"

// ============================================================
// GenUI Registry
// ============================================================
//
// Single source of truth for inline "generative UI" components: both the
// chat renderer (dispatch `name` → `Component`) and the model instruction
// (`buildGenUiCatalog()`) derive from these entries, so they cannot drift.

/** Result of validating raw fence props against a component's schema. */
export type ParsePropsResult<P> = { ok: true; props: P } | { ok: false; error: string }

/**
 * A single registered GenUI component. `Props` is the validated prop type
 * the component renders with.
 */
export interface GenUiEntry<P = Record<string, unknown>> {
	/** Canonical machine name used in the ```genui fence `component` field. */
	name: string
	/** Plain-English aliases the user might say (e.g. "dag sparkline", "graph"). */
	aliases: string[]
	/** One-line description shown to the model so it can pick this component. */
	description: string
	/** The React component that renders validated props. */
	Component: ComponentType<P>
	/** Validate + coerce raw JSON props from a fence into the component's props. */
	parseProps: (raw: unknown) => ParsePropsResult<P>
	/** A compact, valid example fence body the model can mimic. */
	example: { component: string; props: unknown }
}

// ============================================================
// Registry table
// ============================================================

// biome-ignore lint/suspicious/noExplicitAny: the registry is heterogeneous by
// design — each entry validates and renders its own prop type internally.
const ENTRIES: GenUiEntry<any>[] = [DagSparklineEntry]

/** All registered entries, in registration order. */
export const genUiEntries: ReadonlyArray<GenUiEntry> = ENTRIES

/** Lookup by canonical name (case-insensitive). Aliases also resolve here. */
const byName = new Map<string, GenUiEntry>()
for (const entry of ENTRIES) {
	byName.set(entry.name.toLowerCase(), entry)
	for (const alias of entry.aliases) {
		const key = alias.toLowerCase()
		// Canonical names win over aliases on collision.
		if (!byName.has(key)) byName.set(key, entry)
	}
}

/**
 * Resolve a component name or alias to its registry entry. Normalizes
 * casing and common separators ("DAG Sparkline" → "dag-sparkline").
 */
export function resolveGenUiEntry(name: string): GenUiEntry | undefined {
	const raw = name.trim().toLowerCase()
	const direct = byName.get(raw)
	if (direct) return direct
	// Normalize separators: "dag sparkline" / "dag_sparkline" → "dag-sparkline"
	const dashed = raw.replace(/[\s_]+/g, "-")
	return byName.get(dashed)
}

// ============================================================
// Model-facing catalog
// ============================================================

/**
 * Build the system instruction describing every available GenUI component.
 * Injected into session context so the model knows what it can render and
 * the exact fence shape. Derived from the registry so it never drifts.
 */
export function buildGenUiCatalog(): string {
	const lines: string[] = []
	lines.push(
		"[Inline UI] You can render rich interactive components inline in your reply by emitting a ```genui code fence.",
		'The fence body is JSON: { "component": "<name>", "props": { ... } }. One component per fence; emit as many fences as you like.',
		"Only use a component when it genuinely helps the user. Available components:",
	)
	for (const entry of genUiEntries) {
		const aliasNote = entry.aliases.length > 0 ? ` (aliases: ${entry.aliases.join(", ")})` : ""
		lines.push(`\n• ${entry.name}${aliasNote} — ${entry.description}`)
		lines.push("  Example:")
		lines.push("  ```genui")
		lines.push(`  ${JSON.stringify(entry.example)}`)
		lines.push("  ```")
	}
	return lines.join("\n")
}
