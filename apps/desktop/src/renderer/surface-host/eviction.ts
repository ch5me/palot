import type { SurfaceInstance } from "./types"

/**
 * Retention policy buckets.
 *
 * - `keepAlways`: never auto-destroyed (stateful / live process / iframe / unsaved-draft surfaces).
 * - `keepLRU`: keep up to a per-type cap, evict least-recently-used under pressure (future).
 * - `destroyAfterHiddenMs`: fully reconstructible; destroy after hidden this long.
 */
export type RetentionPolicy =
	| { kind: "keepAlways" }
	| { kind: "keepLRU"; max: number }
	| { kind: "destroyAfterHiddenMs"; ms: number }

/** Per-type LRU caps (see plan §3 eviction policy). */
export const KEEP_LRU_CAPS = {
	chat: 8,
	editor: 20,
	browser: 4,
	terminal: 8,
} as const

/** Convenience constructors for the three retention buckets. */
export const keepAlways = (): RetentionPolicy => ({ kind: "keepAlways" })
export const keepLRU = (max: number): RetentionPolicy => ({ kind: "keepLRU", max })
export const destroyAfterHiddenMs = (ms: number): RetentionPolicy => ({
	kind: "destroyAfterHiddenMs",
	ms,
})

/**
 * Per-surface-type retention policy map.
 *
 * keepAlways (never evict): stateful / live process / iframe / unsaved-draft surfaces.
 *   chat, editor, terminal, browser, voice, studio, ch5pm, memory, crm
 *
 * destroyAfterHiddenMs (5 min = 300_000 ms): cheap to reconstruct.
 *   artifacts, pulse, bridges, files, review, oracle, claude, notes
 *
 * Unknown types fall back to keepAlways — safest default for unclassified surfaces.
 */
const POLICY_MAP: Record<string, RetentionPolicy> = {
	// --- keepAlways ---
	chat: { kind: "keepAlways" },
	editor: { kind: "keepAlways" },
	terminal: { kind: "keepAlways" },
	browser: { kind: "keepAlways" },
	voice: { kind: "keepAlways" },
	studio: { kind: "keepAlways" },
	ch5pm: { kind: "keepAlways" },
	memory: { kind: "keepAlways" },
	crm: { kind: "keepAlways" },
	// --- destroyAfterHiddenMs (5 min) ---
	artifacts: { kind: "destroyAfterHiddenMs", ms: 300_000 },
	pulse: { kind: "destroyAfterHiddenMs", ms: 300_000 },
	bridges: { kind: "destroyAfterHiddenMs", ms: 300_000 },
	files: { kind: "destroyAfterHiddenMs", ms: 300_000 },
	review: { kind: "destroyAfterHiddenMs", ms: 300_000 },
	oracle: { kind: "destroyAfterHiddenMs", ms: 300_000 },
	claude: { kind: "destroyAfterHiddenMs", ms: 300_000 },
	notes: { kind: "destroyAfterHiddenMs", ms: 300_000 },
}

/**
 * Return the retention policy for a surface type. Falls back to `keepAlways`
 * for unknown types — the safest default for any stateful surface we haven't
 * explicitly classified.
 */
export function getRetentionPolicy(surfaceType: string): RetentionPolicy {
	return POLICY_MAP[surfaceType] ?? { kind: "keepAlways" }
}

/** Inputs an eviction sweep needs. Filled in by the registry. */
export interface EvictionContext {
	instances: ReadonlyMap<string, SurfaceInstance>
	policyFor(instanceId: string): RetentionPolicy
	evict(instanceId: string): void
	now: number
}

/**
 * Eviction sweep — enforces conservative destruction rules.
 *
 * A surface is destroyed ONLY when ALL of the following hold:
 *   1. Policy is `destroyAfterHiddenMs`
 *   2. retainCount === 0  (not attached to any slot)
 *   3. visibility !== "visible"
 *   4. hiddenAt is set AND `now - hiddenAt >= policy.ms`
 *
 * NEVER destroys keepAlways, keepLRU, attached, or visible surfaces.
 *
 * `now` is injected via `ctx.now` so callers (tests) can control time —
 * enforce never reads `Date.now()` itself.
 */
export function enforce(ctx: EvictionContext): void {
	// Collect candidates first to avoid mutating the map during iteration
	const toEvict: string[] = []

	for (const [instanceId, instance] of ctx.instances) {
		// Guard 2: must not be attached to any slot
		if (instance.retainCount !== 0) continue
		// Guard 3: must not be visible
		if (instance.visibility === "visible") continue
		// Guard 4: must have a hiddenAt timestamp
		if (instance.hiddenAt === undefined) continue

		const policy = ctx.policyFor(instanceId)
		// Guard 1: only destroyAfterHiddenMs surfaces qualify for sweep destruction
		if (policy.kind !== "destroyAfterHiddenMs") continue

		// Guard 4 (threshold): must have been hidden long enough
		if (ctx.now - instance.hiddenAt < policy.ms) continue

		toEvict.push(instanceId)
	}

	for (const instanceId of toEvict) {
		ctx.evict(instanceId)
	}
}
