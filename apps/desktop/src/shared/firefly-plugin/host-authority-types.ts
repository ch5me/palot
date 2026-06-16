/**
 * Firefly Plugin System V2 — HostAuthority contract
 *
 * This file is importable by both the Electron main process and the renderer
 * (and eventually the web build). It carries TYPES ONLY — no logic, no
 * Electron imports, no side-effects.
 *
 * §2.4 of docs/firefly-plugin-marketplace-design.md defines the seam:
 *
 *   ElectronHostAuthority  — main process, delegates to authority.ts/dispatch.ts
 *   CloudHostAuthority     — web build backed by firefly-cloud (Phase 3+)
 *
 * The renderer (identical in both builds) consumes projections + issues RPC
 * against whichever authority is wired in. This interface is that contract.
 */

// ---------------------------------------------------------------------------
// Opaque data shapes mirroring what the IPC channels return
// ---------------------------------------------------------------------------

export interface HostPluginListResult {
	appVersion: string
	plugins: {
		pluginId: string
		displayName: string
		version: string
		trust: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
		status: "validated" | "installed" | "disabled" | "active" | "degraded" | "quarantined"
		manifestRevision: number
		appVersion: string
		requiredCapabilities: string[]
		defaultGrantedCapabilities: string[]
		statusDetail?: string
		source?: "built-in" | "disk"
	}[]
	summaries: {
		pluginId: string
		panelCount: number
		widgetCount: number
		commandCount: number
		themeCount: number
		toolCount: number
		componentCount: number
	}[]
	knownCommands: string[]
}

export interface HostPluginDescribeResult {
	entry: unknown | null
	projection: unknown | null
	decision: {
		pluginId: string
		token: string
		granted: boolean
		reason: string
		reasonCode: string
		risk: "low" | "medium" | "high" | "critical"
		knownToHost: boolean
		grantedTokens: readonly string[]
	}
}

export interface HostPluginStateResult {
	found: boolean
	pluginId: string
	state: {
		trust: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
		sessionScope: "session" | "project" | "app"
		grantedTokens: readonly string[]
		loading?: boolean
		pluginDisabled?: boolean
		pluginQuarantined?: boolean
		pluginError?: { code: string; message: string } | null
	}
	decision: {
		pluginId: string
		token: string
		granted: boolean
		reason: string
		reasonCode: string
		risk: "low" | "medium" | "high" | "critical"
		knownToHost: boolean
		grantedTokens: readonly string[]
	}
}

export interface HostPluginToolItem {
	pluginId: string
	id: string
	title: string
	description: string
	scope: "session" | "project" | "app"
	requires: string[]
	timeoutMs: number
	preview: boolean
}

export interface HostPluginToolsResult {
	appVersion: string
	tools: HostPluginToolItem[]
}

export interface HostPluginFamilyResult {
	appVersion: string
	items: unknown[]
}

export interface HostPluginRefreshResult {
	appVersion: string
	pluginCount: number
}

export interface HostPluginLifecycleStateSnapshot {
	pluginId: string
	enabled: boolean
	quarantined: boolean
	quarantineDetail: string | null
	uiCrashCount: number
}

export interface HostPluginSetEnabledResult extends HostPluginLifecycleStateSnapshot {
	pluginId: string
}

export interface HostPluginPanelCrashResult extends HostPluginLifecycleStateSnapshot {
	pluginId: string
}

export interface HostPluginReleaseQuarantineResult extends HostPluginLifecycleStateSnapshot {
	pluginId: string
}

export type HostToolDispatchEnvelope = {
	status: "completed" | "failed" | "denied" | "unavailable" | "queued" | "cancelled"
	pluginId: string
	commandId: string
	errorCode?: string
	errorMessage?: string
	data?: unknown
}

// ---------------------------------------------------------------------------
// The HostAuthority interface — one contract, two implementations (§2.4)
// ---------------------------------------------------------------------------

/**
 * Single contract that the rest of the system is build-agnostic against.
 *
 * - **ElectronHostAuthority** (main process) — local lifecycle, delegates to
 *   `authority.ts` / `dispatch.ts`.
 * - **CloudHostAuthority** (web build) — backed by firefly-cloud over HTTP/WS
 *   RPC (Phase 3+). Until then, every method throws "not implemented in web yet".
 *
 * All methods are synchronous where the underlying authority is synchronous and
 * async where it is (invoke/invokeTool). Return types match the IPC serialized
 * shapes so the renderer bridge and the direct host wiring share the same types.
 */
export interface HostAuthority {
	/** Full catalog list: plugin entries + projection summaries + known commands. */
	catalog(): HostPluginListResult

	/** Per-plugin description: entry + projection summary + capability decision. */
	describe(pluginId: string): HostPluginDescribeResult

	/** Per-plugin capability state + decision. */
	state(pluginId: string): HostPluginStateResult

	/** All projected bridge tools from the catalog. */
	listTools(): HostPluginToolsResult

	/** All projected panels from the catalog. */
	listPanels(): HostPluginFamilyResult

	/** All projected widgets from the catalog. */
	listWidgets(): HostPluginFamilyResult

	/** All projected commands from the catalog. */
	listCommands(): HostPluginFamilyResult

	/** All projected themes from the catalog. */
	listThemes(): HostPluginFamilyResult

	/**
	 * Force-rebuild the catalog from disk and broadcast the change to all
	 * connected renderers.
	 */
	refresh(): HostPluginRefreshResult

	/** Invoke a plugin command (UI-invoked). */
	invoke(pluginId: string, commandId: string, args: Record<string, unknown>): Promise<HostToolDispatchEnvelope>

	/** Invoke a plugin tool (agent/OpenCode-invoked). */
	invokeTool(
		pluginId: string,
		toolId: string,
		args: Record<string, unknown>,
		sessionId: string | null,
	): Promise<HostToolDispatchEnvelope>

	/** Enable or disable a plugin at runtime (persisted + supervisor applied). */
	setEnabled(pluginId: string, enabled: boolean): HostPluginSetEnabledResult

	/** Report a panel render crash (contributes to quarantine threshold). */
	reportPanelCrash(pluginId: string, message: string): HostPluginPanelCrashResult

	/** Release a quarantined plugin back to service. */
	releaseQuarantine(pluginId: string, note: string): HostPluginReleaseQuarantineResult
}
