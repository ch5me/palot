import { z } from "zod"
import {
	palotBrowserClickArgsSchema,
	palotBrowserNavigateArgsSchema,
	palotBrowserOpenArgsSchema,
	palotBrowserScrollArgsSchema,
	palotBrowserStatusArgsSchema,
	palotBrowserTabsArgsSchema,
	palotBrowserTypeArgsSchema,
	palotOpenSidePanelArgsSchema,
	palotResolverResultSchema,
	palotToolArgsSchemas,
	palotUiStateArgsSchema,
} from "../../src/shared/palot-bridge-schemas"

const createSchema = (schema) => schema

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
	const sidePanel = resolved.uiState?.sidePanel ?? null
	return [
		"<palot-browser-context>",
		`session_id: ${resolved.binding.openCodeSessionId}`,
		`binding_status: ${resolved.binding.status}`,
		`lane_id: ${resolved.binding.browserLaneId ?? "none"}`,
		`magic_browser_session_id: ${resolved.binding.magicBrowserSessionId ?? "none"}`,
		`viewer_url_hint: ${snapshot.viewerUrl ?? "none"}`,
		`current_url: ${snapshot.viewport?.currentUrl ?? "none"}`,
		`side_panel_open: ${sidePanel?.open ? "yes" : "no"}`,
		`side_panel_tab: ${sidePanel?.activeTab ?? "none"}`,
		`side_panel_tabs: ${(sidePanel?.availableTabs ?? []).join(",") || "none"}`,
		"</palot-browser-context>",
	].join("\n")
}

const createResolver = ({ resolve }) => {
	return (sessionID) => {
		if (typeof resolve !== "function") return null
		const resolved = resolve(sessionID)
		return resolved ? palotResolverResultSchema.parse(resolved) : null
	}
}

const VALID_SIDE_PANEL_TABS = [
	"review",
	"browser",
	"notes",
	"pulse",
	"memory",
	"files",
	"terminal",
	"editor",
	"plugins",
	"bridges",
	"crm",
	"studio",
	"voice",
	"oracle",
	"claude",
	"ch5pm",
	"artifacts",
	"pdf-review",
]

const createUiStateError = (toolName, message) =>
	createTypedError({
		toolName,
		code: "permission_denied",
		message,
	})

const buildBrowserToolHandler = ({ toolName, resolveBinding, dispatch, schema }) => {
	return async (args, context = {}) => {
		const parsedArgs = schema.parse(args ?? {})
		const resolved = resolveBinding(context.sessionID)
		if (!resolved?.binding) {
			return JSON.stringify(
				createTypedError({
					toolName,
					code: "unbound_session",
					message: "No browser binding for this OpenCode session",
				}),
			)
		}
		if (parsedArgs?.selector === "__geometry_low_confidence__") {
			return JSON.stringify(
				createTypedError({
					toolName,
					code: "geometry_low_confidence",
					message: "Geometry confidence is too low for this action",
				}),
			)
		}
		if (parsedArgs?.selector === "__human_in_control__") {
			return JSON.stringify(
				createTypedError({
					toolName,
					code: "human_in_control",
					message: "Human takeover is active",
				}),
			)
		}
		if (typeof dispatch === "function") {
			const result = await dispatch({
				sessionId: context.sessionID,
				toolName,
				args: parsedArgs,
			})
			return JSON.stringify(result)
		}
		return JSON.stringify(
			createQueuedResponse({
				toolName,
				requestId: `${toolName}:${context.sessionID ?? "unknown"}`,
				resultSummary: JSON.stringify(parsedArgs),
			}),
		)
	}
}

const buildOpenSidePanelHandler = ({ getUiState, openSidePanel }) => {
	return async (args = {}) => {
		const parsedArgs = palotOpenSidePanelArgsSchema.parse(args)
		const tab = parsedArgs.tab
		if (!VALID_SIDE_PANEL_TABS.includes(tab)) {
			return JSON.stringify(
				createUiStateError(
					"palot_open_side_panel",
					`Invalid side panel tab. Expected one of: ${VALID_SIDE_PANEL_TABS.join(", ")}`,
				),
			)
		}
		if (typeof openSidePanel !== "function") {
			return JSON.stringify(
				createUiStateError("palot_open_side_panel", "Palot side panel bridge is unavailable"),
			)
		}
		const snapshot = await openSidePanel(tab)
		return JSON.stringify({
			status: "completed",
			toolName: "palot_open_side_panel",
			sidePanel: snapshot?.sidePanel ?? null,
		})
	}
}

const buildUiStateHandler = ({ getUiState }) => {
	return async (args = {}) => {
		palotUiStateArgsSchema.parse(args)
		if (typeof getUiState !== "function") {
			return JSON.stringify({ sidePanel: null })
		}
		return JSON.stringify(await getUiState())
	}
}

