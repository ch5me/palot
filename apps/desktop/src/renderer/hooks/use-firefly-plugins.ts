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
	/** Human-readable reason for a non-nominal status (e.g. quarantine cause). */
	statusDetail?: string
	source?: "built-in" | "disk"
}

export interface FireflyPluginLifecycleSnapshot {
	pluginId: string
	enabled: boolean
	quarantined: boolean
	quarantineDetail: string | null
	uiCrashCount: number
}

export interface FireflyPluginProjectionSummary {
	pluginId: string
	panelCount: number
	widgetCount: number
	commandCount: number
	themeCount: number
	toolCount: number
}

export interface FireflyPluginListResult {
	appVersion: string
	plugins: FireflyPluginEntry[]
	summaries: FireflyPluginProjectionSummary[]
}

export interface FireflyPluginPanelItem {
	pluginId: string
	contributionId: string
	projectedId: string
	title: string
	icon: string | null
	formFactor: "side-panel-tab" | "main-pane"
	hostSlot: "side-panel" | "main-pane"
	hostTarget: { kind: "side-panel" | "main-pane"; slot: "side-panel" | "main-pane" }
	defaultOn: boolean
	commandIds: string[]
	persistenceKey: string | null
	telemetryNamespace: string | null
	renderMode: "host-reconciler" | "declarative-props" | "iframe"
	declarativeSchemaRef: string | null
	iframeSandbox: string | null
	capabilityGates: {
		token: string
		knownToHost: boolean
		granted: boolean
		risk: "low" | "medium" | "high" | "critical" | null
		source: "plugin" | "contribution"
		reason: string
	}[]
	availability: {
		available: boolean
		state: "ready" | "loading" | "disabled" | "quarantined" | "error"
		reason: {
			code:
				| "available"
				| "loading"
				| "plugin-disabled"
				| "plugin-quarantined"
				| "plugin-error"
				| "plugin-capability-missing"
				| "contribution-capability-missing"
				| "reserved-command-prefix"
				| "host-capability-unknown"
			message: string
			hostCapabilityState: {
				trust: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
				sessionScope: "session" | "project" | "app"
				grantedTokens: string[]
				loading?: boolean
				pluginDisabled?: boolean
				pluginQuarantined?: boolean
				pluginError?: { code: string; message: string } | null
			}
			missingCapabilities: {
				token: string
				knownToHost: boolean
				granted: boolean
				risk: "low" | "medium" | "high" | "critical" | null
				source: "plugin" | "contribution"
				reason: string
			}[]
		} | null
	}
}

export interface FireflyPluginPanelsResult {
	appVersion: string
	items: FireflyPluginPanelItem[]
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

export interface FireflyPluginToolsResult {
	appVersion: string
	tools: FireflyPluginToolItem[]
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
	panels: () => Promise<FireflyPluginPanelsResult>
	describe: (pluginId: string) => Promise<unknown>
	widgets: () => Promise<{ appVersion: string; items: unknown[] }>
	commands: () => Promise<{ appVersion: string; items: unknown[] }>
	themes: () => Promise<{ appVersion: string; items: unknown[] }>
	refresh: () => Promise<{ appVersion: string; pluginCount: number }>
	capabilities: (pluginId: string) => Promise<FireflyPluginCapabilitiesResult>
	tools: (pluginId?: string) => Promise<FireflyPluginToolsResult>
	invoke: (input: FireflyPluginInvokeInput) => Promise<FireflyPluginInvokeResult>
	setEnabled: (pluginId: string, enabled: boolean) => Promise<FireflyPluginLifecycleSnapshot>
	releaseQuarantine: (pluginId: string, note: string) => Promise<FireflyPluginLifecycleSnapshot>
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

export function useFireflyPlugins() {
	return useQuery({
		queryKey: ["firefly-plugin", "list"],
		queryFn: () => getBridge().list(),
		staleTime: 5_000,
	})
}

export function useFireflyPluginPanels() {
	return useQuery({
		queryKey: ["firefly-plugin", "panels"],
		queryFn: () => getBridge().panels(),
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
		queryFn: () => getBridge().tools(pluginId),
		staleTime: 5_000,
	})
}

export async function invokePluginCommand(
	input: FireflyPluginInvokeInput,
): Promise<FireflyPluginInvokeResult> {
	return getBridge().invoke(input)
}

/** Operator action: enable or disable a plugin at runtime. */
export async function setPluginEnabled(
	pluginId: string,
	enabled: boolean,
): Promise<FireflyPluginLifecycleSnapshot> {
	return getBridge().setEnabled(pluginId, enabled)
}

/** Operator action: release a quarantined plugin back to service. */
export async function releasePluginQuarantine(
	pluginId: string,
	note: string,
): Promise<FireflyPluginLifecycleSnapshot> {
	return getBridge().releaseQuarantine(pluginId, note)
}

export function useFireflyPluginCatalogChanged(
	handler: (payload: { appVersion: string; pluginCount: number }) => void,
) {
	const bridge = getBridge()
	return bridge.onChanged(handler)
}

export const fireflyPluginBridge = getBridge
