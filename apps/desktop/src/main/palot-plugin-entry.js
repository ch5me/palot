const pluginModule = await import("./palot-plugin/plugin.js")

export const createBridgeClient = pluginModule.createBridgeClient
export const createPalotPlugin = pluginModule.createPalotPlugin
export default pluginModule.default
