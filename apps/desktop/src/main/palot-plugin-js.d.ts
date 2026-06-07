declare module "./palot-plugin/plugin.js" {
	export interface PalotBridgeClientOptions {
		fetchImpl?: typeof fetch
		env?: Record<string, string | undefined>
	}

	export type PalotBridgeRequest = (payload: unknown) => Promise<unknown>

	export function createBridgeClient(options?: PalotBridgeClientOptions): PalotBridgeRequest | null
	export function createPalotPlugin(...args: unknown[]): unknown
	export function buildProductContextBlock(resolved: unknown): string | null
	export function buildBrowserToolHandler(input: unknown): unknown
	export function buildOpenSidePanelHandler(input: unknown): unknown
	export function buildUiStateHandler(input: unknown): unknown
	export function createQueuedResponse(input: unknown): unknown
	export function createResolver(input: unknown): unknown
	export function createTypedError(input: unknown): unknown
	export function formatConnectionSummary(input: unknown): string | null

	const plugin: {
		id: string
		server: unknown
	}
	export const server: unknown
	export default plugin
}
