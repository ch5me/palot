/**
 * Surface context composition (host → agent, per turn).
 *
 * Each enabled surface registers a context projector (see
 * `registerHostContextProjector` in `firefly-plugin/dispatch.ts`) that emits a
 * compact `SurfaceContextFragment` describing its live state. Every turn the
 * host gathers all fragments and composes them into one `<surface-context>`
 * block that is injected into the agent's context, replacing the hardcoded
 * `buildProductContextBlock`.
 *
 * Fragments are intentionally tiny and TOON/AXI-shaped: a `surfaceId` for
 * routing, a human-readable `label`, and a `toon` body the projector already
 * encoded. The composer does not interpret the body — it just frames it.
 */

import { listContextProjectorFragments } from "./firefly-plugin/dispatch"

/**
 * A single surface's contribution to the per-turn agent context. The `toon`
 * field is the already-encoded body (the projector owns its own encoding so it
 * can pick the shape that reads best for that surface).
 */
export interface SurfaceContextFragment {
	surfaceId: string
	label: string
	toon: string
}

/**
 * Gather every registered surface's context fragment for this session and
 * compose them into a single `<surface-context>` string with one labeled block
 * per fragment. Returns `""` when there are no fragments so callers can cheaply
 * skip injecting an empty block.
 */
export async function composeSurfaceContext(sessionId: string | null): Promise<string> {
	const fragments = await listContextProjectorFragments(sessionId)
	if (fragments.length === 0) return ""
	const blocks = fragments.map(
		(fragment) =>
			`<surface label="${fragment.label}" id="${fragment.surfaceId}">\n${fragment.toon}\n</surface>`,
	)
	return `<surface-context>\n${blocks.join("\n")}\n</surface-context>`
}
