import type { DockZone } from "./types"

/**
 * Surface-host persistence (full implementation is a later phase — this is a
 * stub fixing the policy shape so imports resolve).
 *
 * Dockview layout (api.toJSON/fromJSON) is persisted SEPARATELY from app surface
 * state. Serialized panels store only lightweight references; the registry is
 * the durable source of truth. WARNING: `fromJSON()` removes panels not in the
 * layout, so hidden heavy surfaces do NOT survive a naive `fromJSON` — restore
 * them from the registry, not from the Dockview layout.
 */

/** Lightweight reference persisted per Dockview panel. */
export interface PersistedSurfaceRef {
	surfaceInstanceId: string
	zone: DockZone
}

/** Restore order contract (see plan §3 Persistence). */
export const RESTORE_ORDER = [
	"restore-registry-metadata",
	"create-hidden-hosts",
	"restore-dockview-layout",
	"attach-visible-slots",
	"surface-specific-restore",
] as const

export type RestoreStep = (typeof RESTORE_ORDER)[number]

/** Serialize surface refs. No-op stub for now. */
export function serializeSurfaceRefs(_refs: readonly PersistedSurfaceRef[]): string {
	return "[]"
}

/** Deserialize surface refs. No-op stub for now. */
export function deserializeSurfaceRefs(_raw: string): PersistedSurfaceRef[] {
	return []
}
