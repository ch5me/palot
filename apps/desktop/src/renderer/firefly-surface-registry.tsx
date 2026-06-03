import { ActivityIcon, BookTextIcon, DatabaseIcon, FileDiffIcon, GlobeIcon, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import {
	browserPanelEnabledAtom,
	memorySurfaceEnabledAtom,
	notesSurfaceEnabledAtom,
	pulseSurfaceEnabledAtom,
	reviewSurfaceEnabledAtom,
} from "./atoms/feature-flags"
import type { SidePanelTabId } from "./atoms/ui"
import { ReviewPanel } from "./components/review/review-panel"
import { BrowserPanel } from "./components/side-panel/browser-panel"
import { MemoryPanel } from "./components/side-panel/memory-panel"
import { NotesPanel } from "./components/side-panel/notes-panel"
import { PulsePanel } from "./components/side-panel/pulse-panel"
import type { Agent } from "./lib/types"

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
	id: SidePanelTabId
	title: string
	icon: LucideIcon
	formFactor: FireflySurfaceFormFactor
	enabledFlag: {
		key: string
		atom?: typeof browserPanelEnabledAtom
	}
	defaultOn: boolean
	availability: (ctx: FireflySurfaceContext) => FireflySurfaceAvailability
	commandIds: string[]
	persistenceKey: string
	telemetryNamespace: string
	spawn: (ctx: FireflySurfaceContext) => ReactNode
}

export interface FireflySidePanelTab {
	id: SidePanelTabId
	label: string
	icon: ReactNode
	title: string
	availability: FireflySurfaceAvailability
	commandIds: string[]
	persistenceKey: string
	telemetryNamespace: string
	render: () => ReactNode
}

export const FIREFLY_SURFACE_REGISTRY: FireflySurfaceDef[] = [
	{
		id: "review",
		title: "Changes",
		icon: FileDiffIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "review",
			atom: reviewSurfaceEnabledAtom,
		},
		defaultOn: true,
		availability: (ctx) => {
			if (!ctx.flags.review) {
				return { available: false, reason: "Changes surface is disabled in feature flags" }
			}
			return ctx.diffStats.fileCount > 0
				? { available: true }
				: { available: false, reason: "No file changes in this session yet" }
		},
		commandIds: ["surface.review.open"],
		persistenceKey: "side-panel.review",
		telemetryNamespace: "firefly.surface.review",
		spawn: (ctx) => <ReviewPanel sessionId={ctx.agent.sessionId} directory={ctx.agent.directory} />,
	},
	{
		id: "browser",
		title: "Browser",
		icon: GlobeIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "browserPanelEnabled",
			atom: browserPanelEnabledAtom,
		},
		defaultOn: false,
		availability: (ctx) =>
			ctx.flags.browserPanelEnabled
				? { available: true }
				: { available: false, reason: "Browser surface is disabled in feature flags" },
		commandIds: ["surface.browser.open", "surface.browser.toggle"],
		persistenceKey: "side-panel.browser",
		telemetryNamespace: "firefly.surface.browser",
		spawn: (ctx) => <BrowserPanel agent={ctx.agent} />,
	},
	{
		id: "notes",
		title: "Notes",
		icon: BookTextIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "notes",
			atom: notesSurfaceEnabledAtom,
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.notes
				? { available: true }
				: { available: false, reason: "Notes surface is disabled in feature flags" },
		commandIds: ["surface.notes.open", "surface.notes.toggle"],
		persistenceKey: "side-panel.notes",
		telemetryNamespace: "firefly.surface.notes",
		spawn: (ctx) => <NotesPanel agent={ctx.agent} />,
	},
	{
		id: "pulse",
		title: "Pulse",
		icon: ActivityIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "pulse",
			atom: pulseSurfaceEnabledAtom,
		},
		defaultOn: false,
		availability: (ctx) =>
			ctx.flags.pulse
				? { available: true }
				: { available: false, reason: "Pulse surface is disabled in feature flags" },
		commandIds: ["surface.pulse.open", "surface.pulse.toggle"],
		persistenceKey: "side-panel.pulse",
		telemetryNamespace: "firefly.surface.pulse",
		spawn: (ctx) => <PulsePanel agent={ctx.agent} />,
	},
	{
		id: "memory",
		title: "Memory",
		icon: DatabaseIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "memory",
			atom: memorySurfaceEnabledAtom,
		},
		defaultOn: false,
		availability: (ctx) =>
			ctx.flags.memory
				? { available: true }
				: { available: false, reason: "Memory surface is disabled in feature flags" },
		commandIds: ["surface.memory.open", "surface.memory.toggle"],
		persistenceKey: "side-panel.memory",
		telemetryNamespace: "firefly.surface.memory",
		spawn: (ctx) => <MemoryPanel agent={ctx.agent} />,
	},
]

export const FIREFLY_SURFACE_REGISTRY_BY_ID = Object.fromEntries(
	FIREFLY_SURFACE_REGISTRY.map((surface) => [surface.id, surface]),
) as Record<SidePanelTabId, FireflySurfaceDef>

export function getFireflySurfaceTabs(ctx: FireflySurfaceContext): FireflySidePanelTab[] {
	return FIREFLY_SURFACE_REGISTRY.filter((surface) => surface.formFactor === "side-panel-tab").map(
		(surface) => {
			const availability = surface.availability(ctx)
			const Icon = surface.icon
			return {
				id: surface.id,
				label: surface.title,
				icon: <Icon className="size-4" />,
				title: surface.title,
				availability,
				commandIds: surface.commandIds,
				persistenceKey: surface.persistenceKey,
				telemetryNamespace: surface.telemetryNamespace,
				render: () => surface.spawn(ctx),
			}
		},
	)
}
