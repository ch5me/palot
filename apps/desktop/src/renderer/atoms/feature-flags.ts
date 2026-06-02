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

// ============================================================
// Side-panel surfaces (merged AIOS features)
//
// Each absorbed super-app surface lands as a flag-gated side-panel tab so it
// can be turned off without deleting code. Toggle via Cmd+K > "Features".
// Heavy / platform-specific surfaces should default OFF until they are
// re-themed and Windows-ready; the Browser tab is a placeholder for now and
// defaults ON to exercise the toggle.
// ============================================================

/** Whether the Browser side-panel tab is available. */
export const browserPanelEnabledAtom = atomWithStorage<boolean>("palot:browserPanelEnabled", true)

/** Write-only toggle for the command palette. */
export const toggleBrowserPanelAtom = atom(null, (get, set) => {
	set(browserPanelEnabledAtom, !get(browserPanelEnabledAtom))
})
