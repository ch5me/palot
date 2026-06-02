/**
 * Feature flags -- persisted toggles for experimental features.
 *
 * Each flag is an independent atomWithStorage so they survive reloads.
 * Toggle via the command palette (Cmd+K > "Enable/Disable ...").
 */

import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

// ============================================================
// Automations
// ============================================================

/**
 * Whether the Automations feature is enabled.
 * Enabled by default -- users can disable it via the command palette.
 */
export const automationsEnabledAtom = atomWithStorage<boolean>("palot:automationsEnabled", true)

/** Write-only toggle for the command palette. */
export const toggleAutomationsAtom = atom(null, (get, set) => {
	set(automationsEnabledAtom, !get(automationsEnabledAtom))
})

export const fireflySurfaceDefaults = {
	review: true,
	browserPanelEnabled: true,
	notes: true,
	pulse: false,
	memory: false,
} as const

export type FireflySurfaceFlagKey = keyof typeof fireflySurfaceDefaults

export const reviewSurfaceEnabledAtom = atomWithStorage<boolean>("palot:reviewSurfaceEnabled", true)
export const browserPanelEnabledAtom = atomWithStorage<boolean>("palot:browserPanelEnabled", true)
export const notesSurfaceEnabledAtom = atomWithStorage<boolean>("palot:notesSurfaceEnabled", true)
export const pulseSurfaceEnabledAtom = atomWithStorage<boolean>("palot:pulseSurfaceEnabled", false)
export const memorySurfaceEnabledAtom = atomWithStorage<boolean>("palot:memorySurfaceEnabled", false)

export const fireflySurfaceFlagAtoms: Record<FireflySurfaceFlagKey, typeof reviewSurfaceEnabledAtom> = {
	review: reviewSurfaceEnabledAtom,
	browserPanelEnabled: browserPanelEnabledAtom,
	notes: notesSurfaceEnabledAtom,
	pulse: pulseSurfaceEnabledAtom,
	memory: memorySurfaceEnabledAtom,
}

export const fireflySurfaceLabels: Record<FireflySurfaceFlagKey, string> = {
	review: "Changes",
	browserPanelEnabled: "Browser",
	notes: "Notes",
	pulse: "Pulse",
	memory: "Memory",
}

export const toggleReviewSurfaceAtom = atom(null, (get, set) => {
	set(reviewSurfaceEnabledAtom, !get(reviewSurfaceEnabledAtom))
})

export const toggleBrowserPanelAtom = atom(null, (get, set) => {
	set(browserPanelEnabledAtom, !get(browserPanelEnabledAtom))
})

export const toggleNotesSurfaceAtom = atom(null, (get, set) => {
	set(notesSurfaceEnabledAtom, !get(notesSurfaceEnabledAtom))
})

export const togglePulseSurfaceAtom = atom(null, (get, set) => {
	set(pulseSurfaceEnabledAtom, !get(pulseSurfaceEnabledAtom))
})

export const toggleMemorySurfaceAtom = atom(null, (get, set) => {
	set(memorySurfaceEnabledAtom, !get(memorySurfaceEnabledAtom))
})
