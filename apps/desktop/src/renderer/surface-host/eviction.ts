import type { SurfaceInstance } from "./types"

/**
 * Retention policy buckets (full enforcement is a later phase — this is a stub
 * so imports resolve and the policy shape is fixed).
 *
 * - `keepAlways`: never auto-destroyed (editor, terminal, browser).
 * - `keepLRU`: keep up to a per-type cap, evict least-recently-used under pressure.
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

/** Inputs an eviction sweep needs. Filled in by the registry in a later phase. */
export interface EvictionContext {
	instances: ReadonlyMap<string, SurfaceInstance>
	policyFor(instanceId: string): RetentionPolicy
	evict(instanceId: string): void
	now: number
}

/**
 * No-op eviction sweep. Later phases implement keepLRU/destroyAfterHiddenMs
 * enforcement here; for now it preserves every surface (never evicts).
 */
export function enforce(_ctx: EvictionContext): void {}
