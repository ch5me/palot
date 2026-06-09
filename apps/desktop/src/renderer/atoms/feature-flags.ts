import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

const FIREFLY_SURFACE_IDS = [
	"review",
	"browser",
	"notes",
	"pulse",
	"artifacts",
	"memory",
	"files",
	"terminal",
	"editor",
	"plugins",
	"bridges",
	"crm",
	"studio",
	"voice",
	"oracle",
	"claude",
	"ch5pm",
	"pdf-review",
] as const

const FIREFLY_SURFACE_DEFAULT_ON = {
	review: true,
	browser: false,
	notes: true,
	pulse: false,
	artifacts: true,
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
	"pdf-review": false,
} as const

const FIREFLY_SURFACE_LABELS = {
	review: "Changes",
	browser: "Browser",
	notes: "Notes",
	pulse: "Pulse",
	artifacts: "Artifacts",
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
	"pdf-review": "PDF Review",
} as const

export const automationsEnabledAtom = atomWithStorage<boolean>("elf:automationsEnabled", true)
export const loomEnabledAtom = atomWithStorage<boolean>("elf:loomEnabled", false)
export const loomDualBindingsAtom = atomWithStorage<boolean>("elf:loomDualBindings", false)
export const loomDagSparklineDemoAtom = atomWithStorage<boolean>("elf:loomDagSparklineDemo", false)
export const loomComponentToolsEnabledAtom = atomWithStorage<boolean>(
	"elf:loomComponentToolsEnabled",
	false,
)

export const toggleAutomationsAtom = atom(null, (get, set) => {
	set(automationsEnabledAtom, !get(automationsEnabledAtom))
})
export const toggleLoomEnabledAtom = atom(null, (get, set) => {
	set(loomEnabledAtom, !get(loomEnabledAtom))
})
export const toggleLoomDualBindingsAtom = atom(null, (get, set) => {
	set(loomDualBindingsAtom, !get(loomDualBindingsAtom))
})
export const toggleLoomDagSparklineDemoAtom = atom(null, (get, set) => {
	set(loomDagSparklineDemoAtom, !get(loomDagSparklineDemoAtom))
})
export const toggleLoomComponentToolsAtom = atom(null, (get, set) => {
	set(loomComponentToolsEnabledAtom, !get(loomComponentToolsEnabledAtom))
})

type SurfaceFlagKey = (typeof FIREFLY_SURFACE_IDS)[number]

export const fireflySurfaceDefaults: Record<SurfaceFlagKey, boolean> = {
	...FIREFLY_SURFACE_DEFAULT_ON,
}

export type FireflySurfaceFlagKey = SurfaceFlagKey

function storageKeyFor(panelId: SurfaceFlagKey): string {
	return `elf:${panelId}SurfaceEnabled`
}

type FlagAtom = ReturnType<typeof atomWithStorage<boolean>>

const surfaceFlagAtomsById: Record<SurfaceFlagKey, FlagAtom> = Object.fromEntries(
	FIREFLY_SURFACE_IDS.map((surfaceId) => [
		surfaceId,
		atomWithStorage<boolean>(storageKeyFor(surfaceId), FIREFLY_SURFACE_DEFAULT_ON[surfaceId]),
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

export const fireflySurfaceFlagAtoms: Record<SurfaceFlagKey, FlagAtom> = surfaceFlagAtomsById

export const fireflySurfaceLabels: Record<SurfaceFlagKey, string> = {
	...FIREFLY_SURFACE_LABELS,
}

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
