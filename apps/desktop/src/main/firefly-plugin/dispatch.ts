import { z } from "zod"

import { BUILT_IN_DEFAULT_CAPABILITIES, decideCapabilityAll, lookupCapability } from "./capability-broker"
import { getPluginCatalog } from "./authority"
import { getWorkerInvokeRouter } from "./worker-invoke-router"
import type { PluginDescriptor } from "../../shared/firefly-plugin/descriptor"
import type { CommandContribution, TrustTier } from "../../shared/firefly-plugin/manifest"
import type { SurfaceContextFragment } from "../surface-context-compose"
import { buildBrowserSurfaceFragment, resolveWebToolDispatch } from "./browser-tool-handlers"
import { createLogger } from "../logger"

const log = createLogger("firefly-plugin/dispatch")

export interface PluginInvokeInput {
	pluginId: string
	commandId: string
	args: Record<string, unknown>
	sessionId?: string | null
}

export interface PluginInvokeContext {
	grantedTokens: string[]
	sessionScope: "session" | "project" | "app"
}

// ---------------------------------------------------------------------------
// Capability grant resolution (P3d)
//
// The granted-token set is no longer a hardcoded baseline. It is resolved per
// invocation from a pluggable resolver: built-in plugins get their declared
// non-critical capabilities by policy; everything else is deny-by-default and
// must have explicit persisted grants. The app installs a DB-backed resolver at
// boot (`setGrantResolver`); tests use the hermetic default (no DB).
// ---------------------------------------------------------------------------

export interface GrantResolverInput {
	readonly pluginId: string
	readonly trust: TrustTier
	readonly declaredCapabilities: readonly string[]
	readonly sessionScope: "session" | "project" | "app"
}

export type GrantResolver = (input: GrantResolverInput) => Promise<readonly string[]> | readonly string[]

/**
 * Hermetic default: built-in plugins are host-owned, so their declared
 * non-critical capabilities are policy-granted (critical still needs explicit
 * consent). Non-built-in plugins get NOTHING by default — deny-by-default until
 * an explicit grant exists (the DB resolver layers those in at runtime).
 */
export function defaultGrantResolver(input: GrantResolverInput): string[] {
	if (input.trust !== "built-in") return []
	const declaredNonCritical = input.declaredCapabilities.filter(
		(token) => lookupCapability(token)?.risk !== "critical",
	)
	return [...new Set<string>([...BUILT_IN_DEFAULT_CAPABILITIES, ...declaredNonCritical])]
}

let grantResolver: GrantResolver = defaultGrantResolver

/** Install a grant resolver (e.g. DB-backed, layering persisted user grants). */
export function setGrantResolver(resolver: GrantResolver): void {
	grantResolver = resolver
}

export function _resetGrantResolverForTests(): void {
	grantResolver = defaultGrantResolver
}

async function resolveContext(
	descriptor: PluginDescriptor,
	explicit: PluginInvokeContext | undefined,
): Promise<PluginInvokeContext> {
	if (explicit) return explicit
	const sessionScope = "session"
	const grantedTokens = await grantResolver({
		pluginId: descriptor.normalizedId,
		trust: descriptor.trust,
		declaredCapabilities: descriptor.capabilities,
		sessionScope,
	})
	return { grantedTokens: [...grantedTokens], sessionScope }
}

export type HostCommandResult =
	| { data: unknown }
	| { error: { code: string; message: string } }

export type HostCommandHandler = (input: {
	command: z.ZodTypeAny
	args: unknown
	sessionId: string | null
}) => Promise<HostCommandResult>

const handlers = new Map<string, HostCommandHandler>()

export function registerHostCommand(
	pluginId: string,
	commandId: string,
	handler: HostCommandHandler,
): void {
	handlers.set(`${pluginId}::${commandId}`, handler)
}

export function unregisterHostCommand(pluginId: string, commandId: string): void {
	handlers.delete(`${pluginId}::${commandId}`)
}

export function listKnownCommands(): string[] {
	return Array.from(handlers.keys())
}

export function _resetHostCommandsForTests(): void {
	handlers.clear()
}

function findManifestCommand(
	pluginId: string,
	commandId: string,
): { descriptor: PluginDescriptor; command: CommandContribution } | null {
	const catalog = getPluginCatalog()
	const descriptor = catalog.descriptors.find((d) => d.normalizedId === pluginId)
	if (!descriptor) return null
	const command = descriptor.commands.find((c) => c.id === commandId)
	if (!command) return null
	return { descriptor, command }
}

function ok<T>(data: T): HostCommandResult {
	return { data }
}

function err(code: string, message: string): HostCommandResult {
	return { error: { code, message } }
}

export interface ToolDispatchEnvelope {
	status: "completed" | "failed" | "denied" | "unavailable" | "queued" | "cancelled"
	pluginId: string
	commandId: string
	errorCode?: string
	errorMessage?: string
	data?: unknown
}

