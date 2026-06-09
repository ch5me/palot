/**
 * Shared server configuration constants.
 *
 * Used by both the main process and the renderer. Keep this module
 * free of Electron or React imports so it can be bundled in either context.
 */

import type { LocalServerConfig, ServerSettings } from "../preload/api"

export const DEFAULT_LOCAL_SERVER_PORT = 14096

/** The built-in local server entry. Always present, cannot be deleted. */
export const DEFAULT_LOCAL_SERVER: LocalServerConfig = {
	id: "local",
	name: "This Mac",
	type: "local",
	port: DEFAULT_LOCAL_SERVER_PORT,
}

/** Default server settings for fresh installs. */
export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
	servers: [DEFAULT_LOCAL_SERVER],
	activeServerId: "local",
}
