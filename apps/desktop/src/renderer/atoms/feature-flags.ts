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

// NOTE: `notes`, `review`, and `files` have no feature flags any more — they are
// catalog-served plugins; their enable/disable state lives in the host
// plugin lifecycle store. The legacy localStorage values are migrated
// once by `renderer/firefly-plugin-flag-migration.ts`.
export const fireflySurfaceDefaults = {
	browserPanelEnabled: true,
	pulse: false,
	memory: false,
	terminal: true,
	editor: true,
	plugins: true,
	bridges: true,
	crm: true,
	studio: true,
	voice: true,
	oracle: true,
	claude: true,
	ch5pm: false,
	artifacts: true,
	pdfReview: false,
} as const

export type FireflySurfaceFlagKey = keyof typeof fireflySurfaceDefaults

export const browserPanelEnabledAtom = atomWithStorage<boolean>("elf:browserPanelEnabled", true)
export const pulseSurfaceEnabledAtom = atomWithStorage<boolean>("elf:pulseSurfaceEnabled", false)
export const memorySurfaceEnabledAtom = atomWithStorage<boolean>("elf:memorySurfaceEnabled", false)
export const terminalSurfaceEnabledAtom = atomWithStorage<boolean>("elf:terminalSurfaceEnabled", true)
export const editorSurfaceEnabledAtom = atomWithStorage<boolean>("elf:editorSurfaceEnabled", true)
export const pluginsSurfaceEnabledAtom = atomWithStorage<boolean>("elf:pluginsSurfaceEnabled", true)
export const bridgesSurfaceEnabledAtom = atomWithStorage<boolean>("elf:bridgesSurfaceEnabled", true)
export const crmSurfaceEnabledAtom = atomWithStorage<boolean>("elf:crmSurfaceEnabled", true)
export const studioSurfaceEnabledAtom = atomWithStorage<boolean>("elf:studioSurfaceEnabled", true)
export const voiceSurfaceEnabledAtom = atomWithStorage<boolean>("elf:voiceSurfaceEnabled", true)
export const oracleSurfaceEnabledAtom = atomWithStorage<boolean>("elf:oracleSurfaceEnabled", true)
export const claudeSurfaceEnabledAtom = atomWithStorage<boolean>("elf:claudeSurfaceEnabled", true)
export const ch5pmSurfaceEnabledAtom = atomWithStorage<boolean>("elf:ch5pmSurfaceEnabled", false)
export const artifactsSurfaceEnabledAtom = atomWithStorage<boolean>("elf:artifactsSurfaceEnabled", true)
export const pdfReviewSurfaceEnabledAtom = atomWithStorage<boolean>("elf:pdfReviewSurfaceEnabled", false)

export const fireflySurfaceFlagAtoms: Record<FireflySurfaceFlagKey, typeof browserPanelEnabledAtom> = {
	browserPanelEnabled: browserPanelEnabledAtom,
	pulse: pulseSurfaceEnabledAtom,
	memory: memorySurfaceEnabledAtom,
	terminal: terminalSurfaceEnabledAtom,
	editor: editorSurfaceEnabledAtom,
	plugins: pluginsSurfaceEnabledAtom,
	bridges: bridgesSurfaceEnabledAtom,
	crm: crmSurfaceEnabledAtom,
	studio: studioSurfaceEnabledAtom,
	voice: voiceSurfaceEnabledAtom,
	oracle: oracleSurfaceEnabledAtom,
	claude: claudeSurfaceEnabledAtom,
	ch5pm: ch5pmSurfaceEnabledAtom,
	artifacts: artifactsSurfaceEnabledAtom,
	pdfReview: pdfReviewSurfaceEnabledAtom,
}

export const fireflySurfaceLabels: Record<FireflySurfaceFlagKey, string> = {
	browserPanelEnabled: "Browser",
	pulse: "Pulse",
	memory: "Memory",
	terminal: "Terminal",
	editor: "Editor",
	plugins: "Plugins",
	bridges: "Bridges",
	crm: "Contacts / CRM",
	studio: "Studio / Office",
	voice: "Voice",
	oracle: "Oracle Roster",
	claude: "Claude Code",
	ch5pm: "CH5PM Dashboard",
	artifacts: "Artifacts",
	pdfReview: "PDF Review",
}

export const toggleBrowserPanelAtom = atom(null, (get, set) => {
	set(browserPanelEnabledAtom, !get(browserPanelEnabledAtom))
})

export const togglePulseSurfaceAtom = atom(null, (get, set) => {
	set(pulseSurfaceEnabledAtom, !get(pulseSurfaceEnabledAtom))
})

export const toggleMemorySurfaceAtom = atom(null, (get, set) => {
	set(memorySurfaceEnabledAtom, !get(memorySurfaceEnabledAtom))
})

export const toggleTerminalSurfaceAtom = atom(null, (get, set) => {
	set(terminalSurfaceEnabledAtom, !get(terminalSurfaceEnabledAtom))
})

export const toggleEditorSurfaceAtom = atom(null, (get, set) => {
	set(editorSurfaceEnabledAtom, !get(editorSurfaceEnabledAtom))
})

export const togglePluginsSurfaceAtom = atom(null, (get, set) => {
	set(pluginsSurfaceEnabledAtom, !get(pluginsSurfaceEnabledAtom))
})

export const toggleBridgesSurfaceAtom = atom(null, (get, set) => {
	set(bridgesSurfaceEnabledAtom, !get(bridgesSurfaceEnabledAtom))
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

export const toggleOracleSurfaceAtom = atom(null, (get, set) => {
	set(oracleSurfaceEnabledAtom, !get(oracleSurfaceEnabledAtom))
})

export const toggleClaudeSurfaceAtom = atom(null, (get, set) => {
	set(claudeSurfaceEnabledAtom, !get(claudeSurfaceEnabledAtom))
})

export const toggleCh5PmSurfaceAtom = atom(null, (get, set) => {
	set(ch5pmSurfaceEnabledAtom, !get(ch5pmSurfaceEnabledAtom))
})

export const toggleArtifactsSurfaceAtom = atom(null, (get, set) => {
	set(artifactsSurfaceEnabledAtom, !get(artifactsSurfaceEnabledAtom))
})

export const togglePdfReviewSurfaceAtom = atom(null, (get, set) => {
	set(pdfReviewSurfaceEnabledAtom, !get(pdfReviewSurfaceEnabledAtom))
})
