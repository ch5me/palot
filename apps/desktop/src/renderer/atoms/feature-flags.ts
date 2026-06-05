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

export const fireflySurfaceDefaults = {
	review: true,
	browserPanelEnabled: true,
	notes: true,
	pulse: false,
	memory: false,
	files: true,
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

export const reviewSurfaceEnabledAtom = atomWithStorage<boolean>("elf:reviewSurfaceEnabled", true)
export const browserPanelEnabledAtom = atomWithStorage<boolean>("elf:browserPanelEnabled", true)
export const notesSurfaceEnabledAtom = atomWithStorage<boolean>("elf:notesSurfaceEnabled", true)
export const pulseSurfaceEnabledAtom = atomWithStorage<boolean>("elf:pulseSurfaceEnabled", false)
export const memorySurfaceEnabledAtom = atomWithStorage<boolean>("elf:memorySurfaceEnabled", false)
export const filesSurfaceEnabledAtom = atomWithStorage<boolean>("elf:filesSurfaceEnabled", true)
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

export const fireflySurfaceFlagAtoms: Record<FireflySurfaceFlagKey, typeof reviewSurfaceEnabledAtom> = {
	review: reviewSurfaceEnabledAtom,
	browserPanelEnabled: browserPanelEnabledAtom,
	notes: notesSurfaceEnabledAtom,
	pulse: pulseSurfaceEnabledAtom,
	memory: memorySurfaceEnabledAtom,
	files: filesSurfaceEnabledAtom,
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
	review: "Changes",
	browserPanelEnabled: "Browser",
	notes: "Notes",
	pulse: "Pulse",
	memory: "Memory",
	files: "Files",
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

export const toggleFilesSurfaceAtom = atom(null, (get, set) => {
	set(filesSurfaceEnabledAtom, !get(filesSurfaceEnabledAtom))
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
