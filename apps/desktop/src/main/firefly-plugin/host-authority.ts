/**
 * Firefly Plugin System V2 — HostAuthority implementations
 *
 * Provides two concrete implementations of `HostAuthority` (§2.4 of the design doc):
 *
 *   - `ElectronHostAuthority`: wraps the existing authority.ts / dispatch.ts
 *     free-function singletons. No logic moves here — all behavior is delegated.
 *   - `CloudHostAuthority`: stub for the future web build. Every method throws a
 *     named error so the absence of an implementation is immediately visible.
 *
 * Both classes implement the shared `HostAuthority` interface from
 * `../../shared/firefly-plugin/host-authority-types`.
 *
 * IPC handlers in `ipc.ts` construct one `ElectronHostAuthority` instance and
 * route all handler calls through it, keeping the interface as the seam between
 * the host and the rest of the system.
 */

import type {
	HostAuthority,
	HostPluginDescribeResult,
	HostPluginFamilyResult,
	HostPluginListResult,
	HostPluginPanelCrashResult,
	HostPluginRefreshResult,
	HostPluginReleaseQuarantineResult,
	HostPluginSetEnabledResult,
	HostPluginStateResult,
	HostPluginToolsResult,
	HostToolDispatchEnvelope,
} from "../../shared/firefly-plugin/host-authority-types"

import {
	describePlugin,
	getPluginCapabilities,
	getPluginCatalog,
	listPluginCommands,
	listPluginEntries,
	listPluginPanels,
	listPluginProjectionSummaries,
	listPluginThemes,
	listPluginWidgets,
	refreshPluginCatalog,
	releasePluginQuarantine,
	reportPluginPanelCrash,
	setPluginEnabled,
} from "./authority"
import { invokePluginCommand, invokePluginTool, listKnownCommands } from "./dispatch"
import { projectBridgeToolDefinitions } from "../../shared/firefly-plugin/bridge-projection"
import { broadcastCatalogChanged } from "./catalog-broadcast"
import { applyEnabledToSupervisor } from "./supervisor-apply"
import { getBootedPluginWorkerSupervisor } from "./supervisor-boot"
import { createLogger } from "../logger"

const log = createLogger("firefly-plugin-host-authority")

// ---------------------------------------------------------------------------
// ElectronHostAuthority — delegates to existing authority.ts/dispatch.ts
// ---------------------------------------------------------------------------

export class ElectronHostAuthority implements HostAuthority {
	catalog(): HostPluginListResult {
		const cat = getPluginCatalog()
		return {
			appVersion: cat.appVersion,
			plugins: listPluginEntries().map((entry) => ({
				pluginId: entry.pluginId,
				displayName: entry.displayName,
				version: entry.version,
				trust: entry.trust,
				status: entry.status,
				manifestRevision: entry.manifestRevision,
				appVersion: entry.appVersion,
				requiredCapabilities: [...entry.requiredCapabilities],
				defaultGrantedCapabilities: [...entry.defaultGrantedCapabilities],
				statusDetail: entry.statusDetail,
				source: entry.source,
			})),
			summaries: listPluginProjectionSummaries().map((s) => ({
				pluginId: s.pluginId,
				panelCount: s.panelCount,
				widgetCount: s.widgetCount,
				commandCount: s.commandCount,
				themeCount: s.themeCount,
				toolCount: s.toolCount,
				componentCount: s.componentCount,
			})),
			knownCommands: listKnownCommands(),
		}
	}

	describe(pluginId: string): HostPluginDescribeResult {
		return describePlugin(pluginId)
	}

	state(pluginId: string): HostPluginStateResult {
		const caps = getPluginCapabilities(pluginId)
		return {
			found: caps.state.trust !== "built-in" || pluginId.length > 0,
			pluginId,
			state: caps.state,
			decision: caps.decision,
		}
	}

	listTools(): HostPluginToolsResult {
		const cat = getPluginCatalog()
		const tools: HostPluginToolsResult["tools"] = []
		for (const descriptor of cat.descriptors) {
			for (const projected of projectBridgeToolDefinitions(descriptor)) {
				tools.push({
					pluginId: projected.pluginId,
					id: projected.id,
					title: projected.title,
					description: projected.description,
					scope: projected.scope,
					requires: [...projected.requires],
					timeoutMs: projected.timeoutMs,
					preview: projected.preview,
				})
			}
		}
		return { appVersion: cat.appVersion, tools }
	}

	listPanels(): HostPluginFamilyResult {
		const cat = getPluginCatalog()
		return { appVersion: cat.appVersion, items: [...listPluginPanels()] }
	}

	listWidgets(): HostPluginFamilyResult {
		const cat = getPluginCatalog()
		return { appVersion: cat.appVersion, items: [...listPluginWidgets()] }
	}

	listCommands(): HostPluginFamilyResult {
		const cat = getPluginCatalog()
		return { appVersion: cat.appVersion, items: [...listPluginCommands()] }
	}

