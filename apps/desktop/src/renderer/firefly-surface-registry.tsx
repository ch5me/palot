import { FileTextIcon, GlobeIcon, MicIcon, MonitorPlayIcon, PlugIcon, UsersIcon, type LucideIcon } from "lucide-react"

import type { ReactNode } from "react"

import { Ch5PmDashboardPanel } from "./ch5pm-dashboard/panel"
import { BrowserPanel } from "./components/side-panel/browser-panel"
// `claude` is served from the plugin catalog (firefly.built-in.surface.claude,
// apps/desktop/plugins/claude) — do not re-add a row or import here.
import { CrmPanel } from "./components/side-panel/crm-panel"
import { PdfReviewPanel } from "./components/side-panel/pdf-review-panel"
import { StudioPanel } from "./components/side-panel/studio-panel"
import { VoicePanel } from "./components/side-panel/voice-panel"
import { V2PluginsPanel } from "./components/side-panel/v2-plugins-panel"
// `terminal` is served from the plugin catalog (firefly.built-in.surface.terminal,
// apps/desktop/plugins/terminal) — do not re-add a row or import here.
import type { Agent, FireflySurfaceTarget } from "./lib/types"
import type { FireflySurfaceLane } from "../shared/firefly-surface-ids"

export type FireflySurfaceFormFactor = "side-panel-tab" | "main-pane"

export type FireflySurfaceAvailability =
	| { available: true }
	| { available: false; reason: string }

export interface FireflySurfaceContext {
	agent: Agent
	diffStats: {
		additions: number
		deletions: number
		fileCount: number
	}
	flags: Record<string, boolean>
	chatTurnCount?: number
}

export interface FireflySurfaceDef {
	id: FireflySurfaceId
	manifestId: string
	title: string
	icon: LucideIcon
	formFactor: FireflySurfaceFormFactor
	lane: FireflySurfaceLane
	enabledFlag: {
		key: string
	}
	defaultOn: boolean
	availability: (ctx: FireflySurfaceContext) => FireflySurfaceAvailability
	commandIds: string[]
	persistenceKey: string
	telemetryNamespace: string
	target: FireflySurfaceTarget
	spawn: (ctx: FireflySurfaceContext) => ReactNode
}

