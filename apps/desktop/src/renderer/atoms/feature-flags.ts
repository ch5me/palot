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
export const automationsEnabledAtom = atomWithStorage<boolean>("elf:automationsEnabled", true)

/** Write-only toggle for the command palette. */
export const toggleAutomationsAtom = atom(null, (get, set) => {
	set(automationsEnabledAtom, !get(automationsEnabledAtom))
})


// workspaceDockEnabledAtom removed — dock is now the sole session UI (Cleanup phase, 2026-06-16).
// toggleWorkspaceDockAtom removed — no longer needed.

// ============================================================
// Loom (GenUI) feature flags
// ============================================================

export const loomEnabledAtom = atomWithStorage<boolean>("elf:loomEnabled", false)
export const loomDualBindingsAtom = atomWithStorage<boolean>("elf:loomDualBindings", false)
export const loomConflictProtectionAtom = atomWithStorage<boolean>("elf:loomConflictProtection", false)
export const loomDagSparklineDemoAtom = atomWithStorage<boolean>("elf:loomDagSparklineDemo", false)
export const loomComponentToolsEnabledAtom = atomWithStorage<boolean>(
	"elf:loomComponentToolsEnabled",
	false,
)
export const loomPersistenceMigrateAtom = atomWithStorage<boolean>("elf:loom.persistence.migrate", false)
export const loomAppendFrameAtom = atomWithStorage<boolean>("elf:loom.appendFrame", false)
export const loomV2ComponentsAtom = atomWithStorage<boolean>("elf:loom.v2Components", false)
export const loomAcmeComponentsAtom = atomWithStorage<boolean>("elf:loom.v2.acmeComponents", false)

export const toggleLoomEnabledAtom = atom(null, (get, set) => {
	set(loomEnabledAtom, !get(loomEnabledAtom))
})
export const toggleLoomDualBindingsAtom = atom(null, (get, set) => {
	set(loomDualBindingsAtom, !get(loomDualBindingsAtom))
})
export const toggleLoomConflictProtectionAtom = atom(null, (get, set) => {
	set(loomConflictProtectionAtom, !get(loomConflictProtectionAtom))
})
export const toggleLoomDagSparklineDemoAtom = atom(null, (get, set) => {
	set(loomDagSparklineDemoAtom, !get(loomDagSparklineDemoAtom))
})
export const toggleLoomComponentToolsAtom = atom(null, (get, set) => {
	set(loomComponentToolsEnabledAtom, !get(loomComponentToolsEnabledAtom))
})
export const toggleLoomPersistenceMigrateAtom = atom(null, (get, set) => {
	set(loomPersistenceMigrateAtom, !get(loomPersistenceMigrateAtom))
})
export const toggleLoomAppendFrameAtom = atom(null, (get, set) => {
	set(loomAppendFrameAtom, !get(loomAppendFrameAtom))
})
export const toggleLoomV2ComponentsAtom = atom(null, (get, set) => {
	set(loomV2ComponentsAtom, !get(loomV2ComponentsAtom))
})
export const toggleLoomAcmeComponentsAtom = atom(null, (get, set) => {
	set(loomAcmeComponentsAtom, !get(loomAcmeComponentsAtom))
})

// NOTE: `notes`, `review`, `files`, `artifacts`, `bridges`, `pulse`, `memory`,
// `editor`, `terminal`, `claude`, `oracle`, `voice`, `browser`, and `crm` have no
// feature flags any more — they are catalog-served plugins; their enable/disable state
// lives in the host plugin lifecycle store. The legacy localStorage values are
// migrated once by `renderer/firefly-plugin-flag-migration.ts`.
// `browserPanelEnabledAtom` deleted — browser is catalog-served (firefly.built-in.surface.browser).
// `crmSurfaceEnabledAtom` deleted — crm is catalog-served (firefly.built-in.surface.crm).
export const fireflySurfaceDefaults = {
	plugins: true,
} as const

export type FireflySurfaceFlagKey = keyof typeof fireflySurfaceDefaults

// `browserPanelEnabledAtom` deleted — browser is catalog-served (firefly.built-in.surface.browser).
// `terminalSurfaceEnabledAtom` deleted — terminal is catalog-served (firefly.built-in.surface.terminal).
// `claudeSurfaceEnabledAtom` deleted — claude is catalog-served (firefly.built-in.surface.claude).
// `voiceSurfaceEnabledAtom` deleted — voice is catalog-served (firefly.built-in.surface.voice).
export const pluginsSurfaceEnabledAtom = atomWithStorage<boolean>("elf:pluginsSurfaceEnabled", true)
// `crmSurfaceEnabledAtom` deleted — crm is catalog-served (firefly.built-in.surface.crm).
// `studioSurfaceEnabledAtom` deleted — studio is catalog-served (firefly.built-in.surface.studio).
// `oracleSurfaceEnabledAtom` deleted — oracle is catalog-served (firefly.built-in.surface.oracle).
// `ch5pmSurfaceEnabledAtom` deleted — ch5pm is catalog-served (firefly.built-in.surface.ch5pm).
// `pdfReviewSurfaceEnabledAtom` deleted — pdf-review is catalog-served (firefly.built-in.surface.pdf-review).

export const fireflySurfaceFlagAtoms: Record<FireflySurfaceFlagKey, typeof pluginsSurfaceEnabledAtom> = {
	plugins: pluginsSurfaceEnabledAtom,
}

export const fireflySurfaceLabels: Record<FireflySurfaceFlagKey, string> = {
	plugins: "Plugins",
}

// `toggleBrowserPanelAtom` deleted — browser is catalog-served; toggle via window.elf.plugins.setEnabled.
// `toggleTerminalSurfaceAtom` deleted — terminal is catalog-served; toggle via window.elf.plugins.setEnabled.

export const togglePluginsSurfaceAtom = atom(null, (get, set) => {
	set(pluginsSurfaceEnabledAtom, !get(pluginsSurfaceEnabledAtom))
})

// `toggleCrmSurfaceAtom` deleted — crm is catalog-served; toggle via window.elf.plugins.setEnabled.

// `toggleStudioSurfaceAtom` deleted — studio is catalog-served; toggle via window.elf.plugins.setEnabled.

// `toggleVoiceSurfaceAtom` deleted — voice is catalog-served; toggle via window.elf.plugins.setEnabled.
// `toggleOracleSurfaceAtom` deleted — oracle is catalog-served; toggle via window.elf.plugins.setEnabled.

// `toggleClaudeSurfaceAtom` deleted — claude is catalog-served; toggle via window.elf.plugins.setEnabled.

// `toggleCh5PmSurfaceAtom` deleted — ch5pm is catalog-served; toggle via window.elf.plugins.setEnabled.

// `togglePdfReviewSurfaceAtom` deleted — pdf-review is catalog-served; toggle via window.elf.plugins.setEnabled.
