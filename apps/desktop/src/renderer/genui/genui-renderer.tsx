import { MessageResponse } from "@ch5me/elf-ui/components/ai-elements/message"
import { memo, useMemo } from "react"
import { resolveGenUiEntry } from "./registry"

// ============================================================
// Fence parsing
// ============================================================

const GENUI_FENCE_RE = /```genui\s*\n([\s\S]*?)\n```/g
const DAG_FENCE_RE = /```dag\s*\n([\s\S]*?)\n```/g

export type GenUiSegment =
	| { kind: "text"; text: string }
	| { kind: "genui"; name: string; props: unknown; raw: string }
	| { kind: "genui-error"; raw: string; error: string }

interface FenceMatch {
	start: number
	end: number
	name: string | null
	body: string
}

function collectFences(text: string): FenceMatch[] {
	const matches: FenceMatch[] = []
	for (const m of text.matchAll(GENUI_FENCE_RE)) {
		matches.push({
			start: m.index ?? 0,
			end: (m.index ?? 0) + m[0].length,
			name: null,
			body: m[1] ?? "",
		})
	}
	// ```dag is a back-compat alias that maps to the dag-sparkline component.
	for (const m of text.matchAll(DAG_FENCE_RE)) {
		matches.push({
			start: m.index ?? 0,
			end: (m.index ?? 0) + m[0].length,
			name: "dag-sparkline",
			body: m[1] ?? "",
		})
	}
	return matches.sort((a, b) => a.start - b.start)
}

function parseFenceBody(match: FenceMatch): GenUiSegment {
	let parsed: unknown
	try {
		parsed = JSON.parse(match.body)
	} catch (err) {
		return { kind: "genui-error", raw: match.body, error: err instanceof Error ? err.message : "Invalid JSON" }
	}
	if (typeof parsed !== "object" || parsed === null) {
		return { kind: "genui-error", raw: match.body, error: "Expected a JSON object" }
	}
	const obj = parsed as { component?: unknown; props?: unknown }
	// A ```dag fence is the bare graph object; a ```genui fence wraps it in
	// { component, props }.
	const name = match.name ?? (typeof obj.component === "string" ? obj.component : null)
	const props = match.name ? parsed : obj.props
	if (typeof name !== "string" || name.length === 0) {
		return { kind: "genui-error", raw: match.body, error: 'Expected a string "component" field' }
	}
	return { kind: "genui", name, props, raw: match.body }
}

/**
 * Split text into alternating text / genui segments. Both ```genui and the
 * legacy ```dag fences are extracted in order. When `dropErrors` is true,
 * fences that fail to parse stay as plain text so partial streaming fences
 * don't flash an error.
 */
export function splitGenUiFences(text: string, options: { dropErrors?: boolean } = {}): GenUiSegment[] {
	const matches = collectFences(text)
	if (matches.length === 0) return [{ kind: "text", text }]
	const segments: GenUiSegment[] = []
	let cursor = 0
	for (const match of matches) {
		if (match.start < cursor) continue
		if (match.start > cursor) segments.push({ kind: "text", text: text.slice(cursor, match.start) })
		const seg = parseFenceBody(match)
		if (seg.kind === "genui-error" && options.dropErrors) {
			segments.push({ kind: "text", text: text.slice(match.start, match.end) })
		} else {
			segments.push(seg)
		}
		cursor = match.end
	}
	if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) })
	return segments
}

// ============================================================
// GenUiBlock — dispatch a parsed segment to its registered component
// ============================================================

function GenUiBlockImpl({ name, props }: { name: string; props: unknown }) {
	const entry = resolveGenUiEntry(name)
	if (!entry) {
		return <GenUiErrorBlock error={`Unknown component: ${name}`} raw={JSON.stringify(props)} />
	}
	const parsed = entry.parseProps(props)
	if (!parsed.ok) {
		return <GenUiErrorBlock error={`${entry.name}: ${parsed.error}`} raw={JSON.stringify(props)} />
	}
	const Component = entry.Component
	return <Component {...parsed.props} />
}

export const GenUiBlock = memo(GenUiBlockImpl)

function GenUiErrorBlockImpl({ error, raw }: { error: string; raw: string }) {
	return (
		<div className="my-2 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">
			<p className="font-medium">Invalid genui block: {error}</p>
			<pre className="mt-1 max-h-32 overflow-auto font-mono text-[11px] text-red-400/80">
				<code>{raw.length > 400 ? `${raw.slice(0, 400)}...` : raw}</code>
			</pre>
		</div>
	)
}

export const GenUiErrorBlock = memo(GenUiErrorBlockImpl)

// ============================================================
// TextWithGenUi — drop-in replacement for <MessageResponse> in chat turns
// ============================================================

interface TextWithGenUiProps {
	text: string
	isStreaming?: boolean
	className?: string
}

/**
 * Renders a text response, replacing any ```genui (or legacy ```dag) code
 * fences with inline interactive GenUI components from the registry. Bad
 * fences are dropped silently so partial streaming text doesn't flash
 * parse errors.
 */
export function TextWithGenUi({ text, isStreaming, className }: TextWithGenUiProps) {
	const segments = useMemo(() => splitGenUiFences(text, { dropErrors: true }), [text])
	if (segments.length === 1 && segments[0].kind === "text") {
		return (
			<MessageResponse className={className} animated={isStreaming}>
				{text}
			</MessageResponse>
		)
	}
	return (
		<div className={className}>
			{segments.map((seg, i) => {
				if (seg.kind === "text") {
					return (
						<MessageResponse key={i} animated={isStreaming}>
							{seg.text}
						</MessageResponse>
					)
				}
				if (seg.kind === "genui") {
					return <GenUiBlock key={i} name={seg.name} props={seg.props} />
				}
				return <GenUiErrorBlock key={i} error={seg.error} raw={seg.raw} />
			})}
		</div>
	)
}
