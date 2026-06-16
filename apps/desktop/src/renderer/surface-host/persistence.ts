import type { DockPanelRecord, DockZone } from "./types"

/**
 * Surface-host persistence — dock layout (surfaceType → zone).
 *
 * Persists the user's surface→zone arrangement to localStorage by surfaceType
 * (session-agnostic). First load or any parse failure falls through to default
 * zones — the defaults in agent-detail.tsx are unchanged.
 *
 * Key: `elf:dock-layout:v1`
 * Shape: `{ version: 1, byType: Record<surfaceType, DockZone> }`
 *
 * Dockview layout (api.toJSON/fromJSON) is persisted SEPARATELY from app surface
 * state. Serialized panels store only lightweight references; the registry is
 * the durable source of truth. WARNING: `fromJSON()` removes panels not in the
 * layout, so hidden heavy surfaces do NOT survive a naive `fromJSON` — restore
 * them from the registry, not from the Dockview layout.
 */

const DOCK_LAYOUT_KEY = "elf:dock-layout:v1"
const DOCK_LAYOUT_VERSION = 1

/** Persisted dock layout: surfaceType → zone. Session-agnostic. */
export interface PersistedDockLayout {
	version: number
	byType: Record<string, DockZone>
}

/**
 * Save the current dock arrangement to localStorage.
 * Derives `byType` (surfaceType → zone) from the live dock panel records.
 * No-op in non-browser environments or when localStorage is unavailable.
 */
export function saveDockLayout(records: ReadonlyMap<string, DockPanelRecord>): void {
	if (typeof window === "undefined") return
	try {
		const byType: Record<string, DockZone> = {}
		for (const record of records.values()) {
			byType[record.surfaceType] = record.zone
		}
		const layout: PersistedDockLayout = { version: DOCK_LAYOUT_VERSION, byType }
		localStorage.setItem(DOCK_LAYOUT_KEY, JSON.stringify(layout))
	} catch {
		// localStorage may be unavailable (private browsing, quota exceeded, etc.)
	}
}

/**
 * Load the persisted dock layout from localStorage.
 * Returns `null` on missing key, parse error, or version mismatch.
 * NEVER throws.
 */
export function loadDockLayout(): PersistedDockLayout | null {
	if (typeof window === "undefined") return null
	try {
		const raw = localStorage.getItem(DOCK_LAYOUT_KEY)
		if (!raw) return null
		const parsed: unknown = JSON.parse(raw)
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			(parsed as PersistedDockLayout).version !== DOCK_LAYOUT_VERSION ||
			typeof (parsed as PersistedDockLayout).byType !== "object" ||
			(parsed as PersistedDockLayout).byType === null
		) {
			return null
		}
		return parsed as PersistedDockLayout
	} catch {
		return null
	}
}
