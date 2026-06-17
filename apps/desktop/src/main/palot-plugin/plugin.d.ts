export {}
declare module "./plugin.js" {
	export type LoomHandler = (args: unknown, context: { sessionID?: string }) => Promise<string>
	export function buildLoomSessionOpenHandler(): LoomHandler
	export function buildLoomRenderHandler(): LoomHandler
	export function buildLoomPatchHandler(): LoomHandler
	export function buildLoomPollHandler(): LoomHandler
	export function buildComponentsListHandler(): (args?: unknown) => Promise<string>
	export function buildComponentsDescribeHandler(): (args?: unknown) => Promise<string>
}
