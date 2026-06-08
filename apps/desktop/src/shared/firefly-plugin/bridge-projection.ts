import { z } from "zod"

import type { PluginDescriptor } from "./descriptor"
import type { ToolErrorCode } from "./tool-projection"

export const OPENCODE_BRIDGE_HOOK_KINDS = ["experimental.chat.system.transform", "event"] as const
export type OpenCodeBridgeHookKind = (typeof OPENCODE_BRIDGE_HOOK_KINDS)[number]

export const SERVER_MODE_ROLLOUT_STANCES = [
	"managed-server-only",
	"managed-and-attached",
	"all-server-modes",
] as const
export type ServerModeRolloutStance = (typeof SERVER_MODE_ROLLOUT_STANCES)[number]

export const INITIAL_SERVER_MODE_ROLLOUT_STANCE = "managed-server-only" as const

export interface OpenCodeToolDefinition {
	readonly pluginId: string
	readonly id: string
	readonly title: string
	readonly description: string
	readonly scope: "session" | "project" | "app"
	readonly requires: readonly string[]
	readonly timeoutMs: number
	readonly preview: boolean
	readonly argsShape: z.ZodRawShape
	readonly argsSchema: z.ZodType<Record<string, unknown>>
	readonly resultSchemaRef: string | null
	readonly uiHints: {
		readonly openPanel: string | null
		readonly focusWidget: string | null
		readonly refreshProjection: boolean
	} | null
}

export interface OpenCodeSystemContextBlock {
	readonly pluginId: string
	readonly label: string | null
	readonly block: string
}

export interface OpenCodeHookSubscription {
	readonly pluginId: string
	readonly kind: OpenCodeBridgeHookKind
}

export interface BridgeDispatchToolBindingSummary {
	readonly toolId: string
	readonly scope: "session" | "project" | "app"
	readonly needsSessionBinding: boolean
}

export interface BridgeDispatchPathwayDecision {
	readonly pluginId: string
	readonly requiresSessionBinding: boolean
	readonly bindOnActivation: boolean
	readonly canDispatchWithoutSessionBinding: boolean
	readonly toolIdsRequiringSessionBinding: readonly string[]
	readonly toolIdsWithoutSessionBinding: readonly string[]
	readonly toolBindingSummary: readonly BridgeDispatchToolBindingSummary[]
}

export const SERVER_MODE_BEHAVIOR_KINDS = [
	"managed-runtime",
	"attached-rejected",
	"attached-install-required",
	"offline",
	"reconnect-required",
] as const
export type ServerModeBehaviorKind = (typeof SERVER_MODE_BEHAVIOR_KINDS)[number]

export const SERVER_MODE_IDS = [
	"managed",
	"attached-no-install",
	"attached-with-install",
	"offline",
	"reconnect",
] as const
export type BridgeServerModeId = (typeof SERVER_MODE_IDS)[number]

export interface ManagedRuntimeBehaviorSummary {
	readonly kind: "managed-runtime"
	readonly supportsBridgeProjection: true
	readonly requiresManagedServer: true
	readonly allowsToolDispatch: true
	readonly requiresInstallHandshake: false
	readonly note: string
}

export interface AttachedRejectedBehaviorSummary {
	readonly kind: "attached-rejected"
	readonly supportsBridgeProjection: false
	readonly requiresManagedServer: true
	readonly allowsToolDispatch: false
	readonly requiresInstallHandshake: false
	readonly note: string
}

export interface AttachedInstallRequiredBehaviorSummary {
	readonly kind: "attached-install-required"
	readonly supportsBridgeProjection: false
	readonly requiresManagedServer: false
	readonly allowsToolDispatch: false
	readonly requiresInstallHandshake: true
	readonly note: string
}

export interface OfflineBehaviorSummary {
	readonly kind: "offline"
	readonly supportsBridgeProjection: false
	readonly requiresManagedServer: false
	readonly allowsToolDispatch: false
	readonly requiresInstallHandshake: false
	readonly note: string
}

