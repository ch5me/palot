export {
	buildBrowserToolHandler,
	buildConnectedAppsBlock,
	buildOpenSidePanelHandler,
	buildProductContextBlock,
	buildUiStateHandler,
	createBridgeClient,
	createPalotPlugin,
	server,
} from "../../src/main/palot-plugin/plugin.js"
import plugin from "../../src/main/palot-plugin/plugin.js"
export {
	createQueuedResponse,
	createResolver,
	createTypedError,
	formatConnectionSummary,
} from "../../src/main/palot-plugin/plugin.js"
export default {
	id: "palot-bridge",
	server: plugin.server,
}
