/**
 * Firefly Plugin System V2 — renderer projection consumer
 *
 * Renders read the V2 plugin catalog from the host through the
 * `elf.plugins.*` IPC channel that main registers. This module
 * wraps the data flow in a tanstack-query query so consumers
 * (operator surface, command palette, future panels) get
 * consistent cache + refetch semantics.
 *
 * Slice 1 keeps the consumer read-only: no mutations, no local
 * capability overrides. The host-owned `capabilityStates` is the
 * single source of truth and lives entirely in main.
 */

import { useQuery } from "@tanstack/react-query"
import { buildPluginCatalog, summarizeProjection } from "../../main/firefly-plugin/catalog"

export interface FireflyPluginEntry {
	pluginId: string
	displayName: string
	version: string
	trust: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
	status: "validated" | "installed" | "disabled" | "active" | "degraded" | "quarantined"
	manifestRevision: number
	appVersion: string
	requiredCapabilities: string[]
	defaultGrantedCapabilities: string[]
}

export interface FireflyPluginProjectionSummary {
	pluginId: string
	panelCount: number
	widgetCount: number
	commandCount: number
	themeCount: number
	toolCount: number
	componentCount: number
}

export interface FireflyPluginListResult {
	appVersion: string
	plugins: FireflyPluginEntry[]
	summaries: FireflyPluginProjectionSummary[]
}

export interface FireflyPluginCapabilitiesState {
	trust: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
	sessionScope: "session" | "project" | "app"
	grantedTokens: string[]
	loading?: boolean
	pluginDisabled?: boolean
	pluginQuarantined?: boolean
	pluginError?: { code: string; message: string } | null
}

export interface FireflyPluginCapabilitiesResult {
	state: FireflyPluginCapabilitiesState
	decision: {
		pluginId: string
		token: string
		granted: boolean
		reason: string
		reasonCode: string
		risk: "low" | "medium" | "high" | "critical"
		knownToHost: boolean
		grantedTokens: string[]
	}
}

export interface FireflyPluginToolItem {
	pluginId: string
	id: string
	title: string
	description: string
	scope: "session" | "project" | "app"
	requires: string[]
	timeoutMs: number
	preview: boolean
}

export interface FireflyPluginComponentItem {
	pluginId: string
	id: string
	category: "diagram" | "decision" | "form" | "viewer" | "layout" | "custom"
	apiVersion: number
	supportsAppend: boolean
	example: { component: string; props: unknown }
	hostVocabulary: {
		slots: string[]
		zones: string[]
	}
	conflictPolicy: "agent-wins" | "human-wins" | "merge" | "ask"
	available: boolean
}

export interface FireflyPluginToolsResult {
	appVersion: string
	tools: FireflyPluginToolItem[]
}

export interface FireflyPluginComponentsResult {
	appVersion: string
	components: FireflyPluginComponentItem[]
}

export interface FireflyPluginInvokeInput {
	pluginId: string
	commandId: string
	args: Record<string, unknown>
}

export interface FireflyPluginInvokeResult {
	status: "completed" | "failed" | "denied" | "unavailable" | "queued" | "cancelled"
	pluginId: string
	commandId: string
	errorCode?: string
	errorMessage?: string
	data?: unknown
}

function getBridge(): {
	list: () => Promise<FireflyPluginListResult>
	capabilities: (pluginId: string) => Promise<FireflyPluginCapabilitiesResult>
	tools: (pluginId?: string) => Promise<FireflyPluginToolsResult>
	invoke: (input: FireflyPluginInvokeInput) => Promise<FireflyPluginInvokeResult>
	onChanged: (cb: (p: { appVersion: string; pluginCount: number }) => void) => () => void
} {
	if (typeof window === "undefined") {
		throw new Error("useFireflyPlugins is only available in the renderer")
	}
	const w = window as unknown as { elf?: { plugins?: ReturnType<typeof getBridge> } }
	if (!w.elf?.plugins) {
		throw new Error("elf.plugins bridge is not exposed in the preload script")
	}
	return w.elf.plugins
}

function buildStaticPluginList(): FireflyPluginListResult {
	const catalog = buildPluginCatalog({ appVersion: "0.11.0" })
	return {
		appVersion: catalog.appVersion,
		plugins: catalog.entries.map((entry) => ({
			...entry,
			requiredCapabilities: [...entry.requiredCapabilities],
			defaultGrantedCapabilities: [...entry.defaultGrantedCapabilities],
		})),
		summaries: summarizeProjection(catalog).map((summary) => ({ ...summary })),
	}
}

export function useFireflyPlugins() {
	return useQuery({
		queryKey: ["firefly-plugin", "list"],
		queryFn: async () => buildStaticPluginList(),
		staleTime: 5_000,
	})
}

export function useFireflyPluginCapabilities(pluginId: string) {
	return useQuery({
		queryKey: ["firefly-plugin", "capabilities", pluginId],
		queryFn: () => getBridge().capabilities(pluginId),
		enabled: Boolean(pluginId),
		staleTime: 5_000,
	})
}

export function useFireflyPluginTools(pluginId?: string) {
	return useQuery({
		queryKey: ["firefly-plugin", "tools", pluginId ?? "all"],
		queryFn: async () => {
			const catalog = buildPluginCatalog({ appVersion: "0.11.0" })
			const descriptors = pluginId
				? catalog.descriptors.filter((descriptor) => descriptor.normalizedId === pluginId)
				: catalog.descriptors
			return {
				appVersion: catalog.appVersion,
				tools: descriptors.flatMap((descriptor) =>
					descriptor.tools.map((tool) => ({
						pluginId: descriptor.normalizedId,
						id: tool.id,
						title: tool.title,
						description: tool.description,
						scope: tool.scope,
						requires: [...tool.requires],
						timeoutMs: tool.timeoutMs ?? descriptor.derived.defaultToolTimeoutMs,
						preview: tool.preview ?? false,
					})),
				),
			}
		},
		staleTime: 5_000,
	})
}

export function useFireflyPluginComponents() {
	return useQuery({
		queryKey: ["firefly-plugin", "components"],
		queryFn: async (): Promise<FireflyPluginComponentsResult> => {
			const catalog = buildPluginCatalog({ appVersion: "0.11.0" })
			return {
				appVersion: catalog.appVersion,
				components: catalog.projections.components.map((component) => ({
					pluginId: component.pluginId,
					id: component.contributionId,
					category: component.category,
					apiVersion: component.apiVersion,
					supportsAppend: component.supportsAppend,
					example: { ...component.example },
					hostVocabulary: {
						slots: [...component.hostVocabulary.slots],
						zones: [...component.hostVocabulary.zones],
					},
					conflictPolicy: component.conflictPolicy,
					available: component.availability.available,
				})),
			}
		},
		staleTime: 5_000,
	})
}

export async function invokePluginCommand(
	input: FireflyPluginInvokeInput,
): Promise<FireflyPluginInvokeResult> {
	return getBridge().invoke(input)
}

export function useFireflyPluginCatalogChanged(
	handler: (payload: { appVersion: string; pluginCount: number }) => void,
) {
	const bridge = getBridge()
	return bridge.onChanged(handler)
}

export const fireflyPluginBridge = getBridge
