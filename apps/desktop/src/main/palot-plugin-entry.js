const pluginModule = await import("./palot-plugin/plugin.js")

export const createBridgeClient = pluginModule.createBridgeClient
export const createPalotPlugin = pluginModule.createPalotPlugin
export const buildComponentsListHandler = pluginModule.buildComponentsListHandler
export const buildComponentsDescribeHandler = pluginModule.buildComponentsDescribeHandler
export const PALOT_PLUGIN_ENTRY_RELATIVE_PATH = "apps/desktop/src/main/palot-plugin-entry.js"
export default pluginModule.default