export interface ReconnectRequiredBehaviorSummary {
	readonly kind: "reconnect-required"
	readonly supportsBridgeProjection: false
	readonly requiresManagedServer: false
	readonly allowsToolDispatch: false
	readonly requiresInstallHandshake: false
	readonly note: string
}

export type BridgeServerModeBehaviorSummary =
	| ManagedRuntimeBehaviorSummary
	| AttachedRejectedBehaviorSummary
	| AttachedInstallRequiredBehaviorSummary
	| OfflineBehaviorSummary
	| ReconnectRequiredBehaviorSummary

export interface BridgeServerModeRow {
	readonly mode: BridgeServerModeId
	readonly statusBadge: string
	readonly canonicalErrorCode: ToolErrorCode | "none"
	readonly behavior: BridgeServerModeBehaviorSummary
}

export const BRIDGE_SERVER_MODE_MATRIX = [
	{
		mode: "managed",
		statusBadge: "Managed server",
		canonicalErrorCode: "none",
		behavior: {
			kind: "managed-runtime",
			supportsBridgeProjection: true,
			requiresManagedServer: true,
			allowsToolDispatch: true,
			requiresInstallHandshake: false,
			note: "Initial V2 path. Host-managed OpenCode server exposes bridge hooks, tools, and dispatch.",
		},
	},
	{
		mode: "attached-no-install",
		statusBadge: "Attached server unsupported",
		canonicalErrorCode: "bridge_unsupported_server",
		behavior: {
			kind: "attached-rejected",
			supportsBridgeProjection: false,
			requiresManagedServer: true,
			allowsToolDispatch: false,
			requiresInstallHandshake: false,
			note: "Initial V2 stance rejects attached servers that do not have bridge install support.",
		},
	},
	{
		mode: "attached-with-install",
		statusBadge: "Attached server install required",
		canonicalErrorCode: "bridge_unsupported_server",
		behavior: {
			kind: "attached-install-required",
			supportsBridgeProjection: false,
			requiresManagedServer: false,
			allowsToolDispatch: false,
			requiresInstallHandshake: true,
			note: "Reserved for V2.1 attached-server install flow; initial rollout still rejects this path.",
		},
	},
	{
		mode: "offline",
		statusBadge: "No active server",
		canonicalErrorCode: "no_active_server",
		behavior: {
			kind: "offline",
			supportsBridgeProjection: false,
			requiresManagedServer: false,
			allowsToolDispatch: false,
			requiresInstallHandshake: false,
			note: "No OpenCode server available. Bridge projections remain declared but dispatch cannot proceed.",
		},
	},
	{
		mode: "reconnect",
		statusBadge: "Reconnect required",
		canonicalErrorCode: "session_lost",
		behavior: {
			kind: "reconnect-required",
			supportsBridgeProjection: false,
			requiresManagedServer: false,
			allowsToolDispatch: false,
			requiresInstallHandshake: false,
			note: "Session binding was lost. Host must rebind before bridge tools can run again.",
		},
	},
] as const satisfies readonly BridgeServerModeRow[]

function buildOpenCodeToolArgsSchema(argsShape: z.ZodRawShape): z.ZodType<Record<string, unknown>> {
	return z.object(argsShape).passthrough()
}

function shouldSubscribeToSystemTransform(descriptor: PluginDescriptor): boolean {
	return Boolean(descriptor.bridge?.systemContextBlock?.trim())
}

function shouldSubscribeToEventHook(descriptor: PluginDescriptor): boolean {
	return descriptor.tools.length > 0
}

