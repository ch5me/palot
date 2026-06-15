/**
 * Canonical 18 side-panel surface ids — renderer-free single source of truth.
 *
 * This module MUST stay free of renderer imports: it is consumed by headless
 * runtimes (the palot-bridge OpenCode plugin via `palot-bridge-schemas.ts`)
 * where pulling in React/monaco fails at import time. The renderer registry
 * (`src/renderer/firefly-surface-registry.tsx`) re-exports these ids and the
 * JSON sidecar (`src/renderer/firefly-surface-registry-ids.json`) mirrors them
 * for runtimes that can only read JSON; `surface-mirror-lists.test.ts` guards
 * the mirror.
 */
export const FIREFLY_SURFACE_IDS = [
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

export type FireflySurfaceId = (typeof FIREFLY_SURFACE_IDS)[number]

export type FireflySurfaceLane = "utility" | "document"

export const FIREFLY_SURFACE_LANE_BY_ID = {
	review: "utility",
	browser: "utility",
	notes: "utility",
	pulse: "utility",
	artifacts: "utility",
	memory: "utility",
	files: "utility",
	terminal: "utility",
	editor: "utility",
	plugins: "utility",
	bridges: "utility",
	crm: "utility",
	studio: "document",
	voice: "utility",
	oracle: "utility",
	claude: "utility",
	ch5pm: "utility",
	"pdf-review": "document",
} as const satisfies Record<FireflySurfaceId, FireflySurfaceLane>

export function isDocumentSurfaceId(surfaceId: FireflySurfaceId): boolean {
	return FIREFLY_SURFACE_LANE_BY_ID[surfaceId] === "document"
}

export const DOCUMENT_SURFACE_IDS = FIREFLY_SURFACE_IDS.filter(
	(id): id is Extract<FireflySurfaceId, "studio" | "pdf-review"> => isDocumentSurfaceId(id),
)
