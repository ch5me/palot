import { MessageResponse } from "@ch5me/elf-ui/components/ai-elements/message"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { useSetAtom } from "jotai"
import { memo, useEffect, useMemo, useRef } from "react"
import { upsertGenUiArtifactAtom } from "../atoms/genui-artifacts"
import { useLoomContext } from "../loom/loom-context"
import { LoomRenderer } from "../loom/loom-renderer"
import type { GenUiArtifactDescriptor } from "../lib/types"
import { GenUiArtifactInlineActions } from "../components/genui/genui-artifact-inline-actions"
import { parseGenUiProps, resolveGenUiEntry } from "./registry"

// ============================================================
// Fence parsing
// ============================================================

const GENUI_FENCE_RE = /```genui\s*\n([\s\S]*?)\n```/g
const DAG_FENCE_RE = /```dag\s*\n([\s\S]*?)\n```/g

export type GenUiSegment =
	| { kind: "text"; text: string }
	| { kind: "genui"; name: string; props: unknown; raw: string }
	| { kind: "genui-error"; raw: string; error: string }
	| {
			kind: "genui-pending"
			raw: string
			name?: string
			propsPreview?: unknown
			heightClass?: string
			widthClass?: string
		}

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
	const name = match.name ?? (typeof obj.component === "string" ? obj.component : null)
	const props = match.name ? parsed : obj.props
	if (typeof name !== "string" || name.length === 0) {
		return { kind: "genui-error", raw: match.body, error: 'Expected a string "component" field' }
	}
	return { kind: "genui", name, props, raw: match.body }
}

function inferPendingFrameProps(name?: string, propsPreview?: unknown) {
	if (name === "dag-sparkline") {
		const previewNodes = (propsPreview as { nodes?: unknown } | undefined)?.nodes
		const nodeCount = Array.isArray(previewNodes) ? previewNodes.length : undefined
		return {
			heightClass: "min-h-[112px]",
			widthClass: nodeCount && nodeCount >= 5 ? "w-full max-w-[560px]" : "w-full max-w-[460px]",
		}
	}
	return {
		heightClass: "min-h-[104px]",
		widthClass: "w-full max-w-[420px]",
	}
}

function parsePendingGenUi(text: string): Extract<GenUiSegment, { kind: "genui-pending" }> | null {
	const genuiStart = text.lastIndexOf("```genui")
	const dagStart = text.lastIndexOf("```dag")
	const start = Math.max(genuiStart, dagStart)
	if (start === -1) return null
	const raw = text.slice(start)
	if (/\n```\s*$/.test(raw)) return null

	const bodyStart = raw.indexOf("\n")
	if (bodyStart === -1) {
		return { kind: "genui-pending", raw }
	}

	const body = raw.slice(bodyStart + 1)
	if (raw.startsWith("```dag")) {
		try {
			const propsPreview = JSON.parse(body)
			return {
				kind: "genui-pending",
				raw,
				name: "dag-sparkline",
				propsPreview,
				...inferPendingFrameProps("dag-sparkline", propsPreview),
			}
		} catch {
			return {
				kind: "genui-pending",
				raw,
				name: "dag-sparkline",
				...inferPendingFrameProps("dag-sparkline"),
			}
		}
	}

	const componentMatch = body.match(/"component"\s*:\s*"([^"]+)"/)
	let propsPreview: unknown
	try {
		propsPreview = JSON.parse(body)
	} catch {}
	const name = componentMatch?.[1]
	return {
		kind: "genui-pending",
		raw,
		name,
		propsPreview,
		...inferPendingFrameProps(name, propsPreview),
	}
}

/**
 * Split text into alternating text / genui segments. Both ```genui and the
 * legacy ```dag fences are extracted in order. When `dropErrors` is true,
 * fences that fail to parse stay as plain text so partial streaming fences
 * don't flash an error.
 */
export function splitGenUiFences(text: string, options: { dropErrors?: boolean } = {}): GenUiSegment[] {
	const matches = collectFences(text)
	if (matches.length === 0) {
		const pending = parsePendingGenUi(text)
		if (!pending) return [{ kind: "text", text }]
		const start = text.length - pending.raw.length
		const segments: GenUiSegment[] = []
		if (start > 0) segments.push({ kind: "text", text: text.slice(0, start) })
		segments.push(pending)
		return segments
	}
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
	if (cursor < text.length) {
		const trailing = text.slice(cursor)
		const pending = parsePendingGenUi(trailing)
		if (pending) {
			const pendingStart = trailing.length - pending.raw.length
			if (pendingStart > 0) segments.push({ kind: "text", text: trailing.slice(0, pendingStart) })
			segments.push(pending)
		} else {
			segments.push({ kind: "text", text: trailing })
		}
	}
	return segments
}

// ============================================================
// GenUiBlock — dispatch a parsed segment to its registered component
// ============================================================

function GenUiBlockImpl({
	name,
	props,
	pendingHeightClass,
	pendingWidthClass,
}: {
	name: string
	props: unknown
	pendingHeightClass?: string
	pendingWidthClass?: string
}) {
	const entry = resolveGenUiEntry(name)
	if (!entry) {
		return <GenUiErrorBlock error={`Unknown component: ${name}`} raw={JSON.stringify(props)} />
	}
	const parsed = parseGenUiProps(entry, props)
	if (!parsed.ok) {
		return <GenUiErrorBlock error={`${entry.name}: ${parsed.error}`} raw={JSON.stringify(props)} />
	}
	const Component = entry.Component
	return (
		<div
			className={cn(
				"my-2 transition-[width,height,max-width,transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
				pendingHeightClass,
				pendingWidthClass,
			)}
		>
			<Component {...parsed.props} />
		</div>
	)
}