export async function invokePluginCommand(
	input: PluginInvokeInput,
	context?: PluginInvokeContext,
): Promise<ToolDispatchEnvelope> {
	const found = findManifestCommand(input.pluginId, input.commandId)
	if (!found) {
		return {
			status: "unavailable",
			pluginId: input.pluginId,
			commandId: input.commandId,
			errorCode: "plugin_unavailable",
			errorMessage: "Unknown command",
		}
	}
	const { descriptor, command } = found
	const resolved = await resolveContext(descriptor, context)
	const broker = decideCapabilityAll({
		pluginId: input.pluginId,
		trust: descriptor.trust,
		tokens: command.requires,
		sessionScope: resolved.sessionScope,
		grantedTokens: resolved.grantedTokens,
	})
	if (!broker.granted) {
		return {
			status: "denied",
			pluginId: input.pluginId,
			commandId: input.commandId,
			errorCode: "permission_denied",
			errorMessage: broker.failures[0]?.reason ?? "capability denied",
		}
	}
	// Worker-backed path (B3): after broker approval, route to the live worker
	// if the plugin is electron-utility and its supervisor state is active.
	// Built-ins (no worker, in-process) fall through to the handler map below.
	const router = getWorkerInvokeRouter()
	if (router.isWorkerBacked(input.pluginId)) {
		const workerResult = await router.invoke({
			pluginId: input.pluginId,
			kind: "command",
			targetId: input.commandId,
			args: input.args,
			sessionId: input.sessionId ?? null,
		})
		if (workerResult.ok) {
			return {
				status: "completed",
				pluginId: input.pluginId,
				commandId: input.commandId,
				data: workerResult.data,
			}
		}
		return {
			status: "failed",
			pluginId: input.pluginId,
			commandId: input.commandId,
			errorCode: workerResult.errorCode,
			errorMessage: workerResult.errorMessage,
		}
	}
	const handler = handlers.get(`${input.pluginId}::${input.commandId}`)
	if (!handler) {
		return {
			status: "unavailable",
			pluginId: input.pluginId,
			commandId: input.commandId,
			errorCode: "plugin_unavailable",
			errorMessage: "No host handler registered",
		}
	}
	const argsSchema = z.object((command as { args?: Record<string, z.ZodTypeAny> }).args ?? {}).passthrough()
	const result = await handler({
		command: argsSchema as z.ZodTypeAny,
		args: input.args as Record<string, unknown> | undefined,
		sessionId: input.sessionId ?? null,
	})
	if ("error" in result) {
		return {
			status: "failed",
			pluginId: input.pluginId,
			commandId: input.commandId,
			errorCode: result.error.code,
			errorMessage: result.error.message,
		}
	}
	return {
		status: "completed",
		pluginId: input.pluginId,
		commandId: input.commandId,
		data: result.data,
	}
}

// ---------------------------------------------------------------------------
// Tool dispatch (paired OpenCode/agent tools from `contributes.tools`)
// ---------------------------------------------------------------------------

export type HostToolHandler = (input: {
	args: Record<string, unknown>
	sessionId: string | null
}) => Promise<HostCommandResult>

const toolHandlers = new Map<string, HostToolHandler>()

export function registerHostTool(pluginId: string, toolId: string, handler: HostToolHandler): void {
	toolHandlers.set(`${pluginId}::${toolId}`, handler)
}

export function unregisterHostTool(pluginId: string, toolId: string): void {
	toolHandlers.delete(`${pluginId}::${toolId}`)
}

export function listKnownTools(): string[] {
	return Array.from(toolHandlers.keys())
}

export function _resetHostToolsForTests(): void {
	toolHandlers.clear()
}

// ---------------------------------------------------------------------------
// Host context projectors (host → agent, per-turn surface context)
//
// Each surface registers a projector keyed by `pluginId::surfaceId` that emits
// a compact `SurfaceContextFragment` describing its live state. The host calls
// every registered projector each turn and composes the results in
// `surface-context-compose.ts`. A projector may return `null` to contribute
// nothing this turn. A single broken projector must NOT kill the whole context,
// so per-projector errors are swallowed with a logged warning here — this is a
// scoped fail-soft so one bad surface can't blind the agent to every other one.
// ---------------------------------------------------------------------------

export type HostContextProjector = (input: {
	sessionId: string | null
}) => Promise<SurfaceContextFragment | null> | SurfaceContextFragment | null

const contextProjectors = new Map<string, HostContextProjector>()

export function registerHostContextProjector(
	pluginId: string,
	surfaceId: string,
	fn: HostContextProjector,
): void {
	contextProjectors.set(`${pluginId}::${surfaceId}`, fn)
}

export function unregisterHostContextProjector(pluginId: string, surfaceId: string): void {
	contextProjectors.delete(`${pluginId}::${surfaceId}`)
}

export function listKnownContextProjectors(): string[] {
	return Array.from(contextProjectors.keys())
}

export function _resetHostContextProjectorsForTests(): void {
	contextProjectors.clear()
}

/**
 * Run every registered context projector for this session and collect the
 * non-null fragments. Per-projector failures are logged and skipped so a broken
 * surface can't blind the agent to the rest.
 */
export async function listContextProjectorFragments(
	sessionId: string | null,
): Promise<SurfaceContextFragment[]> {
	const fragments: SurfaceContextFragment[] = []
	for (const [key, projector] of contextProjectors) {
		try {
			const fragment = await projector({ sessionId })
			if (fragment) fragments.push(fragment)
		} catch (err) {
			log.warn("Context projector failed; skipping its fragment", {
				projector: key,
				reason: err instanceof Error ? err.message : String(err),
			})
		}
	}
	return fragments
}

export interface PluginToolInvokeInput {
	pluginId: string
	toolId: string
	args: Record<string, unknown>
	sessionId?: string | null
}

/**
 * Invoke a plugin tool through the catalog: manifest lookup → broker
 * capability check → Zod args validation → registered host handler.
 * Same envelope family as command dispatch; every failure is typed.
 */
