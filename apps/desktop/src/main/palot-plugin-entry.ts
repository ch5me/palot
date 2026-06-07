export interface PalotBridgeClientOptions {
	fetchImpl?: typeof fetch
	env?: Record<string, string | undefined>
}

export type PalotBridgeRequest = (payload: unknown) => Promise<unknown>

export interface PalotPluginModule {
	id: string
	server: unknown
}

export const PALOT_PLUGIN_ENTRY_RELATIVE_PATH = "apps/desktop/src/main/palot-plugin-entry.js"

export async function loadPalotPluginEntry(): Promise<{
	createBridgeClient?: (options?: PalotBridgeClientOptions) => PalotBridgeRequest | null
	createPalotPlugin?: (...args: unknown[]) => unknown
	default: PalotPluginModule
}> {
	const plugin = (await import("./palot-plugin-entry.js")) as unknown as {
		createBridgeClient?: (options?: PalotBridgeClientOptions) => PalotBridgeRequest | null
		createPalotPlugin?: (...args: unknown[]) => unknown
		default?: PalotPluginModule
	}
	if (plugin.default) {
		return plugin as {
			createBridgeClient?: (options?: PalotBridgeClientOptions) => PalotBridgeRequest | null
			createPalotPlugin?: (...args: unknown[]) => unknown
			default: PalotPluginModule
		}
	}
	throw new Error("Palot plugin entry did not expose a default export")
}

export async function createBridgeClient(
	options?: PalotBridgeClientOptions,
): Promise<PalotBridgeRequest | null> {
	const plugin = await loadPalotPluginEntry()
	return plugin.createBridgeClient?.(options) ?? null
}