export function projectBridgeToolDefinitions(
	descriptor: PluginDescriptor,
): readonly OpenCodeToolDefinition[] {
	return descriptor.tools.map((tool) => ({
		pluginId: descriptor.normalizedId,
		id: tool.id,
		title: tool.title,
		description: tool.description,
		scope: tool.scope,
		requires: [...tool.requires],
		timeoutMs: tool.timeoutMs ?? descriptor.derived.defaultToolTimeoutMs,
		preview: tool.preview ?? false,
		argsShape: tool.args,
		argsSchema: buildOpenCodeToolArgsSchema(tool.args),
		resultSchemaRef: tool.resultSchemaRef ?? null,
		uiHints: tool.uiHints
			? {
					openPanel: tool.uiHints.openPanel ?? null,
					focusWidget: tool.uiHints.focusWidget ?? null,
					refreshProjection: tool.uiHints.refreshProjection ?? false,
			  }
			: null,
	}))
}

export function projectSystemContextBlock(
	descriptors: readonly PluginDescriptor[],
): string {
	return projectPerPluginSystemContextBlocks(descriptors)
		.map((entry) => entry.block)
		.join("\n\n")
}

export function projectPerPluginSystemContextBlocks(
	descriptors: readonly PluginDescriptor[],
): readonly OpenCodeSystemContextBlock[] {
	return descriptors
		.map((descriptor) => {
			const block = descriptor.bridge?.systemContextBlock?.trim() ?? ""
			if (block.length === 0) return null
			return {
				pluginId: descriptor.normalizedId,
				label: descriptor.bridge?.agentContextLabel ?? null,
				block,
			} satisfies OpenCodeSystemContextBlock
		})
		.filter((entry): entry is OpenCodeSystemContextBlock => entry !== null)
}

export function projectHookSubscriptions(
	descriptor: PluginDescriptor,
): readonly OpenCodeHookSubscription[] {
	if (!descriptor.bridge) return []
	const hooks = new Set<OpenCodeBridgeHookKind>()
	if (shouldSubscribeToSystemTransform(descriptor)) {
		hooks.add("experimental.chat.system.transform")
	}
	if (shouldSubscribeToEventHook(descriptor)) {
		hooks.add("event")
	}
	return [...hooks].map((kind) => ({
		pluginId: descriptor.normalizedId,
		kind,
	}))
}

export function projectDispatchPathwayDecision(
	descriptor: PluginDescriptor,
): BridgeDispatchPathwayDecision {
	const requiresSessionBinding = descriptor.bridge?.requiresSessionBinding ?? false
	const bindOnActivation = descriptor.bridge?.bindOnActivation ?? false
	const toolBindingSummary = descriptor.tools.map((tool) => ({
		toolId: tool.id,
		scope: tool.scope,
		needsSessionBinding: requiresSessionBinding,
	}))
	const toolIdsRequiringSessionBinding = toolBindingSummary
		.filter((tool) => tool.needsSessionBinding)
		.map((tool) => tool.toolId)
	const toolIdsWithoutSessionBinding = toolBindingSummary
		.filter((tool) => !tool.needsSessionBinding)
		.map((tool) => tool.toolId)
	return {
		pluginId: descriptor.normalizedId,
		requiresSessionBinding,
		bindOnActivation,
		canDispatchWithoutSessionBinding: !requiresSessionBinding,
		toolIdsRequiringSessionBinding,
		toolIdsWithoutSessionBinding,
		toolBindingSummary,
	}
}

export function getBridgeServerModeRow(mode: BridgeServerModeId): BridgeServerModeRow {
	const row = BRIDGE_SERVER_MODE_MATRIX.find((entry) => entry.mode === mode)
	if (!row) {
		throw new Error(`Unknown bridge server mode: ${mode}`)
	}
	return row
}

export function getCanonicalBridgeServerErrorCode(
	mode: BridgeServerModeId,
): ToolErrorCode | null {
	const code = getBridgeServerModeRow(mode).canonicalErrorCode
	return code === "none" ? null : code
}

export function supportsBridgeServerModeInRollout(
	mode: BridgeServerModeId,
	stance: ServerModeRolloutStance = INITIAL_SERVER_MODE_ROLLOUT_STANCE,
): boolean {
	if (stance === "all-server-modes") return mode !== "offline" && mode !== "reconnect"
	if (stance === "managed-and-attached") return mode === "managed" || mode === "attached-with-install"
	return mode === "managed"
}