export async function invokePluginTool(
	input: PluginToolInvokeInput,
	context?: PluginInvokeContext,
): Promise<ToolDispatchEnvelope> {
	const catalog = getPluginCatalog()
	const descriptor = catalog.descriptors.find((d) => d.normalizedId === input.pluginId)
	const tool = descriptor?.tools.find((t) => t.id === input.toolId)
	if (!descriptor || !tool) {
		return {
			status: "unavailable",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: "plugin_unavailable",
			errorMessage: "Unknown tool",
		}
	}
	const state = catalog.capabilityStates[input.pluginId]
	if (state?.pluginDisabled || state?.pluginQuarantined) {
		return {
			status: "unavailable",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: state.pluginQuarantined ? "plugin_quarantined" : "plugin_disabled",
			errorMessage: state.pluginQuarantined
				? "Plugin is quarantined by the host"
				: "Plugin is disabled by the host",
		}
	}
	const resolved = await resolveContext(descriptor, context)
	const broker = decideCapabilityAll({
		pluginId: input.pluginId,
		trust: descriptor.trust,
		tokens: tool.requires,
		sessionScope: resolved.sessionScope,
		grantedTokens: resolved.grantedTokens,
	})
	if (!broker.granted) {
		return {
			status: "denied",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: "permission_denied",
			errorMessage: broker.failures[0]?.reason ?? "capability denied",
		}
	}
	// Worker-backed path (B3): after broker approval, route to the live worker
	// if the plugin is electron-utility and its supervisor state is active.
	// Built-ins (no worker, in-process) fall through to the handler map below.
	const toolRouter = getWorkerInvokeRouter()
	if (toolRouter.isWorkerBacked(input.pluginId)) {
		const workerResult = await toolRouter.invoke({
			pluginId: input.pluginId,
			kind: "tool",
			targetId: input.toolId,
			args: input.args,
			sessionId: input.sessionId ?? null,
		})
		if (workerResult.ok) {
			return {
				status: "completed",
				pluginId: input.pluginId,
				commandId: input.toolId,
				data: workerResult.data,
			}
		}
		return {
			status: "failed",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: workerResult.errorCode,
			errorMessage: workerResult.errorMessage,
		}
	}
	const argsSchema = z.object(tool.args as Record<string, z.ZodTypeAny>)
	const parsedArgs = argsSchema.safeParse(input.args ?? {})
	if (!parsedArgs.success) {
		return {
			status: "failed",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: "validation_error",
			errorMessage: parsedArgs.error.issues
				.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
				.join("; "),
		}
	}
	const handler = toolHandlers.get(`${input.pluginId}::${input.toolId}`)
	if (!handler) {
		return {
			status: "unavailable",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: "plugin_unavailable",
			errorMessage: "No host tool handler registered",
		}
	}
	const result = await handler({
		args: parsedArgs.data as Record<string, unknown>,
		sessionId: input.sessionId ?? null,
	})
	if ("error" in result) {
		return {
			status: "failed",
			pluginId: input.pluginId,
			commandId: input.toolId,
			errorCode: result.error.code,
			errorMessage: result.error.message,
		}
	}
	return {
		status: "completed",
		pluginId: input.pluginId,
		commandId: input.toolId,
		data: result.data,
	}
}

async function invokePalotOpenSidePanel(input: {
	command: z.ZodTypeAny
	args: unknown
	sessionId: string | null
}) {
	const parsed = input.command.parse(input.args ?? {})
	const tab = (parsed as { tab?: string }).tab
	if (!tab) return err("validation_error", "missing tab")
	return ok({ opened: true, tab, source: "v2-plugin-dispatch" })
}

async function invokePalotRefreshUiState() {
	return ok({ refreshedAt: Date.now(), source: "v2-plugin-dispatch" })
}

async function invokePalotUiState() {
	return ok({ sidePanel: { open: true, activeTab: "review" }, source: "v2-plugin-dispatch" })
}

async function invokeAcmeNotebookOpen() {
	return ok({
		notebookId: "acme-default",
		opened: true,
		note: "Acme Notebook opens its notepad in the above-chat zone via the V2 runtime path",
	})
}

async function invokeAcmeNotebookClear() {
	return ok({ cleared: true, clearedAt: Date.now() })
}

// ---------------------------------------------------------------------------
// Notes plugin host handlers (firefly.built-in.surface.notes)
// ---------------------------------------------------------------------------

export interface SidePanelStateSnapshot {
	readonly open: boolean
	readonly activeTab: string | null
	readonly availableTabs: readonly string[]
}