export const GenUiBlock = memo(GenUiBlockImpl)

interface ArtifactCaptureProps {
	sessionId: string
	messageId: string
	partId?: string
	descriptor: GenUiArtifactDescriptor
	rawFence: string
}

function GenUiArtifactCapture({ sessionId, messageId, partId, descriptor, rawFence }: ArtifactCaptureProps) {
	const upsertArtifact = useSetAtom(upsertGenUiArtifactAtom)
	const artifactIdRef = useRef<string | null>(null)

	useEffect(() => {
		const artifactId = upsertArtifact({
			sessionId,
			descriptor,
			source: {
				sessionId,
				messageId,
				partId,
				component: descriptor.component,
				rawFence,
			},
			artifactId: artifactIdRef.current ?? undefined,
		})
		artifactIdRef.current = artifactId
	}, [descriptor, messageId, partId, rawFence, sessionId, upsertArtifact])

	if (!artifactIdRef.current) {
		return null
	}

	return <GenUiArtifactInlineActions sessionId={sessionId} artifactId={artifactIdRef.current} />
}

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

function GenUiPendingBlockImpl({
	propsPreview,
	heightClass,
	widthClass,
}: {
	name?: string
	propsPreview?: unknown
	heightClass?: string
	widthClass?: string
}) {
	const previewNodes = (propsPreview as { nodes?: unknown } | undefined)?.nodes
	const preview = Array.isArray(previewNodes) ? previewNodes.length : 3
	const pills = Math.min(Math.max(preview, 3), 6)
	return (
		<div
			className={cn(
				"my-2 overflow-hidden rounded-md border border-primary/25 bg-gradient-to-br from-primary/8 via-background to-primary/5 transition-[width,height,max-width,transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
				heightClass,
				widthClass,
			)}
		>
			<div className="flex h-full flex-col justify-center gap-4 px-4 py-4">
				<div className="h-2.5 w-20 animate-pulse rounded-full bg-primary/15" />
				<div className="flex items-center gap-2">
					{Array.from({ length: pills }).map((_, i) => (
						<div key={i} className="flex min-w-0 flex-1 items-center gap-2">
							<div
								className={cn(
									"h-8 animate-pulse rounded-md bg-primary/12",
									i % 3 === 1 ? "w-full" : i % 3 === 2 ? "w-16" : "w-20",
								)}
							/>
							{i < pills - 1 && <div className="h-px flex-1 bg-primary/15" />}
						</div>
					))}
				</div>
				<div className="flex gap-2">
					<div className="h-2 w-14 animate-pulse rounded-full bg-primary/10" />
					<div className="h-2 w-10 animate-pulse rounded-full bg-primary/10 delay-150" />
					<div className="h-2 w-16 animate-pulse rounded-full bg-primary/10 delay-300" />
				</div>
			</div>
		</div>
	)
}

const GenUiPendingBlock = memo(GenUiPendingBlockImpl)

// ============================================================
// TextWithGenUi — drop-in replacement for <MessageResponse> in chat turns
// ============================================================

interface TextWithGenUiProps {
	text: string
	isStreaming?: boolean
	className?: string
	sessionId?: string
	messageId?: string
	partId?: string
}

/**
 * Renders a text response, replacing any ```genui (or legacy ```dag) code
 * fences with inline interactive GenUI components from the registry. Bad
 * fences are dropped silently so partial streaming text doesn't flash
 * parse errors.
 */
export function TextWithGenUi({ text, isStreaming, className, sessionId, messageId, partId }: TextWithGenUiProps) {
	const loom = useLoomContext()
	const segments = useMemo(() => splitGenUiFences(text, { dropErrors: true }), [text])
	if (loom?.tree) {
		return <LoomRenderer tree={loom.tree} />
	}
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
					const prev = segments[i - 1]
					const pendingFrame = prev?.kind === "genui-pending" ? prev : undefined
					return (
						<div key={i}>
							{sessionId && messageId ? (
								<GenUiArtifactCapture
									sessionId={sessionId}
									messageId={messageId}
									partId={partId}
									descriptor={{
										component: seg.name,
										props:
											typeof seg.props === "object" && seg.props !== null
												? (seg.props as Record<string, unknown>)
												: {},
									}}
									rawFence={seg.raw}
								/>
							) : null}
							<GenUiBlock
								name={seg.name}
								props={seg.props}
								pendingHeightClass={pendingFrame?.heightClass}
								pendingWidthClass={pendingFrame?.widthClass}
							/>
						</div>
					)
				}
				if (seg.kind === "genui-pending") {
					return (
						<GenUiPendingBlock
							key={i}
							name={seg.name}
							propsPreview={seg.propsPreview}
							heightClass={seg.heightClass}
							widthClass={seg.widthClass}
						/>
					)
				}
				return <GenUiErrorBlock key={i} error={seg.error} raw={seg.raw} />
			})}
		</div>
	)
}
