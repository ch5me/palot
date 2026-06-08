/**
 * Feature flags -- persisted toggles for experimental features.
 *
 * Each side-panel surface flag is an independent atomWithStorage so user prefs
 * survive reloads. The set of flags, default values, storage keys, and labels
 * are all derived from `FIREFLY_SURFACE_REGISTRY` in `firefly-surface-registry.tsx`.
 * Adding a new surface = adding one row to that registry.
 */

import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import {
	FIREFLY_SURFACE_DEFAULT_ON,
	FIREFLY_SURFACE_LABELS,
	FIREFLY_SURFACE_REGISTRY,
} from "../firefly-surface-registry"

export const automationsEnabledAtom = atomWithStorage<boolean>("elf:automationsEnabled", true)

/** Write-only toggle for the command palette. */
export const toggleAutomationsAtom = atom(null, (get, set) => {
	set(automationsEnabledAtom, !get(automationsEnabledAtom))
})

type SurfaceFlagKey = keyof typeof FIREFLY_SURFACE_DEFAULT_ON

/**
 * Surface-flag defaults. Derived from FIREFLY_SURFACE_REGISTRY; do not hand-edit.
 * Shape preserved (no `as const`) because legacy callers type it as
 * `Record<FireflySurfaceFlagKey, boolean>`.
 */
export const fireflySurfaceDefaults: Record<SurfaceFlagKey, boolean> = Object.fromEntries(
	FIREFLY_SURFACE_REGISTRY.map((surface) => [surface.id, surface.defaultOn as boolean]),
) as Record<SurfaceFlagKey, boolean>

export type FireflySurfaceFlagKey = SurfaceFlagKey

/** Storage key for a given side-panel surface flag. */
function storageKeyFor(panelId: SurfaceFlagKey): string {
	return `elf:${panelId}SurfaceEnabled`
}

type FlagAtom = ReturnType<typeof atomWithStorage<boolean>>

const surfaceFlagAtomsById: Record<SurfaceFlagKey, FlagAtom> = Object.fromEntries(
	FIREFLY_SURFACE_REGISTRY.map((surface) => [
		surface.id,
		atomWithStorage<boolean>(storageKeyFor(surface.id), surface.defaultOn),
	]),
) as Record<SurfaceFlagKey, FlagAtom>

export const reviewSurfaceEnabledAtom = surfaceFlagAtomsById.review
export const browserPanelEnabledAtom = surfaceFlagAtomsById.browser
export const notesSurfaceEnabledAtom = surfaceFlagAtomsById.notes
export const pulseSurfaceEnabledAtom = surfaceFlagAtomsById.pulse
export const memorySurfaceEnabledAtom = surfaceFlagAtomsById.memory
export const filesSurfaceEnabledAtom = surfaceFlagAtomsById.files
export const terminalSurfaceEnabledAtom = surfaceFlagAtomsById.terminal
export const editorSurfaceEnabledAtom = surfaceFlagAtomsById.editor
export const pluginsSurfaceEnabledAtom = surfaceFlagAtomsById.plugins
export const bridgesSurfaceEnabledAtom = surfaceFlagAtomsById.bridges
export const crmSurfaceEnabledAtom = surfaceFlagAtomsById.crm
export const studioSurfaceEnabledAtom = surfaceFlagAtomsById.studio
export const voiceSurfaceEnabledAtom = surfaceFlagAtomsById.voice
export const oracleSurfaceEnabledAtom = surfaceFlagAtomsById.oracle
export const claudeSurfaceEnabledAtom = surfaceFlagAtomsById.claude
export const ch5pmSurfaceEnabledAtom = surfaceFlagAtomsById.ch5pm
export const artifactsSurfaceEnabledAtom = surfaceFlagAtomsById.artifacts
export const pdfReviewSurfaceEnabledAtom = surfaceFlagAtomsById["pdf-review"]

/** Lookup table: every surface flag atom, by id. */
export const fireflySurfaceFlagAtoms: Record<SurfaceFlagKey, FlagAtom> = surfaceFlagAtomsById

/** Display labels for each surface, derived from the registry titles. */
export const fireflySurfaceLabels: Record<SurfaceFlagKey, string> = FIREFLY_SURFACE_LABELS

/**
 * Build a write-only toggle atom for any side-panel surface. The exported
 * `toggle*SurfaceAtom` atoms below are derived from this factory.
 */
function makeToggleSurfaceAtom(panelId: SurfaceFlagKey) {
	return atom(null, (get, set) => {
		set(surfaceFlagAtomsById[panelId], !get(surfaceFlagAtomsById[panelId]))
	})
}

export const toggleReviewSurfaceAtom = makeToggleSurfaceAtom("review")
export const toggleBrowserPanelAtom = makeToggleSurfaceAtom("browser")
export const toggleNotesSurfaceAtom = makeToggleSurfaceAtom("notes")
export const togglePulseSurfaceAtom = makeToggleSurfaceAtom("pulse")
export const toggleMemorySurfaceAtom = makeToggleSurfaceAtom("memory")
export const toggleFilesSurfaceAtom = makeToggleSurfaceAtom("files")
export const toggleTerminalSurfaceAtom = makeToggleSurfaceAtom("terminal")
export const toggleEditorSurfaceAtom = makeToggleSurfaceAtom("editor")
export const togglePluginsSurfaceAtom = makeToggleSurfaceAtom("plugins")
export const toggleBridgesSurfaceAtom = makeToggleSurfaceAtom("bridges")
export const toggleCrmSurfaceAtom = makeToggleSurfaceAtom("crm")
export const toggleStudioSurfaceAtom = makeToggleSurfaceAtom("studio")
export const toggleVoiceSurfaceAtom = makeToggleSurfaceAtom("voice")
export const toggleOracleSurfaceAtom = makeToggleSurfaceAtom("oracle")
export const toggleClaudeSurfaceAtom = makeToggleSurfaceAtom("claude")
export const toggleCh5PmSurfaceAtom = makeToggleSurfaceAtom("ch5pm")
export const toggleArtifactsSurfaceAtom = makeToggleSurfaceAtom("artifacts")
export const togglePdfReviewSurfaceAtom = makeToggleSurfaceAtom("pdf-review")