export interface NotesHostDeps {
	openSidePanel: (tab: "notes") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

async function defaultOpenSidePanel(tab: "notes"): Promise<void> {
	const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
	await broadcastOpenSidePanel(tab)
}

function defaultGetSidePanelState(): SidePanelStateSnapshot {
	// Lazy import keeps the bun test runner free of the bridge server
	// module graph unless a handler actually runs.
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const { getUiStateSnapshot } = require("../palot-browser-ipc") as typeof import("../palot-browser-ipc")
	const snapshot = getUiStateSnapshot()
	return {
		open: snapshot.sidePanel.open,
		activeTab: snapshot.sidePanel.activeTab,
		availableTabs: snapshot.sidePanel.availableTabs,
	}
}

const NOTES_PLUGIN_ID = "firefly.built-in.surface.notes"

export function registerNotesHostHandlers(deps?: Partial<NotesHostDeps>): void {
	const openSidePanel = deps?.openSidePanel ?? defaultOpenSidePanel
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(NOTES_PLUGIN_ID, "plugin.firefly.built-in.surface.notes.open", async () => {
		await openSidePanel("notes")
		return ok({ opened: true, tab: "notes", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(NOTES_PLUGIN_ID, "plugin.firefly.built-in.surface.notes.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "notes",
			available: sidePanel.availableTabs.includes("notes"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "notes",
		})
	})

	registerHostCommand(NOTES_PLUGIN_ID, "open-notes", async () => {
		await openSidePanel("notes")
		return ok({ opened: true, tab: "notes" })
	})

	registerHostCommand(NOTES_PLUGIN_ID, "toggle-notes", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[NOTES_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(NOTES_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: NOTES_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Review surface host handlers (firefly.built-in.surface.review)
// ---------------------------------------------------------------------------

export interface ReviewHostDeps {
	openSidePanel: (tab: "review") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const REVIEW_PLUGIN_ID = "firefly.built-in.surface.review"

export function registerReviewHostHandlers(deps?: Partial<ReviewHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "review") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(REVIEW_PLUGIN_ID, "plugin.firefly.built-in.surface.review.open", async () => {
		await openSidePanel("review")
		return ok({ opened: true, tab: "review", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(REVIEW_PLUGIN_ID, "plugin.firefly.built-in.surface.review.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "review",
			available: sidePanel.availableTabs.includes("review"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "review",
		})
	})

	registerHostCommand(REVIEW_PLUGIN_ID, "open-review", async () => {
		await openSidePanel("review")
		return ok({ opened: true, tab: "review" })
	})

	registerHostCommand(REVIEW_PLUGIN_ID, "toggle-review", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[REVIEW_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(REVIEW_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: REVIEW_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Files surface host handlers (firefly.built-in.surface.files)
// ---------------------------------------------------------------------------

export interface FilesHostDeps {
	openSidePanel: (tab: "files") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const FILES_PLUGIN_ID = "firefly.built-in.surface.files"

export function registerFilesHostHandlers(deps?: Partial<FilesHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "files") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(FILES_PLUGIN_ID, "plugin.firefly.built-in.surface.files.open", async () => {
		await openSidePanel("files")
		return ok({ opened: true, tab: "files", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(FILES_PLUGIN_ID, "plugin.firefly.built-in.surface.files.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "files",
			available: sidePanel.availableTabs.includes("files"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "files",
		})
	})

	registerHostCommand(FILES_PLUGIN_ID, "open-files", async () => {
		await openSidePanel("files")
		return ok({ opened: true, tab: "files" })
	})

	registerHostCommand(FILES_PLUGIN_ID, "toggle-files", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[FILES_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(FILES_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: FILES_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Artifacts surface host handlers (firefly.built-in.surface.artifacts)
// ---------------------------------------------------------------------------

export interface ArtifactsHostDeps {
	openSidePanel: (tab: "artifacts") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
	// Optional overrides for show.doc — injected in tests, defaults use live stores.
	showDocUpsertArtifact?: import("./artifacts-show-doc").ShowDocDeps["upsertArtifact"]
	showDocBroadcastArtifactPushed?: import("./artifacts-show-doc").ShowDocDeps["broadcastArtifactPushed"]
}

const ARTIFACTS_PLUGIN_ID = "firefly.built-in.surface.artifacts"

export function registerArtifactsHostHandlers(deps?: Partial<ArtifactsHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "artifacts") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(ARTIFACTS_PLUGIN_ID, "plugin.firefly.built-in.surface.artifacts.open", async () => {
		await openSidePanel("artifacts")
		return ok({ opened: true, tab: "artifacts", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(ARTIFACTS_PLUGIN_ID, "plugin.firefly.built-in.surface.artifacts.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "artifacts",
			available: sidePanel.availableTabs.includes("artifacts"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "artifacts",
		})
	})

	registerHostTool(ARTIFACTS_PLUGIN_ID, "plugin.firefly.built-in.surface.artifacts.show-doc", async ({ args, sessionId }) => {
		const { executeShowDoc } = await import("./artifacts-show-doc")

		// Resolve deps: allow test injection via ArtifactsHostDeps, otherwise use live stores.
		const upsertArtifact =
			deps?.showDocUpsertArtifact ??
			((sid: string, record: Parameters<import("./artifacts-show-doc").ShowDocDeps["upsertArtifact"]>[1]) => {
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const { getArtifactStore } = require("../palot-runtime/artifact-store") as typeof import("../palot-runtime/artifact-store")
				return getArtifactStore().upsertArtifact(sid, record)
			})

		const broadcastArtifactPushed =
			deps?.showDocBroadcastArtifactPushed ??
			(async (sid: string, record: import("../../preload/api").GenUiArtifactRecord) => {
				const { broadcastArtifactPushed: broadcast } = await import("../palot-browser-ipc")
				await broadcast(sid, record)
			})

		const result = await executeShowDoc(
			args as unknown as import("./artifacts-show-doc").ShowDocArgs,
			sessionId,
			{
				upsertArtifact,
				broadcastArtifactPushed,
				broadcastOpenSidePanel: openSidePanel,
			},
		)
		return result
	})

	registerHostCommand(ARTIFACTS_PLUGIN_ID, "open-artifacts", async () => {
		await openSidePanel("artifacts")
		return ok({ opened: true, tab: "artifacts" })
	})

	registerHostCommand(ARTIFACTS_PLUGIN_ID, "toggle-artifacts", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[ARTIFACTS_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(ARTIFACTS_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: ARTIFACTS_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Bridges surface host handlers (firefly.built-in.surface.bridges)
// ---------------------------------------------------------------------------

export interface BridgesHostDeps {
	openSidePanel: (tab: "bridges") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const BRIDGES_PLUGIN_ID = "firefly.built-in.surface.bridges"

export function registerBridgesHostHandlers(deps?: Partial<BridgesHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "bridges") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(BRIDGES_PLUGIN_ID, "plugin.firefly.built-in.surface.bridges.open", async () => {
		await openSidePanel("bridges")
		return ok({ opened: true, tab: "bridges", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(BRIDGES_PLUGIN_ID, "plugin.firefly.built-in.surface.bridges.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "bridges",
			available: sidePanel.availableTabs.includes("bridges"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "bridges",
		})
	})

	registerHostCommand(BRIDGES_PLUGIN_ID, "open-bridges", async () => {
		await openSidePanel("bridges")
		return ok({ opened: true, tab: "bridges" })
	})

	registerHostCommand(BRIDGES_PLUGIN_ID, "toggle-bridges", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[BRIDGES_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(BRIDGES_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: BRIDGES_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Pulse surface host handlers (firefly.built-in.surface.pulse)
// ---------------------------------------------------------------------------

export interface PulseHostDeps {
	openSidePanel: (tab: "pulse") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const PULSE_PLUGIN_ID = "firefly.built-in.surface.pulse"

export function registerPulseHostHandlers(deps?: Partial<PulseHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "pulse") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(PULSE_PLUGIN_ID, "plugin.firefly.built-in.surface.pulse.open", async () => {
		await openSidePanel("pulse")
		return ok({ opened: true, tab: "pulse", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(PULSE_PLUGIN_ID, "plugin.firefly.built-in.surface.pulse.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "pulse",
			available: sidePanel.availableTabs.includes("pulse"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "pulse",
		})
	})

	registerHostCommand(PULSE_PLUGIN_ID, "open-pulse", async () => {
		await openSidePanel("pulse")
		return ok({ opened: true, tab: "pulse" })
	})

	registerHostCommand(PULSE_PLUGIN_ID, "toggle-pulse", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[PULSE_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(PULSE_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: PULSE_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Memory surface host handlers (firefly.built-in.surface.memory)
// ---------------------------------------------------------------------------

export interface MemoryHostDeps {
	openSidePanel: (tab: "memory") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const MEMORY_PLUGIN_ID = "firefly.built-in.surface.memory"

export function registerMemoryHostHandlers(deps?: Partial<MemoryHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "memory") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(MEMORY_PLUGIN_ID, "plugin.firefly.built-in.surface.memory.open", async () => {
		await openSidePanel("memory")
		return ok({ opened: true, tab: "memory", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(MEMORY_PLUGIN_ID, "plugin.firefly.built-in.surface.memory.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "memory",
			available: sidePanel.availableTabs.includes("memory"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "memory",
		})
	})

	registerHostCommand(MEMORY_PLUGIN_ID, "open-memory", async () => {
		await openSidePanel("memory")
		return ok({ opened: true, tab: "memory" })
	})

	registerHostCommand(MEMORY_PLUGIN_ID, "toggle-memory", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[MEMORY_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(MEMORY_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: MEMORY_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Editor surface host handlers (firefly.built-in.surface.editor)
// ---------------------------------------------------------------------------

export interface EditorHostDeps {
	openSidePanel: (tab: "editor") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const EDITOR_PLUGIN_ID = "firefly.built-in.surface.editor"

export function registerEditorHostHandlers(deps?: Partial<EditorHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "editor") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(EDITOR_PLUGIN_ID, "plugin.firefly.built-in.surface.editor.open", async () => {
		await openSidePanel("editor")
		return ok({ opened: true, tab: "editor", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(EDITOR_PLUGIN_ID, "plugin.firefly.built-in.surface.editor.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "editor",
			available: sidePanel.availableTabs.includes("editor"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "editor",
		})
	})

	registerHostCommand(EDITOR_PLUGIN_ID, "open-editor", async () => {
		await openSidePanel("editor")
		return ok({ opened: true, tab: "editor" })
	})

	registerHostCommand(EDITOR_PLUGIN_ID, "toggle-editor", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[EDITOR_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(EDITOR_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: EDITOR_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Terminal surface host handlers (firefly.built-in.surface.terminal)
// ---------------------------------------------------------------------------

export interface TerminalHostDeps {
	openSidePanel: (tab: "terminal") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const TERMINAL_PLUGIN_ID = "firefly.built-in.surface.terminal"

export function registerTerminalHostHandlers(deps?: Partial<TerminalHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "terminal") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(TERMINAL_PLUGIN_ID, "plugin.firefly.built-in.surface.terminal.open", async () => {
		await openSidePanel("terminal")
		return ok({ opened: true, tab: "terminal", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(TERMINAL_PLUGIN_ID, "plugin.firefly.built-in.surface.terminal.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "terminal",
			available: sidePanel.availableTabs.includes("terminal"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "terminal",
		})
	})

	registerHostCommand(TERMINAL_PLUGIN_ID, "open-terminal", async () => {
		await openSidePanel("terminal")
		return ok({ opened: true, tab: "terminal" })
	})

	registerHostCommand(TERMINAL_PLUGIN_ID, "toggle-terminal", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[TERMINAL_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(TERMINAL_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: TERMINAL_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Claude Code surface host handlers (firefly.built-in.surface.claude)
// ---------------------------------------------------------------------------

export interface ClaudeHostDeps {
	openSidePanel: (tab: "claude") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const CLAUDE_PLUGIN_ID = "firefly.built-in.surface.claude"

export function registerClaudeHostHandlers(deps?: Partial<ClaudeHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "claude") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(CLAUDE_PLUGIN_ID, "plugin.firefly.built-in.surface.claude.open", async () => {
		await openSidePanel("claude")
		return ok({ opened: true, tab: "claude", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(CLAUDE_PLUGIN_ID, "plugin.firefly.built-in.surface.claude.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "claude",
			available: sidePanel.availableTabs.includes("claude"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "claude",
		})
	})

	registerHostCommand(CLAUDE_PLUGIN_ID, "open-claude", async () => {
		await openSidePanel("claude")
		return ok({ opened: true, tab: "claude" })
	})

	registerHostCommand(CLAUDE_PLUGIN_ID, "toggle-claude", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[CLAUDE_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(CLAUDE_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: CLAUDE_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Oracle Roster surface host handlers (firefly.built-in.surface.oracle)
// ---------------------------------------------------------------------------

export interface OracleHostDeps {
	openSidePanel: (tab: "oracle") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const ORACLE_PLUGIN_ID = "firefly.built-in.surface.oracle"

export function registerOracleHostHandlers(deps?: Partial<OracleHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "oracle") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(ORACLE_PLUGIN_ID, "plugin.firefly.built-in.surface.oracle.open", async () => {
		await openSidePanel("oracle")
		return ok({ opened: true, tab: "oracle", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(ORACLE_PLUGIN_ID, "plugin.firefly.built-in.surface.oracle.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "oracle",
			available: sidePanel.availableTabs.includes("oracle"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "oracle",
		})
	})

	registerHostCommand(ORACLE_PLUGIN_ID, "open-oracle", async () => {
		await openSidePanel("oracle")
		return ok({ opened: true, tab: "oracle" })
	})

	registerHostCommand(ORACLE_PLUGIN_ID, "toggle-oracle", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[ORACLE_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(ORACLE_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: ORACLE_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Voice surface host handlers (firefly.built-in.surface.voice)
// ---------------------------------------------------------------------------

export interface VoiceHostDeps {
	openSidePanel: (tab: "voice") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const VOICE_PLUGIN_ID = "firefly.built-in.surface.voice"

export function registerVoiceHostHandlers(deps?: Partial<VoiceHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "voice") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(VOICE_PLUGIN_ID, "plugin.firefly.built-in.surface.voice.open", async () => {
		await openSidePanel("voice")
		return ok({ opened: true, tab: "voice", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(VOICE_PLUGIN_ID, "plugin.firefly.built-in.surface.voice.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "voice",
			available: sidePanel.availableTabs.includes("voice"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "voice",
		})
	})

	registerHostCommand(VOICE_PLUGIN_ID, "open-voice", async () => {
		await openSidePanel("voice")
		return ok({ opened: true, tab: "voice" })
	})

	registerHostCommand(VOICE_PLUGIN_ID, "toggle-voice", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[VOICE_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(VOICE_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: VOICE_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// DevMux Toolbar host handlers (firefly.built-in.devmux-toolbar)
//
// The Node-only work lives in `main/devmux/service.ts` and is reached here
// behind the `host:devmux.*` capability tokens. Both UI commands and agent
// tools route to the same service functions; the service is dynamic-imported
// so its tmux deps never enter the bun test graph that imports this
// dispatcher. (Opening a service URL externally is a pure client action —
// the renderer uses `backend.openExternalUrl`, not a host command.)
// ---------------------------------------------------------------------------

const DEVMUX_TOOLBAR_PLUGIN_ID = "firefly.built-in.devmux-toolbar"

function readStringArg(args: unknown, key: string): string | null {
	if (args && typeof args === "object" && key in args) {
		const value = (args as Record<string, unknown>)[key]
		if (typeof value === "string" && value.length > 0) return value
	}
	return null
}

function devmuxError(cause: unknown): HostCommandResult {
	const message = cause instanceof Error ? cause.message : String(cause)
	const code = message.startsWith("no devmux config") ? "devmux_no_config" : "devmux_failed"
	return err(code, message)
}

async function devmuxList(args: unknown): Promise<HostCommandResult> {
	const projectDir = readStringArg(args, "projectDir")
	if (!projectDir) return err("validation_error", "missing projectDir")
	try {
		const service = await import("../devmux/service")
		return ok(await service.listServices(projectDir))
	} catch (cause) {
		return devmuxError(cause)
	}
}

async function devmuxStatus(args: unknown): Promise<HostCommandResult> {
	const projectDir = readStringArg(args, "projectDir")
	if (!projectDir) return err("validation_error", "missing projectDir")
	try {
		const service = await import("../devmux/service")
		return ok({ services: await service.statusAll(projectDir) })
	} catch (cause) {
		return devmuxError(cause)
	}
}

async function devmuxLaunch(args: unknown): Promise<HostCommandResult> {
	const projectDir = readStringArg(args, "projectDir")
	const serviceName = readStringArg(args, "service")
	if (!projectDir) return err("validation_error", "missing projectDir")
	if (!serviceName) return err("validation_error", "missing service")
	try {
		const service = await import("../devmux/service")
		return ok(await service.ensureService(projectDir, serviceName))
	} catch (cause) {
		return devmuxError(cause)
	}
}

// ---------------------------------------------------------------------------
// Browser surface host handlers (firefly.built-in.surface.browser)
// ---------------------------------------------------------------------------

export interface BrowserHostDeps {
	openSidePanel: (tab: "browser") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const BROWSER_PLUGIN_ID = "firefly.built-in.surface.browser"

export function registerBrowserHostHandlers(deps?: Partial<BrowserHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "browser") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(BROWSER_PLUGIN_ID, "plugin.firefly.built-in.surface.browser.open", async () => {
		await openSidePanel("browser")
		return ok({ opened: true, tab: "browser", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(BROWSER_PLUGIN_ID, "plugin.firefly.built-in.surface.browser.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "browser",
			available: sidePanel.availableTabs.includes("browser"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "browser",
		})
	})

	// web.* action tools → existing browser-lane dispatcher (which publishes the
	// actor-tagged action-bus events the cursor overlay animates, and lazily
	// auto-provisions + binds a default iframe lane on first call).
	const actionToolNames = ["navigate", "click", "type", "scroll", "tabs", "status"] as const
	for (const short of actionToolNames) {
		const toolId = `plugin.firefly.built-in.surface.browser.${short}`
		registerHostTool(BROWSER_PLUGIN_ID, toolId, async ({ args, sessionId }) => {
			if (!sessionId) return err("missing_session", "browser tools require an OpenCode session")
			const mapped = resolveWebToolDispatch(toolId, args)
			if (!mapped) return err("unsupported_tool", `no dispatch mapping for ${toolId}`)
			const { dispatchBrowserTool } = await import("../palot-browser-dispatcher")
			const result = await dispatchBrowserTool({ sessionId, toolName: mapped.toolName, args: mapped.args })
			if (result.status === "failed") return err("browser_dispatch_failed", result.resultSummary)
			return ok({ status: result.status, result: result.resultSummary })
		})
	}

	// web.read: streamed mode → engine documentText; iframe → fail fast naming precondition.
	registerHostTool(BROWSER_PLUGIN_ID, "plugin.firefly.built-in.surface.browser.read", async ({ args, sessionId }) => {
		if (!sessionId) return err("missing_session", "browser tools require an OpenCode session")
		const { dispatchBrowserTool } = await import("../palot-browser-dispatcher")
		const result = await dispatchBrowserTool({
			sessionId,
			toolName: "browser_read",
			args: args ?? {},
		})
		if (result.status === "failed") return err("browser_dispatch_failed", result.resultSummary)
		if (result.resultSummary.startsWith("needs_streamed_mode")) {
			return err(
				"needs_streamed_mode",
				"web.read requires the streamed browser engine (Magic Browser); the default iframe lane cannot read cross-origin DOM. Use web.mode mode=streamed to switch.",
			)
		}
		return ok({ status: result.status, result: result.resultSummary })
	})

	// web.mode: switch the bound lane mode for this session.
	registerHostTool(BROWSER_PLUGIN_ID, "plugin.firefly.built-in.surface.browser.mode", async ({ args, sessionId }) => {
		if (!sessionId) return err("missing_session", "browser tools require an OpenCode session")
		const mode = args.mode as "iframe" | "streamed" | undefined
		if (mode !== "iframe" && mode !== "streamed") {
			return err("validation_error", `web.mode requires mode=iframe or mode=streamed; got ${JSON.stringify(mode)}`)
		}
		const { dispatchBrowserTool } = await import("../palot-browser-dispatcher")
		const result = await dispatchBrowserTool({
			sessionId,
			toolName: "browser_set_mode",
			args: { mode },
		})
		if (result.status === "failed") return err("browser_dispatch_failed", result.resultSummary)
		return ok({ status: result.status, mode, result: result.resultSummary })
	})

	// Browser surface context projector: the agent reads current mode/url/bound +
	// which web.* tools are usable each turn.
	registerHostContextProjector(BROWSER_PLUGIN_ID, "browser", ({ sessionId }) =>
		buildBrowserSurfaceFragment(sessionId),
	)

	registerHostCommand(BROWSER_PLUGIN_ID, "open-browser", async () => {
		await openSidePanel("browser")
		return ok({ opened: true, tab: "browser" })
	})

	registerHostCommand(BROWSER_PLUGIN_ID, "toggle-browser", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[BROWSER_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(BROWSER_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: BROWSER_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// Studio / Office surface host handlers (firefly.built-in.surface.studio)
// ---------------------------------------------------------------------------

export interface StudioHostDeps {
	openSidePanel: (tab: "studio") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const STUDIO_PLUGIN_ID = "firefly.built-in.surface.studio"

export function registerStudioHostHandlers(deps?: Partial<StudioHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "studio") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(STUDIO_PLUGIN_ID, "plugin.firefly.built-in.surface.studio.open", async () => {
		await openSidePanel("studio")
		return ok({ opened: true, tab: "studio", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(STUDIO_PLUGIN_ID, "plugin.firefly.built-in.surface.studio.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "studio",
			available: sidePanel.availableTabs.includes("studio"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "studio",
		})
	})

	registerHostCommand(STUDIO_PLUGIN_ID, "open-studio", async () => {
		await openSidePanel("studio")
		return ok({ opened: true, tab: "studio" })
	})

	registerHostCommand(STUDIO_PLUGIN_ID, "toggle-studio", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[STUDIO_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(STUDIO_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: STUDIO_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// CH5PM Dashboard surface host handlers (firefly.built-in.surface.ch5pm)
// ---------------------------------------------------------------------------

export interface Ch5pmHostDeps {
	openSidePanel: (tab: "ch5pm") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const CH5PM_PLUGIN_ID = "firefly.built-in.surface.ch5pm"

export function registerCh5pmHostHandlers(deps?: Partial<Ch5pmHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "ch5pm") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(CH5PM_PLUGIN_ID, "plugin.firefly.built-in.surface.ch5pm.open", async () => {
		await openSidePanel("ch5pm")
		return ok({ opened: true, tab: "ch5pm", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(CH5PM_PLUGIN_ID, "plugin.firefly.built-in.surface.ch5pm.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "ch5pm",
			available: sidePanel.availableTabs.includes("ch5pm"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "ch5pm",
		})
	})

	registerHostCommand(CH5PM_PLUGIN_ID, "open-ch5pm", async () => {
		await openSidePanel("ch5pm")
		return ok({ opened: true, tab: "ch5pm" })
	})

	registerHostCommand(CH5PM_PLUGIN_ID, "toggle-ch5pm", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[CH5PM_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(CH5PM_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: CH5PM_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// PDF Review surface host handlers (firefly.built-in.surface.pdf-review)
// ---------------------------------------------------------------------------

export interface PdfReviewHostDeps {
	openSidePanel: (tab: "pdf-review") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const PDF_REVIEW_PLUGIN_ID = "firefly.built-in.surface.pdf-review"

export function registerPdfReviewHostHandlers(deps?: Partial<PdfReviewHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "pdf-review") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(PDF_REVIEW_PLUGIN_ID, "plugin.firefly.built-in.surface.pdf-review.open", async () => {
		await openSidePanel("pdf-review")
		return ok({ opened: true, tab: "pdf-review", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(PDF_REVIEW_PLUGIN_ID, "plugin.firefly.built-in.surface.pdf-review.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "pdf-review",
			available: sidePanel.availableTabs.includes("pdf-review"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "pdf-review",
		})
	})

	registerHostCommand(PDF_REVIEW_PLUGIN_ID, "open-pdf-review", async () => {
		await openSidePanel("pdf-review")
		return ok({ opened: true, tab: "pdf-review" })
	})

	registerHostCommand(PDF_REVIEW_PLUGIN_ID, "toggle-pdf-review", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[PDF_REVIEW_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(PDF_REVIEW_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: PDF_REVIEW_PLUGIN_ID, enabled: next.enabled })
	})
}

// ---------------------------------------------------------------------------
// CRM surface host handlers (firefly.built-in.surface.crm)
// ---------------------------------------------------------------------------

export interface CrmHostDeps {
	openSidePanel: (tab: "crm") => Promise<void>
	getSidePanelState: () => SidePanelStateSnapshot
	setPluginEnabled: (pluginId: string, enabled: boolean) => { enabled: boolean }
}

const CRM_PLUGIN_ID = "firefly.built-in.surface.crm"

export function registerCrmHostHandlers(deps?: Partial<CrmHostDeps>): void {
	const openSidePanel =
		deps?.openSidePanel ??
		(async (tab: "crm") => {
			const { broadcastOpenSidePanel } = await import("../palot-browser-ipc")
			await broadcastOpenSidePanel(tab)
		})
	const getSidePanelState = deps?.getSidePanelState ?? defaultGetSidePanelState
	const setEnabled =
		deps?.setPluginEnabled ??
		((pluginId: string, enabled: boolean) => {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const authority = require("./authority") as typeof import("./authority")
			return authority.setPluginEnabled(pluginId, enabled)
		})

	registerHostTool(CRM_PLUGIN_ID, "plugin.firefly.built-in.surface.crm.open", async () => {
		await openSidePanel("crm")
		return ok({ opened: true, tab: "crm", source: "v2-plugin-tool-dispatch" })
	})

	registerHostTool(CRM_PLUGIN_ID, "plugin.firefly.built-in.surface.crm.state", async () => {
		const sidePanel = getSidePanelState()
		return ok({
			tab: "crm",
			available: sidePanel.availableTabs.includes("crm"),
			open: sidePanel.open,
			active: sidePanel.open && sidePanel.activeTab === "crm",
		})
	})

	registerHostCommand(CRM_PLUGIN_ID, "open-crm", async () => {
		await openSidePanel("crm")
		return ok({ opened: true, tab: "crm" })
	})

	registerHostCommand(CRM_PLUGIN_ID, "toggle-crm", async () => {
		const catalog = getPluginCatalog()
		const state = catalog.capabilityStates[CRM_PLUGIN_ID]
		const currentlyEnabled = !(state?.pluginDisabled ?? false)
		const next = setEnabled(CRM_PLUGIN_ID, !currentlyEnabled)
		return ok({ pluginId: CRM_PLUGIN_ID, enabled: next.enabled })
	})
}

export function registerDevmuxHostHandlers(): void {
	// UI commands (renderer-invoked via firefly-plugin:invoke).
	registerHostCommand(DEVMUX_TOOLBAR_PLUGIN_ID, "devmux-list", ({ args }) => devmuxList(args))
	registerHostCommand(DEVMUX_TOOLBAR_PLUGIN_ID, "devmux-status", ({ args }) => devmuxStatus(args))
	registerHostCommand(DEVMUX_TOOLBAR_PLUGIN_ID, "devmux-launch", ({ args }) => devmuxLaunch(args))

	// Agent tools (OpenCode-invoked via firefly-plugin:invoke-tool).
	registerHostTool(DEVMUX_TOOLBAR_PLUGIN_ID, "plugin.firefly.built-in.devmux-toolbar.list", ({ args }) =>
		devmuxList(args),
	)
	registerHostTool(
		DEVMUX_TOOLBAR_PLUGIN_ID,
		"plugin.firefly.built-in.devmux-toolbar.status",
		({ args }) => devmuxStatus(args),
	)
	registerHostTool(
		DEVMUX_TOOLBAR_PLUGIN_ID,
		"plugin.firefly.built-in.devmux-toolbar.ensure",
		({ args }) => devmuxLaunch(args),
	)
}

export function registerBuiltInHostCommands(): void {
	registerHostCommand(
		"firefly.built-in.palot-bridge",
		"palot-open-side-panel",
		invokePalotOpenSidePanel,
	)
	registerHostCommand(
		"firefly.built-in.palot-bridge",
		"palot-refresh-ui-state",
		invokePalotRefreshUiState,
	)
	registerHostCommand("firefly.built-in.palot-bridge", "palot-ui-state", invokePalotUiState)
	registerHostCommand("acme.acme-notebook", "acme-notebook-open", invokeAcmeNotebookOpen)
	registerHostCommand("acme.acme-notebook", "acme-notebook-clear", invokeAcmeNotebookClear)
	registerBrowserHostHandlers()
	registerNotesHostHandlers()
	registerReviewHostHandlers()
	registerFilesHostHandlers()
	registerArtifactsHostHandlers()
	registerBridgesHostHandlers()
	registerPulseHostHandlers()
	registerMemoryHostHandlers()
	registerEditorHostHandlers()
	registerTerminalHostHandlers()
	registerClaudeHostHandlers()
	registerOracleHostHandlers()
	registerVoiceHostHandlers()
	registerStudioHostHandlers()
	registerCh5pmHostHandlers()
	registerPdfReviewHostHandlers()
	registerCrmHostHandlers()
	registerDevmuxHostHandlers()
	log.info("Registered V2 host command handlers", {
		commands: Array.from(handlers.keys()),
		tools: Array.from(toolHandlers.keys()),
	})
}
