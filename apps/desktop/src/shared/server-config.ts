/**
 * Shared server configuration constants.
 *
 * Used by both the main process and the renderer. Keep this module
 * free of Electron or React imports so it can be bundled in either context.
 */

import type {
	LocalServerConfig,
	RemoteServerConfig,
	ServerSettings,
} from "../preload/api"
import type { OpenCodeRuntimeDescriptor } from "./opencode-runtime"

export const DEFAULT_LOCAL_SERVER_PORT = 14096

export const DEFAULT_BUNDLED_LOCAL_RUNTIME: OpenCodeRuntimeDescriptor = {
	mode: "bundled-local",
	source: "bundled-portable",
	ownership: "elf-managed",
	lifecycle: "managed",
}

export const DEFAULT_EXISTING_LOCAL_RUNTIME: OpenCodeRuntimeDescriptor = {
	mode: "existing-local",
	source: "existing-daemon",
	ownership: "externally-managed",
	lifecycle: "attach-only",
}

export const DEFAULT_REMOTE_HTTP_RUNTIME: OpenCodeRuntimeDescriptor = {
	mode: "remote-http",
	source: "remote-url",
	ownership: "externally-managed",
	lifecycle: "attach-only",
}

/** The built-in local server entry. Always present, cannot be deleted. */
export const DEFAULT_LOCAL_SERVER: LocalServerConfig = {
	id: "local",
	name: "This Mac",
	type: "local",
	runtime: DEFAULT_BUNDLED_LOCAL_RUNTIME,
	runtimeKind: "bundled",
	ownership: "managed",
	port: DEFAULT_LOCAL_SERVER_PORT,
}

export function resolveOpenCodeRuntime(
	server: Pick<LocalServerConfig, "type" | "runtime" | "runtimeKind" | "ownership"> | Pick<RemoteServerConfig, "type" | "runtime">,
): OpenCodeRuntimeDescriptor {
	if (server.runtime) return server.runtime
	if (server.type === "remote") return DEFAULT_REMOTE_HTTP_RUNTIME
	if (server.runtimeKind === "bundled") {
		return {
			...DEFAULT_BUNDLED_LOCAL_RUNTIME,
			lifecycle: server.ownership === "attach-only" ? "attach-only" : "managed",
			ownership: server.ownership === "attach-only" ? "externally-managed" : "elf-managed",
		}
	}
	if (server.runtimeKind === "host" || !server.runtimeKind) {
		return {
			...DEFAULT_EXISTING_LOCAL_RUNTIME,
			lifecycle: server.ownership === "managed" ? "managed" : "attach-only",
			ownership: server.ownership === "managed" ? "elf-managed" : "externally-managed",
		}
	}
	throw new Error(`Unsupported alpha OpenCode runtimeKind: ${server.runtimeKind}`)
	}

/** Default server settings for fresh installs. */
export const DEFAULT_SERVER_SETTINGS: ServerSettings = {
	servers: [DEFAULT_LOCAL_SERVER],
	activeServerId: "local",
}
