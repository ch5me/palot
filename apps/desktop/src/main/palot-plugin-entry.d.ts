declare module "./palot-plugin/plugin.js" {
	export interface PalotBridgeClientOptions {
		fetchImpl?: typeof fetch
		env?: Record<string, string | undefined>
	}

	export type PalotBridgeRequest = (payload: unknown) => Promise<unknown>
	export type LoomHandler = (args: unknown, context: { sessionID?: string }) => Promise<string>

	export function createBridgeClient(options?: PalotBridgeClientOptions): PalotBridgeRequest | null
	export function createPalotPlugin(...args: unknown[]): unknown
	export function buildComponentsListHandler(): (args?: unknown) => Promise<string>
	export function buildComponentsDescribeHandler(): (args?: unknown) => Promise<string>
	export function buildLoomSessionOpenHandler(): LoomHandler
	export function buildLoomRenderHandler(): LoomHandler
	export function buildLoomPatchHandler(): LoomHandler
	export function buildLoomPollHandler(): LoomHandler
	export function buildLoomStateHandler(): LoomHandler
	const plugin: {
		id: string
		server: unknown
	}
	export default plugin
}
