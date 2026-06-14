import { 	ActivityIcon, BoxesIcon, DatabaseIcon, FileDiffIcon, FileTextIcon, FilesIcon, GlobeIcon, MicIcon, MonitorPlayIcon, PlugIcon, RectangleEllipsisIcon, Share2Icon, SquarePenIcon, TerminalSquareIcon, UsersIcon, WandSparklesIcon, type LucideIcon } from "lucide-react"

import type { ComponentType, ReactNode } from "react"

import { Ch5PmDashboardPanel } from "./ch5pm-dashboard/panel"
import { ReviewPanel } from "./components/review/review-panel"
import { ArtifactsPanel } from "./components/side-panel/artifacts-panel"
import { BrowserPanel } from "./components/side-panel/browser-panel"
import { BridgesPanel } from "./components/side-panel/bridges-panel"
import { ClaudePanel } from "./components/side-panel/claude-panel"
import { CrmPanel } from "./components/side-panel/crm-panel"
import { PluginPanelBoundary } from "./components/side-panel/plugin-panel-boundary"
import { OraclePanel } from "./components/side-panel/oracle-panel"
import { PdfReviewPanel } from "./components/side-panel/pdf-review-panel"
import { StudioPanel } from "./components/side-panel/studio-panel"
import { VoicePanel } from "./components/side-panel/voice-panel"
import { EditorPanel } from "./components/side-panel/editor-panel"
import { FilesPanel } from "./components/side-panel/files-panel"
import { V2PluginsPanel } from "./components/side-panel/v2-plugins-panel"
import { PulsePanel } from "./components/side-panel/pulse-panel"
import { TerminalPanel } from "./components/side-panel/terminal-panel"
import type { Agent, FireflySurfaceTarget } from "./lib/types"
import {
	type NormalizedWorkspaceDescriptor,
	type WorkspaceHostDescriptor,
} from "./workspace-panel-descriptors"

const MemoryPanelHost = (({ className }: { agent: Agent; className?: string }) => (
	<div className={`flex h-full min-h-0 items-center justify-center px-4 text-center text-xs text-muted-foreground ${className ?? ""}`}>
		Loading Memory surface...
	</div>
))

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
	formFactor: FireflySurfaceFormFactor
	enabledFlag: {
		key: string
	}
	defaultOn: boolean
	commandIds: string[]
	persistenceKey: string
	telemetryNamespace: string
	target: FireflySurfaceTarget
	descriptor: FireflySurfaceHostDescriptor
}

export type FireflySurfaceHostDescriptor = WorkspaceHostDescriptor<
	FireflySurfaceId,
	"side-panel" | "main-pane",
	FireflySurfaceContext,
	FireflySurfaceAvailability
>

interface StaticPanelProps {
	agent: Agent
}

interface ReviewPanelRuntimeProps {
	sessionId: string
	directory: string
}

interface MemoryBoundaryRuntimeProps {
	pluginId: string
	contributionId: string
	hostComponent: ComponentType<{ agent: Agent; className?: string }>
	hostLazyImport: () => Promise<{ default: ComponentType<{ agent: Agent; className?: string }> }>
	agent: Agent
}

type FireflySurfaceComponent = ComponentType<object>

function componentEntrypoint<Props extends object>(
	Component: ComponentType<Props>,
	resolveProps: (ctx: FireflySurfaceContext) => Props,
): FireflySurfaceHostDescriptor["runtime"] {
	return {
		kind: "react-host-component",
		renderMode: "host-reconciler" as const,
		resolve: (ctx: FireflySurfaceContext) => ({
			Component: Component as FireflySurfaceComponent,
			props: resolveProps(ctx),
		}),
	}
}

function sidePanelDescriptor(
	config: Omit<FireflySurfaceDef, "descriptor"> & {
		title: string
		icon: LucideIcon
		availability: (ctx: FireflySurfaceContext) => FireflySurfaceAvailability
		runtime: FireflySurfaceHostDescriptor["runtime"]
		hostPolicy?: FireflySurfaceHostDescriptor["hostPolicy"]["hostPolicy"]
		multiplicityPolicy?: FireflySurfaceHostDescriptor["hostPolicy"]["multiplicityPolicy"]
	},
): FireflySurfaceDef {
	const defaultZoneId = config.target.kind === "workspace-panel" ? config.target.zoneId : "side-panel"
	return {
		id: config.id,
		manifestId: config.manifestId,
		formFactor: config.formFactor,
		enabledFlag: config.enabledFlag,
		defaultOn: config.defaultOn,
		commandIds: config.commandIds,
		persistenceKey: config.persistenceKey,
		telemetryNamespace: config.telemetryNamespace,
		target: config.target,
		descriptor: {
			id: config.id,
			hostPolicy: {
				logicalKind: "firefly-surface",
				defaultZoneId,
				hostPolicy: config.hostPolicy ?? "stable",
				multiplicityPolicy: config.multiplicityPolicy ?? "singleton",
			},
			presentation: {
				getTitle: () => config.title,
				getIcon: () => config.icon,
				getAvailability: config.availability,
			},
			runtime: config.runtime,
		},
	}
}

