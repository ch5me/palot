declare module "./palot-plugin/plugin.js" {
	export interface PalotBridgeClientOptions {
		fetchImpl?: typeof fetch
		env?: Record<string, string | undefined>
	}

	export type PalotBridgeRequest = (payload: unknown) => Promise<unknown>

	export function createBridgeClient(options?: PalotBridgeClientOptions): PalotBridgeRequest | null
	export function createPalotPlugin(...args: unknown[]): unknown
	const plugin: {
		id: string
		server: unknown
	}
	export default plugin
}
