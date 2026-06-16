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


// ============================================================
// Workspace Dock (temporary — removed in the migration Cleanup phase)
// ============================================================

/**
 * Whether the experimental Dockview-based workspace shell renders in place of the
 * legacy SplitPane utility/document panes. Default off: the legacy path stays the
 * default until the surface migration completes. This is the ONLY new flag for the
 * migration and is deleted in the Cleanup phase.
 */
export const workspaceDockEnabledAtom = atomWithStorage<boolean>("elf:workspaceDockEnabled", false)

/** Write-only toggle for the command palette. */
export const toggleWorkspaceDockAtom = atom(null, (get, set) => {
	set(workspaceDockEnabledAtom, !get(workspaceDockEnabledAtom))
})


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
// `editor`, `terminal`, and `claude` have no feature flags any more — they are
// catalog-served plugins; their enable/disable state lives in the host plugin
// lifecycle store. The legacy localStorage values are migrated once by
// `renderer/firefly-plugin-flag-migration.ts`.
export const fireflySurfaceDefaults = {
	browserPanelEnabled: true,
	plugins: true,
	crm: true,
	studio: true,
	voice: true,
	ch5pm: false,
	pdfReview: false,
} as const

export type FireflySurfaceFlagKey = keyof typeof fireflySurfaceDefaults

export const browserPanelEnabledAtom = atomWithStorage<boolean>("elf:browserPanelEnabled", true)
// `terminalSurfaceEnabledAtom` deleted — terminal is catalog-served (firefly.built-in.surface.terminal).
// `claudeSurfaceEnabledAtom` deleted — claude is catalog-served (firefly.built-in.surface.claude).
export const pluginsSurfaceEnabledAtom = atomWithStorage<boolean>("elf:pluginsSurfaceEnabled", true)
export const crmSurfaceEnabledAtom = atomWithStorage<boolean>("elf:crmSurfaceEnabled", true)
export const studioSurfaceEnabledAtom = atomWithStorage<boolean>("elf:studioSurfaceEnabled", true)
export const voiceSurfaceEnabledAtom = atomWithStorage<boolean>("elf:voiceSurfaceEnabled", true)
// `oracleSurfaceEnabledAtom` deleted — oracle is catalog-served (firefly.built-in.surface.oracle).
export const ch5pmSurfaceEnabledAtom = atomWithStorage<boolean>("elf:ch5pmSurfaceEnabled", false)
export const pdfReviewSurfaceEnabledAtom = atomWithStorage<boolean>("elf:pdfReviewSurfaceEnabled", false)

export const fireflySurfaceFlagAtoms: Record<FireflySurfaceFlagKey, typeof browserPanelEnabledAtom> = {
	browserPanelEnabled: browserPanelEnabledAtom,
	plugins: pluginsSurfaceEnabledAtom,
	crm: crmSurfaceEnabledAtom,
	studio: studioSurfaceEnabledAtom,
	voice: voiceSurfaceEnabledAtom,
	ch5pm: ch5pmSurfaceEnabledAtom,
	pdfReview: pdfReviewSurfaceEnabledAtom,
}

export const fireflySurfaceLabels: Record<FireflySurfaceFlagKey, string> = {
	browserPanelEnabled: "Browser",
	plugins: "Plugins",
	crm: "Contacts / CRM",
	studio: "Studio / Office",
	voice: "Voice",
	ch5pm: "CH5PM Dashboard",
	pdfReview: "PDF Review",
}

export const toggleBrowserPanelAtom = atom(null, (get, set) => {
	set(browserPanelEnabledAtom, !get(browserPanelEnabledAtom))
})

// `toggleTerminalSurfaceAtom` deleted — terminal is catalog-served; toggle via window.elf.plugins.setEnabled.

export const togglePluginsSurfaceAtom = atom(null, (get, set) => {
	set(pluginsSurfaceEnabledAtom, !get(pluginsSurfaceEnabledAtom))
})

export const toggleCrmSurfaceAtom = atom(null, (get, set) => {
	set(crmSurfaceEnabledAtom, !get(crmSurfaceEnabledAtom))
})

export const toggleStudioSurfaceAtom = atom(null, (get, set) => {
	set(studioSurfaceEnabledAtom, !get(studioSurfaceEnabledAtom))
})

export const toggleVoiceSurfaceAtom = atom(null, (get, set) => {
	set(voiceSurfaceEnabledAtom, !get(voiceSurfaceEnabledAtom))
})

// `toggleOracleSurfaceAtom` deleted — oracle is catalog-served; toggle via window.elf.plugins.setEnabled.

// `toggleClaudeSurfaceAtom` deleted — claude is catalog-served; toggle via window.elf.plugins.setEnabled.

export const toggleCh5PmSurfaceAtom = atom(null, (get, set) => {
	set(ch5pmSurfaceEnabledAtom, !get(ch5pmSurfaceEnabledAtom))
})

export const togglePdfReviewSurfaceAtom = atom(null, (get, set) => {
	set(pdfReviewSurfaceEnabledAtom, !get(pdfReviewSurfaceEnabledAtom))
})
