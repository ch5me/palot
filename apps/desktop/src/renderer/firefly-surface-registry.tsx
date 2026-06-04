import { ActivityIcon, BookTextIcon, DatabaseIcon, FileDiffIcon, FilesIcon, GlobeIcon, MicIcon, MonitorPlayIcon, PlugIcon, RectangleEllipsisIcon, Share2Icon, SquarePenIcon, TerminalSquareIcon, UsersIcon, WandSparklesIcon, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import {
	browserPanelEnabledAtom,
	bridgesSurfaceEnabledAtom,
	claudeSurfaceEnabledAtom,
	crmSurfaceEnabledAtom,
	editorSurfaceEnabledAtom,
	filesSurfaceEnabledAtom,
	memorySurfaceEnabledAtom,
	notesSurfaceEnabledAtom,
	oracleSurfaceEnabledAtom,
	pluginsSurfaceEnabledAtom,
	pulseSurfaceEnabledAtom,
	reviewSurfaceEnabledAtom,
	studioSurfaceEnabledAtom,
	terminalSurfaceEnabledAtom,
	voiceSurfaceEnabledAtom,
} from "./atoms/feature-flags"

import type { SidePanelTabId } from "./atoms/ui"
import { ReviewPanel } from "./components/review/review-panel"
import { BrowserPanel } from "./components/side-panel/browser-panel"
import { BridgesPanel } from "./components/side-panel/bridges-panel"
import { ClaudePanel } from "./components/side-panel/claude-panel"
import { CrmPanel } from "./components/side-panel/crm-panel"
import { MemoryPanel } from "./components/side-panel/memory-panel"
import { OraclePanel } from "./components/side-panel/oracle-panel"
import { StudioPanel } from "./components/side-panel/studio-panel"
import { VoicePanel } from "./components/side-panel/voice-panel"
import { NotesPanel } from "./components/side-panel/notes-panel"
import { EditorPanel } from "./components/side-panel/editor-panel"
import { FilesPanel } from "./components/side-panel/files-panel"
import { PluginsPanel } from "./components/side-panel/plugins-panel"
import { PulsePanel } from "./components/side-panel/pulse-panel"
import { TerminalPanel } from "./components/side-panel/terminal-panel"
import type { Agent, FireflySurfaceTarget } from "./lib/types"

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
	target: FireflySurfaceTarget
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
	target: FireflySurfaceTarget
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
		target: { kind: "side-panel", tab: "review" },
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
		target: { kind: "side-panel", tab: "browser" },
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
		target: { kind: "side-panel", tab: "notes" },
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
		target: { kind: "side-panel", tab: "pulse" },
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
		target: { kind: "side-panel", tab: "memory" },
		spawn: (ctx) => <MemoryPanel agent={ctx.agent} />,
	},
	{
		id: "files",
		title: "Files",
		icon: FilesIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "files",
			atom: filesSurfaceEnabledAtom,
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.files
				? { available: true }
				: { available: false, reason: "Files surface is disabled in feature flags" },
		commandIds: ["surface.files.open", "surface.files.toggle"],
		persistenceKey: "side-panel.files",
		telemetryNamespace: "firefly.surface.files",
		target: { kind: "side-panel", tab: "files" },
		spawn: (ctx) => <FilesPanel agent={ctx.agent} />,
	},
	{
		id: "terminal",
		title: "Terminal",
		icon: TerminalSquareIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "terminal",
			atom: terminalSurfaceEnabledAtom,
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.terminal
				? { available: true }
				: { available: false, reason: "Terminal surface is disabled in feature flags" },
		commandIds: ["surface.terminal.open", "surface.terminal.toggle"],
		persistenceKey: "side-panel.terminal",
		telemetryNamespace: "firefly.surface.terminal",
		target: { kind: "side-panel", tab: "terminal" },
		spawn: (ctx) => <TerminalPanel agent={ctx.agent} />,
	},
	{
		id: "editor",
		title: "Editor",
		icon: SquarePenIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "editor",
			atom: editorSurfaceEnabledAtom,
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.editor
				? { available: true }
				: { available: false, reason: "Editor surface is disabled in feature flags" },
		commandIds: ["surface.editor.open", "surface.editor.toggle"],
		persistenceKey: "side-panel.editor",
		telemetryNamespace: "firefly.surface.editor",
		target: { kind: "side-panel", tab: "editor" },
		spawn: (ctx) => <EditorPanel agent={ctx.agent} />,
	},
	{
		id: "plugins",
		title: "Plugins",
		icon: PlugIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "plugins",
			atom: pluginsSurfaceEnabledAtom,
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
		spawn: (ctx) => <PluginsPanel agent={ctx.agent} />,
	},
	{
		id: "bridges",
		title: "Bridges",
		icon: Share2Icon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "bridges",
			atom: bridgesSurfaceEnabledAtom,
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.bridges
				? { available: true }
				: { available: false, reason: "Bridges surface is disabled in feature flags" },
		commandIds: ["surface.bridges.open", "surface.bridges.toggle"],
		persistenceKey: "side-panel.bridges",
		telemetryNamespace: "firefly.surface.bridges",
		target: { kind: "side-panel", tab: "bridges" },
		spawn: (ctx) => <BridgesPanel agent={ctx.agent} />,
	},
	{
		id: "crm",
		title: "Contacts / CRM",
		icon: UsersIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "crm",
			atom: crmSurfaceEnabledAtom,
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
		title: "Studio / Office",
		icon: MonitorPlayIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "studio",
			atom: studioSurfaceEnabledAtom,
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
		title: "Voice",
		icon: MicIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "voice",
			atom: voiceSurfaceEnabledAtom,
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
	{
		id: "oracle",
		title: "Oracle Roster",
		icon: WandSparklesIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "oracle",
			atom: oracleSurfaceEnabledAtom,
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.oracle
				? { available: true }
				: { available: false, reason: "Oracle roster surface is disabled in feature flags" },
		commandIds: ["surface.oracle.open", "surface.oracle.toggle"],
		persistenceKey: "side-panel.oracle",
		telemetryNamespace: "firefly.surface.oracle",
		target: { kind: "side-panel", tab: "oracle" },
		spawn: (ctx) => <OraclePanel agent={ctx.agent} />,
	},
	{
		id: "claude",
		title: "Claude Code",
		icon: RectangleEllipsisIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "claude",
			atom: claudeSurfaceEnabledAtom,
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.claude
				? { available: true }
				: { available: false, reason: "Claude Code surface is disabled in feature flags" },
		commandIds: ["surface.claude.open", "surface.claude.toggle"],
		persistenceKey: "side-panel.claude",
		telemetryNamespace: "firefly.surface.claude",
		target: { kind: "side-panel", tab: "claude" },
		spawn: (ctx) => <ClaudePanel agent={ctx.agent} />,
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
				target: surface.target,
				render: () => surface.spawn(ctx),
			}
		},
	)
}