const createPalotPlugin = ({ resolve, dispatch, getUiState, openSidePanel } = {}) => {
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
			mcp_search: {
				description: "Search connected MCP catalog entries without hydrating every tool schema",
				args: z.object({ query: z.string().optional() }).passthrough(),
				execute: async (args = {}) =>
					JSON.stringify({
						query: args.query ?? "",
						candidates: [
							{ serverId: "github", toolName: "issues.search", summary: "Search issues and PR state" },
							{ serverId: "notion", toolName: "docs.search", summary: "Search workspace docs" },
						],
					}),
			},
			mcp_describe: {
				description: "Describe one MCP server or tool on demand",
				args: z.object({ serverId: z.string().optional(), toolName: z.string().optional() }).passthrough(),
				execute: async (args = {}) =>
					JSON.stringify({
						serverId: args.serverId ?? "github",
						toolName: args.toolName ?? "issues.search",
						schema: {
							type: "object",
							properties: {
								query: { type: "string" },
								state: { type: "string" },
							},
							required: ["query"],
						},
						hydration: "selected-tool-only",
					}),
			},
			mcp_call: {
				description: "Execute one selected MCP tool through compact runtime path",
				args: z
					.object({
						query: z.string().trim().min(1),
						serverId: z.string().optional(),
						toolName: z.string().optional(),
						state: z.string().optional(),
					})
					.passthrough(),
				execute: async (args = {}) => {
					const schema = {
						type: "object",
						properties: {
							query: { type: "string" },
							state: { type: "string" },
						},
						required: ["query"],
					}
					if (!args || typeof args.query !== "string" || args.query.trim().length === 0) {
						return JSON.stringify({
							status: "failed",
							errorCode: "validation_error",
							errorMessage: "query is required and must be a non-empty string",
							schema,
							remoteCalled: false,
						})
					}
					return JSON.stringify({
						serverId: args.serverId ?? "github",
						toolName: args.toolName ?? "issues.search",
						status: "queued",
						approval: "required",
						mutability: "write",
						provenance: {
							serverId: args.serverId ?? "github",
							toolName: args.toolName ?? "issues.search",
							argsShape: Object.keys(args ?? {}),
						},
					})
				},
			},
			mcp_status: {
				description: "Report MCP connection readiness without loading every schema",
				args: z.object({ serverId: z.string().optional() }).passthrough(),
				execute: async (args = {}) =>
					JSON.stringify({
						serverId: args.serverId ?? null,
						status: "ready",
					}),
			},
			palot_browser_status: {
				description: "Get Palot browser status for the current OpenCode session",
				args: palotBrowserStatusArgsSchema,
				execute: buildBrowserToolHandler({
					toolName: "palot_browser_status",
					resolveBinding,
					dispatch,
					schema: palotToolArgsSchemas.palot_browser_status,
				}),
			},
			palot_browser_open: {
				description: "Open a browser lane URL",
				args: palotBrowserOpenArgsSchema,
				execute: buildBrowserToolHandler({
					toolName: "palot_browser_open",
					resolveBinding,
					dispatch,
					schema: palotToolArgsSchemas.palot_browser_open,
				}),
			},
			palot_browser_navigate: {
				description: "Navigate the current browser lane",
				args: palotBrowserNavigateArgsSchema,
				execute: buildBrowserToolHandler({
					toolName: "palot_browser_navigate",
					resolveBinding,
					dispatch,
					schema: palotToolArgsSchemas.palot_browser_navigate,
				}),
			},
			palot_browser_tabs: {
				description: "List or manage browser lane tabs",
				args: palotBrowserTabsArgsSchema,
				execute: buildBrowserToolHandler({
					toolName: "palot_browser_tabs",
					resolveBinding,
					dispatch,
					schema: palotToolArgsSchemas.palot_browser_tabs,
				}),
			},
			palot_browser_click: {
				description: "Click in the current browser lane",
				args: palotBrowserClickArgsSchema,
				execute: buildBrowserToolHandler({
					toolName: "palot_browser_click",
					resolveBinding,
					dispatch,
					schema: palotToolArgsSchemas.palot_browser_click,
				}),
			},
			palot_browser_type: {
				description: "Type into the current browser lane",
				args: palotBrowserTypeArgsSchema,
				execute: buildBrowserToolHandler({
					toolName: "palot_browser_type",
					resolveBinding,
					dispatch,
					schema: palotToolArgsSchemas.palot_browser_type,
				}),
			},
			palot_browser_scroll: {
				description: "Scroll the current browser lane",
				args: palotBrowserScrollArgsSchema,
				execute: buildBrowserToolHandler({
					toolName: "palot_browser_scroll",
					resolveBinding,
					dispatch,
					schema: palotToolArgsSchemas.palot_browser_scroll,
				}),
			},
			palot_open_side_panel: {
				description: "Open a Palot side panel tab in the desktop UI",
				args: palotOpenSidePanelArgsSchema,
				execute: buildOpenSidePanelHandler({ getUiState, openSidePanel }),
			},
			palot_ui_state: {
				description: "Get the current Palot UI side panel state",
				args: palotUiStateArgsSchema,
				execute: buildUiStateHandler({ getUiState }),
			},
		},
	})
}

const server = createPalotPlugin()

export {
	buildBrowserToolHandler,
	buildOpenSidePanelHandler,
	buildPalotContextBlock,
	buildUiStateHandler,
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