export interface FireflySidePanelTab {
	id: FireflySurfaceId
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

export interface FireflyResolvedSurfaceDescriptor extends NormalizedWorkspaceDescriptor<
	FireflySurfaceId,
	"side-panel" | "main-pane",
	FireflySurfaceAvailability,
	FireflySurfaceHostDescriptor["runtime"],
	FireflySurfaceTarget
> {
	id: FireflySurfaceId
	manifestId: string
	formFactor: FireflySurfaceFormFactor
	target: FireflySurfaceTarget
	enabledFlagKey: string
	defaultOn: boolean
}

export const FIREFLY_SURFACE_REGISTRY: FireflySurfaceDef[] = [
	sidePanelDescriptor({
		id: "review",
		manifestId: "firefly.built-in.side-panel.review",
		title: "Changes",
		icon: FileDiffIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "review",
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
		runtime: componentEntrypoint(ReviewPanel as ComponentType<ReviewPanelRuntimeProps>, (ctx) => ({
			sessionId: ctx.agent.sessionId,
			directory: ctx.agent.directory,
		})),
	}),
	sidePanelDescriptor({
		id: "browser",
		manifestId: "firefly.built-in.side-panel.browser",
		title: "Browser",
		icon: GlobeIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "browserPanelEnabled",
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
		runtime: componentEntrypoint(BrowserPanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	// `notes` is served from the plugin catalog (firefly.built-in.surface.notes,
	// apps/desktop/plugins/notes) — first migrated surface. Do not re-add a row.
	sidePanelDescriptor({
		id: "pulse",
		manifestId: "firefly.built-in.side-panel.pulse",
		title: "Pulse",
		icon: ActivityIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "pulse",
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
		runtime: componentEntrypoint(PulsePanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "artifacts",
		manifestId: "firefly.built-in.side-panel.artifacts",
		title: "Artifacts",
		icon: BoxesIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "artifacts",
		},
		defaultOn: true,
		availability: (ctx) =>
			ctx.flags.artifacts
				? { available: true }
				: { available: false, reason: "Artifacts surface is disabled in feature flags" },
		commandIds: ["surface.artifacts.open", "surface.artifacts.toggle"],
		persistenceKey: "side-panel.artifacts",
		telemetryNamespace: "firefly.surface.artifacts",
		target: { kind: "side-panel", tab: "artifacts" },
		runtime: componentEntrypoint(ArtifactsPanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "memory",
		manifestId: "firefly.built-in.side-panel.memory",
		title: "Memory",
		icon: DatabaseIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "memory",
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
		runtime: componentEntrypoint(PluginPanelBoundary as ComponentType<MemoryBoundaryRuntimeProps>, (ctx) => ({
			pluginId: "firefly.built-in.surface.memory",
			contributionId: "memory",
			hostComponent: MemoryPanelHost,
			hostLazyImport: () =>
				import("./components/side-panel/memory-panel").then((module) => ({
					default: module.MemoryPanel,
				})),
			agent: ctx.agent,
		})),
	}),
	sidePanelDescriptor({
		id: "files",
		manifestId: "firefly.built-in.side-panel.files",
		title: "Files",
		icon: FilesIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "files",
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
		runtime: componentEntrypoint(FilesPanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "terminal",
		manifestId: "firefly.built-in.side-panel.terminal",
		title: "Terminal",
		icon: TerminalSquareIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "terminal",
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
		runtime: componentEntrypoint(TerminalPanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "editor",
		manifestId: "firefly.built-in.side-panel.editor",
		title: "Editor",
		icon: SquarePenIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "editor",
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
		runtime: componentEntrypoint(EditorPanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "plugins",
		manifestId: "firefly.built-in.side-panel.plugins",
		title: "Plugins",
		icon: PlugIcon,
		formFactor: "side-panel-tab",
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
		runtime: componentEntrypoint(V2PluginsPanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "bridges",
		manifestId: "firefly.built-in.side-panel.bridges",
		title: "Bridges",
		icon: Share2Icon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "bridges",
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
		runtime: componentEntrypoint(BridgesPanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "crm",
		manifestId: "firefly.built-in.side-panel.crm",
		title: "Contacts / CRM",
		icon: UsersIcon,
		formFactor: "side-panel-tab",
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
		runtime: componentEntrypoint(CrmPanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "studio",
		manifestId: "firefly.built-in.side-panel.studio",
		title: "Studio / Office",
		icon: MonitorPlayIcon,
		formFactor: "side-panel-tab",
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
		runtime: componentEntrypoint(StudioPanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "voice",
		manifestId: "firefly.built-in.side-panel.voice",
		title: "Voice",
		icon: MicIcon,
		formFactor: "side-panel-tab",
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
		runtime: componentEntrypoint(VoicePanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "oracle",
		manifestId: "firefly.built-in.side-panel.oracle",
		title: "Oracle Roster",
		icon: WandSparklesIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "oracle",
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
		runtime: componentEntrypoint(OraclePanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "claude",
		manifestId: "firefly.built-in.side-panel.claude",
		title: "Claude Code",
		icon: RectangleEllipsisIcon,
		formFactor: "side-panel-tab",
		enabledFlag: {
			key: "claude",
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
		runtime: componentEntrypoint(ClaudePanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
	sidePanelDescriptor({
		id: "ch5pm",
		manifestId: "firefly.built-in.side-panel.ch5pm",
		title: "CH5PM Dashboard",
		icon: MonitorPlayIcon,
		formFactor: "side-panel-tab",
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
		runtime: componentEntrypoint(Ch5PmDashboardPanel as FireflySurfaceComponent, () => ({})),
	}),
	sidePanelDescriptor({
		id: "pdf-review",
		manifestId: "firefly.built-in.side-panel.pdf-review",
		title: "PDF Review",
		icon: FileTextIcon,
		formFactor: "side-panel-tab",
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
		runtime: componentEntrypoint(PdfReviewPanel as ComponentType<StaticPanelProps>, (ctx) => ({ agent: ctx.agent })),
	}),
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
export { FIREFLY_SURFACE_IDS, type FireflySurfaceId } from "../shared/firefly-surface-ids"
import { FIREFLY_SURFACE_IDS, type FireflySurfaceId } from "../shared/firefly-surface-ids"

/**
 * Surfaces that are valid side-panel tabs but have NO registry row here:
 * they are served from the plugin catalog (host plugin lifecycle owns
 * their enable/disable). First migrated surface: notes.
 */
export const CATALOG_SERVED_SURFACE_IDS: readonly FireflySurfaceId[] = ["notes"]

export const FIREFLY_SURFACE_DEFAULT_ON = Object.fromEntries(
	FIREFLY_SURFACE_REGISTRY.map((surface) => [surface.id, surface.defaultOn]),
) as Readonly<Record<FireflySurfaceId, boolean>>

export const FIREFLY_SURFACE_LABELS = Object.fromEntries(
	FIREFLY_SURFACE_REGISTRY.map((surface) => [surface.id, surface.descriptor.presentation.getTitle(null as never)]),
) as Readonly<Record<FireflySurfaceId, string>>

export const FIREFLY_SURFACE_REGISTRY_BY_ID = Object.fromEntries(
	FIREFLY_SURFACE_REGISTRY.map((surface) => [surface.id, surface]),
) as Record<FireflySurfaceId, FireflySurfaceDef>

export function resolveFireflySurfaceDescriptor(
	surface: FireflySurfaceDef,
	ctx: FireflySurfaceContext,
): FireflyResolvedSurfaceDescriptor {
	return {
		id: surface.id,
		manifestId: surface.manifestId,
		formFactor: surface.formFactor,
		target: surface.target,
		enabledFlagKey: surface.enabledFlag.key,
		defaultOn: surface.defaultOn,
		commandIds: surface.commandIds,
		persistenceKey: surface.persistenceKey,
		telemetryNamespace: surface.telemetryNamespace,
		title: surface.descriptor.presentation.getTitle(ctx),
		icon: surface.descriptor.presentation.getIcon(ctx),
		availability: surface.descriptor.presentation.getAvailability(ctx),
		hostPolicy: surface.descriptor.hostPolicy,
		runtime: surface.descriptor.runtime,
	}
}

export function renderFireflySurfaceRuntime(
	runtime: FireflySurfaceHostDescriptor["runtime"],
	ctx: FireflySurfaceContext,
): ReactNode {
	if (runtime.kind !== "react-host-component") {
		throw new Error(`unsupported firefly surface runtime kind: ${runtime.kind}`)
	}
	const resolved = runtime.resolve(ctx)
	const Component = resolved.Component
	return <Component {...resolved.props} />
}

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
			const descriptor = resolveFireflySurfaceDescriptor(surface, ctx)
			const Icon = descriptor.icon
			return {
				id: surface.id,
				label: descriptor.title,
				icon: <Icon className="size-4" />,
				title: descriptor.title,
				availability: descriptor.availability,
				commandIds: [...descriptor.commandIds],
				persistenceKey: descriptor.persistenceKey,
				telemetryNamespace: descriptor.telemetryNamespace,
				target: descriptor.target,
				render: () => renderFireflySurfaceRuntime(descriptor.runtime, ctx),
			}
		},
	)
}