	listThemes(): HostPluginFamilyResult {
		const cat = getPluginCatalog()
		return { appVersion: cat.appVersion, items: [...listPluginThemes()] }
	}

	refresh(): HostPluginRefreshResult {
		const cat = refreshPluginCatalog()
		broadcastCatalogChanged()
		return { appVersion: cat.appVersion, pluginCount: cat.descriptors.length }
	}

	async invoke(
		pluginId: string,
		commandId: string,
		args: Record<string, unknown>,
	): Promise<HostToolDispatchEnvelope> {
		return invokePluginCommand({ pluginId, commandId, args })
	}

	async invokeTool(
		pluginId: string,
		toolId: string,
		args: Record<string, unknown>,
		sessionId: string | null,
	): Promise<HostToolDispatchEnvelope> {
		return invokePluginTool({ pluginId, toolId, args, sessionId })
	}

	setEnabled(pluginId: string, enabled: boolean): HostPluginSetEnabledResult {
		const state = setPluginEnabled(pluginId, enabled)
		const supervised = applyEnabledToSupervisor(
			getBootedPluginWorkerSupervisor(),
			pluginId,
			enabled,
		)
		broadcastCatalogChanged(`set-enabled:${enabled ? "enable" : "disable"}`)
		log.info("Plugin set-enabled applied", {
			pluginId,
			enabled,
			supervised: supervised.supervised,
			workerState: supervised.summary?.state ?? null,
		})
		return { pluginId, ...state }
	}

	reportPanelCrash(pluginId: string, message: string): HostPluginPanelCrashResult {
		const state = reportPluginPanelCrash(pluginId, message)
		broadcastCatalogChanged()
		return { pluginId, ...state }
	}

	releaseQuarantine(pluginId: string, note: string): HostPluginReleaseQuarantineResult {
		const state = releasePluginQuarantine(pluginId, note)
		broadcastCatalogChanged()
		return { pluginId, ...state }
	}
}

// ---------------------------------------------------------------------------
// CloudHostAuthority — stub for the web build (Phase 3+)
// ---------------------------------------------------------------------------

/**
 * Stub implementation for the firefly-cloud-backed web build host authority.
 *
 * The web build does not have a local Electron main process; instead it talks to
 * firefly-cloud over HTTP/WebSocket RPC (§2.4, Phase 3). Until that remote host
 * is implemented, every method throws a descriptive error so the missing
 * implementation is immediately visible rather than silently no-op'd.
 *
 * Do NOT catch these errors as "expected" — they are a fail-fast signal that
 * the caller is running in a web build context before the cloud host is ready.
 */
export class CloudHostAuthority implements HostAuthority {
	private static notImplemented(method: string): never {
		throw new Error(`HostAuthority: ${method} — not implemented in web yet`)
	}

	catalog(): HostPluginListResult {
		return CloudHostAuthority.notImplemented("catalog")
	}

	describe(_pluginId: string): HostPluginDescribeResult {
		return CloudHostAuthority.notImplemented("describe")
	}

	state(_pluginId: string): HostPluginStateResult {
		return CloudHostAuthority.notImplemented("state")
	}

	listTools(): HostPluginToolsResult {
		return CloudHostAuthority.notImplemented("listTools")
	}

	listPanels(): HostPluginFamilyResult {
		return CloudHostAuthority.notImplemented("listPanels")
	}

	listWidgets(): HostPluginFamilyResult {
		return CloudHostAuthority.notImplemented("listWidgets")
	}

	listCommands(): HostPluginFamilyResult {
		return CloudHostAuthority.notImplemented("listCommands")
	}

	listThemes(): HostPluginFamilyResult {
		return CloudHostAuthority.notImplemented("listThemes")
	}

	refresh(): HostPluginRefreshResult {
		return CloudHostAuthority.notImplemented("refresh")
	}

	async invoke(
		_pluginId: string,
		_commandId: string,
		_args: Record<string, unknown>,
	): Promise<HostToolDispatchEnvelope> {
		return CloudHostAuthority.notImplemented("invoke")
	}

	async invokeTool(
		_pluginId: string,
		_toolId: string,
		_args: Record<string, unknown>,
		_sessionId: string | null,
	): Promise<HostToolDispatchEnvelope> {
		return CloudHostAuthority.notImplemented("invokeTool")
	}

	setEnabled(_pluginId: string, _enabled: boolean): HostPluginSetEnabledResult {
		return CloudHostAuthority.notImplemented("setEnabled")
	}

	reportPanelCrash(_pluginId: string, _message: string): HostPluginPanelCrashResult {
		return CloudHostAuthority.notImplemented("reportPanelCrash")
	}

	releaseQuarantine(_pluginId: string, _note: string): HostPluginReleaseQuarantineResult {
		return CloudHostAuthority.notImplemented("releaseQuarantine")
	}
}
