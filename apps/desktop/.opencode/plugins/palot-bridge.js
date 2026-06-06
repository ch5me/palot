const createSchema = (kind) => ({ type: kind })

const createQueuedResponse = ({ toolName, requestId, resultSummary = null }) => ({
	status: "queued",
	toolName,
	requestId,
	resultSummary,
})

const createTypedError = ({ toolName, code, message }) => ({
	status: "failed",
	toolName,
	errorCode: code,
	errorMessage: message,
})

const buildPalotContextBlock = (resolved) => {
	if (!resolved?.binding || !resolved?.nonSecretSnapshot) return null
	const snapshot = resolved.nonSecretSnapshot
	return [
		"<palot-browser-context>",
		`session_id: ${resolved.binding.openCodeSessionId}`,
		`binding_status: ${resolved.binding.status}`,
		`lane_id: ${resolved.binding.browserLaneId ?? "none"}`,
		`magic_browser_session_id: ${resolved.binding.magicBrowserSessionId ?? "none"}`,
		`viewer_url_hint: ${snapshot.viewerUrl ?? "none"}`,
		`current_url: ${snapshot.viewport?.currentUrl ?? "none"}`,
		"</palot-browser-context>",
	].join("\n")
}

const createResolver = ({ resolve }) => {
	return (sessionID) => {
		if (typeof resolve !== "function") return null
		return resolve(sessionID)
	}
}

const buildToolHandler = ({ toolName, resolveBinding }) => {
	return async (args, context = {}) => {
		const resolved = resolveBinding(context.sessionID)
		if (!resolved?.binding) {
			return createTypedError({
				toolName,
				code: "unbound_session",
				message: "No browser binding for this OpenCode session",
			})
		}
		if (args?.selector === "__geometry_low_confidence__") {
			return createTypedError({
				toolName,
				code: "geometry_low_confidence",
				message: "Geometry confidence is too low for this action",
			})
		}
		if (args?.selector === "__human_in_control__") {
			return createTypedError({
				toolName,
				code: "human_in_control",
				message: "Human takeover is active",
			})
		}
		return createQueuedResponse({
			toolName,
			requestId: `${toolName}:${context.sessionID ?? "unknown"}`,
			resultSummary: JSON.stringify(args ?? {}),
		})
	}
}

const createPalotPlugin = ({ resolve } = {}) => {
	const resolveBinding = createResolver({ resolve })
	return async () => ({
		"experimental.chat.system.transform": async (input, output) => {
			if (!input?.sessionID) return
			const resolved = resolveBinding(input.sessionID)
			const block = buildPalotContextBlock(resolved)
			if (!block) return
			output.system.push(block)
		},
		event: async ({ event }) => {
			if (!event || event.type !== "session.idle") return
			if (event.properties?.sessionID) {
				resolveBinding(event.properties.sessionID)
			}
		},
		tool: {
			palot_browser_status: {
				description: "Get Palot browser status for the current OpenCode session",
				args: createSchema("status"),
				execute: buildToolHandler({ toolName: "palot_browser_status", resolveBinding }),
			},
			palot_browser_open: {
				description: "Open a browser lane URL",
				args: createSchema("open"),
				execute: buildToolHandler({ toolName: "palot_browser_open", resolveBinding }),
			},
			palot_browser_navigate: {
				description: "Navigate the current browser lane",
				args: createSchema("navigate"),
				execute: buildToolHandler({ toolName: "palot_browser_navigate", resolveBinding }),
			},
			palot_browser_tabs: {
				description: "List or manage browser lane tabs",
				args: createSchema("tabs"),
				execute: buildToolHandler({ toolName: "palot_browser_tabs", resolveBinding }),
			},
			palot_browser_click: {
				description: "Click in the current browser lane",
				args: createSchema("click"),
				execute: buildToolHandler({ toolName: "palot_browser_click", resolveBinding }),
			},
			palot_browser_type: {
				description: "Type into the current browser lane",
				args: createSchema("type"),
				execute: buildToolHandler({ toolName: "palot_browser_type", resolveBinding }),
			},
			palot_browser_scroll: {
				description: "Scroll the current browser lane",
				args: createSchema("scroll"),
				execute: buildToolHandler({ toolName: "palot_browser_scroll", resolveBinding }),
			},
		},
	})
}

const server = createPalotPlugin()

export {
	buildPalotContextBlock,
	buildToolHandler,
	createPalotPlugin,
	createQueuedResponse,
	createResolver,
	createTypedError,
	server,
}
export default {
	id: "palot-bridge",
	server,
}
