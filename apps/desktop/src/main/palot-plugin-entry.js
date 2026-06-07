const pluginModule = await import("../../.opencode/plugins/palot-bridge.js")

export const createBridgeClient = pluginModule.createBridgeClient
export const createPalotPlugin = pluginModule.createPalotPlugin
export default pluginModule.default