export interface FireflySidePanelTab {
	id: FireflySurfaceId
	lane: FireflySurfaceLane
	label: string
	icon: ReactNode
	title: string
	availability: FireflySurfaceAvailability
	commandIds: string[]
	persistenceKey: string
	telemetryNamespace: string
	target: FireflySurfaceTarget
	render: () => ReactNode
}
// `review` is served from the plugin catalog (firefly.built-in.surface.review,
// apps/desktop/plugins/review) — do not re-add a row here.
export const FIREFLY_SURFACE_REGISTRY: FireflySurfaceDef[] = [
	{
		id: "browser",
		manifestId: "firefly.built-in.side-panel.browser",
		title: "Browser",
		icon: GlobeIcon,
		formFactor: "side-panel-tab",
		lane: "utility",
		enabledFlag: {
			key: "browserPanelEnabled",
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.browserPanelEnabled
				? { available: true }
				: { available: false, reason: "Browser surface is disabled in feature flags" },
		commandIds: ["surface.browser.open", "surface.browser.toggle"],
		persistenceKey: "side-panel.browser",
		telemetryNamespace: "firefly.surface.browser",
		target: { kind: "side-panel", tab: "browser" },
		spawn: (ctx) => <BrowserPanel agent={ctx.agent} />,
	},
	// `notes` is served from the plugin catalog (firefly.built-in.surface.notes,
	// apps/desktop/plugins/notes) — first migrated surface. Do not re-add a row.
	// `pulse` is served from the plugin catalog (firefly.built-in.surface.pulse,
	// apps/desktop/plugins/pulse) — do not re-add a row here.
	// `artifacts` is served from the plugin catalog (firefly.built-in.surface.artifacts,
	// apps/desktop/plugins/artifacts) — do not re-add a row here.
	// `memory` is served from the plugin catalog (firefly.built-in.surface.memory,
	// apps/desktop/plugins/memory) — do not re-add a row here.
	// `files` is served from the plugin catalog (firefly.built-in.surface.files,
	// apps/desktop/plugins/files) — do not re-add a row here.
	// `terminal` is served from the plugin catalog (firefly.built-in.surface.terminal,
	// apps/desktop/plugins/terminal) — do not re-add a row here.
	// `editor` is served from the plugin catalog (firefly.built-in.surface.editor,
	// apps/desktop/plugins/editor) — do not re-add a row here.
	{
		id: "plugins",
		manifestId: "firefly.built-in.side-panel.plugins",
		title: "Plugins",
		icon: PlugIcon,
		formFactor: "side-panel-tab",
		lane: "utility",
		enabledFlag: {
			key: "plugins",
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.plugins
				? { available: true }
				: { available: false, reason: "Plugins surface is disabled in feature flags" },
		commandIds: ["surface.plugins.open", "surface.plugins.toggle"],
		persistenceKey: "side-panel.plugins",
		telemetryNamespace: "firefly.surface.plugins",
		target: { kind: "side-panel", tab: "plugins" },
		spawn: (ctx) => <V2PluginsPanel agent={ctx.agent} />,
	},
	// `bridges` is served from the plugin catalog (firefly.built-in.surface.bridges,
	// apps/desktop/plugins/bridges) — do not re-add a row here.
	{
		id: "crm",
		manifestId: "firefly.built-in.side-panel.crm",
		title: "Contacts / CRM",
		icon: UsersIcon,
		formFactor: "side-panel-tab",
		lane: "utility",
		enabledFlag: {
			key: "crm",
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.crm
				? { available: true }
				: { available: false, reason: "Contacts / CRM surface is disabled in feature flags" },
		commandIds: ["surface.crm.open", "surface.crm.toggle"],
		persistenceKey: "side-panel.crm",
		telemetryNamespace: "firefly.surface.crm",
		target: { kind: "side-panel", tab: "crm" },
		spawn: (ctx) => <CrmPanel agent={ctx.agent} />,
	},
	{
		id: "studio",
		manifestId: "firefly.built-in.side-panel.studio",
		title: "Studio / Office",
		icon: MonitorPlayIcon,
		formFactor: "side-panel-tab",
		lane: "document",
		enabledFlag: {
			key: "studio",
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.studio
				? { available: true }
				: { available: false, reason: "Studio surface is disabled in feature flags" },
		commandIds: ["surface.studio.open", "surface.studio.toggle"],
		persistenceKey: "side-panel.studio",
		telemetryNamespace: "firefly.surface.studio",
		target: { kind: "side-panel", tab: "studio" },
		spawn: (ctx) => <StudioPanel agent={ctx.agent} />,
	},
	{
		id: "voice",
		manifestId: "firefly.built-in.side-panel.voice",
		title: "Voice",
		icon: MicIcon,
		formFactor: "side-panel-tab",
		lane: "utility",
		enabledFlag: {
			key: "voice",
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.voice
				? { available: true }
				: { available: false, reason: "Voice surface is disabled in feature flags" },
		commandIds: ["surface.voice.open", "surface.voice.toggle"],
		persistenceKey: "side-panel.voice",
		telemetryNamespace: "firefly.surface.voice",
		target: { kind: "side-panel", tab: "voice" },
		spawn: (ctx) => <VoicePanel agent={ctx.agent} />,
	},
	// oracle — served from catalog (firefly.built-in.surface.oracle) — do not re-add
	{
		id: "ch5pm",
		manifestId: "firefly.built-in.side-panel.ch5pm",
		title: "CH5PM Dashboard",
		icon: MonitorPlayIcon,
		formFactor: "side-panel-tab",
		lane: "utility",
		enabledFlag: {
			key: "ch5pm",
		},
		defaultOn: false,
		availability: (ctx) =>
			ctx.flags.ch5pm
				? { available: true }
				: { available: false, reason: "CH5PM dashboard surface is disabled in feature flags" },
		commandIds: ["surface.ch5pm.open", "surface.ch5pm.toggle"],
		persistenceKey: "side-panel.ch5pm",
		telemetryNamespace: "firefly.surface.ch5pm",
		target: { kind: "side-panel", tab: "ch5pm" },
		spawn: () => <Ch5PmDashboardPanel />,
	},
	{
		id: "pdf-review",
		manifestId: "firefly.built-in.side-panel.pdf-review",
		title: "PDF Review",
		icon: FileTextIcon,
		formFactor: "side-panel-tab",
		lane: "document",
		enabledFlag: {
			key: "pdfReview",
		},
		defaultOn: false,
		availability: (ctx) =>
			ctx.flags.pdfReview
				? { available: true }
				: { available: false, reason: "PDF review surface is disabled in feature flags" },
		commandIds: ["surface.pdfReview.open", "surface.pdfReview.toggle"],
		persistenceKey: "side-panel.pdf-review",
		telemetryNamespace: "firefly.surface.pdf-review",
		target: { kind: "side-panel", tab: "pdf-review" },
		spawn: (ctx) => <PdfReviewPanel agent={ctx.agent} />,
	},
]

/**
 * Canonical 18 side-panel surface ids. Used to derive SidePanelTabId,
 * palotSidePanelTabSchema, and the JSON sidecar the runtime plugin reads
 * (`firefly-surface-registry-ids.json`).
 *
 * The tuple itself lives in the renderer-free module
 * `src/shared/firefly-surface-ids.ts` so headless runtimes (the palot-bridge
 * OpenCode plugin via `palot-bridge-schemas.ts`) can import it without
 * dragging in React/monaco; it is re-exported here for renderer consumers.
 */
export {
	FIREFLY_SURFACE_IDS,
	type FireflySurfaceId,
	type FireflySurfaceLane,
} from "../shared/firefly-surface-ids"
import { FIREFLY_SURFACE_IDS, type FireflySurfaceId } from "../shared/firefly-surface-ids"

/**
 * Surfaces that are valid side-panel tabs but have NO registry row here:
 * they are served from the plugin catalog (host plugin lifecycle owns
 * their enable/disable). First migrated surface: notes.
 */
export const CATALOG_SERVED_SURFACE_IDS: readonly FireflySurfaceId[] = ["notes", "review", "files", "artifacts", "bridges", "pulse", "memory", "editor", "terminal", "claude", "oracle"]

export const FIREFLY_SURFACE_DEFAULT_ON = Object.fromEntries(
	FIREFLY_SURFACE_REGISTRY.map((surface) => [surface.id, surface.defaultOn]),
) as Readonly<Record<FireflySurfaceId, boolean>>

export const FIREFLY_SURFACE_LABELS = Object.fromEntries(
	FIREFLY_SURFACE_REGISTRY.map((surface) => [surface.id, surface.title]),
) as Readonly<Record<FireflySurfaceId, string>>

export const FIREFLY_SURFACE_REGISTRY_BY_ID = Object.fromEntries(
	FIREFLY_SURFACE_REGISTRY.map((surface) => [surface.id, surface]),
) as Record<FireflySurfaceId, FireflySurfaceDef>

/**
 * Runtime assertion: every entry of `FIREFLY_SURFACE_REGISTRY` has a unique id
 * and the ids match `FIREFLY_SURFACE_IDS`. Drift here is a programming error
 * and would break the single-source-of-truth invariant.
 */
if (FIREFLY_SURFACE_IDS.length !== FIREFLY_SURFACE_REGISTRY.length + CATALOG_SERVED_SURFACE_IDS.length) {
	throw new Error(
		`firefly-surface-registry drift: FIREFLY_SURFACE_IDS (${FIREFLY_SURFACE_IDS.length}) != registry rows (${FIREFLY_SURFACE_REGISTRY.length}) + catalog-served (${CATALOG_SERVED_SURFACE_IDS.length})`,
	)
}
const _registryIds = new Set<string>(FIREFLY_SURFACE_REGISTRY.map((surface) => surface.id))
for (const id of FIREFLY_SURFACE_IDS) {
	if (!_registryIds.has(id) && !CATALOG_SERVED_SURFACE_IDS.includes(id)) {
		throw new Error(`firefly-surface-registry drift: id "${id}" missing from registry`)
	}
}

export function getFireflySurfaceTabs(ctx: FireflySurfaceContext): FireflySidePanelTab[] {
	return FIREFLY_SURFACE_REGISTRY.filter((surface) => surface.formFactor === "side-panel-tab").map(
		(surface) => {
			const availability = surface.availability(ctx)
			const Icon = surface.icon
			return {
				id: surface.id,
				lane: surface.lane,
				label: surface.title,
				icon: <Icon className="size-4" />,
				title: surface.title,
				availability,
				commandIds: surface.commandIds,
				persistenceKey: surface.persistenceKey,
				telemetryNamespace: surface.telemetryNamespace,
				target: surface.target,
				render: () => surface.spawn(ctx),
			}
		},
	)
}
