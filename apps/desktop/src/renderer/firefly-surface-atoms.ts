import type { PrimitiveAtom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type { FireflySurfaceId } from "./firefly-surface-registry"

export type SurfaceFlagKey = FireflySurfaceId

function storageKeyFor(panelId: SurfaceFlagKey): string {
	return `elf:${panelId}SurfaceEnabled`
}

function defaultOnFor(panelId: SurfaceFlagKey): boolean {
	switch (panelId) {
		case "browser":
		case "pulse":
		case "memory":
		case "ch5pm":
		case "pdf-review":
			return false
		default:
			return true
	}
}

export type SurfaceFlagAtom = PrimitiveAtom<boolean>

const surfaceFlagAtomsById = {
	review: atomWithStorage<boolean>(storageKeyFor("review"), defaultOnFor("review")),
	browser: atomWithStorage<boolean>(storageKeyFor("browser"), defaultOnFor("browser")),
	notes: atomWithStorage<boolean>(storageKeyFor("notes"), defaultOnFor("notes")),
	pulse: atomWithStorage<boolean>(storageKeyFor("pulse"), defaultOnFor("pulse")),
	artifacts: atomWithStorage<boolean>(storageKeyFor("artifacts"), defaultOnFor("artifacts")),
	memory: atomWithStorage<boolean>(storageKeyFor("memory"), defaultOnFor("memory")),
	files: atomWithStorage<boolean>(storageKeyFor("files"), defaultOnFor("files")),
	terminal: atomWithStorage<boolean>(storageKeyFor("terminal"), defaultOnFor("terminal")),
	editor: atomWithStorage<boolean>(storageKeyFor("editor"), defaultOnFor("editor")),
	plugins: atomWithStorage<boolean>(storageKeyFor("plugins"), defaultOnFor("plugins")),
	bridges: atomWithStorage<boolean>(storageKeyFor("bridges"), defaultOnFor("bridges")),
	crm: atomWithStorage<boolean>(storageKeyFor("crm"), defaultOnFor("crm")),
	studio: atomWithStorage<boolean>(storageKeyFor("studio"), defaultOnFor("studio")),
	voice: atomWithStorage<boolean>(storageKeyFor("voice"), defaultOnFor("voice")),
	oracle: atomWithStorage<boolean>(storageKeyFor("oracle"), defaultOnFor("oracle")),
	claude: atomWithStorage<boolean>(storageKeyFor("claude"), defaultOnFor("claude")),
	ch5pm: atomWithStorage<boolean>(storageKeyFor("ch5pm"), defaultOnFor("ch5pm")),
	"pdf-review": atomWithStorage<boolean>(
		storageKeyFor("pdf-review"),
		defaultOnFor("pdf-review"),
	),
} as const satisfies Record<SurfaceFlagKey, SurfaceFlagAtom>

export const fireflySurfaceFlagAtoms: Record<SurfaceFlagKey, SurfaceFlagAtom> = surfaceFlagAtomsById

// Exhaustiveness: force a compile error if FIREFLY_SURFACE_IDS gains an entry without an atom.
type _AssertExhaustiveSurfaceFlagAtoms =
	Exclude<FireflySurfaceId, keyof typeof surfaceFlagAtomsById> extends never
		? true
		: "FIREFLY_SURFACE_IDS drift: every id needs a surfaceFlagAtomsById entry"

const _exhaustiveness: _AssertExhaustiveSurfaceFlagAtoms = true
void _exhaustiveness
